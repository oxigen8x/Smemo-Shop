// Service worker: app shell in cache, strategia "stale-while-revalidate".
// L'app si apre subito dalla cache anche offline; se online, aggiorna la cache
// in background (le modifiche compaiono alla riapertura successiva).
const CACHE = 'spesa-v2';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './db.js',
  './catalog.js',
  './scan.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
];

// Motore OCR della scansione scontrino (~6 MB): scaricato in cache all'installazione, senza far fallire l'installazione se manca la rete.
const SIMD = WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
const OCR_ASSETS = [
  './vendor/tesseract/tesseract.min.js',
  './vendor/tesseract/worker.min.js',
  SIMD ? './vendor/tesseract/tesseract-core-simd-lstm.wasm.js' : './vendor/tesseract/tesseract-core-lstm.wasm.js',
  './vendor/tesseract/lang/ita.traineddata.gz',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(async (c) => {
        await c.addAll(ASSETS);
        await Promise.allSettled(OCR_ASSETS.map((u) => c.add(u)));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      if (cached) {
        e.waitUntil(network);
        return cached;
      }
      const res = await network;
      if (res) return res;
      if (req.mode === 'navigate') return cache.match('./index.html');
      return new Response('Offline', { status: 503 });
    })
  );
});
