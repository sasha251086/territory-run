const { cpSync, mkdirSync, rmSync } = require('fs');
const { join } = require('path');

const src = join(__dirname, '..', 'apps', 'web', 'dist');
const dest = join(__dirname, '..', 'frontend', 'build');

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });

console.log(`Published web app: ${src} -> ${dest}`);
