begin;

update public.joulane_staff
set permissions = jsonb_strip_nulls(jsonb_build_object(
  'stockViewLogs', case when allow_stock then true else false end,
  'adminOverview', case when allow_admin then true else false end,
  'adminProducts', false,
  'adminPrices', false,
  'adminContent', false,
  'adminOrders', false,
  'adminShipping', false,
  'adminUsers', false,
  'adminSettings', false
)) || permissions;

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
      active_session.surface = 'stock'
      and actor.allow_stock
      and store.id = 'stock_logs'
      and (actor.id = 'usr_super_admin' or coalesce((actor.permissions->>'stockViewLogs')::boolean, false))
    );
end;
$$;

create or replace function public.joulane_secure_write(
  p_token uuid,
  p_id text,
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
  existing_data jsonb;
  existing_config jsonb;
  first_log jsonb;
  old_qty integer;
  new_qty integer;
begin
  select session.* into active_session
  from public.joulane_sessions session
  where session.token = p_token and session.expires_at > now();
  if active_session.token is null then return false; end if;

  select staff.* into actor
  from public.joulane_staff staff
  where staff.id = active_session.staff_id;
  if actor.id is null then return false; end if;

  select store.data into existing_data
  from public.joulane_store store
  where store.id = p_id;

  if active_session.surface = 'admin' then
    if not actor.allow_admin then return false; end if;

    if p_id = 'products' then
      if actor.id <> 'usr_super_admin'
        and not coalesce((actor.permissions->>'adminProducts')::boolean, false) then
        return false;
      end if;
      if jsonb_typeof(p_data) <> 'array' then return false; end if;
      existing_data := coalesce(existing_data, '[]'::jsonb);

      -- Inventory fields are owned by the stock surface. New products start empty.
      if exists (
        select 1
        from jsonb_array_elements(p_data) proposed
        left join jsonb_array_elements(existing_data) current
          on current->>'id' = proposed->>'id'
        where (
          current is null and (
            coalesce((proposed->>'seriesQty')::integer, 0) <> 0
            or coalesce(proposed->>'stockStatus', 'out_of_stock') <> 'out_of_stock'
          )
        ) or (
          current is not null and (
            proposed->'seriesQty' is distinct from current->'seriesQty'
            or proposed->'stockQty' is distinct from current->'stockQty'
            or proposed->'stockStatus' is distinct from current->'stockStatus'
          )
        )
      ) then return false; end if;

      -- A catalog item with physical stock cannot be deleted from the admin surface.
      if exists (
        select 1
        from jsonb_array_elements(existing_data) current
        where not exists (
          select 1 from jsonb_array_elements(p_data) proposed
          where proposed->>'id' = current->>'id'
        )
        and coalesce((current->>'seriesQty')::integer, (current->>'stockQty')::integer, 0) > 0
      ) then return false; end if;

      if actor.id <> 'usr_super_admin'
        and not coalesce((actor.permissions->>'adminPrices')::boolean, false)
        and (
          exists (
            select 1
            from jsonb_array_elements(p_data) proposed
            left join jsonb_array_elements(existing_data) current
              on current->>'id' = proposed->>'id'
            where current is null
              or proposed->'price' is distinct from current->'price'
              or proposed->'seriesPrice' is distinct from current->'seriesPrice'
              or proposed->'oldPrice' is distinct from current->'oldPrice'
          )
        ) then return false;
      end if;

    elsif p_id = 'categories' then
      if actor.id <> 'usr_super_admin'
        and not coalesce((actor.permissions->>'adminProducts')::boolean, false) then
        return false;
      end if;

    elsif p_id = 'config' then
      existing_config := coalesce(existing_data, '{}'::jsonb);
      if (p_data->'hideAllPrices') is distinct from (existing_config->'hideAllPrices')
        and actor.id <> 'usr_super_admin'
        and not coalesce((actor.permissions->>'adminPrices')::boolean, false) then
        return false;
      end if;
      if (p_data - array['hideAllPrices', '_savedAt'])
          is distinct from (existing_config - array['hideAllPrices', '_savedAt'])
        and actor.id <> 'usr_super_admin'
        and not coalesce((actor.permissions->>'adminContent')::boolean, false) then
        return false;
      end if;

    elsif p_id = 'orders' then
      if actor.id <> 'usr_super_admin'
        and not coalesce((actor.permissions->>'adminOrders')::boolean, false) then
        return false;
      end if;

    elsif p_id = 'shipping' then
      if actor.id <> 'usr_super_admin'
        and not coalesce((actor.permissions->>'adminShipping')::boolean, false) then
        return false;
      end if;

    else
      return false;
    end if;

  elsif active_session.surface = 'stock' then
    if not actor.allow_stock then return false; end if;

    if p_id = 'products' then
      if jsonb_typeof(p_data) <> 'array' or jsonb_typeof(existing_data) <> 'array' then return false; end if;
      if jsonb_array_length(p_data) <> jsonb_array_length(existing_data) then return false; end if;
      if exists (
        select 1 from jsonb_array_elements(p_data) proposed
        where not exists (
          select 1 from jsonb_array_elements(existing_data) current
          where current->>'id' = proposed->>'id'
        )
      ) then return false; end if;

      for old_qty, new_qty in
        select
          coalesce((current->>'seriesQty')::integer, (current->>'stockQty')::integer, 0),
          coalesce((proposed->>'seriesQty')::integer, (proposed->>'stockQty')::integer, 0)
        from jsonb_array_elements(existing_data) current
        join jsonb_array_elements(p_data) proposed on proposed->>'id' = current->>'id'
        where proposed is distinct from current
      loop
        if new_qty > old_qty
          and actor.id <> 'usr_super_admin'
          and not (
            coalesce((actor.permissions->>'stockAdd')::boolean, false)
            or coalesce((actor.permissions->>'stockSet')::boolean, false)
          ) then return false;
        end if;
        if new_qty < old_qty
          and actor.id <> 'usr_super_admin'
          and not (
            coalesce((actor.permissions->>'stockRemove')::boolean, false)
            or coalesce((actor.permissions->>'stockSet')::boolean, false)
          ) then return false;
        end if;
        if new_qty = old_qty
          and actor.id <> 'usr_super_admin'
          and not coalesce((actor.permissions->>'stockSet')::boolean, false) then
          return false;
        end if;
      end loop;

      if exists (
        select 1
        from jsonb_array_elements(p_data) proposed
        join jsonb_array_elements(existing_data) current on current->>'id' = proposed->>'id'
        where proposed is distinct from current
        and
        coalesce(proposed->>'stockStatus', '') <> case
          when coalesce((proposed->>'seriesQty')::integer, (proposed->>'stockQty')::integer, 0) = 0 then 'out_of_stock'
          when coalesce((proposed->>'seriesQty')::integer, (proposed->>'stockQty')::integer, 0) <= 5 then 'low_stock'
          else 'in_stock'
        end
      ) then return false; end if;

      if exists (
        select 1
        from jsonb_array_elements(p_data) proposed
        join jsonb_array_elements(existing_data) current on current->>'id' = proposed->>'id'
        where (proposed - array['seriesQty', 'stockQty', 'stockStatus'])
          is distinct from (current - array['seriesQty', 'stockQty', 'stockStatus'])
      ) then return false; end if;

    elsif p_id = 'stock_logs' then
      if jsonb_typeof(p_data) <> 'array' then return false; end if;
      existing_data := coalesce(existing_data, '[]'::jsonb);

      if jsonb_array_length(p_data) = 0 then
        if jsonb_array_length(existing_data) > 0
          and actor.id <> 'usr_super_admin'
          and not coalesce((actor.permissions->>'stockClearLogs')::boolean, false) then
          return false;
        end if;
      else
        first_log := p_data->0;
        if coalesce((
          select jsonb_agg(value order by ordinality)
          from jsonb_array_elements(p_data) with ordinality
          where ordinality > 1
        ), '[]'::jsonb) is distinct from existing_data then
          return false;
        end if;
        if actor.id <> 'usr_super_admin' and (case first_log->>'type'
          when 'add' then not coalesce((actor.permissions->>'stockAdd')::boolean, false)
          when 'remove' then not coalesce((actor.permissions->>'stockRemove')::boolean, false)
          when 'set' then not coalesce((actor.permissions->>'stockSet')::boolean, false)
          else true
        end) then return false;
        end if;
      end if;
    else
      return false;
    end if;
  else
    return false;
  end if;

  insert into public.joulane_store (id, data, updated_at)
  values (p_id, p_data, now())
  on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at;
  return true;
end;
$$;

revoke all on function public.joulane_secure_data(uuid) from public;
revoke all on function public.joulane_secure_write(uuid, text, jsonb) from public;
grant execute on function public.joulane_secure_data(uuid) to anon, authenticated;
grant execute on function public.joulane_secure_write(uuid, text, jsonb) to anon, authenticated;

commit;
