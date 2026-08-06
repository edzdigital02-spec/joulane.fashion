import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    manifest: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        stock: resolve(__dirname, 'stock.html'),
        androidUpdater: resolve(__dirname, 'src/androidUpdater.js'),
        productQuickOrder: resolve(__dirname, 'src/productQuickOrder.js'),
      },
    },
  },
});
