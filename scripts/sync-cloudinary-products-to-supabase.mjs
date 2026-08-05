import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// These values are public (embedded in Vercel CSP headers)
const supabaseUrl = 'https://jsnsmqwznljllqmnzfrx.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzbnNtcXd6bmxqbGxxbW56ZnJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjAwNDAsImV4cCI6MTc4Mzc0MjA0MH0.Tw_rklOxvlKCNJsVTMXz_E8wZZUm3hBvhQEZdC-xK_Q';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Read products from local products.js
const productsPath = resolve('src/data/products.js');
const productsContent = readFileSync(productsPath, 'utf-8');
const productsMatch = productsContent.match(/const PRODUCT_DATA = (\[[\s\S]*?\]);/);

if (!productsMatch) {
  console.error('❌ Could not parse PRODUCT_DATA from products.js');
  process.exit(1);
}

const PRODUCTS = eval(`(${productsMatch[1]})`);

console.log(`📦 Found ${PRODUCTS.length} products in products.js`);
console.log(`🔍 Verifying all images use Cloudinary URLs...`);

// Verify all products have Cloudinary URLs
const hasLocalImages = PRODUCTS.some(p => {
  const img = p.image || '';
  return img.startsWith('/') || img.includes('/images/');
});

if (hasLocalImages) {
  console.error('❌ Some products still have local image paths');
  process.exit(1);
}

console.log('✅ All products use Cloudinary URLs');

// Update Supabase with the products data
console.log('📤 Uploading products to Supabase...');

const { error } = await supabase
  .from('joulane_store')
  .upsert(
    {
      id: 'products',
      data: PRODUCTS,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'id' }
  );

if (error) {
  console.error('❌ Failed to update Supabase:', error.message);
  process.exit(1);
}

console.log('✅ Successfully synced all products to Supabase with Cloudinary URLs');
console.log(`📊 ${PRODUCTS.length} products updated`);
