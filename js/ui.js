/* ============================================================
   SiBlast — helper UI: format, badge, grafik SVG, modal, toast
   ============================================================ */
(function () {
  'use strict';
  var SB = (window.SB = {});

  SB.$ = function (s, r) { return (r || document).querySelector(s); };
  SB.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  SB.esc = function (s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var esc = SB.esc;
  SB.ic = function (n, c) { return '<span class="ms ' + (c || '') + '">' + n + '</span>'; };
  SB.sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  /* ---------- state global ---------- */
  SB.S = {
    user: { nama: 'Admin' }, settings: {}, rahasia: {}, gw: null,
    peserta: [], template: [], kampanye: [], agenda: [], riwayat: null, riwayatBasi: true, logAg: null, logAgBasi: true,
    loaded: false, route: 'dashboard',
    pes: { q: '', grup: '', status: '', page: 1, sel: {} },
    tpl: { q: '', kat: 'Semua', draft: null },
    ag: { judul: '', deskripsi: '', lokasi: '', mulai: '', selesai: '', mode: 'semua', grup: [], rem: [60], email: 60, busy: false },
    wz: { step: 1, judul: '', tplId: '', mode: 'semua', grup: [], ids: {}, q: '', jadwalOn: false, jadwal: '' },
    rw: { q: '', kampanye: '', status: '', tgl1: '', tgl2: '', page: 1, tab: 'wa' },
    rwa: { q: '', agenda: '', jenis: '', status: '', tgl1: '', tgl2: '', page: 1 }
  };
  SB.PG = { id: null, muat: null, rows: {}, hitung: null, wait: 0, filter: 'semua', batch: 25 };

  /* ---------- format ---------- */
  SB.num = function (n) { return Number(n || 0).toLocaleString('id-ID'); };
  SB.tgl = function (iso, jam) {
    if (!iso) return '-';
    var d = new Date(iso); if (isNaN(d)) return '-';
    var o = { day: '2-digit', month: 'short', year: 'numeric' };
    if (jam) { o.hour = '2-digit'; o.minute = '2-digit'; }
    return d.toLocaleString('id-ID', o);
  };
  SB.jam = function (iso) {
    if (!iso) return '-';
    var d = new Date(iso); if (isNaN(d)) return '-';
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  SB.fmtNo = function (n) {
    n = String(n || '');
    if (n.indexOf('62') !== 0) return n;
    var r = n.slice(2);
    return '+62 ' + r.slice(0, 3) + '-' + r.slice(3, 7) + '-' + r.slice(7);
  };
  SB.durasi = function (detik) {
    detik = Math.max(0, Math.round(detik));
    if (detik < 60) return detik + ' detik';
    var m = Math.floor(detik / 60), s = detik % 60;
    if (m < 60) return m + ' mnt' + (s && m < 10 ? ' ' + s + ' dtk' : '');
    return Math.floor(m / 60) + ' jam ' + (m % 60) + ' mnt';
  };
  var WARNA = [
    ['#ffe2e5', '#fa5a7d'], ['#fff4de', '#ff947a'], ['#dcfce7', '#16a34a'],
    ['#f3e8ff', '#a855f7'], ['#e0e7ff', '#4143d5'], ['#cffafe', '#0e7490']
  ];
  SB.inisial = function (nama) {
    var p = String(nama || '?').trim().split(/\s+/);
    return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase();
  };
  SB.avatar = function (nama, ukuran) {
    var h = 0, s = String(nama || '?');
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    var w = WARNA[h % WARNA.length], u = ukuran || 36;
    return '<div class="ava" style="width:' + u + 'px;height:' + u + 'px;background:' + w[0] + ';color:' + w[1] + ';font-size:' + Math.round(u / 3) + 'px">' + esc(SB.inisial(nama)) + '</div>';
  };

  var BADGE = {
    Selesai: ['ok', 'Selesai'], Berjalan: ['run', 'Berjalan'], Terjadwal: ['pend', 'Terjadwal'], Dijeda: ['pend', 'Dijeda'],
    Dihentikan: ['fail', 'Dihentikan'], Berhasil: ['ok', 'Terkirim'], Gagal: ['fail', 'Gagal'], Menunggu: ['pend', 'Menunggu'],
    Dibatalkan: ['draft', 'Dibatalkan'], Membuat: ['run', 'Membuat…'], Diundang: ['ok', 'Diundang'], Diberitahu: ['pend', 'Diberitahu'], Aktif: ['ok', 'Aktif'], Nonaktif: ['draft', 'Nonaktif']
  };
  SB.badge = function (st) {
    var b = BADGE[st] || ['draft', st || '-'];
    return '<span class="badge b-' + b[0] + '"><i></i>' + esc(b[1]) + '</span>';
  };

  /* ---------- format teks WhatsApp ---------- */
  function waFmt(t) {
    return esc(t).replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/_([^_\n]+)_/g, '<i>$1</i>').replace(/~([^~\n]+)~/g, '<s>$1</s>');
  }
  SB.waPrev = function (t, v) {
    v = v || {};
    var s = String(t || '')
      .replace(/\{nama\}/gi, '\u0001' + (v.nama || 'Kak') + '\u0002')
      .replace(/\{nomor\}/gi, v.nomor || '').replace(/\{grup\}/gi, v.grup || '');
    return waFmt(s).replace(/\u0001/g, '<b>').replace(/\u0002/g, '</b>');
  };
  SB.hiTag = function (t) { return esc(t).replace(/\{(nama|nomor|grup)\}/gi, '<span class="tag">{$1}</span>'); };
  SB.phone = function (o) {
    var ic = SB.ic;
    return '<div class="phone"><div class="hd"><span class="ms">arrow_back</span><div class="ava">' + esc(SB.inisial(o.nama || 'SB')) + '</div>' +
      '<div class="grow"><b>' + esc(o.nama || 'Penerima') + '</b><small>online</small></div>' + ic('videocam') + ic('call') + '</div>' +
      '<div class="bd"><span class="day">HARI INI</span><div class="bub">' +
      (o.lampiran ? '<div class="att">' + ic('description') + '<div><b>' + esc(o.lampiran) + '</b><br><small>Lampiran</small></div></div>' : '') +
      '<span id="' + (o.id || 'phoneTxt') + '">' + (o.html || '<i style="color:#8a9a90">Isi pesan akan tampil di sini…</i>') + '</span>' +
      '<span class="tm">' + esc(o.waktu || SB.jam(new Date().toISOString()).slice(0, 5)) + ' ✓✓</span></div></div>' +
      '<div class="ft">' + ic('mood') + '<div class="in">Ketik pesan…</div><div class="mic">' + ic('mic') + '</div></div></div>';
  };
  SB.emptyBox = function (icon, judul, teks, tombol) {
    return '<div class="empty"><div class="em">' + SB.ic(icon, 'xl') + '</div><b>' + esc(judul) + '</b><span>' + esc(teks || '') + '</span>' + (tombol || '') + '</div>';
  };
  SB.skeleton = function (n) {
    var h = '';
    for (var i = 0; i < (n || 4); i++) h += '<div class="skel" style="height:52px;margin:8px 0"></div>';
    return h;
  };

  /* ---------- grafik SVG ---------- */
  function smooth(p) {
    if (!p.length) return '';
    if (p.length === 1) return 'M' + p[0][0] + ' ' + p[0][1];
    var d = 'M' + p[0][0].toFixed(1) + ' ' + p[0][1].toFixed(1);
    for (var i = 0; i < p.length - 1; i++) {
      var p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
      var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      var lo = Math.min(p1[1], p2[1]), hi = Math.max(p1[1], p2[1]); /* cegah kurva melewati titik data */
      c1y = Math.max(lo, Math.min(hi, c1y)); c2y = Math.max(lo, Math.min(hi, c2y));
      d += ' C' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ',' + c2x.toFixed(1) + ' ' + c2y.toFixed(1) + ',' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    }
    return d;
  }
  SB.CH = {}; // metadata grafik untuk hover
  var nChart = 0;

  /** series: [{name,color,vals,area}] ; labels: x */
  SB.lineChart = function (labels, series, o) {
    o = o || {};
    var W = 460, H = o.h || 170, pt = 16, pb = 14, n = labels.length;
    var max = 1;
    series.forEach(function (s) { s.vals.forEach(function (v) { if (v > max) max = v; }); });
    max = Math.ceil(max * 1.15);
    var X = function (i) { return n <= 1 ? W / 2 : (i * W) / (n - 1); };
    var Y = function (v) { return pt + (H - pt - pb) * (1 - v / max); };
    var id = 'ch' + (++nChart), g = '';
    for (var k = 0; k <= 3; k++) {
      var y = pt + ((H - pt - pb) * k) / 3;
      g += '<line x1="0" x2="' + W + '" y1="' + y + '" y2="' + y + '" stroke="#e8eaf2" ' + (k === 3 ? '' : 'stroke-dasharray="3 3"') + '/>';
    }
    var defs = '', body = '', pts0 = [];
    series.forEach(function (s, si) {
      var pts = s.vals.map(function (v, i) { return [X(i), Y(v)]; });
      if (si === 0) pts0 = pts;
      var d = smooth(pts);
      if (s.area && pts.length > 1) {
        defs += '<linearGradient id="' + id + 'g' + si + '" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="' + s.color + '" stop-opacity=".22"/><stop offset="1" stop-color="' + s.color + '" stop-opacity="0"/></linearGradient>';
        body += '<path d="' + d + ' L' + W + ' ' + (H - pb) + ' L0 ' + (H - pb) + ' Z" fill="url(#' + id + 'g' + si + ')"/>';
      }
      body += '<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="' + (si === 0 ? 3 : 2.4) + '" stroke-linecap="round"' + (s.dash ? ' stroke-dasharray="4 4"' : '') + '/>';
    });
    var hov = '<line class="hl" x1="0" x2="0" y1="' + pt + '" y2="' + (H - pb) + '" stroke="#fa5a7d" stroke-width="1.5" stroke-dasharray="2 2" style="display:none"/>' +
      '<circle class="hd" r="5" fill="#fa5a7d" stroke="#fff" stroke-width="2" style="display:none"/>';
    SB.CH[id] = { labels: labels, series: series, X: X, Y: Y, W: W, H: H, n: n, pts0: pts0 };
    return '<div class="chart" data-ch="' + id + '"><svg viewBox="0 0 ' + W + ' ' + H + '"><defs>' + defs + '</defs>' + g + body + hov + '</svg><div class="tip"></div></div>' +
      '<div class="xax">' + labels.map(function (l) { return '<span>' + esc(l) + '</span>'; }).join('') + '</div>';
  };

  SB.barGroups = function (groups, ca, cb) {
    var max = 1;
    groups.forEach(function (g) { max = Math.max(max, g.a, g.b); });
    return '<div class="bars">' + groups.map(function (g) {
      return '<div class="bgrp"><div class="pair"><i title="Terkirim: ' + g.a + '" style="height:' + Math.max(3, (g.a / max) * 100) + '%;background:' + ca + '"></i>' +
        '<i title="Gagal: ' + g.b + '" style="height:' + Math.max(3, (g.b / max) * 100) + '%;background:' + cb + '"></i></div><small title="' + esc(g.label) + '">' + esc(g.label) + '</small></div>';
    }).join('') + '</div>';
  };

  SB.donut = function (segs, tengah, label) {
    var tot = 0; segs.forEach(function (s) { tot += s.v; });
    var R = 48, C = 2 * Math.PI * R, off = 0, arcs = '';
    segs.forEach(function (s) {
      if (!tot || !s.v) return;
      var len = Math.max(2, (s.v / tot) * C - 4);
      arcs += '<circle cx="60" cy="60" r="' + R + '" fill="none" stroke="' + s.c + '" stroke-width="14" stroke-linecap="round" stroke-dasharray="' + len.toFixed(1) + ' ' + C.toFixed(1) + '" stroke-dashoffset="' + (-off).toFixed(1) + '"/>';
      off += (s.v / tot) * C;
    });
    return '<div class="donut"><svg width="150" height="150" viewBox="0 0 120 120" style="transform:rotate(-90deg)"><circle cx="60" cy="60" r="' + R + '" fill="none" stroke="#ececff" stroke-width="14"/>' + arcs + '</svg>' +
      '<div class="mid"><b>' + esc(tengah) + '</b><small>' + esc(label) + '</small></div></div>';
  };

  document.addEventListener('mousemove', function (e) {
    var c = e.target.closest && e.target.closest('.chart[data-ch]');
    if (!c) return;
    var m = SB.CH[c.getAttribute('data-ch')]; if (!m || !m.n) return;
    var r = c.getBoundingClientRect();
    var rel = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    var i = m.n <= 1 ? 0 : Math.round(rel * (m.n - 1));
    var x = m.X(i), y = m.Y(m.series[0].vals[i]);
    var hl = c.querySelector('.hl'), hd = c.querySelector('.hd'), tip = c.querySelector('.tip');
    hl.setAttribute('x1', x); hl.setAttribute('x2', x); hl.style.display = '';
    hd.setAttribute('cx', x); hd.setAttribute('cy', y); hd.style.display = '';
    tip.innerHTML = '<div style="color:#ff9bb0">' + esc(m.labels[i]) + '</div>' + m.series.map(function (s) { return esc(s.name) + ': ' + SB.num(s.vals[i]); }).join('<br>');
    tip.style.left = (x / m.W) * r.width + 'px'; tip.style.top = (y / m.H) * r.height + 'px'; tip.style.display = 'block';
  });
  document.addEventListener('mouseout', function (e) {
    var c = e.target.closest && e.target.closest('.chart[data-ch]');
    if (!c || (e.relatedTarget && c.contains(e.relatedTarget))) return;
    var hl = c.querySelector('.hl'), hd = c.querySelector('.hd'), tip = c.querySelector('.tip');
    if (hl) hl.style.display = 'none'; if (hd) hd.style.display = 'none'; if (tip) tip.style.display = 'none';
  });

  /* ---------- modal & toast ---------- */
  SB.modal = function (html, opt) {
    opt = opt || {};
    var root = SB.$('#modal');
    root.innerHTML = '<div class="mask" data-act="modalMask"><div class="modal ' + (opt.cls || '') + '" role="dialog" aria-modal="true">' + html + '</div></div>';
    var f = root.querySelector('input:not([type=file]),textarea,select'); if (f && !opt.noFocus) setTimeout(function () { try { f.focus(); } catch (e) {} }, 30);
  };
  SB.closeModal = function () { SB.$('#modal').innerHTML = ''; };
  SB.modalOpen = function () { return !!SB.$('#modal').firstChild; };

  SB.confirm = function (judul, teks, oke, bahaya) {
    return new Promise(function (res) {
      SB.modal('<div class="mh"><div class="mi" style="' + (bahaya ? 'background:var(--fail-bg);color:var(--fail)' : '') + '">' + SB.ic(bahaya ? 'warning' : 'help', 'lg') + '</div><div><h3>' + esc(judul) + '</h3></div></div>' +
        '<div class="mb"><p style="color:var(--text3);line-height:22px">' + esc(teks) + '</p></div>' +
        '<div class="mf"><button class="btn o" id="cfNo">Batal</button><button class="btn ' + (bahaya ? 'd' : 'p') + '" id="cfYes">' + esc(oke || 'Ya, lanjut') + '</button></div>', { cls: 'sm', noFocus: true });
      SB.$('#cfNo').onclick = function () { SB.closeModal(); res(false); };
      SB.$('#cfYes').onclick = function () { SB.closeModal(); res(true); };
    });
  };

  SB.toast = function (msg, tipe) {
    var ada = SB.$('#toasts').children; /* hindari toast kembar */
    for (var i = 0; i < ada.length; i++) if (ada[i].textContent === msg) return;
    var t = document.createElement('div');
    var icon = { ok: 'check_circle', err: 'error', info: 'info', warn: 'warning' }[tipe || 'ok'];
    t.className = 'toast ' + (tipe || 'ok');
    t.innerHTML = SB.ic(icon) + '<span>' + esc(msg) + '</span>';
    SB.$('#toasts').appendChild(t);
    setTimeout(function () { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 300); }, tipe === 'err' ? 5200 : 3200);
  };

  SB.muatXLSX = function () {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      s.onload = function () { res(window.XLSX); };
      s.onerror = function () { rej(new Error('Pustaka Excel gagal dimuat')); };
      document.head.appendChild(s);
    });
  };
  SB.unduhTeks = function (nama, teks, mime) {
    var b = new Blob(['﻿' + teks], { type: mime || 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = nama;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  SB.csv = function (rows) {
    return rows.map(function (r) {
      return r.map(function (c) { c = String(c === null || c === undefined ? '' : c); return /[",\n;]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(',');
    }).join('\r\n');
  };
})();
