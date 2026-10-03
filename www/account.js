/* ============================================================
   拼读星球 · 云端账号与进度同步
   - Auth：邮箱+密码登录 / 邮箱验证码登录 / 带密码注册 / 找回密码
   - Database：每个用户一行（owner_id 主键），JSONB 存全部学习状态
   - 仅注册域名生效，未登录时 App 仍用 localStorage 本地进度
   ============================================================ */
(function () {
  "use strict";

  var publicConfig = {
    endpoint: "https://pindu-star.app.workbuddy.host",
    publishableKey: "wbpk_PrJdeZz41HRwydQR72S9Gv_j7b2FnNuLlMyU1z2KiKFmJ8PkcDP57XH"
  };
  var SDK_SRC = "https://cdn.jsdelivr.net/npm/@tencent-ai/workbuddy-cloud-sdk@dev/lib/index.global.js";
  var AVATARS = ["🧒","👦","👧","🧑","👨","👩","🐯","🐱","🐶","🦊","🐼","🚀","⭐","🌟","🍎","📚"];

  var cloud = null, uid = null, nick = "", avatar = "🧒";
  var syncTimer = null, originals = {}, otpPending = null, suPending = null;

  /* ---------------- 样式 ---------------- */
  var style = document.createElement("style");
  style.textContent = [
    ".wb-auth{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;",
    "background:linear-gradient(160deg,#eafff5,#d8f3ea);padding:18px;font-family:inherit;}",
    ".wb-card{width:100%;max-width:360px;background:#fff;border-radius:20px;padding:22px 20px;box-shadow:0 12px 40px rgba(0,120,80,.18);}",
    ".wb-logo{font-size:22px;font-weight:800;color:#00995a;text-align:center;margin-bottom:14px;}",
    ".wb-tabs{display:flex;gap:6px;margin-bottom:14px;}",
    ".wb-tabs button{flex:1;border:none;background:#eef5f1;color:#4a6;font-size:13px;padding:9px 0;border-radius:10px;cursor:pointer;}",
    ".wb-tabs button.on{background:#00995a;color:#fff;font-weight:700;}",
    ".wb-pane{display:flex;flex-direction:column;gap:10px;}",
    ".wb-pane[hidden]{display:none;}",
    ".wb-card input{width:100%;box-sizing:border-box;border:1.5px solid #d6e6df;border-radius:12px;padding:12px;font-size:15px;outline:none;}",
    ".wb-card input:focus{border-color:#00c97a;}",
    ".wb-row{display:flex;gap:8px;}",
    ".wb-row input{flex:1;}",
    ".wb-row button{white-space:nowrap;border:none;background:#e8f6ef;color:#00995a;font-weight:700;padding:0 12px;border-radius:12px;}",
    ".wb-primary{margin-top:4px;border:none;background:linear-gradient(90deg,#00c97a,#00995a);color:#fff;font-size:16px;font-weight:800;padding:13px;border-radius:14px;cursor:pointer;}",
    ".wb-err{font-size:13px;min-height:18px;margin:2px 0 6px;text-align:center;color:#e0533a;}",
    ".wb-ok{color:#00995a !important;}",
    ".wb-hint{font-size:12px;color:#8aa;margin-top:12px;text-align:center;line-height:1.5;}",
    "#wbBar{position:fixed;top:0;left:0;right:0;z-index:9000;display:none;align-items:center;gap:8px;",
    "background:rgba(255,255,255,.92);backdrop-filter:blur(6px);padding:8px 14px;box-shadow:0 2px 10px rgba(0,0,0,.06);font-family:inherit;}",
    "#wbBar .wb-av{font-size:22px;}",
    "#wbBar .wb-nm{font-weight:700;color:#176;font-size:14px;}",
    "#wbBar .wb-sp{font-size:12px;color:#9ab;}",
    "#wbBar .wb-btns{margin-left:auto;display:flex;gap:8px;}",
    "#wbBar button{border:none;background:#eef5f1;color:#00995a;font-size:13px;padding:7px 12px;border-radius:10px;cursor:pointer;}",
    "#wbBar button.wb-out{background:#fff0ec;color:#e0533a;}",
    ".wb-cloudnote{position:fixed;bottom:10px;left:50%;transform:translateX(-50%);z-index:8500;",
    "background:#fff6e6;color:#a06a00;font-size:12px;padding:8px 14px;border-radius:12px;display:none;}"
  ].join("");
  document.head.appendChild(style);

  /* ---------------- 收集 / 应用云端状态 ---------------- */
  function collect() {
    return {
      progress: progress, checkin: checkin, learnLog: learnLog, daily: daily,
      notes: notes, wquizData: wquizData, quizUsed: quizUsed, autoProg: autoProg,
      affixProg: affixProg, ruleProg: ruleProg, settings: settings,
      nickname: nick, avatar: avatar
    };
  }
  function apply(p) {
    if (!p) return;
    try {
      if (p.progress !== undefined) progress = p.progress || {};
      if (p.checkin !== undefined) checkin = p.checkin || {};
      if (p.learnLog !== undefined) learnLog = p.learnLog || {};
      if (p.daily !== undefined) daily = p.daily || null;
      if (p.notes !== undefined) notes = p.notes || {};
      if (p.wquizData !== undefined) wquizData = p.wquizData || {};
      if (p.quizUsed !== undefined) quizUsed = p.quizUsed || {};
      if (p.autoProg !== undefined) autoProg = p.autoProg || {};
      if (p.affixProg !== undefined) affixProg = p.affixProg || {};
      if (p.ruleProg !== undefined) ruleProg = p.ruleProg || {};
      if (p.settings !== undefined) settings = Object.assign({}, settings, p.settings || {});
      if (p.nickname !== undefined) nick = p.nickname || "";
      if (p.avatar !== undefined) avatar = p.avatar || "🧒";
    } catch (e) { /* ignore partial */ }
  }
  function cacheLocal() {
    try {
      if (originals.saveProgress) originals.saveProgress();
      if (originals.saveCheckin) originals.saveCheckin();
      if (originals.saveLearnLog) originals.saveLearnLog();
      if (originals.saveNote) originals.saveNote("", ""); // 触发 notes 本地缓存
      if (originals.saveQuizUsed) originals.saveQuizUsed();
      if (originals.saveAutoProg) originals.saveAutoProg();
      if (originals.saveAffixProg) originals.saveAffixProg();
      if (originals.saveRuleProg) originals.saveRuleProg();
      if (originals.saveSettings) originals.saveSettings();
    } catch (e) {}
  }

  /* ---------------- 包裹原 save 函数，实现云端并联 ---------------- */
  function capture(name) { originals[name] = window[name]; }
  function wrap(name) {
    capture(name);
    var orig = originals[name];
    if (typeof orig === "function") {
      window[name] = function () { var r = orig.apply(null, arguments); scheduleSync(); return r; };
    }
  }
  function wrapSaves() {
    // 具名 save 函数（改动后立即触发云端同步）
    ["saveProgress","saveCheckin","saveLearnLog","saveNote","saveQuizUsed",
     "saveAutoProg","saveAffixProg","saveRuleProg","saveSettings"].forEach(wrap);
    // 内联 localStorage 写入的关键函数（每日计划 / 单词测验数据），同样触发同步
    if (typeof window.getDaily === "function") wrap("getDaily");
    if (typeof window.wqNext === "function") wrap("wqNext");
    capture("resetProgress");
    var oReset = originals.resetProgress;
    if (typeof oReset === "function") {
      window.resetProgress = function () { var r = oReset.apply(null, arguments); scheduleSync(); return r; };
    }
  }

  function scheduleSync() {
    if (!uid) return;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(syncNow, 700);
  }
  async function syncNow() {
    if (!cloud || !uid) return;
    try {
      var payload = collect();
      var res = await cloud.database.from("user_progress").upsert(
        { payload: payload, nickname: nick, avatar: avatar },
        { onConflict: "owner_id" }
      );
      if (res.error) console.warn("[cloud] sync failed:", res.error.message);
    } catch (e) { console.warn("[cloud] sync error:", e); }
  }

  async function loadCloud() {
    if (!cloud || !uid) return;
    try {
      var res = await cloud.database.from("user_progress").select("*").maybeSingle();
      if (res.error) { console.warn("[cloud] load failed:", res.error.message); return; }
      if (res.data) {
        apply(res.data.payload);
        if (res.data.nickname !== undefined) nick = res.data.nickname || "";
        if (res.data.avatar !== undefined) avatar = res.data.avatar || "🧒";
      }
      cacheLocal();
      try { if (typeof render === "function") render(); if (typeof updateHeader === "function") updateHeader(); } catch (e) {}
    } catch (e) { console.warn("[cloud] load error:", e); }
  }

  /* ---------------- UI ---------------- */
  function el(id) { return document.getElementById(id); }
  function val(id) { var e = el(id); return e ? e.value.trim() : ""; }
  function setErr(msg, ok) { var e = el("wbErr"); if (!e) return; e.textContent = msg || ""; e.className = "wb-err" + (ok ? " wb-ok" : ""); }
  function showTab(t) {
    document.querySelectorAll(".wb-tabs button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-tab") === t); });
    document.querySelectorAll(".wb-pane").forEach(function (p) { p.hidden = p.getAttribute("data-pane") !== t; });
    setErr("");
  }
  function countdown(btnId) {
    var b = el(btnId); if (!b) return;
    var n = 60; b.disabled = true; var t = setInterval(function () {
      n--; b.textContent = n + "s"; if (n <= 0) { clearInterval(t); b.disabled = false; b.textContent = "获取验证码"; }
    }, 1000);
  }

  function buildUI() {
    var a = document.createElement("div");
    a.id = "wbAuth"; a.className = "wb-auth";
    a.innerHTML = [
      '<div class="wb-card">',
      '  <div class="wb-logo">拼读星球 · 账号</div>',
      '  <div class="wb-tabs">',
      '    <button data-tab="pwd" class="on">密码登录</button>',
      '    <button data-tab="otp">验证码登录</button>',
      '    <button data-tab="signup">注册</button>',
      '    <button data-tab="reset">找回密码</button>',
      '  </div>',
      '  <div id="wbErr" class="wb-err"></div>',
      '  <div class="wb-pane" data-pane="pwd">',
      '    <input id="pwdEmail" type="email" placeholder="邮箱" autocomplete="username">',
      '    <input id="pwdPass" type="password" placeholder="密码" autocomplete="current-password">',
      '    <button id="pwdBtn" class="wb-primary">登录</button>',
      '  </div>',
      '  <div class="wb-pane" data-pane="otp" hidden>',
      '    <input id="otpEmail" type="email" placeholder="邮箱" autocomplete="username">',
      '    <div class="wb-row"><input id="otpCode" placeholder="邮箱验证码"><button id="otpSend" type="button">获取验证码</button></div>',
      '    <button id="otpBtn" class="wb-primary">登录</button>',
      '  </div>',
      '  <div class="wb-pane" data-pane="signup" hidden>',
      '    <input id="suEmail" type="email" placeholder="邮箱" autocomplete="username">',
      '    <input id="suPass" type="password" placeholder="设置密码（6 位以上）" autocomplete="new-password">',
      '    <div class="wb-row"><input id="suCode" placeholder="邮箱验证码"><button id="suSend" type="button">获取验证码</button></div>',
'    <button id="suBtn" class="wb-primary">注册并登录</button>',
'    <div class="wb-hint" style="margin-top:8px">直接点「注册并登录」即可；若提示需验证，填完邮箱验证码再点一次。</div>',
'  </div>',
      '  <div class="wb-pane" data-pane="reset" hidden>',
      '    <input id="rsEmail" type="email" placeholder="邮箱" autocomplete="username">',
      '    <button id="rsBtn" class="wb-primary">发送重置邮件</button>',
      '  </div>',
      '  <div class="wb-hint">每个家人用各自邮箱注册，进度自动云端同步、互不可见。</div>',
      '</div>'
    ].join("");
    document.body.appendChild(a);

    var bar = document.createElement("div");
    bar.id = "wbBar";
    bar.innerHTML = '<span class="wb-av">🧒</span><span class="wb-nm">—</span>' +
      '<span class="wb-sp"></span><span class="wb-btns">' +
      '<button id="wbEdit">资料</button><button id="wbOut" class="wb-out">退出</button></span>';
    document.body.appendChild(bar);

    var note = document.createElement("div");
    note.id = "wbCloudNote"; note.className = "wb-cloudnote";
    note.textContent = "云端账号暂时不可用，当前使用本机进度（换设备不同步）。";
    document.body.appendChild(note);

    // 事件绑定
    a.querySelectorAll(".wb-tabs button").forEach(function (b) { b.onclick = function () { showTab(b.getAttribute("data-tab")); }; });
    el("pwdBtn").onclick = pwdLogin;
    el("otpSend").onclick = otpSend;
    el("otpBtn").onclick = otpVerify;
    el("suSend").onclick = suSend;
    el("suBtn").onclick = suSubmit;
    el("rsBtn").onclick = resetSend;
    el("wbOut").onclick = logout;
    el("wbEdit").onclick = editProfile;
  }

  function showAuth() { var a = el("wbAuth"); if (a) a.style.display = "flex"; var b = el("wbBar"); if (b) b.style.display = "none"; }
  function hideAuth() { var a = el("wbAuth"); if (a) a.style.display = "none"; }
  function renderBar() {
    var b = el("wbBar"); if (!b) return;
    if (!uid) { b.style.display = "none"; return; }
    b.style.display = "flex";
    b.querySelector(".wb-av").textContent = avatar || "🧒";
    b.querySelector(".wb-nm").textContent = nick || "我的账号";
  }

  /* ---------------- 认证流程 ---------------- */
  async function pwdLogin() {
    setErr("");
    var email = val("pwdEmail"), password = val("pwdPass");
    if (!email || !password) return setErr("请输入邮箱和密码");
    var r = await cloud.auth.signInWithPassword({ email: email, password: password });
    if (r.error) return setErr("邮箱或密码不正确");
  }
  async function otpSend() {
    setErr("");
    var email = val("otpEmail"); if (!email) return setErr("请输入邮箱");
    var r = await cloud.auth.sendOtp({ email: email });
    if (r.error) return setErr(r.error.message);
    otpPending = { email: email, verificationId: r.data.verificationId, isExistingUser: r.data.isExistingUser };
    countdown("otpSend"); setErr("验证码已发送，请查收邮箱", true);
  }
  async function otpVerify() {
    setErr("");
    var code = val("otpCode"); if (!otpPending) return setErr("请先获取验证码");
    var r = await cloud.auth.verifyOtp({
      email: otpPending.email, verificationId: otpPending.verificationId,
      isExistingUser: otpPending.isExistingUser, token: code
    });
    if (r.error) return setErr(r.error.message);
    otpPending = null;
  }
  async function suSend() {
    setErr("");
    var email = val("suEmail"), password = val("suPass");
    if (!email) return setErr("请输入邮箱");
    if (!password || password.length < 6) return setErr("密码至少 6 位");
    var r = await cloud.auth.sendOtp({ email: email });
    if (r.error) return setErr(r.error.message);
    suPending = { email: email, password: password, verificationId: r.data.verificationId, isExistingUser: r.data.isExistingUser };
    countdown("suSend"); setErr("验证码已发送，请查收邮箱", true);
  }
  async function suSubmit() {
    setErr("");
    var email = val("suEmail"), password = val("suPass"), code = val("suCode");
    if (!email) return setErr("请输入邮箱");
    if (!password || password.length < 6) return setErr("密码至少 6 位");
    // 已填验证码 → 走 OTP 验证注册
    if (code) {
      if (!suPending) return setErr("请先点「获取验证码」");
      if (suPending.isExistingUser) { showTab("pwd"); suPending = null; return setErr("该邮箱已注册，请用密码登录"); }
      var r2 = await cloud.auth.verifyOtp({
        email: suPending.email, verificationId: suPending.verificationId,
        isExistingUser: false, token: code, password: suPending.password
      });
      if (r2.error) return setErr(r2.error.message);
      suPending = null;
      return;
    }
    // 未填验证码 → 先尝试免验证直接注册（若后端关闭了邮件确认即可纯密码注册成功）
    try {
      var r = await cloud.auth.signUp({ email: email, password: password });
      if (r.error) {
        setErr("需要邮箱验证码：请点「获取验证码」并填写后再注册", false);
        return;
      }
      if (r.data && r.data.session) return; // 直接登录成功（纯密码注册达成）
      setErr("账号已创建，请查收验证邮件完成激活后再登录", true);
    } catch (e) { setErr("注册失败：" + (e && e.message ? e.message : e)); }
  }
  async function resetSend() {
    setErr("");
    var email = val("rsEmail"); if (!email) return setErr("请输入邮箱");
    var r = await cloud.auth.resetPasswordForEmail(email);
    if (r.error) return setErr(r.error.message);
    setErr("重置邮件已发送，请按邮件提示设置新密码", true);
  }

  async function onSignedIn(session) {
    hideAuth();
    try {
      var u = await cloud.auth.getUser();
      uid = (u && u.data && u.data.id) ? u.data.id : (session.user && session.user.id) || null;
    } catch (e) { uid = session.user ? session.user.id : null; }
    if (!uid) { showAuth(); return; }
    await loadCloud();
    renderBar();
  }
  function onSignedOut() { uid = null; nick = ""; avatar = "🧒"; showAuth(); renderBar(); }

  async function logout() {
    try { await cloud.auth.signOut(); } catch (e) {}
    uid = null; showAuth(); renderBar();
  }
  function editProfile() {
    var nn = prompt("昵称", nick || "");
    if (nn === null) return;
    nick = nn.trim();
    var av = prompt("选一个头像 emoji：\n" + AVATARS.join(" "), avatar);
    if (av !== null) avatar = (av.trim() || "🧒").slice(0, 4);
    renderBar(); scheduleSync();
  }

  /* ---------------- 启动 ---------------- */
  function loadSDK() {
    return new Promise(function (resolve, reject) {
      if (window.WorkBuddyCloud) return resolve();
      var s = document.createElement("script");
      s.src = SDK_SRC; s.async = true;
      s.onload = function () { window.WorkBuddyCloud ? resolve() : reject(new Error("SDK 未就绪")); };
      s.onerror = function () { reject(new Error("SDK 加载失败")); };
      document.head.appendChild(s);
    });
  }
  async function boot() {
    // 仅在云端注册域名启用账号；其他域名（如 github.io）自动降级为本地进度
    if (location.hostname !== "pindu-star.app.workbuddy.host") return;
    buildUI();
    showAuth();
    try {
      await loadSDK();
    } catch (e) {
      var n = el("wbCloudNote"); if (n) n.style.display = "block";
      console.warn("[cloud] SDK 不可用，降级本地模式:", e.message);
      return; // 不阻塞 App，本地进度照常
    }
    cloud = window.WorkBuddyCloud.createWorkBuddyCloud(publicConfig);
    wrapSaves();
    cloud.auth.onAuthStateChange(function (event, session) {
      if (event === "SIGNED_OUT") onSignedOut();
    });
    var r = await cloud.auth.getSession();
    if (r.data && r.data.session) { await onSignedIn(r.data.session); }
    else if (r.data && r.data.user) { await onSignedIn(r.data); }
    else { showAuth(); }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
