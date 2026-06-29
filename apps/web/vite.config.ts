import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const isCapacitor = mode === 'capacitor';
  const appVersion = process.env.npm_package_version ?? '0.0.0';
  const buildStamp = `${appVersion}+${new Date().toISOString().slice(0, 19).replace('T', ' ')}`;

  return {
    base: isCapacitor ? './' : '/',
    define: {
      __APP_BUILD__: JSON.stringify(buildStamp),
    },
    plugins: [
      react(),
      !isCapacitor &&
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.svg'],
          manifest: {
            name: 'Territory Run',
            short_name: 'TerritoryRun',
            description: 'Бегай и захватывай территории',
            theme_color: '#5B8A72',
            background_color: '#F7F4EE',
            display: 'standalone',
            start_url: '/',
            icons: [
              {
                src: 'favicon.svg',
                sizes: 'any',
                type: 'image/svg+xml',
                purpose: 'any maskable',
              },
            ],
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
            navigateFallback: '/index.html',
            navigateFallbackDenylist: [/^\/api/],
            skipWaiting: true,
            clientsClaim: true,
          },
        }),
    ].filter(Boolean),
    server: {
      port: 5173,
    },
  };
});
