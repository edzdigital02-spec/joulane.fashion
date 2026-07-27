begin;

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
  movement_ids jsonb;
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
  movement_ids := case
    when jsonb_typeof(p_delivery->'movementIds') = 'array' and jsonb_array_length(p_delivery->'movementIds') > 0
      then p_delivery->'movementIds'
    when movement_id <> '' then jsonb_build_array(movement_id)
    else '[]'::jsonb
  end;

  if recipient_phone = '' or receipt_reference = '' or jsonb_array_length(movement_ids) = 0 then return false; end if;
  if exists (
    select 1
    from jsonb_array_elements_text(movement_ids) as movement_id_value(value)
    where trim(movement_id_value.value) = ''
  ) then return false; end if;

  select data into settings_data from public.joulane_store where id = 'stock_notification_settings';
  if not exists (
    select 1 from jsonb_array_elements(coalesce(settings_data->'recipients', '[]'::jsonb)) recipient
    where recipient->>'phone' = recipient_phone
  ) then return false;
  end if;

  select data into logs_data from public.joulane_store where id = 'stock_logs';
  if exists (
    select 1 from jsonb_array_elements_text(movement_ids) as requested(requested_id)
    where not exists (
      select 1 from jsonb_array_elements(coalesce(logs_data, '[]'::jsonb)) movement
      where movement->>'id' = requested.requested_id
    )
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
    'movementId', movement_ids->>0,
    'movementIds', movement_ids,
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

revoke all on function public.joulane_receipt_delivery_mark(uuid, jsonb) from public;
grant execute on function public.joulane_receipt_delivery_mark(uuid, jsonb) to anon, authenticated;

commit;
