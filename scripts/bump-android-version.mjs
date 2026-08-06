import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const versionFile = resolve(import.meta.dirname, '..', 'android', 'version.properties');
const source = await readFile(versionFile, 'utf8');
const properties = Object.fromEntries(source
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(Boolean)
  .map(line => {
    const separator = line.indexOf('=');
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));

const currentCode = Number.parseInt(properties.VERSION_CODE, 10) || 0;
const currentName = String(properties.VERSION_NAME || '1.0.0');
const requestedName = String(process.env.JOULANE_NEXT_VERSION_NAME || '').trim();
const parts = currentName.split('.').map(value => Number.parseInt(value, 10) || 0);
while (parts.length < 3) parts.push(0);
const nextName = requestedName || `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
const nextCode = currentCode + 1;

await writeFile(versionFile, `VERSION_CODE=${nextCode}\nVERSION_NAME=${nextName}\n`, 'utf8');
console.log(`Android release bumped: ${currentName} (${currentCode}) -> ${nextName} (${nextCode})`);
