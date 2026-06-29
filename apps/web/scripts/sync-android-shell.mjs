import { spawnSync } from 'node:child_process';

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

import { join } from 'node:path';



const LIVE_WEB_URL = 'https://territory-run-cjoj.onrender.com/';

const assetsPublic = join('android', 'app', 'src', 'main', 'assets', 'public');

const assetsRoot = join('android', 'app', 'src', 'main', 'assets');

const distDir = 'dist';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));



function removeBundledWebFiles(dir) {

  if (!existsSync(dir)) return;

  for (const name of readdirSync(dir)) {

    const path = join(dir, name);

    if (

      name === 'assets' ||

      name.endsWith('.js') ||

      name.endsWith('.css') ||

      name === 'sw.js' ||

      name.startsWith('workbox-')

    ) {

      rmSync(path, { recursive: true, force: true });

      console.log('Removed stale bundle:', path);

    }

  }

}



function writeCapacitorConfigs(config) {

  const json = JSON.stringify(config, null, 2);

  mkdirSync(assetsPublic, { recursive: true });

  mkdirSync(assetsRoot, { recursive: true });

  writeFileSync(join(assetsPublic, 'capacitor.config.json'), json);

  writeFileSync(join(assetsRoot, 'capacitor.config.json'), json);

}



function run(cmd, args, env) {

  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: true, env });

  if (result.status !== 0) {

    process.exit(result.status ?? 1);

  }

}



const env = {

  ...process.env,

  CAPACITOR_BUNDLED_UI: 'false',

};



console.log(`Android shell: UI = ${LIVE_WEB_URL} (same as website in Chrome)`);



if (existsSync(distDir)) {

  removeBundledWebFiles(distDir);

}

mkdirSync(distDir, { recursive: true });

writeFileSync(

  join(distDir, 'index.html'),

  `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${LIVE_WEB_URL}"><title>Territory Run</title></head><body></body></html>`,

);



if (existsSync(assetsPublic)) {

  rmSync(assetsPublic, { recursive: true, force: true });

}



run('pnpm', ['exec', 'cap', 'sync', 'android'], env);



mkdirSync(assetsPublic, { recursive: true });



const capacitorConfig = {

  appId: 'com.territoryrun.app',

  appName: 'Territory Run',

  webDir: 'dist',

  server: {

    androidScheme: 'https',

    url: LIVE_WEB_URL,

    cleartext: false,

    allowNavigation: ['territory-run-cjoj.onrender.com'],

  },

};



writeFileSync(join(assetsPublic, 'ui-mode.txt'), 'live\n');

rmSync(join(assetsPublic, '.ui-mode'), { force: true });

writeCapacitorConfigs(capacitorConfig);



writeFileSync(

  join(assetsPublic, 'index.html'),

  `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${LIVE_WEB_URL}"><title>Territory Run</title></head><body><p><a href="${LIVE_WEB_URL}">Territory Run</a></p></body></html>`,

);



removeBundledWebFiles(assetsPublic);

if (existsSync(join(assetsPublic, 'assets'))) {

  rmSync(join(assetsPublic, 'assets'), { recursive: true, force: true });

  console.log('Removed bundled JS/CSS from APK (prevents stale wireframe UI)');

}



const cfg = JSON.parse(readFileSync(join(assetsPublic, 'capacitor.config.json'), 'utf8'));

console.log('capacitor.config.json server.url:', cfg.server?.url ?? '(missing)');

if (cfg.server?.url !== LIVE_WEB_URL) {

  console.error('ERROR: live URL not written into capacitor.config.json');

  process.exit(1);

}



console.log(`Android shell ready. APK version ${pkg.version} opens ${LIVE_WEB_URL}`);


