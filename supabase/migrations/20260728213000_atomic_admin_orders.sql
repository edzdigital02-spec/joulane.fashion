begin;

-- Remove the pre-concurrency signatures if this migration was previewed on a
-- development database before being finalized.
drop function if exists public.joulane_order_update(uuid, text, jsonb);
drop function if exists public.joulane_order_delete(uuid, text);

-- Admin order mutations intentionally operate on one order (or on a captured set
-- of order ids) while holding the `orders` store row lock. This keeps storefront
-- submissions that happen at the same time instead of replacing the full array.

create or replace function public.joulane_order_update(
  p_token uuid,
  p_order_id text,
  p_updates jsonb,
  p_expected_updated_at text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.joulane_staff;
  orders_data jsonb;
  current_order jsonb;
  safe_updates jsonb;
  updated_order jsonb;
  normalized_id text := trim(coalesce(p_order_id, ''));
begin
  if normalized_id = '' or p_updates is null or jsonb_typeof(p_updates) <> 'object' then
    return jsonb_build_object('status', 'invalid');
  end if;

  select staff.* into actor
  from public.joulane_sessions session
  join public.joulane_staff staff on staff.id = session.staff_id
  where session.token = p_token
    and session.expires_at > now()
    and session.surface = 'admin';

  if actor.id is null
    or not actor.allow_admin
    or (
      actor.id <> 'usr_super_admin'
      and not coalesce((actor.permissions->>'adminOrders')::boolean, false)
    ) then
    return jsonb_build_object('status', 'forbidden');
  end if;

  select case when jsonb_typeof(store.data) = 'array' then store.data else '[]'::jsonb end
  into orders_data
  from public.joulane_store store
  where store.id = 'orders'
  for update;

  if orders_data is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select item.value
  into current_order
  from jsonb_array_elements(orders_data) with ordinality item(value, position)
  where item.value->>'id' = normalized_id
  order by item.position
  limit 1;

  if current_order is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- Reject a stale editor instead of overwriting a newer staff change. Legacy
  -- orders without `updatedAt` compare as NULL and can still be edited once.
  if (current_order->>'updatedAt') is distinct from nullif(trim(coalesce(p_expected_updated_at, '')), '') then
    return jsonb_build_object('status', 'conflict', 'order', current_order);
  end if;

  -- The order identity and timestamps are server-owned so offline replays
  -- cannot move them backwards or change the optimistic concurrency token.
  safe_updates := p_updates - array['id', 'createdAt', 'updatedAt', 'expectedUpdatedAt'];
  updated_order := current_order
    || safe_updates
    || jsonb_build_object(
      'id', current_order->>'id',
      'updatedAt', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    );

  update public.joulane_store store
  set data = (
      select coalesce(
        jsonb_agg(
          case
            when item.value->>'id' = normalized_id then
              item.value
                || safe_updates
                || jsonb_build_object(
                  'id', item.value->>'id',
                  'updatedAt', updated_order->>'updatedAt'
                )
            else item.value
          end
          order by item.position
        ),
        '[]'::jsonb
      )
      from jsonb_array_elements(orders_data) with ordinality item(value, position)
    ),
    updated_at = now()
  where store.id = 'orders';

  return jsonb_build_object('status', 'updated', 'order', updated_order);
end;
$$;

create or replace function public.joulane_order_delete(
  p_token uuid,
  p_order_id text,
  p_expected_updated_at text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.joulane_staff;
  orders_data jsonb;
  current_order jsonb;
  normalized_id text := trim(coalesce(p_order_id, ''));
  deleted_count integer := 0;
begin
  if normalized_id = '' then
    return jsonb_build_object('status', 'invalid');
  end if;

  select staff.* into actor
  from public.joulane_sessions session
  join public.joulane_staff staff on staff.id = session.staff_id
  where session.token = p_token
    and session.expires_at > now()
    and session.surface = 'admin';

  if actor.id is null
    or not actor.allow_admin
    or (
      actor.id <> 'usr_super_admin'
      and not coalesce((actor.permissions->>'adminOrders')::boolean, false)
    ) then
    return jsonb_build_object('status', 'forbidden');
  end if;

  select case when jsonb_typeof(store.data) = 'array' then store.data else '[]'::jsonb end
  into orders_data
  from public.joulane_store store
  where store.id = 'orders'
  for update;

  if orders_data is null then
    return jsonb_build_object('status', 'not_found', 'deletedCount', 0);
  end if;

  select item.value
  into current_order
  from jsonb_array_elements(orders_data) with ordinality item(value, position)
  where item.value->>'id' = normalized_id
  order by item.position
  limit 1;

  if current_order is null then
    return jsonb_build_object('status', 'not_found', 'deletedCount', 0);
  end if;

  if (current_order->>'updatedAt') is distinct from nullif(trim(coalesce(p_expected_updated_at, '')), '') then
    return jsonb_build_object('status', 'conflict', 'order', current_order, 'deletedCount', 0);
  end if;

  select count(*)::integer into deleted_count
  from jsonb_array_elements(orders_data) item
  where item->>'id' = normalized_id;

  update public.joulane_store store
  set data = (
      select coalesce(jsonb_agg(item.value order by item.position), '[]'::jsonb)
      from jsonb_array_elements(orders_data) with ordinality item(value, position)
      where item.value->>'id' <> normalized_id
    ),
    updated_at = now()
  where store.id = 'orders'
    and deleted_count > 0;

  return jsonb_build_object(
    'status', case when deleted_count > 0 then 'deleted' else 'not_found' end,
    'orderId', normalized_id,
    'deletedCount', deleted_count
  );
end;
$$;

create or replace function public.joulane_orders_clear(
  p_token uuid,
  p_order_ids jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.joulane_staff;
  orders_data jsonb;
  remaining_orders jsonb;
  cleared_count integer := 0;
begin
  if p_order_ids is null or jsonb_typeof(p_order_ids) <> 'array' then
    return jsonb_build_object('status', 'invalid');
  end if;

  select staff.* into actor
  from public.joulane_sessions session
  join public.joulane_staff staff on staff.id = session.staff_id
  where session.token = p_token
    and session.expires_at > now()
    and session.surface = 'admin';

  if actor.id is null
    or not actor.allow_admin
    or actor.id <> 'usr_super_admin' then
    return jsonb_build_object('status', 'forbidden');
  end if;

  select case when jsonb_typeof(store.data) = 'array' then store.data else '[]'::jsonb end
  into orders_data
  from public.joulane_store store
  where store.id = 'orders'
  for update;

  if orders_data is null then
    return jsonb_build_object('status', 'cleared', 'clearedCount', 0);
  end if;

  -- The super admin passes the ids visible at confirmation time. Any order
  -- submitted concurrently (and therefore absent from this snapshot) stays.
  select coalesce(jsonb_agg(item.value order by item.position), '[]'::jsonb)
  into remaining_orders
  from jsonb_array_elements(orders_data) with ordinality item(value, position)
  where not exists (
      select 1
      from jsonb_array_elements_text(p_order_ids) target(order_id)
      where target.order_id = item.value->>'id'
    );

  cleared_count := jsonb_array_length(orders_data) - jsonb_array_length(remaining_orders);

  update public.joulane_store store
  set data = remaining_orders,
      updated_at = now()
  where store.id = 'orders'
    and cleared_count > 0;

  return jsonb_build_object('status', 'cleared', 'clearedCount', cleared_count);
end;
$$;

revoke all on function public.joulane_order_update(uuid, text, jsonb, text) from public;
revoke all on function public.joulane_order_delete(uuid, text, text) from public;
revoke all on function public.joulane_orders_clear(uuid, jsonb) from public;

grant execute on function public.joulane_order_update(uuid, text, jsonb, text) to anon, authenticated;
grant execute on function public.joulane_order_delete(uuid, text, text) to anon, authenticated;
grant execute on function public.joulane_orders_clear(uuid, jsonb) to anon, authenticated;

commit;
