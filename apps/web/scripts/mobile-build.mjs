import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const bundled = process.env.CAPACITOR_BUNDLED_UI === 'true';

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: true, env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (bundled) {
  console.log('Mobile build: bundling UI into APK (CAPACITOR_BUNDLED_UI=true)');
  run('pnpm', ['exec', 'vite', 'build', '--mode', 'capacitor']);
} else {
  console.log('Mobile build: APK will load UI from https://territory-run-cjoj.onrender.com');
  if (!existsSync('dist/index.html')) {
    console.log('Creating minimal dist placeholder for cap sync...');
    run('pnpm', ['exec', 'vite', 'build', '--mode', 'capacitor']);
  }
}

run('pnpm', ['exec', 'cap', 'sync', 'android']);
console.log('Done. Open android/ in Android Studio → Build → Build APK(s)');
