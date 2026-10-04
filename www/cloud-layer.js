/* 拼读星球 · 云端账号与进度同步层
 * 账号：云端邮箱登录（auth.uid 服务端隔离）。进度：云端为主，localStorage 作离线缓存。
 * 仅登录后同步；未登录 / 离线时本地数据照常保存，不丢。
 * 本文件在 account.js 之前加载，挂到 window 上供两处共用。 */
(function () {
  'use strict';

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

  /* 首次登录：把改版前本地账号 fm520571 的进度合并进云端账号 */
  window.__mergeLocalAccount = function () {
    var map = {
      progress: 'pd_u_fm520571_phonics_progress_v1',
      plan_store: 'pd_u_fm520571_phonics_daily_v1',
      checkin: 'pd_u_fm520571_phonics_checkin_v1',
      learn_log: 'pd_u_fm520571_phonics_learnlog_v1',
      settings: 'pd_u_fm520571_phonics_settings_v1'
    };
    var changed = false;
    Object.keys(map).forEach(function (k) {
      var raw = null;
      try { raw = localStorage.getItem(map[k]); } catch (e) {}
      if (!raw) return;
      try {
        var val = JSON.parse(raw);
        if (k === 'settings') { if (val && typeof val === 'object') { Object.assign(settings, val); changed = true; } }
        else if (k === 'progress') { if (val && Object.keys(val).length) { progress = val; changed = true; } }
        else if (k === 'plan_store') { if (val) { planStore = val; changed = true; } }
        else if (k === 'checkin') { if (val) { checkin = val; changed = true; } }
        else if (k === 'learn_log') { if (val) { learnLog = val; changed = true; } }
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
