/* Service worker MARS PDF: offline, cache komponen, dan Web Share Target.
   Ini adalah TEMPLAT. File akhir (dist/sw.js) dibuat saat build oleh scripts/vite-plugin-sw.js. */
const VERSION = 'marspdf-d5a1b312c4';
const SHELL = 'marspdf-shell-' + VERSION;
const RUNTIME = 'marspdf-runtime';
const SHARE = 'marspdf-share';

// Diisi otomatis saat `npm run build` oleh scripts/vite-plugin-sw.js:
// semua file aplikasi (HTML, JS & CSS ber-hash, ikon) + beberapa library inti.
const PRECACHE = [
  "./",
  "./assets/assistant-DPMNv0_P.js",
  "./assets/client-CVpN-7vw.js",
  "./assets/compare-DMXyzhut.js",
  "./assets/compress-D2KBrIGB.js",
  "./assets/crop-DAIp0W6i.js",
  "./assets/document-2yeqT_Sg.js",
  "./assets/editor-NNFkVCuD.js",
  "./assets/extract-images-CvxuyhDe.js",
  "./assets/forms-9q8ekbQJ.js",
  "./assets/from-pdf-CMC1lM-N.js",
  "./assets/index-CC9c_RRS.js",
  "./assets/index-U7_fMH2W.css",
  "./assets/merge-tIMc1EEP.js",
  "./assets/metadata-BFJNLmLV.js",
  "./assets/ocr-BcXoLnxM.js",
  "./assets/ocr-CkbiYihP.js",
  "./assets/organize-VP_s5PGp.js",
  "./assets/page-numbers-Bi2C8cOX.js",
  "./assets/pdf-CPmX7lka.js",
  "./assets/pdfa-BgbRDoMC.js",
  "./assets/protect-D-CzhKKU.js",
  "./assets/repair-CDrW7S07.js",
  "./assets/scan-CYKumryq.js",
  "./assets/scan.worker-gnRGsWTe.js",
  "./assets/settings-BeaAEMT4.js",
  "./assets/split-BiqpqFvc.js",
  "./assets/structure-Cx2zX45F.js",
  "./assets/to-pdf-JeE6pxyA.js",
  "./assets/toolkit-B_uMh1_P.js",
  "./assets/unlock-DO7_2-9B.js",
  "./assets/vendor-Cn24aezz.js",
  "./assets/watermark-KGozT5rj.js",
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
