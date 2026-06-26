import { Capacitor } from '@capacitor/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyPaperAtlasTheme } from './theme/apply-paper-atlas-theme';
import './wireframe.css';
import './paper-atlas.css';
import './paper-atlas-phase3.css';

applyPaperAtlasTheme();

/** PWA service worker from an older build can keep serving stale UI inside Capacitor WebView. */
async function clearStaleNativeCaches() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const registrations = await navigator.serviceWorker?.getRegistrations();
    await Promise.all((registrations ?? []).map((r) => r.unregister()));
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch {
    /* WebView without Cache API */
  }
}

void clearStaleNativeCaches().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});