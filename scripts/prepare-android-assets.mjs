import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const mainPublic = resolve(root, 'android', 'app', 'src', 'main', 'assets', 'public');
const surfaces = {
  customer: ['admin.html', 'stock.html'],
  admin: ['index.html', 'stock.html'],
  stock: ['index.html', 'admin.html']
};
const remoteUpdateAssets = ['android', 'android-updates.json'];

if (!existsSync(dist)) throw new Error('Build output not found. Run npm run build first.');

for (const [flavor, excludedPages] of Object.entries(surfaces)) {
  const target = resolve(root, 'android', 'app', 'src', flavor, 'assets', 'public');
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  cpSync(dist, target, { recursive: true });
  excludedPages.forEach(page => rmSync(resolve(target, page), { force: true }));
  remoteUpdateAssets.forEach(asset => rmSync(resolve(target, asset), { recursive: true, force: true }));
}

// Flavor assets replace the generic copy, keeping each APK on its intended surface.
rmSync(mainPublic, { recursive: true, force: true });
