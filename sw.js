// Guarda só os ficheiros da página, para abrir sem rede. Os dados ficam no localStorage;
// os pedidos à API do GitHub (com a chave) nunca passam por esta cache.
const CACHE = 'painel-v1';
const FICHEIROS = ['./', 'index.html', 'estilo.css', 'app.js', 'manifest.json', 'icone.svg'];

self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHEIROS)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request)
    .then((r) => { if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
