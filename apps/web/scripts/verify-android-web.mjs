import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const distDir = join(root, 'dist');
const assetsDir = join(root, 'android', 'app', 'src', 'main', 'assets', 'public');

const jsMarkers = ['Рядом', '/leaderboard/regional', 'paper-atlas'];
const cssMarkers = ['leaderboard-tabs--scope', '#5b8a72', '#f7f4ee'];

function listBundles(dir) {
  const assets = join(dir, 'assets');
  if (!existsSync(assets)) return { js: null, css: null };
  const files = readdirSync(assets);
  return {
    js: files.find((f) => f.endsWith('.js') && f.startsWith('index-')),
    css: files.find((f) => f.endsWith('.css') && f.startsWith('index-')),
  };
}

function readFile(dir, name) {
  if (!name) return '';
  const path = join(dir, 'assets', name);
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function checkMarkers(label, jsText, cssText) {
  let failed = false;
  for (const marker of jsMarkers) {
    const ok = jsText.includes(marker);
    console.log(`${ok ? 'OK' : 'MISSING'} ${label} JS: ${marker}`);
    if (!ok) failed = true;
  }
  for (const marker of cssMarkers) {
    const ok = cssText.includes(marker);
    console.log(`${ok ? 'OK' : 'MISSING'} ${label} CSS: ${marker}`);
    if (!ok) failed = true;
  }
  return failed;
}

const dist = listBundles(distDir);
const apk = listBundles(assetsDir);

const distJs = readFile(distDir, dist.js);
const distCss = readFile(distDir, dist.css);
const apkJs = readFile(assetsDir, apk.js);
const apkCss = readFile(assetsDir, apk.css);

console.log('dist:', dist.js, dist.css);
console.log('android assets:', apk.js ?? 'n/a', apk.css ?? 'n/a');

let failed = false;

if (!dist.js) {
  console.error('ERROR: dist missing — run: pnpm mobile:build');
  process.exit(1);
}

failed ||= checkMarkers('dist', distJs, distCss);

if (apk.js) {
  failed ||= checkMarkers('android', apkJs, apkCss);
} else {
  console.log('(android assets not synced yet — Gradle will copy dist on assembleDebug)');
}

if (failed) {
  process.exit(1);
}

console.log('\nBundle OK. Open apps/web/android in Android Studio, then Build → Build APK(s).');
