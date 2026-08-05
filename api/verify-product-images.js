import { createClient } from '@supabase/supabase-js';
import { PRODUCT_DATA } from '../src/data/products.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://jsnsmqwznljllqmnzfrx.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
  }

  try {
    if (!supabaseUrl) {
      return res.status(500).json({ error: 'Missing Supabase URL' });
    }

    // Use service role key if available (Vercel env only), otherwise use anon key
    const key = supabaseServiceKey || supabaseKey;
    if (!key) {
      return res.status(500).json({
        error: 'Missing Supabase credentials',
        detail: 'No SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY available'
      });
    }

    const supabase = createClient(supabaseUrl, key);

    console.log(`🔍 Verifying ${PRODUCT_DATA.length} products...`);

    // Check all products have Cloudinary URLs
    const productsWithIssues = PRODUCT_DATA.filter(p => {
      const img = p.image || '';
      return img.startsWith('/') || img.includes('/images/');
    });

    if (productsWithIssues.length > 0) {
      return res.status(400).json({
        success: false,
        error: `${productsWithIssues.length} products have local image paths`,
        productsWithLocalImages: productsWithIssues.map(p => ({
          id: p.id,
          reference: p.reference,
          image: p.image
        }))
      });
    }

    // For GET requests, just verify without updating
    if (req.method === 'GET') {
      return res.status(200).json({
        success: true,
        message: `✅ All ${PRODUCT_DATA.length} products have valid Cloudinary URLs`,
        productsCount: PRODUCT_DATA.length
      });
    }

    // For POST requests, update Supabase
    const { error: fetchError, data: existing } = await supabase
      .from('joulane_store')
      .select('data')
      .eq('id', 'products')
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Fetch error:', fetchError);
    }

    const { error: upsertError } = await supabase
      .from('joulane_store')
      .upsert(
        {
          id: 'products',
          data: PRODUCT_DATA,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'id' }
      );

    if (upsertError) {
      console.error('Upsert error:', upsertError);
      return res.status(500).json({
        success: false,
        error: `Supabase upsert failed: ${upsertError.message}`
      });
    }

    return res.status(200).json({
      success: true,
      message: `✅ Successfully synced ${PRODUCT_DATA.length} products with valid Cloudinary URLs`,
      productsCount: PRODUCT_DATA.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
