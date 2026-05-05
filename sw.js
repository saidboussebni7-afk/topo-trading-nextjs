const SW_VERSION = 'topo-vip-secure-sw-v4';

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.includes('topo-vip-bg-state')).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  const msg = event.data || {};
  if (msg.type === 'KEEP_ALIVE' && event.source) {
    event.source.postMessage({ type: 'ALIVE', version: SW_VERSION, ts: Date.now() });
  }
  if (msg.type === 'SHOW_NOTIFICATION') {
    const payload = msg.payload || {};
    event.waitUntil(self.registration.showNotification(payload.title || 'TOPO VIP', {
      body: payload.body || '',
      tag: payload.tag || 'topo-' + Date.now(),
      icon: 'https://api.iconify.design/mdi/chart-line.svg?color=%23c9a84c',
      badge: 'https://api.iconify.design/mdi/chart-line.svg?color=%23c9a84c'
    }));
  }
});
