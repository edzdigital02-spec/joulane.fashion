-- Migrate every existing catalog product to 18 pairs. Future edits are stored
-- per product by the admin editor and are no longer overwritten globally.
update public.joulane_store
set data = (
  select jsonb_agg(
    jsonb_set(
      jsonb_set(product.value, '{pairsPerSeries}', '18'::jsonb, true),
      '{pairsPerSeriesConfigured}',
      'false'::jsonb,
      true
    )
    order by product.ordinality
  )
  from jsonb_array_elements(data) with ordinality as product(value, ordinality)
)
where id = 'products'
  and jsonb_typeof(data) = 'array';
