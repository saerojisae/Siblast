/* ============================================================
   SiBlast — logika aplikasi (SPA)
   Prinsip kecepatan:
   1) Navigasi antar menu 100% di sisi klien (tanpa jaringan)
   2) Data awal dari cache lokal -> tampil instan, lalu sinkron di latar
   3) Optimistic UI: tambah/ubah/hapus langsung terlihat, server menyusul
   4) Satu panggilan "boot" memuat semua data awal
   ============================================================ */
(function () {
  'use strict';
  var SB = window.SB, S = SB.S, PG = SB.PG, V = SB.V, API = window.API;
  var $ = SB.$, $$ = SB.$$, esc = SB.esc, ic = SB.ic, toast = SB.toast, sleep = SB.sleep;
  var ROUTES = ['dashboard', 'peserta', 'template', 'broadcast', 'progres', 'riwayat', 'pengaturan', 'agenda'];
  var ACT = {}, IN = {}, CH = {};
  var pending = 0; // jumlah operasi tulis yang belum dikonfirmasi server

  /* ---------- simpan lokal ---------- */
  var tPersist;
  function persist() {
    clearTimeout(tPersist);
    tPersist = setTimeout(function () {
      API.LS.set('sb_data', { user: S.user, settings: S.settings, rahasia: S.rahasia, peserta: S.peserta, template: S.template, kampanye: S.kampanye, agenda: S.agenda, v: SB.versi });
    }, 250);
  }
  function jeda(fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); }; }

  /* ---------- routing ---------- */
  function cur() {
    var h = location.hash.replace(/^#\/?/, ''), p = h.split('?');
    return { r: ROUTES.indexOf(p[0]) > -1 ? p[0] : 'dashboard', q: new URLSearchParams(p[1] || '') };
  }
  var lastRoute = '';
  function setPG(id) { PG.id = id; PG.muat = null; PG.rows = {}; PG.hitung = null; PG.wait = 0; PG.filter = 'semua'; }
  function pgDefault() {
    var a = SB.kampanyeAktif();
    if (a) return a.id;
    var k = S.kampanye.slice().sort(function (x, y) { return x.waktu_mulai < y.waktu_mulai ? 1 : -1; })[0];
    return k ? k.id : null;
  }
  function render() {
    if (!S.loggedIn) return;
    var c = cur(); S.route = c.r;
    if (c.r === 'progres') {
      var id = c.q.get('id');
      if (id && id !== PG.id) setPG(id); else if (!PG.id || !S.kampanye.some(function (k) { return k.id === PG.id; })) setPG(pgDefault());
    }
    if (!S.loaded) { $('#view').innerHTML = '<div class="skel" style="height:60px"></div><div class="skel" style="height:220px"></div><div class="skel" style="height:300px"></div>'; navSet(); return; }
    if (c.r === 'agenda') agDefault();
    $('#view').innerHTML = V[c.r]();
    if (lastRoute !== c.r) { $('#main').scrollTop = 0; lastRoute = c.r; }
    navSet(); chip();
    if (c.r === 'riwayat') { ensureRiwayat(); if (S.rw.tab === 'ag') ensureLogAgenda(); }
    if (c.r === 'progres') ensureProgres();
  }
  function renderKeep() {
    if (SB.modalOpen()) return;
    var a = document.activeElement;
    if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && $('#view').contains(a)) return;
    var m = $('#main'), st = m.scrollTop;
    $('#view').innerHTML = V[S.route]();
    m.scrollTop = st; chip();
  }
  function navSet() {
    var r = S.route === 'progres' ? 'broadcast' : S.route;
    $$('[data-r]').forEach(function (a) { if (a.tagName === 'A') a.classList.toggle('on', a.getAttribute('data-r') === r); });
  }
  function go(r) { if (location.hash === '#/' + r) render(); else location.hash = '#/' + r; }
  window.addEventListener('hashchange', render);

  /* ---------- tampilan dasar ---------- */
  function showLogin(pesan) {
    S.loggedIn = false;
    document.body.classList.add('guest');
    $('#app').classList.add('hide'); $('#login').classList.remove('hide');
    $('#login').innerHTML = V.login();
    if (pesan) { var e = $('#lgErr'); e.textContent = pesan; e.classList.remove('hide'); }
    var pub = API.LS.get('sb_pub');
    if (pub && pub.googleClientId) initGoogle(pub.googleClientId);
    API.get('publicConfig').then(function (r) { if (r && r.ok) { API.LS.set('sb_pub', { googleClientId: r.googleClientId }); if (r.googleClientId && !(pub && pub.googleClientId === r.googleClientId)) initGoogle(r.googleClientId); } });
  }
  function showApp() {
    S.loggedIn = true;
    document.body.classList.remove('guest');
    $('#login').classList.add('hide'); $('#app').classList.remove('hide');
    sinkronHeader();
  }
  function sinkronHeader() {
    var n = S.user.nama || 'Admin';
    $('#meNama').textContent = n; $('#meAva').textContent = SB.inisial(n);
    updateGw(); updateBell();
  }
  function updateGw() {
    var ok = S.gw ? S.gw.terhubung : !!(S.rahasia && S.rahasia.tokenAda);
    var b = $('#gwBadge');
    b.className = 'badge ' + (ok ? 'b-ok' : 'b-fail');
    b.innerHTML = '<i></i>' + (S.gw ? (S.gw.terhubung ? 'Terhubung' : 'Terputus') : (ok ? 'Token siap' : 'Belum diatur'));
    $('#gwSub').textContent = ok ? 'Gateway Aktif' : 'Isi token di Pengaturan';
  }
  function updateBell() { $('#bellDot').classList.toggle('hide', !(SB.ringkas().gagal > 0)); }
  function chip() {
    var a = SB.kampanyeAktif(), el = $('#sendChip');
    if (!a) { el.innerHTML = ''; return; }
    var d = a.terkirim + a.gagal;
    el.innerHTML = '<span class="chip-send" data-act="bukaProgres" data-id="' + esc(a.id) + '"><i></i>' + (a.status === 'Berjalan' ? 'Mengirim ' : (a.status === 'Dijeda' ? 'Dijeda ' : 'Terjadwal ')) + d + '/' + a.total + '</span>';
  }

  /* ---------- data awal ---------- */
  function terapkan(r) {
    if (r.user) S.user = r.user;
    if (r.settings) S.settings = r.settings;
    if (r.rahasia) S.rahasia = r.rahasia;
    if (r.peserta) S.peserta = r.peserta;
    if (r.template) S.template = r.template;
    if (r.kampanye) S.kampanye = r.kampanye;
    if (r.agenda) S.agenda = r.agenda;
    if (r.v) SB.versi = r.v;
    S.loaded = true;
    persist(); sinkronHeader();
  }
  async function boot(pertama) {
    var r = await API.call('boot');
    if (!r.ok) {
      if (r.auth === false) return;
      if (!S.loaded) { $('#view').innerHTML = '<div class="card">' + SB.emptyBox('cloud_off', 'Tidak bisa memuat data', r.message || 'Periksa koneksi internet lalu coba lagi.', '<button class="btn p" data-act="muatUlang">' + ic('refresh') + 'Coba Lagi</button>') + '</div>'; }
      else if (!pertama) toast(r.message || 'Gagal menyinkronkan', 'warn');
      return;
    }
    var sudahTampil = S.loaded;
    terapkan(r);
    if (sudahTampil) renderKeep(); else render();
    kickDriver();
    if (window.requestIdleCallback) requestIdleCallback(function () { prefetchRiwayat(); }); else setTimeout(prefetchRiwayat, 1500);
  }
  async function segarkan(senyap) {
    if (pending > 0 || !S.loggedIn) return;
    var r = await API.call('refresh');
    if (!r.ok || pending > 0) { if (!r.ok && !senyap) toast(r.message || 'Gagal menyegarkan', 'warn'); return; }
    var aktif = DR.running;
    terapkan(Object.assign({}, r, aktif ? { kampanye: null } : {}));
    renderKeep(); kickDriver();
  }
  function ensureLogAgenda() {
    if (S.logAg === null) { var c = API.LS.get('sb_rwa'); if (c) S.logAg = c; }
    if (S.logAg === null || S.logAgBasi) {
      API.call('listLogAgenda').then(function (r) {
        if (!r.ok) return;
        S.logAg = r.rows; S.logAgBasi = false; API.LS.set('sb_rwa', r.rows.slice(-1500));
        if (S.route === 'riwayat' && S.rw.tab === 'ag') { var t = $('#rwaTbl'); if (t) renderKeep(); }
      });
    }
  }
  function prefetchRiwayat() { if (S.riwayat === null) ensureRiwayat(true); }
  function ensureRiwayat(senyap) {
    if (S.riwayat === null) { var c = API.LS.get('sb_riw'); if (c) S.riwayat = c; }
    if (S.riwayat === null || S.riwayatBasi) {
      API.call('listRiwayat').then(function (r) {
        if (!r.ok) return;
        S.riwayat = r.rows; S.riwayatBasi = false; API.LS.set('sb_riw', r.rows.slice(-1500));
        if (S.route === 'riwayat') { var t = $('#rwTbl'); if (t) t.innerHTML = V.rwTable(); }
      });
    }
  }

  /* ---------- pengiriman: pengendali di sisi klien ---------- */
  var DR = { running: false, id: null };
  function applyProg(r, penuh) {
    var i = -1;
    S.kampanye.forEach(function (x, n) { if (x.id === r.k.id) i = n; });
    if (i > -1) S.kampanye[i] = r.k; else S.kampanye.push(r.k);
    if (PG.id === r.k.id) {
      PG.hitung = r.hitung; PG.batch = r.batch || PG.batch; PG.wait = r.tunggu || 0;
      if (penuh && r.rows) { PG.rows = {}; r.rows.forEach(function (x) { PG.rows[x.id] = x; }); }
      (r.log || []).forEach(function (x) { PG.rows[x.id] = Object.assign(PG.rows[x.id] || {}, x); });
    }
    S.riwayatBasi = true;
    persist(); chip(); updateBell();
    if (S.route === 'progres' || S.route === 'dashboard') renderKeep();
  }
  function ensureProgres() {
    if (!PG.id || PG.muat === PG.id) return;
    PG.muat = PG.id;
    var id = PG.id;
    API.call('progres', { id: id, penuh: true }).then(function (r) {
      if (r.ok && PG.id === id) { applyProg(r, true); kickDriver(); }
    });
  }
  function kickDriver() {
    var a = SB.kampanyeAktif();
    if (a && !DR.running) drive(a.id);
  }
  async function hitung(detik, id) {
    for (var s = detik; s > 0; s--) {
      PG.wait = s;
      var el = $('#pgWait'); if (el) el.textContent = s;
      await sleep(1000);
      var k = S.kampanye.filter(function (x) { return x.id === id; })[0];
      if (!k || k.status !== 'Berjalan' && k.status !== 'Terjadwal') break;
    }
    PG.wait = 0;
  }
  async function drive(id) {
    if (DR.running) return;
    DR.running = true; DR.id = id;
    var gagalBeruntun = 0;
    try {
      while (S.loggedIn) {
        var k = S.kampanye.filter(function (x) { return x.id === id; })[0];
        if (!k) break;
        if (k.status === 'Dijeda') {
          await sleep(5000);
          var p = await API.call('progres', { id: id });
          if (p.ok) applyProg(p, false); else if (p.auth === false) break;
          continue;
        }
        if (k.status !== 'Berjalan' && k.status !== 'Terjadwal') break;
        var r = await API.call('proses', { id: id });
        if (!r.ok) {
          if (r.auth === false) break;
          if (++gagalBeruntun > 6) { toast('Koneksi terputus. Server tetap melanjutkan pengiriman.', 'warn'); break; }
          await sleep(4000); continue;
        }
        gagalBeruntun = 0;
        applyProg(r, false);
        var w = r.tunggu || 0;
        if (r.sibuk) w = Math.max(w, 3);
        if (r.k.status === 'Terjadwal') w = Math.max(Math.min(w, 15), 12);
        if (r.k.status === 'Selesai') { toast('Broadcast "' + r.k.judul + '" selesai: ' + r.k.terkirim + ' terkirim, ' + r.k.gagal + ' gagal.', r.k.gagal ? 'warn' : 'ok'); }
        if (w > 0) await hitung(w, id); else await sleep(250);
      }
    } finally { DR.running = false; chip(); if (S.route === 'progres') renderKeep(); }
  }

  /* ---------- login ---------- */
  function initGoogle(clientId) {
    if (!clientId || !$('#lgGoogle')) return;
    var mulai = function () {
      if (!window.google || !$('#lgGoogle')) return;
      window.google.accounts.id.initialize({ client_id: clientId, callback: function (resp) { masukGoogle(resp.credential); } });
      $('#lgGoogleWrap').classList.remove('hide');
      window.google.accounts.id.renderButton($('#lgGoogle'), { theme: 'outline', size: 'large', width: 360, text: 'signin_with', locale: 'id' });
    };
    if (window.google && window.google.accounts) return mulai();
    if (document.getElementById('gsi')) return;
    var s = document.createElement('script'); s.id = 'gsi'; s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = mulai; document.head.appendChild(s);
  }
  async function selesaiMasuk(r, ingat) {
    API.setToken(r.token, ingat);
    S.user = { nama: r.nama }; S.loaded = false;
    showApp(); location.hash = '#/dashboard'; render();
    await boot(true);
  }
  async function masukGoogle(cred) {
    var r = await API.call('loginGoogle', { credential: cred });
    if (!r.ok) { var e = $('#lgErr'); if (e) { e.textContent = r.message; e.classList.remove('hide'); } return; }
    selesaiMasuk(r, true);
  }
  document.addEventListener('submit', async function (e) {
    if (e.target.id !== 'loginForm') return;
    e.preventDefault();
    var btn = $('#lgBtn'), err = $('#lgErr');
    btn.disabled = true; btn.innerHTML = 'Memeriksa…'; err.classList.add('hide');
    var r = await API.call('login', { username: $('#lgUser').value, password: $('#lgPass').value });
    if (!r.ok) { err.textContent = r.message; err.classList.remove('hide'); btn.disabled = false; btn.innerHTML = 'Masuk ke Dashboard ' + ic('arrow_forward'); return; }
    selesaiMasuk(r, $('#lgIngat').checked);
  });
  function keluar() {
    API.call('logout').catch(function () {});
    API.setToken('');
    ['sb_data', 'sb_riw', 'sb_rwa'].forEach(API.LS.del);
    S.loaded = false; S.riwayat = null; S.logAg = null; S.logAgBasi = true; S.peserta = []; S.template = []; S.kampanye = []; S.agenda = []; S.gw = null; setPG(null);
    showLogin();
  }
  API.onAuthLost = function () { if (S.loggedIn) { API.setToken(''); showLogin('Sesi berakhir, silakan masuk lagi.'); } };

  /* ============================ AKSI (klik) ============================ */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el) { var mn = $('#meMenu'); if (mn) mn.classList.add('hide'); return; }
    var n = el.getAttribute('data-act');
    if (n === 'modalMask') { if (e.target === el) SB.closeModal(); return; }
    if (ACT[n]) { if (el.tagName === 'A') e.preventDefault(); ACT[n](el, e); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && SB.modalOpen()) SB.closeModal(); });

  ACT.go = function (el) { go(el.getAttribute('data-r')); };
  ACT.tutup = function () { SB.closeModal(); };
  ACT.muatUlang = function () { boot(true); };
  ACT.logout = function () { keluar(); };
  ACT.meMenu = function (el, e) { if (e.target.closest('#meMenu')) return; $('#meMenu').classList.toggle('hide'); };
  ACT.goPengaturan = function () { $('#meMenu').classList.add('hide'); go('pengaturan'); };
  ACT.bell = function () {
    if (SB.ringkas().gagal > 0) { S.rw.status = 'Gagal'; S.rw.page = 1; go('riwayat'); toast('Menampilkan pesan yang gagal terkirim', 'info'); }
    else toast('Tidak ada notifikasi baru', 'info');
  };
  ACT.lupaSandi = function () {
    SB.modal('<div class="mh"><div class="mi">' + ic('lock_reset', 'lg') + '</div><div><h3>Lupa kata sandi?</h3></div></div><div class="mb"><p style="line-height:22px;color:var(--text3)">Buka editor Google Apps Script proyek SiBlast, pilih fungsi <b>resetAdmin</b>, lalu klik <b>Jalankan</b>. Username dan kata sandi baru akan tampil di <b>Execution log</b>.</p></div><div class="mf"><button class="btn p" data-act="tutup">Mengerti</button></div>', { cls: 'sm', noFocus: true });
  };
  ACT.lihatSandi = function (el) { var i = $('#lgPass'); i.type = i.type === 'password' ? 'text' : 'password'; el.textContent = i.type === 'password' ? 'visibility' : 'visibility_off'; };
  ACT.lihatToken = function (el) { var i = $('#stToken'); i.type = i.type === 'password' ? 'text' : 'password'; el.textContent = i.type === 'password' ? 'visibility' : 'visibility_off'; };
  ACT.segarkan = async function () { toast('Menyinkronkan data…', 'info'); await segarkan(false); toast('Data diperbarui'); };
  ACT.cekGateway = function () { ACT.tesKoneksi(); };
  ACT.bukaProgres = function (el) { var id = el.getAttribute('data-id'); setPG(id); location.hash = '#/progres?id=' + encodeURIComponent(id); if (S.route === 'progres') render(); };
  ACT.ekspor = function () {
    var rows = [['Kampanye', 'Penerima', 'Mulai', 'Total', 'Terkirim', 'Gagal', 'Status']].concat(S.kampanye.map(function (k) { return [k.judul, k.grup_target, k.waktu_mulai, k.total, k.terkirim, k.gagal, k.status]; }));
    SB.unduhTeks('kampanye-siblast.csv', SB.csv(rows)); toast('Data kampanye diunduh');
  };
  ACT.ulangGagal = async function (el) {
    var id = el.getAttribute('data-id');
    if (!await SB.confirm('Kirim ulang yang gagal?', 'Hanya pesan yang gagal yang akan dikirim lagi.', 'Ya, kirim ulang')) return;
    setPG(id);
    var r = await API.call('kontrol', { id: id, aksi: 'ulang' });
    if (!r.ok) return toast(r.message, 'err');
    applyProg(r, true); location.hash = '#/progres?id=' + encodeURIComponent(id); kickDriver();
  };

  /* ---------- Peserta ---------- */
  IN.pesQ = jeda(function (t) { S.pes.q = t.value; S.pes.page = 1; $('#pesTbl').innerHTML = V.pesTable(); }, 80);
  CH.pesGrup = function (t) { S.pes.grup = t.value; S.pes.page = 1; $('#pesTbl').innerHTML = V.pesTable(); };
  CH.pesStatus = function (t) { S.pes.status = t.value; S.pes.page = 1; $('#pesTbl').innerHTML = V.pesTable(); };
  ACT.pesHal = function (el) { S.pes.page = +el.getAttribute('data-p') || 1; $('#pesTbl').innerHTML = V.pesTable(); };
  function selUI() {
    var n = Object.keys(S.pes.sel).length, b = $('#pesHapusSel');
    if (b) { b.classList.toggle('hide', !n); b.innerHTML = ic('delete', 'sm') + 'Hapus Terpilih (' + n + ')'; }
  }
  CH.pesSel = function (t) { var id = t.getAttribute('data-id'); if (t.checked) S.pes.sel[id] = 1; else delete S.pes.sel[id]; selUI(); };
  CH.pesSelAll = function (t) {
    var list = SB.pesFiltered().slice((S.pes.page - 1) * 10, S.pes.page * 10);
    list.forEach(function (p) { if (t.checked) S.pes.sel[p.id] = 1; else delete S.pes.sel[p.id]; });
    $('#pesTbl').innerHTML = V.pesTable(); selUI();
  };
  ACT.pesTambah = function () { SB.modal(V.modalPeserta()); };
  ACT.pesEdit = function (el) { var p = S.peserta.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0]; if (p) SB.modal(V.modalPeserta(p)); };
  function normNo(raw) {
    var s = String(raw === null || raw === undefined ? '' : raw).replace(/[^\d+]/g, '');
    if (s.charAt(0) === '+') s = s.slice(1);
    if (s.indexOf('0') === 0) s = '62' + s.slice(1); else if (s.indexOf('8') === 0) s = '62' + s;
    return s;
  }
  function emailOk(s) { return /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/.test(s); }
  function noValid(s) { return /^628\d{8,12}$/.test(s); }
  ACT.pesSimpan = async function (el) {
    var id = el.getAttribute('data-id'), err = $('#pmErr');
    var d = { id: id || undefined, nama: $('#pmNama').value.trim(), nomor: normNo($('#pmNomor').value), grup: $('#pmGrup').value.trim() || 'Umum', status: $('#pmStatus').value, email: ($('#pmEmail').value || '').trim().toLowerCase() };
    var tampilErr = function (m) { err.textContent = m; err.classList.remove('hide'); };
    if (!noValid(d.nomor)) return tampilErr('Nomor WA tidak valid. Contoh: 081234567890');
    if (d.email && !emailOk(d.email)) return tampilErr('Format email tidak valid. Contoh: budi@gmail.com');
    if (S.peserta.some(function (p) { return p.nomor === d.nomor && p.id !== id; })) return tampilErr('Nomor ini sudah terdaftar.');
    var prev = S.peserta.slice(), tmp = id || 'tmp_' + Date.now();
    var item = Object.assign({ dibuat: new Date().toISOString() }, d, { id: tmp });
    if (id) S.peserta = S.peserta.map(function (p) { return p.id === id ? Object.assign({}, p, item) : p; }); else S.peserta = S.peserta.concat([item]);
    SB.closeModal(); S.pes.page = id ? S.pes.page : Math.ceil(S.peserta.length / 10); render(); toast(id ? 'Peserta diperbarui' : 'Peserta ditambahkan');
    pending++;
    var r = await API.call('simpanPeserta', d); pending--;
    if (!r.ok) { S.peserta = prev; render(); toast(r.message || 'Gagal menyimpan peserta', 'err'); return; }
    S.peserta = S.peserta.map(function (p) { return p.id === tmp ? r.item : p; }); persist();
  };
  async function hapusPeserta(ids, pesan) {
    if (!await SB.confirm('Hapus peserta?', pesan, 'Hapus', true)) return;
    var prev = S.peserta.slice(), set = {}; ids.forEach(function (i) { set[i] = 1; });
    S.peserta = S.peserta.filter(function (p) { return !set[p.id]; }); S.pes.sel = {};
    render(); toast(ids.length + ' peserta dihapus'); pending++;
    var r = await API.call('hapusPeserta', { ids: ids.filter(function (i) { return i.indexOf('tmp_') !== 0; }) }); pending--;
    if (!r.ok) { S.peserta = prev; render(); toast(r.message || 'Gagal menghapus', 'err'); } else persist();
  }
  ACT.pesHapus = function (el) { var p = S.peserta.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0]; if (p) hapusPeserta([p.id], 'Peserta "' + (p.nama || p.nomor) + '" akan dihapus permanen.'); };
  ACT.pesHapusSel = function () { var ids = Object.keys(S.pes.sel); if (ids.length) hapusPeserta(ids, ids.length + ' peserta terpilih akan dihapus permanen.'); };
  ACT.unduhFormat = function () { SB.unduhTeks('format-peserta-siblast.csv', SB.csv([['nama', 'nomor', 'grup', 'email'], ['Budi Santoso', '081234567890', 'Webinar AI', 'budi@gmail.com'], ['Siti Rahma', '082198765432', 'Umum', 'siti@gmail.com']])); toast('Format CSV diunduh'); };

  /* ---------- Impor peserta ---------- */
  var IMP = {};
  function parseCsv(text) {
    var first = text.split(/\r?\n/)[0] || '', delim = (first.split('\t').length > 1) ? '\t' : (first.split(';').length > first.split(',').length ? ';' : ',');
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  function jadiBaris(aoa) {
    aoa = aoa.filter(function (r) { return r.some(function (c) { return String(c === null || c === undefined ? '' : c).trim(); }); });
    if (!aoa.length) return [];
    var f = aoa[0].map(function (c) { return String(c || '').trim().toLowerCase(); });
    var cari = function (re) { for (var i = 0; i < f.length; i++) if (re.test(f[i])) return i; return -1; };
    var iE = cari(/(e-?mail|surel)/), iN = cari(/^(nama|name)/), iP = cari(/(nomor|^no\.?$|^hp|wa$|whatsapp|telepon|phone|^tel)/), iG = cari(/(grup|group|segmen|kelas|kategori)/);
    var data = aoa, header = iN > -1 || iP > -1 || iE > -1;
    if (header) data = aoa.slice(1);
    var hpLike = function (v) { var s = String(v || '').trim(); return /^[\d\s+\-().]+$/.test(s) && s.replace(/\D/g, '').length >= 8; };
    if (iP < 0) {
      var ncol = Math.max.apply(null, aoa.map(function (r) { return r.length; })), best = -1, bc = 0;
      for (var c = 0; c < ncol; c++) { var cnt = data.filter(function (r) { return hpLike(r[c]); }).length; if (cnt > bc) { bc = cnt; best = c; } }
      iP = best;
    }
    if (iE < 0) {   // tanpa header email: cari kolom yang isinya paling banyak berformat email
      var nc = Math.max.apply(null, aoa.map(function (r) { return r.length; })), be = -1, bn = 0;
      for (var e = 0; e < nc; e++) { var ce = data.filter(function (r) { return emailOk(String(r[e] || '').trim()); }).length; if (ce > bn) { bn = ce; be = e; } }
      iE = be;
    }
    if (iP < 0) return [];
    var sisa = []; for (var j = 0; j < Math.max.apply(null, aoa.map(function (r) { return r.length; })); j++) if (j !== iP && j !== iE) sisa.push(j);
    if (iN < 0) iN = sisa[0] !== undefined ? sisa[0] : -1;
    if (iG < 0) { iG = sisa.filter(function (x) { return x !== iN; })[0]; if (iG === undefined) iG = -1; }
    return data.map(function (r) { return { nama: iN > -1 ? String(r[iN] || '').trim() : '', nomor: r[iP], grup: iG > -1 ? String(r[iG] || '').trim() : '', email: iE > -1 ? String(r[iE] || '').trim().toLowerCase() : '' }; });
  }
  function periksaImpor(rows, namaFile) {
    var ada = {}; S.peserta.forEach(function (p) { ada[p.nomor] = p; });
    var valid = [], upd = [], dup = 0, bad = 0;
    rows.forEach(function (r) {
      var no = normNo(r.nomor), em = emailOk(r.email || '') ? r.email : '';
      if (!noValid(no)) { bad++; return; }
      if (ada[no]) {
        dup++;
        if (ada[no].id && !ada[no].email && em) { upd.push({ nama: r.nama, nomor: no, grup: r.grup, email: em }); ada[no] = Object.assign({}, ada[no], { email: em }); }   // lengkapi email peserta lama
        return;
      }
      ada[no] = { email: em }; valid.push({ nama: r.nama, nomor: no, grup: r.grup, email: em });
    });
    IMP.updList = upd; IMP.upd = upd.length;
    IMP.rows = rows; IMP.valid = valid.length; IMP.dup = dup; IMP.bad = bad; IMP.list = valid; IMP.contoh = valid.slice(0, 2); IMP.namaFile = namaFile;
    IMP.grup = ($('#impGrup') || {}).value || IMP.grup || 'Umum';
    SB.modal(V.modalImport(IMP), { noFocus: true });
  }
  ACT.importBuka = function () { IMP = { tab: 'file', grup: 'Umum' }; SB.modal(V.modalImport(IMP), { noFocus: true }); };
  ACT.impTab = function (el) { IMP.grup = ($('#impGrup') || {}).value || IMP.grup; IMP.tab = el.getAttribute('data-t'); IMP.rows = null; IMP.valid = 0; SB.modal(V.modalImport(IMP), { noFocus: true }); };
  ACT.pilihFile = function () { var f = $('#fileImp'); if (f) f.click(); };
  async function bacaFile(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast('Ukuran file maksimal 5 MB', 'err');
    try {
      var aoa;
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        toast('Membaca file Excel…', 'info');
        var X = await SB.muatXLSX(), wb = X.read(await file.arrayBuffer(), { type: 'array' });
        aoa = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
      } else aoa = parseCsv(await file.text());
      var rows = jadiBaris(aoa);
      if (!rows.length) return toast('Tidak ada data nomor WhatsApp yang terbaca. Pastikan ada kolom nomor.', 'err');
      if (rows.length > 5000) { toast('Maksimal 5000 baris per impor — hanya 5000 pertama dibaca.', 'warn'); rows = rows.slice(0, 5000); }
      periksaImpor(rows, file.name + ' (' + Math.round(file.size / 1024) + ' KB)');
    } catch (err) { toast(err.message || 'File gagal dibaca', 'err'); }
  }
  CH.fileImp = function (t) { bacaFile(t.files[0]); };
  document.addEventListener('dragover', function (e) { var z = e.target.closest && e.target.closest('#dropZone'); if (z) { e.preventDefault(); z.classList.add('over'); } });
  document.addEventListener('dragleave', function (e) { var z = e.target.closest && e.target.closest('#dropZone'); if (z) z.classList.remove('over'); });
  document.addEventListener('drop', function (e) { var z = e.target.closest && e.target.closest('#dropZone'); if (z) { e.preventDefault(); z.classList.remove('over'); bacaFile(e.dataTransfer.files[0]); } });
  ACT.bacaPaste = function () {
    var t = ($('#pasteImp').value || '').trim();
    if (!t) return toast('Tempel data dari Sheets terlebih dahulu', 'warn');
    var rows = jadiBaris(parseCsv(t));
    if (!rows.length) return toast('Tidak ada nomor WhatsApp yang terbaca', 'err');
    var teks = $('#pasteImp').value; IMP.tab = 'paste';
    periksaImpor(rows.slice(0, 5000), 'Data tempel (' + rows.length + ' baris)');
    var ta = $('#pasteImp'); if (ta) ta.value = teks;
  };
  ACT.impSimpan = async function () {
    var list = IMP.list || [], updList = IMP.updList || [];
    if (!list.length && !updList.length) return;
    var grup = ($('#impGrup').value || 'Umum').trim() || 'Umum', rows = list.map(function (r) { return { nama: r.nama, nomor: r.nomor, grup: r.grup || grup, email: r.email || '' }; });
    var emailBaru = {}; updList.forEach(function (u) { emailBaru[u.nomor] = u.email; });
    var prev = S.peserta.slice(), now = new Date().toISOString();
    var tmp = rows.map(function (r, i) { return { id: 'tmp_' + Date.now() + '_' + i, nama: r.nama, nomor: r.nomor, grup: r.grup, status: 'Aktif', dibuat: now, email: r.email }; });
    rows = rows.concat(updList.map(function (u) { return { nama: u.nama, nomor: u.nomor, grup: u.grup || grup, email: u.email }; }));
    S.peserta = S.peserta.map(function (p) { return emailBaru[p.nomor] && !p.email ? Object.assign({}, p, { email: emailBaru[p.nomor] }) : p; }).concat(tmp); SB.closeModal(); render(); toast(rows.length + ' peserta diimpor, menyimpan ke Sheets…', 'info'); pending++;
    var r = await API.call('importPeserta', { rows: rows, grup: grup }); pending--;
    if (!r.ok) { S.peserta = prev; render(); return toast(r.message || 'Impor gagal', 'err'); }
    var tmpIds = {}; tmp.forEach(function (t) { tmpIds[t.id] = 1; });
    S.peserta = S.peserta.filter(function (p) { return !tmpIds[p.id]; }).concat(r.items); persist(); render();
    toast(r.ditambah + ' peserta tersimpan' + (r.diperbarui ? ', ' + r.diperbarui + ' email dilengkapi' : '') + (r.duplikat - (r.diperbarui || 0) > 0 ? ', ' + (r.duplikat - r.diperbarui) + ' duplikat dilewati' : ''));
  };

  /* ---------- Agenda ---------- */
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function keLokal(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + 'T' + p2(d.getHours()) + ':' + p2(d.getMinutes()); }
  function agDefault() {
    if (S.ag.mulai) return;
    var d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); S.ag.mulai = keLokal(d);
    d.setHours(10); S.ag.selesai = keLokal(d);
  }
  function agInfo() { var e = $('#agInfo'); if (e) e.innerHTML = V.agInfo(); }
  IN.agJudul = function (t) { S.ag.judul = t.value; };
  IN.agLokasi = function (t) { S.ag.lokasi = t.value; };
  IN.agDeskripsi = function (t) { S.ag.deskripsi = t.value; };
  IN.agMulai = function (t) { S.ag.mulai = t.value; };
  IN.agSelesai = function (t) { S.ag.selesai = t.value; };
  CH.agMulai = function (t) {   // selesai otomatis menyusul +1 jam bila tidak lagi setelah mulai
    var m = new Date(t.value), s = new Date(S.ag.selesai);
    if (!isNaN(m) && (isNaN(s) || s <= m)) { S.ag.selesai = keLokal(new Date(m.getTime() + 3600e3)); var e = $('[data-in=agSelesai]'); if (e) e.value = S.ag.selesai; }
  };
  ACT.agMode = function (el) { S.ag.mode = el.getAttribute('data-m'); render(); };
  ACT.agGrup = function (el) { var g = el.getAttribute('data-g'), i = S.ag.grup.indexOf(g); if (i > -1) S.ag.grup.splice(i, 1); else S.ag.grup.push(g); render(); };
  ACT.agRem = function (el) {
    var m = +el.getAttribute('data-m'), i = S.ag.rem.indexOf(m);
    if (i > -1) S.ag.rem.splice(i, 1); else if (S.ag.rem.length >= 5) return toast('Maksimal 5 pengingat kalender', 'warn'); else S.ag.rem.push(m);
    S.ag.rem.sort(function (x, y) { return y - x; }); render();
  };
  ACT.agEmail = function (el) { S.ag.email = +el.getAttribute('data-m'); render(); };
  ACT.agSimpan = async function () {
    var a = S.ag; if (a.busy) return;
    if (!a.judul.trim()) return toast('Nama agenda wajib diisi', 'warn');
    var m = new Date(a.mulai), s = new Date(a.selesai);
    if (isNaN(m) || isNaN(s)) return toast('Isi waktu mulai dan selesai', 'warn');
    if (s <= m) return toast('Waktu selesai harus setelah waktu mulai', 'warn');
    if (m.getTime() < Date.now()) return toast('Waktu mulai sudah lewat', 'warn');
    if (a.mode === 'grup' && !a.grup.length) return toast('Pilih minimal satu grup', 'warn');
    var t = SB.tamuHitung();
    if (!t.n) return toast('Belum ada peserta beremail pada target ini. Lengkapi email di menu Peserta.', 'err');
    if (t.n > 150) return toast('Maksimal 150 undangan per agenda (target ' + t.n + '). Pilih per grup.', 'err');
    var d = { judul: a.judul.trim(), deskripsi: a.deskripsi.trim(), lokasi: a.lokasi.trim(), mulai: m.toISOString(), selesai: s.toISOString(), mode: a.mode, grup: a.grup.slice(), pengingat: a.rem.slice(), email_pengingat: a.email };
    var tmp = { id: 'tmp_' + Date.now(), judul: d.judul, deskripsi: d.deskripsi, lokasi: d.lokasi, mulai: d.mulai, selesai: d.selesai, grup_target: a.mode === 'grup' ? a.grup.join(',') : 'Semua', tamu: t.n, pengingat: (a.rem.length ? a.rem : [60]).join(','), email_pengingat: a.email, email_terkirim: '', event_id: '', status: 'Aktif', dibuat: new Date().toISOString() };
    S.agenda = [tmp].concat(S.agenda); a.busy = true; render(); toast('Membuat agenda & mengirim undangan…', 'info');
    pending++; var r = await API.call('simpanAgenda', d); pending--; a.busy = false;
    if (!r.ok) { S.agenda = S.agenda.filter(function (x) { return x.id !== tmp.id; }); render(); return toast(r.message || 'Gagal membuat agenda', 'err'); }
    S.agenda = S.agenda.map(function (x) { return x.id === tmp.id ? r.item : x; });
    Object.assign(a, { judul: '', deskripsi: '', lokasi: '', mulai: '', selesai: '' }); agDefault();
    S.logAgBasi = true; persist(); render(); toast('Agenda dibuat — ' + r.tamu + ' undangan dikirim');
  };
  ACT.agBatal = async function (el) {
    var id = el.getAttribute('data-id'), x = S.agenda.filter(function (k) { return k.id === id; })[0]; if (!x) return;
    if (!await SB.confirm('Batalkan agenda?', 'Agenda "' + x.judul + '" dihapus dari kalender dan peserta menerima pemberitahuan pembatalan.', 'Batalkan Agenda', true)) return;
    var prev = S.agenda.slice();
    S.agenda = S.agenda.map(function (k) { return k.id === id ? Object.assign({}, k, { status: 'Dibatalkan' }) : k; }); render(); toast('Agenda dibatalkan'); pending++;
    var r = await API.call('hapusAgenda', { id: id }); pending--;
    if (!r.ok) { S.agenda = prev; render(); toast(r.message || 'Gagal membatalkan agenda', 'err'); } else { S.logAgBasi = true; persist(); }
  };
  ACT.agMailSekarang = async function (el) {
    var id = el.getAttribute('data-id'), x = S.agenda.filter(function (k) { return k.id === id; })[0]; if (!x) return;
    if (!await SB.confirm('Kirim pengingat email?', 'Email pengingat "' + x.judul + '" dikirim sekarang ke ' + x.tamu + ' peserta.', 'Kirim Sekarang')) return;
    el.disabled = true; toast('Mengirim email pengingat…', 'info');
    var r = await API.call('kirimPengingatAgenda', { id: id }); el.disabled = false; S.logAgBasi = true;
    if (!r.ok) return toast(r.message || 'Gagal mengirim pengingat', 'err');
    toast(r.kirim + ' email terkirim' + (r.gagal ? ', ' + r.gagal + ' gagal' : ''), r.gagal ? 'warn' : 'ok');
  };

  /* ---------- Template ---------- */
  IN.tplQ = jeda(function (t) { S.tpl.q = t.value; $('#tplList').innerHTML = V.tplList(); }, 80);
  ACT.tplKategori = function (el) { S.tpl.kat = el.getAttribute('data-k'); render(); };
  function tplEd() { var e = $('#tplEd'); if (e) e.innerHTML = V.tplEditor(); var l = $('#tplList'); if (l) l.innerHTML = V.tplList(); }
  ACT.tplBaru = function () { S.tpl.draft = { id: '', judul: '', kategori: 'Umum', isi: '', lampiran_url: '', lampiran_nama: '' }; tplEd(); var j = $('#tplJudul'); if (j) j.focus(); };
  ACT.tplEdit = function (el) { var t = S.template.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0]; if (t) { S.tpl.draft = Object.assign({}, t); tplEd(); $('#tplEd').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } };
  ACT.tplBatal = function () { S.tpl.draft = null; tplEd(); };
  IN.tplJudul = function (t) { S.tpl.draft.judul = t.value; };
  function tplPrev() {
    var d = S.tpl.draft, c = $('#tplCount'), p = $('#tplPrev');
    if (c) c.textContent = d.isi.length + ' karakter';
    if (p) p.innerHTML = d.isi ? SB.waPrev(d.isi, { nama: 'Budi Santoso' }) : '<i style="color:#8a9a90">Isi pesan akan tampil di sini…</i>';
  }
  IN.tplIsi = function (t) { S.tpl.draft.isi = t.value; tplPrev(); };
  CH.tplKat = function (t) { S.tpl.draft.kategori = t.value; };
  ACT.tplSisip = function (el) {
    var ta = $('#tplIsi'), v = el.getAttribute('data-v'), a = ta.selectionStart || 0, b = ta.selectionEnd || 0;
    ta.focus(); ta.setRangeText(v, a, b, 'end'); S.tpl.draft.isi = ta.value; tplPrev();
  };
  ACT.tplUnggah = function () { $('#tplFile').click(); };
  CH.tplFile = function (t) {
    var f = t.files[0]; if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast('Ukuran file maksimal 5 MB', 'err');
    var rd = new FileReader();
    rd.onload = async function () {
      toast('Mengunggah lampiran…', 'info');
      var r = await API.call('uploadLampiran', { nama: f.name, mime: f.type, base64: String(rd.result).split(',')[1] });
      if (!r.ok) return toast(r.message || 'Gagal mengunggah', 'err');
      S.tpl.draft.lampiran_url = r.url; S.tpl.draft.lampiran_nama = r.nama; tplEd(); toast('Lampiran terunggah');
    };
    rd.readAsDataURL(f);
  };
  ACT.tplHapusLamp = function () { S.tpl.draft.lampiran_url = ''; S.tpl.draft.lampiran_nama = ''; tplEd(); };
  async function simpanTpl(d, tanpaReset) {
    var prev = S.template.slice(), tmp = d.id || 'tmp_' + Date.now(), now = new Date().toISOString();
    var item = Object.assign({}, d, { id: tmp, diperbarui: now });
    if (d.id) S.template = S.template.map(function (t) { return t.id === d.id ? item : t; }); else S.template = S.template.concat([item]);
    if (!tanpaReset) S.tpl.draft = null;
    render(); toast(d.id ? 'Template diperbarui' : 'Template disimpan'); pending++;
    var r = await API.call('simpanTemplate', Object.assign({}, d, { id: d.id || undefined })); pending--;
    if (!r.ok) { S.template = prev; render(); return toast(r.message || 'Gagal menyimpan template', 'err'); }
    S.template = S.template.map(function (t) { return t.id === tmp ? r.item : t; }); persist();
  }
  ACT.tplSimpan = function () {
    var d = S.tpl.draft;
    if (!d.judul.trim()) return toast('Judul template wajib diisi', 'warn');
    if (!d.isi.trim()) return toast('Isi pesan tidak boleh kosong', 'warn');
    simpanTpl(Object.assign({}, d, { judul: d.judul.trim(), isi: d.isi.trim() }));
  };
  ACT.tplDup = function (el) {
    var t = S.template.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0];
    if (t) simpanTpl(Object.assign({}, t, { id: '', judul: 'Salinan - ' + t.judul }), true);
  };
  ACT.tplHapus = async function (el) {
    var id = el.getAttribute('data-id'), t = S.template.filter(function (x) { return x.id === id; })[0];
    if (!t || !await SB.confirm('Hapus template?', 'Template "' + t.judul + '" akan dihapus permanen.', 'Hapus', true)) return;
    var prev = S.template.slice(); S.template = S.template.filter(function (x) { return x.id !== id; });
    if (S.tpl.draft && S.tpl.draft.id === id) S.tpl.draft = null;
    render(); toast('Template dihapus'); pending++;
    var r = await API.call('hapusTemplate', { id: id }); pending--;
    if (!r.ok) { S.template = prev; render(); toast(r.message || 'Gagal menghapus', 'err'); } else persist();
  };
  ACT.tplPakai = function (el) { S.wz.tplId = el.getAttribute('data-id'); S.wz.step = 1; go('broadcast'); };

  /* ---------- Wizard broadcast ---------- */
  function wzUlang() {
    var b = $('#wzBody'), k = $('#wzKanan'); if (!b) return render();
    var l = $('#wzList'), st = l ? l.scrollTop : 0, a = document.activeElement, fid = a && a.id, pos = a && a.selectionStart;
    b.innerHTML = V.wzBody(); k.innerHTML = V.wzKanan();
    var l2 = $('#wzList'); if (l2) l2.scrollTop = st;
    if (fid) { var f = $('#' + fid); if (f) { f.focus(); try { f.setSelectionRange(pos, pos); } catch (e) {} } }
    var h = $('.pagehead .sub'); if (h) h.innerHTML = 'Kampanye &nbsp;›&nbsp; Wizard Pengiriman &nbsp;›&nbsp; <span style="color:var(--primary)">Langkah ' + S.wz.step + ' dari 3</span>';
  }
  IN.wzJudul = function (t) { S.wz.judul = t.value; };
  IN.wzQ = jeda(function (t) { S.wz.q = t.value; wzUlang(); }, 120);
  IN.wzJadwal = function (t) { S.wz.jadwal = t.value; };
  ACT.wzTpl = function (el) { S.wz.tplId = el.getAttribute('data-id'); wzUlang(); };
  ACT.wzMode = function (el) { S.wz.mode = el.getAttribute('data-m'); wzUlang(); };
  ACT.wzGrup = function (el) { var g = el.getAttribute('data-g'), i = S.wz.grup.indexOf(g); if (i > -1) S.wz.grup.splice(i, 1); else S.wz.grup.push(g); wzUlang(); };
  CH.wzPilih = function (t) { var id = t.getAttribute('data-id'); if (t.checked) S.wz.ids[id] = 1; else delete S.wz.ids[id]; wzUlang(); };
  ACT.wzSemuaTampil = function () { var q = (S.wz.q || '').toLowerCase(); S.peserta.forEach(function (p) { if (p.status === 'Aktif' && (!q || (p.nama + p.nomor).toLowerCase().indexOf(q) > -1)) S.wz.ids[p.id] = 1; }); wzUlang(); };
  ACT.wzKosong = function () { S.wz.ids = {}; wzUlang(); };
  ACT.wzJadwal = function (el) { S.wz.jadwalOn = el.getAttribute('data-v') === '1'; if (S.wz.jadwalOn && !S.wz.jadwal) { var d = new Date(Date.now() + 3600e3); d.setMinutes(0, 0, 0); S.wz.jadwal = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); } wzUlang(); };
  ACT.wzStep = function (el) { S.wz.step = +el.getAttribute('data-s'); wzUlang(); };
  ACT.wzLanjut = function () {
    var w = S.wz;
    if (w.step === 1) {
      if (!w.judul.trim()) return toast('Isi nama kampanye terlebih dahulu', 'warn');
      if (!w.tplId) return toast('Pilih template pesan', 'warn');
    }
    if (w.step === 2) {
      if (w.mode === 'grup' && !w.grup.length) return toast('Pilih minimal satu grup', 'warn');
      if (!SB.wzPenerima().length) return toast('Belum ada penerima terpilih', 'warn');
    }
    w.step++; wzUlang(); $('#main').scrollTop = 0;
  };
  ACT.wzKirim = async function () {
    var w = S.wz, n = SB.wzPenerima().length;
    if (w.jadwalOn && (!w.jadwal || Date.parse(w.jadwal) < Date.now() + 60000)) return toast('Pilih waktu jadwal minimal 1 menit dari sekarang', 'warn');
    var ok = await SB.confirm(w.jadwalOn ? 'Jadwalkan broadcast?' : 'Kirim ke ' + n + ' penerima?', w.jadwalOn ? 'Pesan akan mulai dikirim pada waktu yang dijadwalkan.' : 'Pesan akan dikirim bertahap dengan jeda aman. Anda bisa menjeda atau menghentikannya kapan saja.', w.jadwalOn ? 'Ya, jadwalkan' : 'Ya, kirim');
    if (!ok) return;
    var btn = $('[data-act="wzKirim"]'); if (btn) btn.disabled = true;
    var r = await API.call('buatKampanye', { judul: w.judul.trim(), template_id: w.tplId, mode: w.mode, grup: w.grup, ids: Object.keys(w.ids), jadwal: w.jadwalOn ? new Date(w.jadwal).toISOString() : '' });
    if (!r.ok) { if (btn) btn.disabled = false; return toast(r.message || 'Gagal membuat kampanye', 'err'); }
    S.kampanye.push(r.kampanye); setPG(r.kampanye.id); PG.muat = null; persist();
    S.wz = { step: 1, judul: '', tplId: '', mode: 'semua', grup: [], ids: {}, q: '', jadwalOn: false, jadwal: '' };
    toast(w.jadwalOn ? 'Broadcast dijadwalkan' : 'Broadcast dimulai!');
    location.hash = '#/progres?id=' + encodeURIComponent(r.kampanye.id); kickDriver();
  };

  /* ---------- Progres ---------- */
  ACT.pgFilter = function (el) { PG.filter = el.getAttribute('data-f'); renderKeep(); };
  ACT.pgKontrol = async function (el) {
    var a = el.getAttribute('data-a'), id = PG.id;
    if (a === 'hentikan' && !await SB.confirm('Hentikan broadcast?', 'Pesan yang belum terkirim akan dibatalkan dan tidak bisa dilanjutkan.', 'Ya, hentikan', true)) return;
    if (a === 'ulang' && !await SB.confirm('Kirim ulang yang gagal?', 'Hanya pesan yang gagal yang akan dikirim lagi.', 'Ya, kirim ulang')) return;
    el.disabled = true;
    var r = await API.call('kontrol', { id: id, aksi: a });
    if (!r.ok) { el.disabled = false; return toast(r.message || 'Gagal', 'err'); }
    var penuh = a === 'hentikan' || a === 'ulang';
    if (penuh) { var f = await API.call('progres', { id: id, penuh: true }); if (f.ok) r = f; }
    applyProg(r, penuh);
    toast({ jeda: 'Pengiriman dijeda', lanjut: 'Pengiriman dilanjutkan', hentikan: 'Broadcast dihentikan', ulang: 'Mengirim ulang pesan yang gagal' }[a]);
    kickDriver();
  };
  ACT.pgUnduhLog = function () {
    var rows = [['Waktu', 'Nama', 'Nomor', 'Status', 'Keterangan']].concat(SB.pgRows().filter(function (r) { return r.waktu; }).map(function (r) { return [r.waktu, r.nama, r.nomor, r.status, r.error]; }));
    SB.unduhTeks('log-pengiriman.csv', SB.csv(rows)); toast('Log diunduh');
  };

  /* ---------- Riwayat & laporan ---------- */
  function rwUlang() { var t = $('#rwTbl'); if (t) t.innerHTML = V.rwTable(); }
  IN.rwQ = jeda(function (t) { S.rw.q = t.value; S.rw.page = 1; rwUlang(); }, 100);
  CH.rwKamp = function (t) { S.rw.kampanye = t.value; S.rw.page = 1; rwUlang(); };
  CH.rwStatus = function (t) { S.rw.status = t.value; S.rw.page = 1; rwUlang(); };
  CH.rwTgl1 = function (t) { S.rw.tgl1 = t.value; S.rw.page = 1; rwUlang(); };
  CH.rwTgl2 = function (t) { S.rw.tgl2 = t.value; S.rw.page = 1; rwUlang(); };
  ACT.rwHal = function (el) { S.rw.page = +el.getAttribute('data-p') || 1; rwUlang(); };
  function dataLaporan() {
    var jd = {}; S.kampanye.forEach(function (k) { jd[k.id] = k.judul; });
    return [['Waktu', 'Kampanye', 'Nama', 'Nomor', 'Status', 'Keterangan']].concat(SB.rwFiltered().slice(0, 5000).map(function (r) { return [r.waktu ? SB.tgl(r.waktu, true) : '-', jd[r.kampanye_id] || r.kampanye_id, r.nama, r.nomor, r.status === 'Berhasil' ? 'Terkirim' : r.status, r.error]; }));
  }
  ACT.rwExcel = async function () {
    var d = dataLaporan(); if (d.length < 2) return toast('Tidak ada data untuk diunduh', 'warn');
    var tgl = new Date().toISOString().slice(0, 10);
    try {
      var X = await SB.muatXLSX(), ws = X.utils.aoa_to_sheet(d); ws['!cols'] = [{ wch: 20 }, { wch: 28 }, { wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 30 }];
      var wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'Riwayat'); X.writeFile(wb, 'riwayat-siblast-' + tgl + '.xlsx'); toast('Excel diunduh');
    } catch (e) { SB.unduhTeks('riwayat-siblast-' + tgl + '.csv', SB.csv(d)); toast('Pustaka Excel tidak tersedia — diunduh sebagai CSV', 'warn'); }
  };
  function cetakPdf(judul, d) {
    if (d.length < 2) return toast('Tidak ada data untuk diunduh', 'warn');
    var w = window.open('', '_blank'); if (!w) return toast('Izinkan pop-up untuk mengunduh PDF', 'warn');
    var h = '<html><head><meta charset="utf-8"><title>' + esc(judul) + '</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#161a2f}h2{margin:0 0 4px}p{color:#666;margin:0 0 16px;font-size:12px}table{border-collapse:collapse;width:100%;font-size:11px}th{background:#ececff;text-align:left}th,td{border:1px solid #d8dbe9;padding:6px 8px}tr:nth-child(even) td{background:#fafbff}</style></head><body><h2>' + esc(judul) + '</h2><p>Dibuat ' + esc(SB.tgl(new Date().toISOString(), true)) + ' · ' + (d.length - 1) + ' baris</p><table><thead><tr>' + d[0].map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' + d.slice(1).map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table><script>setTimeout(function(){window.print()},300)<\/script></body></html>';
    w.document.write(h); w.document.close(); toast('Pilih "Simpan sebagai PDF" pada dialog cetak', 'info');
  }
  ACT.rwPdf = function () { cetakPdf('Laporan Pengiriman SiBlast', dataLaporan()); };

  /* ---------- Riwayat agenda & email ---------- */
  function rwaUlang() { var t = $('#rwaTbl'); if (t) t.innerHTML = V.rwaTable(); }
  ACT.rwTab = function (el) { S.rw.tab = el.getAttribute('data-t'); render(); };
  IN.rwaQ = jeda(function (t) { S.rwa.q = t.value; S.rwa.page = 1; rwaUlang(); }, 100);
  CH.rwaAg = function (t) { S.rwa.agenda = t.value; S.rwa.page = 1; rwaUlang(); };
  CH.rwaJenis = function (t) { S.rwa.jenis = t.value; S.rwa.page = 1; rwaUlang(); };
  CH.rwaStatus = function (t) { S.rwa.status = t.value; S.rwa.page = 1; rwaUlang(); };
  CH.rwaTgl1 = function (t) { S.rwa.tgl1 = t.value; S.rwa.page = 1; rwaUlang(); };
  CH.rwaTgl2 = function (t) { S.rwa.tgl2 = t.value; S.rwa.page = 1; rwaUlang(); };
  ACT.rwaHal = function (el) { S.rwa.page = +el.getAttribute('data-p') || 1; rwaUlang(); };
  function dataLaporanAg() {
    return [['Waktu', 'Agenda', 'Jenis', 'Nama', 'Email', 'Status', 'Keterangan']].concat(SB.rwaFiltered().slice(0, 5000).map(function (r) { return [r.waktu ? SB.tgl(r.waktu, true) : '-', r.judul, r.jenis, r.nama, r.email, r.status, r.error]; }));
  }
  ACT.rwaExcel = async function () {
    var d = dataLaporanAg(); if (d.length < 2) return toast('Tidak ada data untuk diunduh', 'warn');
    var tgl = new Date().toISOString().slice(0, 10);
    try {
      var X = await SB.muatXLSX(), ws = X.utils.aoa_to_sheet(d); ws['!cols'] = [{ wch: 20 }, { wch: 28 }, { wch: 22 }, { wch: 22 }, { wch: 30 }, { wch: 12 }, { wch: 30 }];
      var wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'Agenda'); X.writeFile(wb, 'riwayat-agenda-siblast-' + tgl + '.xlsx'); toast('Excel diunduh');
    } catch (e) { SB.unduhTeks('riwayat-agenda-siblast-' + tgl + '.csv', SB.csv(d)); toast('Pustaka Excel tidak tersedia — diunduh sebagai CSV', 'warn'); }
  };
  ACT.rwaPdf = function () { cetakPdf('Laporan Agenda & Email SiBlast', dataLaporanAg()); };

  /* ---------- Pengaturan ---------- */
  IN.stJeda = function () {
    var a = +$('#stJmin').value, b = +$('#stJmax').value;
    if (b < a) { b = a; $('#stJmax').value = b; }
    $('#lbJeda').textContent = a + ' – ' + b + ' detik';
  };
  ACT.step = function (el) {
    var t = el.getAttribute('data-t'), d = +el.getAttribute('data-d'), v = $('#' + t + 'V'), lim = t === 'stBatch' ? [5, 60] : [0, 600];
    v.textContent = Math.min(lim[1], Math.max(lim[0], (+v.textContent || 0) + d));
  };
  function bacaPengaturan() {
    return {
      provider: $('#stProvider').value, jeda_min: $('#stJmin').value, jeda_max: $('#stJmax').value,
      batch_size: $('#stBatchV').textContent, jeda_batch: $('#stIstV').textContent,
      jeda_acak: $('#stAcak').checked ? '1' : '0', auto_retry: $('#stRetry').checked ? '1' : '0', mode_uji: $('#stUji').checked ? '1' : '0',
      nomor_uji: $('#stNoUji').value, nomor_pengirim: $('#stPengirim').value, nama_admin: $('#stNama').value
    };
  }
  async function simpanPengaturan() {
    var d = bacaPengaturan();
    if (d.mode_uji === '1' && !noValid(normNo(d.nomor_uji))) { toast('Isi nomor uji yang valid untuk Mode Uji Coba', 'warn'); return false; }
    var prev = Object.assign({}, S.settings);
    S.settings = Object.assign({}, S.settings, d); S.user.nama = d.nama_admin || S.user.nama; sinkronHeader(); pending++;
    var r = await API.call('simpanPengaturan', d); pending--;
    if (!r.ok) { S.settings = prev; toast(r.message || 'Gagal menyimpan pengaturan', 'err'); return false; }
    S.settings = r.settings; persist(); return true;
  }
  async function simpanRahasia(obj) {
    var r = await API.call('simpanRahasia', obj);
    if (!r.ok) { toast(r.message || 'Gagal menyimpan', 'err'); return false; }
    S.rahasia = r.rahasia; S.gw = null; persist(); updateGw(); return true;
  }
  ACT.simpanToken = async function () {
    var t = $('#stToken').value.trim();
    if (!t) return toast('Tempel token terlebih dahulu', 'warn');
    if (await simpanRahasia({ FONNTE_TOKEN: t })) { toast('Token disimpan aman di Script Properties'); render(); }
  };
  ACT.hapusToken = async function () {
    if (!await SB.confirm('Putuskan koneksi?', 'Token WhatsApp akan dihapus. Pengiriman tidak dapat dilakukan sampai token diisi lagi.', 'Putuskan', true)) return;
    if (await simpanRahasia({ FONNTE_TOKEN: '__HAPUS__' })) { toast('Token dihapus'); render(); }
  };
  ACT.tesKoneksi = async function () {
    if (!(S.rahasia && S.rahasia.tokenAda)) return toast('Isi dan simpan token terlebih dahulu', 'warn');
    toast('Memeriksa koneksi WhatsApp…', 'info');
    var r = await API.call('tesKoneksi');
    if (!r.ok) { S.gw = { terhubung: false }; updateGw(); if (S.route === 'pengaturan') renderKeep(); return toast(r.message || 'Koneksi gagal', 'err'); }
    S.gw = r; updateGw(); if (S.route === 'pengaturan') renderKeep();
    toast(r.terhubung ? 'WhatsApp terhubung' + (r.nomor ? ' (' + SB.fmtNo(r.nomor) + ')' : '') : 'Token valid, tetapi perangkat belum terhubung', r.terhubung ? 'ok' : 'warn');
  };
  ACT.simpanSemua = async function () {
    var ok = await simpanPengaturan(); if (!ok) return;
    var rh = {}, cid = $('#stClient').value.trim(), em = $('#stEmail').value.trim(), tk = $('#stToken').value.trim(), p = S.rahasia || {};
    if (tk) rh.FONNTE_TOKEN = tk;
    if (cid !== (p.googleClientId || '')) rh.GOOGLE_CLIENT_ID = cid || '__HAPUS__';
    if (em !== (p.adminEmail || '')) rh.ADMIN_EMAIL = em || '__HAPUS__';
    if (Object.keys(rh).length) { if (!await simpanRahasia(rh)) return; }
    toast('Semua pengaturan tersimpan'); render();
  };
  ACT.resetPengaturan = async function () {
    if (!await SB.confirm('Reset pengaturan?', 'Jeda, ukuran gelombang, dan opsi lain dikembalikan ke nilai awal.', 'Reset')) return;
    var d = { jeda_min: '3.5', jeda_max: '5', batch_size: '25', jeda_batch: '30', jeda_acak: '1', auto_retry: '1', mode_uji: '0', nomor_uji: '' };
    S.settings = Object.assign({}, S.settings, d); render();
    var r = await API.call('simpanPengaturan', d); if (r.ok) { S.settings = r.settings; persist(); toast('Pengaturan dikembalikan'); }
  };
  ACT.gantiSandi = async function () {
    var l = $('#pwLama').value, b = $('#pwBaru').value;
    if (!l || !b) return toast('Isi kata sandi lama dan baru', 'warn');
    var r = await API.call('gantiSandi', { lama: l, baru: b });
    if (!r.ok) return toast(r.message || 'Gagal', 'err');
    $('#pwLama').value = ''; $('#pwBaru').value = ''; toast('Kata sandi diperbarui');
  };

  /* ---------- input / change delegasi ---------- */
  document.addEventListener('input', function (e) { var k = e.target.getAttribute && e.target.getAttribute('data-in'); if (k && IN[k]) IN[k](e.target, e); });
  document.addEventListener('change', function (e) {
    var t = e.target, k = t.getAttribute && t.getAttribute('data-ch'); if (k && CH[k]) return CH[k](t, e);
    if (t.id === 'fileImp') CH.fileImp(t);
  });
  document.addEventListener('keydown', function (e) {
    if (e.target.id === 'gsearch' && e.key === 'Enter') { S.pes.q = e.target.value; S.pes.page = 1; e.target.value = ''; go('peserta'); }
  });
  window.addEventListener('online', function () { toast('Kembali online', 'ok'); segarkan(true); });
  window.addEventListener('offline', function () { toast('Anda sedang offline — data tersimpan di perangkat', 'warn'); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && S.loggedIn) { segarkan(true); kickDriver(); } });
  setInterval(function () { if (!document.hidden && S.loggedIn && S.loaded && !SB.modalOpen() && !DR.running) segarkan(true); }, 60000);

  /* ---------- mulai ---------- */
  function mulai() {
    API.get('ping'); // pemanasan server GAS sedini mungkin
    var cache = API.LS.get('sb_data');
    if (API.hasToken()) {
      if (cache && cache.peserta) {
        S.user = cache.user || S.user; S.settings = cache.settings || {}; S.rahasia = cache.rahasia || {};
        S.peserta = cache.peserta; S.template = cache.template || []; S.kampanye = cache.kampanye || []; S.agenda = cache.agenda || []; S.loaded = true; SB.versi = cache.v;
      }
      showApp(); render(); boot(true);
    } else showLogin();
  }
  mulai();
})();
