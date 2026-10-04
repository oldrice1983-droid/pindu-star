/* 拼读星球 · 云端账号系统（邮箱登录）
 * 账号与学习进度保存在 WorkBuddy 云端，按账号隔离，跨设备同步。
 * 未联网 / 未登录时仍可本地学习，数据暂存本机，登录后自动合并上云。
 * 依赖 cloud-layer.js 提供的 window.__initCloud / window.__pdOnLogin 等。 */
(function () {
  'use strict';

  var LS = window.localStorage;
  function ensureCloud() {
    if (window.__initCloud && window.__initCloud()) return window.__cloud;
    return null;
  }

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
    ".pd-linkbtn{display:block;width:100%;background:transparent;border:0;color:#2f6e52;font-size:13px;cursor:pointer;margin-top:8px;text-decoration:underline}" +
    ".pd-bar{position:relative;z-index:9000;display:inline-flex;align-items:center;font-family:'Segoe UI',Arial,'PingFang SC',sans-serif}" +
    ".pd-bar.pd-bar-float{position:fixed;top:calc(10px + env(safe-area-inset-top,0px));right:12px}" +
    ".pd-bar-btn{border:0;background:rgba(255,255,255,.92);color:#1f6e4d;font-size:13px;font-weight:700;padding:7px 13px;border-radius:20px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.18)}" +
    ".pd-menu{position:absolute;right:0;top:44px;background:#fff;border-radius:12px;box-shadow:0 8px 26px rgba(0,0,0,.22);padding:6px;min-width:160px;display:none;z-index:9500}" +
    ".pd-menu button{display:block;width:100%;text-align:left;border:0;background:transparent;padding:9px 12px;font-size:13.5px;color:#33413a;border-radius:8px;cursor:pointer}" +
    ".pd-menu button:active{background:#eef5f1}";

  function injectCSS() { var s = document.createElement("style"); s.textContent = CSS; document.head.appendChild(s); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function $(id) { return document.getElementById(id); }

  var mode = "login";
  var pendingOtp = null; // {email, verificationId, isExistingUser}

  /* ---------- 登录 / 注册浮层 ---------- */
  function buildMask() {
    var o = $("pdMask"); if (o) return o;
    o = document.createElement("div"); o.id = "pdMask"; o.className = "pd-mask";
    o.innerHTML =
      '<div class="pd-card">' +
        '<div class="pd-logo">拼读星球 · 账号</div>' +
        '<div class="pd-sub">学习进度保存在云端，换手机 / 换浏览器都能接着学</div>' +
        '<div class="pd-tabs">' +
          '<button id="pdTabLogin" class="on" type="button">登录</button>' +
          '<button id="pdTabReg" type="button">注册</button>' +
        '</div>' +
        '<div class="pd-row"><label>邮箱</label><input id="pdEmail" class="pd-input" type="email" placeholder="you@example.com" autocomplete="email"></div>' +
        '<div class="pd-row"><label>密码</label><input id="pdPw" class="pd-input" type="password" placeholder="至少 6 位" autocomplete="current-password"></div>' +
        '<div class="pd-row" id="pdOtpRow" style="display:none"><label>邮箱验证码</label><input id="pdOtp" class="pd-input" inputmode="numeric" placeholder="邮箱收到的 6 位验证码"></div>' +
        '<button id="pdGo" class="pd-go" type="button">登录</button>' +
        '<div id="pdErr" class="pd-err"></div>' +
        '<div class="pd-hint">可用<b>邮箱 + 密码</b>直接登录；或点「获取邮箱验证码」用验证码登录 / 注册。<br>忘记密码可点「忘记密码」通过邮箱重置。</div>' +
        '<button id="pdOtpBtn" type="button" class="pd-linkbtn">📩 获取邮箱验证码</button>' +
        '<button id="pdForgot" type="button" class="pd-linkbtn">忘记密码？</button>' +
        '<button id="pdGuest" type="button" class="pd-linkbtn">暂不登录，先试用（本机保存）</button>' +
      '</div>';
    document.body.appendChild(o);
    $("pdTabLogin").onclick = function () { setMode("login"); };
    $("pdTabReg").onclick = function () { setMode("reg"); };
    $("pdGo").onclick = submit;
    $("pdOtpBtn").onclick = sendCode;
    $("pdForgot").onclick = forgot;
    $("pdGuest").onclick = function () { var m = $("pdMask"); if (m) m.parentNode.removeChild(m); };
    $("pdPw").addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
    $("pdOtp").addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
    $("pdEmail").addEventListener("keydown", function (e) { if (e.key === "Enter") $("pdPw").focus(); });
    return o;
  }

  function setMode(m) {
    mode = m;
    $("pdTabLogin").className = m === "login" ? "on" : "";
    $("pdTabReg").className = m === "reg" ? "on" : "";
    $("pdGo").textContent = m === "login" ? "登录" : "注册并登录";
    $("pdOtpRow").style.display = "none";
    pendingOtp = null;
    $("pdErr").textContent = "";
  }

  function errMsg(s) { var e = $("pdErr"); if (e) e.textContent = s; }

  function sendCode() {
    var email = ($("pdEmail").value || "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { errMsg("请输入有效邮箱"); return; }
    var c = ensureCloud(); if (!c) { errMsg("账号系统未就绪，请检查网络后刷新"); return; }
    var btn = $("pdOtpBtn"); btn.textContent = "发送中…"; btn.disabled = true;
    c.auth.sendOtp({ email: email }).then(function (r) {
      btn.textContent = "📩 重新获取验证码"; btn.disabled = false;
      if (r.error) { errMsg(r.error.message || "验证码发送失败"); return; }
      pendingOtp = { email: email, verificationId: r.data.verificationId, isExistingUser: r.data.isExistingUser };
      $("pdOtpRow").style.display = "block";
      errMsg("验证码已发送到 " + email + (r.data.isExistingUser ? "（登录）" : "（注册）"));
    }).catch(function (e) { btn.textContent = "📩 获取邮箱验证码"; btn.disabled = false; errMsg("发送失败：" + (e && e.message ? e.message : "请重试")); });
  }

  function submit() {
    var email = ($("pdEmail").value || "").trim();
    var pw = $("pdPw").value || "";
    var code = ($("pdOtp").value || "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { errMsg("请输入有效邮箱"); return; }
    var c = ensureCloud(); if (!c) { errMsg("账号系统未就绪，请检查网络后刷新"); return; }
    if (mode === "reg") {
      if (pw.length < 6) { errMsg("密码至少 6 位"); return; }
      if (!pendingOtp || pendingOtp.email !== email) { errMsg("请先获取邮箱验证码"); return; }
      if (!/^\d{4,8}$/.test(code)) { errMsg("请输入邮箱验证码"); return; }
      doRegister(c, email, pw, code);
    } else {
      if (pendingOtp && pendingOtp.email === email && code) doOtpLogin(c, email, code);
      else {
        if (pw.length < 6) { errMsg("密码至少 6 位，或用验证码登录"); return; }
        doPasswordLogin(c, email, pw);
      }
    }
  }

  function doPasswordLogin(c, email, pw) {
    c.auth.signInWithPassword({ email: email, password: pw }).then(function (r) {
      if (r.error) { errMsg(r.error.message || "登录失败"); return; }
      loginOK(email);
    }).catch(function (e) { errMsg("登录失败：" + (e && e.message ? e.message : "请重试")); });
  }

  function doOtpLogin(c, email, code) {
    c.auth.verifyOtp({ email: email, verificationId: pendingOtp.verificationId, isExistingUser: pendingOtp.isExistingUser, token: code }).then(function (r) {
      if (r.error) { errMsg(r.error.message || "验证失败"); return; }
      loginOK(email);
    }).catch(function (e) { errMsg("验证失败：" + (e && e.message ? e.message : "请重试")); });
  }

  function doRegister(c, email, pw, code) {
    c.auth.verifyOtp({ email: email, verificationId: pendingOtp.verificationId, isExistingUser: pendingOtp.isExistingUser, token: code, password: pw }).then(function (r) {
      if (r.error) { errMsg(r.error.message || "注册失败"); return; }
      loginOK(email);
    }).catch(function (e) { errMsg("注册失败：" + (e && e.message ? e.message : "请重试")); });
  }

  function forgot() {
    var email = ($("pdEmail").value || "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { errMsg("请输入有效邮箱"); return; }
    var c = ensureCloud(); if (!c) { errMsg("账号系统未就绪，请检查网络后刷新"); return; }
    c.auth.resetPasswordForEmail(email).then(function (r) {
      if (r.error) { errMsg(r.error.message || "重置邮件发送失败"); return; }
      errMsg("重置邮件已发送到 " + email + "，请查收");
    }).catch(function (e) { errMsg("发送失败：" + (e && e.message ? e.message : "请重试")); });
  }

  function loginOK(email) {
    var m = $("pdMask"); if (m) m.parentNode.removeChild(m);
    showBar(email);
    if (window.__pdOnLogin) window.__pdOnLogin(email);
  }

  /* ---------- 登录后右上角账号条 ---------- */
  function showBar(email) {
    var bar = $("pdBar"); if (bar) return;
    bar = document.createElement("div"); bar.id = "pdBar"; bar.className = "pd-bar";
    bar.innerHTML =
      '<button class="pd-bar-btn" id="pdBarBtn" type="button">👤 ' + esc(email) + ' ▾</button>' +
      '<div class="pd-menu" id="pdMenu">' +
        '<button type="button" id="pdDataBtn">📊 学习数据</button>' +
        '<button type="button" id="pdLogoutBtn">🚪 退出登录</button>' +
      '</div>';
    var hd = document.querySelector(".hd-top");
    if (hd && hd.appendChild) hd.appendChild(bar);
    else { bar.classList.add("pd-bar-float"); document.body.appendChild(bar); }
    var menu = $("pdMenu");
    $("pdBarBtn").onclick = function () { menu.style.display = menu.style.display === "block" ? "none" : "block"; };
    $("pdLogoutBtn").onclick = function () {
      var c = ensureCloud();
      if (c && c.auth.signOut) c.auth.signOut().catch(function () {});
      if (window.__pdOnLogout) window.__pdOnLogout();
      if (bar.parentNode) bar.parentNode.removeChild(bar);
      buildMask(); setMode("login");
    };
    $("pdDataBtn").onclick = function () { menu.style.display = "none"; showDataPanel(email); };
    document.addEventListener("click", function (e) { if (!bar.contains(e.target)) menu.style.display = "none"; });
  }

  /* ---------- 学习数据面板：显示云端同步状态 ---------- */
  function showDataPanel(email) {
    var old = $("pdDataMask"); if (old) old.parentNode.removeChild(old);
    var prog = (typeof progress !== "undefined" && progress) || {};
    var known = 0, seen = 0;
    Object.keys(prog).forEach(function (k) { if (prog[k] === "k") known++; else if (prog[k]) seen++; });
    var tk = (function () { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); })();
    var log = (typeof learnLog !== "undefined" && learnLog) || {};
    var todayLearned = (log[tk] || []).length;
    var ck = (typeof checkin !== "undefined" && checkin) || {};
    var days = Object.keys(ck).length;
    var mask = document.createElement("div"); mask.id = "pdDataMask"; mask.className = "pd-mask"; mask.style.background = "rgba(20,38,30,.72)";
    mask.innerHTML =
      '<div class="pd-card">' +
        '<div class="pd-logo">📊 ' + esc(email) + ' 的学习数据</div>' +
        '<div class="pd-sub">已同步到云端 · 换设备登录同一邮箱即可恢复</div>' +
        '<div style="font-size:14.5px;line-height:2.1;margin:4px 2px 10px;color:#33413a">' +
          '✅ 已掌握单词：<b>' + known + '</b> 个<br>' +
          '📖 学过（含待复习）：<b>' + seen + '</b> 个<br>' +
          '📝 今日已学：<b>' + todayLearned + '</b> 个<br>' +
          '🔥 有打卡记录：<b>' + days + '</b> 天<br>' +
          '☁️ 云端同步：<b style="color:#1f8a5a">已开启 ✓</b>' +
        '</div>' +
        '<button class="pd-go" type="button" id="pdDataClose">关闭</button>' +
      '</div>';
    document.body.appendChild(mask);
    $("pdDataClose").onclick = function () { mask.parentNode.removeChild(mask); };
    mask.addEventListener("click", function (e) { if (e.target === mask) mask.parentNode.removeChild(mask); });
  }

  /* ---------- 启动 ---------- */
  function boot() {
    injectCSS();
    var c = ensureCloud();
    if (!c) {
      // SDK 未就绪（离线 / CDN 未加载）：仍可用本机模式学习，提示联网登录
      buildMask();
      errMsg("账号系统需联网加载，当前以本机模式运行（数据暂存本机）");
      return;
    }
    c.auth.getSession().then(function (s) {
      if (s && !s.error && s.data && s.data.user) {
        showBar(s.data.user.email);
        if (window.__pdOnLogin) window.__pdOnLogin(s.data.user.email);
      } else {
        buildMask(); setMode("login");
      }
    }).catch(function () { buildMask(); setMode("login"); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
