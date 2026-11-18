/* iKrlito Manager — Service Worker
 * Cachea solo los archivos propios (mismo origen) para que la app
 * abra sin internet. Las llamadas a Supabase y a los CDN externos
 * NO se cachean: siempre van a la red, para no romper el login
 * ni los datos en la nube.
 */
const CACHE = "ikrlito-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Solo archivos propios: lo demás (Supabase, CDN) pasa directo a la red.
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    // Navegación: intenta la red y, sin internet, sirve el index cacheado.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Archivos propios: primero caché, luego red (y actualiza la caché).
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
