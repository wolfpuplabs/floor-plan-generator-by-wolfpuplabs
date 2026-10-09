/* Plan23D — LOBI BERMAIN BERSAMA (JEV-077)
   Dimuat hanya saat dipakai (tombol "Buat ruang" atau tautan undangan …&r=<ruang>).
   Host = pembuat undangan. Tamu membuka tautan undangan, menulis nama, lalu jalan-jalan
   bersama (avatar bernama), mengobrol, dan — bila host memilih "Bangun bareng" — ikut
   mengubah rumah. Koneksi WebRTC peer-to-peer berbentuk bintang: tiap tamu terhubung ke
   host, host meneruskan posisi, obrolan & perubahan rumah. Server PeerJS (0.peerjs.com,
   tanpa akun) hanya mempertemukan peramban; isi obrolan, posisi & rumah lewat kanal data
   terenkripsi DTLS langsung antar-peramban. TURN opsional dari api/ice (env Vercel).
   Semua pesan dari peer lain = masukan tak tepercaya: jenis, ukuran & lajunya disaring,
   teks hanya lewat textContent, rumah lewat sanitasiProyek(). */
/* global PROJECT, scene, camera, FPS, LIHAT, SEL, ATAP_TUTUP:writable, gizmo, $, el, toast, clamp,
   sanitasiProyek, selData, renderLevels, renderSitusUI, renderFinishUI, renderAtapUI, renderInspector, rebuildScene,
   buatTautanLihat, proyekKosong, setTool */
