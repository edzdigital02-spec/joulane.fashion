begin;

-- Availability is a commercial choice and is intentionally independent from
-- the physical stock balance. Existing catalog models start enabled.
update public.joulane_store store
set data = (
    select coalesce(
      jsonb_agg(
        item.value || jsonb_build_object('isAvailable', true)
        order by item.position
      ),
      '[]'::jsonb
    )
    from jsonb_array_elements(
      case when jsonb_typeof(store.data) = 'array' then store.data else '[]'::jsonb end
    ) with ordinality item(value, position)
  ),
  updated_at = now()
where store.id = 'products';

-- Confirming an order and deducting its cartons happen in the same database
-- transaction. A stockAppliedAt marker makes the deduction idempotent, while
-- quantities are allowed to become negative to represent backorders.
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
  products_data jsonb;
  stock_logs_data jsonb;
  current_product jsonb;
  requested_product record;
  old_qty integer;
  requested_qty integer;
  new_qty integer;
  stock_status text;
  applied_at text;
  stock_log_entries jsonb := '[]'::jsonb;
  should_apply_stock boolean := false;
  movement_count integer := 0;
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

  if (current_order->>'updatedAt') is distinct from nullif(trim(coalesce(p_expected_updated_at, '')), '') then
    return jsonb_build_object('status', 'conflict', 'order', current_order);
  end if;

  safe_updates := p_updates - array[
    'id',
    'createdAt',
    'updatedAt',
    'expectedUpdatedAt',
    'stockAppliedAt',
    'stockAppliedBy',
    'stockMovementCount'
  ];

  should_apply_stock :=
    safe_updates->>'status' = 'Confirmed'
    and coalesce(current_order->>'status', 'New') <> 'Confirmed'
    and nullif(trim(coalesce(current_order->>'stockAppliedAt', '')), '') is null;

  if should_apply_stock then
    select case when jsonb_typeof(store.data) = 'array' then store.data else '[]'::jsonb end
    into products_data
    from public.joulane_store store
    where store.id = 'products'
    for update;

    select case when jsonb_typeof(store.data) = 'array' then store.data else '[]'::jsonb end
    into stock_logs_data
    from public.joulane_store store
    where store.id = 'stock_logs'
    for update;

    if products_data is null or stock_logs_data is null then
      return jsonb_build_object('status', 'stock_not_configured');
    end if;

    applied_at := to_char(
      clock_timestamp() at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    );

    for requested_product in
      select
        trim(item.value->>'productId') as product_id,
        max(coalesce(item.value->>'nameAr', item.value->>'nameFr', item.value->>'productName', 'منتج')) as product_name,
        max(coalesce(item.value->>'image', '')) as product_image,
        sum(greatest(coalesce(nullif(item.value->>'seriesQty', '')::integer, 0), 0))::integer as quantity
      from jsonb_array_elements(
        case when jsonb_typeof(current_order->'items') = 'array'
          then current_order->'items'
          else '[]'::jsonb
        end
      ) item(value)
      where nullif(trim(item.value->>'productId'), '') is not null
      group by trim(item.value->>'productId')
    loop
      requested_qty := coalesce(requested_product.quantity, 0);
      if requested_qty <= 0 then
        continue;
      end if;

      select item.value
      into current_product
      from jsonb_array_elements(products_data) item(value)
      where item.value->>'id' = requested_product.product_id
      limit 1;

      -- A removed catalog entry must not block order confirmation. Existing
      -- catalog products are deducted and logged atomically.
      if current_product is null then
        continue;
      end if;

      old_qty := coalesce(
        nullif(current_product->>'seriesQty', '')::integer,
        nullif(current_product->>'stockQty', '')::integer,
        0
      );
      new_qty := old_qty - requested_qty;
      stock_status := case
        when new_qty <= 0 then 'out_of_stock'
        when new_qty <= 5 then 'low_stock'
        else 'in_stock'
      end;

      select coalesce(
        jsonb_agg(
          case when item.value->>'id' = requested_product.product_id
            then item.value || jsonb_build_object(
              'seriesQty', new_qty,
              'stockQty', new_qty,
              'stockStatus', stock_status
            )
            else item.value
          end
          order by item.position
        ),
        '[]'::jsonb
      )
      into products_data
      from jsonb_array_elements(products_data) with ordinality item(value, position);

      stock_log_entries := stock_log_entries || jsonb_build_array(
        jsonb_build_object(
          'id', 'log_' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text
            || '_' || substr(md5(random()::text), 1, 6),
          'timestamp', applied_at,
          'dateFormatted', applied_at,
          'productId', requested_product.product_id,
          'productName', coalesce(
            current_product#>>'{name,ar}',
            current_product->>'name',
            requested_product.product_name,
            'منتج'
          ),
          'productImg', coalesce(
            current_product->>'image',
            current_product#>>'{images,0}',
            requested_product.product_image,
            ''
          ),
          'type', 'remove',
          'amount', requested_qty,
          'oldQty', old_qty,
          'newQty', new_qty,
          'operator', actor.name,
          'operatorId', actor.id,
          'reason', 'customer_order',
          'reasonLabel', 'طلب زبون مؤكد',
          'customerName', coalesce(current_order->>'customerName', ''),
          'orderReference', normalized_id,
          'note', 'خصم تلقائي عند تأكيد الطلب',
          'source', 'confirmed_order'
        )
      );
      movement_count := movement_count + 1;
    end loop;

    update public.joulane_store
    set data = products_data,
        updated_at = now()
    where id = 'products';

    if movement_count > 0 then
      update public.joulane_store
      set data = stock_log_entries || stock_logs_data,
          updated_at = now()
      where id = 'stock_logs';
    end if;

    safe_updates := safe_updates || jsonb_build_object(
      'stockAppliedAt', applied_at,
      'stockAppliedBy', actor.name,
      'stockMovementCount', movement_count
    );
  end if;

  updated_order := current_order
    || safe_updates
    || jsonb_build_object(
      'id', current_order->>'id',
      'updatedAt', to_char(
        clock_timestamp() at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      )
    );

  update public.joulane_store store
  set data = (
      select coalesce(
        jsonb_agg(
          case
            when item.value->>'id' = normalized_id then updated_order
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

  return jsonb_build_object(
    'status', 'updated',
    'order', updated_order,
    'stockApplied', should_apply_stock,
    'stockMovementCount', movement_count
  );
end;
$$;

revoke all on function public.joulane_order_update(uuid, text, jsonb, text) from public;
grant execute on function public.joulane_order_update(uuid, text, jsonb, text) to anon, authenticated;

commit;
