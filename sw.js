/* 拼读星球 Service Worker
   离线优先的教学型 PWA：页面网络优先（保证总是拿到最新版），
   静态资源「缓存优先 + 后台更新」，断网时也能继续学习。
   更新策略：修改上面 CACHE 版本号即可让旧缓存失效。            */
const CACHE = "pindu-v11";  // v11：修自动题库卡死(词索引Map+干扰项缓存+题池抽样,2800词不再卡死)；规则测试选项字号缩小；登录页去掉undefined账号+加"不注册"入口
const CORE = ["./", "index.html", "account.js", "cloud-layer.js", "manifest.webmanifest", "icons/icon-180.png"];

self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(CORE.map(function (u) { return c.add(u).catch(function () {}); }));
  }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /* 页面导航：网络优先，断网时回落到缓存的 index.html */
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(function (r) {
        const copy = r.clone();
        caches.open(CACHE).then(function (c) { c.put("./index.html", copy).catch(function () {}); }).catch(function () {});
        return r;
      }).catch(function () {
        return caches.match("./index.html").then(function (r) { return r || caches.match("./"); });
      })
    );
    return;
  }

  /* 静态资源：缓存优先，未命中再请求网络并写入缓存 */
  e.respondWith(
    caches.match(req).then(function (hit) {
      const net = fetch(req).then(function (r) {
        if (r && r.status === 200 && r.type === "basic") {
          const copy = r.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy).catch(function () {}); }).catch(function () {});
        }
        return r;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
