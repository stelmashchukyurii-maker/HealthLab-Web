const CACHE = "healthlab-pwa-v0.1.0";
const STATIC = [
  "./timeline.html",
  "./index.html",
  "./lab.html",
  "./healthlab.webmanifest",
  "./healthlab-icon.svg",
  "./timeline.css?v=20260907-2",
  "./timeline-compact.css?v=20260907-1",
  "./timeline-gestures.css?v=20260907-2",
  "./mode.css?v=20260908-5",
  "./style.css?v=20260907-2"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(STATIC)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith("healthlab-pwa-") && key !== CACHE).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      }).catch(async () => (await caches.match(req)) || (await caches.match("./timeline.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
      }
      return res;
    }))
  );
});
