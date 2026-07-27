begin;

create or replace function public.joulane_stock_movement(
  p_token uuid,
  p_product_id text,
  p_new_qty integer,
  p_log jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  active_session public.joulane_sessions;
  actor public.joulane_staff;
  products_data jsonb;
  logs_data jsonb;
  current_product jsonb;
  updated_products jsonb;
  trusted_log jsonb;
  old_qty integer;
  movement_amount integer;
  movement_type text;
  order_reference text;
  stock_status text;
begin
  if p_product_id is null or p_product_id = '' or p_new_qty < 0 or jsonb_typeof(p_log) <> 'object' then
    return false;
  end if;

  select session.* into active_session
  from public.joulane_sessions session
  where session.token = p_token and session.expires_at > now();

  if active_session.token is null or active_session.surface <> 'stock' then
    return false;
  end if;

  select staff.* into actor
  from public.joulane_staff staff
  where staff.id = active_session.staff_id;

  if actor.id is null or not actor.allow_stock then
    return false;
  end if;

  select data into products_data from public.joulane_store where id = 'products' for update;
  select data into logs_data from public.joulane_store where id = 'stock_logs' for update;
  logs_data := coalesce(logs_data, '[]'::jsonb);

  if jsonb_typeof(products_data) <> 'array' or jsonb_typeof(logs_data) <> 'array' then
    return false;
  end if;

  select item.value into current_product
  from jsonb_array_elements(products_data) item
  where item.value->>'id' = p_product_id
  limit 1;

  if current_product is null then return false; end if;

  old_qty := coalesce(
    nullif(current_product->>'seriesQty', '')::integer,
    nullif(current_product->>'stockQty', '')::integer,
    0
  );
  movement_type := p_log->>'type';
  movement_amount := coalesce(nullif(p_log->>'amount', '')::integer, 0);

  if movement_type = 'add' then
    if p_new_qty <= old_qty or movement_amount <> p_new_qty - old_qty then return false; end if;
    if actor.id <> 'usr_super_admin' and not coalesce((actor.permissions->>'stockAdd')::boolean, false) then return false; end if;
  elsif movement_type = 'remove' then
    if p_new_qty >= old_qty or movement_amount <> old_qty - p_new_qty then return false; end if;
    if actor.id <> 'usr_super_admin' and not coalesce((actor.permissions->>'stockRemove')::boolean, false) then return false; end if;
  elsif movement_type = 'set' then
    if movement_amount <> p_new_qty then return false; end if;
    if actor.id <> 'usr_super_admin' and not coalesce((actor.permissions->>'stockSet')::boolean, false) then return false; end if;
  else
    return false;
  end if;

  if coalesce(nullif(p_log->>'oldQty', '')::integer, -1) <> old_qty
    or coalesce(nullif(p_log->>'newQty', '')::integer, -1) <> p_new_qty then
    return false;
  end if;

  if p_log->>'reason' = 'customer_order' then
    order_reference := upper(trim(leading '#' from coalesce(p_log->>'orderReference', '')));
    if order_reference = '' or trim(coalesce(p_log->>'customerName', '')) = '' then return false; end if;
    if exists (
      select 1 from jsonb_array_elements(logs_data) existing
      where existing->>'type' = 'remove'
        and existing->>'productId' = p_product_id
        and upper(trim(leading '#' from coalesce(existing->>'orderReference', ''))) = order_reference
    ) then return false;
    end if;
  end if;

  stock_status := case
    when p_new_qty = 0 then 'out_of_stock'
    when p_new_qty <= 5 then 'low_stock'
    else 'in_stock'
  end;

  select jsonb_agg(
    case when item.value->>'id' = p_product_id
      then item.value || jsonb_build_object('seriesQty', p_new_qty, 'stockStatus', stock_status)
      else item.value
    end
    order by item.ordinality
  ) into updated_products
  from jsonb_array_elements(products_data) with ordinality item(value, ordinality);

  trusted_log := p_log || jsonb_build_object(
    'id', 'log_' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text || '_' || substr(md5(random()::text), 1, 4),
    'timestamp', now(),
    'operator', actor.name,
    'operatorId', actor.id,
    'oldQty', old_qty,
    'newQty', p_new_qty,
    'orderReference', coalesce(order_reference, p_log->>'orderReference', '')
  );

  insert into public.joulane_store (id, data, updated_at)
  values ('products', updated_products, now())
  on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at;

  insert into public.joulane_store (id, data, updated_at)
  values ('stock_logs', jsonb_build_array(trusted_log) || logs_data, now())
  on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at;

  return true;
end;
$$;

revoke all on function public.joulane_stock_movement(uuid, text, integer, jsonb) from public;
grant execute on function public.joulane_stock_movement(uuid, text, integer, jsonb) to anon, authenticated;

commit;
