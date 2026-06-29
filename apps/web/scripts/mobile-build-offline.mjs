import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const result = spawnSync(process.execPath, [join(dir, 'bundle-web-for-android.mjs')], {
  stdio: 'inherit',
  env: { ...process.env, CAPACITOR_BUNDLED_UI: 'true' },
});
process.exit(result.status ?? 1);
