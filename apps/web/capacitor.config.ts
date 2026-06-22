import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.territoryrun.app',
  appName: 'Territory Run',
  webDir: 'dist',
  server: {
    // Приложение-обёртка грузит развёрнутый сайт (Render собирает его с правильным
    // VITE_API_URL). Это убирает проблему localhost в нативной сборке, а обновления
    // веб-части появляются в приложении автоматически, без пересборки APK.
    url: 'https://territory-run-cjoj.onrender.com',
    androidScheme: 'https',
    cleartext: false,
  },
};

export default config;
