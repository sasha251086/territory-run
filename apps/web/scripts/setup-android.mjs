import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const webRoot = process.cwd();
const androidDir = join(webRoot, 'android');
const repoRoot = join(webRoot, '../..');

function run(cmd, args, cwd) {
  console.log(`> ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('Installing dependencies (monorepo root)...');
run('pnpm', ['install'], repoRoot);

const requiredPaths = [
  join(webRoot, 'node_modules/@capacitor/android/capacitor/build.gradle'),
  join(webRoot, 'node_modules/capacitor-health/android/build.gradle'),
];

for (const path of requiredPaths) {
  if (!existsSync(path)) {
    console.error('Missing:', path);
    console.error('Run from repo root: pnpm install');
    process.exit(1);
  }
}

console.log('Sync Android shell (live website, no bundled UI)...');
run('node', ['./scripts/sync-android-shell.mjs'], webRoot);
run('node', ['./scripts/patch-capacitor-settings.mjs'], webRoot);
run('node', ['./scripts/ensure-android-resources.mjs'], webRoot);

const pluginsGradle = join(androidDir, 'capacitor-cordova-android-plugins/build.gradle');
if (!existsSync(pluginsGradle)) {
  console.error('cap sync did not create capacitor-cordova-android-plugins');
  process.exit(1);
}

console.log('\nAndroid project ready.');
console.log('Open in Android Studio:', androidDir);
console.log('Then: Sync Project with Gradle Files → Build → Build APK(s)');