(function () {
  'use strict';
  const PEERJS = { src: 'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js', sri: 'sha384-x0YgkOr/3UOZP2CRDxGW9e0Q+2Qjyr3uJrm4xU32Y7ZCNAo7Cc7bjhrZMi/dwczu' };
  const MAKS = 10, BATAS_PROYEK = 3e6, ID_RUANG = /^p23d-[a-z0-9]{12}$/;
  const WARNA = ['#4ec9b0', '#f0a35e', '#6aa6ff', '#e86d8f', '#b38cf2', '#f2d15c', '#5ed37a', '#ff8a5c', '#5cc8f2', '#d9d9d9'];
  const STUN = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
  const L = { aktif: false, peran: null, peer: null, ruang: null, mode: 'lihat', maks: MAKS, saya: null, nama: '', peserta: new Map(),
    kon: new Map(), host: null, terakhir: '', tunda: 0, antri: null, avatar: new Map(), grup: null, obrBuka: true, belumBaca: 0, laju: new Map(), posLama: '', jeda: 0,
    adegan: '', kuota: new Map() };
  window.LOBI = L;
  const { terapkanAksiLuar, keadaanAksi, pasangKeadaanAksi, adeganKini, pasangAdegan, bunyiPianoLuar } = window.JEMBATAN_LOBI;

  /* ---------- alat bantu ---------- */
  const teksAman = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
  const angkaAman = (v, a, b) => { v = +v; return Number.isFinite(v) ? clamp(v, a, b) : 0; };
  const idAcak = n => { const h = 'abcdefghijklmnopqrstuvwxyz0123456789', b = crypto.getRandomValues(new Uint8Array(n)); let s = ''; for (const x of b) s += h[x % 36]; return s; };
  const warnaBebas = () => { const pakai = new Set([...L.peserta.values()].map(p => p.warna)); return WARNA.find(w => !pakai.has(w)) || WARNA[L.peserta.size % WARNA.length]; };
  const daftar = () => [...L.peserta.values()].map(p => ({ id: p.id, nama: p.nama, warna: p.warna, host: !!p.host }));
  // aksi & not piano: kuota per peserta per detik (tombol ditekan berulang tidak membanjiri ruang)
  function kuotaOk(id, jenis, maks) {
    const t = performance.now(), k = id + jenis, q = L.kuota.get(k) || { t, n: 0 };
    if (t - q.t > 1000) { q.t = t; q.n = 0; }
    q.n++; L.kuota.set(k, q); return q.n <= maks;
  }
  const idAman = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);
  // not piano: angka disaring sebelum menyentuh Web Audio
  function nadaAman(d) {
    const m = Math.round(+d.m);
    if (!Number.isFinite(m) || m < 21 || m > 108) return null;
    return { id: idAman(d.id) ? d.id : null, m, dt: angkaAman(d.dt, 0, 1), d: angkaAman(d.d, 0.1, 8) || 1.2, v: angkaAman(d.v, 0.02, 0.6) || 0.32 };
  }
  function lajuOk(id) {                                     // obrolan: maks. ±3 pesan/detik per peserta
    const t = performance.now(), a = L.laju.get(id) || 0;
    if (t - a < 300) return false; L.laju.set(id, t); return true;
  }

  function muatPeerJS() {
    if (window.Peer) return Promise.resolve();
    return new Promise((ok, no) => {
      const s = document.createElement('script'); s.src = PEERJS.src; s.integrity = PEERJS.sri; s.crossOrigin = 'anonymous';
      s.onload = () => (window.Peer ? ok() : no(new Error('pustaka koneksi tidak termuat')));
      s.onerror = () => no(new Error('pustaka koneksi tidak bisa diunduh — periksa internet'));
      document.head.appendChild(s);
    });
  }
  // server TURN opsional (env Vercel); tanpa itu cukup STUN — sebagian jaringan seluler bisa gagal
  async function iceServers() {
    try {
      const k = new AbortController(), t = setTimeout(() => k.abort(), 2500);
      const r = await fetch('api/ice', { signal: k.signal }); clearTimeout(t);
      if (r.ok) { const j = await r.json(); const s = (Array.isArray(j.iceServers) ? j.iceServers : []).filter(x => x && typeof x.urls === 'string' && /^(stun|turns?):/.test(x.urls)).slice(0, 6)
        .map(x => ({ urls: x.urls, ...(typeof x.username === 'string' ? { username: x.username } : {}), ...(typeof x.credential === 'string' ? { credential: x.credential } : {}) }));
        if (s.length) return STUN.concat(s); }
    } catch (e) { /* tanpa TURN */ }
    return STUN;
  }
  async function opsiPeer() {
    if (window.__peerOpsi) return window.__peerOpsi;            // tes e2e: server sinyal lokal
    return { host: '0.peerjs.com', port: 443, secure: true, path: '/', debug: 0, config: { iceServers: await iceServers() } };
  }

  /* ---------- tampilan: kartu masuk, obrolan, peserta ---------- */
  function gaya() {
    if (document.getElementById('lobiGaya')) return;
    const s = document.createElement('style'); s.id = 'lobiGaya';
    s.textContent = `#lobiObrolan{left:12px;bottom:calc(max(12px,env(safe-area-inset-bottom)) + 60px);width:min(320px,calc(100% - 24px));z-index:38;padding:0;border-radius:12px;overflow:hidden;display:flex;flex-direction:column}
#lobiObrolan.ciut .lb-isi{display:none}
#lobiObrolan .lb-kepala{display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer;font-size:.8rem;font-weight:700}
#lobiObrolan .lb-kepala .lb-badge{background:var(--accent);color:#06201b;border-radius:999px;padding:1px 7px;font-size:.7rem}
#lobiObrolan .lb-peserta{display:flex;flex-wrap:wrap;gap:4px 10px;padding:0 10px 6px;font-size:.72rem;color:var(--muted)}
#lobiObrolan .lb-titik{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px;vertical-align:0}
#lobiObrolan .lb-pesan{max-height:180px;overflow:auto;padding:4px 10px;display:flex;flex-direction:column;gap:3px;font-size:.8rem;border-top:1px solid var(--line)}
#lobiObrolan .lb-pesan .sis{color:var(--muted);font-style:italic;font-size:.74rem}
#lobiObrolan form{display:flex;gap:6px;padding:8px;border-top:1px solid var(--line)}
#lobiObrolan form input{flex:1;min-width:0}
#lobiMasuk{left:50%;top:50%;transform:translate(-50%,-50%);width:min(340px,calc(100% - 24px));z-index:62;padding:16px;border-radius:14px;display:flex;flex-direction:column;gap:10px}
#lobiMasuk h3{font-size:1.05rem}
body.lihat #lobiObrolan{bottom:calc(max(12px,env(safe-area-inset-bottom)) + 62px)}`;
    document.head.appendChild(s);
  }
  function panelObrolan() {
    let p = document.getElementById('lobiObrolan'); if (p) return p;
    gaya();
    p = el('div', 'float'); p.id = 'lobiObrolan';
    const kepala = el('div', 'lb-kepala'); kepala.appendChild(el('span', 'lb-judul', 'Obrolan'));
    const badge = el('span', 'lb-badge'); badge.hidden = true; kepala.appendChild(badge);
    kepala.appendChild(el('span', 'lb-jumlah'));
    kepala.onclick = () => { L.obrBuka = !L.obrBuka; p.classList.toggle('ciut', !L.obrBuka); if (L.obrBuka) { L.belumBaca = 0; badge.hidden = true; } };
    const isi = el('div', 'lb-isi'), ps = el('div', 'lb-peserta'), pesan = el('div', 'lb-pesan');
    const f = document.createElement('form'), inp = document.createElement('input');
    inp.type = 'text'; inp.maxLength = 300; inp.placeholder = 'Tulis pesan…'; inp.setAttribute('aria-label', 'Pesan obrolan'); inp.enterKeyHint = 'send';
    const kirim = el('button', 'btn sm', 'Kirim'); kirim.type = 'submit';
    f.appendChild(inp); f.appendChild(kirim);
    f.onsubmit = e => { e.preventDefault(); const t = teksAman(inp.value, 300); if (!t) return; inp.value = ''; kirimChat(t); };
    // mengetik di obrolan tidak boleh menggerakkan avatar (W A S D)
    inp.addEventListener('keydown', e => e.stopPropagation());
    isi.appendChild(ps); isi.appendChild(pesan); isi.appendChild(f);
    p.appendChild(kepala); p.appendChild(isi);
    // layar HP: mulai ciut (hanya kepala + lencana) agar tidak menutupi area geser jalan
    if (innerWidth < 700) { L.obrBuka = false; p.classList.add('ciut'); }
    document.getElementById('viewport').appendChild(p);
    return p;
  }
  function renderPeserta() {
    const p = panelObrolan(), ps = p.querySelector('.lb-peserta'); ps.textContent = '';
    for (const x of L.peserta.values()) {
      const s = el('span'); const t = el('span', 'lb-titik'); t.style.background = x.warna; s.appendChild(t);
      s.appendChild(document.createTextNode(x.nama + (x.host ? ' (host)' : '') + (L.saya && x.id === L.saya.id ? ' — kamu' : '')));
      ps.appendChild(s);
    }
    p.querySelector('.lb-jumlah').textContent = `${L.peserta.size}/${L.maks} orang`;
    const d = $('#lobiDaftar'); if (d && L.peran === 'host') { d.textContent = ''; for (const x of L.peserta.values()) d.appendChild(el('li', null, x.nama + (x.host ? ' (host)' : ''))); }
    const info = $('#lobiInfo'); if (info && L.peran === 'host') info.textContent = `${L.mode === 'edit' ? 'Bangun bareng' : 'Lihat saja'} · ${L.peserta.size}/${L.maks} orang di ruang`;
  }
  function tampilPesan(m) {
    const p = panelObrolan(), daftarP = p.querySelector('.lb-pesan'), b = el('div');
    if (m.sistem) { b.className = 'sis'; b.textContent = m.teks; }
    else { const n = el('b', null, m.nama + ': '); n.style.color = m.warna || 'inherit'; b.appendChild(n); b.appendChild(document.createTextNode(m.teks)); }
    daftarP.appendChild(b); while (daftarP.children.length > 60) daftarP.firstChild.remove();
    daftarP.scrollTop = daftarP.scrollHeight;
    if (!L.obrBuka && !m.sistem) { L.belumBaca++; const bd = p.querySelector('.lb-badge'); bd.hidden = false; bd.textContent = String(L.belumBaca); }
  }
  const sistem = t => tampilPesan({ sistem: true, teks: t });

  /* ---------- avatar peserta lain ---------- */
  function labelNama(nama, warna) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
    x.font = '600 30px system-ui, sans-serif'; const w = Math.min(244, x.measureText(nama).width + 28);
    x.fillStyle = 'rgba(16,18,22,.78)'; x.beginPath(); x.roundRect ? x.roundRect((256 - w) / 2, 8, w, 48, 24) : x.rect((256 - w) / 2, 8, w, 48); x.fill();
    x.fillStyle = warna; x.fillRect((256 - w) / 2 + 12, 28, 8, 8);
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(nama, 128 + 6, 33, 216);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true })); s.scale.set(1.1, 0.275, 1); s.position.y = 2.02; s.renderOrder = 4;
    return s;
  }
  function buatAvatar(p) {
    if (!L.grup) { L.grup = new THREE.Group(); L.grup.userData.noExport = true; scene.add(L.grup); }
    const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: p.warna, roughness: 0.55 });
    const badan = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.24, 1.05, 16), m); badan.position.y = 0.72;
    const kepala = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), m); kepala.position.y = 1.47;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.06), new THREE.MeshStandardMaterial({ color: 0x111316, roughness: 0.3 })); visor.position.set(0, 1.5, 0.15);
    for (const x of [badan, kepala]) x.castShadow = true;
    g.add(badan, kepala, visor, labelNama(p.nama, p.warna)); g.visible = false; g.userData.noExport = true;
    L.grup.add(g); return g;
  }
  function hapusAvatar(id) {
    const a = L.avatar.get(id); if (!a) return; L.avatar.delete(id);
    if (a.g.parent) a.g.parent.remove(a.g);
    a.g.traverse(n => { if (n.geometry) n.geometry.dispose(); if (n.material) { if (n.material.map) n.material.map.dispose(); n.material.dispose(); } });
  }
  function posAman(d) {
    if (!d || !d.jalan) return null;
    return { x: angkaAman(d.x, -1e4, 1e4), y: angkaAman(d.y, -100, 500), z: angkaAman(d.z, -1e4, 1e4), yaw: angkaAman(d.yaw, -100, 100) };
  }
  function perbaruiPos(id, pos) {
    if (L.saya && id === L.saya.id) return;
    const p = L.peserta.get(id); if (!p) return;
    let a = L.avatar.get(id); if (!a) { a = { g: buatAvatar(p), tuju: null }; L.avatar.set(id, a); }
    a.tuju = pos;
    if (pos && !a.g.visible) { a.g.position.set(pos.x, pos.y, pos.z); a.g.rotation.y = pos.yaw; }
    a.g.visible = !!pos;
  }
  function stepAvatar(dt) {
    for (const a of L.avatar.values()) {
      if (!a.tuju) continue; const g = a.g, k = Math.min(1, dt * 10);
      g.position.x += (a.tuju.x - g.position.x) * k; g.position.y += (a.tuju.y - g.position.y) * k; g.position.z += (a.tuju.z - g.position.z) * k;
      const d = Math.atan2(Math.sin(a.tuju.yaw - g.rotation.y), Math.cos(a.tuju.yaw - g.rotation.y)); g.rotation.y += d * k;
    }
  }
  function posSaya() {
    if (!FPS.on) return { jalan: 0 };
    return { jalan: 1, x: +camera.position.x.toFixed(2), y: +FPS.feet.toFixed(2), z: +camera.position.z.toFixed(2), yaw: +FPS.yaw.toFixed(3) };
  }

  /* ---------- sinkron rumah (bangun bareng) ---------- */
  const subsetProyek = () => ({ levels: PROJECT.levels, site: PROJECT.site, finish: PROJECT.finish, atap: PROJECT.atap });
  L.proyekBerubah = function () {
    if (!L.aktif) return;
    if (L.peran === 'tamu' && L.mode !== 'edit') return;
    clearTimeout(L.tunda); L.tunda = setTimeout(kirimProyek, 250);
  };
  function kirimProyek() {
    const s = JSON.stringify(subsetProyek());
    if (s === L.terakhir) return;
    if (s.length > BATAS_PROYEK) { toast('Rumah terlalu besar untuk disinkronkan ke peserta lain'); return; }
    L.terakhir = s;
    if (L.peran === 'host') siarkan({ t: 'proyek', s, dari: L.nama });
    else if (L.host && L.host.open) L.host.send({ t: 'proyek', s });
  }
  function terapkanProyek(s, dari) {
    if (typeof s !== 'string' || s.length > BATAS_PROYEK) return false;
    if (gizmo.dragging) { L.antri = { s, dari }; return true; }   // diterapkan setelah seretan selesai
    let B;
    try { const j = JSON.parse(s); B = sanitasiProyek({ name: PROJECT.name, levels: j.levels, site: j.site, finish: j.finish, atap: j.atap }); } catch (e) { return false; }
    PROJECT.levels = B.levels; PROJECT.site = B.site; PROJECT.finish = B.finish; PROJECT.atap = B.atap;
    if (ATAP_TUTUP !== !!B.atap.tutup) ATAP_TUTUP = !!B.atap.tutup;
    PROJECT.active = clamp(PROJECT.active, 0, PROJECT.levels.length - 1);
    L.terakhir = JSON.stringify(subsetProyek());             // perubahan dari jaringan tidak dipantulkan balik
    renderLevels(); renderSitusUI(); renderFinishUI(); renderAtapUI(); rebuildScene();
    if (SEL && !selData()) renderInspector();
    if (dari && performance.now() - L.jeda > 4000) { L.jeda = performance.now(); sistem(dari + ' mengubah rumah'); }
    return true;
  }

  /* ---------- HOST ---------- */
  function siarkan(m, kecuali) { for (const [id, k] of L.kon) if (id !== kecuali && k.open) { try { k.send(m); } catch (e) { /* koneksi putus */ } } }
  function terimaTamu(k) {
    k.on('data', d => { try { pesanDariTamu(k, d); } catch (e) { console.warn('lobi', e); } });
    const putus = () => keluarTamu(k.peer);
    k.on('close', putus); k.on('error', putus);
  }
  function pesanDariTamu(k, d) {
    if (!d || typeof d !== 'object' || typeof d.t !== 'string') return;
    const id = k.peer;
    if (d.t === 'halo') {
      if (L.peserta.has(id)) return;
      if (L.peserta.size >= L.maks) { k.send({ t: 'penuh', maks: L.maks }); setTimeout(() => k.close(), 600); return; }
      const p = { id, nama: teksAman(d.nama, 24) || 'Tamu', warna: warnaBebas() };
      L.kon.set(id, k); L.peserta.set(id, p);
      k.send({ t: 'selamat', id, mode: L.mode, maks: L.maks, peserta: daftar(), s: JSON.stringify(subsetProyek()), a: adeganKini(), k: keadaanAksi() });
      siarkan({ t: 'masuk', p }, id); sistem(p.nama + ' masuk ruang'); renderPeserta();
      return;
    }
    const p = L.peserta.get(id); if (!p || p.host) return;      // belum menyapa
    if (d.t === 'pos') { p.pos = posAman(d); perbaruiPos(id, p.pos); return; }
    if (d.t === 'chat') {
      if (!lajuOk(id)) return; const teks = teksAman(d.teks, 300); if (!teks) return;
      const m = { t: 'chat', id, nama: p.nama, warna: p.warna, teks }; tampilPesan(m); siarkan(m);
      return;
    }
    // interaksi (lampu, pintu, TV, gorden, musik) boleh di kedua mode — bukan mengubah rumah
    if (d.t === 'aksi') {
      if (!kuotaOk(id, 'a', 12) || !idAman(d.id)) return;
      if (terapkanAksiLuar(d.j, d.id, !!d.on)) siarkan({ t: 'aksi', j: d.j, id: d.id, on: !!d.on }, id);
      return;
    }
    if (d.t === 'nada') {
      const n = kuotaOk(id, 'n', 40) && nadaAman(d); if (!n) return;
      bunyiPianoLuar(n.id, n.m, n.dt, n.d, n.v); siarkan({ t: 'nada', ...n }, id);
      return;
    }
    if (d.t === 'proyek') {
      if (L.mode !== 'edit') return;                           // ruang "lihat saja": perubahan tamu ditolak
      if (!terapkanProyek(d.s, p.nama)) return;
      siarkan({ t: 'proyek', s: d.s, dari: p.nama }, id);
    }
  }
  function keluarTamu(id) {
    const p = L.peserta.get(id); if (!p || p.host) return;
    L.peserta.delete(id); L.kon.delete(id); hapusAvatar(id);
    siarkan({ t: 'keluar', id }); sistem(p.nama + ' keluar dari ruang'); renderPeserta();
  }
  L.buka = async function (o) {
    if (L.aktif) return;
    if (proyekKosong()) { toast('Rumah masih kosong — bangun dulu sebelum mengundang'); return; }
    L.nama = teksAman(o.nama, 24) || 'Host'; L.mode = o.mode === 'edit' ? 'edit' : 'lihat'; L.maks = clamp(Math.round(+o.maks || MAKS), 2, MAKS);
    try { localStorage.setItem('lobiNama', L.nama); } catch (e) { /* abaikan */ }
    const tombol = $('#lobiBuat'); if (tombol) tombol.disabled = true;
    try {
      await muatPeerJS();
      L.ruang = 'p23d-' + idAcak(12);
      const opsi = await opsiPeer();
      L.peer = await new Promise((ok, no) => { const P = new window.Peer(L.ruang, opsi); P.on('open', () => ok(P)); P.on('error', e => no(new Error(galatPeer(e)))); setTimeout(() => no(new Error('server penghubung tidak menjawab')), 30000); });
      L.peer.on('connection', terimaTamu);
      L.peer.on('error', e => { if (e && e.type === 'peer-unavailable') return; console.warn('lobi', e); });
      L.peer.on('disconnected', () => { try { L.peer.reconnect(); } catch (e) { /* abaikan */ } });
      L.aktif = true; L.peran = 'host';
      L.saya = { id: L.ruang, nama: L.nama, warna: WARNA[0], host: true }; L.peserta.set(L.ruang, L.saya);
      const r = await buatTautanLihat();
      const url = r.url + '&r=' + L.ruang;
      $('#lobiUrl').value = url; $('#lobiSiap').hidden = true; $('#lobiAktif').hidden = false;
      L.terakhir = JSON.stringify(subsetProyek());
      panelObrolan(); renderPeserta();
      sistem(`Ruang dibuka (${L.mode === 'edit' ? 'bangun bareng' : 'lihat saja'}, maks. ${L.maks} orang). Bagikan undangan.`);
      if (!r.pendek) toast('Undangan memakai tautan panjang — aktifkan Vercel Blob agar lebih pendek');
      mulaiDetak();
    } catch (e) { tutup(); throw e; }
    finally { if (tombol) tombol.disabled = false; }
  };

  /* ---------- TAMU ---------- */
  L.tawarGabung = function (ruang) {
    if (!ID_RUANG.test(ruang) || L.aktif || document.getElementById('lobiMasuk')) return;
    gaya();
    const k = el('div', 'float'); k.id = 'lobiMasuk'; k.setAttribute('role', 'dialog');
    k.appendChild(el('h3', null, 'Undangan bermain bersama'));
    k.appendChild(el('p', 'hint', 'Tulis namamu, lalu masuk untuk jalan-jalan & mengobrol bersama pemilik rumah.'));
    const inp = document.createElement('input'); inp.type = 'text'; inp.maxLength = 24; inp.placeholder = 'Namamu'; inp.setAttribute('aria-label', 'Namamu');
    try { inp.value = localStorage.getItem('lobiNama') || ''; } catch (e) { /* abaikan */ }
    const info = el('p', 'hint'); const row = el('div', 'row');
    const masuk = el('button', 'btn', 'Masuk'), nanti = el('button', 'btn ghost', 'Lihat sendiri saja');
    row.appendChild(masuk); row.appendChild(nanti);
    k.appendChild(inp); k.appendChild(row); k.appendChild(info);
    document.getElementById('viewport').appendChild(k);
    nanti.onclick = () => k.remove();
    const pergi = async () => {
      const nama = teksAman(inp.value, 24); if (!nama) { inp.focus(); info.textContent = 'Nama wajib diisi'; return; }
      masuk.disabled = true; info.textContent = 'Menghubungkan…';
      try { await gabung(ruang, nama); k.remove(); }
      catch (e) { info.textContent = 'Tidak bisa masuk: ' + (e.message || e); masuk.disabled = false; }
    };
    masuk.onclick = pergi; inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') pergi(); });
    setTimeout(() => inp.focus(), 50);
  };
  function galatPeer(e) {
    const t = e && e.type;
    return t === 'peer-unavailable' ? 'ruang tidak ditemukan atau host sudah keluar' : t === 'network' || t === 'server-error' || t === 'socket-error' ? 'tidak bisa menghubungi server penghubung — periksa internet'
      : t === 'browser-incompatible' ? 'peramban ini tidak mendukung WebRTC' : (e && e.message) || 'koneksi gagal';
  }
  async function gabung(ruang, nama) {
    await muatPeerJS();
    const opsi = await opsiPeer();
    L.nama = nama; try { localStorage.setItem('lobiNama', nama); } catch (e) { /* abaikan */ }
    const P = await new Promise((ok, no) => { const p = new window.Peer(opsi); p.on('open', () => ok(p)); p.on('error', e => no(new Error(galatPeer(e)))); setTimeout(() => no(new Error('server penghubung tidak menjawab')), 30000); });
    L.peer = P;
    const sambut = await new Promise((ok, no) => {
      const k = P.connect(ruang, { reliable: true }); L.host = k;
      P.on('error', e => no(new Error(galatPeer(e))));
      k.on('open', () => k.send({ t: 'halo', nama }));
      k.on('data', d => { if (d && d.t === 'selamat') ok(d); else if (d && d.t === 'penuh') no(new Error(`ruang penuh (maks. ${angkaAman(d.maks, 2, MAKS)} orang)`)); else { try { pesanDariHost(d); } catch (e) { console.warn('lobi', e); } } });
      k.on('close', () => { if (L.aktif) { sistem('Ruang ditutup oleh host'); toast('Ruang ditutup oleh host'); tutup(); } else no(new Error('koneksi ditolak')); });
      setTimeout(() => no(new Error('host tidak menjawab — mungkin sudah keluar')), 40000);
    });
    L.aktif = true; L.peran = 'tamu'; L.mode = sambut.mode === 'edit' ? 'edit' : 'lihat'; L.maks = clamp(Math.round(+sambut.maks || MAKS), 2, MAKS);
    L.peserta.clear();
    for (const p of (Array.isArray(sambut.peserta) ? sambut.peserta : []).slice(0, MAKS)) {
      if (!p || typeof p.id !== 'string') continue;
      L.peserta.set(p.id, { id: p.id.slice(0, 64), nama: teksAman(p.nama, 24) || 'Tamu', warna: WARNA.includes(p.warna) ? p.warna : WARNA[9], host: !!p.host });
    }
    L.saya = L.peserta.get(sambut.id) || { id: String(sambut.id), nama, warna: WARNA[1] };
    if (typeof sambut.s === 'string') terapkanProyek(sambut.s, null);
    // suasana, langit & keadaan interaksi host (lampu, pintu, TV, musik) — tamu masuk ke dunia yang sama
    try { pasangAdegan(sambut.a); pasangKeadaanAksi(sambut.k); } catch (e) { console.warn('lobi', e); }
    if (L.mode === 'edit') bukaEdit();
    panelObrolan(); renderPeserta();
    sistem(L.mode === 'edit' ? 'Kamu masuk — boleh ikut membangun rumah ini' : 'Kamu masuk — ketuk Jalan-jalan untuk berkeliling bersama');
    mulaiDetak();
  }
  function pesanDariHost(d) {
    if (!d || typeof d !== 'object' || typeof d.t !== 'string') return;
    if (d.t === 'pos' && Array.isArray(d.d)) { for (const x of d.d.slice(0, MAKS)) if (x && typeof x.id === 'string') perbaruiPos(x.id, posAman(x)); return; }
    if (d.t === 'chat') { const p = L.peserta.get(d.id); tampilPesan({ nama: p ? p.nama : teksAman(d.nama, 24), warna: p ? p.warna : '#ccc', teks: teksAman(d.teks, 300) }); return; }
    if (d.t === 'masuk' && d.p && typeof d.p.id === 'string') {
      const p = { id: d.p.id.slice(0, 64), nama: teksAman(d.p.nama, 24) || 'Tamu', warna: WARNA.includes(d.p.warna) ? d.p.warna : WARNA[9] };
      L.peserta.set(p.id, p); sistem(p.nama + ' masuk ruang'); renderPeserta(); return;
    }
    if (d.t === 'keluar') { const p = L.peserta.get(d.id); if (p) { L.peserta.delete(d.id); hapusAvatar(d.id); sistem(p.nama + ' keluar dari ruang'); renderPeserta(); } return; }
    if (d.t === 'proyek') { terapkanProyek(d.s, teksAman(d.dari, 24)); return; }
    if (d.t === 'aksi') { if (idAman(d.id)) terapkanAksiLuar(d.j, d.id, !!d.on); return; }
    if (d.t === 'nada') { const n = nadaAman(d); if (n) bunyiPianoLuar(n.id, n.m, n.dt, n.d, n.v); return; }
    if (d.t === 'adegan') { pasangAdegan(d.a); return; }
    if (d.t === 'tutup') { sistem('Ruang ditutup oleh host'); toast('Ruang ditutup oleh host'); tutup(); }
  }
  // tamu "bangun bareng": keluar dari mode lihat-saja, alat edit tampil
  function bukaEdit() {
    LIHAT.on = false; document.body.classList.remove('lihat'); const b = $('#lihatBar'); if (b) b.hidden = true;
    setTool('select'); renderLevels(); toast('Mode bangun bareng — perubahanmu terlihat oleh semua peserta');
  }

  /* ---------- obrolan & detak ---------- */
  function kirimChat(teks) {
    if (!L.aktif) return;
    if (L.peran === 'host') { const m = { t: 'chat', id: L.saya.id, nama: L.nama, warna: L.saya.warna, teks }; tampilPesan(m); siarkan(m); }
    else if (L.host && L.host.open) { L.host.send({ t: 'chat', teks }); }
  }
  L.kirimChat = kirimChat;
  // dipanggil index.html: interaksi & not piano milik sendiri
  function kirim(m) {
    if (!L.aktif) return;
    if (L.peran === 'host') siarkan(m);
    else if (L.host && L.host.open) L.host.send(m);
  }
  L.aksi = (j, id, on) => { if (idAman(id)) kirim({ t: 'aksi', j, id, on: !!on }); };
  L.nada = (id, m, dt, d, v) => { const n = nadaAman({ id, m, dt, d, v }); if (n) kirim({ t: 'nada', ...n }); };
  let detak = null, tLalu = 0;
  function mulaiDetak() {
    if (detak) return;
    detak = setInterval(() => {
      if (!L.aktif) return;
      const pos = posSaya(), kunci = JSON.stringify(pos);
      if (L.peran === 'host') {
        // suasana / langit diganti host → semua tamu ikut
        const a = adeganKini(), ka = JSON.stringify(a);
        if (ka !== L.adegan) { L.adegan = ka; siarkan({ t: 'adegan', a }); }
        L.saya.pos = posAman(pos);
        siarkan({ t: 'pos', d: [...L.peserta.values()].map(p => ({ id: p.id, ...(p.pos ? { jalan: 1, ...p.pos } : { jalan: 0 }) })) });
      } else if (kunci !== L.posLama && L.host && L.host.open) { L.posLama = kunci; L.host.send({ t: 'pos', ...pos }); }
      if (L.antri && !gizmo.dragging) { const a = L.antri; L.antri = null; terapkanProyek(a.s, a.dari); }
    }, 100);
    const lari = t => { if (!L.aktif) return; stepAvatar(Math.min(0.1, (t - (tLalu || t)) / 1000)); tLalu = t; requestAnimationFrame(lari); };
    requestAnimationFrame(lari);
  }
  function tutup() {
    if (L.peran === 'host') siarkan({ t: 'tutup' });
    L.aktif = false; clearInterval(detak); detak = null;
    for (const id of [...L.avatar.keys()]) hapusAvatar(id);
    const k = L.peer; L.peer = null; L.kon.clear(); L.peserta.clear(); L.host = null; L.peran = null;
    setTimeout(() => { try { if (k) k.destroy(); } catch (e) { /* abaikan */ } }, 300);
    const o = document.getElementById('lobiObrolan'); if (o) o.remove();
    const s = $('#lobiSiap'), a = $('#lobiAktif'); if (s) s.hidden = false; if (a) a.hidden = true;
  }
  L.tutup = tutup;
  addEventListener('pagehide', () => { if (L.aktif) tutup(); });
})();
