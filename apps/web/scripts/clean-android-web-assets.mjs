import { rmSync } from 'node:fs';
import { join } from 'node:path';

const assetsDir = join('android', 'app', 'src', 'main', 'assets', 'public');
rmSync(assetsDir, { recursive: true, force: true });
console.log('Removed stale Android web assets:', assetsDir);
