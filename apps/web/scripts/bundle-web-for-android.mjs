import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const assetsDir = join('android', 'app', 'src', 'main', 'assets', 'public');
const assetsRoot = join('android', 'app', 'src', 'main', 'assets');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

function run(cmd, args, env = process.env) {
  console.log(`> ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: true, env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runNode(script) {
  run('node', [script]);
}

function removePwaArtifacts(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (name === 'sw.js' || name.startsWith('workbox-')) {
      rmSync(join(dir, name), { recursive: true, force: true });
      console.log('Removed PWA artifact:', name);
    }
  }
}

function writeCapacitorConfigs(config) {
  const json = JSON.stringify(config, null, 2);
  mkdirSync(assetsDir, { recursive: true });
  mkdirSync(assetsRoot, { recursive: true });
  writeFileSync(join(assetsDir, 'capacitor.config.json'), json);
  writeFileSync(join(assetsRoot, 'capacitor.config.json'), json);
}

console.log('Bundling current web UI into APK (CAPACITOR_BUNDLED_UI=true)...');
const env = { ...process.env, CAPACITOR_BUNDLED_UI: 'true' };

if (existsSync(assetsDir)) {
  rmSync(assetsDir, { recursive: true, force: true });
  console.log('Cleared stale Android web assets');
}

run('pnpm', ['exec', 'vite', 'build', '--mode', 'capacitor'], env);

if (!existsSync('dist/index.html')) {
  console.error('dist/index.html missing after vite build');
  process.exit(1);
}

run('pnpm', ['exec', 'cap', 'sync', 'android'], env);

writeFileSync(join(assetsDir, 'ui-mode.txt'), 'bundled\n');
rmSync(join(assetsDir, '.ui-mode'), { force: true });

const capacitorConfig = {
  appId: 'com.territoryrun.app',
  appName: 'Territory Run',
  webDir: 'dist',
  server: { androidScheme: 'https' },
};
writeCapacitorConfigs(capacitorConfig);

removePwaArtifacts(assetsDir);
removePwaArtifacts(join(assetsDir, 'assets'));

const bundleDir = join(assetsDir, 'assets');
const bundles = existsSync(bundleDir)
  ? readdirSync(bundleDir).filter((f) => f.endsWith('.js') && f.startsWith('index-'))
  : [];
if (bundles.length === 0) {
  console.error('ERROR: bundled JS missing under android/app/src/main/assets/public/assets');
  console.error('cap sync did not copy dist into the APK. Run pnpm install, then retry.');
  process.exit(1);
}

const cssFiles = existsSync(bundleDir)
  ? readdirSync(bundleDir).filter((f) => f.endsWith('.css') && f.startsWith('index-'))
  : [];
const cssText = cssFiles[0] ? readFileSync(join(bundleDir, cssFiles[0]), 'utf8') : '';
const jsText = readFileSync(join(bundleDir, bundles[0]), 'utf8');
const checks = [
  ['CSS cream bg #f7f4ee', cssText.includes('f7f4ee')],
  ['CSS sage btn #5b8a72', cssText.includes('5b8a72')],
  ['JS paper-atlas class', jsText.includes('paper-atlas')],
  ['JS missions UI', jsText.includes('map-missions') || jsText.includes('\\u041c\\u0438\\u0441\\u0441\\u0438')],
];
for (const [label, ok] of checks) {
  console.log(`${ok ? 'OK' : 'FAIL'} ${label}`);
  if (!ok) process.exit(1);
}

const indexHtml = readFileSync(join(assetsDir, 'index.html'), 'utf8');
if (indexHtml.includes('src="/assets/') && !indexHtml.includes('src="./assets/')) {
  console.warn('WARN: index.html uses absolute /assets paths — rebuild with vite base ./');
}
if (!readFileSync(join(assetsDir, 'ui-mode.txt'), 'utf8').includes('bundled')) {
  console.error('ERROR: ui-mode.txt is not bundled');
  process.exit(1);
}

runNode('./scripts/patch-capacitor-settings.mjs');
runNode('./scripts/ensure-android-resources.mjs');
runNode('./scripts/ensure-android-sources.mjs');

console.log(`Bundled UI ready for APK v${pkg.version} (${bundles[0]})`);
console.log('IMPORTANT: Android Studio → Sync Gradle → Clean → Rebuild');
console.log('Profile must show: Источник UI: https://localhost');
