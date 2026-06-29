import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const webRoot = process.cwd();
const libsDir = join(webRoot, 'android', 'app', 'libs');
const pluginPath = join(
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
const repoRoot = join(webRoot, '..', '..');

function hasSdkArtifact() {
  if (!existsSync(libsDir)) return false;
  return readdirSync(libsDir).some((name) => {
    const lower = name.toLowerCase();
    return lower.endsWith('.aar') || (lower.endsWith('.zip') && (lower.includes('samsung') || lower.includes('health')));
  });
}

function tryGitRestore() {
  console.log('Restoring Samsung Health SDK files from git...');
  const git = spawnSync(
    'git',
    ['checkout', 'HEAD', '--', 'apps/web/android/app/libs', 'apps/web/android/app/src/samsungHealth'],
    { cwd: repoRoot, stdio: 'inherit', shell: true },
  );
  return git.status === 0;
}

if (!existsSync(pluginPath)) {
  tryGitRestore();
}

if (!hasSdkArtifact()) {
  tryGitRestore();
}

if (existsSync(pluginPath) && hasSdkArtifact()) {
  console.log('Samsung Health Data SDK OK');
  process.exit(0);
}

console.error('');
console.error('Samsung Health Data SDK is NOT configured — APK will use a stub plugin.');
console.error('Run import from Samsung Health will not work until you restore the SDK:');
console.error('');
console.error('  cd C:\\Projects\\territory-run');
console.error('  git checkout HEAD -- apps/web/android/app/libs apps/web/android/app/src/samsungHealth');
console.error('');
console.error('Or download SDK v1.1.0 ZIP from https://developer.samsung.com/health/data/overview.html');
console.error('and place it in apps/web/android/app/libs/ (see libs/README.md).');
console.error('');
process.exit(1);
