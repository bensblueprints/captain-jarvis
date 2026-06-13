// BENJI OS service worker — always fresh. Never serve a stale page; purge old caches.
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map(n => caches.delete(n))); // wipe any old cached app
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  // Always go to network for navigations and the app shell; no caching of HTML.
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request));
});
