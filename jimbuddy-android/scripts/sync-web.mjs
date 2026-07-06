import { cpSync, existsSync, mkdirSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const webRoot = join(projectRoot, '..');
const wwwDir = join(projectRoot, 'www');

const WEB_FILES = [
  'index.html',
  'app.js',
  'styles.css',
  'sw.js',
  'sounds.js',
  'gymbro.js',
  'icons.js',
  'workouts-data.js',
  'manifest.json',
  'icon.png'
];

if (existsSync(wwwDir)) {
  rmSync(wwwDir, { recursive: true, force: true });
}
mkdirSync(wwwDir, { recursive: true });

let copied = 0;
for (const file of WEB_FILES) {
  const src = join(webRoot, file);
  if (!existsSync(src)) {
    console.warn(`[sync] skipped missing file: ${file}`);
    continue;
  }
  cpSync(src, join(wwwDir, file));
  copied += 1;
}

const iconsSrc = join(webRoot, 'icons');
if (existsSync(iconsSrc)) {
  cpSync(iconsSrc, join(wwwDir, 'icons'), { recursive: true });
  copied += 1;
  console.log('[sync] copied icons/');
}

console.log(`[sync] ${copied} web assets copied to www/`);
