begin;

create or replace function public.joulane_reset_all_stock(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  active_session public.joulane_sessions;
  actor public.joulane_staff;
  products_data jsonb;
  logs_data jsonb;
  updated_products jsonb;
  reset_log jsonb;
  affected_models integer := 0;
  previous_cartons integer := 0;
begin
  select session.* into active_session
  from public.joulane_sessions session
  where session.token = p_token and session.expires_at > now();

  if active_session.token is null or active_session.surface <> 'stock' then
    return null;
  end if;

  select staff.* into actor
  from public.joulane_staff staff
  where staff.id = active_session.staff_id;

  if actor.id is null
    or not actor.allow_stock
    or (
      actor.id <> 'usr_super_admin'
      and not coalesce((actor.permissions->>'stockSet')::boolean, false)
    ) then
    return null;
  end if;

  select data into products_data
  from public.joulane_store
  where id = 'products'
  for update;

  select data into logs_data
  from public.joulane_store
  where id = 'stock_logs'
  for update;

  logs_data := coalesce(logs_data, '[]'::jsonb);
  if jsonb_typeof(products_data) <> 'array' or jsonb_typeof(logs_data) <> 'array' then
    return null;
  end if;

  select
    count(*) filter (where quantity > 0),
    coalesce(sum(quantity), 0)
  into affected_models, previous_cartons
  from (
    select greatest(
      coalesce(
        nullif(item.value->>'seriesQty', '')::integer,
        nullif(item.value->>'stockQty', '')::integer,
        0
      ),
      0
    ) as quantity
    from jsonb_array_elements(products_data) item
  ) inventory;

  select jsonb_agg(
    item.value
      || jsonb_build_object('seriesQty', 0, 'stockQty', 0, 'stockStatus', 'out_of_stock')
    order by item.ordinality
  ) into updated_products
  from jsonb_array_elements(products_data) with ordinality item(value, ordinality);

  reset_log := jsonb_build_object(
    'id', 'log_' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text || '_' || substr(md5(random()::text), 1, 4),
    'timestamp', now(),
    'type', 'reset_all',
    'reason', 'full_inventory_reset',
    'reasonLabel', 'تصفير كامل للمخزون',
    'operator', actor.name,
    'operatorId', actor.id,
    'affectedModels', affected_models,
    'oldQty', previous_cartons,
    'newQty', 0,
    'amount', previous_cartons,
    'note', 'تم تصفير جميع كميات المخزون'
  );

  insert into public.joulane_store (id, data, updated_at)
  values ('products', coalesce(updated_products, '[]'::jsonb), now())
  on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at;

  insert into public.joulane_store (id, data, updated_at)
  values ('stock_logs', jsonb_build_array(reset_log) || logs_data, now())
  on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at;

  return jsonb_build_object(
    'affectedModels', affected_models,
    'previousCartons', previous_cartons
  );
end;
$$;

revoke all on function public.joulane_reset_all_stock(uuid) from public;
grant execute on function public.joulane_reset_all_stock(uuid) to anon, authenticated;

commit;
