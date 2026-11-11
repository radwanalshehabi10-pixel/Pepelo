/* Tztezo Duo — service worker: works offline, always takes fresh files when online */
const CACHE = 'duo-v1';
const CORE = ['./', 'index.html', 'manifest.json', 'icon192.png', 'icon512.png', 'levels/packs.json'];
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(CORE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    try {                                   // pre-cache every level pack listed in packs.json
      const list = await (await fetch('levels/packs.json', { cache: 'reload' })).json();
      await Promise.all(list.map(f => c.add(new Request('levels/' + f, { cache: 'reload' })).catch(() => {})));
    } catch (err) {}
    self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;     // Firebase / CDN: not touched
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    try {                                                              // network first = new levels show up immediately
      const res = await fetch(r, { cache: 'no-cache' });
      if (res && res.ok) c.put(r, res.clone());
      return res;
    } catch (err) {
      const hit = await c.match(r, { ignoreSearch: true }) || (r.mode === 'navigate' ? await c.match('index.html') : null);
      if (hit) return hit;
      return new Response('Offline', { status: 503 });
    }
  })());
});
