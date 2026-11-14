const CACHE_NAME = "stock-register-v2";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json"
];

const CDN_ASSETS = [
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
];

// Install: Protita file alada bhabe safe cache korbe jate ekta miss holeo error na ashe
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const allUrls = [...CORE_ASSETS, ...CDN_ASSETS];
      await Promise.allSettled(
        allUrls.map(async (url) => {
          try {
            const res = await fetch(url);
            if (res && (res.ok || res.type === "opaque")) {
              await cache.put(url, res);
            }
          } catch (err) {
            // Kono ekta URL fail korleo install bondho hobe na
          }
        })
      );
    })
  );
});

// Activate: Purono cache delete kore notun version active korbe
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

// Fetch: Online e notun file anbe, Offline e cache theke chalabe
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // HTML page (Network-first, offline e cache fallback)
  if (
    req.mode === "navigate" ||
    (url.origin === self.location.origin &&
      (url.pathname.endsWith("/") || url.pathname.endsWith(".html")))
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const networkRes = await fetch(req);
          if (networkRes && networkRes.ok) {
            cache.put(req, networkRes.clone()).catch(() => {});
          }
          return networkRes;
        } catch (err) {
          return (
            (await cache.match(req)) ||
            (await cache.match("./index.html")) ||
            (await cache.match("./")) ||
            new Response("Offline mode", { status: 503, statusText: "Offline" })
          );
        }
      })()
    );
    return;
  }

  // JS, CSS, Fonts (Cache-first, pore background e update)
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) {
        if (url.origin === self.location.origin) {
          fetch(req)
            .then((res) => {
              if (res && res.ok) cache.put(req, res.clone());
            })
            .catch(() => {});
        }
        return cached;
      }

      try {
        const networkRes = await fetch(req);
        if (networkRes && (networkRes.ok || networkRes.type === "opaque")) {
          cache.put(req, networkRes.clone()).catch(() => {});
        }
        return networkRes;
      } catch (err) {
        return new Response("", { status: 504, statusText: "Offline" });
      }
    })()
  );
});
