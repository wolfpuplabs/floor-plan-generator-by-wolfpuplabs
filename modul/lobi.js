/* Plan23D — LOBI MAIN BARENG TANPA HOST (JEV-077, JEV-078, JEV-079)
   Dimuat hanya saat dipakai (tombol "Buat ruang" atau tautan undangan …&r=<ruang>).
   Ruang tidak bergantung pada pembuatnya: undangan tetap berlaku walau pemilik offline.
   Siapa pun yang masuk duluan merebut id ruang di server sinyal dan jadi PUSAT koneksi
   (topologi bintang: tiap peserta terhubung ke pusat, pusat meneruskan posisi, obrolan,
   interaksi & perubahan rumah). Saat pusat keluar, peserta yang paling lama di ruang
   merebut id itu lebih dulu, yang lain menyambung ulang kepadanya.
   Id ruang = p23d-<mode l/e><maks 2–9, a=10>-<16 heksa SHA-256 kunci publik pemilik>:
   aturan ruang ikut id (mengubahnya = ruang lain), dan pemilik membuktikan diri dengan
   tanda tangan ECDSA — kunci rahasianya tidak pernah dikirim. Ruang "lihat saja": hanya
   pemilik yang mengubah rumah & suasana; interaksi (lampu, pintu, piano) boleh semua.
   Server PeerJS (0.peerjs.com, tanpa akun) hanya mempertemukan peramban; isi lewat kanal
   data WebRTC terenkripsi DTLS. TURN opsional dari api/ice (env Vercel).
   Semua pesan dari peer lain = masukan tak tepercaya: jenis, ukuran & lajunya disaring,
   teks hanya lewat textContent, rumah lewat sanitasiProyek(). */
/* global PROJECT, scene, camera, FPS, LIHAT, SEL, ATAP_TUTUP:writable, gizmo, $, el, toast, clamp,
   sanitasiProyek, selData, renderLevels, renderSitusUI, renderFinishUI, renderAtapUI, renderInspector, rebuildScene,
   buatTautanLihat, proyekKosong, setTool */
