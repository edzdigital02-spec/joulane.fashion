begin;

create or replace function public.joulane_secure_data(p_token uuid)
returns table (id text, data jsonb, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  active_session public.joulane_sessions;
  actor public.joulane_staff;
begin
  select session.* into active_session
  from public.joulane_sessions session
  where session.token = p_token and session.expires_at > now();

  if active_session.token is null then
    raise exception 'Secure session is invalid or expired' using errcode = 'P0001';
  end if;

  select staff.* into actor
  from public.joulane_staff staff
  where staff.id = active_session.staff_id;

  if actor.id is null then
    raise exception 'Staff account is unavailable' using errcode = 'P0001';
  end if;

  return query
  select store.id, store.data, store.updated_at
  from public.joulane_store store
  where (
      active_session.surface = 'admin'
      and actor.allow_admin
      and store.id = 'orders'
      and (actor.id = 'usr_super_admin' or coalesce((actor.permissions->>'adminOrders')::boolean, false))
    ) or (
      active_session.surface = 'admin'
      and actor.allow_admin
      and actor.id = 'usr_super_admin'
      and store.id in ('stock_notification_settings', 'stock_receipt_deliveries')
    ) or (
      active_session.surface = 'stock'
      and actor.allow_stock
      and store.id = 'stock_logs'
      and (actor.id = 'usr_super_admin' or coalesce((actor.permissions->>'stockViewLogs')::boolean, false))
    ) or (
      active_session.surface = 'stock'
      and actor.allow_stock
      and store.id = 'orders'
      and (actor.id = 'usr_super_admin' or coalesce((actor.permissions->>'stockRemove')::boolean, false))
    ) or (
      active_session.surface = 'stock'
      and actor.allow_stock
      and store.id = 'stock_notification_settings'
    ) or (
      active_session.surface = 'stock'
      and actor.allow_stock
      and store.id = 'stock_receipt_deliveries'
      and (actor.id = 'usr_super_admin' or coalesce((actor.permissions->>'stockViewLogs')::boolean, false))
    );
end;
$$;

create or replace function public.joulane_stock_notification_settings_save(
  p_token uuid,
  p_data jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  active_session public.joulane_sessions;
  actor public.joulane_staff;
  recipients jsonb;
  recipient_count integer;
  trusted_data jsonb;
begin
  select session.* into active_session
  from public.joulane_sessions session
  where session.token = p_token and session.expires_at > now();

  if active_session.token is null or active_session.surface <> 'admin' then return false; end if;

  select staff.* into actor
  from public.joulane_staff staff
  where staff.id = active_session.staff_id;

  if actor.id <> 'usr_super_admin' or not actor.allow_admin then return false; end if;
  if jsonb_typeof(p_data) <> 'object' or jsonb_typeof(p_data->'recipients') <> 'array' then return false; end if;

  recipients := p_data->'recipients';
  recipient_count := jsonb_array_length(recipients);
  if recipient_count < 3 or recipient_count > 4 then return false; end if;

  if exists (
    select 1 from jsonb_array_elements(recipients) recipient
    where trim(coalesce(recipient->>'id', '')) = ''
      or trim(coalesce(recipient->>'name', '')) = ''
      or coalesce(recipient->>'phone', '') !~ '^[0-9]{8,15}$'
  ) then return false;
  end if;

  if (select count(distinct recipient->>'phone') from jsonb_array_elements(recipients) recipient) <> recipient_count then
    return false;
  end if;

  trusted_data := jsonb_build_object(
    'recipients', recipients,
    'updatedAt', now(),
    'updatedBy', actor.id,
    'updatedByName', actor.name
  );

  insert into public.joulane_store (id, data, updated_at)
  values ('stock_notification_settings', trusted_data, now())
  on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at;

  return true;
end;
$$;

create or replace function public.joulane_receipt_delivery_mark(
  p_token uuid,
  p_delivery jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  active_session public.joulane_sessions;
  actor public.joulane_staff;
  settings_data jsonb;
  logs_data jsonb;
  deliveries_data jsonb;
  retained_deliveries jsonb;
  trusted_delivery jsonb;
  recipient_phone text;
  movement_id text;
  receipt_reference text;
begin
  select session.* into active_session
  from public.joulane_sessions session
  where session.token = p_token and session.expires_at > now();

  if active_session.token is null or active_session.surface <> 'stock' then return false; end if;

  select staff.* into actor
  from public.joulane_staff staff
  where staff.id = active_session.staff_id;

  if actor.id is null or not actor.allow_stock or jsonb_typeof(p_delivery) <> 'object' then return false; end if;

  recipient_phone := regexp_replace(coalesce(p_delivery->>'recipientPhone', ''), '\D', '', 'g');
  movement_id := coalesce(p_delivery->>'movementId', '');
  receipt_reference := coalesce(p_delivery->>'receiptReference', '');
  if recipient_phone = '' or movement_id = '' or receipt_reference = '' then return false; end if;

  select data into settings_data from public.joulane_store where id = 'stock_notification_settings';
  if not exists (
    select 1 from jsonb_array_elements(coalesce(settings_data->'recipients', '[]'::jsonb)) recipient
    where recipient->>'phone' = recipient_phone
  ) then return false;
  end if;

  select data into logs_data from public.joulane_store where id = 'stock_logs';
  if not exists (
    select 1 from jsonb_array_elements(coalesce(logs_data, '[]'::jsonb)) movement
    where movement->>'id' = movement_id
  ) then return false;
  end if;

  select data into deliveries_data from public.joulane_store where id = 'stock_receipt_deliveries' for update;
  deliveries_data := coalesce(deliveries_data, '[]'::jsonb);

  select coalesce(jsonb_agg(item.value order by item.ordinality), '[]'::jsonb)
  into retained_deliveries
  from jsonb_array_elements(deliveries_data) with ordinality item(value, ordinality)
  where not (
    item.value->>'receiptReference' = receipt_reference
    and item.value->>'recipientPhone' = recipient_phone
  )
  and item.ordinality <= 999;

  trusted_delivery := p_delivery || jsonb_build_object(
    'id', 'delivery_' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text || '_' || substr(md5(random()::text), 1, 4),
    'timestamp', now(),
    'recipientPhone', recipient_phone,
    'movementId', movement_id,
    'receiptReference', receipt_reference,
    'status', 'share_opened',
    'operatorId', actor.id,
    'operator', actor.name
  );

  insert into public.joulane_store (id, data, updated_at)
  values ('stock_receipt_deliveries', jsonb_build_array(trusted_delivery) || retained_deliveries, now())
  on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at;

  return true;
end;
$$;

revoke all on function public.joulane_secure_data(uuid) from public;
revoke all on function public.joulane_stock_notification_settings_save(uuid, jsonb) from public;
revoke all on function public.joulane_receipt_delivery_mark(uuid, jsonb) from public;
grant execute on function public.joulane_secure_data(uuid) to anon, authenticated;
grant execute on function public.joulane_stock_notification_settings_save(uuid, jsonb) to anon, authenticated;
grant execute on function public.joulane_receipt_delivery_mark(uuid, jsonb) to anon, authenticated;

commit;
