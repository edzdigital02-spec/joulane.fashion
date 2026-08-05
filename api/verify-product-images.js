import { createClient } from '@supabase/supabase-js';
import { PRODUCT_DATA } from '../src/data/products.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Missing Supabase credentials' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`📦 Verifying ${PRODUCT_DATA.length} products...`);

    // Check all products have Cloudinary URLs
    const hasLocalImages = PRODUCT_DATA.some(p => {
      const img = p.image || '';
      return img.startsWith('/') || img.includes('/images/');
    });

    if (hasLocalImages) {
      return res.status(400).json({
        error: 'Some products still have local image paths',
        productsWithLocalImages: PRODUCT_DATA.filter(p => {
          const img = p.image || '';
          return img.startsWith('/') || img.includes('/images/');
        }).map(p => ({ id: p.id, reference: p.reference, image: p.image }))
      });
    }

    // Update Supabase with verified data
    const { error, data } = await supabase
      .from('joulane_store')
      .upsert(
        {
          id: 'products',
          data: PRODUCT_DATA,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'id' }
      );

    if (error) {
      console.error('Supabase update error:', error);
      return res.status(500).json({ error: `Supabase error: ${error.message}` });
    }

    return res.status(200).json({
      success: true,
      message: `✅ Successfully verified and synced ${PRODUCT_DATA.length} products to Supabase`,
      productsCount: PRODUCT_DATA.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
