// v1: キャッシュ更新時はバージョンを上げる
const CACHE_NAME = "myops-cache-v2";
const ASSETS = [
  "/",            // ルート（Live Serverのルートで配信している前提）
  "/index.html",
  "/style.css",
  "/script.js",
  "/manifest.webmanifest",
  "/assets/icon-192.png",
  "/assets/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k === CACHE_NAME ? null : caches.delete(k))))
    )
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        // 同一オリジンのみキャッシュ
        const url = new URL(req.url);
        if (url.origin === location.origin && req.method === "GET") {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached) // オフライン時は手元キャッシュがあれば返す
    })
  );
});
