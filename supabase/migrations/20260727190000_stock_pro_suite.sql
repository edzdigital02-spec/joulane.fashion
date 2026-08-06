begin;

insert into public.joulane_store (id, data, updated_at)
values
  ('stock_locations', '[{"id":"main","name":"المخزن الرئيسي","active":true}]'::jsonb, now()),
  ('stock_pro_settings', '{"lowStockThreshold":5,"approvalThreshold":20,"undoWindowMinutes":10,"staleDays":60}'::jsonb, now()),
  ('stock_snapshots', '[]'::jsonb, now()),
  ('stock_audits', '[]'::jsonb, now()),
  ('stock_approvals', '[]'::jsonb, now())
on conflict (id) do nothing;

create or replace function public.joulane_stock_pro_data(p_token uuid)
returns table(id text, data jsonb)
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

  if active_session.token is null or active_session.surface <> 'stock' then
    return;
  end if;

  select staff.* into actor
  from public.joulane_staff staff
  where staff.id = active_session.staff_id;

  if actor.id is null or not actor.allow_stock then
    return;
  end if;

  return query
  select store.id, store.data
  from public.joulane_store store
  where store.id in ('stock_locations', 'stock_pro_settings', 'stock_audits', 'stock_approvals')
    or (
      store.id = 'stock_snapshots'
      and (
        actor.id = 'usr_super_admin'
        or coalesce((actor.permissions->>'stockSet')::boolean, false)
      )
    );
end;
$$;