(function () {
  'use strict';
  const PEERJS = { src: 'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js', sri: 'sha384-x0YgkOr/3UOZP2CRDxGW9e0Q+2Qjyr3uJrm4xU32Y7ZCNAo7Cc7bjhrZMi/dwczu' };
  const MAKS = 10, BATAS_PROYEK = 3e6, SUNYI_PUSAT = 15000;
  // baru: p23d-e5-<16 heksa> · lama (JEV-077 awal): p23d-<12> = lihat saja, 10 orang, tanpa pemilik
  const ID_RUANG = /^p23d-(?:([le])([2-9a])-([0-9a-f]{16})|([a-z0-9]{12}))$/;
  const WARNA = ['#4ec9b0', '#f0a35e', '#6aa6ff', '#e86d8f', '#b38cf2', '#f2d15c', '#5ed37a', '#ff8a5c', '#5cc8f2', '#d9d9d9'];
  const STUN = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
  const EC = { name: 'ECDSA', namedCurve: 'P-256' }, TTD = { name: 'ECDSA', hash: 'SHA-256' };
  const L = { aktif: false, peran: null, peer: null, ruang: null, aturan: null, mode: 'lihat', maks: MAKS, saya: null, nama: '', kunci: null, pemilik: false,
    peserta: new Map(), kon: new Map(), pusat: null, urut: 0, sesi: 0, pindah: false, dengar: 0, undangan: '',
    terakhir: '', tunda: 0, antri: null, avatar: new Map(), grup: null, obrBuka: true, belumBaca: 0, laju: new Map(), kuota: new Map(), posLama: '', jeda: 0 };
  window.LOBI = L;
  const { terapkanAksiLuar, keadaanAksi, pasangKeadaanAksi, adeganKini, pasangAdegan, bunyiPianoLuar } = window.JEMBATAN_LOBI;

  /* ---------- alat bantu ---------- */
  const teksAman = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
  const angkaAman = (v, a, b) => { v = +v; return Number.isFinite(v) ? clamp(v, a, b) : 0; };
  const idAman = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);
  const tidur = ms => new Promise(ok => setTimeout(ok, ms));
  const heks = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  const b64 = b => btoa(String.fromCharCode(...new Uint8Array(b)));
  const dariB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const warnaBebas = () => { const pakai = new Set([...L.peserta.values()].map(p => p.warna)); return WARNA.find(w => !pakai.has(w)) || WARNA[L.peserta.size % WARNA.length]; };
  const publik = p => ({ id: p.id, nama: p.nama, warna: p.warna, pemilik: !!p.pemilik, pusat: !!p.pusat, urut: p.urut | 0 });
  const daftar = () => [...L.peserta.values()].map(publik);
  // ruang "lihat saja": hanya pemilik yang mengubah rumah & suasana
  const boleh = p => L.mode === 'edit' || !!(p && p.pemilik);
  function aturanRuang(r) {
    const m = typeof r === 'string' && r.match(ID_RUANG); if (!m) return null;
    if (m[4]) return { mode: 'lihat', maks: MAKS, sidik: null };
    return { mode: m[1] === 'e' ? 'edit' : 'lihat', maks: m[2] === 'a' ? 10 : +m[2], sidik: m[3] };
  }
  function lajuOk(id) {                                     // obrolan: maks. ±3 pesan/detik per peserta
    const t = performance.now(), a = L.laju.get(id) || 0;
    if (t - a < 300) return false; L.laju.set(id, t); return true;
  }
  // aksi & not piano: kuota per peserta per detik (tombol ditekan berulang tidak membanjiri ruang)
  function kuotaOk(id, jenis, maks) {
    const t = performance.now(), k = id + jenis, q = L.kuota.get(k) || { t, n: 0 };
    if (t - q.t > 1000) { q.t = t; q.n = 0; }
    q.n++; L.kuota.set(k, q); return q.n <= maks;
  }
  // suasana/langit dari peer: hanya bidang yang dikenal, teks & angka dibatasi (yang diteruskan pusat juga ini)
  function adeganAman(a) {
    if (!a || typeof a !== 'object') return null;
    const g = a.langit && typeof a.langit === 'object' ? a.langit : {};
    return { mood: teksAman(a.mood, 12), langit: { mode: teksAman(g.mode, 12), jenis: teksAman(g.jenis, 20), id: idAman(g.id) ? g.id : null, nama: teksAman(g.nama, 120), putar: angkaAman(g.putar, 0, 360) } };
  }
  // not piano: angka disaring sebelum menyentuh Web Audio
  function nadaAman(d) {
    const m = Math.round(+d.m);
    if (!Number.isFinite(m) || m < 21 || m > 108) return null;
    return { id: idAman(d.id) ? d.id : null, m, dt: angkaAman(d.dt, 0, 1), d: angkaAman(d.d, 0.1, 8) || 1.2, v: angkaAman(d.v, 0.02, 0.6) || 0.32 };
  }

  /* ---------- kunci pemilik (ECDSA P-256): id ruang memuat sidik kunci publiknya ---------- */
  async function sidikPub(raw) { return heks(await crypto.subtle.digest('SHA-256', raw)).slice(0, 16); }
  async function kunciBaru() {
    const p = await crypto.subtle.generateKey(EC, true, ['sign', 'verify']);
    const raw = await crypto.subtle.exportKey('raw', p.publicKey);
    return { pub: b64(raw), jwk: await crypto.subtle.exportKey('jwk', p.privateKey), sidik: await sidikPub(raw) };
  }
  function kunciTersimpan(ruang) {
    try { const k = JSON.parse(localStorage.getItem('lobiKunci:' + ruang) || 'null'); return k && typeof k.pub === 'string' && k.jwk ? k : null; } catch (e) { return null; }
  }
  // bukti pemilik: tanda tangan atas "ruang|id peer|waktu" — terikat ke koneksi ini, kedaluwarsa 2 menit
  async function buktiPemilik(peerId) {
    if (!L.kunci) return null;
    try {
      const t = Date.now(), priv = await crypto.subtle.importKey('jwk', L.kunci.jwk, EC, false, ['sign']);
      const ttd = await crypto.subtle.sign(TTD, priv, new TextEncoder().encode(`${L.ruang}|${peerId}|${t}`));
      return { pub: L.kunci.pub, ttd: b64(ttd), t };
    } catch (e) { return null; }
  }
  async function periksaPemilik(b, peerId) {
    try {
      if (!L.aturan.sidik || !b || typeof b.pub !== 'string' || b.pub.length > 200 || typeof b.ttd !== 'string' || b.ttd.length > 200) return false;
      const t = +b.t; if (!Number.isFinite(t) || Math.abs(Date.now() - t) > 120000) return false;
      const raw = dariB64(b.pub); if (await sidikPub(raw) !== L.aturan.sidik) return false;
      const pub = await crypto.subtle.importKey('raw', raw, EC, false, ['verify']);
      return await crypto.subtle.verify(TTD, pub, dariB64(b.ttd), new TextEncoder().encode(`${L.ruang}|${peerId}|${t}`));
    } catch (e) { return false; }
  }

  /* ---------- pustaka & server ---------- */
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
  let OPSI = null;
  async function opsiPeer() {
    if (window.__peerOpsi) return window.__peerOpsi;            // tes e2e: server sinyal lokal
    return OPSI || (OPSI = { host: '0.peerjs.com', port: 443, secure: true, path: '/', debug: 0, config: { iceServers: await iceServers() } });
  }
  function galatPeer(e) {
    const t = e && e.type;
    return t === 'network' || t === 'server-error' || t === 'socket-error' ? 'tidak bisa menghubungi server penghubung — periksa internet'
      : t === 'browser-incompatible' ? 'peramban ini tidak mendukung WebRTC' : (e && e.message) || 'koneksi gagal';
  }
  // Peer baru; id = id ruang untuk merebut peran pusat. Hasil: Peer terbuka, atau galat {terpakai}
  function bukaPeer(opsi, id) {
    return new Promise((ok, no) => {
      const P = id ? new window.Peer(id, opsi) : new window.Peer(opsi); let s = false;
      const gagal = e => { if (s) return; s = true; try { P.destroy(); } catch (x) { /* abaikan */ } no(e); };
      P.on('open', () => { if (!s) { s = true; ok(P); } });
      P.on('error', e => gagal(e && e.type === 'unavailable-id' ? Object.assign(new Error('terpakai'), { terpakai: true }) : new Error(galatPeer(e))));
      setTimeout(() => gagal(new Error('server penghubung tidak menjawab')), 30000);
    });
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
.lb-tanda{display:inline-block;margin-left:5px;padding:0 5px;border-radius:6px;background:rgba(255,255,255,.08);font-size:.66rem;color:var(--muted)}
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
  // nama + tanda (pemilik / pusat koneksi / kamu) — tanda elemen sendiri agar diterjemahkan utuh
  function isiNama(e, x) {
    e.appendChild(document.createTextNode(x.nama));
    for (const [ada, t] of [[x.pemilik, 'pemilik'], [x.pusat, 'pusat koneksi'], [L.saya && x.id === L.saya.id, 'kamu']]) if (ada) e.appendChild(el('span', 'lb-tanda', t));
  }
  function renderPeserta() {
    const p = panelObrolan(), ps = p.querySelector('.lb-peserta'); ps.textContent = '';
    const urut = [...L.peserta.values()].sort((a, b) => (a.urut | 0) - (b.urut | 0));
    for (const x of urut) {
      const s = el('span'); const t = el('span', 'lb-titik'); t.style.background = x.warna; s.appendChild(t);
      isiNama(s, x); ps.appendChild(s);
    }
    p.querySelector('.lb-jumlah').textContent = `${L.peserta.size}/${L.maks} orang`;
    const d = $('#lobiDaftar'); if (d) { d.textContent = ''; for (const x of urut) { const li = el('li'); isiNama(li, x); d.appendChild(li); } }
    const info = $('#lobiInfo'); if (info) info.textContent = `${L.mode === 'edit' ? 'Bangun bareng' : 'Lihat saja'} · ${L.peserta.size}/${L.maks} orang di ruang`;
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
  function tampilAktif(on) {
    const s = $('#lobiSiap'), a = $('#lobiAktif'); if (s) s.hidden = on; if (a) a.hidden = !on;
    const u = $('#lobiUrl'); if (u && on) u.value = L.undangan;
  }

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
  const hapusSemuaAvatar = () => { for (const id of [...L.avatar.keys()]) hapusAvatar(id); };
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

  /* ---------- sinkron rumah ---------- */
  const subsetProyek = () => ({ levels: PROJECT.levels, site: PROJECT.site, finish: PROJECT.finish, atap: PROJECT.atap });
  L.proyekBerubah = function () {
    if (!L.aktif || !boleh(L.saya)) return;
    clearTimeout(L.tunda); L.tunda = setTimeout(kirimProyek, 250);
  };
  function kirimProyek() {
    const s = JSON.stringify(subsetProyek());
    if (s === L.terakhir) return;
    if (s.length > BATAS_PROYEK) { toast('Rumah terlalu besar untuk disinkronkan ke peserta lain'); return; }
    L.terakhir = s;
    if (L.peran === 'pusat') siarkan({ t: 'proyek', s, dari: L.nama });
    else if (L.pusat && L.pusat.open) L.pusat.send({ t: 'proyek', s });
  }
  function terapkanProyek(s, dari) {
    if (typeof s !== 'string' || s.length > BATAS_PROYEK) return false;
    if (s === L.terakhir) return true;                         // sudah sama (mis. menyambung ulang ke pusat baru)
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

  /* ---------- PUSAT KONEKSI ---------- */
  function siarkan(m, kecuali) { for (const [id, k] of L.kon) if (id !== kecuali && k.open) { try { k.send(m); } catch (e) { /* koneksi putus */ } } }
  function jadiPusat(P) {
    L.peer = P; L.peran = 'pusat'; L.pusat = null;
    P.on('connection', terimaTamu);
    P.on('error', e => { if (e && e.type === 'peer-unavailable') return; console.warn('lobi', e); });
    P.on('disconnected', () => { if (L.peer === P && L.aktif) { try { P.reconnect(); } catch (e) { /* abaikan */ } } });
    hapusSemuaAvatar(); L.kon.clear(); L.peserta.clear();
    L.saya = { id: P.id, nama: L.nama, warna: (L.saya && L.saya.warna) || WARNA[0], pemilik: L.pemilik, pusat: true, urut: 0 };
    L.peserta.set(P.id, L.saya); L.urut = 1;
    renderPeserta();
  }
  function terimaTamu(k) {
    k.on('data', d => { pesanDariTamu(k, d).catch(e => console.warn('lobi', e)); });
    const putus = () => keluarTamu(k.peer);
    k.on('close', putus); k.on('error', putus);
  }
  async function pesanDariTamu(k, d) {
    if (!d || typeof d !== 'object' || typeof d.t !== 'string' || L.peran !== 'pusat') return;
    const id = k.peer;
    if (d.t === 'halo') {
      if (L.peserta.has(id) || L.kon.has(id)) return;
      L.kon.set(id, k);                                       // dicadangkan selama bukti pemilik diperiksa
      const pemilik = await periksaPemilik(d.bukti, id);
      if (L.peran !== 'pusat' || !k.open) { L.kon.delete(id); return; }
      if (L.peserta.size >= L.maks) { L.kon.delete(id); k.send({ t: 'penuh', maks: L.maks }); setTimeout(() => k.close(), 600); return; }
      const pakai = new Set([...L.peserta.values()].map(p => p.warna));
      const p = { id, nama: teksAman(d.nama, 24) || 'Tamu', warna: WARNA.includes(d.warna) && !pakai.has(d.warna) ? d.warna : warnaBebas(), pemilik, pusat: false, urut: L.urut++ };
      L.peserta.set(id, p);
      k.send({ t: 'selamat', id, peserta: daftar(), s: JSON.stringify(subsetProyek()), a: adeganKini(), k: keadaanAksi() });
      siarkan({ t: 'masuk', p: publik(p) }, id); sistem(p.nama + ' masuk ruang'); renderPeserta();
      return;
    }
    const p = L.peserta.get(id); if (!p || p.pusat) return;     // belum menyapa
    if (d.t === 'pos') { p.pos = posAman(d); perbaruiPos(id, p.pos); return; }
    if (d.t === 'chat') {
      if (!lajuOk(id)) return; const teks = teksAman(d.teks, 300); if (!teks) return;
      const m = { t: 'chat', id, nama: p.nama, warna: p.warna, teks }; tampilPesan(m); siarkan(m);
      return;
    }
    // interaksi (lampu, pintu, TV, gorden, musik) boleh di kedua mode — bukan mengubah rumah.
    // Diteruskan ke semua termasuk pengirim: urutan pusat = urutan akhir di semua peserta.
    if (d.t === 'aksi') {
      if (!kuotaOk(id, 'a', 12) || !idAman(d.id)) return;
      terapkanAksiLuar(d.j, d.id, !!d.on);
      // keadaan (lampu, pintu…) dipantulkan juga ke pengirim agar urutan sama; bunyi sesaat tidak (terdengar dua kali)
      siarkan({ t: 'aksi', j: d.j, id: d.id, on: !!d.on }, d.j === 'bunyi' ? id : undefined);
      return;
    }
    if (d.t === 'nada') {
      const n = kuotaOk(id, 'n', 40) && nadaAman(d); if (!n) return;
      bunyiPianoLuar(n.id, n.m, n.dt, n.d, n.v); siarkan({ t: 'nada', ...n }, id);
      return;
    }
    if (d.t === 'adegan') {
      const a = boleh(p) && kuotaOk(id, 's', 6) && adeganAman(d.a); if (!a) return;
      pasangAdegan(a); siarkan({ t: 'adegan', a });
      return;
    }
    if (d.t === 'proyek') {
      if (!boleh(p)) return;                                  // ruang "lihat saja": hanya pemilik
      if (!terapkanProyek(d.s, p.nama)) return;
      siarkan({ t: 'proyek', s: d.s, dari: p.nama }, id);
    }
  }
  function keluarTamu(id) {
    L.kon.delete(id);
    const p = L.peserta.get(id); if (!p || p.pusat) return;
    L.peserta.delete(id); hapusAvatar(id);
    siarkan({ t: 'keluar', id }); sistem(p.nama + ' keluar dari ruang'); renderPeserta();
  }

  /* ---------- PESERTA BIASA (tersambung ke pusat) ---------- */
  function cobaTamu(P) {
    return new Promise((ok, no) => {
      const k = P.connect(L.ruang, { reliable: true }); let s = false, t = 0;
      const akhir = (f, v) => { if (s) return; s = true; clearTimeout(t); f(v); };
      t = setTimeout(() => { try { k.close(); } catch (e) { /* abaikan */ } akhir(no, new Error('pusat tidak menjawab')); }, 25000);
      P.on('error', e => { if (e && e.type === 'peer-unavailable') akhir(no, new Error('kosong')); });
      k.on('open', async () => { k.send({ t: 'halo', nama: L.nama, warna: L.saya && L.saya.warna, bukti: await buktiPemilik(P.id) }); });
      k.on('data', d => {
        if (!s) {
          if (d && d.t === 'selamat') akhir(ok, { k, d });
          else if (d && d.t === 'penuh') akhir(no, Object.assign(new Error(`ruang penuh (maks. ${angkaAman(d.maks, 2, MAKS)} orang)`), { penuh: true }));
          return;
        }
        if (L.pusat === k) { L.dengar = performance.now(); try { pesanDariPusat(d); } catch (e) { console.warn('lobi', e); } }
      });
      k.on('close', () => { if (!s) akhir(no, new Error('koneksi ditolak')); else if (L.pusat === k) pusatHilang(); });
    });
  }
  function jadiTamu(P, k, d) {
    L.peer = P; L.peran = 'tamu'; L.pusat = k; L.dengar = performance.now(); L.kon.clear();
    P.on('disconnected', () => { if (L.peer === P && L.aktif) { try { P.reconnect(); } catch (e) { /* abaikan */ } } });
    hapusSemuaAvatar(); L.peserta.clear();
    for (const p of (Array.isArray(d.peserta) ? d.peserta : []).slice(0, MAKS)) {
      if (!p || typeof p.id !== 'string') continue;
      L.peserta.set(p.id.slice(0, 64), { id: p.id.slice(0, 64), nama: teksAman(p.nama, 24) || 'Tamu', warna: WARNA.includes(p.warna) ? p.warna : WARNA[9], pemilik: !!p.pemilik, pusat: !!p.pusat, urut: p.urut | 0 });
    }
    L.saya = L.peserta.get(d.id) || { id: String(d.id), nama: L.nama, warna: WARNA[1], urut: 99 };
    L.pemilik = !!L.saya.pemilik;                              // diakui pusat setelah tanda tangan diperiksa
    if (typeof d.s === 'string') terapkanProyek(d.s, null);
    // suasana, langit & keadaan interaksi saat ini (lampu, pintu, TV, musik) — masuk ke dunia yang sama
    try { const a = adeganAman(d.a); if (a) pasangAdegan(a); pasangKeadaanAksi(d.k); } catch (e) { console.warn('lobi', e); }
    if (L.mode === 'edit' && LIHAT.on) bukaEdit();
    renderPeserta();
  }
  function pesanDariPusat(d) {
    if (!d || typeof d !== 'object' || typeof d.t !== 'string') return;
    if (d.t === 'pos' && Array.isArray(d.d)) { for (const x of d.d.slice(0, MAKS)) if (x && typeof x.id === 'string') perbaruiPos(x.id, posAman(x)); return; }
    if (d.t === 'chat') { const p = L.peserta.get(d.id); tampilPesan({ nama: p ? p.nama : teksAman(d.nama, 24), warna: p ? p.warna : '#ccc', teks: teksAman(d.teks, 300) }); return; }
    if (d.t === 'masuk' && d.p && typeof d.p.id === 'string') {
      const p = { id: d.p.id.slice(0, 64), nama: teksAman(d.p.nama, 24) || 'Tamu', warna: WARNA.includes(d.p.warna) ? d.p.warna : WARNA[9], pemilik: !!d.p.pemilik, pusat: false, urut: d.p.urut | 0 };
      L.peserta.set(p.id, p); sistem(p.nama + ' masuk ruang'); renderPeserta(); return;
    }
    if (d.t === 'keluar') { const p = L.peserta.get(d.id); if (p) { L.peserta.delete(d.id); hapusAvatar(d.id); sistem(p.nama + ' keluar dari ruang'); renderPeserta(); } return; }
    if (d.t === 'proyek') { terapkanProyek(d.s, teksAman(d.dari, 24)); return; }
    if (d.t === 'aksi') { if (idAman(d.id)) terapkanAksiLuar(d.j, d.id, !!d.on); return; }
    if (d.t === 'nada') { const n = nadaAman(d); if (n) bunyiPianoLuar(n.id, n.m, n.dt, n.d, n.v); return; }
    if (d.t === 'adegan') { const a = adeganAman(d.a); if (a) pasangAdegan(a); return; }
    if (d.t === 'pergi') pusatHilang();                       // pusat keluar dengan pamit
  }
  // pusat hilang: peserta paling lama mencoba merebut id ruang lebih dulu, yang lain menyusul
  function pusatHilang() {
    if (!L.aktif || L.pindah || L.peran !== 'tamu') return;
    L.pindah = true;
    const urutan = [...L.peserta.values()].filter(p => !p.pusat).sort((a, b) => (a.urut | 0) - (b.urut | 0)).findIndex(p => L.saya && p.id === L.saya.id);
    const lama = L.peer; L.peer = null; L.pusat = null; L.peran = null;
    setTimeout(() => { try { if (lama) lama.destroy(); } catch (e) { /* abaikan */ } }, 0);
    hapusSemuaAvatar(); L.peserta.clear(); if (L.saya) L.peserta.set(L.saya.id, L.saya);
    renderPeserta(); sistem('Pusat koneksi keluar — menyambung ulang…');
    const sesi = L.sesi;
    setTimeout(async () => {
      try { const r = await sambung(sesi); if (r) sistem(r === 'pusat' ? 'Kamu kini pusat koneksi ruang ini' : 'Tersambung lagi'); }
      catch (e) { if (sesi === L.sesi) { sistem('Terputus: ' + (e.message || e)); toast('Terputus dari ruang: ' + (e.message || e)); tutup(); } }
      finally { L.pindah = false; }
    }, Math.max(0, urutan) * 900 + Math.random() * 300);
  }
  // tamu "bangun bareng": keluar dari mode lihat-saja, alat edit tampil
  function bukaEdit() {
    LIHAT.on = false; document.body.classList.remove('lihat'); const b = $('#lihatBar'); if (b) b.hidden = true;
    setTool('select'); renderLevels(); toast('Mode bangun bareng — perubahanmu terlihat oleh semua peserta');
  }

  /* ---------- masuk ruang: rebut pusat, atau sambung ke pusat yang ada ---------- */
  async function sambung(sesi) {
    const opsi = await opsiPeer();
    for (let coba = 0; coba < 12; coba++) {
      if (sesi !== L.sesi) return null;
      let P = null;
      try { P = await bukaPeer(opsi, L.ruang); }
      catch (e) { if (!e.terpakai) throw e; }
      if (P) { if (sesi !== L.sesi) { P.destroy(); return null; } jadiPusat(P); return 'pusat'; }
      const Q = await bukaPeer(opsi, null);
      try { const { k, d } = await cobaTamu(Q); if (sesi !== L.sesi) { Q.destroy(); return null; } jadiTamu(Q, k, d); return 'tamu'; }
      catch (e) { try { Q.destroy(); } catch (x) { /* abaikan */ } if (e.penuh) throw e; }
      await tidur(800 + Math.random() * 1200);             // id ruang masih dipegang pusat yang baru hilang
    }
    throw new Error('ruang tidak bisa dihubungi — coba lagi nanti');
  }
  async function masukRuang(ruang, nama, undangan) {
    const a = aturanRuang(ruang); if (!a) throw new Error('kode ruang tidak sah');
    if (L.aktif) tutup();
    await muatPeerJS();
    const sesi = ++L.sesi;
    Object.assign(L, { ruang, aturan: a, mode: a.mode, maks: a.maks, nama, undangan, terakhir: '', peran: null });
    L.kunci = a.sidik ? kunciTersimpan(ruang) : null;
    L.pemilik = !!(L.kunci && L.kunci.sidik === a.sidik);
    try { localStorage.setItem('lobiNama', nama); } catch (e) { /* abaikan */ }
    const r = await sambung(sesi);
    if (!r) return null;
    L.aktif = true;
    if (r === 'pusat') L.terakhir = JSON.stringify(subsetProyek());
    panelObrolan(); renderPeserta(); tampilAktif(true); mulaiDetak();
    return r;
  }

  /* ---------- pembuat undangan ---------- */
  L.buka = async function (o) {
    if (L.aktif) return;
    if (proyekKosong()) { toast('Rumah masih kosong — bangun dulu sebelum mengundang'); return; }
    const nama = teksAman(o.nama, 24) || 'Pemilik', mode = o.mode === 'edit' ? 'edit' : 'lihat', maks = clamp(Math.round(+o.maks || MAKS), 2, MAKS);
    const tombol = $('#lobiBuat'); if (tombol) tombol.disabled = true;
    try {
      const k = await kunciBaru();
      const ruang = `p23d-${mode === 'edit' ? 'e' : 'l'}${maks === 10 ? 'a' : maks}-${k.sidik}`;
      try { localStorage.setItem('lobiKunci:' + ruang, JSON.stringify(k)); } catch (e) { /* kunci hanya di memori sesi ini */ }
      const r = await buatTautanLihat();
      const url = r.url + '&r=' + ruang;
      await masukRuang(ruang, nama, url);
      if (!L.kunci) { L.kunci = k; L.pemilik = true; if (L.saya) L.saya.pemilik = true; renderPeserta(); }
      sistem(`Ruang dibuka (${mode === 'edit' ? 'bangun bareng' : 'lihat saja'}, maks. ${maks} orang). Bagikan undangan.`);
      sistem('Undangan tetap berlaku walau kamu keluar.');
      if (!r.pendek) toast('Undangan memakai tautan panjang — aktifkan Vercel Blob agar lebih pendek');
    } finally { if (tombol) tombol.disabled = false; }
  };

  /* ---------- pembuka undangan ---------- */
  L.tawarGabung = function (ruang) {
    if (!aturanRuang(ruang) || L.aktif || document.getElementById('lobiMasuk')) return;
    gaya();
    const k = el('div', 'float'); k.id = 'lobiMasuk'; k.setAttribute('role', 'dialog');
    k.appendChild(el('h3', null, 'Undangan bermain bersama'));
    k.appendChild(el('p', 'hint', 'Tulis namamu, lalu masuk untuk jalan-jalan & mengobrol bersama siapa pun yang ada di dalam.'));
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
      try {
        const r = await masukRuang(ruang, nama, location.href); k.remove();
        if (r === 'pusat') sistem('Kamu orang pertama di ruang ini — yang datang berikutnya tersambung lewat kamu');
        else sistem(L.mode === 'edit' ? 'Kamu masuk — boleh ikut membangun rumah ini' : 'Kamu masuk — ketuk Jalan-jalan untuk berkeliling bersama');
      } catch (e) { info.textContent = 'Tidak bisa masuk: ' + (e.message || e); masuk.disabled = false; }
    };
    masuk.onclick = pergi; inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') pergi(); });
    setTimeout(() => inp.focus(), 50);
  };

  /* ---------- kiriman milik sendiri ---------- */
  function kirim(m) {
    if (!L.aktif) return;
    if (L.peran === 'pusat') siarkan(m);
    else if (L.pusat && L.pusat.open) L.pusat.send(m);
  }
  function kirimChat(teks) {
    if (!L.aktif || !L.saya) return;
    if (L.peran === 'pusat') { const m = { t: 'chat', id: L.saya.id, nama: L.nama, warna: L.saya.warna, teks }; tampilPesan(m); siarkan(m); }
    else kirim({ t: 'chat', teks });
  }
  L.kirimChat = kirimChat;
  // dipanggil index.html: interaksi, not piano & suasana milik sendiri
  L.aksi = (j, id, on) => { if (idAman(id)) kirim({ t: 'aksi', j, id, on: !!on }); };
  L.nada = (id, m, dt, d, v) => { const n = nadaAman({ id, m, dt, d, v }); if (n) kirim({ t: 'nada', ...n }); };
  L.adegan = a => { if (boleh(L.saya) && a && typeof a === 'object') kirim({ t: 'adegan', a }); };

  /* ---------- detak: posisi 10×/detik, penjaga pusat yang diam ---------- */
  let detak = null, tLalu = 0;
  function mulaiDetak() {
    if (detak) return;
    detak = setInterval(() => {
      if (!L.aktif) return;
      const pos = posSaya(), kunci = JSON.stringify(pos);
      if (L.peran === 'pusat') {
        L.saya.pos = posAman(pos);
        siarkan({ t: 'pos', d: [...L.peserta.values()].map(p => ({ id: p.id, ...(p.pos ? { jalan: 1, ...p.pos } : { jalan: 0 }) })) });
      } else if (L.peran === 'tamu' && L.pusat) {
        if (kunci !== L.posLama && L.pusat.open) { L.posLama = kunci; L.pusat.send({ t: 'pos', ...pos }); }
        if (performance.now() - L.dengar > SUNYI_PUSAT) pusatHilang();   // pusat mati tanpa pamit
      }
      if (L.antri && !gizmo.dragging) { const a = L.antri; L.antri = null; terapkanProyek(a.s, a.dari); }
    }, 100);
    const lari = t => { if (!detak) return; stepAvatar(Math.min(0.1, (t - (tLalu || t)) / 1000)); tLalu = t; requestAnimationFrame(lari); };
    requestAnimationFrame(lari);
  }
  // keluar: ruang tetap hidup untuk peserta lain (pusat pamit dulu agar penerus langsung mengambil alih)
  function tutup() {
    if (L.peran === 'pusat') siarkan({ t: 'pergi' });
    L.sesi++; L.aktif = false; L.pindah = false; clearInterval(detak); detak = null;
    hapusSemuaAvatar();
    const k = L.peer; L.peer = null; L.kon.clear(); L.peserta.clear(); L.pusat = null; L.peran = null;
    setTimeout(() => { try { if (k) k.destroy(); } catch (e) { /* abaikan */ } }, 300);
    const o = document.getElementById('lobiObrolan'); if (o) o.remove();
    tampilAktif(false);
  }
  L.tutup = tutup;
  addEventListener('pagehide', () => { if (L.aktif) tutup(); });
})();
