/* 拼读星球 · 本地账号系统
 * 账号 + 密码登录，无邮箱、无验证码、无联网。
 * 数据隔离靠 index.html 里的 localStorage 命名空间 shim 实现：每个账号的
 * phonics_settings / progress / daily / notes ... 等全部键都自动加上 pd_u_<账号>_ 前缀，
 * 彼此完全独立，互不可见、互不影响。
 */
(function () {
  "use strict";

  var SYS = "pd_sys_";
  var LS = window.localStorage;            // 已被 shim 包装：pd_sys_* 键不命名空间，其余按当前账号隔离

  /* ---------- 账号存储 ---------- */
  function accounts() {
    try { return JSON.parse(LS.getItem(SYS + "accounts")) || {}; } catch (e) { return {}; }
  }
  function saveAccounts(a) { try { LS.setItem(SYS + "accounts", JSON.stringify(a)); } catch (e) {} }
  function curUser() { try { return LS.getItem(SYS + "cur"); } catch (e) { return null; } }
  function setCur(u) { try { if (u) LS.setItem(SYS + "cur", u); else LS.removeItem(SYS + "cur"); } catch (e) {} }

  /* ---------- 密码哈希（优先 Web Crypto PBKDF2，离线环境退回轻量哈希） ---------- */
  function fallbackHash(salt, pw) {
    var h = 5381, s = salt + ":" + pw;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return ("00000000" + h.toString(16)).slice(-8);
  }
  function hashPw(salt, pw) {
    if (window.crypto && crypto.subtle && crypto.subtle.importKey) {
      return crypto.subtle.importKey("raw", new TextEncoder().encode(salt + ":" + pw),
        { name: "PBKDF2" }, false, ["deriveBits"])
        .then(function (key) {
          return crypto.subtle.deriveBits({ name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: 60000, hash: "SHA-256" }, key, 256);
        })
        .then(function (bits) {
          return Array.prototype.map.call(new Uint8Array(bits), function (x) { return x.toString(16).padStart(2, "0"); }).join("");
        })
        .catch(function () { return fallbackHash(salt, pw); });
    }
    return Promise.resolve(fallbackHash(salt, pw));
  }
  function newSalt() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

  /* ---------- 样式 ---------- */
  var CSS =
    ".pd-mask{position:fixed;inset:0;z-index:9999;background:rgba(20,38,30,.86);" +
    "display:flex;align-items:center;justify-content:center;padding:18px;font-family:'Segoe UI',Arial,'PingFang SC','Microsoft YaHei',sans-serif}" +
    ".pd-card{width:100%;max-width:360px;background:#fff;border-radius:18px;padding:22px 20px;box-shadow:0 12px 40px rgba(0,0,0,.3)}" +
    ".pd-logo{font-size:20px;font-weight:800;color:#1f6e4d;text-align:center;margin-bottom:2px}" +
    ".pd-sub{font-size:12px;color:#7a8a82;text-align:center;margin-bottom:14px}" +
    ".pd-tabs{display:flex;background:#eef5f1;border-radius:10px;padding:3px;margin-bottom:14px}" +
    ".pd-tabs button{flex:1;border:0;background:transparent;padding:8px 0;border-radius:8px;font-size:14px;color:#5a6b62;cursor:pointer}" +
    ".pd-tabs button.on{background:#fff;color:#1f6e4d;font-weight:700;box-shadow:0 1px 3px rgba(30,60,45,.15)}" +
    ".pd-row{margin-bottom:11px}" +
    ".pd-row label{display:block;font-size:12px;color:#5a6b62;margin-bottom:4px}" +
    ".pd-input{width:100%;box-sizing:border-box;padding:11px 12px;border:1.5px solid #d8e3dd;border-radius:10px;font-size:15px;outline:none}" +
    ".pd-input:focus{border-color:#2f9e6e}" +
    ".pd-go{width:100%;border:0;background:#2f9e6e;color:#fff;font-size:15px;font-weight:700;padding:12px 0;border-radius:11px;cursor:pointer;margin-top:4px}" +
    ".pd-go:active{background:#26835c}" +
    ".pd-err{color:#c0392b;font-size:12.5px;min-height:18px;margin:8px 2px 0;text-align:center}" +
    ".pd-hint{font-size:11.5px;color:#9aa8a0;text-align:center;margin-top:10px;line-height:1.5}" +
    ".pd-switch{margin-top:14px;border-top:1px dashed #e2eae5;padding-top:12px}" +
    ".pd-switch .pd-st{font-size:12px;color:#7a8a82;margin-bottom:7px}" +
    ".pd-acc{display:flex;flex-wrap:wrap;gap:7px}" +
    ".pd-acc button{border:1.5px solid #d8e3dd;background:#f6faf8;color:#2f6e52;border-radius:20px;padding:6px 13px;font-size:13px;cursor:pointer}" +
    ".pd-acc button:active{background:#e8f3ed}" +
    ".pd-bar{position:fixed;top:10px;right:12px;z-index:9000;font-family:'Segoe UI',Arial,'PingFang SC',sans-serif}" +
    ".pd-bar-btn{border:0;background:rgba(31,110,77,.92);color:#fff;font-size:13px;font-weight:600;padding:7px 13px;border-radius:20px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.2)}" +
    ".pd-menu{position:absolute;right:0;top:42px;background:#fff;border-radius:12px;box-shadow:0 8px 26px rgba(0,0,0,.22);padding:6px;min-width:148px;display:none}" +
    ".pd-menu button{display:block;width:100%;text-align:left;border:0;background:transparent;padding:9px 12px;font-size:13.5px;color:#33413a;border-radius:8px;cursor:pointer}" +
    ".pd-menu button:active{background:#eef5f1}";

  function injectCSS() { var s = document.createElement("style"); s.textContent = CSS; document.head.appendChild(s); }

  /* ---------- 通用 ---------- */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* ---------- 登录 / 注册浮层 ---------- */
  var mode = "login";

  function buildMask() {
    var o = document.getElementById("pdMask");
    if (o) return o;
    o = document.createElement("div");
    o.id = "pdMask";
    o.className = "pd-mask";
    o.innerHTML =
      '<div class="pd-card">' +
        '<div class="pd-logo">拼读星球 · 账号</div>' +
        '<div class="pd-sub">每个人独立的学习进度，互不影响</div>' +
        '<div class="pd-tabs">' +
          '<button id="pdTabLogin" class="on" type="button">登录</button>' +
          '<button id="pdTabReg" type="button">注册</button>' +
        '</div>' +
        '<div class="pd-row"><label>账号</label><input id="pdUser" class="pd-input" placeholder="字母/数字，3-20 位" autocomplete="username"></div>' +
        '<div class="pd-row"><label>密码</label><input id="pdPw" class="pd-input" type="password" placeholder="至少 6 位" autocomplete="current-password"></div>' +
        '<button id="pdGo" class="pd-go" type="button">登录</button>' +
        '<div id="pdErr" class="pd-err"></div>' +
        '<div id="pdSwitch" class="pd-switch"></div>' +
        '<div class="pd-hint">数据仅保存在本机浏览器，不上传任何服务器。</div>' +
      '</div>';
    document.body.appendChild(o);

    document.getElementById("pdTabLogin").onclick = function () { setMode("login"); };
    document.getElementById("pdTabReg").onclick = function () { setMode("reg"); };
    document.getElementById("pdGo").onclick = submit;
    document.getElementById("pdPw").addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
    document.getElementById("pdUser").addEventListener("keydown", function (e) { if (e.key === "Enter") document.getElementById("pdPw").focus(); });
    renderSwitch();
    return o;
  }

  function setMode(m) {
    mode = m;
    document.getElementById("pdTabLogin").className = m === "login" ? "on" : "";
    document.getElementById("pdTabReg").className = m === "reg" ? "on" : "";
    document.getElementById("pdGo").textContent = m === "login" ? "登录" : "注册并登录";
    document.getElementById("pdErr").textContent = "";
  }

  function renderSwitch() {
    var box = document.getElementById("pdSwitch");
    if (!box) return;
    var acc = accounts();
    var names = Object.keys(acc);
    if (!names.length) { box.innerHTML = ""; return; }
    box.innerHTML = '<div class="pd-st">已有账号，点击直接登录：</div><div class="pd-acc">' +
      names.map(function (n) { return '<button type="button" data-u="' + esc(n) + '">' + esc(n) + '</button>'; }).join("") + '</div>';
    Array.prototype.forEach.call(box.querySelectorAll("button"), function (b) {
      b.onclick = function () { doLogin(b.getAttribute("data-u"), ""); };
    });
  }

  function submit() {
    var u = (document.getElementById("pdUser").value || "").trim();
    var p = document.getElementById("pdPw").value || "";
    var err = document.getElementById("pdErr");
    if (!/^[A-Za-z0-9_]{3,20}$/.test(u)) { err.textContent = "账号需为 3-20 位字母/数字/下划线"; return; }
    if (p.length < 6) { err.textContent = "密码至少 6 位"; return; }
    if (mode === "reg") doRegister(u, p); else doLogin(u, p);
  }

  function doRegister(u, p) {
    var err = document.getElementById("pdErr");
    var acc = accounts();
    if (acc[u]) { err.textContent = "该账号已存在，请直接登录"; setMode("login"); return; }
    var salt = newSalt();
    hashPw(salt, p).then(function (h) {
      acc[u] = { salt: salt, hash: h };
      saveAccounts(acc);
      setCur(u);
      location.reload();
    });
  }

  function doLogin(u, p) {
    var err = document.getElementById("pdErr");
    var acc = accounts();
    if (!acc[u]) { err.textContent = "账号不存在，请先注册"; setMode("reg"); return; }
    if (p === "") { // 从“已有账号”快捷登录（无需再输密码）
      setCur(u); location.reload(); return;
    }
    hashPw(acc[u].salt, p).then(function (h) {
      if (h !== acc[u].hash) { err.textContent = "密码错误"; return; }
      setCur(u); location.reload();
    });
  }

  /* ---------- 登录后右上角账号条 ---------- */
  function showBar(user) {
    var bar = document.getElementById("pdBar");
    if (bar) return;
    bar = document.createElement("div");
    bar.id = "pdBar";
    bar.className = "pd-bar";
    bar.innerHTML =
      '<button class="pd-bar-btn" id="pdBarBtn" type="button">👤 ' + esc(user) + ' ▾</button>' +
      '<div class="pd-menu" id="pdMenu">' +
        '<button type="button" id="pdSwitchBtn">🔄 切换账号</button>' +
        '<button type="button" id="pdLogoutBtn">🚪 退出登录</button>' +
      '</div>';
    document.body.appendChild(bar);
    var menu = document.getElementById("pdMenu");
    document.getElementById("pdBarBtn").onclick = function () { menu.style.display = menu.style.display === "block" ? "none" : "block"; };
    document.getElementById("pdLogoutBtn").onclick = function () { setCur(null); location.reload(); };
    document.getElementById("pdSwitchBtn").onclick = function () { setCur(null); location.reload(); };
    document.addEventListener("click", function (e) {
      if (!bar.contains(e.target)) menu.style.display = "none";
    });
  }

  /* ---------- 启动 ---------- */
  function boot() {
    injectCSS();
    var u = curUser();
    if (u) { showBar(u); }
    else { buildMask(); setMode("login"); }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
