/* 拼读星球 · 云端账号与进度同步层
 * 账号：云端邮箱登录（auth.uid 服务端隔离）。进度：云端为主，localStorage 作离线缓存。
 * 仅登录后同步；未登录 / 离线时本地数据照常保存，不丢。
 * 本文件在 account.js 之前加载，挂到 window 上供两处共用。
 *
 * 注意：主脚本前有命名空间 shim 把 window.localStorage 替换掉了（键会被加 pd_g_/pd_u_ 前缀）。
 * 读写「旧的本地账号」原始键（pd_u_<user>_*）必须用 window.__pdRaw（原始存储句柄），
 * 经 shim 读写会被二次加前缀而找不到。 */
(function () {
  'use strict';

  /* —— 接收镜像站跳转带来的本机进度（#import=base64）——
     镜像站（GitHub Pages）上云端 API 因跨域不可用，head 内脚本会把 pd_u_* 旧账号数据
     打包到 hash 跳转过来；此处用 __pdRaw 写回本源（不覆盖已有键），随后清掉 hash。 */
  try {
    var mImp = /[#&]import=([^&]+)/.exec(location.hash || "");
    if (mImp) {
      var raw = window.__pdRaw;
      if (raw) {
        var json = decodeURIComponent(escape(window.atob(decodeURIComponent(mImp[1]))));
        var data = JSON.parse(json);
        Object.keys(data).forEach(function (k) {
          if (k.indexOf("pd_u_") !== 0 && k !== "pd_sys_cur") return;
          if (data[k] == null) return;
          try { if (raw.getItem(k) === null) raw.setItem(k, data[k]); } catch (e) {}
        });
      }
      try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    }
  } catch (e) {}

  window.__PD_CLOUD = {
    endpoint: 'https://pindu-star.app.workbuddy.host',
    publishableKey: 'wbpk_PrJdeZz41HRwydQR72S9Gv_j7b2FnNuLlMyU1z2KiKFmJ8PkcDP57XH'
  };
  window.__cloud = null;
  window.__cloudReady = false;
  window.__cloudRow = null;

  window.__initCloud = function () {
    if (window.__cloud) return true;
    if (!window.WorkBuddyCloud) return false;
    try {
      window.__cloud = WorkBuddyCloud.createWorkBuddyCloud({
        endpoint: window.__PD_CLOUD.endpoint,
        publishableKey: window.__PD_CLOUD.publishableKey
      });
      return true;
    } catch (e) { console.warn('[cloud] init', e); return false; }
  };

  /* 保存当前内存进度到云端（fire-and-forget，不阻塞 UI） */
  window.__pdCloudSave = function () {
    var c = window.__cloud;
    if (!c || !window.__cloudReady) return;
    var payload = {
      progress: progress, plan_store: planStore, checkin: checkin,
      learn_log: learnLog, settings: settings
    };
    try {
      if (window.__cloudRow && window.__cloudRow.id) {
        c.database.from('user_data').update(payload).eq('id', window.__cloudRow.id).select()
          .then(function (r) { if (r.error) console.warn('[cloud] save', r.error); })
          .catch(function (e) { console.warn('[cloud] save', e); });
      } else {
        c.database.from('user_data').insert(payload).select()
          .then(function (r) {
            if (r.error) console.warn('[cloud] insert', r.error);
            else if (r.data && r.data[0]) window.__cloudRow = r.data[0];
          })
          .catch(function (e) { console.warn('[cloud] insert', e); });
      }
    } catch (e) { console.warn('[cloud] save', e); }
  };

  /* 从云端拉取本账号进度，覆盖本地（云端权威） */
  window.__pdCloudLoad = function () {
    var c = window.__cloud;
    if (!c || !window.__cloudReady) return Promise.resolve(null);
    return c.database.from('user_data').select('*').maybeSingle()
      .then(function (r) {
        if (r.error) { console.warn('[cloud] load', r.error); return null; }
        var d = r.data; window.__cloudRow = d;
        if (d) {
          if (d.progress && typeof d.progress === 'object') progress = d.progress;
          if (d.plan_store && typeof d.plan_store === 'object') planStore = d.plan_store;
          if (d.checkin && typeof d.checkin === 'object') checkin = d.checkin;
          if (d.learn_log && typeof d.learn_log === 'object') learnLog = d.learn_log;
          if (d.settings && typeof d.settings === 'object') Object.assign(settings, d.settings);
          saveProgress(); savePlanStore(); saveCheckin(); saveLearnLog(); saveSettings();
        }
        return d;
      })
      .catch(function (e) { console.warn('[cloud] load', e); return null; });
  };

  /* 首次登录：把改版前本地账号的进度合并进云端账号。
     直接用 __pdRaw 读原始 pd_u_<user>_* 键（shim 会二次加前缀，不能走 window.localStorage）。 */
  var MERGE_KEYS = {
    progress: 'phonics_progress_v1', plan_store: 'phonics_daily_v1',
    checkin: 'phonics_checkin_v1', learn_log: 'phonics_learnlog_v1',
    settings: 'phonics_settings_v1', ruleprog: 'phonics_ruleprog_v1',
    autoprog: 'phonics_autoprog_v1', notes: 'phonics_notes_v1'
  };
  window.__mergeLocalAccount = function () {
    var raw = window.__pdRaw;
    if (!raw) return false;
    var acct = null;
    try { acct = raw.getItem('pd_sys_cur'); } catch (e) {}
    if (!acct) acct = 'fm520571';
    var changed = false;
    Object.keys(MERGE_KEYS).forEach(function (k) {
      var val = null;
      try { val = raw.getItem('pd_u_' + acct + '_' + MERGE_KEYS[k]); } catch (e) {}
      if (!val) return;
      try {
        var v = JSON.parse(val);
        if (k === 'settings') { if (v && typeof v === 'object') { Object.assign(settings, v); changed = true; } }
        else if (k === 'progress') { if (v && Object.keys(v).length) { progress = v; changed = true; } }
        else if (k === 'plan_store') { if (v) { planStore = v; changed = true; } }
        else if (k === 'checkin') { if (v) { checkin = v; changed = true; } }
        else if (k === 'learn_log') { if (v) { learnLog = v; changed = true; } }
        else if (k === 'ruleprog') { if (v && Object.keys(v).length) { ruleProg = v; saveRuleProg(); changed = true; } }
        else if (k === 'autoprog') { if (v && Object.keys(v).length) { autoProg = v; saveAutoProg(); changed = true; } }
        else if (k === 'notes') { if (v && Object.keys(v).length) { notes = v; try { localStorage.setItem('phonics_notes_v1', JSON.stringify(v)); } catch (e) {} changed = true; } }
      } catch (e) {}
    });
    return changed;
  };

  /* account.js 登录成功后调用：拉取云端覆盖本地；若云端空则合并旧本地账号 */
  window.__pdOnLogin = function (email) {
    if (!window.__initCloud()) return;
    window.__cloud.auth.getSession().then(function (s) {
      if (!s || s.error || !s.data) return;
      window.__cloudReady = true;
      window.__pdCloudLoad().then(function (d) {
        if (!d) {
          if (window.__mergeLocalAccount()) {
            saveProgress(); savePlanStore(); saveCheckin(); saveLearnLog(); saveSettings();
          }
          window.__pdCloudSave();
        }
        if (typeof render === 'function') render();
      });
    }).catch(function (e) { console.warn('[cloud] session', e); });
  };

  window.__pdOnLogout = function () {
    window.__cloudReady = false; window.__cloudRow = null;
  };
})();
