import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));

function run(script) {
  const result = spawnSync(process.execPath, [join(dir, script)], {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('sync-android-shell.mjs');
run('patch-capacitor-settings.mjs');
run('ensure-android-resources.mjs');
run('ensure-android-sources.mjs');

console.log('Done. Open android/ in Android Studio → Sync Gradle → Clean → Build APK(s)');
