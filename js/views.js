/* ============================================================
   SiBlast — tampilan halaman (dirender dari state, tanpa jaringan)
   ============================================================ */
(function () {
  'use strict';
  var SB = window.SB, S = SB.S, PG = SB.PG;
  var esc = SB.esc, ic = SB.ic, badge = SB.badge, num = SB.num, tgl = SB.tgl, fmtNo = SB.fmtNo, avatar = SB.avatar;
  var V = (SB.V = {});

  var AKTIF = ['Berjalan', 'Dijeda', 'Terjadwal'];
  var isAktif = function (k) { return AKTIF.indexOf(k.status) > -1; };
  SB.isAktif = isAktif;
  SB.kampanyeAktif = function () { return S.kampanye.filter(isAktif)[0] || null; };
  var BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
  var IKON = [['k-pink', 'campaign', '#ffe2e5', '#fa5a7d'], ['k-peach', 'local_offer', '#fff4de', '#ff947a'], ['k-lav', 'receipt_long', '#f3e8ff', '#a855f7'], ['k-mint', 'forum', '#dcfce7', '#16a34a']];

  function sum(arr, f) { return arr.reduce(function (a, x) { return a + (+x[f] || 0); }, 0); }
  function urut(k) { return k.slice().sort(function (a, b) { return a.waktu_mulai < b.waktu_mulai ? -1 : 1; }); }
  SB.ringkas = function () {
    var K = S.kampanye, t = sum(K, 'terkirim'), g = sum(K, 'gagal');
    var m = K.filter(isAktif).reduce(function (a, x) { return a + Math.max(0, x.total - x.terkirim - x.gagal); }, 0);
    var done = t + g;
    return { terkirim: t, gagal: g, menunggu: m, rate: done ? Math.round((t / done) * 1000) / 10 : 0, total: sum(K, 'total') };
  };
  function grupList() {
    var m = {};
    S.peserta.forEach(function (p) { if (p.status === 'Aktif') m[p.grup] = (m[p.grup] || 0) + 1; });
    return Object.keys(m).sort().map(function (g) { return { nama: g, n: m[g] }; });
  }
  SB.grupList = grupList;
  function pageHead(judul, sub, aksi, badgeTxt) {
    return '<div class="pagehead"><div><div class="row gap8 wrap"><h1 class="h1">' + judul + '</h1>' + (badgeTxt ? '<span class="pill">' + badgeTxt + '</span>' : '') + '</div><p>' + sub + '</p></div><div class="row wrap">' + (aksi || '') + '</div></div>';
  }
  function pager(tot, page, per, act) {
    var pages = Math.max(1, Math.ceil(tot / per)), h = '';
    var mulai = tot ? (page - 1) * per + 1 : 0, akhir = Math.min(tot, page * per);
    var lo = Math.max(1, page - 2), hi = Math.min(pages, lo + 4); lo = Math.max(1, hi - 4);
    h += '<button data-act="' + act + '" data-p="' + (page - 1) + '"' + (page <= 1 ? ' disabled' : '') + '>' + ic('chevron_left', 'sm') + '</button>';
    for (var i = lo; i <= hi; i++) h += '<button class="' + (i === page ? 'on' : '') + '" data-act="' + act + '" data-p="' + i + '">' + i + '</button>';
    h += '<button data-act="' + act + '" data-p="' + (page + 1) + '"' + (page >= pages ? ' disabled' : '') + '>' + ic('chevron_right', 'sm') + '</button>';
    return '<div class="pager"><span class="sub">Menampilkan ' + mulai + '–' + akhir + ' dari ' + num(tot) + ' data</span><div class="pg">' + h + '</div></div>';
  }

  /* ============================ LOGIN ============================ */
  V.login = function () {
    return '<div class="loginwrap"><form class="login" id="loginForm" autocomplete="on">' +
      '<div class="logo">' + ic('forum', 'lg') + '</div><h1>Masuk ke SiBlast</h1><p class="tg">Kirim WhatsApp massal dengan mudah &amp; terukur</p>' +
      '<div class="field"><label class="lbl" for="lgUser">EMAIL / USERNAME</label><div class="iw">' + ic('account_circle') + '<input class="inp" id="lgUser" name="username" autocomplete="username" placeholder="admin" required></div></div>' +
      '<div class="field"><label class="lbl" for="lgPass">KATA SANDI</label><div class="iw">' + ic('lock') + '<input class="inp" id="lgPass" name="password" type="password" autocomplete="current-password" placeholder="••••••••" required><span class="ms eye" data-act="lihatSandi">visibility</span></div></div>' +
      '<div class="row between" style="margin-bottom:16px"><label class="row gap8" style="cursor:pointer"><input type="checkbox" class="chk" id="lgIngat" checked><span class="sub" style="font-size:13px">Ingat saya</span></label><a href="#" data-act="lupaSandi" style="color:var(--primary);font-weight:700;font-size:12px">Lupa kata sandi?</a></div>' +
      '<button class="btn p" style="width:100%;height:48px" id="lgBtn" type="submit">Masuk ke Dashboard ' + ic('arrow_forward') + '</button>' +
      '<div id="lgGoogleWrap" class="hide"><div class="divl">atau masuk dengan</div><div id="lgGoogle" style="display:flex;justify-content:center"></div></div>' +
      '<p id="lgErr" class="sub hide" style="color:var(--err);text-align:center;margin-top:14px;font-size:13px"></p></form></div>';
  };

  /* ============================ DASHBOARD ============================ */
  V.dashboard = function () {
    var K = S.kampanye, P = S.peserta, R = SB.ringkas();
    var aktifP = P.filter(function (p) { return p.status === 'Aktif'; }).length, nAktif = K.filter(isAktif).length;
    var kpi = '<div class="kpis">' +
      '<div class="kpi k-pink"><div class="ico">' + ic('group', 'lg') + '</div><div><div class="n">' + num(P.length) + '</div><div class="l">Total Peserta</div><div class="c" style="color:var(--primary)">' + ic('verified', 'sm') + num(aktifP) + ' aktif</div></div></div>' +
      '<div class="kpi k-peach"><div class="ico">' + ic('chat', 'lg') + '</div><div><div class="n">' + num(K.length) + '</div><div class="l">Total Kampanye</div><div class="c" style="color:#7a4a20">' + ic('timelapse', 'sm') + (nAktif ? nAktif + ' sedang berjalan' : 'Tidak ada yang berjalan') + '</div></div></div>' +
      '<div class="kpi k-mint"><div class="ico">' + ic('check_circle', 'lg') + '</div><div><div class="n">' + num(R.terkirim) + '</div><div class="l">Pesan Terkirim</div><div class="c" style="color:var(--ok-d)">' + ic('done_all', 'sm') + R.rate + '% keberhasilan</div></div></div>' +
      '<div class="kpi k-lav"><div class="ico">' + ic('error', 'lg') + '</div><div><div class="n">' + num(R.gagal) + '</div><div class="l">Gagal Terkirim</div><div class="c" style="color:' + (R.gagal ? 'var(--fail)' : 'var(--text2)') + '">' + ic(R.gagal ? 'replay' : 'task_alt', 'sm') + (R.gagal ? 'Perlu kirim ulang' : 'Tidak ada yang gagal') + '</div></div></div></div>';

    var thn = new Date().getFullYear(), ter = [], gag = [], mnt = [];
    for (var i = 0; i < 12; i++) { ter.push(0); gag.push(0); mnt.push(0); }
    K.forEach(function (k) {
      var d = new Date(k.waktu_mulai); if (isNaN(d) || d.getFullYear() !== thn) return;
      var m = d.getMonth(); ter[m] += +k.terkirim || 0; gag[m] += +k.gagal || 0;
      if (isAktif(k)) mnt[m] += Math.max(0, k.total - k.terkirim - k.gagal);
    });
    var trend = K.length ? SB.lineChart(BULAN, [
      { name: 'Terkirim', color: '#5b5fef', vals: ter, area: true }, { name: 'Gagal', color: '#fa5a7d', vals: gag }, { name: 'Menunggu', color: '#bf83ff', vals: mnt }
    ]) + '<div class="legend"><span><i style="background:#5b5fef"></i>Terkirim</span><span><i style="background:#fa5a7d"></i>Gagal</span><span><i style="background:#bf83ff"></i>Menunggu</span></div>' :
      SB.emptyBox('show_chart', 'Belum ada data pengiriman', 'Grafik tren muncul setelah broadcast pertama dikirim.');

    var kron = urut(K), last5 = kron.slice(-5), last8 = kron.slice(-8);
    var bars = K.length ? SB.barGroups(last5.map(function (k) { return { label: k.judul.slice(0, 10), a: +k.terkirim || 0, b: +k.gagal || 0 }; }), '#5b5fef', '#5dfd8a') +
      '<div class="legend"><span><i style="background:#5b5fef"></i>Terkirim</span><span><i style="background:#5dfd8a"></i>Gagal</span></div>' : SB.emptyBox('bar_chart', 'Belum ada kampanye', '');
    var rates = last8.map(function (k) { var d = k.terkirim + k.gagal; return d ? Math.round((k.terkirim / d) * 100) : 0; });
    var area = K.length ? SB.lineChart(last8.map(function (k, i) { return '#' + (i + 1); }), [{ name: 'Keberhasilan %', color: '#006d2f', vals: rates, area: true }], { h: 130 }) +
      '<div class="mini"><div><small>Kampanye terakhir</small><b style="color:var(--ok-d)">' + (rates.length ? rates[rates.length - 1] : 0) + '%</b></div><div><small>Rata-rata</small><b>' + R.rate + '%</b></div></div>' : SB.emptyBox('trending_up', 'Belum ada data', '');
    var dn = SB.donut([{ v: R.terkirim, c: '#5b5fef' }, { v: R.menunggu, c: '#bf83ff' }, { v: R.gagal, c: '#fa5a7d' }], num(R.terkirim + R.menunggu + R.gagal), 'Total Pesan');
    var pc = function (v) { var t = R.terkirim + R.menunggu + R.gagal; return t ? Math.round((v / t) * 100) : 0; };
    var dnLeg = '<div class="trio" style="grid-template-columns:repeat(3,1fr);text-align:center;gap:6px"><div style="background:none;padding:0"><small><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#5b5fef"></i> Terkirim</small><b style="font-size:13px">' + num(R.terkirim) + ' (' + pc(R.terkirim) + '%)</b></div>' +
      '<div style="background:none;padding:0"><small><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#bf83ff"></i> Menunggu</small><b style="font-size:13px">' + num(R.menunggu) + ' (' + pc(R.menunggu) + '%)</b></div>' +
      '<div style="background:none;padding:0"><small><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#fa5a7d"></i> Gagal</small><b style="font-size:13px">' + num(R.gagal) + ' (' + pc(R.gagal) + '%)</b></div></div>';

    var terbaru = kron.slice().reverse().slice(0, 5);
    var rows = terbaru.map(function (k, i) {
      var ik = IKON[i % 4], done = k.terkirim + k.gagal, p = k.total ? Math.round((done / k.total) * 100) : 0;
      var wb = k.status === 'Selesai' ? 'var(--ok-d)' : (k.status === 'Dihentikan' ? 'var(--fail)' : 'var(--primary-c)');
      return '<tr><td class="mono sub">#' + String(K.indexOf(k) + 1).padStart(2, '0') + '</td>' +
        '<td><div class="cell"><div class="ic" style="background:' + ik[2] + ';color:' + ik[3] + '">' + ic(ik[1], 'sm') + '</div><div class="tx"><b>' + esc(k.judul) + '</b><small>' + esc(k.grup_target || '') + '</small></div></div></td>' +
        '<td style="white-space:nowrap">' + tgl(k.waktu_mulai, true) + '</td>' +
        '<td><div class="pbar"><div class="t"><i style="width:' + p + '%;background:' + wb + '"></i></div><b style="color:' + wb + '">' + p + '%</b></div></td>' +
        '<td class="mono"><b>' + num(k.terkirim) + ' / ' + num(k.total) + '</b></td><td>' + badge(k.status) + '</td>' +
        '<td><div class="acts">' + ((k.status === 'Selesai' || k.status === 'Dihentikan') && k.gagal > 0 ? '<button class="btn d sm" data-act="ulangGagal" data-id="' + esc(k.id) + '">' + ic('replay', 'sm') + 'Kirim Ulang</button>' : '') +
        '<button class="ibtn" title="Lihat progres" data-act="bukaProgres" data-id="' + esc(k.id) + '">' + ic('visibility') + '</button></div></td></tr>';
    }).join('');
    var tabel = K.length ? '<div class="tw"><table><thead><tr><th>No</th><th>Judul Kampanye</th><th>Tanggal Mulai</th><th>Progres</th><th>Terkirim / Total</th><th>Status</th><th style="text-align:right">Aksi</th></tr></thead><tbody>' + rows + '</tbody></table></div>' :
      SB.emptyBox('send', 'Belum ada broadcast', 'Buat broadcast pertama Anda dalam 3 langkah mudah.', '<button class="btn p" data-act="go" data-r="broadcast">' + ic('send') + 'Buat Broadcast Pertama</button>');

    return pageHead('Selamat Datang, ' + esc(S.user.nama || 'Admin') + ' 👋', 'Pantau pengiriman broadcast WhatsApp, performa, dan antrean pesan Anda.',
      '<button class="btn s" data-act="ekspor">' + ic('file_download') + 'Ekspor Data</button><button class="btn p" data-act="go" data-r="broadcast">' + ic('send') + 'Buat Broadcast</button>') +
      '<div class="g12"><div class="card c7"><div class="row between"><div><h2 class="h2" style="font-size:18px">Ringkasan Hari Ini</h2><span class="sub">Aktivitas pengiriman &amp; data audiens terkini</span></div><span class="badge b-draft" style="background:var(--bg);color:var(--text2)"><i style="background:#3de273"></i>Live Sync</span></div><div style="margin-top:18px">' + kpi + '</div></div>' +
      '<div class="card c5"><div><h2 class="h2" style="font-size:18px">Tren Pengiriman WhatsApp</h2><span class="sub">Volume pesan broadcast ' + thn + '</span></div><div style="margin-top:12px">' + trend + '</div></div></div>' +
      '<div class="g3"><div class="card"><h3 class="h3">Berhasil vs Gagal</h3><span class="sub">Distribusi per kampanye</span>' + bars + '</div>' +
      '<div class="card"><div class="row between"><div><h3 class="h3">Tingkat Keberhasilan</h3><span class="sub">Per kampanye terakhir</span></div><span class="pill" style="background:var(--mint-bg);color:var(--ok-d)">' + R.rate + '% rata-rata</span></div><div style="margin-top:10px">' + area + '</div></div>' +
      '<div class="card"><h3 class="h3">Status Pesan Broadcast</h3><span class="sub">Seluruh kampanye</span>' + dn + dnLeg + '</div></div>' +
      '<div class="card"><div class="row between wrap"><div><div class="row gap8"><h2 class="h2" style="font-size:18px">Kampanye Terbaru</h2><span class="pill">' + K.length + ' kampanye</span></div><span class="sub">Riwayat peluncuran pesan massal &amp; status pengiriman</span></div>' +
      '<button class="btn o sm" data-act="segarkan">' + ic('refresh', 'sm') + 'Perbarui</button></div><div style="margin-top:14px">' + tabel + '</div></div>';
  };

  /* ============================ PESERTA ============================ */
  function pesFiltered() {
    var q = S.pes.q.trim().toLowerCase();
    return S.peserta.filter(function (p) {
      if (S.pes.grup && p.grup !== S.pes.grup) return false;
      if (S.pes.status && p.status !== S.pes.status) return false;
      return !q || (p.nama + ' ' + p.nomor + ' ' + p.grup + ' ' + (p.email || '')).toLowerCase().indexOf(q) > -1;
    });
  }
  SB.pesFiltered = pesFiltered;
  V.pesTable = function () {
    var list = pesFiltered(), per = 10, pages = Math.max(1, Math.ceil(list.length / per));
    if (S.pes.page > pages) S.pes.page = pages;
    var page = S.pes.page, cur = list.slice((page - 1) * per, page * per);
    if (!S.peserta.length) return SB.emptyBox('contacts', 'Belum ada peserta', 'Impor dari Excel / Google Sheets atau tambah manual.', '<button class="btn p" data-act="importBuka">' + ic('upload') + 'Impor Peserta</button>');
    if (!list.length) return SB.emptyBox('search_off', 'Tidak ada hasil', 'Coba ubah kata kunci atau filter.');
    var allOn = cur.length && cur.every(function (p) { return S.pes.sel[p.id]; });
    var rows = cur.map(function (p) {
      return '<tr><td style="width:44px"><input type="checkbox" class="chk" data-ch="pesSel" data-id="' + esc(p.id) + '"' + (S.pes.sel[p.id] ? ' checked' : '') + '></td>' +
        '<td><div class="cell">' + avatar(p.nama || p.nomor, 36) + '<div class="tx"><b>' + esc(p.nama || '(tanpa nama)') + '</b><small>Ditambahkan ' + tgl(p.dibuat) + '</small></div></div></td>' +
        '<td class="mono">' + fmtNo(p.nomor) + '</td><td>' + (p.email ? '<span class="mail">' + esc(p.email) + '</span>' : '<span class="sub">—</span>') + '</td><td><span class="pill">' + esc(p.grup) + '</span></td><td>' + badge(p.status) + '</td>' +
        '<td><div class="acts"><button class="ibtn" title="Ubah" data-act="pesEdit" data-id="' + esc(p.id) + '">' + ic('edit') + '</button><button class="ibtn" title="Hapus" data-act="pesHapus" data-id="' + esc(p.id) + '" style="color:var(--fail)">' + ic('delete') + '</button></div></td></tr>';
    }).join('');
    return '<div class="tw"><table><thead><tr><th><input type="checkbox" class="chk" data-ch="pesSelAll"' + (allOn ? ' checked' : '') + '></th><th>Peserta</th><th>Nomor WhatsApp</th><th>Email</th><th>Grup</th><th>Status</th><th style="text-align:right">Aksi</th></tr></thead><tbody>' + rows + '</tbody></table></div>' + pager(list.length, page, per, 'pesHal');
  };
  V.peserta = function () {
    var P = S.peserta, aktif = P.filter(function (p) { return p.status === 'Aktif'; }).length, gl = grupList();
    var nSel = Object.keys(S.pes.sel).length;
    var kartu = '<div class="kpis"><div class="kpi k-pink"><div class="ico">' + ic('group', 'lg') + '</div><div><div class="n">' + num(P.length) + '</div><div class="l">Total Peserta</div></div></div>' +
      '<div class="kpi k-mint"><div class="ico">' + ic('verified', 'lg') + '</div><div><div class="n">' + num(aktif) + '</div><div class="l">Peserta Aktif</div></div></div>' +
      '<div class="kpi k-peach"><div class="ico">' + ic('pause_circle', 'lg') + '</div><div><div class="n">' + num(P.length - aktif) + '</div><div class="l">Nonaktif</div></div></div>' +
      '<div class="kpi k-lav"><div class="ico">' + ic('category', 'lg') + '</div><div><div class="n">' + num(gl.length) + '</div><div class="l">Grup / Segmen</div></div></div></div>';
    var grupOpt = '<option value="">Semua grup</option>' + Array.from(new Set(P.map(function (p) { return p.grup; }))).sort().map(function (g) { return '<option' + (S.pes.grup === g ? ' selected' : '') + '>' + esc(g) + '</option>'; }).join('');
    return pageHead('Daftar Peserta Broadcast', 'Kelola kontak WhatsApp yang menjadi tujuan broadcast Anda.',
      '<button class="btn s" data-act="unduhFormat">' + ic('table_view') + 'Unduh Format CSV</button><button class="btn p" data-act="importBuka">' + ic('upload') + 'Impor Peserta</button>', num(P.length) + ' kontak') + kartu +
      '<div class="card"><div class="toolbar between" style="justify-content:space-between;margin-bottom:14px"><div class="toolbar"><div class="search"><span class="ms">search</span><input id="pesQ" data-in="pesQ" placeholder="Cari nama / nomor / email..." value="' + esc(S.pes.q) + '" autocomplete="off"></div>' +
      '<select class="inp fit" data-ch="pesGrup">' + grupOpt + '</select><select class="inp fit" data-ch="pesStatus"><option value="">Semua status</option><option' + (S.pes.status === 'Aktif' ? ' selected' : '') + '>Aktif</option><option' + (S.pes.status === 'Nonaktif' ? ' selected' : '') + '>Nonaktif</option></select></div>' +
      '<div class="toolbar"><button class="btn d sm' + (nSel ? '' : ' hide') + '" id="pesHapusSel" data-act="pesHapusSel">' + ic('delete', 'sm') + 'Hapus Terpilih (' + nSel + ')</button><button class="btn o" data-act="pesTambah">' + ic('add') + 'Tambah Manual</button></div></div>' +
      '<div id="pesTbl">' + V.pesTable() + '</div></div>';
  };

  V.modalPeserta = function (p) {
    p = p || { nama: '', nomor: '', grup: '', status: 'Aktif', email: '' };
    var gl = grupList().map(function (g) { return '<option value="' + esc(g.nama) + '">'; }).join('');
    return '<div class="mh"><div class="mi">' + ic('person_add', 'lg') + '</div><div><h3>' + (p.id ? 'Ubah Peserta' : 'Tambah Peserta') + '</h3><p>Nomor otomatis dirapikan ke format 62…</p></div></div>' +
      '<div class="mb"><div class="field"><label class="lbl">Nama</label><input class="inp" id="pmNama" value="' + esc(p.nama) + '" placeholder="Budi Santoso"></div>' +
      '<div class="field"><label class="lbl">Nomor WhatsApp</label><input class="inp" id="pmNomor" value="' + esc(p.nomor) + '" placeholder="081234567890" inputmode="tel"></div>' +
      '<div class="field"><label class="lbl">Email <span class="sub">(opsional, untuk undangan Google Calendar)</span></label><input class="inp" id="pmEmail" type="email" value="' + esc(p.email || '') + '" placeholder="budi@gmail.com" autocomplete="off"></div>' +
      '<div class="g2" style="gap:12px"><div class="field"><label class="lbl">Grup / Segmen</label><input class="inp" id="pmGrup" list="pmGrupL" value="' + esc(p.grup) + '" placeholder="Umum"><datalist id="pmGrupL">' + gl + '</datalist></div>' +
      '<div class="field"><label class="lbl">Status</label><select class="inp" id="pmStatus"><option' + (p.status === 'Aktif' ? ' selected' : '') + '>Aktif</option><option' + (p.status === 'Nonaktif' ? ' selected' : '') + '>Nonaktif</option></select></div></div>' +
      '<p id="pmErr" class="sub hide" style="color:var(--err)"></p></div>' +
      '<div class="mf"><button class="btn o" data-act="tutup">Batal</button><button class="btn p" data-act="pesSimpan" data-id="' + esc(p.id || '') + '">' + ic('check') + 'Simpan</button></div>';
  };

  V.modalImport = function (st) {
    st = st || {};
    var gl = grupList();
    var tab = st.tab || 'file';
    var ringkasan = '';
    if (st.rows) {
      var tot = st.rows.length, v = st.valid, d = st.dup, bad = st.bad;
      var pv = tot ? (v / tot) * 100 : 0, pd = tot ? (d / tot) * 100 : 0, pb = tot ? (bad / tot) * 100 : 0;
      ringkasan = '<div class="valid"><div class="row between"><b style="font-size:11px;letter-spacing:.06em;color:var(--ok-d)">RINGKASAN VALIDASI DATA</b><b style="font-size:12px">' + num(tot) + ' data terbaca</b></div>' +
        '<div class="bar"><i style="width:' + pv + '%;background:var(--ok-d)"></i><i style="width:' + pd + '%;background:#f59e0b"></i><i style="width:' + pb + '%;background:var(--err)"></i></div>' +
        '<div class="nums"><div><b style="color:var(--ok-d)">' + num(v) + ' Valid</b>Siap diimpor</div><div><b style="color:#92400e">' + num(d) + ' Duplikat</b>Akan dilewati</div><div><b style="color:var(--fail)">' + num(bad) + ' Tidak valid</b>Nomor keliru</div></div>' +
        (st.upd ? '<p class="sub" style="margin-top:10px;color:var(--ok-d)">' + ic('mail', 'sm') + ' ' + num(st.upd) + ' peserta lama akan dilengkapi emailnya.</p>' : '') + '</div>' +
        (st.contoh && st.contoh.length ? '<p class="sub" style="margin-top:10px">Contoh: ' + st.contoh.map(function (c) { return esc(c.nama || '-') + ' (' + fmtNo(c.nomor) + ')'; }).join(', ') + '</p>' : '');
    }
    var isi = tab === 'file' ?
      '<div class="drop" id="dropZone" data-act="pilihFile"><div class="ci">' + ic('cloud_upload', 'xl') + '</div><div style="font-weight:600">Tarik file Excel/CSV ke sini atau <u>klik memilih file</u></div><div class="sub" style="margin-top:4px">Format: .xlsx, .xls, .csv (kolom: nama, nomor, grup, email)</div>' +
      (st.namaFile ? '<div class="badge b-ok" style="margin-top:12px;background:#fff">' + ic('task_alt', 'sm') + esc(st.namaFile) + '</div>' : '') + '</div><input type="file" id="fileImp" accept=".xlsx,.xls,.csv,.txt" class="hide">' :
      '<textarea class="inp" id="pasteImp" rows="7" placeholder="Salin sel dari Google Sheets / Excel lalu tempel di sini.&#10;Satu baris per peserta: Nama [tab] Nomor [tab] Grup" style="font-family:ui-monospace,Menlo,monospace;font-size:12px"></textarea><button class="btn o sm" style="margin-top:8px" data-act="bacaPaste">' + ic('fact_check', 'sm') + 'Periksa Data</button>';
    return '<div class="mh"><div class="mi">' + ic('group_add', 'lg') + '</div><div class="grow"><h3>Impor Data Peserta</h3><p>Sinkronkan nomor kontak untuk broadcast serentak</p></div><button class="ibtn" data-act="tutup">' + ic('close') + '</button></div>' +
      '<div class="mb"><div class="tabs" style="width:100%;margin:8px 0 14px"><button class="grow ' + (tab === 'file' ? 'on' : '') + '" data-act="impTab" data-t="file">' + ic('table_chart', 'sm') + ' Unggah Excel / CSV</button><button class="grow ' + (tab === 'paste' ? 'on' : '') + '" data-act="impTab" data-t="paste">' + ic('content_paste', 'sm') + ' Tempel dari Sheets</button></div>' + isi + ringkasan +
      '<div class="field" style="margin-top:16px"><label class="lbl">Tambahkan ke Grup / Segmen (bila kolom grup kosong)</label><input class="inp" id="impGrup" list="impGrupL" value="' + esc(st.grup || 'Umum') + '"><datalist id="impGrupL">' + gl.map(function (g) { return '<option value="' + esc(g.nama) + '">'; }).join('') + '</datalist></div></div>' +
      '<div class="mf"><button class="btn o" data-act="tutup">Batal</button><button class="btn p" data-act="impSimpan"' + ((st.valid || st.upd) ? '' : ' disabled') + '>' + ic('check') + 'Simpan ' + (st.valid ? num(st.valid) + ' Peserta' : num(st.upd) + ' Email') + '</button></div>';
  };

  /* ============================ TEMPLATE ============================ */
  var KAT = ['Umum', 'Webinar', 'Billing', 'Promosi', 'Pengingat'];
  var KATW = { Webinar: ['#e0e7ff', '#4143d5', 'videocam'], Billing: ['#fff4de', '#ff947a', 'receipt_long'], Promosi: ['#ffe2e5', '#fa5a7d', 'local_offer'], Pengingat: ['#dcfce7', '#16a34a', 'alarm'], Umum: ['#f3e8ff', '#a855f7', 'chat'] };
  function katList() { var s = KAT.slice(); S.template.forEach(function (t) { if (s.indexOf(t.kategori) < 0) s.push(t.kategori); }); return s; }
  V.tplList = function () {
    var q = S.tpl.q.trim().toLowerCase();
    var list = S.template.filter(function (t) { return (S.tpl.kat === 'Semua' || t.kategori === S.tpl.kat) && (!q || (t.judul + ' ' + t.isi).toLowerCase().indexOf(q) > -1); });
    if (!S.template.length) return SB.emptyBox('chat_bubble', 'Belum ada template', 'Buat template pesan pertama Anda di panel kanan.');
    if (!list.length) return SB.emptyBox('search_off', 'Tidak ada template', 'Coba kata kunci atau kategori lain.');
    var edId = S.tpl.draft && S.tpl.draft.id;
    return '<div class="tgrid">' + list.map(function (t) {
      var w = KATW[t.kategori] || KATW.Umum;
      return '<div class="card tcard' + (edId === t.id ? ' on' : '') + '" style="padding:20px"><div class="row" style="align-items:flex-start"><div class="cell"><div class="ic" style="width:44px;height:44px;border-radius:14px;background:' + w[0] + ';color:' + w[1] + '">' + ic(w[2]) + '</div><div class="tx"><b style="font-size:15px;max-width:340px">' + esc(t.judul) + ' <span class="pill" style="background:' + w[0] + ';color:' + w[1] + '">' + esc(t.kategori) + '</span></b><small>Diperbarui ' + tgl(t.diperbarui, true) + '</small></div></div>' +
        '<div class="grow"></div><button class="ibtn" title="Duplikat" data-act="tplDup" data-id="' + esc(t.id) + '">' + ic('content_copy') + '</button><button class="ibtn" title="Hapus" data-act="tplHapus" data-id="' + esc(t.id) + '" style="color:var(--fail)">' + ic('delete') + '</button></div>' +
        '<div style="background:var(--bg);border-radius:14px;padding:14px;margin:14px 0;line-height:22px;white-space:pre-wrap;word-break:break-word;max-height:120px;overflow:hidden">' + SB.hiTag(t.isi) + '</div>' +
        '<div class="row between wrap"><span class="sub">' + (t.lampiran_nama ? ic('attach_file', 'sm') + ' ' + esc(t.lampiran_nama) : 'Tanpa lampiran') + '</span><div class="row gap8"><button class="btn o sm" data-act="tplEdit" data-id="' + esc(t.id) + '">' + ic('edit', 'sm') + 'Edit</button><button class="btn p sm" data-act="tplPakai" data-id="' + esc(t.id) + '">' + ic('send', 'sm') + 'Gunakan</button></div></div></div>';
    }).join('') + '</div>';
  };
  V.tplEditor = function () {
    var d = S.tpl.draft || (S.tpl.draft = { id: '', judul: '', kategori: 'Umum', isi: '', lampiran_url: '', lampiran_nama: '' });
    return '<div class="card"><div class="row between" style="margin-bottom:16px"><div class="row gap8"><span style="color:var(--primary)">' + ic('edit_note', 'lg') + '</span><h3 class="h3">' + (d.id ? 'Editor Template' : 'Template Baru') + '</h3></div><span class="badge b-ok"><i></i>' + (d.id ? 'Mengedit' : 'Draft') + '</span></div>' +
      '<div class="field"><label class="lbl">Judul Template</label><input class="inp" id="tplJudul" data-in="tplJudul" value="' + esc(d.judul) + '" placeholder="Konfirmasi Pendaftaran Webinar"></div>' +
      '<div class="g2" style="gap:12px"><div class="field"><label class="lbl">Kategori</label><select class="inp" data-ch="tplKat">' + katList().map(function (k) { return '<option' + (d.kategori === k ? ' selected' : '') + '>' + esc(k) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label class="lbl">Sisipan Cepat</label><div class="row gap8"><button class="btn o sm" data-act="tplSisip" data-v="{nama}">' + ic('add_circle', 'sm') + '{nama}</button><button class="btn o sm" data-act="tplSisip" data-v="{grup}">{grup}</button></div></div></div>' +
      '<div class="field"><label class="lbl">Isi Pesan WhatsApp <span style="font-weight:400;color:var(--text2)">· *tebal* _miring_ ~coret~</span></label><textarea class="inp" id="tplIsi" data-in="tplIsi" rows="7" placeholder="Halo {nama}, terima kasih telah mendaftar…">' + esc(d.isi) + '</textarea>' +
      '<div class="row between sub" style="margin-top:6px"><span id="tplCount">' + d.isi.length + ' karakter</span><span style="color:var(--ok-d)">' + ic('verified_user', 'sm') + ' Gunakan {nama} agar pesan personal</span></div></div>' +
      '<div class="field"><div class="row between"><label class="lbl" style="margin:0">Lampiran (opsional)</label><span class="sub">PDF / JPG / PNG · maks 5 MB</span></div>' +
      (d.lampiran_nama ? '<div class="tog" style="margin-top:6px"><div class="row gap8">' + ic('description') + '<b>' + esc(d.lampiran_nama) + '</b></div><button class="ibtn" data-act="tplHapusLamp" title="Hapus lampiran">' + ic('close') + '</button></div>' :
        '<button class="btn o" style="width:100%;margin-top:6px" data-act="tplUnggah">' + ic('cloud_upload') + 'Unggah Lampiran</button>') + '<input type="file" id="tplFile" data-ch="tplFile" accept=".pdf,.png,.jpg,.jpeg" class="hide"></div>' +
      '<div class="row" style="justify-content:flex-end"><button class="btn o" data-act="tplBatal">Batal</button><button class="btn p" data-act="tplSimpan">' + ic('save') + 'Simpan Template</button></div></div>' +
      '<div class="card" style="margin-top:24px"><div class="row gap8" style="margin-bottom:14px">' + ic('smartphone') + '<h3 class="h3">Pratinjau Nyata WhatsApp</h3></div>' +
      SB.phone({ nama: 'Budi Santoso', id: 'tplPrev', html: d.isi ? SB.waPrev(d.isi, { nama: 'Budi Santoso' }) : '', lampiran: d.lampiran_nama }) + '</div>';
  };
  V.template = function () {
    var T = S.template, R = SB.ringkas();
    var kartu = '<div class="kpis"><div class="kpi k-peach"><div class="ico">' + ic('chat', 'lg') + '</div><div><div class="n">' + num(T.length) + '</div><div class="l">Total Template</div></div></div>' +
      '<div class="kpi k-mint"><div class="ico">' + ic('check_circle', 'lg') + '</div><div><div class="n">' + num(R.terkirim) + '</div><div class="l">Pesan Terkirim</div></div></div>' +
      '<div class="kpi k-lav"><div class="ico">' + ic('person_check', 'lg') + '</div><div><div class="n">' + R.rate + '%</div><div class="l">Tingkat Keberhasilan</div></div></div>' +
      '<div class="kpi k-pink"><div class="ico">' + ic('attach_file', 'lg') + '</div><div><div class="n">' + num(T.filter(function (t) { return t.lampiran_url; }).length) + '</div><div class="l">Template Berlampiran</div></div></div></div>';
    var kat = '<div class="chips">' + ['Semua'].concat(katList()).map(function (k) { return '<button class="' + (S.tpl.kat === k ? 'on' : '') + '" data-act="tplKategori" data-k="' + esc(k) + '">' + esc(k) + '</button>'; }).join('') + '</div>';
    return pageHead('Template Pesan WhatsApp', 'Buat dan kelola template pesan dengan penanda personal <span class="tag">{nama}</span>',
      '<button class="btn p" data-act="tplBaru">' + ic('add') + 'Buat Template Baru</button>', num(T.length) + ' template') + kartu +
      '<div class="split"><div class="tgrid"><div class="card" style="padding:16px"><div class="toolbar"><div class="search"><span class="ms">search</span><input id="tplQ" data-in="tplQ" placeholder="Cari judul atau isi template…" value="' + esc(S.tpl.q) + '" autocomplete="off"></div><div class="grow" style="min-width:0">' + kat + '</div></div></div><div id="tplList">' + V.tplList() + '</div></div>' +
      '<div id="tplEd">' + V.tplEditor() + '</div></div>';
  };

  /* ============================ BROADCAST (wizard) ============================ */
  SB.wzPenerima = function () {
    var w = S.wz, a = S.peserta.filter(function (p) { return p.status === 'Aktif'; });
    if (w.mode === 'grup') return a.filter(function (p) { return w.grup.indexOf(p.grup) > -1; });
    if (w.mode === 'manual') return a.filter(function (p) { return w.ids[p.id]; });
    return a;
  };
  SB.estimasi = function (n) {
    var st = S.settings, avg = ((+st.jeda_min || 3.5) + (+st.jeda_max || 5)) / 2 + 0.6, b = Math.max(1, +st.batch_size || 25);
    return n * avg + Math.max(0, Math.ceil(n / b) - 1) * (+st.jeda_batch || 0);
  };
  V.wzKanan = function () {
    var w = S.wz, tpl = S.template.filter(function (t) { return t.id === w.tplId; })[0], pen = SB.wzPenerima(), p0 = pen[0];
    return '<div class="card" style="padding:16px"><div class="row between"><span class="row gap8"><i style="width:10px;height:10px;border-radius:50%;background:var(--ok-d)"></i><b>Pratinjau Nyata WhatsApp</b></span><span class="sub">' + (p0 ? 'Penerima: ' + esc(p0.nama || fmtNo(p0.nomor)) : 'Contoh') + '</span></div></div>' +
      SB.phone({ nama: p0 ? (p0.nama || 'Penerima') : 'Budi Santoso', id: 'wzPrev', html: tpl ? SB.waPrev(tpl.isi, { nama: p0 ? p0.nama : 'Budi Santoso', nomor: p0 ? p0.nomor : '', grup: p0 ? p0.grup : '' }) : '', lampiran: tpl && tpl.lampiran_nama }) +
      '<div class="card trio" style="padding:14px;text-align:center"><div style="background:none"><b>' + num(pen.length) + '</b><small>Total Target</small></div><div style="background:none"><b style="color:var(--ok-d)">0%</b><small>Perkiraan Gagal</small></div><div style="background:none"><b style="color:var(--primary)">100%</b><small>Format Valid</small></div></div>';
  };
  V.wzBody = function () {
    var w = S.wz, pen = SB.wzPenerima(), tpl = S.template.filter(function (t) { return t.id === w.tplId; })[0];
    var steps = ['Pilih Pesan & Template', 'Target Penerima', 'Tinjau & Jadwal Kirim'];
    var sub = [tpl ? 'Selesai • 1 Template' : 'Pilih template', pen.length ? 'Selesai • ' + num(pen.length) + ' Kontak' : 'Tentukan penerima', 'Konfigurasi akhir'];
    var hdr = '<div class="card steps" style="padding:14px">' + steps.map(function (s, i) {
      var st = i + 1 < w.step ? 'done' : (i + 1 === w.step ? 'on' : '');
      return '<div class="step ' + st + '"><div class="no">' + (st === 'done' ? ic('check') : i + 1) + '</div><div><small>LANGKAH 0' + (i + 1) + '</small><b>' + s + '</b><em>' + (st === 'done' ? sub[i] : (st === 'on' ? 'Sedang diisi' : 'Menunggu')) + '</em></div></div>';
    }).join('') + '</div>';
    var isi = '';
    if (w.step === 1) {
      var opts = S.template.map(function (t) {
        return '<button class="opt ' + (w.tplId === t.id ? 'on' : '') + '" data-act="wzTpl" data-id="' + esc(t.id) + '">' + ic(w.tplId === t.id ? 'radio_button_checked' : 'radio_button_unchecked') + '<div class="tx"><b>' + esc(t.judul) + ' <span class="pill">' + esc(t.kategori) + '</span></b><p>' + esc(t.isi) + '</p></div></button>';
      }).join('');
      isi = '<div class="card sect"><div class="sh"><div class="si" style="background:var(--peach-bg);color:var(--peach)">' + ic('campaign') + '</div><h3 class="h3">Detail Kampanye &amp; Pesan</h3></div>' +
        '<div class="field" style="margin:0"><label class="lbl">Nama Kampanye Broadcast</label><input class="inp" id="wzJudul" data-in="wzJudul" value="' + esc(w.judul) + '" placeholder="Pengingat Jadwal Webinar Batch 2"></div>' +
        '<div><label class="lbl">Pilih Template Pesan</label><div class="tgrid" style="gap:10px">' + (opts || SB.emptyBox('chat_bubble', 'Belum ada template', 'Buat template terlebih dahulu.', '<button class="btn p" data-act="go" data-r="template">' + ic('add') + 'Buat Template</button>')) + '</div></div></div>';
    } else if (w.step === 2) {
      var gl = grupList();
      var mode = '<div class="tabs"><button class="' + (w.mode === 'semua' ? 'on' : '') + '" data-act="wzMode" data-m="semua">Semua Peserta</button><button class="' + (w.mode === 'grup' ? 'on' : '') + '" data-act="wzMode" data-m="grup">Per Grup</button><button class="' + (w.mode === 'manual' ? 'on' : '') + '" data-act="wzMode" data-m="manual">Pilih Manual</button></div>';
      var det = '';
      if (w.mode === 'semua') det = '<p class="sub" style="font-size:13px">Pesan dikirim ke seluruh peserta berstatus <b>Aktif</b>.</p>';
      if (w.mode === 'grup') det = '<div class="segs">' + (gl.length ? gl.map(function (g) { return '<button class="' + (w.grup.indexOf(g.nama) > -1 ? 'on' : '') + '" data-act="wzGrup" data-g="' + esc(g.nama) + '">' + esc(g.nama) + ' <b>' + g.n + '</b></button>'; }).join('') : '<span class="sub">Belum ada grup.</span>') + '</div>';
      if (w.mode === 'manual') {
        var q = (w.q || '').toLowerCase(), aktif = S.peserta.filter(function (p) { return p.status === 'Aktif' && (!q || (p.nama + p.nomor).toLowerCase().indexOf(q) > -1); });
        det = '<div class="row gap8"><div class="search" style="width:100%"><span class="ms">search</span><input data-in="wzQ" id="wzQ" placeholder="Cari peserta…" value="' + esc(w.q || '') + '" autocomplete="off"></div><button class="btn o sm" data-act="wzSemuaTampil">Pilih tampil</button><button class="btn o sm" data-act="wzKosong">Kosongkan</button></div>' +
          '<div class="list" id="wzList">' + aktif.slice(0, 300).map(function (p) { return '<label><input type="checkbox" class="chk" data-ch="wzPilih" data-id="' + esc(p.id) + '"' + (w.ids[p.id] ? ' checked' : '') + '>' + avatar(p.nama || p.nomor, 28) + '<span class="grow"><b>' + esc(p.nama || '(tanpa nama)') + '</b> <span class="sub">' + fmtNo(p.nomor) + '</span></span><span class="pill">' + esc(p.grup) + '</span></label>'; }).join('') + '</div>';
      }
      isi = '<div class="card sect"><div class="sh"><div class="si" style="background:var(--mint-bg);color:var(--ok-d)">' + ic('group_add') + '</div><h3 class="h3 grow">Target Audiens &amp; Validasi Data</h3><span class="badge b-ok"><i></i>' + num(pen.length) + ' kontak terverifikasi</span></div>' + mode + det +
        '<div class="trio"><div><small>Nomor Valid</small><b>' + num(pen.length) + ' kontak</b></div><div><small>Duplikasi</small><b>0 (bersih)</b></div><div><small>Sumber</small><b>Google Sheets</b></div></div></div>';
    } else {
      var st = S.settings, n = pen.length, est = SB.estimasi(n), nb = Math.ceil(n / Math.max(1, +st.batch_size || 25));
      var tokOk = S.rahasia && S.rahasia.tokenAda;
      isi = '<div class="card sect"><div class="sh"><div class="si" style="background:var(--peach-bg);color:var(--peach)">' + ic('campaign') + '</div><h3 class="h3 grow">Detail Kampanye &amp; Pesan</h3><button class="btn o sm" data-act="wzStep" data-s="1">' + ic('edit', 'sm') + 'Ubah</button></div>' +
        '<div class="trio"><div><small>Kampanye</small><b style="font-size:14px">' + esc(w.judul || '-') + '</b></div><div><small>Template</small><b style="font-size:14px">' + esc(tpl ? tpl.judul : '-') + '</b></div><div><small>Penerima</small><b>' + num(n) + ' kontak</b></div></div></div>' +
        '<div class="card sect"><div class="sh"><div class="si" style="background:var(--lav-bg);color:#a855f7">' + ic('shield') + '</div><h3 class="h3 grow">Proteksi Anti-Blokir &amp; Batching</h3><span class="badge b-ok"><i></i>Mode Aman Aktif</span></div>' +
        '<div class="trio"><div><small>Ukuran Batch</small><b>' + (+st.batch_size || 25) + ' Pesan</b><br><small>Total ' + nb + ' gelombang</small></div><div><small>Jeda Antar-Pesan</small><b>' + (+st.jeda_min || 3.5) + ' – ' + (+st.jeda_max || 5) + ' Detik</b><br><small>Jeda acak dinamis</small></div><div><small>Estimasi Durasi</small><b>± ' + SB.durasi(est) + '</b><br><small>Selesai ± ' + new Date(Date.now() + est * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + '</small></div></div>' +
        '<div class="warnbox">' + ic('info') + '<div><b>Dikirim bertahap demi keamanan nomor</b><br>Pesan dikirim per gelombang dengan jeda acak agar nomor WhatsApp Anda tidak terdeteksi sebagai spam. Tab ini boleh ditutup — server tetap melanjutkan pengiriman.</div></div>' +
        (tokOk ? '' : '<div class="errbox">' + ic('error') + '<div><b>Token WhatsApp belum diisi.</b> Isi dulu di <a href="#/pengaturan" style="text-decoration:underline;font-weight:700">Pengaturan</a> sebelum mengirim.</div></div>') +
        (String(st.mode_uji) === '1' ? '<div class="infobox">' + ic('science') + '<div><b>Mode Uji Coba aktif.</b> Semua pesan hanya dikirim ke nomor uji (' + esc(fmtNo(st.nomor_uji) || 'belum diisi') + '), bukan ke peserta.</div></div>' : '') +
        '<div class="row between wrap" style="background:var(--bg);border-radius:14px;padding:10px 14px"><span class="row gap8">' + ic('schedule') + '<b>Waktu Pengiriman</b></span><div class="tabs"><button class="' + (w.jadwalOn ? '' : 'on') + '" data-act="wzJadwal" data-v="0">Kirim Langsung</button><button class="' + (w.jadwalOn ? 'on' : '') + '" data-act="wzJadwal" data-v="1">Jadwalkan</button></div></div>' +
        (w.jadwalOn ? '<div class="field" style="margin:0"><label class="lbl">Mulai kirim pada</label><input class="inp" type="datetime-local" id="wzJadwal" data-in="wzJadwal" value="' + esc(w.jadwal) + '"><p class="sub" style="margin-top:6px">Pengiriman terjadwal dijalankan oleh pemicu server (tiap 1 menit).</p></div>' : '') + '</div>';
    }
    var kembali = w.step > 1 ? '<button class="btn s" data-act="wzStep" data-s="' + (w.step - 1) + '">' + ic('arrow_back') + 'Kembali ke Langkah ' + (w.step - 1) + '</button>' : '<span></span>';
    var maju = w.step < 3 ? '<button class="btn p" data-act="wzLanjut">Lanjut ' + ic('arrow_forward') + '</button>' :
      '<button class="btn g" data-act="wzKirim"' + (S.rahasia && S.rahasia.tokenAda ? '' : ' disabled') + '>' + ic('send') + (w.jadwalOn ? 'Jadwalkan Broadcast' : 'Kirim Broadcast Sekarang') + ' (' + num(pen.length) + ' Pesan)</button>';
    return hdr + isi + '<div class="row between">' + kembali + maju + '</div>';
  };
  V.broadcast = function () {
    var aktif = SB.kampanyeAktif(), tokOk = S.rahasia && S.rahasia.tokenAda;
    var gw = '<span class="badge ' + (tokOk ? 'b-ok' : 'b-fail') + '" style="background:#fff;box-shadow:var(--shadow);color:var(--text)"><i style="color:' + (tokOk ? '#3de273' : 'var(--err)') + '"></i>GATEWAY: ' + (tokOk ? 'Siap Eksekusi' : 'Token belum diisi') + '</span>';
    var head = '<div class="pagehead"><div><div class="sub" style="font-weight:600;margin-bottom:4px">Kampanye &nbsp;›&nbsp; Wizard Pengiriman &nbsp;›&nbsp; <span style="color:var(--primary)">Langkah ' + S.wz.step + ' dari 3</span></div><h1 class="h1">Buat Broadcast WhatsApp</h1><p>Kirim pesan personal massal dengan sistem batch cerdas dan perlindungan reputasi nomor.</p></div>' + gw + '</div>';
    if (aktif) {
      return head + '<div class="card">' + SB.emptyBox('hourglass_top', 'Kampanye "' + aktif.judul + '" masih ' + aktif.status.toLowerCase(), 'Hanya satu kampanye yang boleh berjalan sekaligus agar pengiriman tetap aman. Selesaikan atau hentikan dulu.', '<button class="btn p" data-act="bukaProgres" data-id="' + esc(aktif.id) + '">' + ic('monitoring') + 'Lihat Progres</button>') + '</div>';
    }
    return head + '<div class="split"><div class="tgrid" id="wzBody">' + V.wzBody() + '</div><div class="tgrid" id="wzKanan">' + V.wzKanan() + '</div></div>';
  };

  /* ============================ PROGRES ============================ */
  SB.pgRows = function () {
    return Object.keys(PG.rows).sort().map(function (k) { return PG.rows[k]; });
  };
  V.progres = function () {
    var K = S.kampanye.filter(function (x) { return x.id === PG.id; })[0];
    if (!K) return pageHead('Progres Pengiriman', 'Belum ada kampanye yang dipilih.') + '<div class="card">' + SB.emptyBox('monitoring', 'Tidak ada kampanye', 'Buat broadcast atau pilih dari daftar kampanye.', '<button class="btn p" data-act="go" data-r="broadcast">' + ic('send') + 'Buat Broadcast</button>') + '</div>';
    var rows = SB.pgRows(), h = PG.hitung || {};
    var ter = K.terkirim, gag = K.gagal, tot = K.total, done = ter + gag;
    var mnt = isAktif(K) ? Math.max(0, tot - done) : (h.Menunggu || 0);
    var pct = tot ? Math.round((done / tot) * 100) : 0, size = PG.batch || +S.settings.batch_size || 25, nb = Math.max(1, Math.ceil(tot / size));
    var curB = Math.min(nb, Math.floor(done / size) + 1);
    var st = S.settings, est = (mnt * (((+st.jeda_min || 3.5) + (+st.jeda_max || 5)) / 2 + 0.6)) + Math.max(0, Math.ceil(mnt / size) - 1) * (+st.jeda_batch || 0);
    var live = K.status === 'Berjalan', pause = K.status === 'Dijeda', sched = K.status === 'Terjadwal', end = !isAktif(K);
    var lencana = live ? '<span class="badge b-run" style="background:var(--primary-c);color:#fff"><i style="background:#5dfd8a"></i>Transmisi Aktif • Gelombang ' + curB + ' dari ' + nb + '</span>' : badge(K.status);
    var aksi = '';
    if (live) aksi = '<button class="btn s" data-act="pgKontrol" data-a="jeda">' + ic('pause_circle') + 'Jeda Sesi</button><button class="btn d" data-act="pgKontrol" data-a="hentikan">' + ic('stop_circle') + 'Hentikan Broadcast</button>';
    else if (pause) aksi = '<button class="btn p" data-act="pgKontrol" data-a="lanjut">' + ic('play_circle') + 'Lanjutkan</button><button class="btn d" data-act="pgKontrol" data-a="hentikan">' + ic('stop_circle') + 'Hentikan</button>';
    else if (sched) aksi = '<button class="btn d" data-act="pgKontrol" data-a="hentikan">' + ic('event_busy') + 'Batalkan Jadwal</button>';
    else aksi = (gag > 0 ? '<button class="btn d" data-act="pgKontrol" data-a="ulang">' + ic('replay') + 'Kirim Ulang yang Gagal (' + gag + ')</button>' : '') + '<button class="btn p" data-act="go" data-r="broadcast">' + ic('add') + 'Broadcast Baru</button>';

    var meta = '<span class="row gap8 sub" style="font-size:12px">' + ic('event', 'sm') + 'Dimulai ' + tgl(K.waktu_mulai, true) + '</span>' +
      (live || pause ? '<span class="row gap8" style="font-size:12px;font-weight:600;color:var(--ok-d)">' + ic('hourglass_top', 'sm') + 'Estimasi rampung ~' + SB.durasi(est) + '</span>' : '') +
      (sched ? '<span class="row gap8" style="font-size:12px;font-weight:600;color:var(--pend)">' + ic('schedule', 'sm') + 'Mulai ' + tgl(K.jadwal, true) + '</span>' : '') +
      '<span class="sub" style="font-size:12px">Anti-ban interval: ' + (+st.jeda_min || 3.5) + 's – ' + (+st.jeda_max || 5) + 's</span>';
    var wait = PG.wait > 0 && live ? '<div class="infobox" style="margin-top:14px">' + ic('coffee') + '<div>Istirahat antar-gelombang: lanjut dalam <b id="pgWait">' + PG.wait + '</b> detik (menjaga reputasi nomor).</div></div>' : '';

    var head = '<div class="card"><div class="row between wrap" style="align-items:flex-start"><div><div class="row gap8 wrap">' + lencana + '</div><h1 class="h1" style="margin:8px 0 6px">' + esc(K.judul) + '</h1><div class="row wrap gap16">' + meta + '</div></div><div class="row wrap">' + aksi + '</div></div>' + wait + '</div>';

    var rate = done ? Math.round((ter / done) * 1000) / 10 : 0, err = done ? Math.round((gag / done) * 1000) / 10 : 0;
    var kartu = '<div class="kpis">' +
      '<div class="kpi k-mint"><div class="row between"><div class="ico">' + ic('check_circle', 'lg') + '</div><b style="font-size:11px">' + rate + '% DELIVERY</b></div><div><div class="n">' + num(ter) + '</div><div class="l">Terkirim Berhasil</div></div></div>' +
      '<div class="kpi k-pink"><div class="row between"><div class="ico">' + ic('error', 'lg') + '</div><b style="font-size:11px;color:var(--fail)">' + err + '% ERROR</b></div><div><div class="n">' + num(gag) + '</div><div class="l">Gagal Terkirim</div></div></div>' +
      '<div class="kpi k-peach"><div class="row between"><div class="ico">' + ic('hourglass_empty', 'lg') + '</div><b style="font-size:11px">ANTREAN</b></div><div><div class="n">' + num(mnt) + '</div><div class="l">Menunggu Dikirim</div></div></div>' +
      '<div class="kpi k-lav"><div class="row between"><div class="ico">' + ic('groups', 'lg') + '</div><b style="font-size:11px;color:#7e22ce">TARGET</b></div><div><div class="n">' + num(tot) + '</div><div class="l">Total Penerima</div></div></div></div>';

    var bt = [];
    if (rows.length) {
      var lo = 0, hi = nb; if (nb > 8) { lo = Math.max(0, Math.min(curB - 3, nb - 8)); hi = lo + 8; }
      for (var b = lo; b < hi; b++) {
        var sl = rows.slice(b * size, (b + 1) * size), s = 0, g = 0, m = 0;
        sl.forEach(function (r) { if (r.status === 'Berhasil') s++; else if (r.status === 'Gagal') g++; else if (r.status === 'Menunggu') m++; });
        var selesai = sl.length && m === 0, jalan = !selesai && s + g > 0 || (b + 1 === curB && live);
        var cls = selesai ? 'b-ok' : (jalan && live ? 'b-run' : 'b-draft'), lbl = selesai ? 'Selesai' : (jalan && live ? 'Berjalan' : (pause && jalan ? 'Dijeda' : 'Antrean'));
        bt.push('<div class="batch ' + (jalan && live ? 'on' : '') + '"><div class="row between"><b>Gelombang ' + (b + 1) + ' <span class="sub">• ' + (b * size + 1) + '–' + Math.min(tot, (b + 1) * size) + '</span></b><span class="badge ' + cls + '" style="padding:2px 8px">' + lbl + '</span></div>' +
          '<div class="row between sub"><span>' + (selesai ? 'Hasil kirim' : 'Diproses ' + (s + g) + '/' + sl.length) + '</span><b style="color:var(--text)">' + s + ' sukses' + (g ? ' • ' + g + ' gagal' : '') + '</b></div><div class="t"><i style="width:' + (sl.length ? ((s + g) / sl.length) * 100 : 0) + '%"></i></div></div>');
      }
    }
    var proses = '<div class="card"><div class="row between wrap"><div><span class="sub" style="font-weight:700;letter-spacing:.05em">STATUS PEMROSESAN</span><div class="h2" style="margin-top:2px">' + num(done) + ' / ' + num(tot) + ' Pesan Diproses <span style="color:var(--primary);font-size:16px">(' + pct + '%)</span></div></div>' +
      '<div class="row gap16 sub" style="font-weight:600"><span class="row gap8"><i style="width:8px;height:8px;border-radius:50%;background:var(--ok-d)"></i>Batch aktif: #' + curB + '</span><span class="row gap8"><i style="width:8px;height:8px;border-radius:50%;background:var(--primary-c)"></i>Jeda: ' + (+st.jeda_min || 3.5) + '–' + (+st.jeda_max || 5) + ' dtk</span></div></div>' +
      '<div class="pgbig" style="margin-top:14px"><i style="width:' + pct + '%"></i></div><div class="batches">' + (bt.join('') || '<div class="skel" style="height:80px"></div>') + '</div></div>';

    var fl = PG.filter, proc = rows.filter(function (r) { return r.waktu; }).sort(function (a, b) { return a.waktu < b.waktu ? 1 : -1; });
    var nOk = proc.filter(function (r) { return r.status === 'Berhasil'; }).length, nGg = proc.filter(function (r) { return r.status === 'Gagal'; }).length;
    var tampil = proc.filter(function (r) { return fl === 'semua' || (fl === 'ok' && r.status === 'Berhasil') || (fl === 'gagal' && r.status === 'Gagal'); }).slice(0, 50);
    var strm = tampil.map(function (r) {
      var gg = r.status === 'Gagal';
      return '<tr class="' + (gg ? 'rf' : '') + '"><td style="white-space:nowrap"><b class="mono" style="' + (gg ? 'color:var(--fail)' : '') + '">' + SB.jam(r.waktu) + '</b><br><small class="sub mono">#' + esc(r.id.split('-').pop()) + '</small></td>' +
        '<td><div class="cell">' + avatar(r.nama || r.nomor, 34) + '<div class="tx"><b>' + esc(r.nama || '(tanpa nama)') + '</b><small>' + esc(r.pesan || '') + '…</small></div></div></td><td class="mono" style="white-space:nowrap">' + fmtNo(r.nomor) + '</td>' +
        '<td>' + badge(r.status) + (gg ? '<div class="sub" style="color:var(--fail);margin-top:2px">' + esc(r.error || '') + '</div>' : '') + '</td></tr>';
    }).join('');
    var stream = '<div class="card"><div class="row between wrap"><div><div class="row gap8"><i style="width:10px;height:10px;border-radius:50%;background:' + (live ? 'var(--ok-d)' : 'var(--text2)') + '"></i><h2 class="h2" style="font-size:18px">Live Transmission Stream</h2></div><span class="sub">Aktivitas pengiriman terkini</span></div>' +
      '<div class="tabs"><button class="' + (fl === 'semua' ? 'on' : '') + '" data-act="pgFilter" data-f="semua">Semua (' + proc.length + ')</button><button class="' + (fl === 'ok' ? 'on' : '') + '" data-act="pgFilter" data-f="ok">Berhasil (' + nOk + ')</button><button class="' + (fl === 'gagal' ? 'on' : '') + '" data-act="pgFilter" data-f="gagal">Gagal (' + nGg + ')</button></div></div>' +
      '<div class="tw" style="margin-top:12px">' + (tampil.length ? '<table class="stream"><thead><tr><th>Waktu &amp; ID</th><th>Penerima</th><th>Nomor WhatsApp</th><th>Status</th></tr></thead><tbody>' + strm + '</tbody></table>' : SB.emptyBox('mark_chat_unread', live ? 'Menunggu pesan pertama…' : 'Belum ada aktivitas', 'Log pengiriman akan muncul di sini secara otomatis.')) + '</div>' +
      '<div class="row between wrap" style="padding-top:12px"><span class="sub">' + ic('sync', 'sm') + ' Menampilkan ' + tampil.length + ' transmisi terkini</span><button class="btn o sm" data-act="pgUnduhLog">' + ic('download', 'sm') + 'Unduh Log CSV</button></div></div>';
    return head + kartu + proses + stream;
  };

  /* ============================ RIWAYAT & LAPORAN ============================ */
  SB.rwFiltered = function () {
    var f = S.rw, q = f.q.trim().toLowerCase(), t1 = f.tgl1 ? Date.parse(f.tgl1 + 'T00:00:00') : 0, t2 = f.tgl2 ? Date.parse(f.tgl2 + 'T23:59:59') : 9e15;
    return (S.riwayat || []).filter(function (r) {
      if (f.kampanye && r.kampanye_id !== f.kampanye) return false;
      if (f.status && r.status !== f.status) return false;
      if (t1 || f.tgl2) { var t = Date.parse(r.waktu || ''); if (isNaN(t) || t < t1 || t > t2) return false; }
      return !q || (r.nama + ' ' + r.nomor).toLowerCase().indexOf(q) > -1;
    }).slice().reverse();
  };
  V.rwTable = function () {
    if (S.riwayat === null) return SB.skeleton(6);
    var list = SB.rwFiltered(), per = 12, pages = Math.max(1, Math.ceil(list.length / per));
    if (S.rw.page > pages) S.rw.page = pages;
    if (!S.riwayat.length) return SB.emptyBox('history', 'Belum ada riwayat pengiriman', 'Riwayat per penerima muncul setelah broadcast dikirim.');
    if (!list.length) return SB.emptyBox('search_off', 'Tidak ada data', 'Ubah filter pencarian Anda.');
    var jd = {}; S.kampanye.forEach(function (k) { jd[k.id] = k.judul; });
    var cur = list.slice((S.rw.page - 1) * per, S.rw.page * per);
    return '<div class="tw"><table><thead><tr><th>Waktu</th><th>Kampanye</th><th>Penerima</th><th>Nomor</th><th>Status</th><th>Keterangan</th></tr></thead><tbody>' + cur.map(function (r) {
      return '<tr><td style="white-space:nowrap">' + (r.waktu ? tgl(r.waktu, true) : '-') + '</td><td><b style="font-weight:600">' + esc(jd[r.kampanye_id] || r.kampanye_id) + '</b></td><td><div class="cell">' + avatar(r.nama || r.nomor, 30) + '<span>' + esc(r.nama || '-') + '</span></div></td><td class="mono">' + fmtNo(r.nomor) + '</td><td>' + badge(r.status) + '</td><td class="sub" style="color:' + (r.error ? 'var(--fail)' : 'var(--text2)') + '">' + esc(r.error || '') + '</td></tr>';
    }).join('') + '</tbody></table></div>' + pager(list.length, S.rw.page, per, 'rwHal');
  };
  V.riwayatWa = function () {
    var K = S.kampanye, kron = urut(K), thn = new Date().getFullYear(), ter = [], gag = [];
    for (var i = 0; i < 12; i++) { ter.push(0); gag.push(0); }
    K.forEach(function (k) { var d = new Date(k.waktu_mulai); if (isNaN(d) || d.getFullYear() !== thn) return; ter[d.getMonth()] += +k.terkirim || 0; gag[d.getMonth()] += +k.gagal || 0; });
    var bars = K.length ? SB.barGroups(kron.slice(-6).map(function (k) { return { label: k.judul.slice(0, 10), a: +k.terkirim || 0, b: +k.gagal || 0 }; }), '#5b5fef', '#5dfd8a') + '<div class="legend"><span><i style="background:#5b5fef"></i>Terkirim</span><span><i style="background:#5dfd8a"></i>Gagal</span></div>' : SB.emptyBox('bar_chart', 'Belum ada data', '');
    var line = K.length ? SB.lineChart(BULAN, [{ name: 'Terkirim', color: '#5b5fef', vals: ter, area: true }, { name: 'Gagal', color: '#fa5a7d', vals: gag }]) : SB.emptyBox('show_chart', 'Belum ada data', '');
    var opsiK = '<option value="">Semua kampanye</option>' + kron.slice().reverse().map(function (k) { return '<option value="' + esc(k.id) + '"' + (S.rw.kampanye === k.id ? ' selected' : '') + '>' + esc(k.judul) + '</option>'; }).join('');
    var opsiS = ['', 'Berhasil', 'Gagal', 'Menunggu', 'Dibatalkan'].map(function (s) { return '<option value="' + s + '"' + (S.rw.status === s ? ' selected' : '') + '>' + (s ? (s === 'Berhasil' ? 'Terkirim' : s) : 'Semua status') + '</option>'; }).join('');
    return pageHead('Riwayat &amp; Laporan', 'Analisis hasil broadcast dan unduh laporan pengiriman.', '<button class="btn s" data-act="rwExcel">' + ic('table_view') + 'Unduh Excel</button><button class="btn s" data-act="rwPdf">' + ic('picture_as_pdf') + 'Unduh PDF</button>') +
      '<div class="g2"><div class="card"><h3 class="h3">Berhasil vs Gagal per Kampanye</h3><span class="sub">6 kampanye terakhir</span>' + bars + '</div><div class="card"><h3 class="h3">Tren Pengiriman</h3><span class="sub">Volume pesan ' + thn + '</span><div style="margin-top:10px">' + line + '</div></div></div>' +
      '<div class="card"><div class="row between wrap" style="margin-bottom:14px"><div><h2 class="h2" style="font-size:18px">Riwayat Pengiriman</h2><span class="sub">Detail per penerima</span></div><div class="toolbar"><div class="search"><span class="ms">search</span><input id="rwQ" data-in="rwQ" placeholder="Cari nama / nomor…" value="' + esc(S.rw.q) + '" autocomplete="off"></div>' +
      '<select class="inp fit" data-ch="rwKamp" style="max-width:200px">' + opsiK + '</select><select class="inp fit" data-ch="rwStatus">' + opsiS + '</select>' +
      '<input class="inp fit" type="date" data-ch="rwTgl1" value="' + esc(S.rw.tgl1) + '" title="Dari tanggal"><input class="inp fit" type="date" data-ch="rwTgl2" value="' + esc(S.rw.tgl2) + '" title="Sampai tanggal"></div></div><div id="rwTbl">' + V.rwTable() + '</div></div>';
  };

  /* ---- riwayat agenda & email ---- */
  var JENIS_AG = ['Undangan Kalender', 'Email Pengingat', 'Pembatalan Kalender'];
  var JENIS_IKON = { 'Undangan Kalender': 'calendar_month', 'Email Pengingat': 'mail', 'Pembatalan Kalender': 'event_busy' };
  SB.rwaFiltered = function () {
    var f = S.rwa, q = f.q.trim().toLowerCase(), t1 = f.tgl1 ? Date.parse(f.tgl1 + 'T00:00:00') : 0, t2 = f.tgl2 ? Date.parse(f.tgl2 + 'T23:59:59') : 9e15;
    return (S.logAg || []).filter(function (r) {
      if (f.agenda && r.agenda_id !== f.agenda) return false;
      if (f.jenis && r.jenis !== f.jenis) return false;
      if (f.status && r.status !== f.status) return false;
      if (t1 || f.tgl2) { var t = Date.parse(r.waktu || ''); if (isNaN(t) || t < t1 || t > t2) return false; }
      return !q || (r.nama + ' ' + r.email + ' ' + r.judul).toLowerCase().indexOf(q) > -1;
    }).slice().reverse();
  };
  V.rwaTable = function () {
    if (S.logAg === null) return SB.skeleton(6);
    var list = SB.rwaFiltered(), per = 12, pages = Math.max(1, Math.ceil(list.length / per));
    if (S.rwa.page > pages) S.rwa.page = pages;
    if (!S.logAg.length) return SB.emptyBox('history', 'Belum ada riwayat agenda', 'Jejak undangan kalender dan email pengingat muncul setelah Anda membuat agenda.', '<button class="btn p" data-act="go" data-r="agenda">' + ic('calendar_month') + 'Buat Agenda</button>');
    if (!list.length) return SB.emptyBox('search_off', 'Tidak ada data', 'Ubah filter pencarian Anda.');
    var cur = list.slice((S.rwa.page - 1) * per, S.rwa.page * per);
    return '<div class="tw"><table><thead><tr><th>Waktu</th><th>Agenda</th><th>Jenis</th><th>Penerima</th><th>Email</th><th>Status</th><th>Keterangan</th></tr></thead><tbody>' + cur.map(function (r) {
      return '<tr><td style="white-space:nowrap">' + (r.waktu ? tgl(r.waktu, true) : '-') + '</td><td><b style="font-weight:600">' + esc(r.judul) + '</b></td>' +
        '<td><span class="pill">' + ic(JENIS_IKON[r.jenis] || 'event', 'sm') + ' ' + esc(r.jenis) + '</span></td>' +
        '<td><div class="cell">' + avatar(r.nama || r.email, 30) + '<span>' + esc(r.nama || '-') + '</span></div></td><td><span class="mail">' + esc(r.email) + '</span></td>' +
        '<td>' + badge(r.status) + '</td><td class="sub" style="color:' + (r.error ? 'var(--fail)' : 'var(--text2)') + '">' + esc(r.error || '') + '</td></tr>';
    }).join('') + '</tbody></table></div>' + pager(list.length, S.rwa.page, per, 'rwaHal');
  };
  V.riwayatAgenda = function () {
    var L = S.logAg || [], n = function (j, s) { return L.filter(function (x) { return x.jenis === j && (!s || x.status === s); }).length; };
    var kartu = '<div class="kpis"><div class="kpi k-lav"><div class="ico">' + ic('calendar_month', 'lg') + '</div><div><div class="n">' + num(n('Undangan Kalender')) + '</div><div class="l">Undangan Kalender</div></div></div>' +
      '<div class="kpi k-mint"><div class="ico">' + ic('mark_email_read', 'lg') + '</div><div><div class="n">' + num(n('Email Pengingat', 'Terkirim')) + '</div><div class="l">Email Terkirim</div></div></div>' +
      '<div class="kpi k-pink"><div class="ico">' + ic('error', 'lg') + '</div><div><div class="n">' + num(L.filter(function (x) { return x.status === 'Gagal'; }).length) + '</div><div class="l">Gagal</div></div></div>' +
      '<div class="kpi k-peach"><div class="ico">' + ic('event_busy', 'lg') + '</div><div><div class="n">' + num(n('Pembatalan Kalender')) + '</div><div class="l">Pemberitahuan Batal</div></div></div></div>';
    var ag = {}; L.forEach(function (x) { ag[x.agenda_id] = x.judul; });
    var opsiA = '<option value="">Semua agenda</option>' + Object.keys(ag).reverse().map(function (id) { return '<option value="' + esc(id) + '"' + (S.rwa.agenda === id ? ' selected' : '') + '>' + esc(ag[id]) + '</option>'; }).join('');
    var opsiJ = '<option value="">Semua jenis</option>' + JENIS_AG.map(function (j) { return '<option' + (S.rwa.jenis === j ? ' selected' : '') + '>' + j + '</option>'; }).join('');
    var opsiS = ['', 'Diundang', 'Terkirim', 'Gagal', 'Diberitahu'].map(function (s) { return '<option value="' + s + '"' + (S.rwa.status === s ? ' selected' : '') + '>' + (s || 'Semua status') + '</option>'; }).join('');
    return pageHead('Riwayat &amp; Laporan', 'Jejak undangan Google Calendar dan email pengingat per penerima.', '<button class="btn s" data-act="rwaExcel">' + ic('table_view') + 'Unduh Excel</button><button class="btn s" data-act="rwaPdf">' + ic('picture_as_pdf') + 'Unduh PDF</button>') + kartu +
      '<div class="card"><div class="row between wrap" style="margin-bottom:14px"><div><h2 class="h2" style="font-size:18px">Riwayat Agenda &amp; Email</h2><span class="sub">"Diundang" berarti undangan telah dikirim Google Calendar; kehadiran dan pembukaan email tidak dapat dilacak.</span></div>' +
      '<div class="toolbar"><div class="search"><span class="ms">search</span><input data-in="rwaQ" placeholder="Cari nama / email..." value="' + esc(S.rwa.q) + '" autocomplete="off"></div>' +
      '<select class="inp fit" data-ch="rwaAg" style="max-width:200px">' + opsiA + '</select><select class="inp fit" data-ch="rwaJenis">' + opsiJ + '</select><select class="inp fit" data-ch="rwaStatus">' + opsiS + '</select>' +
      '<input class="inp fit" type="date" data-ch="rwaTgl1" value="' + esc(S.rwa.tgl1) + '" title="Dari tanggal"><input class="inp fit" type="date" data-ch="rwaTgl2" value="' + esc(S.rwa.tgl2) + '" title="Sampai tanggal"></div></div><div id="rwaTbl">' + V.rwaTable() + '</div></div>';
  };
  V.riwayat = function () {
    var t = S.rw.tab === 'ag' ? 'ag' : 'wa';
    return '<div class="tabs" style="margin-bottom:16px"><button class="' + (t === 'wa' ? 'on' : '') + '" data-act="rwTab" data-t="wa">' + ic('send', 'sm') + ' Broadcast WhatsApp</button><button class="' + (t === 'ag' ? 'on' : '') + '" data-act="rwTab" data-t="ag">' + ic('calendar_month', 'sm') + ' Agenda &amp; Email</button></div>' +
      (t === 'ag' ? V.riwayatAgenda() : V.riwayatWa());
  };

  /* ============================ AGENDA ============================ */
  var REM_OPT = [[10080, '1 minggu'], [4320, '3 hari'], [1440, '1 hari'], [180, '3 jam'], [60, '1 jam'], [30, '30 menit'], [10, '10 menit']];
  var EMAIL_OPT = [[0, 'Tidak kirim'], [1440, '1 hari sebelum'], [180, '3 jam sebelum'], [60, '1 jam sebelum'], [30, '30 menit sebelum']];
  function durasi(m) { m = +m; return m >= 1440 ? (m / 1440) + ' hari' : m >= 60 ? (m / 60) + ' jam' : m + ' mnt'; }
  function tamuHitung() {
    var a = S.ag, seen = {}, n = 0, tanpa = 0;
    S.peserta.forEach(function (p) {
      if (p.status !== 'Aktif') return;
      if (a.mode === 'grup' && a.grup.indexOf(p.grup) < 0) return;
      if (p.email && !seen[p.email]) { seen[p.email] = 1; n++; } else if (!p.email) tanpa++;
    });
    return { n: n, tanpa: tanpa };
  }
  SB.tamuHitung = tamuHitung;
  V.agInfo = function () {
    var t = tamuHitung();
    return '<div class="agbox ' + (t.n ? 'ok' : 'warn') + '">' + ic(t.n ? 'mark_email_read' : 'warning') + '<div><b>' + num(t.n) + ' peserta akan menerima undangan</b>' +
      '<span>' + (t.tanpa ? num(t.tanpa) + ' peserta aktif lain belum punya email dan dilewati. ' : 'Semua peserta pada target ini punya email. ') +
      '<a href="#/peserta" class="lnk">Lengkapi email</a></span></div></div>';
  };
  V.agenda = function () {
    var a = S.ag, gl = grupList();
    var list = S.agenda.slice().sort(function (x, y) { return x.mulai < y.mulai ? 1 : -1; });
    var nAktif = list.filter(function (x) { return x.status === 'Aktif'; }).length;
    var mode = '<div class="tabs"><button class="' + (a.mode === 'semua' ? 'on' : '') + '" data-act="agMode" data-m="semua">Semua Peserta</button><button class="' + (a.mode === 'grup' ? 'on' : '') + '" data-act="agMode" data-m="grup">Per Grup</button></div>';
    var grup = a.mode === 'grup' ? '<div class="segs" style="margin-top:10px">' + (gl.length ? gl.map(function (g) { return '<button class="' + (a.grup.indexOf(g.nama) > -1 ? 'on' : '') + '" data-act="agGrup" data-g="' + esc(g.nama) + '">' + esc(g.nama) + ' <b>' + g.n + '</b></button>'; }).join('') : '<span class="sub">Belum ada grup.</span>') + '</div>' : '';
    var rem = '<div class="segs">' + REM_OPT.map(function (o) { return '<button class="' + (a.rem.indexOf(o[0]) > -1 ? 'on' : '') + '" data-act="agRem" data-m="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>';
    var em = '<div class="segs">' + EMAIL_OPT.map(function (o) { return '<button class="' + (a.email === o[0] ? 'on' : '') + '" data-act="agEmail" data-m="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>';
    var form = '<div class="card"><div class="row gap8" style="margin-bottom:14px"><div class="mi" style="width:40px;height:40px">' + ic('event_available') + '</div><div><h2 class="h2" style="font-size:18px">Buat Agenda &amp; Undangan Kalender</h2><span class="sub">Peserta menerima undangan di email dan Google Calendar mereka</span></div></div>' +
      '<div class="field"><label class="lbl">Nama Agenda</label><input class="inp" data-in="agJudul" value="' + esc(a.judul) + '" placeholder="Webinar AI Automation" maxlength="120"></div>' +
      '<div class="g2" style="gap:12px"><div class="field"><label class="lbl">Mulai</label><input class="inp" type="datetime-local" data-in="agMulai" data-ch="agMulai" value="' + esc(a.mulai) + '"></div>' +
      '<div class="field"><label class="lbl">Selesai</label><input class="inp" type="datetime-local" data-in="agSelesai" value="' + esc(a.selesai) + '"></div></div>' +
      '<div class="field"><label class="lbl">Lokasi / Link meeting <span class="sub">(opsional)</span></label><input class="inp" data-in="agLokasi" value="' + esc(a.lokasi) + '" placeholder="Zoom: https://zoom.us/j/..." maxlength="200"></div>' +
      '<div class="field"><label class="lbl">Deskripsi <span class="sub">(opsional)</span></label><textarea class="inp" rows="3" data-in="agDeskripsi" placeholder="Materi, yang perlu disiapkan, dll." maxlength="2000">' + esc(a.deskripsi) + '</textarea></div>' +
      '<div class="field"><label class="lbl">Undang</label>' + mode + grup + '</div><div id="agInfo">' + V.agInfo() + '</div>' +
      '<div class="field" style="margin-top:14px"><label class="lbl">Pengingat di Google Calendar <span class="sub">(maks. 5)</span></label>' + rem + '</div>' +
      '<div class="field"><label class="lbl">Email pengingat tambahan dari SiBlast</label>' + em + '<span class="sub" style="display:block;margin-top:6px">Dikirim otomatis oleh server (akurasi ±5 menit). Memakai kuota email harian akun Google Anda.</span></div>' +
      '<button class="btn p" id="agKirim" data-act="agSimpan" style="width:100%;justify-content:center"' + (a.busy ? ' disabled' : '') + '>' + ic('calendar_month') + 'Buat Agenda &amp; Kirim Undangan</button></div>';
    var kartu = list.map(function (x) {
      var aktif = x.status === 'Aktif', tmp = x.id.indexOf('tmp_') === 0;
      var em2 = x.email_pengingat > 0 ? ' · Email: ' + (x.email_terkirim === '1' ? 'terkirim' : x.email_terkirim === 'lewat' ? 'terlewat' : durasi(x.email_pengingat) + ' sebelum') : '';
      return '<div class="agcard' + (aktif ? '' : ' off') + '"><div class="row between"><b class="agt">' + esc(x.judul) + '</b>' + SB.badge(tmp ? 'Membuat' : x.status) + '</div>' +
        '<div class="agm">' + ic('schedule', 'sm') + ' ' + esc(SB.tgl(x.mulai, true)) + '</div>' +
        (x.lokasi ? '<div class="agm">' + ic('location_on', 'sm') + ' ' + esc(x.lokasi) + '</div>' : '') +
        '<div class="agm">' + ic('group', 'sm') + ' ' + num(x.tamu) + ' undangan · ' + esc(x.grup_target === 'Semua' ? 'Semua peserta' : x.grup_target) + '</div>' +
        '<div class="agm">' + ic('notifications_active', 'sm') + ' Kalender: ' + esc(String(x.pengingat).split(',').map(durasi).join(', ')) + em2 + '</div>' +
        (aktif && !tmp ? '<div class="acts" style="margin-top:10px"><button class="btn o sm" data-act="agMailSekarang" data-id="' + esc(x.id) + '">' + ic('mail', 'sm') + 'Kirim pengingat email sekarang</button><button class="btn d sm" data-act="agBatal" data-id="' + esc(x.id) + '">' + ic('event_busy', 'sm') + 'Batalkan</button></div>' : '') + '</div>';
    }).join('');
    var kanan = '<div class="card"><div class="row between"><div><h2 class="h2" style="font-size:18px">Daftar Agenda</h2><span class="sub">Undangan yang pernah dibuat</span></div><span class="pill">' + nAktif + ' aktif</span></div><div style="margin-top:14px" class="aglist">' +
      (list.length ? kartu : SB.emptyBox('event', 'Belum ada agenda', 'Isi formulir di samping untuk membuat agenda pertama.')) + '</div></div>';
    return pageHead('Agenda &amp; Pengingat Kalender', 'Kirim undangan Google Calendar agar peserta mendapat notifikasi pengingat agenda.', '', num(list.length) + ' agenda') +
      '<div class="split">' + form + kanan + '</div>';
  };

  /* ============================ PENGATURAN ============================ */
  function sw(id, on) { return '<span class="sw"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '><i></i></span>'; }
  V.pengaturan = function () {
    var st = S.settings, rh = S.rahasia || {}, gw = S.gw;
    var statusKonek = gw ? (gw.terhubung ? '<div class="statusbox"><div class="ava" style="width:44px;height:44px;background:#fff;color:var(--ok-d)">' + ic('smartphone', 'lg') + '</div><div class="grow"><b>' + esc(gw.perangkat || 'Perangkat WhatsApp') + '</b><br><small class="sub">' + esc(gw.nomor ? fmtNo(gw.nomor) : '') + (gw.kuota !== '' ? ' • Sisa kuota: ' + esc(gw.kuota) : '') + '</small></div><span class="badge b-ok"><i></i>Terhubung</span></div>' :
      '<div class="statusbox off"><div class="ava" style="width:44px;height:44px;background:#fff;color:var(--fail)">' + ic('link_off', 'lg') + '</div><div class="grow"><b>Perangkat belum terhubung</b><br><small class="sub">Scan QR di dashboard penyedia WhatsApp Anda.</small></div></div>') :
      '<div class="statusbox' + (rh.tokenAda ? '' : ' off') + '"><div class="ava" style="width:44px;height:44px;background:#fff;color:' + (rh.tokenAda ? 'var(--ok-d)' : 'var(--fail)') + '">' + ic(rh.tokenAda ? 'key' : 'key_off', 'lg') + '</div><div class="grow"><b>' + (rh.tokenAda ? 'Token tersimpan aman' : 'Token belum diisi') + '</b><br><small class="sub">' + (rh.tokenAda ? 'Klik “Tes Koneksi” untuk memeriksa status perangkat.' : 'Isi token dari penyedia WhatsApp Gateway.') + '</small></div></div>';
    var koneksi = '<div class="card sect"><div class="sh"><div class="si" style="background:var(--mint-bg);color:var(--ok-d)">' + ic('phone_in_talk') + '</div><div class="grow"><h3 class="h3">Koneksi WhatsApp Gateway</h3><span class="sub">Token disimpan terenkripsi di Script Properties</span></div></div>' + statusKonek +
      '<div class="field" style="margin:0"><label class="lbl">Penyedia WhatsApp</label><select class="inp" id="stProvider"><option value="fonnte">Fonnte (direkomendasikan — mendukung file &amp; gambar)</option></select></div>' +
      '<div class="field" style="margin:0"><label class="lbl">Token API WhatsApp Gateway ' + (rh.tokenAda ? '<span style="font-weight:400;color:var(--text2)">· tersimpan: ' + esc(rh.tokenSamar) + '</span>' : '') + '</label><div class="iw">' + ic('key') + '<input class="inp" id="stToken" type="password" autocomplete="new-password" placeholder="' + (rh.tokenAda ? 'Kosongkan bila tidak diubah' : 'Tempel token di sini') + '" style="padding-left:46px"><span class="ms eye" data-act="lihatToken">visibility</span></div></div>' +
      '<div class="infobox">' + ic('shield_lock') + '<div>Token <b>tidak pernah</b> dikirim kembali ke browser maupun ditulis di Google Sheets — hanya disimpan di Script Properties.</div></div>' +
      '<div class="field" style="margin:0"><label class="lbl">Nomor Pengirim (catatan)</label><input class="inp" id="stPengirim" value="' + esc(st.nomor_pengirim || '') + '" placeholder="+62 812-3456-7890"></div>' +
      '<div class="row wrap"><button class="btn o" data-act="tesKoneksi">' + ic('wifi_tethering') + 'Tes Koneksi</button><button class="btn p" data-act="simpanToken">' + ic('save') + 'Simpan Token</button>' + (rh.tokenAda ? '<button class="btn d" data-act="hapusToken">' + ic('link_off') + 'Putus</button>' : '') + '</div></div>';
    var mesin = '<div class="card sect"><div class="sh"><div class="si" style="background:var(--lav-bg);color:#a855f7">' + ic('speed') + '</div><div class="grow"><h3 class="h3">Mesin Pengiriman &amp; Anti-Blokir</h3><span class="sub">Menghindari limit WhatsApp &amp; batas 6 menit Apps Script</span></div></div>' +
      '<div style="background:var(--bg);border-radius:16px;padding:16px"><div class="row between"><b>Jeda Antar-Pesan</b><span class="pill" id="lbJeda">' + (+st.jeda_min || 3.5) + ' – ' + (+st.jeda_max || 5) + ' detik</span></div>' +
      '<div class="row gap16" style="margin-top:12px"><div class="grow"><small class="sub">Minimum</small><input class="slider" type="range" id="stJmin" min="1" max="15" step="0.5" value="' + (+st.jeda_min || 3.5) + '" data-in="stJeda"></div><div class="grow"><small class="sub">Maksimum</small><input class="slider" type="range" id="stJmax" min="1" max="20" step="0.5" value="' + (+st.jeda_max || 5) + '" data-in="stJeda"></div></div></div>' +
      '<div class="g2" style="gap:12px"><div style="background:var(--bg);border-radius:16px;padding:14px;text-align:center"><small class="sub">Ukuran per Gelombang</small><div class="stepper" style="margin-top:8px"><button data-act="step" data-t="stBatch" data-d="-5">−</button><b id="stBatchV">' + (+st.batch_size || 25) + '</b><button data-act="step" data-t="stBatch" data-d="5">+</button></div><small class="sub">pesan</small></div>' +
      '<div style="background:var(--bg);border-radius:16px;padding:14px;text-align:center"><small class="sub">Istirahat Antar Gelombang</small><div class="stepper" style="margin-top:8px"><button data-act="step" data-t="stIst" data-d="-10">−</button><b id="stIstV">' + (+st.jeda_batch || 0) + '</b><button data-act="step" data-t="stIst" data-d="10">+</button></div><small class="sub">detik</small></div></div>' +
      '<div class="tog"><div><b>Jeda Acak Dinamis</b><p>Tambah variasi acak ±0,6 detik di tiap pengiriman.</p></div>' + sw('stAcak', String(st.jeda_acak) === '1') + '</div>' +
      '<div class="tog"><div><b>Auto-Retry 1× Pesan Gagal</b><p>Coba ulang otomatis bila gateway sempat putus.</p></div>' + sw('stRetry', String(st.auto_retry) === '1') + '</div>' +
      '<div class="warnbox" style="flex-direction:column;gap:10px"><div class="row between gap16" style="align-items:flex-start"><div><b>Mode Uji Coba (Sandbox)</b><br>Semua pesan hanya dikirim ke nomor uji di bawah — aman untuk mencoba.</div>' + sw('stUji', String(st.mode_uji) === '1') + '</div><input class="inp" id="stNoUji" value="' + esc(st.nomor_uji || '') + '" placeholder="Nomor uji, mis. 081234567890" style="background:#fff"></div></div>';
    var sheet = '<div class="card sect"><div class="sh"><div class="si" style="background:var(--peach-bg);color:var(--peach)">' + ic('table_chart') + '</div><div class="grow"><h3 class="h3">Database Google Sheets</h3><span class="sub">Pusat data peserta, template, dan riwayat</span></div></div>' +
      '<div class="tog"><div class="row gap8">' + ic('description') + '<div><b>Spreadsheet SiBlast - Database</b><p>Sheet: Peserta, Template, Kampanye, Riwayat, Pengaturan</p></div></div>' + (rh.sheetUrl ? '<a class="btn o sm" target="_blank" rel="noopener" href="' + esc(rh.sheetUrl) + '">' + ic('open_in_new', 'sm') + 'Buka</a>' : '') + '</div>' +
      '<div class="field" style="margin:0"><label class="lbl">Nama yang Ditampilkan</label><input class="inp" id="stNama" value="' + esc(st.nama_admin || 'Admin') + '"></div></div>';
    var akun = '<div class="card sect"><div class="sh"><div class="si" style="background:var(--pink-bg);color:var(--pink)">' + ic('admin_panel_settings') + '</div><div class="grow"><h3 class="h3">Keamanan Akun Admin</h3><span class="sub">Login Google &amp; kata sandi</span></div></div>' +
      '<div class="g2" style="gap:12px"><div class="field" style="margin:0"><label class="lbl">Google Client ID (opsional)</label><input class="inp" id="stClient" value="' + esc(rh.googleClientId || '') + '" placeholder="xxxx.apps.googleusercontent.com"></div><div class="field" style="margin:0"><label class="lbl">Email Admin Google</label><input class="inp" id="stEmail" value="' + esc(rh.adminEmail || '') + '" placeholder="anda@gmail.com"></div></div>' +
      '<div class="sep"></div><div class="g2" style="gap:12px"><div class="field" style="margin:0"><label class="lbl">Kata Sandi Lama</label><input class="inp" id="pwLama" type="password" autocomplete="current-password"></div><div class="field" style="margin:0"><label class="lbl">Kata Sandi Baru (min. 8)</label><input class="inp" id="pwBaru" type="password" autocomplete="new-password"></div></div>' +
      '<div class="row wrap"><button class="btn o" data-act="gantiSandi">' + ic('password') + 'Ubah Kata Sandi</button></div></div>';
    return pageHead('Pengaturan Sistem', 'Kelola koneksi WhatsApp, mesin pengiriman, dan keamanan akun admin.', '<span class="badge b-draft" style="background:#fff;box-shadow:var(--shadow)">' + ic('cloud_done', 'sm') + 'Runtime ' + esc(SB.versi || '-') + '</span>') +
      '<div class="g2" style="align-items:start"><div class="tgrid">' + koneksi + sheet + '</div><div class="tgrid">' + mesin + akun + '</div></div>' +
      '<div class="savebar"><span class="sub row gap8">' + ic('info', 'sm') + 'Ubah pengaturan lalu simpan. Token & Google disimpan terpisah di Script Properties.</span><div class="row"><button class="btn o" data-act="resetPengaturan">Reset ke Default</button><button class="btn p" data-act="simpanSemua">' + ic('save') + 'Simpan Semua Pengaturan</button></div></div>';
  };
})();
