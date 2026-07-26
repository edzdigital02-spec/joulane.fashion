import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'apks');
const names = {
  customer: 'Joulane-Customer.apk',
  admin: 'Joulane-Admin.apk',
  stock: 'Joulane-Stock.apk'
};

mkdirSync(output, { recursive: true });
for (const [flavor, filename] of Object.entries(names)) {
  const source = resolve(root, 'android', 'app', 'build', 'outputs', 'apk', flavor, 'release', `app-${flavor}-release.apk`);
  if (!existsSync(source)) throw new Error(`Missing release APK: ${source}`);
  copyFileSync(source, resolve(output, filename));
}
