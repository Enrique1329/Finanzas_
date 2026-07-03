// service-worker.js
// Cachea los archivos de la app para que funcione sin internet
// y para que el navegador la reconozca como instalable (PWA).

const CACHE_NAME = 'mis-finanzas-v1'; // sube este número (v2, v3...) cada vez que publiques cambios grandes

const ARCHIVOS_CACHE = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png'
];

// Instalación: guarda los archivos base en cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARCHIVOS_CACHE))
  );
  self.skipWaiting();
});

// Activación: borra caches viejos de versiones anteriores
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(
        nombres
          .filter((n) => n !== CACHE_NAME)
          .map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

// Estrategia: "cache primero, red de respaldo"
// Así la app abre instantáneo y funciona offline.
// Si hay internet, actualiza el cache en segundo plano (stale-while-revalidate).
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((respuestaCache) => {
      const fetchPromise = fetch(event.request)
        .then((respuestaRed) => {
          if (respuestaRed && respuestaRed.status === 200) {
            const clon = respuestaRed.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clon));
          }
          return respuestaRed;
        })
        .catch(() => respuestaCache); // sin internet: usa lo cacheado

      return respuestaCache || fetchPromise;
    })
  );
});