create or replace function public.joulane_stock_pro_save(
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
begin
  select session.* into active_session
  from public.joulane_sessions session
  where session.token = p_token and session.expires_at > now();

  if active_session.token is null or active_session.surface <> 'stock' then return false; end if;

  select staff.* into actor
  from public.joulane_staff staff
  where staff.id = active_session.staff_id;

  if actor.id is null
    or not actor.allow_stock
    or (
      actor.id <> 'usr_super_admin'
      and not coalesce((actor.permissions->>'stockSet')::boolean, false)
    ) then
    return false;
  end if;

  if p_id = 'stock_locations' then
    if jsonb_typeof(p_data) <> 'array'
      or jsonb_array_length(p_data) < 1
      or jsonb_array_length(p_data) > 30
      or exists (
        select 1
        from jsonb_array_elements(p_data) item
        where coalesce(item->>'id', '') !~ '^[a-z0-9_-]{1,40}$'
          or length(trim(coalesce(item->>'name', ''))) not between 2 and 80
      ) then
      return false;
    end if;
  elsif p_id = 'stock_pro_settings' then
    if jsonb_typeof(p_data) <> 'object'
      or coalesce((p_data->>'lowStockThreshold')::integer, -1) not between 0 and 999
      or coalesce((p_data->>'approvalThreshold')::integer, -1) not between 1 and 9999
      or coalesce((p_data->>'undoWindowMinutes')::integer, -1) not between 1 and 60
      or coalesce((p_data->>'staleDays')::integer, -1) not between 7 and 730 then
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

create or replace function public.joulane_stock_snapshot_create(
  p_token uuid,
  p_reason text default 'manual'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  active_session public.joulane_sessions;
  actor public.joulane_staff;
  products_data jsonb;
  snapshots_data jsonb;
  snapshot_id text;
  snapshot_data jsonb;
  total_cartons integer;
begin
  select session.* into active_session
  from public.joulane_sessions session
  where session.token = p_token and session.expires_at > now();
  if active_session.token is null or active_session.surface <> 'stock' then return null; end if;

  select staff.* into actor from public.joulane_staff staff where staff.id = active_session.staff_id;
  if actor.id is null or not actor.allow_stock or (
    actor.id <> 'usr_super_admin'
    and not coalesce((actor.permissions->>'stockSet')::boolean, false)
  ) then return null; end if;

  select data into products_data from public.joulane_store where id = 'products' for update;
  select data into snapshots_data from public.joulane_store where id = 'stock_snapshots' for update;
  snapshots_data := coalesce(snapshots_data, '[]'::jsonb);
  if jsonb_typeof(products_data) <> 'array' or jsonb_typeof(snapshots_data) <> 'array' then return null; end if;

  select coalesce(sum(coalesce(
    nullif(item->>'seriesQty', '')::integer,
    nullif(item->>'stockQty', '')::integer,
    0
  )), 0)
  into total_cartons
  from jsonb_array_elements(products_data) item;

  snapshot_id := 'snap_' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text
    || '_' || substr(md5(random()::text), 1, 5);
  snapshot_data := jsonb_build_object(
    'id', snapshot_id,
    'createdAt', now(),
    'createdBy', actor.id,
    'createdByName', actor.name,
    'reason', left(coalesce(nullif(trim(p_reason), ''), 'manual'), 120),
    'modelCount', jsonb_array_length(products_data),
    'totalCartons', total_cartons,
    'products', products_data
  );

  insert into public.joulane_store (id, data, updated_at)
  values (
    'stock_snapshots',
    (
      select coalesce(jsonb_agg(value order by ordinality), '[]'::jsonb)
      from jsonb_array_elements(jsonb_build_array(snapshot_data) || snapshots_data)
        with ordinality limited(value, ordinality)
      where ordinality <= 15
    ),
    now()
  )
  on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at;

  return snapshot_data - 'products';
end;
$$;

create or replace function public.joulane_stock_snapshot_restore(
  p_token uuid,
  p_snapshot_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  active_session public.joulane_sessions;
  actor public.joulane_staff;
  products_data jsonb;
  snapshots_data jsonb;
  logs_data jsonb;
  target_snapshot jsonb;
  safety_snapshot jsonb;
  safety_id text;
  restored_products jsonb;
  total_cartons integer;
  trusted_log jsonb;
begin
  select session.* into active_session
  from public.joulane_sessions session
  where session.token = p_token and session.expires_at > now();
  if active_session.token is null or active_session.surface <> 'stock' then return null; end if;

  select staff.* into actor from public.joulane_staff staff where staff.id = active_session.staff_id;
  if actor.id <> 'usr_super_admin' then return null; end if;

  select data into products_data from public.joulane_store where id = 'products' for update;
  select data into snapshots_data from public.joulane_store where id = 'stock_snapshots' for update;
  select data into logs_data from public.joulane_store where id = 'stock_logs' for update;
  snapshots_data := coalesce(snapshots_data, '[]'::jsonb);
  logs_data := coalesce(logs_data, '[]'::jsonb);

  select item into target_snapshot
  from jsonb_array_elements(snapshots_data) item
  where item->>'id' = p_snapshot_id
  limit 1;

  restored_products := target_snapshot->'products';
  if jsonb_typeof(restored_products) <> 'array' then return null; end if;

  select coalesce(sum(coalesce(
    nullif(item->>'seriesQty', '')::integer,
    nullif(item->>'stockQty', '')::integer,
    0
  )), 0)
  into total_cartons
  from jsonb_array_elements(products_data) item;

  safety_id := 'snap_' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text
    || '_' || substr(md5(random()::text), 1, 5);
  safety_snapshot := jsonb_build_object(
    'id', safety_id,
    'createdAt', now(),
    'createdBy', actor.id,
    'createdByName', actor.name,
    'reason', 'قبل استرجاع النسخة ' || p_snapshot_id,
    'modelCount', jsonb_array_length(products_data),
    'totalCartons', total_cartons,
    'products', products_data
  );

  trusted_log := jsonb_build_object(
    'id', 'log_' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text || '_' || substr(md5(random()::text), 1, 4),
    'timestamp', now(),
    'type', 'snapshot_restore',
    'reason', 'snapshot_restore',
    'reasonLabel', 'استرجاع نسخة احتياطية',
    'operator', actor.name,
    'operatorId', actor.id,
    'snapshotId', p_snapshot_id,
    'safetySnapshotId', safety_id,
    'oldQty', total_cartons,
    'newQty', coalesce((target_snapshot->>'totalCartons')::integer, 0),
    'amount', abs(total_cartons - coalesce((target_snapshot->>'totalCartons')::integer, 0))
  );

  update public.joulane_store set data = restored_products, updated_at = now() where id = 'products';
  update public.joulane_store
  set data = (
    select coalesce(jsonb_agg(value order by ordinality), '[]'::jsonb)
    from jsonb_array_elements(jsonb_build_array(safety_snapshot) || snapshots_data)
      with ordinality limited(value, ordinality)
    where ordinality <= 15
  ), updated_at = now()
  where id = 'stock_snapshots';
  update public.joulane_store set data = jsonb_build_array(trusted_log) || logs_data, updated_at = now()
  where id = 'stock_logs';

  return jsonb_build_object(
    'status', 'restored',
    'snapshotId', p_snapshot_id,
    'safetySnapshotId', safety_id,
    'modelCount', jsonb_array_length(restored_products),
    'totalCartons', coalesce((target_snapshot->>'totalCartons')::integer, 0)
  );
end;
$$;

create or replace function public.joulane_stock_movement_v2(
  p_token uuid,
  p_product_id text,
  p_new_qty integer,
  p_log jsonb
)
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
  approvals_data jsonb;
  settings_data jsonb;
  current_product jsonb;
  updated_products jsonb;
  trusted_log jsonb;
  trusted_approval jsonb;
  old_qty integer;
  movement_amount integer;
  movement_type text;
  order_reference text;
  stock_status text;
  approval_threshold integer;
  approval_id text;
  matched_approval jsonb;
begin
  if p_product_id is null or p_product_id = '' or p_new_qty < 0 or jsonb_typeof(p_log) <> 'object' then
    return jsonb_build_object('status', 'invalid');
  end if;

  select session.* into active_session
  from public.joulane_sessions session
  where session.token = p_token and session.expires_at > now();
  if active_session.token is null or active_session.surface <> 'stock' then
    return jsonb_build_object('status', 'unauthorized');
  end if;

  select staff.* into actor from public.joulane_staff staff where staff.id = active_session.staff_id;
  if actor.id is null or not actor.allow_stock then return jsonb_build_object('status', 'unauthorized'); end if;

  select data into products_data from public.joulane_store where id = 'products' for update;
  select data into logs_data from public.joulane_store where id = 'stock_logs' for update;
  select data into approvals_data from public.joulane_store where id = 'stock_approvals' for update;
  select data into settings_data from public.joulane_store where id = 'stock_pro_settings';
  logs_data := coalesce(logs_data, '[]'::jsonb);
  approvals_data := coalesce(approvals_data, '[]'::jsonb);
  approval_threshold := greatest(coalesce((settings_data->>'approvalThreshold')::integer, 20), 1);

  if jsonb_typeof(products_data) <> 'array'
    or jsonb_typeof(logs_data) <> 'array'
    or jsonb_typeof(approvals_data) <> 'array' then
    return jsonb_build_object('status', 'invalid');
  end if;

  select item.value into current_product
  from jsonb_array_elements(products_data) item
  where item.value->>'id' = p_product_id
  limit 1;
  if current_product is null then return jsonb_build_object('status', 'not_found'); end if;

  old_qty := coalesce(nullif(current_product->>'seriesQty', '')::integer, nullif(current_product->>'stockQty', '')::integer, 0);
  movement_type := p_log->>'type';
  movement_amount := coalesce(nullif(p_log->>'amount', '')::integer, 0);

  if movement_type = 'add' then
    if p_new_qty <= old_qty or movement_amount <> p_new_qty - old_qty then return jsonb_build_object('status', 'conflict'); end if;
    if actor.id <> 'usr_super_admin' and not coalesce((actor.permissions->>'stockAdd')::boolean, false) then return jsonb_build_object('status', 'unauthorized'); end if;
  elsif movement_type = 'remove' then
    if p_new_qty >= old_qty or movement_amount <> old_qty - p_new_qty then return jsonb_build_object('status', 'conflict'); end if;
    if actor.id <> 'usr_super_admin' and not coalesce((actor.permissions->>'stockRemove')::boolean, false) then return jsonb_build_object('status', 'unauthorized'); end if;
  elsif movement_type = 'set' then
    if movement_amount <> p_new_qty then return jsonb_build_object('status', 'conflict'); end if;
    if actor.id <> 'usr_super_admin' and not coalesce((actor.permissions->>'stockSet')::boolean, false) then return jsonb_build_object('status', 'unauthorized'); end if;
  else
    return jsonb_build_object('status', 'invalid');
  end if;

  if coalesce(nullif(p_log->>'oldQty', '')::integer, -1) <> old_qty
    or coalesce(nullif(p_log->>'newQty', '')::integer, -1) <> p_new_qty then
    return jsonb_build_object('status', 'conflict');
  end if;

  if p_log->>'reason' = 'customer_order' then
    order_reference := upper(trim(leading '#' from coalesce(p_log->>'orderReference', '')));
    if order_reference = '' or trim(coalesce(p_log->>'customerName', '')) = '' then return jsonb_build_object('status', 'invalid'); end if;
    if exists (
      select 1 from jsonb_array_elements(logs_data) existing
      where existing->>'type' = 'remove'
        and existing->>'productId' = p_product_id
        and upper(trim(leading '#' from coalesce(existing->>'orderReference', ''))) = order_reference
    ) then return jsonb_build_object('status', 'duplicate');
    end if;
  end if;

  if actor.id <> 'usr_super_admin' and movement_amount >= approval_threshold then
    approval_id := nullif(p_log->>'approvalId', '');
    if approval_id is not null then
      select item into matched_approval
      from jsonb_array_elements(approvals_data) item
      where item->>'id' = approval_id
        and item->>'status' = 'approved'
        and item->>'requestedBy' = actor.id
        and item->'action'->>'productId' = p_product_id
        and coalesce((item->'action'->>'newQty')::integer, -1) = p_new_qty
        and item->'action'->>'type' = movement_type
      limit 1;
      if matched_approval is null then return jsonb_build_object('status', 'approval_required'); end if;
    else
      approval_id := 'apr_' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text
        || '_' || substr(md5(random()::text), 1, 5);
      trusted_approval := jsonb_build_object(
        'id', approval_id,
        'status', 'pending',
        'requestedAt', now(),
        'requestedBy', actor.id,
        'requestedByName', actor.name,
        'action', p_log || jsonb_build_object(
          'productId', p_product_id,
          'newQty', p_new_qty,
          'oldQty', old_qty,
          'type', movement_type
        )
      );
      update public.joulane_store
      set data = jsonb_build_array(trusted_approval) || approvals_data, updated_at = now()
      where id = 'stock_approvals';
      return jsonb_build_object('status', 'approval_required', 'approvalId', approval_id);
    end if;
  end if;

  stock_status := case when p_new_qty = 0 then 'out_of_stock' when p_new_qty <= 5 then 'low_stock' else 'in_stock' end;
  select jsonb_agg(
    case when item.value->>'id' = p_product_id
      then item.value || jsonb_build_object('seriesQty', p_new_qty, 'stockQty', p_new_qty, 'stockStatus', stock_status)
      else item.value end
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
    'orderReference', coalesce(order_reference, p_log->>'orderReference', ''),
    'approvalId', coalesce(approval_id, '')
  );

  update public.joulane_store set data = updated_products, updated_at = now() where id = 'products';
  update public.joulane_store set data = jsonb_build_array(trusted_log) || logs_data, updated_at = now() where id = 'stock_logs';

  if matched_approval is not null then
    update public.joulane_store
    set data = (
      select jsonb_agg(
        case when item->>'id' = approval_id
          then item || jsonb_build_object('status', 'executed', 'executedAt', now())
          else item end
      )
      from jsonb_array_elements(approvals_data) item
    ), updated_at = now()
    where id = 'stock_approvals';
  end if;

  return jsonb_build_object('status', 'saved', 'log', trusted_log);
end;
$$;

create or replace function public.joulane_stock_approval_review(
  p_token uuid,
  p_approval_id text,
  p_decision text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  active_session public.joulane_sessions;
  actor public.joulane_staff;
  approvals_data jsonb;
  target jsonb;
begin
  if p_decision not in ('approved', 'rejected') then return null; end if;
  select session.* into active_session from public.joulane_sessions session
  where session.token = p_token and session.expires_at > now();
  if active_session.token is null or active_session.surface <> 'stock' then return null; end if;
  select staff.* into actor from public.joulane_staff staff where staff.id = active_session.staff_id;
  if actor.id <> 'usr_super_admin' then return null; end if;

  select data into approvals_data from public.joulane_store where id = 'stock_approvals' for update;
  approvals_data := coalesce(approvals_data, '[]'::jsonb);
  select item into target from jsonb_array_elements(approvals_data) item
  where item->>'id' = p_approval_id and item->>'status' = 'pending' limit 1;
  if target is null then return null; end if;

  update public.joulane_store
  set data = (
    select jsonb_agg(
      case when item->>'id' = p_approval_id
        then item || jsonb_build_object(
          'status', p_decision,
          'reviewedAt', now(),
          'reviewedBy', actor.id,
          'reviewedByName', actor.name
        )
        else item end
      order by ordinality
    )
    from jsonb_array_elements(approvals_data) with ordinality rows(item, ordinality)
  ), updated_at = now()
  where id = 'stock_approvals';

  return jsonb_build_object('status', p_decision, 'approvalId', p_approval_id);
end;
$$;

create or replace function public.joulane_stock_location_transfer(
  p_token uuid,
  p_product_id text,
  p_from_location text,
  p_to_location text,
  p_quantity integer
)
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
  locations_data jsonb;
  current_product jsonb;
  location_stock jsonb;
  current_total integer;
  from_qty integer;
  to_qty integer;
  updated_products jsonb;
  trusted_log jsonb;
begin
  if p_quantity < 1 or p_from_location = p_to_location then return null; end if;
  select session.* into active_session from public.joulane_sessions session
  where session.token = p_token and session.expires_at > now();
  if active_session.token is null or active_session.surface <> 'stock' then return null; end if;
  select staff.* into actor from public.joulane_staff staff where staff.id = active_session.staff_id;
  if actor.id is null or not actor.allow_stock or (
    actor.id <> 'usr_super_admin' and (
      not coalesce((actor.permissions->>'stockAdd')::boolean, false)
      or not coalesce((actor.permissions->>'stockRemove')::boolean, false)
    )
  ) then return null; end if;

  select data into products_data from public.joulane_store where id = 'products' for update;
  select data into logs_data from public.joulane_store where id = 'stock_logs' for update;
  select data into locations_data from public.joulane_store where id = 'stock_locations';
  logs_data := coalesce(logs_data, '[]'::jsonb);
  if not exists (select 1 from jsonb_array_elements(locations_data) item where item->>'id' = p_from_location and coalesce((item->>'active')::boolean, true))
    or not exists (select 1 from jsonb_array_elements(locations_data) item where item->>'id' = p_to_location and coalesce((item->>'active')::boolean, true))
  then return null; end if;

  select item into current_product from jsonb_array_elements(products_data) item
  where item->>'id' = p_product_id limit 1;
  if current_product is null then return null; end if;
  current_total := coalesce(nullif(current_product->>'seriesQty', '')::integer, nullif(current_product->>'stockQty', '')::integer, 0);
  location_stock := case
    when jsonb_typeof(current_product->'locationStock') = 'object' then current_product->'locationStock'
    else jsonb_build_object('main', current_total)
  end;
  from_qty := coalesce((location_stock->>p_from_location)::integer, 0);
  to_qty := coalesce((location_stock->>p_to_location)::integer, 0);
  if from_qty < p_quantity then return null; end if;
  location_stock := jsonb_set(location_stock, array[p_from_location], to_jsonb(from_qty - p_quantity), true);
  location_stock := jsonb_set(location_stock, array[p_to_location], to_jsonb(to_qty + p_quantity), true);

  select jsonb_agg(
    case when item.value->>'id' = p_product_id
      then item.value || jsonb_build_object('locationStock', location_stock)
      else item.value end
    order by item.ordinality
  ) into updated_products
  from jsonb_array_elements(products_data) with ordinality item(value, ordinality);

  trusted_log := jsonb_build_object(
    'id', 'log_' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text || '_' || substr(md5(random()::text), 1, 4),
    'timestamp', now(),
    'type', 'transfer',
    'reason', 'location_transfer',
    'reasonLabel', 'تحويل بين المواقع',
    'productId', p_product_id,
    'productName', coalesce(current_product->'name'->>'ar', current_product->>'name', 'منتج'),
    'productImg', current_product->'images'->>0,
    'amount', p_quantity,
    'oldQty', current_total,
    'newQty', current_total,
    'fromLocation', p_from_location,
    'toLocation', p_to_location,
    'operator', actor.name,
    'operatorId', actor.id
  );
  update public.joulane_store set data = updated_products, updated_at = now() where id = 'products';
  update public.joulane_store set data = jsonb_build_array(trusted_log) || logs_data, updated_at = now() where id = 'stock_logs';
  return jsonb_build_object('status', 'transferred', 'log', trusted_log, 'locationStock', location_stock);
end;
$$;

create or replace function public.joulane_stock_audit_commit(
  p_token uuid,
  p_audit jsonb
)
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
  audits_data jsonb;
  snapshots_data jsonb;
  counts_data jsonb;
  updated_products jsonb;
  snapshot_data jsonb;
  audit_data jsonb;
  trusted_log jsonb;
  snapshot_id text;
  audit_id text;
  affected_models integer;
  total_variance integer;
  previous_cartons integer;
  new_cartons integer;
begin
  if jsonb_typeof(p_audit) <> 'object' or jsonb_typeof(p_audit->'counts') <> 'array'
    or jsonb_array_length(p_audit->'counts') > 500 then return null; end if;
  select session.* into active_session from public.joulane_sessions session
  where session.token = p_token and session.expires_at > now();
  if active_session.token is null or active_session.surface <> 'stock' then return null; end if;
  select staff.* into actor from public.joulane_staff staff where staff.id = active_session.staff_id;
  if actor.id is null or not actor.allow_stock or (
    actor.id <> 'usr_super_admin'
    and not coalesce((actor.permissions->>'stockSet')::boolean, false)
  ) then return null; end if;

  counts_data := p_audit->'counts';
  if exists (
    select 1 from jsonb_array_elements(counts_data) item
    where coalesce(item->>'productId', '') = ''
      or coalesce((item->>'actualQty')::integer, -1) < 0
  ) then return null; end if;

  select data into products_data from public.joulane_store where id = 'products' for update;
  select data into logs_data from public.joulane_store where id = 'stock_logs' for update;
  select data into audits_data from public.joulane_store where id = 'stock_audits' for update;
  select data into snapshots_data from public.joulane_store where id = 'stock_snapshots' for update;
  logs_data := coalesce(logs_data, '[]'::jsonb);
  audits_data := coalesce(audits_data, '[]'::jsonb);
  snapshots_data := coalesce(snapshots_data, '[]'::jsonb);

  select coalesce(sum(coalesce(nullif(item->>'seriesQty', '')::integer, nullif(item->>'stockQty', '')::integer, 0)), 0)
  into previous_cartons from jsonb_array_elements(products_data) item;

  select
    count(*) filter (where actual_qty <> old_qty),
    coalesce(sum(abs(actual_qty - old_qty)), 0),
    coalesce(sum(actual_qty), 0)
  into affected_models, total_variance, new_cartons
  from (
    select
      coalesce((count_item->>'actualQty')::integer, 0) actual_qty,
      coalesce(nullif(product_item->>'seriesQty', '')::integer, nullif(product_item->>'stockQty', '')::integer, 0) old_qty
    from jsonb_array_elements(counts_data) count_item
    join jsonb_array_elements(products_data) product_item
      on product_item->>'id' = count_item->>'productId'
  ) variances;

  select jsonb_agg(
    case when count_item is not null then
      item.value || jsonb_build_object(
        'seriesQty', (count_item->>'actualQty')::integer,
        'stockQty', (count_item->>'actualQty')::integer,
        'stockStatus', case
          when (count_item->>'actualQty')::integer = 0 then 'out_of_stock'
          when (count_item->>'actualQty')::integer <= 5 then 'low_stock'
          else 'in_stock' end
      )
    else item.value end
    order by item.ordinality
  ) into updated_products
  from jsonb_array_elements(products_data) with ordinality item(value, ordinality)
  left join lateral (
    select count_row as count_item
    from jsonb_array_elements(counts_data) count_row
    where count_row->>'productId' = item.value->>'id'
    limit 1
  ) match on true;

  snapshot_id := 'snap_' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text
    || '_' || substr(md5(random()::text), 1, 5);
  snapshot_data := jsonb_build_object(
    'id', snapshot_id, 'createdAt', now(), 'createdBy', actor.id, 'createdByName', actor.name,
    'reason', 'قبل اعتماد الجرد الفعلي', 'modelCount', jsonb_array_length(products_data),
    'totalCartons', previous_cartons, 'products', products_data
  );
  audit_id := coalesce(nullif(p_audit->>'id', ''), 'audit_' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text);
  audit_data := (p_audit - 'counts') || jsonb_build_object(
    'id', audit_id, 'status', 'approved', 'approvedAt', now(), 'approvedBy', actor.id,
    'approvedByName', actor.name, 'affectedModels', affected_models, 'totalVariance', total_variance,
    'previousCartons', previous_cartons, 'newCartons', new_cartons, 'snapshotId', snapshot_id
  );
  trusted_log := jsonb_build_object(
    'id', 'log_' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text || '_' || substr(md5(random()::text), 1, 4),
    'timestamp', now(), 'type', 'audit_summary', 'reason', 'physical_audit',
    'reasonLabel', 'اعتماد جرد فعلي', 'operator', actor.name, 'operatorId', actor.id,
    'auditId', audit_id, 'affectedModels', affected_models, 'oldQty', previous_cartons,
    'newQty', new_cartons, 'amount', total_variance
  );

  update public.joulane_store set data = updated_products, updated_at = now() where id = 'products';
  update public.joulane_store set data = jsonb_build_array(trusted_log) || logs_data, updated_at = now() where id = 'stock_logs';
  update public.joulane_store set data = jsonb_build_array(audit_data) || audits_data, updated_at = now() where id = 'stock_audits';
  update public.joulane_store set data = (
    select coalesce(jsonb_agg(value order by ordinality), '[]'::jsonb)
    from jsonb_array_elements(jsonb_build_array(snapshot_data) || snapshots_data)
      with ordinality limited(value, ordinality)
    where ordinality <= 15
  ), updated_at = now() where id = 'stock_snapshots';

  return jsonb_build_object(
    'status', 'approved', 'auditId', audit_id, 'affectedModels', affected_models,
    'totalVariance', total_variance, 'previousCartons', previous_cartons,
    'newCartons', new_cartons, 'snapshotId', snapshot_id
  );
end;
$$;

create or replace function public.joulane_stock_undo(
  p_token uuid,
  p_log_id text
)
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
  settings_data jsonb;
  target_log jsonb;
  current_product jsonb;
  latest_product_log jsonb;
  updated_products jsonb;
  undo_log jsonb;
  current_qty integer;
  restore_qty integer;
  undo_minutes integer;
begin
  select session.* into active_session from public.joulane_sessions session
  where session.token = p_token and session.expires_at > now();
  if active_session.token is null or active_session.surface <> 'stock' then return null; end if;
  select staff.* into actor from public.joulane_staff staff where staff.id = active_session.staff_id;
  if actor.id is null or not actor.allow_stock or (
    actor.id <> 'usr_super_admin'
    and not coalesce((actor.permissions->>'stockSet')::boolean, false)
  ) then return null; end if;

  select data into products_data from public.joulane_store where id = 'products' for update;
  select data into logs_data from public.joulane_store where id = 'stock_logs' for update;
  select data into settings_data from public.joulane_store where id = 'stock_pro_settings';
  undo_minutes := greatest(1, least(coalesce((settings_data->>'undoWindowMinutes')::integer, 10), 60));
  select item into target_log from jsonb_array_elements(logs_data) item
  where item->>'id' = p_log_id and item->>'type' in ('add', 'remove', 'set') limit 1;
  if target_log is null or coalesce((target_log->>'timestamp')::timestamptz, '-infinity') < now() - make_interval(mins => undo_minutes)
  then return null; end if;

  select item into latest_product_log from jsonb_array_elements(logs_data) item
  where item->>'productId' = target_log->>'productId'
    and item->>'type' in ('add', 'remove', 'set')
  limit 1;
  if latest_product_log->>'id' <> p_log_id then return null; end if;

  select item into current_product from jsonb_array_elements(products_data) item
  where item->>'id' = target_log->>'productId' limit 1;
  current_qty := coalesce(nullif(current_product->>'seriesQty', '')::integer, nullif(current_product->>'stockQty', '')::integer, 0);
  restore_qty := coalesce((target_log->>'oldQty')::integer, -1);
  if restore_qty < 0 or current_qty <> coalesce((target_log->>'newQty')::integer, -2) then return null; end if;

  select jsonb_agg(
    case when item.value->>'id' = target_log->>'productId'
      then item.value || jsonb_build_object(
        'seriesQty', restore_qty, 'stockQty', restore_qty,
        'stockStatus', case when restore_qty = 0 then 'out_of_stock' when restore_qty <= 5 then 'low_stock' else 'in_stock' end
      )
      else item.value end
    order by item.ordinality
  ) into updated_products
  from jsonb_array_elements(products_data) with ordinality item(value, ordinality);

  undo_log := jsonb_build_object(
    'id', 'log_' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text || '_' || substr(md5(random()::text), 1, 4),
    'timestamp', now(), 'type', 'undo', 'reason', 'undo', 'reasonLabel', 'تراجع عن آخر حركة',
    'productId', target_log->>'productId', 'productName', target_log->>'productName',
    'productImg', target_log->>'productImg', 'oldQty', current_qty, 'newQty', restore_qty,
    'amount', abs(current_qty - restore_qty), 'undoneLogId', p_log_id,
    'operator', actor.name, 'operatorId', actor.id
  );
  update public.joulane_store set data = updated_products, updated_at = now() where id = 'products';
  update public.joulane_store set data = jsonb_build_array(undo_log) || logs_data, updated_at = now() where id = 'stock_logs';
  return jsonb_build_object('status', 'undone', 'log', undo_log);
end;
$$;

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
  snapshots_data jsonb;
  updated_products jsonb;
  reset_log jsonb;
  snapshot_data jsonb;
  snapshot_id text;
  affected_models integer := 0;
  previous_cartons integer := 0;
begin
  select session.* into active_session from public.joulane_sessions session
  where session.token = p_token and session.expires_at > now();
  if active_session.token is null or active_session.surface <> 'stock' then return null; end if;
  select staff.* into actor from public.joulane_staff staff where staff.id = active_session.staff_id;
  if actor.id is null or not actor.allow_stock or (
    actor.id <> 'usr_super_admin'
    and not coalesce((actor.permissions->>'stockSet')::boolean, false)
  ) then return null; end if;

  select data into products_data from public.joulane_store where id = 'products' for update;
  select data into logs_data from public.joulane_store where id = 'stock_logs' for update;
  select data into snapshots_data from public.joulane_store where id = 'stock_snapshots' for update;
  logs_data := coalesce(logs_data, '[]'::jsonb);
  snapshots_data := coalesce(snapshots_data, '[]'::jsonb);
  if jsonb_typeof(products_data) <> 'array' or jsonb_typeof(logs_data) <> 'array'
    or jsonb_typeof(snapshots_data) <> 'array' then return null; end if;

  select count(*) filter (where quantity > 0), coalesce(sum(quantity), 0)
  into affected_models, previous_cartons
  from (
    select greatest(coalesce(nullif(item.value->>'seriesQty', '')::integer, nullif(item.value->>'stockQty', '')::integer, 0), 0) quantity
    from jsonb_array_elements(products_data) item
  ) inventory;

  snapshot_id := 'snap_' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text
    || '_' || substr(md5(random()::text), 1, 5);
  snapshot_data := jsonb_build_object(
    'id', snapshot_id, 'createdAt', now(), 'createdBy', actor.id, 'createdByName', actor.name,
    'reason', 'نسخة تلقائية قبل تصفير المخزون', 'modelCount', jsonb_array_length(products_data),
    'totalCartons', previous_cartons, 'products', products_data
  );

  select jsonb_agg(
    item.value || jsonb_build_object('seriesQty', 0, 'stockQty', 0, 'stockStatus', 'out_of_stock')
    order by item.ordinality
  ) into updated_products
  from jsonb_array_elements(products_data) with ordinality item(value, ordinality);

  reset_log := jsonb_build_object(
    'id', 'log_' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text || '_' || substr(md5(random()::text), 1, 4),
    'timestamp', now(), 'type', 'reset_all', 'reason', 'full_inventory_reset',
    'reasonLabel', 'تصفير كامل للمخزون', 'operator', actor.name, 'operatorId', actor.id,
    'affectedModels', affected_models, 'oldQty', previous_cartons, 'newQty', 0,
    'amount', previous_cartons, 'snapshotId', snapshot_id, 'note', 'تم تصفير جميع كميات المخزون'
  );

  update public.joulane_store set data = coalesce(updated_products, '[]'::jsonb), updated_at = now() where id = 'products';
  update public.joulane_store set data = jsonb_build_array(reset_log) || logs_data, updated_at = now() where id = 'stock_logs';
  update public.joulane_store set data = (
    select coalesce(jsonb_agg(value order by ordinality), '[]'::jsonb)
    from jsonb_array_elements(jsonb_build_array(snapshot_data) || snapshots_data)
      with ordinality limited(value, ordinality)
    where ordinality <= 15
  ), updated_at = now() where id = 'stock_snapshots';

  return jsonb_build_object(
    'affectedModels', affected_models, 'previousCartons', previous_cartons, 'snapshotId', snapshot_id
  );
end;
$$;

revoke all on function public.joulane_stock_pro_data(uuid) from public;
revoke all on function public.joulane_stock_pro_save(uuid, text, jsonb) from public;
revoke all on function public.joulane_stock_snapshot_create(uuid, text) from public;
revoke all on function public.joulane_stock_snapshot_restore(uuid, text) from public;
revoke all on function public.joulane_stock_movement_v2(uuid, text, integer, jsonb) from public;
revoke all on function public.joulane_stock_approval_review(uuid, text, text) from public;
revoke all on function public.joulane_stock_location_transfer(uuid, text, text, text, integer) from public;
revoke all on function public.joulane_stock_audit_commit(uuid, jsonb) from public;
revoke all on function public.joulane_stock_undo(uuid, text) from public;
revoke all on function public.joulane_reset_all_stock(uuid) from public;
revoke execute on function public.joulane_stock_movement(uuid, text, integer, jsonb) from anon, authenticated;

grant execute on function public.joulane_stock_pro_data(uuid) to anon, authenticated;
grant execute on function public.joulane_stock_pro_save(uuid, text, jsonb) to anon, authenticated;
grant execute on function public.joulane_stock_snapshot_create(uuid, text) to anon, authenticated;
grant execute on function public.joulane_stock_snapshot_restore(uuid, text) to anon, authenticated;
grant execute on function public.joulane_stock_movement_v2(uuid, text, integer, jsonb) to anon, authenticated;
grant execute on function public.joulane_stock_approval_review(uuid, text, text) to anon, authenticated;
grant execute on function public.joulane_stock_location_transfer(uuid, text, text, text, integer) to anon, authenticated;
grant execute on function public.joulane_stock_audit_commit(uuid, jsonb) to anon, authenticated;
grant execute on function public.joulane_stock_undo(uuid, text) to anon, authenticated;
grant execute on function public.joulane_reset_all_stock(uuid) to anon, authenticated;

commit;
