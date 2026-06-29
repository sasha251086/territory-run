import type { CapacitorConfig } from '@capacitor/cli';

/** Must match BuildConfig.LIVE_WEB_URL in android/app/build.gradle */
const LIVE_WEB_URL = 'https://territory-run-cjoj.onrender.com/';

/**
 * APK is a thin native shell — always loads the deployed website (same as browser PWA).
 * Local dist is only a placeholder for cap sync; MainActivity opens LIVE_WEB_URL.
 */
const config: CapacitorConfig = {
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

export default config;
