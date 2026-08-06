-- Initial wholesale catalog price: 3,200 DZD per pair. Preserve any future
-- positive price entered by an administrator and derive the 18-pair carton.
update public.joulane_store store
set data = (
  select coalesce(
    jsonb_agg(
      product.value
      || jsonb_build_object(
        'price', case
          when coalesce((product.value->>'price')::numeric, 0) > 0
            then (product.value->>'price')::numeric
          else 3200
        end,
        'seriesPrice', case
          when coalesce((product.value->>'seriesPrice')::numeric, 0) > 0
            then (product.value->>'seriesPrice')::numeric
          else 57600
        end,
        'pairsPerSeries', 18
      )
      order by product.position
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(store.data) with ordinality product(value, position)
),
updated_at = now()
where store.id = 'products'
  and jsonb_typeof(store.data) = 'array';
