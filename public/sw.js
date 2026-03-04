// GymTracker Service Worker — v1.0
// Cachea assets estáticos para funcionar offline

const CACHE_NAME = "gymtracker-v1";

// Archivos a cachear al instalar
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
];

// ── Install: cachear assets estáticos ──
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ── Activate: limpiar caches viejos ──
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: Network first, fallback a cache ──
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // No interceptar llamadas a Firebase o Anthropic API
  if (
    url.hostname.includes("firestore.googleapis.com") ||
    url.hostname.includes("firebase") ||
    url.hostname.includes("anthropic.com") ||
    url.hostname.includes("googleapis.com") ||
    request.method !== "GET"
  ) {
    return;
  }

  // Para navegación (HTML): Network first, fallback a /index.html cacheado
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Para assets estáticos (JS, CSS, imágenes): Cache first, luego network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Cachear respuestas válidas de assets propios
        if (
          response.ok &&
          (url.pathname.match(/\.(js|css|png|jpg|gif|svg|woff2?)$/) ||
            url.pathname.startsWith("/assets/"))
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => cached || new Response("", { status: 503 }));
    })
  );
});
