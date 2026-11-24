/* ============================================================
   SiBlast — lapisan API (fetch ke GAS REST)
   - POST selalu text/plain (hindari preflight CORS GAS)
   - Deduplikasi request baca yang sedang berjalan
   - Retry otomatis untuk baca bila jaringan HP putus sesaat
   ============================================================ */
(function () {
  'use strict';
  var API = (window.API = {});
  var URL_GAS = (window.SIBLAST_CONFIG || {}).GAS_URL;

  var LS = (API.LS = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  });

  function bacaToken() {
    try { return localStorage.getItem('sb_token') || sessionStorage.getItem('sb_token') || ''; } catch (e) { return ''; }
  }
  var token = bacaToken();
  API.hasToken = function () { return !!token; };
  API.setToken = function (t, ingat) {
    token = t || '';
    try {
      localStorage.removeItem('sb_token'); sessionStorage.removeItem('sb_token');
      if (t) (ingat ? localStorage : sessionStorage).setItem('sb_token', t);
    } catch (e) {}
  };
  API.onAuthLost = function () {};

  var BACA = { boot: 1, refresh: 1, listRiwayat: 1, progres: 1 };
  var LAMA = { proses: 75000, kontrol: 60000, uploadLampiran: 90000, importPeserta: 60000, buatKampanye: 60000, login: 30000 };
  var inflight = {};

  function tidur(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function sekali(action, data, ms) {
    var ctl = new AbortController();
    var tm = setTimeout(function () { ctl.abort(); }, ms);
    try {
      var res = await fetch(URL_GAS, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // WAJIB text/plain
        body: JSON.stringify({ action: action, token: token, data: data || {} }),
        signal: ctl.signal
      });
      var j = await res.json();
      return j;
    } finally { clearTimeout(tm); }
  }

  API.call = function (action, data, opt) {
    opt = opt || {};
    var isRead = !!BACA[action];
    var key = isRead ? action + '|' + JSON.stringify(data || {}) : null;
    if (key && inflight[key]) return inflight[key];

    var p = (async function () {
      var ms = LAMA[action] || 30000, percobaan = isRead ? 2 : 1, err;
      for (var i = 0; i < percobaan; i++) {
        try {
          var j = await sekali(action, data, ms);
          if (j && j.auth === false && action !== 'login') { API.onAuthLost(); }
          return j;
        } catch (e) {
          err = e;
          if (i + 1 < percobaan) await tidur(700);
        }
      }
      return { ok: false, network: true, message: (err && err.name === 'AbortError') ? 'Server terlalu lama merespons.' : 'Tidak ada koneksi ke server. Periksa internet Anda.' };
    })();

    if (key) { inflight[key] = p; p.then(function () { delete inflight[key]; }, function () { delete inflight[key]; }); }
    return p;
  };

  /** GET ringan: pemanasan server & konfigurasi publik (login Google). */
  API.get = async function (action) {
    try {
      var r = await fetch(URL_GAS + '?action=' + encodeURIComponent(action));
      return await r.json();
    } catch (e) { return null; }
  };
  API.url = URL_GAS;
})();
