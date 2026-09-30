// Made by tools/publish-site.mjs. Keeps Pocket Quest on the device: instant repeat visits, and play offline.
// The page: from the network first (a new day's walk shows up), the stored copy when offline.
// The code and fonts: stored (their names change when they do). Art: stored, refreshed in the background.
const VERSION = "9187591d42a6";
const SHELL = "pq-shell-" + VERSION;
const ART = "pq-art-v1";
const PRECACHE = ["./","js/app-rzjhtemk.js","manifest.webmanifest","icon.svg","fonts/fraunces-normal-latin.woff2","fonts/fraunces-title.woff2","fonts/inter-italic-latin.woff2","fonts/inter-normal-latin.woff2"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("pq-shell-") && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function fromNetwork(req, cacheName) {
  const res = await fetch(req);
  if (res.ok && res.type === "basic") {
    const copy = res.clone();
    caches.open(cacheName).then((c) => c.put(req, copy));
  }
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (req.mode === "navigate") {
    // Network first, but don't keep a slow connection waiting more than 3 s.
    e.respondWith(
      Promise.race([
        fromNetwork(req, SHELL),
        new Promise((_, no) => setTimeout(no, 3000)),
      ]).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("./")).then((r) => r || fetch(req))),
    );
    return;
  }
  const path = url.pathname;
  if (/\/js\/app-[\w-]+\.js$/.test(path) || /\/fonts\//.test(path)) {
    e.respondWith(caches.match(req).then((r) => r || fromNetwork(req, SHELL)));
    return;
  }
  if (/\/art\/|\.(png|webp|avif|svg|jpg)$/.test(path)) {
    // Stale while revalidate: show the stored copy now, fetch a fresh one for next time.
    e.respondWith(
      caches.open(ART).then((c) =>
        c.match(req).then((hit) => {
          const fresh = fromNetwork(req, ART).catch(() => hit);
          return hit || fresh;
        }),
      ),
    );
  }
});
