-- Joulane wholesale cartons contain 18 pairs. Keep the canonical cloud product
-- record aligned with the storefront, generated product pages and Meta feed.
update public.joulane_store store
set data = (
  select coalesce(
    jsonb_agg(
      jsonb_set(product.value, '{pairsPerSeries}', '18'::jsonb, true)
      order by product.position
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(store.data) with ordinality product(value, position)
),
updated_at = now()
where store.id = 'products'
  and jsonb_typeof(store.data) = 'array';
