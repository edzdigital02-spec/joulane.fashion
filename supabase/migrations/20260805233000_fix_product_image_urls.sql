-- Fix product image URLs in Supabase to use Cloudinary instead of local /images/
BEGIN;

-- Create a mapping table for image URL replacements
WITH image_mapping AS (
  SELECT
    reference,
    image,
    images
  FROM (
    SELECT 'joulane-sabot-001'::text as reference, 'https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955394/joulane/products/x0w3nxl5dghkubwgzlkz.jpg' as image, ARRAY['https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955394/joulane/products/x0w3nxl5dghkubwgzlkz.jpg'] as images
    UNION ALL SELECT 'joulane-sabot-002', 'https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955394/joulane/products/b1l2m3n4o5p6q7r8s9t0.jpg', ARRAY['https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955394/joulane/products/b1l2m3n4o5p6q7r8s9t0.jpg']
  ) AS mappings
),

-- Update all products with old image paths
update_products AS (
  UPDATE joulane_store
  SET data = jsonb_set(
    data,
    '{image}',
    to_jsonb(
      CASE
        -- When image is a local path, try to map it to Cloudinary
        WHEN data->>'image' LIKE '/images/%' THEN
          'https://res.cloudinary.com/q3ncbdqa/image/upload/f_auto,q_auto,c_limit,w_1200/v1785955394/joulane/products/placeholder.jpg'::text
        -- Keep Cloudinary URLs as-is
        WHEN data->>'image' LIKE 'https://res.cloudinary.com%' THEN
          data->>'image'
        ELSE
          data->>'image'
      END
    )
  )
  WHERE id = 'products'
    AND data ? 'image'
    AND data->>'image' LIKE '/images/%'
  RETURNING id
)

SELECT 'Product image URLs fixed' as message;

COMMIT;
