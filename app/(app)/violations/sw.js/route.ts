// Service worker for offline violation capture, scoped to /violations/.
// It does exactly two things:
//   1. /violations/field navigations: network first; if the network fails,
//      the last copy of the field page (saved while online) is served so a
//      manager can open the form with no signal.
//   2. The page's own script/style files (/_next/static, immutable per build)
//      are precached when the page tells it to, and served from cache.
// Nothing else is intercepted, and non-GET requests never are.
const WORKER = `
const CACHE = 'portier-field-v1';
const PAGE = '/violations/field';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

async function savePage(response) {
  if (response.ok && !response.redirected && response.type === 'basic') {
    const cache = await caches.open(CACHE);
    await cache.put(PAGE, response.clone());
  }
  return response;
}

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type !== 'precache' || !Array.isArray(data.urls)) return;
  const urls = data.urls.filter((u) => typeof u === 'string' && new URL(u, self.location.origin).origin === self.location.origin
    && new URL(u, self.location.origin).pathname.startsWith('/_next/static/')).slice(0, 300);
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const keep = new Set(urls.map((u) => new URL(u, self.location.origin).href));
    // Drop files from older builds.
    for (const request of await cache.keys()) {
      if (new URL(request.url).pathname.startsWith('/_next/static/') && !keep.has(request.url)) await cache.delete(request);
    }
    await Promise.all(urls.map(async (u) => {
      if (await cache.match(u)) return;
      try { const res = await fetch(u, { credentials: 'same-origin' }); if (res.ok) await cache.put(u, res); } catch {}
    }));
    try { await savePage(await fetch(PAGE, { credentials: 'same-origin', redirect: 'manual' })); } catch {}
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate' && url.pathname === PAGE) {
    event.respondWith(fetch(request).then(savePage).catch(async () => (await caches.match(PAGE)) || Response.error()));
    return;
  }
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
  }
});
`;

export const dynamic = 'force-static';

export function GET() {
  return new Response(WORKER, {
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      'cache-control': 'no-cache',
      'service-worker-allowed': '/violations/',
    },
  });
}
