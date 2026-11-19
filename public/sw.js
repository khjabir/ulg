/* Refill offline service worker.
 * `npm run build` rewrites the three constants below with the full precache list
 * (scripts/generate-sw.mjs). Without that step it still caches files as they load.
 *
 * Updates: a new deploy changes this file, so the browser installs the new version
 * in the background. The very first install takes over at once; an update waits
 * until the player taps "Update" (the page sends SKIP_WAITING) or every Refill tab and
 * app window has closed. That way a running game never has its files swapped out. */
const VERSION = "dev";
const PRECACHE = [];
const BASE = "";

const CACHE = `ulg-${VERSION}`;
const INDEX = `${BASE}/`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Add one by one so a single missing file doesn't block the install.
      await Promise.all(
        PRECACHE.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => undefined),
        ),
      );
      // First visit: nothing to disrupt, start at once. An update waits for the player.
      if (!self.registration.active) await self.skipWaiting();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("ulg-") && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const url = new URL(request.url);
    const path = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
    return (
      (await cache.match(request, { ignoreSearch: true })) ||
      (await cache.match(path)) ||
      (await cache.match(`${path}index.html`)) ||
      (await cache.match(INDEX)) ||
      Response.error()
    );
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request, { ignoreSearch: true });
  const update = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  if (hit) {
    event.waitUntil(update);
    return hit;
  }
  return (await update) || Response.error();
}

/** Next.js checks routes with HEAD requests before prefetching; answer them from cache offline. */
async function head(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(new URL(request.url).pathname, { ignoreSearch: true });
    return hit ? new Response(null, { status: hit.status, headers: hit.headers }) : Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.method === "HEAD") {
    event.respondWith(head(request));
    return;
  }
  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  } else if (url.pathname.startsWith(`${BASE}/_next/static/`)) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(request, event));
  }
});
