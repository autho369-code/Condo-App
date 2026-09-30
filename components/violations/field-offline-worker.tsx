'use client';

import { useEffect } from 'react';

/**
 * Registers the /violations/ service worker and hands it the script/style
 * files this page loaded, so the field capture page opens without a signal
 * next time (see app/(app)/violations/sw.js/route.ts).
 */
export function FieldOfflineWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    let cancelled = false;
    navigator.serviceWorker.register('/violations/sw.js', { scope: '/violations/' })
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        if (cancelled || !registration.active) return;
        const urls = new Set<string>();
        for (const entry of performance.getEntriesByType('resource')) {
          if (new URL(entry.name).pathname.startsWith('/_next/static/')) urls.add(entry.name);
        }
        document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>('script[src], link[rel="stylesheet"][href]').forEach((el) => {
          const src = 'src' in el && el.src ? el.src : (el as HTMLLinkElement).href;
          if (src && new URL(src).pathname.startsWith('/_next/static/')) urls.add(src);
        });
        registration.active.postMessage({ type: 'precache', urls: [...urls] });
      })
      .catch(() => { /* offline support is a bonus; the form works online without it */ });
    return () => { cancelled = true; };
  }, []);
  return null;
}
