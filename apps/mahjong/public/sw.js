const CACHE = 'gangque-__CACHE_VERSION__'
const PRECACHE = __PRECACHE_FILES__
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('gangque-') && key !== CACHE)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith('/mahjong/') || url.pathname.startsWith('/mahjong/api/')) return
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.match('/mahjong/')) || Response.error()))
    return
  }
  event.respondWith(caches.match(request).then(async cached => {
    if (cached) return cached
    const response = await fetch(request)
    if (response.ok) {
      const copy = response.clone()
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)))
    }
    return response
  }))
})
