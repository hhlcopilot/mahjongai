/*!
 * 麻雀聽牌效率計算機 — Service Worker
 * 更新流程：改咗 index.html 嘅 ?v= 之後，記得同步改下面 ASSETS 同 CACHE 版本。
 */
var VERSION = 'v65';
var CACHE = 'mahjongai-' + VERSION;

var ASSETS = [
  './',
  './index.html',
  './css/style.css?v=71',
  './js/mahjong.js?v=71',
  './js/ui-tiles.js?v=71',
  './js/app.js?v=71',
  './js/practice.js?v=71',
  './js/battle.js?v=71',
  './js/battle-ui.js?v=71',
  './practice.html',
  './manifest.webmanifest',
  './favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon-180.png'
];

// 34 張牌面圖
for (var i = 0; i < 34; i++) {
  ASSETS.push('./tiles/tile-' + (i < 10 ? '0' : '') + i + '.png?v=71');
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // 逐個快取：就算其中一個檔案有問題，安裝都唔會成個失敗
      return Promise.all(ASSETS.map(function (url) {
        return cache.add(url).catch(function () { return null; });
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE) return caches.delete(key);
        return null;
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );  
});

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // version.json 一定要直上網，唔可以經 cache（用嚟判斷有冇新版本）
  if (url.pathname.slice(-12) === 'version.json') {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }

  // 開頁面：先上網，冇網先用 cache（咁有新版本時一定攞到新 HTML）
  if (request.mode === 'navigate') {
    // 舊網址 practice.html：直接回 index.html 嘅內容，網址保持唔變（唔跳轉）
    var isPracticeUrl = /\/practice\.html$/.test(url.pathname);
    var target = isPracticeUrl ? './index.html' : request.url;
    event.respondWith(
      fetch(target, { cache: 'no-store' }).then(function (response) {
        var copy = response.clone();
        caches.open(CACHE).then(function (cache) {
          // 用原本 URL 做 key，唔可以寫死 './index.html'（否則會用練習頁覆蓋首頁）
          cache.put(request, copy);
        });
        return response;
      }).catch(function () {
        return caches.match(request).then(function (hit) {
          if (hit) return hit;
          var name = url.pathname.slice(url.pathname.lastIndexOf('/') + 1) || 'index.html';
          return caches.match(name).then(function (fallback) {
            return fallback || caches.match('./index.html') || caches.match('./');
          });
        });
      })
    );
    return;
  }

  // 其他資源：cache 先，同時喺背景更新
  event.respondWith(
    caches.match(request).then(function (cached) {
      var network = fetch(request).then(function (response) {
        if (response && response.ok) {
          var copy = response.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put(request, copy);
          });
        }
        return response;
      }).catch(function () {
        return cached;
      });

      return cached || network;
    })
  );
});
