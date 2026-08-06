begin;

create extension if not exists pg_net with schema extensions;

create schema if not exists joulane_private;
revoke all on schema joulane_private from public, anon, authenticated;

create table if not exists joulane_private.notification_config (
  id boolean primary key default true check (id),
  secret_hash text not null,
  updated_at timestamptz not null default now()
);

create table if not exists joulane_private.order_notifications (
  order_id text primary key,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'pending_setup')),
  attempts integer not null default 0,
  message_id text,
  last_error text,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on all tables in schema joulane_private from public, anon, authenticated;

create or replace function public.joulane_notification_secret_valid(p_secret text)
returns boolean
language sql
security definer
stable
set search_path = public, extensions, joulane_private
as $$
  select exists (
    select 1
    from joulane_private.notification_config config
    where config.id = true
      and config.secret_hash = encode(extensions.digest(convert_to(coalesce(p_secret, ''), 'UTF8'), 'sha256'), 'hex')
  );
$$;

create or replace function public.joulane_notification_claim(
  p_secret text,
  p_order_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, joulane_private
as $$
declare
  normalized_id text := trim(coalesce(p_order_id, ''));
  target_order jsonb;
  current_status text;
  last_attempt timestamptz;
begin
  if not public.joulane_notification_secret_valid(p_secret) then
    return jsonb_build_object('status', 'forbidden');
  end if;
  if normalized_id = '' then
    return jsonb_build_object('status', 'invalid');
  end if;

  select item.value
  into target_order
  from public.joulane_store store
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(store.data) = 'array' then store.data else '[]'::jsonb end
  ) with ordinality item(value, position)
  where store.id = 'orders'
    and item.value->>'id' = normalized_id
  order by item.position
  limit 1;

  if target_order is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  insert into joulane_private.order_notifications (order_id)
  values (normalized_id)
  on conflict (order_id) do nothing;

  select notification.status, notification.last_attempt_at
  into current_status, last_attempt
  from joulane_private.order_notifications notification
  where notification.order_id = normalized_id
  for update;

  if current_status = 'sent' then
    return jsonb_build_object('status', 'already_sent');
  end if;
  if current_status = 'processing'
    and last_attempt is not null
    and last_attempt > now() - interval '2 minutes' then
    return jsonb_build_object('status', 'processing');
  end if;

  update joulane_private.order_notifications
  set status = 'processing',
      attempts = attempts + 1,
      last_attempt_at = now(),
      updated_at = now()
  where order_id = normalized_id;

  return jsonb_build_object('status', 'claimed', 'order', target_order);
end;
$$;

create or replace function public.joulane_notification_order(
  p_secret text,
  p_order_id text
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, extensions, joulane_private
as $$
declare
  normalized_id text := trim(coalesce(p_order_id, ''));
  target_order jsonb;
begin
  if not public.joulane_notification_secret_valid(p_secret) then
    return jsonb_build_object('status', 'forbidden');
  end if;

  select item.value
  into target_order
  from public.joulane_store store
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(store.data) = 'array' then store.data else '[]'::jsonb end
  ) with ordinality item(value, position)
  where store.id = 'orders'
    and item.value->>'id' = normalized_id
  order by item.position
  limit 1;

  if target_order is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  return jsonb_build_object('status', 'ok', 'order', target_order);
end;
$$;

create or replace function public.joulane_notification_complete(
  p_secret text,
  p_order_id text,
  p_status text,
  p_message_id text default null,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, joulane_private
as $$
declare
  normalized_status text := lower(trim(coalesce(p_status, 'failed')));
begin
  if not public.joulane_notification_secret_valid(p_secret) then
    return false;
  end if;
  if normalized_status not in ('sent', 'failed', 'pending_setup') then
    normalized_status := 'failed';
  end if;

  update joulane_private.order_notifications
  set status = normalized_status,
      message_id = nullif(trim(coalesce(p_message_id, '')), ''),
      last_error = nullif(left(coalesce(p_error, ''), 1000), ''),
      sent_at = case when normalized_status = 'sent' then now() else sent_at end,
      updated_at = now()
  where order_id = trim(coalesce(p_order_id, ''));

  return found;
end;
$$;

create or replace function public.joulane_enqueue_new_order_notification()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_order jsonb;
  previous_orders jsonb := '[]'::jsonb;
begin
  if new.id <> 'orders' or jsonb_typeof(new.data) <> 'array' then
    return new;
  end if;
  if tg_op = 'UPDATE' and jsonb_typeof(old.data) = 'array' then
    previous_orders := old.data;
  end if;

  for new_order in
    select item.value
    from jsonb_array_elements(new.data) item(value)
    where nullif(trim(item.value->>'id'), '') is not null
      and not exists (
        select 1
        from jsonb_array_elements(previous_orders) previous(value)
        where previous.value->>'id' = item.value->>'id'
      )
  loop
    perform net.http_post(
      url := 'https://www.joulanefashion.com/api/order-notification',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('orderId', new_order->>'id'),
      timeout_milliseconds := 10000
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists joulane_order_notification_trigger on public.joulane_store;
create trigger joulane_order_notification_trigger
after insert or update of data on public.joulane_store
for each row
when (new.id = 'orders')
execute function public.joulane_enqueue_new_order_notification();

revoke all on function public.joulane_notification_secret_valid(text) from public;
revoke all on function public.joulane_notification_claim(text, text) from public;
revoke all on function public.joulane_notification_order(text, text) from public;
revoke all on function public.joulane_notification_complete(text, text, text, text, text) from public;
revoke all on function public.joulane_enqueue_new_order_notification() from public;

grant execute on function public.joulane_notification_claim(text, text) to anon, authenticated;
grant execute on function public.joulane_notification_order(text, text) to anon, authenticated;
grant execute on function public.joulane_notification_complete(text, text, text, text, text) to anon, authenticated;

commit;
