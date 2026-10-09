// 가족나들이 서비스 워커 — 앱 화면은 오프라인에서도 열리고, 라이브러리·지도 타일은 캐시해 둡니다.
const VERSION = 'v2.5.0';
const APP_CACHE = `app-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((c) => c.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => ![APP_CACHE, RUNTIME_CACHE].includes(k)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // 검색·설정 API, 네이버 지도 인증 스크립트는 항상 네트워크로 (캐시하지 않음)
  if (url.origin === location.origin && url.pathname.startsWith('/api/')) return;
  if (url.hostname === 'oapi.map.naver.com') return;

  // 앱 화면(페이지 이동): 네트워크 우선 → 실패 시 캐시된 index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(APP_CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 그 외(CDN 라이브러리, 지도 타일, 사진): 캐시 먼저 보여주고 뒤에서 갱신
  event.respondWith(
    caches.open(RUNTIME_CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
