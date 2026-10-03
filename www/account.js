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
    ".pd-hint{font-size:11.5px;color:#9aa8a0;text-align:center;margin-top:10px;line-height:1.6}" +
    ".pd-ta{width:100%;box-sizing:border-box;height:110px;padding:9px 10px;border:1.5px solid #d8e3dd;border-radius:10px;font-size:11px;font-family:monospace;word-break:break-all;resize:none;outline:none;margin-bottom:8px}" +
    ".pd-switch{margin-top:14px;border-top:1px dashed #e2eae5;padding-top:12px}" +
    ".pd-switch .pd-st{font-size:12px;color:#7a8a82;margin-bottom:7px}" +
    ".pd-acc{display:flex;flex-wrap:wrap;gap:7px}" +
    ".pd-acc button{border:1.5px solid #d8e3dd;background:#f6faf8;color:#2f6e52;border-radius:20px;padding:6px 13px;font-size:13px;cursor:pointer}" +
    ".pd-acc button:active{background:#e8f3ed}" +
    ".pd-bar{position:relative;z-index:9000;display:inline-flex;align-items:center;font-family:'Segoe UI',Arial,'PingFang SC',sans-serif}" +
    ".pd-bar.pd-bar-float{position:fixed;top:calc(10px + env(safe-area-inset-top,0px));right:12px}" +
    ".pd-bar-btn{border:0;background:rgba(255,255,255,.92);color:#1f6e4d;font-size:13px;font-weight:700;padding:7px 13px;border-radius:20px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.18)}" +
    ".pd-menu{position:absolute;right:0;top:44px;background:#fff;border-radius:12px;box-shadow:0 8px 26px rgba(0,0,0,.22);padding:6px;min-width:148px;display:none;z-index:9500}" +
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
        '<div class="pd-hint">数据仅保存在本机浏览器，不上传任何服务器。<br>' +
        '请<b>固定用同一网址</b>、<b>同一种方式</b>打开（Safari 或主屏幕图标，二选一）；换网址或换打开方式 = 两套独立数据。<br>' +
        '若注册过的账号不见了：多半开了无痕模式、清理过浏览器数据、或换了网址。可点下方「用备份码恢复」找回；平时登录后建议先导出一份备份码。</div>' +
        '<button id="pdBakLink" type="button" style="display:block;background:none;border:none;color:#2f9e6e;font-size:12.5px;font-weight:600;text-decoration:underline;margin:2px auto 0;cursor:pointer">🧳 用备份码恢复数据</button>' +
      '</div>';
    document.body.appendChild(o);

    document.getElementById("pdTabLogin").onclick = function () { setMode("login"); };
    document.getElementById("pdTabReg").onclick = function () { setMode("reg"); };
    document.getElementById("pdGo").onclick = submit;
    document.getElementById("pdBakLink").onclick = function () { showBackupPanel(); };
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
        '<button type="button" id="pdDataBtn">📊 学习数据</button>' +
        '<button type="button" id="pdBackupBtn">🧳 备份 / 恢复数据</button>' +
        '<button type="button" id="pdSwitchBtn">🔄 切换账号</button>' +
        '<button type="button" id="pdLogoutBtn">🚪 退出登录</button>' +
      '</div>';
    /* 优先挂进应用头部（⚙ 设置按钮旁），避免浮在 iPhone 状态栏/灵动岛上点不到；
       找不到头部（异常情况）才退回右上角悬浮，并用 safe-area 避开刘海 */
    var hd = document.querySelector(".hd-top");
    if (hd && hd.appendChild) { hd.appendChild(bar); }
    else { bar.classList.add("pd-bar-float"); document.body.appendChild(bar); }
    var menu = document.getElementById("pdMenu");
    document.getElementById("pdBarBtn").onclick = function () { menu.style.display = menu.style.display === "block" ? "none" : "block"; };
    document.getElementById("pdLogoutBtn").onclick = function () { setCur(null); location.reload(); };
    document.getElementById("pdSwitchBtn").onclick = function () { setCur(null); location.reload(); };
    document.getElementById("pdDataBtn").onclick = function () { menu.style.display = "none"; showDataPanel(user); };
    document.getElementById("pdBackupBtn").onclick = function () { menu.style.display = "none"; showBackupPanel(); };
    document.addEventListener("click", function (e) {
      if (!bar.contains(e.target)) menu.style.display = "none";
    });
  }

  /* ---------- 学习数据面板：可视化确认进度确实存在本机 ---------- */
  function showDataPanel(user) {
    var old = document.getElementById("pdDataMask");
    if (old) old.parentNode.removeChild(old);
    function jget(k) { try { return JSON.parse(LS.getItem(k)) || null; } catch (e) { return null; } }
    var prog = jget("phonics_progress_v1") || {};   // shim 自动按账号前缀读写
    var known = 0, seen = 0;
    Object.keys(prog).forEach(function (k) { if (prog[k] === "k") known++; seen++; });
    var tk = (function () { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); })();
    var log = jget("phonics_learnlog_v1") || {};
    var todayLearned = (log[tk] || []).length;
    var checkin = jget("phonics_checkin_v1") || {};
    var days = Object.keys(checkin).length;
    var storeOK = true;
    try { LS.setItem("pd_probe2", "1"); storeOK = LS.getItem("pd_probe2") === "1"; LS.removeItem("pd_probe2"); } catch (e) { storeOK = false; }
    var mask = document.createElement("div");
    mask.id = "pdDataMask";
    mask.className = "pd-mask";
    mask.style.background = "rgba(20,38,30,.72)";
    mask.innerHTML =
      '<div class="pd-card">' +
        '<div class="pd-logo">📊 ' + esc(user) + ' 的学习数据</div>' +
        '<div class="pd-sub">保存在本机浏览器 · 换账号互不相同</div>' +
        '<div style="font-size:14.5px;line-height:2.1;margin:4px 2px 10px;color:#33413a">' +
          '✅ 已掌握单词：<b>' + known + '</b> 个<br>' +
          '📖 学过（含待复习）：<b>' + seen + '</b> 个<br>' +
          '📝 今日已学：<b>' + todayLearned + '</b> 个<br>' +
          '🔥 有打卡记录：<b>' + days + '</b> 天<br>' +
          '💾 本机存储状态：<b style="color:' + (storeOK ? "#1f8a5a" : "#c0392b") + '">' + (storeOK ? "正常 ✓ 进度会自动保存" : "不可用 ✗ 请检查无痕模式 / Cookie 设置") + '</b>' +
        '</div>' +
        '<button class="pd-go" type="button" id="pdDataClose">关闭</button>' +
      '</div>';
    document.body.appendChild(mask);
    document.getElementById("pdDataClose").onclick = function () { mask.parentNode.removeChild(mask); };
    mask.addEventListener("click", function (e) { if (e.target === mask) mask.parentNode.removeChild(mask); });
  }

  /* ---------- 备份 / 恢复：把全部账号+学习数据导出为一段备份码，数据丢失后可导入找回 ----------
     说明：账号注册表(pd_sys_accounts)与每个账号的数据(pd_u_<账号>_*)都存在同一份本机存储里，
     存储被清（无痕模式/清理数据）或换网址后全部消失。备份码让用户能手动带走这份数据。 */
  function rawKeys() {
    var R = window.__pdRaw, out = [];
    if (!R) return out;
    try { for (var i = 0; i < R.length; i++) out.push(R.key(i)); } catch (e) {}
    return out;
  }
  function b64e(s) { return btoa(unescape(encodeURIComponent(s))); }
  function b64d(s) { return decodeURIComponent(escape(atob(String(s).trim()))); }
  function makeBackupCode() {
    var acc = accounts();
    var data = {};
    Object.keys(acc).forEach(function (u) {
      var pre = "pd_u_" + u + "_", o = {};
      rawKeys().forEach(function (k) {
        if (k && k.indexOf(pre) === 0) {
          try { o[k.slice(pre.length)] = window.__pdRaw.getItem(k); } catch (e) {}
        }
      });
      data[u] = o;
    });
    return b64e(JSON.stringify({ app: "pindu-star", v: 1, ts: new Date().toISOString(), accounts: acc, data: data }));
  }
  function applyBackupCode(code) {
    var j = JSON.parse(b64d(code));
    if (!j || !j.accounts || typeof j.accounts !== "object") throw new Error("备份码格式不正确");
    var acc = accounts(), names = Object.keys(j.accounts);
    names.forEach(function (u) { acc[u] = j.accounts[u]; });
    saveAccounts(acc);
    Object.keys(j.data || {}).forEach(function (u) {
      var pre = "pd_u_" + u + "_", o = j.data[u] || {};
      Object.keys(o).forEach(function (k) {
        try { window.__pdRaw.setItem(pre + k, o[k]); } catch (e) {}
      });
    });
    return names;
  }
  function showBackupPanel() {
    var old = document.getElementById("pdBakMask");
    if (old) old.parentNode.removeChild(old);
    var acc = accounts(), n = Object.keys(acc).length;
    var mask = document.createElement("div");
    mask.id = "pdBakMask";
    mask.className = "pd-mask";
    mask.style.background = "rgba(20,38,30,.72)";
    mask.innerHTML =
      '<div class="pd-card">' +
        '<div class="pd-logo">🧳 备份 / 恢复数据</div>' +
        '<div class="pd-sub">本机共 ' + n + ' 个账号 · 备份码包含全部账号与学习数据</div>' +
        '<textarea id="pdBakTa" class="pd-ta" placeholder="点「生成备份码」后，全选复制这段文字保存好（发微信给自己/家人即可）。恢复时把备份码粘贴到这里，点「导入并恢复」。"></textarea>' +
        '<div id="pdBakMsg" class="pd-err" style="min-height:16px"></div>' +
        '<button class="pd-go" type="button" id="pdBakGen">📤 生成备份码</button>' +
        '<button class="pd-go" type="button" id="pdBakCopy" style="background:#4a9d78;margin-top:8px">📋 复制备份码</button>' +
        '<button class="pd-go" type="button" id="pdBakImp" style="background:#e8a13d;margin-top:8px">📥 导入并恢复</button>' +
        '<button class="pd-go" type="button" id="pdBakClose" style="background:#8aa398;margin-top:8px">关闭</button>' +
      '</div>';
    document.body.appendChild(mask);
    var ta = document.getElementById("pdBakTa"), msg = document.getElementById("pdBakMsg");
    document.getElementById("pdBakGen").onclick = function () {
      try { ta.value = makeBackupCode(); msg.style.color = "#1f8a5a"; msg.textContent = "备份码已生成，请复制并妥善保存（含密码哈希，勿发给陌生人）。"; }
      catch (e) { msg.style.color = "#c0392b"; msg.textContent = "生成失败：" + e.message; }
    };
    document.getElementById("pdBakCopy").onclick = function () {
      if (!ta.value) { msg.style.color = "#c0392b"; msg.textContent = "请先生成备份码"; return; }
      var done = function () { msg.style.color = "#1f8a5a"; msg.textContent = "已复制，请粘贴保存（微信发给自己最方便）。"; };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(ta.value).then(done, function () { ta.select(); document.execCommand("copy"); done(); });
      } else { ta.select(); try { document.execCommand("copy"); } catch (e) {} done(); }
    };
    document.getElementById("pdBakImp").onclick = function () {
      if (!ta.value.trim()) { msg.style.color = "#c0392b"; msg.textContent = "请先把备份码粘贴到上面的输入框"; return; }
      try {
        var names = applyBackupCode(ta.value);
        msg.style.color = "#1f8a5a";
        msg.textContent = "已恢复 " + names.length + " 个账号（" + names.join("、") + "），页面即将刷新…";
        setTimeout(function () { location.reload(); }, 900);
      } catch (e) { msg.style.color = "#c0392b"; msg.textContent = "恢复失败：" + (e.message || "备份码不完整"); }
    };
    document.getElementById("pdBakClose").onclick = function () { mask.parentNode.removeChild(mask); };
    mask.addEventListener("click", function (e) { if (e.target === mask) mask.parentNode.removeChild(mask); });
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
