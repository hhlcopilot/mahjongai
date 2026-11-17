'use strict';

/**
 * Service Worker 煙霧測試：用假的 caches / fetch 跑一次 install + fetch 邏輯，
 * 確保 sw.js 唔會 throw，而且會正確快取同回應。
 *
 * 注意：呢個測試唔會驗證瀏覽器層面嘅 SW 行為（要真瀏覽器 + localhost/HTTPS）。
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const code = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

// 由 sw.js 本身抽版本，避免測試同程式碼嘅版本號唔同步
const cacheVersion = (code.match(/var VERSION = '([^']+)'/) || [])[1];
const assetVersion = (code.match(/js\/app\.js\?v=(\d+)/) || [])[1];
const appUrl = 'http://127.0.0.1:8765/js/app.js?v=' + assetVersion;

const handlers = {};
const cacheStore = new Map();
const cacheNames = new Set();
const fetchCalls = [];

function makeCache() {
  return {
    add: async function (url) {
      cacheStore.set(url, { url: url, ok: true });
    },
    put: async function (req, res) {
      cacheStore.set(typeof req === 'string' ? req : req.url, res);
    },
    keys: async function () {
      return Array.from(cacheStore.keys()).map(function (u) { return { url: u }; });
    }
  };
}

const caches = {
  open: async function (name) {
    cacheNames.add(name);
    return makeCache();
  },
  keys: async function () {
    return Array.from(cacheNames);
  },
  delete: async function (name) {
    cacheNames.delete(name);
    return true;
  },
  match: async function (req) {
    return cacheStore.get(typeof req === 'string' ? req : req.url);
  }
};

const context = {
  self: {
    addEventListener: function (type, fn) { handlers[type] = fn; },
    skipWaiting: function () { return Promise.resolve(); },
    clients: { claim: function () { return Promise.resolve(); } },
    location: new URL('http://127.0.0.1:8765/sw.js')
  },
  caches: caches,
  fetch: async function (req) {
    const url = typeof req === 'string' ? req : req.url;
    fetchCalls.push(url);
    return { ok: true, status: 200, url: url, clone: function () { return { ok: true, status: 200, url: url }; } };
  },
  URL: URL,
  Promise: Promise,
  console: console
};

vm.createContext(context);
vm.runInContext(code, context);

function dispatch(type, event) {
  return new Promise(function (resolve, reject) {
    let result;
    handlers[type](Object.assign({}, event, {
      waitUntil: function (p) { result = p; },
      respondWith: function (p) { result = p; }
    }));
    if (!result) return reject(new Error('冇 waitUntil / respondWith'));
    Promise.resolve(result).then(resolve, reject);
  });
}

(async function run() {
  assert.ok(handlers.install, '要有 install handler');
  assert.ok(handlers.activate, '要有 activate handler');
  assert.ok(handlers.fetch, '要有 fetch handler');

  await dispatch('install', {});
  assert.ok(cacheStore.size >= 10, 'install 之後要快取晒 app shell，實際：' + cacheStore.size);
  assert.ok(cacheStore.has('./index.html'), '要快取 index.html');
  assert.ok(cacheStore.has('./js/app.js?v=' + assetVersion), '要快取 app.js');

  await dispatch('activate', {});
  assert.ok(cacheNames.has('mahjongai-' + cacheVersion), '要用 mahjongai-' + cacheVersion + ' cache');

  // 1) 已快取嘅資源：直接由 cache 回應
  const cachedRes = await dispatch('fetch', {
    request: { method: 'GET', url: appUrl, mode: 'no-cors' }
  });
  assert.ok(cachedRes, 'cached 資源要有回應');

  // 2) 未快取嘅資源：上網攞
  const netRes = await dispatch('fetch', {
    request: { method: 'GET', url: 'http://127.0.0.1:8765/js/new-file.js', mode: 'no-cors' }
  });
  assert.strictEqual(netRes.status, 200);
  assert.ok(fetchCalls.indexOf('http://127.0.0.1:8765/js/new-file.js') >= 0);

  // 3) 換頁（navigate）：上網，失敗先用 cache
  const navRes = await dispatch('fetch', {
    request: { method: 'GET', url: 'http://127.0.0.1:8765/', mode: 'navigate' }
  });
  assert.strictEqual(navRes.status, 200);

  console.log('  ✓ sw.js install / activate / fetch 邏輯正常');
  console.log('  ✓ 快取咗 ' + cacheStore.size + ' 個檔案');
  console.log('\nService Worker 測試通過');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
