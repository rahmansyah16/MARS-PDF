/* Service worker MARS PDF: offline, cache komponen, dan Web Share Target.
   Ini adalah TEMPLAT. File akhir (dist/sw.js) dibuat saat build oleh scripts/vite-plugin-sw.js. */
const VERSION = 'marspdf-19f5d9f814';
const SHELL = 'marspdf-shell-' + VERSION;
const RUNTIME = 'marspdf-runtime';
const SHARE = 'marspdf-share';

// Diisi otomatis saat `npm run build` oleh scripts/vite-plugin-sw.js:
// semua file aplikasi (HTML, JS & CSS ber-hash, ikon) + beberapa library inti.
const PRECACHE = [
  "./",
  "./assets/assistant-CkYABwBx.js",
  "./assets/client-DC6j_5yV.js",
  "./assets/compare-DS9y0eld.js",
  "./assets/compress-CtX7ycDD.js",
  "./assets/crop-Dk1OTaky.js",
  "./assets/document-DClKhcAs.js",
  "./assets/editor-C4a0Co-x.js",
  "./assets/extract-images-DyG59DvY.js",
  "./assets/forms-DijwkvoR.js",
  "./assets/from-pdf-BCSMIUEf.js",
  "./assets/index-BLGfq3ke.css",
  "./assets/index-D53soUB0.js",
  "./assets/merge-3MAKR-Pt.js",
  "./assets/metadata-BFxmcn7y.js",
  "./assets/ocr-CytW0ewB.js",
  "./assets/ocr-DK_UeiOX.js",
  "./assets/organize-DO4McY6E.js",
  "./assets/page-numbers-BKNMt3lh.js",
  "./assets/pdf-BQbravoR.js",
  "./assets/pdfa-BuaLkbZs.js",
  "./assets/protect-KPMcoK6W.js",
  "./assets/repair-BiwF3lU_.js",
  "./assets/scan-AqbmJWaZ.js",
  "./assets/scan.worker-gnRGsWTe.js",
  "./assets/settings-UWn0JsSo.js",
  "./assets/split-E5-94j9D.js",
  "./assets/structure-Cv4IroQ0.js",
  "./assets/to-pdf-DEbAzYBT.js",
  "./assets/toolkit-CcidK-Wz.js",
  "./assets/unlock-CcWgKPFS.js",
  "./assets/vendor-CUJNAEvL.js",
  "./assets/watermark-C1eRNHwU.js",
  "./icons/apple-touch-icon.png",
  "./icons/favicon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "./index.html",
  "./manifest.webmanifest",
  "./vendor/fonts/jakarta-latin.woff2",
  "./vendor/fonts/jakarta-latin-ext.woff2",
  "./vendor/pdf-lib.min.js",
  "./vendor/pdfjs/pdf.min.mjs",
  "./vendor/pdfjs/pdf.worker.min.mjs",
  "./vendor/Sortable.min.js",
  "./vendor/jszip.min.js"
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // tambahkan satu per satu agar satu file gagal tidak menggagalkan semuanya
    await Promise.all(PRECACHE.map((u) => cache.add(new Request(u, { cache: 'reload' })).catch(() => {})));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('marspdf-shell-') && key !== SHELL) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

const IMMUTABLE_HOSTS = ['cdn.jsdelivr.net', 'huggingface.co', 'cdn-lfs.huggingface.co', 'cas-bridge.xethub.hf.co', 'media.githubusercontent.com', 'raw.githubusercontent.com', 'unpkg.com'];

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Web Share Target: terima file dari menu Bagikan Android
  if (req.method === 'POST' && url.pathname.endsWith('/share-target')) {
    event.respondWith((async () => {
      try {
        const form = await req.formData();
        const files = form.getAll('files');
        const cache = await caches.open(SHARE);
        let i = 0;
        for (const f of files) {
          if (!(f instanceof File)) continue;
          await cache.put(new Request(`./__shared/${Date.now()}-${i++}`), new Response(f, { headers: { 'content-type': f.type || 'application/octet-stream', 'x-file-name': encodeURIComponent(f.name) } }));
        }
      } catch (e) {}
      return Response.redirect('./#/shared', 303);
    })());
    return;
  }

  if (req.method !== 'GET') return;

  // Permintaan API AI tidak pernah di-cache
  if (/api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.openai\.com|openrouter\.ai/.test(url.hostname)) return;

  // Komponen eksternal berversi (model OCR, wasm): cache-first
  if (IMMUTABLE_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith('.' + h))) {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok && (res.type === 'cors' || res.type === 'basic')) cache.put(req, res.clone()).catch(() => {});
      return res;
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Navigasi: jaringan dulu (agar selalu versi terbaru), cadangan cache
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(SHELL);
        cache.put('./index.html', res.clone()).catch(() => {});
        return res;
      } catch {
        return (await caches.match('./index.html')) || (await caches.match('./')) || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  // Aset aplikasi: cache dulu, perbarui di latar (stale-while-revalidate)
  event.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    const net = fetch(req).then(async (res) => {
      if (res.ok && res.type === 'basic') {
        const isVendor = url.pathname.includes('/vendor/');
        const cache = await caches.open(isVendor ? RUNTIME : SHELL);
        cache.put(req, res.clone()).catch(() => {});
      }
      return res;
    }).catch(() => null);
    if (hit) { event.waitUntil(net); return hit; }
    const res = await net;
    return res || new Response('Offline', { status: 503, statusText: 'Offline' });
  })());
});
