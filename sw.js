'use strict';
// Offline shell: precache core files, then stale-while-revalidate for same-origin GETs.
const V = 'mdstudio-v1';
const CORE = ['/', '/site.webmanifest', '/favicon.ico', '/assets/css/style.css', '/assets/css/hljs.css',
  '/assets/js/i18n.js', '/assets/js/app.js', '/assets/js/github.js', '/assets/js/ui.js',
  '/assets/vendor/marked.umd.js', '/assets/vendor/purify.min.js', '/assets/vendor/highlight.min.js',
  '/assets/icons/sprite.svg', '/assets/icons/favicon.svg', '/assets/icons/logo.svg',
  '/assets/icons/icon-192.png', '/assets/icons/icon-512.png', '/assets/icons/apple-touch-icon.png'];
const good = r => r && r.ok && r.type === 'basic' && !r.redirected;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('mdstudio-') && k !== V).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || r.headers.has('range')) return;
  if (/^\/(api|sandbox)\//.test(u.pathname) || u.pathname === '/sw.js') return;
  e.respondWith(r.mode === 'navigate' ? nav(e, r, u) : swr(e, r));
});

// Pages: network first (3.5s), then cache. Offline fails fast and falls back to the cached shell.
async function nav(e, r, u) {
  const c = await caches.open(V), key = new Request(u.origin + u.pathname);
  const net = fetch(r).then(res => { if (good(res)) c.put(key, res.clone()).catch(() => {}); return res; }, () => null);
  const first = await Promise.race([net, new Promise(ok => setTimeout(ok, 3500, null))]);
  if (first) return first;
  e.waitUntil(net);
  return (await c.match(key)) || (await c.match('/')) || (await net) || Response.error();
}
// Assets: serve cached copy instantly, refresh it in the background.
async function swr(e, r) {
  const c = await caches.open(V), hit = await c.match(r);
  const net = fetch(r).then(res => { if (good(res)) c.put(r, res.clone()).catch(() => {}); return res; }, () => null);
  if (hit) { e.waitUntil(net); return hit; }
  return (await net) || Response.error();
}
