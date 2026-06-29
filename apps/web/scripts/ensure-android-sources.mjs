import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const webRoot = process.cwd();
const marker = join(webRoot, 'android', 'app', 'src', 'main', 'java', 'com', 'territoryrun', 'app', 'MainActivity.kt');
const samsungPlugin = join(
  webRoot,
  'android',
  'app',
  'src',
  'samsungHealth',
  'java',
  'com',
  'territoryrun',
  'app',
  'plugins',
  'SamsungHealthPlugin.kt',
);

if (existsSync(marker) && existsSync(samsungPlugin)) {
  console.log('Android native sources OK');
  process.exit(0);
}

const repoRoot = join(webRoot, '..', '..');
console.log('Missing Android native sources, restoring from git...');
const git = spawnSync('git', ['checkout', '--', 'apps/web/android/app/src/main/java', 'apps/web/android/app/src/samsungHealth'], {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: true,
});

if (git.status === 0 && existsSync(marker)) {
  console.log('Restored Android native sources from git');
  process.exit(git.status ?? 0);
}

console.error('Android native sources still missing after git restore');
process.exit(git.status ?? 1);
