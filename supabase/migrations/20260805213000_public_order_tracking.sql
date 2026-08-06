begin;

create or replace function public.joulane_track_order(p_tracking_code text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  normalized_code text := upper(trim(coalesce(p_tracking_code, '')));
  target_order jsonb;
  safe_timeline jsonb;
begin
  if normalized_code !~ '^JLN-[A-Z2-9]{10}$' then
    return jsonb_build_object('status', 'invalid');
  end if;

  select item.value
  into target_order
  from public.joulane_store store
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(store.data) = 'array' then store.data else '[]'::jsonb end
  ) with ordinality item(value, position)
  where store.id = 'orders'
    and upper(coalesce(item.value->>'trackingCode', '')) = normalized_code
  order by item.position
  limit 1;

  if target_order is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'status', coalesce(nullif(history.value->>'status', ''), 'New'),
        'at', coalesce(nullif(history.value->>'at', ''), target_order->>'createdAt')
      ) order by history.position
    ),
    '[]'::jsonb
  )
  into safe_timeline
  from jsonb_array_elements(
    case when jsonb_typeof(target_order->'history') = 'array'
      then target_order->'history'
      else '[]'::jsonb
    end
  ) with ordinality history(value, position)
  where nullif(history.value->>'status', '') is not null;

  if jsonb_array_length(safe_timeline) = 0 then
    safe_timeline := jsonb_build_array(jsonb_build_object(
      'status', coalesce(nullif(target_order->>'status', ''), 'New'),
      'at', target_order->>'createdAt'
    ));
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'order', jsonb_build_object(
      'trackingCode', normalized_code,
      'reference', target_order->>'id',
      'orderStatus', coalesce(nullif(target_order->>'status', ''), 'New'),
      'createdAt', target_order->>'createdAt',
      'updatedAt', target_order->>'updatedAt',
      'deliveryLabel', coalesce(target_order->>'deliveryLabel', ''),
      'itemCount', case
        when jsonb_typeof(target_order->'items') = 'array' then jsonb_array_length(target_order->'items')
        else 1
      end,
      'timeline', safe_timeline
    )
  );
end;
$$;

revoke all on function public.joulane_track_order(text) from public;
grant execute on function public.joulane_track_order(text) to anon, authenticated;

commit;
