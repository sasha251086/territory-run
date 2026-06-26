import type { CapacitorConfig } from '@capacitor/cli';

const PROD_WEB_URL = 'https://territory-run-cjoj.onrender.com';

/**
 * By default the Android app opens the deployed website (UI updates after git push).
 * Offline/bundled UI: set CAPACITOR_BUNDLED_UI=true before cap sync / mobile build.
 */
const bundledUi = process.env.CAPACITOR_BUNDLED_UI === 'true';

const config: CapacitorConfig = {
  appId: 'com.territoryrun.app',
  appName: 'Territory Run',
  webDir: 'dist',
  server: bundledUi
    ? { androidScheme: 'https' }
    : {
        androidScheme: 'https',
        url: PROD_WEB_URL,
      },
};

export default config;
