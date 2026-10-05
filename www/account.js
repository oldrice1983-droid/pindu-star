/* 拼读星球 · 云端账号系统（邮箱登录）
 * 账号与学习进度保存在 WorkBuddy 云端，按账号隔离，跨设备同步。
 * 未联网 / 未登录时仍可本地学习，数据暂存本机，登录后自动合并上云。
 * 依赖 cloud-layer.js 提供的 window.__initCloud / window.__pdOnLogin 等。 */
(function () {
  'use strict';

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
    ".pd-otpwrap{display:flex;gap:8px;align-items:stretch}" +
    ".pd-otpwrap .pd-input{flex:1;min-width:0}" +
    ".pd-codebtn{flex:none;width:114px;border:1.5px solid #2f9e6e;background:#eaf6f0;color:#1f6e4d;" +
    "font-size:13.5px;font-weight:700;border-radius:10px;cursor:pointer;padding:0 6px;white-space:nowrap}" +
    ".pd-codebtn:disabled{opacity:.6;cursor:default}" +
    ".pd-go{width:100%;border:0;background:#2f9e6e;color:#fff;font-size:15px;font-weight:700;padding:12px 0;border-radius:11px;cursor:pointer;margin-top:4px}" +
    ".pd-go:active{background:#26835c}" +
    ".pd-err{color:#c0392b;font-size:12.5px;min-height:18px;margin:8px 2px 0;text-align:center}" +
    ".pd-err.ok{color:#1f8a5a}" +
    ".pd-hint{font-size:11.5px;color:#9aa8a0;text-align:center;margin-top:10px;line-height:1.7}" +
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
  var cdTimer = null;

  var HINT_LOGIN = '输入邮箱和密码即可登录；密码忘了点下方「忘记密码」用邮箱重置。';
  var HINT_REG = '填写邮箱 + 密码，点「获取验证码」，再把邮件里的 6 位数字填进验证码框。';

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
        '<div class="pd-row"><label>邮箱</label><input id="pdEmail" class="pd-input" type="email" placeholder="you@example.com" autocomplete="email" inputmode="email"></div>' +
        '<div class="pd-row"><label>密码 <span id="pdPwTip" style="color:#9aa8a0"></span></label>' +
          '<input id="pdPw" class="pd-input" type="password" placeholder="至少 6 位" autocomplete="current-password"></div>' +
        '<div class="pd-row" id="pdOtpRow">' +
          '<label>邮箱验证码</label>' +
          '<div class="pd-otpwrap">' +
            '<input id="pdOtp" class="pd-input" inputmode="numeric" autocomplete="one-time-code" placeholder="6 位验证码">' +
            '<button id="pdOtpBtn" class="pd-codebtn" type="button">获取验证码</button>' +
          '</div>' +
        '</div>' +
        '<button id="pdGo" class="pd-go" type="button">登录</button>' +
        '<div id="pdErr" class="pd-err"></div>' +
        '<div class="pd-hint" id="pdHint"></div>' +
        '<button id="pdForgot" type="button" class="pd-linkbtn">忘记密码？</button>' +
        '<button id="pdGuest" type="button" class="pd-linkbtn">不注册（无法保存学习数据，仅本机试用）</button>' +
        '<div style="text-align:center;font-size:11px;color:#c2cec7;margin-top:12px">' +
          (window.__PD_BUILD ? esc(window.__PD_BUILD) : '') + '</div>' +
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
    setMode(mode);
    return o;
  }

  function setMode(m) {
    mode = m;
    $("pdTabLogin").className = m === "login" ? "on" : "";
    $("pdTabReg").className = m === "reg" ? "on" : "";
    $("pdGo").textContent = m === "login" ? "登录" : "注册并登录";
    /* 验证码只在「注册」时需要：登录页只填邮箱 + 密码 */
    $("pdOtpRow").style.display = m === "reg" ? "block" : "none";
    $("pdPwTip").textContent = m === "login" ? "" : "（至少 6 位）";
    $("pdHint").innerHTML = m === "login" ? HINT_LOGIN : HINT_REG;
    if ($("pdOtp")) $("pdOtp").value = "";
    pendingOtp = null;
    if (cdTimer) { clearInterval(cdTimer); cdTimer = null; }
    var b = $("pdOtpBtn"); if (b) { b.disabled = false; b.textContent = "获取验证码"; }
    errMsg("");
  }

  function errMsg(s, ok) {
    var e = $("pdErr");
    if (!e) return;
    e.textContent = s;
    e.className = ok ? "pd-err ok" : "pd-err";
  }
  function validEmail(e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); }

  /* 从会话对象里稳妥地取邮箱：SDK 不同版本字段位置不一致（user.email / email /
     user_metadata.email / phone…）。取不到就返回 null —— 绝不能把 undefined 当账号名显示。 */
  function sessionEmail(s) {
    var d = s && s.data;
    if (!d) return null;
    var cands = [
      d.email, d.user && d.user.email, d.user && d.user.user_email,
      d.user_metadata && d.user_metadata.email,
      d.user && d.user.user_metadata && d.user.user_metadata.email,
      d.session && d.session.user && d.session.user.email,
      d.user && d.user.phone
    ];
    for (var i = 0; i < cands.length; i++) {
      if (typeof cands[i] === "string" && validEmail(cands[i])) return cands[i];
    }
    return null;
  }

  function sendCode() {
    var email = ($("pdEmail").value || "").trim();
    if (!validEmail(email)) { errMsg("请输入有效邮箱"); return; }
    var c = ensureCloud(); if (!c) { errMsg("账号系统未就绪，请检查网络后刷新"); return; }
    var btn = $("pdOtpBtn"); btn.textContent = "发送中…"; btn.disabled = true;
    errMsg("");
    c.auth.sendOtp({ email: email }).then(function (r) {
      if (r.error) {
        btn.textContent = "获取验证码"; btn.disabled = false;
        errMsg(r.error.message || "验证码发送失败"); return;
      }
      pendingOtp = { email: email, verificationId: r.data.verificationId, isExistingUser: r.data.isExistingUser };
      errMsg("✅ 验证码已发送到 " + email + "（" + (r.data.isExistingUser ? "登录" : "注册") + "），请把 6 位数字填进上面的「邮箱验证码」框", true);
      var n = 60;
      btn.textContent = n + "s 后重发";
      cdTimer = setInterval(function () {
        n--;
        if (n <= 0) { clearInterval(cdTimer); cdTimer = null; btn.textContent = "重新获取"; btn.disabled = false; }
        else btn.textContent = n + "s 后重发";
      }, 1000);
    }).catch(function (e) {
      btn.textContent = "获取验证码"; btn.disabled = false;
      errMsg("发送失败：" + (e && e.message ? e.message : "请重试"));
    });
  }

  function submit() {
    var email = ($("pdEmail").value || "").trim();
    var pw = $("pdPw").value || "";
    var code = ($("pdOtp").value || "").trim();
    if (!validEmail(email)) { errMsg("请输入有效邮箱"); return; }
    var c = ensureCloud(); if (!c) { errMsg("账号系统未就绪，请检查网络后刷新"); return; }

    if (mode === "reg") {
      /* 注册：邮箱 + 密码 + 邮箱验证码 */
      if (pw.length < 6) { errMsg("请设置密码（至少 6 位）"); return; }
      if (!/^\d{4,8}$/.test(code)) { errMsg("请填写邮件里的 6 位数字验证码"); return; }
      if (!pendingOtp || pendingOtp.email !== email) { errMsg("请先点「获取验证码」"); return; }
      doRegister(c, email, pw, code);
    } else {
      /* 登录：只需邮箱 + 密码 */
      if (pw.length < 6) { errMsg("请输入密码（至少 6 位）"); return; }
      doPasswordLogin(c, email, pw);
    }
  }

  function doPasswordLogin(c, email, pw) {
    c.auth.signInWithPassword({ email: email, password: pw }).then(function (r) {
      if (r.error) { errMsg(r.error.message || "登录失败"); return; }
      loginOK(email);
    }).catch(function (e) { errMsg("登录失败：" + (e && e.message ? e.message : "请重试")); });
  }

  function doRegister(c, email, pw, code) {
    c.auth.verifyOtp({ email: email, verificationId: pendingOtp.verificationId, isExistingUser: pendingOtp.isExistingUser, token: code, password: pw }).then(function (r) {
      if (r.error) { errMsg(r.error.message || "注册失败"); return; }
      loginOK(email);
    }).catch(function (e) { errMsg("注册失败：" + (e && e.message ? e.message : "请重试")); });
  }

  function forgot() {
    var email = ($("pdEmail").value || "").trim();
    if (!validEmail(email)) { errMsg("请先填写要找回的邮箱"); return; }
    var c = ensureCloud(); if (!c) { errMsg("账号系统未就绪，请检查网络后刷新"); return; }
    c.auth.resetPasswordForEmail(email).then(function (r) {
      if (r.error) { errMsg(r.error.message || "重置邮件发送失败"); return; }
      errMsg("重置邮件已发送到 " + email + "，请按邮件提示设置新密码", true);
    }).catch(function (e) { errMsg("发送失败：" + (e && e.message ? e.message : "请重试")); });
  }

  function loginOK(email) {
    if (!validEmail(email)) { errMsg("登录信息异常，请重新登录"); return; }
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
    /* 本地文件/预览打开（file:// 等）：数据仅存本机、绝不联网，直接进入主界面，不弹云端登录框 */
    if (location.protocol === "file:" || !location.hostname || location.protocol === "blob:" || location.protocol === "about:") return;
    injectCSS();
    buildMask(); setMode("login");
    errMsg("正在加载账号系统…");

    var t0 = Date.now(), waited = false;
    function ready() {
      var c = ensureCloud();
      if (!c) {
        if (!waited && window.__pdSDKReady && Date.now() - t0 < 15000) {
          waited = true;
          window.__pdSDKReady.then(function () { setTimeout(ready, 0); });
          return;
        }
        errMsg("账号系统需联网加载（当前以本机模式运行，数据暂存本机）。请检查网络后刷新重试。");
        return;
      }
      c.auth.getSession().then(function (s) {
        /* 只有确实拿到合法邮箱才算已登录；否则一律当未登录（避免出现 undefined 账号） */
        var mail = (s && !s.error) ? sessionEmail(s) : null;
        if (mail) {
          var m = $("pdMask"); if (m) m.parentNode.removeChild(m);
          showBar(mail);
          if (window.__pdOnLogin) window.__pdOnLogin(mail);
        } else {
          setMode("login");
        }
      }).catch(function () { setMode("login"); });
    }
    ready();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
