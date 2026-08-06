begin;

create or replace function public.joulane_public_product_order_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with completed_orders as (
    select order_item.value as order_data
    from public.joulane_store store
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(store.data) = 'array' then store.data else '[]'::jsonb end
    ) order_item(value)
    where store.id = 'orders'
      and lower(trim(coalesce(order_item.value->>'status', ''))) in (
        'delivered', 'مكتمل', 'مكتملة'
      )
  ),
  order_lines as (
    select
      order_data->>'id' as order_id,
      line_item.value as line_data
    from completed_orders
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(order_data->'items') = 'array'
        then order_data->'items'
        else '[]'::jsonb
      end
    ) line_item(value)
  ),
  product_totals as (
    select
      trim(line_data->>'productId') as product_id,
      count(distinct order_id)::integer as order_count,
      sum(
        case
          when coalesce(line_data->>'seriesQty', '') ~ '^[0-9]+$'
            then greatest((line_data->>'seriesQty')::integer, 0)
          else 1
        end
      )::integer as carton_count
    from order_lines
    where trim(coalesce(line_data->>'productId', '')) <> ''
    group by trim(line_data->>'productId')
  )
  select coalesce(
    jsonb_object_agg(
      product_id,
      jsonb_build_object('orders', order_count, 'cartons', carton_count)
    ),
    '{}'::jsonb
  )
  from product_totals;
$$;

revoke all on function public.joulane_public_product_order_stats() from public;
grant execute on function public.joulane_public_product_order_stats() to anon, authenticated;

commit;
