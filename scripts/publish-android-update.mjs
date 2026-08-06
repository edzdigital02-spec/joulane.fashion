import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

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

const versionCode = Number.parseInt(version.VERSION_CODE, 10);
const versionName = String(version.VERSION_NAME || '');
if (!Number.isFinite(versionCode) || versionCode <= 0 || !versionName) {
  throw new Error('Invalid android/version.properties values.');
}

const publicDir = resolve(root, 'public', 'android');
await mkdir(publicDir, { recursive: true });

const apps = [
  { id: 'com.joulane.customer', appName: 'Joulane Customer', file: 'Joulane-Customer.apk' },
  { id: 'com.joulane.admin', appName: 'Joulane Admin', file: 'Joulane-Admin.apk' },
  { id: 'com.joulane.stock', appName: 'Joulane Stock', file: 'Joulane-Stock.apk' }
];

const defaultNotes = [
  'مزامنة التطبيق مع آخر تحديثات موقع جولان.',
  'تحسينات في الأداء والثبات وتجربة الاستخدام.',
  'إضافة نظام إشعار بالتحديثات الجديدة.'
];
const customNotes = String(process.env.JOULANE_UPDATE_NOTES || '')
  .split('|')
  .map(note => note.trim())
  .filter(Boolean);
const notesAr = customNotes.length ? customNotes : defaultNotes;
const manifestApps = {};

for (const app of apps) {
  const source = resolve(root, 'apks', app.file);
  const target = resolve(publicDir, app.file);
  await copyFile(source, target);
  const bytes = await readFile(target);
  const metadata = await stat(target);
  manifestApps[app.id] = {
    appName: app.appName,
    versionCode,
    versionName,
    required: false,
    apkUrl: `https://www.joulanefashion.com/android/${app.file}`,
    size: metadata.size,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    notesAr
  };
}

const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  apps: manifestApps
};

const manifestPath = resolve(root, 'public', 'android-updates.json');
const manifestContents = `${JSON.stringify(manifest, null, 2)}\n`;
let lastWriteError;
for (let attempt = 0; attempt < 5; attempt += 1) {
  try {
    await writeFile(manifestPath, manifestContents, 'utf8');
    lastWriteError = null;
    break;
  } catch (error) {
    lastWriteError = error;
    if (!['UNKNOWN', 'EBUSY', 'EPERM'].includes(error?.code) || attempt === 4) throw error;
    await delay(200 * (attempt + 1));
  }
}
if (lastWriteError) throw lastWriteError;

console.log(`Published Android update assets for ${versionName} (${versionCode}).`);
