import { createHash } from 'node:crypto';
import { access, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const versionSource = await readFile(resolve(root, 'android', 'version.properties'), 'utf8');
const version = Object.fromEntries(versionSource
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(Boolean)
  .map(line => {
    const separator = line.indexOf('=');
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
const expectedCode = Number.parseInt(version.VERSION_CODE, 10);
const expectedName = String(version.VERSION_NAME || '');
const manifest = JSON.parse(await readFile(resolve(root, 'public', 'android-updates.json'), 'utf8'));

const apps = [
  { id: 'com.joulane.customer', flavor: 'customer', file: 'Joulane-Customer.apk' },
  { id: 'com.joulane.admin', flavor: 'admin', file: 'Joulane-Admin.apk' },
  { id: 'com.joulane.stock', flavor: 'stock', file: 'Joulane-Stock.apk' }
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertMissing(path, message) {
  try {
    await access(path);
  } catch (_) {
    return;
  }
  throw new Error(message);
}

for (const app of apps) {
  const release = manifest.apps?.[app.id];
  assert(release, `Missing update manifest entry for ${app.id}.`);
  assert(Number(release.versionCode) === expectedCode, `Version code mismatch for ${app.id}.`);
  assert(String(release.versionName) === expectedName, `Version name mismatch for ${app.id}.`);
  assert(release.apkUrl === `https://www.joulanefashion.com/android/${app.file}`, `Bad APK URL for ${app.id}.`);

  const apkPath = resolve(root, 'public', 'android', app.file);
  const bytes = await readFile(apkPath);
  const metadata = await stat(apkPath);
  assert(metadata.size === Number(release.size), `APK size mismatch for ${app.id}.`);
  assert(createHash('sha256').update(bytes).digest('hex') === release.sha256, `APK hash mismatch for ${app.id}.`);

  const outputMetadata = JSON.parse(await readFile(resolve(
    root,
    'android', 'app', 'build', 'outputs', 'apk', app.flavor, 'release', 'output-metadata.json'
  ), 'utf8'));
  assert(outputMetadata.applicationId === app.id, `Application ID mismatch for ${app.flavor}.`);
  assert(Number(outputMetadata.elements?.[0]?.versionCode) === expectedCode, `Built version code mismatch for ${app.flavor}.`);
  assert(String(outputMetadata.elements?.[0]?.versionName) === expectedName, `Built version name mismatch for ${app.flavor}.`);

  const flavorAssets = resolve(root, 'android', 'app', 'src', app.flavor, 'assets', 'public');
  await assertMissing(resolve(flavorAssets, 'android'), `Published APK files must not be embedded inside ${app.flavor}.`);
  await assertMissing(resolve(flavorAssets, 'android-updates.json'), `The remote update manifest must not be embedded inside ${app.flavor}.`);
}

const viteManifest = JSON.parse(await readFile(resolve(root, 'dist', '.vite', 'manifest.json'), 'utf8'));
assert(viteManifest['src/androidUpdater.js']?.file, 'Android updater bundle is missing from the web build.');
const quickOrderAsset = viteManifest['src/productQuickOrder.js']?.file;
assert(quickOrderAsset, 'Product quick-order bundle is missing from the web build.');
const quickOrderBundle = await readFile(resolve(root, 'dist', quickOrderAsset), 'utf8');
assert(
  quickOrderBundle.includes('https://www.joulanefashion.com'),
  'Android quick orders must target the production API origin.'
);

console.log(JSON.stringify({
  versionCode: expectedCode,
  versionName: expectedName,
  applications: apps.map(app => app.id),
  manifest: 'valid',
  apkHashes: 'valid',
  updaterBundle: viteManifest['src/androidUpdater.js'].file
}, null, 2));
