const CACHE = "clean-map-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./css/app.css",
  "./js/app.js",
  "./js/data.js",
  "./js/mvp-settings.js",
  "./js/figma-tokens.json",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "../assets/clean-map/figma-export/01-onboarding.png",
  "../assets/clean-map/figma-export/02-map.png",
  "../assets/clean-map/figma-export/03-report.png",
  "../assets/clean-map/figma-export/04-task-details.png",
  "../assets/clean-map/figma-export/05-upload-proof.png",
  "../assets/clean-map/figma-export/06-verification.png",
  "../assets/clean-map/figma-export/07-profile.png",
  "../assets/clean-map/figma-export/08-sponsor.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.allSettled(ASSETS.map((asset) => cache.add(asset)))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && event.request.url.startsWith(self.location.origin)) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
