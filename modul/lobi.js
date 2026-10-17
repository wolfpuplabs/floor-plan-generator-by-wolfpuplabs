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
/* global PROJECT, scene, camera, renderer, worldRoot, FPS, LIHAT, SEL, ATAP_TUTUP:writable, gizmo, $, el, toast, clamp,
   sanitasiProyek, selData, renderLevels, renderSitusUI, renderFinishUI, renderAtapUI, renderInspector, rebuildScene,
   buatTautanLihat, proyekKosong, setTool, FOTO_LOBI, pasangPilihFoto, AVATAR_LOBI, pasangPilihAvatar3D,
   ambilLampiran, uriLuarGLTF, klonModel, bayangKotor, BAYANG_KOTOR:writable, bgmMain, MEDIA_OBJ, muatModul */
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
    terakhir: '', tunda: 0, antri: null, avatar: new Map(), grup: null, obrBuka: true, belumBaca: 0, laju: new Map(), kuota: new Map(), posLama: '', jeda: 0,
    mic: null, suara: new Map(), keluar: new Map(), tundaSuara: false };
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
  // foto profil (opsional): JPEG kotak kecil buatan peramban pemiliknya — disaring lagi di setiap penerima
  const fotoAman = v => (typeof v === 'string' && v.length <= 24000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(v) ? v : '');
  // avatar 3D sendiri (JEV-089): hanya daftar sidik potongan di api/tautan — berkasnya diunduh & diperiksa penerima
  // avatar 3D: unggahan sendiri (sidik bagian di api/tautan) atau karakter bawaan situs (JEV-102: avatar/F.vrm, avatar/M.vrm)
  const AV_BAWAAN = /^(F|M)$/;
  // benih warna (JEV-112): karakter bawaan diwarnai acak seperti NPC — kulit, rambut, atasan, bawahan, sepatu
  const benihOk = b => Number.isInteger(b) && b >= 0 && b <= 0xffffffff;
  const avAman = v => (v && typeof v === 'object' && typeof v.bawaan === 'string' && AV_BAWAAN.test(v.bawaan) ? { bawaan: v.bawaan, ...(benihOk(v.benih) ? { benih: v.benih } : {}) }
    : v && typeof v === 'object' && Array.isArray(v.bagian) && v.bagian.length >= 1 && v.bagian.length <= 3 &&
    v.bagian.every(h => typeof h === 'string' && /^[0-9a-f]{64}$/.test(h)) ? { bagian: v.bagian.slice() } : null);
  const publik = p => ({ id: p.id, nama: p.nama, warna: p.warna, pemilik: !!p.pemilik, pusat: !!p.pusat, urut: p.urut | 0, ...(p.foto ? { foto: p.foto } : {}), ...(p.av ? { av: p.av } : {}) });
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
body.lihat #lobiObrolan{bottom:calc(max(12px,env(safe-area-inset-bottom)) + 62px)}
body.jalan #lobiObrolan,body.lihat #lobiObrolan{top:calc(var(--bilah-atas,64px) + 8px);bottom:auto}
body.jalan #lobiObrolan .lb-pesan,body.lihat #lobiObrolan .lb-pesan{max-height:min(180px,30vh)}
#lobiAvatar{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:20}
.lb-av{position:absolute;left:0;top:0;width:0;height:0;transform-origin:0 0;will-change:transform}
.lb-av[hidden]{display:none}
.lb-av .lb-foto{position:absolute;left:-48px;top:-48px;width:96px;height:96px;box-sizing:border-box;border-radius:50%;border:4px solid #fff;object-fit:cover;display:grid;place-items:center;color:#fff;font:700 44px/1 system-ui,sans-serif;box-shadow:0 6px 22px rgba(0,0,0,.35)}
.lb-av .lb-nm{position:absolute;top:58px;left:0;transform:translateX(-50%);display:flex;align-items:center;gap:7px;background:rgba(14,18,26,.38);-webkit-backdrop-filter:blur(14px) saturate(160%);backdrop-filter:blur(14px) saturate(160%);border:1px solid rgba(255,255,255,.24);box-shadow:0 6px 18px rgba(0,0,0,.22);color:#fff;font:700 17px/1.2 system-ui,sans-serif;padding:5px 14px 5px 10px;border-radius:999px;white-space:nowrap;max-width:220px;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 2px rgba(0,0,0,.35)}
.lb-av .lb-nm::before{content:'';width:9px;height:9px;border-radius:50%;background:var(--c,#4ec9b0);box-shadow:0 0 0 2px rgba(255,255,255,.35);flex:none}
.lb-av .lb-gel{position:absolute;bottom:62px;left:0;transform:translateX(-50%);width:max-content;max-width:300px;background:rgba(255,255,255,.58);-webkit-backdrop-filter:blur(16px) saturate(180%);backdrop-filter:blur(16px) saturate(180%);border:1px solid rgba(255,255,255,.7);box-shadow:0 8px 24px rgba(0,0,0,.18);color:#10141c;font:500 17px/1.35 system-ui,sans-serif;padding:9px 16px;border-radius:18px;text-align:center;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.lb-av.lb-3d .lb-foto{display:none}
.lb-av.lb-3d .lb-nm{top:-16px}
.lb-av.lb-3d .lb-gel{bottom:26px}
.lb-av.lb-3d.lb-bicara .lb-nm{box-shadow:0 0 0 3px #4ec9b0}
.lb-av.lb-bicara .lb-foto{border-color:#4ec9b0;box-shadow:0 0 0 4px rgba(78,201,176,.45),0 6px 22px rgba(0,0,0,.35)}
#lobiObrolan .lb-mic{margin-left:auto;display:inline-flex;align-items:center;gap:4px;min-height:30px;padding:0 10px}
#lobiObrolan .lb-mic.on{background:var(--accent);color:#06201b}
.lb-av .lb-gel::after{content:'';position:absolute;left:50%;top:100%;margin-left:-8px;border:8px solid transparent;border-top-color:rgba(255,255,255,.62)}`;
    document.head.appendChild(s);
  }
  function panelObrolan() {
    let p = document.getElementById('lobiObrolan'); if (p) return p;
    gaya();
    p = el('div', 'float'); p.id = 'lobiObrolan';
    const kepala = el('div', 'lb-kepala'); kepala.appendChild(el('span', 'lb-judul', 'Obrolan'));
    const badge = el('span', 'lb-badge'); badge.hidden = true; kepala.appendChild(badge);
    kepala.appendChild(el('span', 'lb-jumlah'));
    const mic = el('button', 'btn sm ghost lb-mic'); mic.type = 'button';
    const ik = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); ik.setAttribute('class', 'ik'); ik.setAttribute('aria-hidden', 'true');
    const u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', '#i-mic'); ik.appendChild(u);
    mic.appendChild(ik); mic.appendChild(el('span', 'lb-mic-t', 'Mic'));
    mic.onclick = e => { e.stopPropagation(); micNyala(!L.mic); };
    kepala.appendChild(mic);
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

  /* ---------- avatar peserta lain: foto profil bulat + nama, gelembung obrolan di atas kepala ----------
     Lapisan HTML yang diproyeksikan ke posisi kepala tiap peserta (bukan sprite 3D): warnanya tidak ikut
     eksposur/vinyet adegan dan teksnya tajam. Ukurannya mengikuti jarak seperti benda 3D (±0,62 m), dan
     disembunyikan bila tertutup dinding (raycast ke bangunan 5×/detik). Semua teks lewat textContent. */
  const KEPALA = 1.5, BULAT = 0.62, PX = 96;
  function lapisan() {
    let o = document.getElementById('lobiAvatar'); if (o) return o;
    o = el('div'); o.id = 'lobiAvatar'; o.setAttribute('aria-hidden', 'true');
    (renderer.domElement.parentElement || document.body).appendChild(o); return o;
  }
  /* avatar 3D: glTF/VRM mandiri (G3 — tanpa berkas luar), tinggi disamakan 1,7 m, kaki di lantai, menghadap +Z
     (VRM 0.x menghadap −Z → diputar). Lengan kerangka VRM diturunkan dari pose T. Model yang sama dipakai ulang. */
  const AV_MAKS = 8 * 1048576, AV_TINGGI = 1.7, AV_MODEL = new Map();
  /* animasi avatar 3D: VRM/GLB tanpa klip digerakkan prosedural dari kerangka humanoid — kaki & lengan berayun,
     lutut & siku menekuk, badan naik-turun saat berjalan (laju dari pergeseran posisi), napas pelan saat diam.
     Putaran dihitung terhadap sumbu samping avatar sehingga berlaku untuk orientasi tulang apa pun.
     GLB yang membawa klip memakai klipnya sendiri (idle/walk bila bernama begitu). */
  const RIG = ['hips', 'spine', 'chest', 'neck', 'head', 'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'rightUpperLeg', 'rightLowerLeg', 'rightFoot',
    'leftUpperArm', 'leftLowerArm', 'rightUpperArm', 'rightLowerArm'];
  function tebakRig(root, rig) {
    // [kunci, pola, bersisi]: tulang bersisi dapat awalan left/right
    const pola = [['hips', /hips|pelvis/, 0], ['spine', /^spine0?1?$/, 0], ['chest', /chest|^spine0?2$/, 0], ['neck', /neck/, 0], ['head', /^head$/, 0],
      ['UpperLeg', /upleg|upperleg|thigh/, 1], ['LowerLeg', /lowerleg|calf|shin|^leg$/, 1], ['Foot', /foot|ankle/, 1],
      ['UpperArm', /upperarm|^arm$/, 1], ['LowerArm', /forearm|lowerarm/, 1]];
    root.traverse(n => {
      if (!n.isBone) return;
      const kata = n.name.toLowerCase().replace(/mixamorig\d*:?/, '').split(/[^a-z0-9]+/).filter(Boolean);
      let sisi = '', inti = kata.join('');
      if (kata[0] === 'left' || kata.includes('l')) sisi = 'left'; else if (kata[0] === 'right' || kata.includes('r')) sisi = 'right';
      if (!sisi) { const m = inti.match(/^(left|right)(.*)$/); if (m) { sisi = m[1]; inti = m[2]; } } else inti = kata.filter(k => !['left', 'right', 'l', 'r', 'j', 'bip', 'c'].includes(k)).join('');
      for (const [k, re, bersisi] of pola) {
        if (!re.test(inti)) continue;
        const kunci = bersisi ? (sisi && sisi + k) : (!sisi && k);
        if (kunci && !rig[kunci]) rig[kunci] = n; break;
      }
    });
  }
  // morph kedip berdasarkan nama (GLB tanpa data ekspresi VRM): blink / eye_close / EYE_Close (VRoid "Fcl_EYE_Close")
  function cariKedip(root) {
    const hasil = [];
    root.traverse(m => { const d = m.morphTargetDictionary; if (!d || !m.morphTargetInfluences) return;
      const k = Object.keys(d).find(n => /(^|[_\s.])(blink|eyes?_?close[d]?)$/i.test(n)); if (k != null) hasil.push([m, d[k], 1]); });
    return hasil.slice(0, 4);
  }
  const qSem = new THREE.Quaternion(), qB = new THREE.Quaternion(), qG = new THREE.Quaternion();
  function siapkanGerak(a, m) {
    a.model = m; a.dasarY = m.position.y; a.fase = 0; a.t = Math.random() * 10; a.w = 0; a.v = 0;
    a.tk = 1 + Math.random() * 3; a.fk = null; a.lt = 0; a.ly = a.lp = a.lr = a.cy = a.cp = a.cr = 0;
    { const urut = []; m.traverse(n => urut.push(n));
      a.kedip = (m.userData.kedipIdx || []).map(([u, i, b]) => [urut[u], i, b]).filter(([n, i]) => n && n.morphTargetInfluences && i < n.morphTargetInfluences.length); }
    const klip = m.userData.klip || [];
    if (klip.length) {
      a.mixer = new THREE.AnimationMixer(m);
      const jalan = klip.find(c => /walk|run|jalan/i.test(c.name)), diam = klip.find(c => /idle|stand|diam/i.test(c.name)) || (jalan ? null : klip[0]);
      a.aksiJalan = jalan && a.mixer.clipAction(jalan); a.aksiDiam = diam && a.mixer.clipAction(diam);
      for (const x of [a.aksiJalan, a.aksiDiam]) if (x) x.play();
      return;
    }
    const idx = m.userData.rigIdx || {}; if (!Object.keys(idx).length) return;
    const urut = []; m.traverse(n => urut.push(n));
    a.g.updateMatrixWorld(true); qG.copy(a.g.getWorldQuaternion(new THREE.Quaternion())).invert();
    a.rig = {};
    for (const [k, i] of Object.entries(idx)) {
      const b = urut[i]; if (!b || !b.parent) continue;
      // sumbu avatar dalam ruang induk tulang: samping (−X: putaran + = maju ke +Z), atas (+Y), depan (+Z)
      const qp = qG.clone().multiply(b.parent.getWorldQuaternion(new THREE.Quaternion())).invert();
      const sb = v => new THREE.Vector3(...v).applyQuaternion(qp).normalize();
      a.rig[k] = { b, rest: b.quaternion.clone(), ax: sb([-1, 0, 0]), ay: sb([0, 1, 0]), az: sb([0, 0, 1]) };
    }
    if (a.rig.hips) { m.updateMatrixWorld(true); const hp = a.rig.hips.b.getWorldPosition(new THREE.Vector3()), mp = m.getWorldPosition(new THREE.Vector3()), sk = a.g.getWorldScale(new THREE.Vector3()).y || 1; a.tinggiPinggul = (hp.y - mp.y) / sk; }
    // lengan kanan untuk melambai: orientasi diam & arah tulang (ke anak) dalam ruang avatar
    for (const k of ['rightUpperArm', 'rightLowerArm']) {
      const r = a.rig[k], anak = r && r.b.children.find(n => n.isBone); if (!anak) continue;
      r.restG = qG.clone().multiply(r.b.getWorldQuaternion(new THREE.Quaternion()));
      r.arahG = anak.getWorldPosition(new THREE.Vector3()).sub(r.b.getWorldPosition(new THREE.Vector3())).applyQuaternion(qG).normalize();
    }
  }
  // x: ayun maju(+)/mundur, y: putar (+ = ke kiri avatar), z: miring (+ = sisi kiri naik)
  function putarTulang(a, k, x, y = 0, z = 0) {
    const r = a.rig[k]; if (!r) return;
    qSem.setFromAxisAngle(r.ax, x);
    if (y) qSem.multiply(qB.setFromAxisAngle(r.ay, y));
    if (z) qSem.multiply(qB.setFromAxisAngle(r.az, z));
    r.b.quaternion.multiplyQuaternions(qSem, r.rest);
  }
  /* siklus jalan: fase maju menurut jarak tempuh (±0,62 m per langkah) agar kaki tidak meluncur; pinggul berputar &
     turun di sisi kaki yang mengayun, dada berputar berlawanan, kepala tetap menghadap depan, telapak menapak datar,
     badan naik saat kaki berpapasan. Diam: napas, sesekali memindah berat badan & menoleh pelan. */
  // kedip: tutup 70 ms, tahan 40 ms, buka 130 ms; jeda acak 2–6 dtk, sesekali kedip ganda
  function kedipkan(a, dt) {
    if (!a.kedip || !a.kedip.length) return;
    let v = 0;
    if (a.fk == null) { a.tk -= dt; if (a.tk <= 0) a.fk = 0; }
    if (a.fk != null) {
      const f = (a.fk += dt);
      v = f < 0.07 ? f / 0.07 : f < 0.11 ? 1 : f < 0.24 ? 1 - (f - 0.11) / 0.13 : 0;
      if (f >= 0.24) { a.fk = null; a.tk = Math.random() < 0.15 ? 0.15 : 2 + Math.random() * 4; }
    }
    for (const [m, i, b] of a.kedip) m.morphTargetInfluences[i] = v * b;
  }
  function gerakAvatar(a, dt, laju) {
    kedipkan(a, dt);
    a.v += (laju - a.v) * Math.min(1, dt * 5); a.t += dt;
    a.w += (clamp(a.v / 1.1, 0, 1) - a.w) * Math.min(1, dt * 4);
    const w = a.w, d = 1 - w;
    if (a.mixer) {
      if (a.aksiJalan && a.aksiDiam) { a.aksiJalan.setEffectiveWeight(w); a.aksiDiam.setEffectiveWeight(d); }
      else if (a.aksiJalan) a.aksiJalan.timeScale = w;
      a.mixer.update(dt); return;
    }
    if (!a.rig) return;
    // putaran tiap tulang dijumlahkan dulu (jalan/diam + pose), baru dipasang sekali
    const R = {}, tambah = (k, x, y = 0, z = 0, b = 1) => { const r = R[k] || (R[k] = [0, 0, 0]); r[0] += x * b; r[1] += y * b; r[2] += z * b; };
    let eL = 0;
    if (a.lambai != null) {
      const tl = (a.lambai += dt), D = 2.6, e0 = tl < 0.4 ? tl / 0.4 : tl > D - 0.5 ? Math.max(0, (D - tl) / 0.5) : 1;
      eL = e0 * e0 * (3 - 2 * e0); if (tl >= D) a.lambai = null;
    }
    a.fase += dt * Math.PI * Math.max(a.v, 0) / 0.62;
    const s = Math.sin(a.fase), c = Math.cos(a.fase), t = a.t, napas = Math.sin(t * 1.7), geser = Math.sin(t * 0.45);
    // diam: sesekali menoleh/melirik ke arah acak, mengangguk & memiringkan kepala sedikit — dihaluskan
    a.lt -= dt;
    if (a.lt <= 0) { a.lt = 2.2 + Math.random() * 4; const jauh = Math.random() < 0.35;
      a.ly = (Math.random() * 2 - 1) * (jauh ? 0.55 : 0.2); a.lp = (Math.random() * 2 - 1) * 0.1 - 0.03; a.lr = (Math.random() * 2 - 1) * 0.07; }
    const kh = Math.min(1, dt * 2.4); a.cy += (a.ly - a.cy) * kh; a.cp += (a.lp - a.cp) * kh; a.cr += (a.lr - a.cr) * kh;
    // pose (JEV-103): bobot halus tiap pose menuju pose yang diminta peserta atau varian diam otomatis
    const P = pilihPose(a, dt), pw = a.pw && a.pw.length > 18 ? a.pw : (a.pw = Array.from({ length: 19 }, (_, i) => (a.pw && a.pw[i]) || 0)), duduk = Math.max(pw[1], pw[2], pw[8], pw[9], pw[16], pw[17], pw[18]);
    for (let i = 1; i <= 18; i++) if (i !== 5) pw[i] += ((P === i ? 1 : 0) - pw[i]) * Math.min(1, dt * (i <= 2 || i >= 8 ? 3.2 : 2));
    const bebas = 1 - duduk, wd = w * bebas, dd = d * bebas;          // kaki jalan/diam memudar saat duduk
    // kaki
    const pahaL = 0.42 * wd * s, pahaR = -0.42 * wd * s;
    const lututL = -wd * (0.08 + 0.62 * Math.max(0, c)), lututR = -wd * (0.08 + 0.62 * Math.max(0, -c));
    tambah('leftUpperLeg', pahaL); tambah('rightUpperLeg', pahaR);
    tambah('leftLowerLeg', lututL); tambah('rightLowerLeg', lututR);
    tambah('leftFoot', -0.85 * (pahaL + lututL) - 0.18 * wd * Math.max(0, -s)); tambah('rightFoot', -0.85 * (pahaR + lututR) - 0.18 * wd * Math.max(0, s));
    // pinggul, badan, kepala
    const pinggulY = -0.1 * wd * s, pinggulZ = -0.045 * wd * c + 0.022 * dd * geser;
    tambah('hips', 0, pinggulY, pinggulZ);
    tambah('spine', 0.04 * w + 0.01 * d * napas, 0.05 * w * s, -0.6 * pinggulZ);
    tambah('chest', 0.018 * d * napas, 0.07 * w * s, 0.035 * eL);   // condong sedikit menjauhi tangan yang melambai
    tambah('neck', -0.03 * w + 0.4 * d * a.cp, -0.5 * (pinggulY + 0.12 * w * s) + 0.4 * d * a.cy, 0.4 * d * a.cr);
    tambah('head', -0.02 * w + 0.6 * d * a.cp + 0.012 * d * napas + 0.05 * eL, -0.4 * (pinggulY + 0.12 * w * s) + 0.6 * d * a.cy * (1 - eL), 0.6 * d * a.cr + 0.09 * eL);
    // lengan: ayun berlawanan dengan kaki, sedikit ke depan; siku selalu sedikit menekuk
    tambah('leftUpperArm', (-0.28 * w * s + 0.05 * w + 0.015 * d * napas) * bebas); tambah('rightUpperArm', (0.28 * w * s + 0.05 * w + 0.015 * d * napas) * bebas);
    tambah('leftLowerArm', (0.16 + w * (0.1 + 0.12 * Math.max(0, -s))) * bebas); tambah('rightLowerArm', (0.16 + w * (0.1 + 0.12 * Math.max(0, s))) * bebas);
    const turun = poseTambah(a, tambah, pw, t, dt);
    for (const k in R) putarTulang(a, k, R[k][0], R[k][1], R[k][2]);
    if (eL > 0) lambaikan(a, eL);
    a.model.position.y = a.dasarY + 0.035 * wd * (Math.abs(c) - 0.6) - turun;
  }
  /* POSE & VARIAN DIAM (JEV-103) — kode pose dari peserta: 1 duduk di kursi, 2 duduk bersila di lantai,
     3 joget kecil, 4 mengantuk, 5 melambai. Avatar yang diam tanpa pose sendiri sesekali meregang / melihat
     jam / mengangkat bahu, ikut berjoget pelan bila musik sedang diputar, dan mulai mengantuk setelah lama diam. */
  const adaMusik = () => { try { return (typeof bgmMain === 'function' && bgmMain()) || (typeof MEDIA_OBJ !== 'undefined' && MEDIA_OBJ.size > 0); } catch (e) { return false; } };
  function pilihPose(a, dt) {
    const po = (a.tuju && a.tuju.po) | 0;
    if (po === 5 && a.poLalu !== 5) mulaiLambai(a);
    a.poLalu = po;
    if ((po >= 1 && po <= 4) || (po >= 6 && po <= 18)) { a.mikro = null; return po; }
    a.diam = a.v < 0.05 ? (a.diam || 0) + dt : 0;
    if (a.diam > 45) return 4;                                        // lama diam: mengantuk
    if (a.diam > 4 && adaMusik()) return 3;                           // musik: joget pelan
    // gerak kecil acak saat diam
    if (a.mikro) { a.mikro.t += dt; if (a.mikro.t > a.mikro.d) a.mikro = null; }
    else if (a.diam > 6) { a.tm = (a.tm == null ? 6 + Math.random() * 8 : a.tm) - dt;
      if (a.tm <= 0) { a.tm = 9 + Math.random() * 12; const k = ['regang', 'jam', 'bahu'][Math.floor(Math.random() * 3)]; a.mikro = { k, t: 0, d: k === 'regang' ? 2.6 : k === 'jam' ? 2.2 : 1.2 }; } }
    else a.mikro = null;
    return 0;
  }
  const amplop = (t, d, m = 0.45) => { const e = Math.min(1, t / m, (d - t) / m); return e <= 0 ? 0 : e * e * (3 - 2 * e); };
  function poseTambah(a, tambah, pw, t, dt) {
    let turun = 0;
    // 1 duduk di kursi: paha mendatar, lutut 90°, tangan di pangkuan
    if (pw[1] > 0.001) { const b = pw[1];
      tambah('leftUpperLeg', 1.5, 0, 0.06, b); tambah('rightUpperLeg', 1.5, 0, -0.06, b); tambah('leftLowerLeg', -1.5, 0, 0, b); tambah('rightLowerLeg', -1.5, 0, 0, b);
      tambah('spine', 0.04, 0, 0, b); tambah('leftUpperArm', 0.5, 0, 0.1, b); tambah('rightUpperArm', 0.5, 0, -0.1, b);
      tambah('leftLowerArm', 0.6, 0, 0, b); tambah('rightLowerArm', 0.6, 0, 0, b); turun += 0.42 * b; }
    // 2 duduk di lantai: pinggul di lantai, lutut ditekuk ke atas, lengan bertumpu santai di lutut
    if (pw[2] > 0.001) { const b = pw[2];
      tambah('leftUpperLeg', 2.1, 0, 0.18, b); tambah('rightUpperLeg', 2.1, 0, -0.18, b); tambah('leftLowerLeg', -1.65, 0, 0, b); tambah('rightLowerLeg', -1.65, 0, 0, b);
      tambah('leftFoot', -0.4, 0, 0, b); tambah('rightFoot', -0.4, 0, 0, b); tambah('spine', 0.12, 0, 0, b); tambah('chest', 0.06, 0, 0, b); tambah('head', -0.05, 0, 0, b);
      tambah('leftUpperArm', 0.6, 0, 0.16, b); tambah('rightUpperArm', 0.6, 0, -0.16, b); tambah('leftLowerArm', 0.4, 0, 0, b); tambah('rightLowerArm', 0.4, 0, 0, b);
      turun += 0.72 * b; }
    // 3 joget kecil: lutut memantul ±1,9 Hz, pinggul bergoyang, lengan menekuk mengayun, kepala mengangguk
    if (pw[3] > 0.001) { const b = pw[3], f = t * 2 * Math.PI * 1.9, p = Math.sin(f), q = Math.sin(f / 2), naik = Math.max(0, p);
      tambah('leftUpperLeg', 0.12 + 0.12 * naik, 0, 0, b); tambah('rightUpperLeg', 0.12 + 0.12 * naik, 0, 0, b);
      tambah('leftLowerLeg', -0.25 - 0.22 * naik, 0, 0, b); tambah('rightLowerLeg', -0.25 - 0.22 * naik, 0, 0, b);
      tambah('leftFoot', 0.12 + 0.1 * naik, 0, 0, b); tambah('rightFoot', 0.12 + 0.1 * naik, 0, 0, b);
      tambah('hips', 0, 0.12 * q, 0.07 * q, b); tambah('spine', 0.03, -0.08 * q, -0.05 * q, b); tambah('chest', 0, -0.06 * q, 0, b);
      tambah('leftUpperArm', 0.45 + 0.28 * Math.sin(f + 1), 0, 0.22, b); tambah('rightUpperArm', 0.45 + 0.28 * Math.sin(f + 2.2), 0, -0.22, b);
      tambah('leftLowerArm', 1.25 + 0.25 * p, 0, 0, b); tambah('rightLowerArm', 1.25 - 0.25 * p, 0, 0, b);
      tambah('head', 0.06 * p, 0.1 * q, 0.07 * q, b); turun += 0.035 * naik * b; }
    // 4 mengantuk: kepala pelan-pelan tertunduk lalu tersentak bangun; sesekali menguap (kepala menengadah, tangan ke mulut)
    if (pw[4] > 0.001) { const b = pw[4];
      a.kt = (a.kt || 0) + dt; const siklus = 7.5, u = a.kt % siklus, tunduk = u < 6 ? Math.pow(u / 6, 1.6) : Math.max(0, 1 - (u - 6) / 0.25);
      a.ky = (a.ky == null ? 9 : a.ky) - dt; if (a.ky < -2.6) a.ky = 10 + Math.random() * 8;
      const uap = a.ky < 0 ? amplop(-a.ky, 2.6, 0.6) : 0, k = tunduk * (1 - uap);
      tambah('neck', 0.3 * k - 0.15 * uap, 0, 0.05 * k, b); tambah('head', 0.5 * k - 0.3 * uap, 0, 0.08 * k, b);
      tambah('chest', 0.1 + 0.05 * k - 0.08 * uap, 0, 0, b); tambah('spine', 0.06, 0, 0, b);
      tambah('leftUpperArm', -0.04, 0, -0.04, b); tambah('rightUpperArm', -0.04 + 2.0 * uap, 0, -0.35 * uap, b); tambah('rightLowerArm', 1.9 * uap, 0, 0, b);
      tambah('leftUpperLeg', 0, 0, 0.03, b); tambah('rightUpperLeg', 0, 0, -0.03, b); }
    /* INTERAKSI BERPASANGAN (JEV-109) — 6 peluk, 7 gandeng tangan (a.sisi: 1 tangan kanan, −1 kiri), 8 duduk bersandar ke
       samping (a.sandar: 1 ke kanan, −1 ke kiri), 9 berbaring telentang (akar avatar = permukaan kasur), 10 dansa berdua */
    if (pw[6] > 0.001) { const b = pw[6], n = 0.04 * Math.sin(t * 1.6);
      tambah('leftUpperArm', 0.78, 0, -0.12, b); tambah('rightUpperArm', 0.78, 0, 0.12, b); tambah('leftLowerArm', 0.95 + n, 0, 0, b); tambah('rightLowerArm', 0.95 + n, 0, 0, b);
      tambah('spine', 0.06, 0, 0, b); tambah('chest', 0.1, 0, 0, b); tambah('neck', 0.05, 0, 0, b); tambah('head', 0.1, 0.25, -0.12, b); }
    if (pw[7] > 0.001) { const b = pw[7], s = a.sisi === -1 ? -1 : 1, k = s === 1 ? 'right' : 'left';
      tambah(k + 'UpperArm', 0.22, 0, -0.42 * s, b); tambah(k + 'LowerArm', 0.12, 0, 0, b); tambah('head', 0, 0.12 * s * -1, 0, b * 0.5); }
    if (pw[8] > 0.001) { const b = pw[8], s = a.sandar === -1 ? -1 : 1;
      tambah('leftUpperLeg', 1.5, 0, 0.06, b); tambah('rightUpperLeg', 1.5, 0, -0.06, b); tambah('leftLowerLeg', -1.5, 0, 0, b); tambah('rightLowerLeg', -1.5, 0, 0, b);
      tambah('spine', 0.02, 0, 0.1 * s, b); tambah('chest', 0, 0, 0.12 * s, b); tambah('neck', 0, 0, 0.16 * s, b); tambah('head', 0.05, 0.1 * s, 0.32 * s, b);
      tambah('leftUpperArm', 0.5, 0, 0.1, b); tambah('rightUpperArm', 0.5, 0, -0.1, b); tambah('leftLowerArm', 0.6, 0, 0, b); tambah('rightLowerArm', 0.6, 0, 0, b); turun += 0.42 * b; }
    if (pw[9] > 0.001) { const b = pw[9], napas = 0.025 * Math.sin(t * 1.3);
      tambah('hips', -Math.PI / 2, 0, 0, b); tambah('chest', napas, 0, 0, b); tambah('head', 0.28, 0.15 * Math.sin(t * 0.13), 0, b);
      tambah('leftUpperArm', -0.08, 0, 0.12, b); tambah('rightUpperArm', -0.08, 0, -0.12, b); tambah('leftLowerArm', 0.25, 0, 0, b); tambah('rightLowerArm', 0.25, 0, 0, b);
      tambah('leftUpperLeg', 0.32, 0, 0.04, b); tambah('leftLowerLeg', -0.55, 0, 0, b); tambah('rightUpperLeg', 0.04, 0, -0.04, b);
      turun += ((a.tinggiPinggul || 0.9) - 0.13) * b; }
    if (pw[10] > 0.001) { const b = pw[10], f = t * 2 * Math.PI * 0.42, p = Math.sin(f), naik = Math.max(0, p), turunK = Math.max(0, -p);
      tambah('leftUpperArm', 0.72, 0, 0.1, b); tambah('rightUpperArm', 0.72, 0, -0.1, b); tambah('leftLowerArm', 0.7, 0, 0, b); tambah('rightLowerArm', 0.7, 0, 0, b);
      tambah('hips', 0, 0.07 * p, 0.05 * p, b); tambah('spine', 0.03, -0.04 * p, -0.04 * p, b); tambah('head', 0.04, 0, 0.1 + 0.04 * p, b);
      tambah('leftUpperLeg', 0.1 * naik, 0, 0, b); tambah('rightUpperLeg', 0.1 * turunK, 0, 0, b); tambah('leftLowerLeg', -0.18 * naik, 0, 0, b); tambah('rightLowerLeg', -0.18 * turunK, 0, 0, b);
      turun += 0.012 * (naik + turunK) * b; }
    /* AKTIVITAS (JEV-110) — 11 membawa barang di depan dada, 12 memancing (tangan kanan memegang joran, kiri menggulung),
       13 mengayun kapak (angkat tinggi → hantam), 14 memasak (membalik dengan spatula, kepala menunduk ke panggangan) */
    if (pw[11] > 0.001) { const b = pw[11];
      tambah('leftUpperArm', 0.95, 0, -0.16, b); tambah('rightUpperArm', 0.95, 0, 0.16, b); tambah('leftLowerArm', 0.8, 0, 0, b); tambah('rightLowerArm', 0.8, 0, 0, b); tambah('spine', -0.05, 0, 0, b); }
    if (pw[12] > 0.001) { const b = pw[12], g = Math.sin(t * 9);
      tambah('rightUpperArm', 0.95, 0, -0.1, b); tambah('rightLowerArm', 0.85, 0, 0, b); tambah('leftUpperArm', 0.8, 0, -0.28, b); tambah('leftLowerArm', 1.15 + 0.18 * g, 0.15 * g, 0, b);
      tambah('spine', 0.05, 0, 0, b); tambah('head', 0.12, 0, 0, b); }
    if (pw[13] > 0.001) { const b = pw[13], f = (t * 0.85) % 1, naik = f < 0.62 ? Math.sin(f / 0.62 * Math.PI / 2) : f < 0.74 ? 1 - (f - 0.62) / 0.12 * 1.25 : -0.25 * (1 - (f - 0.74) / 0.26);
      const tangan = 0.55 + 2.2 * Math.max(-0.1, naik);
      tambah('leftUpperArm', tangan, 0, -0.18, b); tambah('rightUpperArm', tangan, 0, 0.18, b); tambah('leftLowerArm', 0.35, 0, 0, b); tambah('rightLowerArm', 0.35, 0, 0, b);
      tambah('spine', 0.22 * (1 - Math.max(0, naik)) - 0.08 * Math.max(0, naik), 0, 0, b); tambah('chest', 0.1 * (1 - Math.max(0, naik)), 0, 0, b);
      tambah('leftUpperLeg', 0.15, 0, 0.08, b); tambah('rightUpperLeg', 0.15, 0, -0.08, b); tambah('leftLowerLeg', -0.25, 0, 0, b); tambah('rightLowerLeg', -0.25, 0, 0, b); turun += 0.03 * b; }
    if (pw[14] > 0.001) { const b = pw[14], g = Math.sin(t * 3.2);
      tambah('rightUpperArm', 0.75, 0, -0.08, b); tambah('rightLowerArm', 0.85 + 0.35 * Math.max(0, g), 0.25 * g, 0, b); tambah('leftUpperArm', 0.55, 0, -0.12, b); tambah('leftLowerArm', 1.0, 0, 0, b);
      tambah('neck', 0.12, 0, 0, b); tambah('head', 0.22, 0, 0, b); tambah('spine', 0.08, 0, 0, b); }
    /* KASIH SAYANG (ramah semua umur) — 15 cium pipi: condong ke depan, kepala miring ke samping, tangan memegang
       lengan pasangan; 16 dipangku: duduk menyamping di pangkuan, lengan kiri merangkul bahu, kepala bersandar ke kiri */
    if (pw[15] > 0.001) { const b = pw[15];
      tambah('spine', 0.1, 0, 0, b); tambah('chest', 0.08, 0, 0, b); tambah('neck', 0.1, 0.12, 0, b); tambah('head', 0.12, 0.3, -0.16, b);
      tambah('leftUpperArm', 0.6, 0, -0.1, b); tambah('rightUpperArm', 0.6, 0, 0.1, b); tambah('leftLowerArm', 0.75, 0, 0, b); tambah('rightLowerArm', 0.75, 0, 0, b);
      tambah('leftFoot', 0.15, 0, 0, b); tambah('rightFoot', 0.15, 0, 0, b); }
    if (pw[16] > 0.001) { const b = pw[16], napas = 0.02 * Math.sin(t * 1.4);
      tambah('leftUpperLeg', 1.45, 0, 0.04, b); tambah('rightUpperLeg', 1.45, 0, -0.04, b); tambah('leftLowerLeg', -1.35, 0, 0, b); tambah('rightLowerLeg', -1.35, 0, 0, b);
      tambah('spine', 0.02, 0, -0.06, b); tambah('chest', napas, 0, -0.06, b); tambah('neck', 0, -0.1, -0.12, b); tambah('head', 0.04, -0.15, -0.22, b);
      tambah('leftUpperArm', 1.7, 0, 0.35, b); tambah('leftLowerArm', 1.0, 0, 0, b); tambah('rightUpperArm', 0.5, 0, -0.1, b); tambah('rightLowerArm', 0.7, 0, 0, b);
      turun += 0.42 * b; }
    /* BERENANG (JEV-113) — akar avatar = permukaan air. 17 mengapung: badan tegak terendam sebatas bahu, tangan mengayuh
       pelan ke samping, kaki mengayuh bergantian; 18 gaya bebas: badan telungkup mendatar tepat di bawah permukaan, tangan
       berputar bergantian (tarik di bawah badan, ayun di atas air dengan siku ditekuk & lengan sedikit membuka), badan
       berguling mengikuti tangan, kaki menendang cepat, kepala menengadah melihat ke depan */
    if (pw[17] > 0.001) { const b = pw[17], g = Math.sin(t * 2.4), h = Math.cos(t * 2.4);
      tambah('leftUpperArm', 0.55, 0.3 * g, 0.75, b); tambah('rightUpperArm', 0.55, -0.3 * g, -0.75, b);
      tambah('leftLowerArm', 0.5 + 0.2 * h, 0, 0, b); tambah('rightLowerArm', 0.5 - 0.2 * h, 0, 0, b);
      tambah('leftUpperLeg', 0.45 + 0.3 * g, 0, 0.12, b); tambah('rightUpperLeg', 0.45 - 0.3 * g, 0, -0.12, b);
      tambah('leftLowerLeg', -0.8 - 0.3 * h, 0, 0, b); tambah('rightLowerLeg', -0.8 + 0.3 * h, 0, 0, b);
      tambah('head', -0.08, 0, 0, b);
      turun += ((a.tinggiPinggul || 0.9) * 1.42 + 0.03 * g) * b; }
    if (pw[18] > 0.001) { const b = pw[18], f = t * 2 * Math.PI * 0.75, k4 = Math.sin(f * 3), TAU = 2 * Math.PI;
      for (const [k, sisi, geser] of [['left', 1, 0], ['right', -1, Math.PI]]) {
        const u = ((f + geser) % TAU + TAU) % TAU, ayun = u > Math.PI ? Math.sin(u - Math.PI) : 0;   // u 0…π tarik, π…2π ayun di atas air
        tambah(k + 'UpperArm', Math.PI - u, 0, sisi * 0.35 * ayun, b); tambah(k + 'LowerArm', 0.25 + 1.0 * ayun, 0, 0, b);
      }
      tambah('hips', Math.PI / 2 - 0.1, 0, 0, b); tambah('spine', -0.05, 0, 0, b); tambah('chest', 0, 0.16 * Math.sin(f), 0, b);
      tambah('neck', -0.35, 0, 0, b); tambah('head', -0.35, 0.2 * Math.sin(f), 0, b);
      tambah('leftUpperLeg', 0.22 * k4, 0, 0.04, b); tambah('rightUpperLeg', -0.22 * k4, 0, -0.04, b);
      tambah('leftLowerLeg', -0.12 - 0.18 * Math.max(0, -k4), 0, 0, b); tambah('rightLowerLeg', -0.12 - 0.18 * Math.max(0, k4), 0, 0, b);
      tambah('leftFoot', 0.6, 0, 0, b); tambah('rightFoot', 0.6, 0, 0, b);
      turun += ((a.tinggiPinggul || 0.9) + 0.06) * b; }
    // gerak kecil saat diam
    const M = a.mikro;
    if (M) { const e = amplop(M.t, M.d);
      if (M.k === 'regang') { tambah('leftUpperArm', 2.8, 0, 0.12, e); tambah('rightUpperArm', 2.8, 0, -0.12, e); tambah('leftLowerArm', -0.1, 0, 0, e); tambah('rightLowerArm', -0.1, 0, 0, e); tambah('chest', -0.12, 0, 0, e); tambah('head', -0.18, 0, 0, e); }
      else if (M.k === 'jam') { tambah('leftUpperArm', 0.55, 0, 0.12, e); tambah('leftLowerArm', 1.7, -0.6, 0, e); tambah('head', 0.32, 0.18, 0, e); tambah('neck', 0.12, 0.1, 0, e); }
      else { const h = Math.sin(Math.min(1, M.t / M.d) * Math.PI); tambah('leftUpperArm', 0.1, 0, 0.18 * h, e); tambah('rightUpperArm', 0.1, 0, -0.18 * h, e); tambah('leftLowerArm', 0.5 * h, 0, 0, e); tambah('rightLowerArm', 0.5 * h, 0, 0, e); tambah('head', 0, 0, 0.1 * h, e); } }
    return turun;
  }
  /* melambai (saat pesan obrolan peserta ini tiba): dihitung dalam ruang avatar — lengan atas ke samping-depan
     (siku ±setinggi bahu), lengan bawah tegak berayun kiri-kanan dari siku ±1,8 Hz, telapak diputar menghadap
     depan; dicampur (slerp) dengan pose jalan/diam menurut bobot masuk-keluar yang dihaluskan */
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3(), qA = new THREE.Quaternion(), qC = new THREE.Quaternion(), qGi = new THREE.Quaternion();
  const keG = (b, out) => out.copy(qGi).multiply(b.getWorldQuaternion(qC));
  function pasangG(b, qDuniaG, e) {
    const kini = keG(b, new THREE.Quaternion()), tuju = kini.clone().slerp(qDuniaG, e);
    b.quaternion.copy(keG(b.parent, new THREE.Quaternion()).invert().multiply(tuju)); b.updateMatrixWorld(true);
  }
  function lambaikan(a, e) {
    const up = a.rig.rightUpperArm, low = a.rig.rightLowerArm; if (!up || !up.restG) return;
    a.g.updateMatrixWorld(true); qGi.copy(a.g.getWorldQuaternion(qA)).invert();
    const tl = a.lambai == null ? 0 : a.lambai, amp = Math.min(1, Math.max(0, (tl - 0.3) / 0.35)), ayun = Math.sin((tl - 0.3) * 2 * Math.PI * 1.8) * amp;
    // lengan atas: ke kanan avatar (−X), sedikit naik & ke depan
    vA.set(-0.8 - 0.04 * ayun, 0.32, 0.42).normalize();
    pasangG(up.b, new THREE.Quaternion().setFromUnitVectors(up.arahG, vA).multiply(up.restG), e);
    if (!low || !low.restG) return;
    // lengan bawah: tegak, condong sedikit ke luar & depan, berayun dari siku
    vB.set(-0.12 + 0.36 * ayun, 1, 0.22).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(low.arahG, vB);
    // telapak: pada pose T telapak menghadap bawah; arahkan ke depan (+Z) dengan memutar di sumbu lengan bawah
    const telapak = new THREE.Vector3(0, -1, 0).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(vC.set(-1, 0, 0), low.arahG)).applyQuaternion(q);
    const p1 = telapak.sub(vB.clone().multiplyScalar(telapak.dot(vB))), p2 = new THREE.Vector3(0, 0, 1).sub(vB.clone().multiplyScalar(vB.z));
    if (p1.lengthSq() > 1e-6 && p2.lengthSq() > 1e-6) q.premultiply(new THREE.Quaternion().setFromUnitVectors(p1.normalize(), p2.normalize()));
    pasangG(low.b, q.multiply(low.restG), e);
  }
  function mulaiLambai(a) { if (a && a.rig && a.rig.rightUpperArm && a.rig.rightUpperArm.restG) a.lambai = a.lambai != null && a.lambai < 2 ? 0.4 : 0; }
  L.gerak = { siapkanGerak, gerakAvatar, tebakRig, cariKedip, mulaiLambai, posSaya: () => posSaya(), posAman: d => posAman(d) };
  function bacaAvatar3D(buf) {
    return new Promise((ok, no) => {
      if (uriLuarGLTF(buf)) return no(new Error('avatar merujuk berkas di luar dirinya'));
      new THREE.GLTFLoader().parse(buf, '', async gltf => {
        try {
          const root = gltf.scene || (gltf.scenes && gltf.scenes[0]); if (!root) throw new Error('avatar kosong');
          const ext = (gltf.parser && gltf.parser.json && gltf.parser.json.extensions) || {}, vrm0 = !!ext.VRM;
          const tulang = vrm0 ? Object.fromEntries(((ext.VRM.humanoid && ext.VRM.humanoid.humanBones) || []).map(b => [b.bone, b.node]))
            : Object.fromEntries(Object.entries((ext.VRMC_vrm && ext.VRMC_vrm.humanoid && ext.VRMC_vrm.humanoid.humanBones) || {}).map(([k, b]) => [k, b && b.node]));
          for (const [nama, arah] of [['leftUpperArm', vrm0 ? 1 : -1], ['rightUpperArm', vrm0 ? -1 : 1]]) {
            if (!Number.isInteger(tulang[nama])) continue;
            try { const n = await gltf.parser.getDependency('node', tulang[nama]); if (n) n.rotation.z += arah * 1.32; } catch (e) { /* tanpa kerangka */ }
          }
          // jari pose rileks (sedikit menekuk ke telapak) — jari lurus terentang terlihat seperti cakar saat berjalan
          for (const sisi of ['left', 'right']) {
            const arah = (sisi === 'left' ? -1 : 1) * (vrm0 ? -1 : 1);
            for (const jari of ['Index', 'Middle', 'Ring', 'Little']) for (const [ruas, sd] of [['Proximal', 0.3], ['Intermediate', 0.45], ['Distal', 0.35]]) {
              const i = tulang[sisi + jari + ruas]; if (!Number.isInteger(i)) continue;
              try { const n = await gltf.parser.getDependency('node', i); if (n) n.rotation.z += arah * sd * (jari === 'Index' ? 0.7 : 1); } catch (e) { /* abaikan */ }
            }
          }
          // tulang untuk animasi prosedural: pemetaan humanoid VRM, atau tebakan nama (Mixamo/Avaturn/Blender)
          const rig = {};
          for (const kunci of RIG) if (Number.isInteger(tulang[kunci])) { try { const n = await gltf.parser.getDependency('node', tulang[kunci]); if (n) rig[kunci] = n; } catch (e) { /* abaikan */ } }
          if (!Object.keys(rig).length) tebakRig(root, rig);
          // kedip: ekspresi "blink" VRM (1.0: node+morph, 0.x: mesh+morph, bobot 0–100), atau morph bernama blink/eye close
          const kedip = [], tugas = [], json = gltf.parser.json;
          const tambahKedip = async (iNode, morf, bobot) => { try { const n = await gltf.parser.getDependency('node', iNode);
            if (n) n.traverse(m => { if (m.morphTargetInfluences && morf < m.morphTargetInfluences.length) kedip.push([m, morf, clamp(+bobot || 0, 0, 1)]); }); } catch (e) { /* abaikan */ } };
          if (vrm0) {
            const grup = ((ext.VRM.blendShapeMaster || {}).blendShapeGroups || []).find(x => /^blink$/i.test(x.presetName || ''));
            for (const b of (grup && grup.binds) || []) (json.nodes || []).forEach((nd, i) => { if (nd.mesh === b.mesh) tugas.push(tambahKedip(i, b.index, (b.weight ?? 100) / 100)); });
          } else {
            const e = ext.VRMC_vrm && ext.VRMC_vrm.expressions && ext.VRMC_vrm.expressions.preset && ext.VRMC_vrm.expressions.preset.blink;
            for (const b of (e && e.morphTargetBinds) || []) tugas.push(tambahKedip(b.node, b.index, b.weight ?? 1));
          }
          await Promise.all(tugas);
          if (!kedip.length) kedip.push(...cariKedip(root));
          root.updateMatrixWorld(true);
          const kotak = new THREE.Box3().setFromObject(root), uk = kotak.getSize(new THREE.Vector3());
          if (!(uk.y > 1e-4)) throw new Error('avatar kosong');
          const k = AV_TINGGI / uk.y, c = kotak.getCenter(new THREE.Vector3());
          root.scale.multiplyScalar(k); root.position.set(-c.x * k, -kotak.min.y * k, -c.z * k);
          const bungkus = new THREE.Group(); bungkus.add(root); if (vrm0) bungkus.rotation.y = Math.PI;
          let kulit = false;
          bungkus.traverse(n => { if (n.isMesh) { n.castShadow = true; n.userData.noExport = true; } if (n.isSkinnedMesh) { kulit = true; n.frustumCulled = false; } });
          bungkus.userData.berkulit = kulit;
          // posisi tulang dalam urutan traverse — dipakai ulang pada tiap klon
          const urut = []; bungkus.traverse(n => urut.push(n));
          bungkus.userData.rigIdx = Object.fromEntries(Object.entries(rig).map(([k, n]) => [k, urut.indexOf(n)]).filter(([, i]) => i >= 0));
          bungkus.userData.kedipIdx = kedip.map(([m, i, b]) => [urut.indexOf(m), i, b]).filter(([u]) => u >= 0).slice(0, 8);
          bungkus.userData.klip = (gltf.animations || []).filter(c => c && c.duration > 0 && c.tracks.length).slice(0, 8);
          ok(bungkus);
        } catch (e) { no(e); }
      }, e => no(new Error((e && e.message) || 'avatar tidak terbaca')));
    });
  }
  L.cobaAvatar3D = buf => bacaAvatar3D(buf);
  // karakter bawaan diambil dari situs sendiri (berkasnya tidak diubah). Teksturnya tidak dikodekan ulang
  // (lambat: ±10 dtk untuk PNG 2048 px) — cukup digambar ulang ≤ 1024 px di kanvas setelah dibaca, di memori saja
  function ambilBawaan(k) {
    if (!/^(F|M)(_renang2?)?$/.test(k)) return Promise.reject(new Error('karakter tidak dikenal'));
    return fetch('avatar/' + k + '.vrm').then(r => { if (!r.ok) throw new Error('karakter ' + k + ' tidak tersedia (HTTP ' + r.status + ')'); return r.arrayBuffer(); });
  }
  function kecilkanTekstur(root, maks) {
    const sudah = new Set();
    root.traverse(m => { if (!m.isMesh) return;
      for (const mt of [].concat(m.material)) for (const k of ['map', 'emissiveMap', 'normalMap']) {
        const t = mt && mt[k], im = t && t.image; if (!im || sudah.has(t)) continue; sudah.add(t);
        const w = im.width, h = im.height, s = maks / Math.max(w, h); if (!(s < 1)) continue;
        const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        if (typeof im.close === 'function') im.close();
        t.image = c; t.needsUpdate = true;
      } });
    return root;
  }
  function muatAvatar3D(av) {
    const k = av.bawaan ? 'bawaan:' + av.bawaan : av.bagian.join();
    if (!AV_MODEL.has(k)) AV_MODEL.set(k, (av.bawaan ? ambilBawaan(av.bawaan).then(buf => bacaAvatar3D(buf)).then(r => kecilkanTekstur(r, 1024))
      : ambilLampiran(av.bagian, AV_MAKS).then(u8 => bacaAvatar3D(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength))))
      .catch(e => { AV_MODEL.delete(k); throw e; }));
    return AV_MODEL.get(k);
  }
  L.muatAvatar3D = muatAvatar3D; L.avAman = avAman;
  function pasang3D(a, p) {
    if (!p.av) return;
    muatAvatar3D(p.av).then(tpl => {
      if (L.avatar.get(p.id) !== a) return;              // peserta sudah keluar
      const m = klonModel(tpl); m.userData.klip = tpl.userData.klip; m.userData.rigIdx = tpl.userData.rigIdx; m.userData.kedipIdx = tpl.userData.kedipIdx;
      if (p.av.bawaan && p.av.benih != null) muatModul('npc').then(() => { if (L.avatar.get(p.id) === a) { window.NPC.warnaiAvatar(m, tpl, p.av.bawaan, p.av.benih); bayangKotor(); } }, () => {});
      a.g.add(m); a.kepala = AV_TINGGI + 0.28; a.d.classList.add('lb-3d'); siapkanGerak(a, m); bayangKotor();
    }).catch(e => console.warn('avatar 3D', p.nama, e.message));
  }
  // baju renang (JEV-113): karakter bawaan berganti ke versinya yang berpakaian renang (avatar/F_renang.vrm, F_renang2.vrm,
  // M_renang.vrm — karakter yang sama diekspor dari VRoid Studio) selama berpose berenang; tanpa berkas itu tetap berbaju biasa.
  // Karakter F punya dua pilihan baju renang: dipilih dari benih warna, jadi semua peserta melihat baju yang sama
  const sufiksRenang = (k, benih) => (k === 'F' && (benih >>> 0) % 2 === 1 ? '_renang2' : '_renang');
  L.sufiksRenang = sufiksRenang;
  const BAJU_TIADA = new Set();
  function bajuAvatar(a, p) {
    const po = a.tuju && a.tuju.po, bw = p.av && p.av.bawaan, suf = bw ? sufiksRenang(bw, p.av.benih || 0) : '';
    const mau = (po === 17 || po === 18) && bw && !BAJU_TIADA.has(bw + suf) ? suf : '';
    if (!bw || !a.model || (a.baju || '') === mau || a.bajuMuat === mau) return;
    a.bajuMuat = mau;
    muatAvatar3D({ bawaan: bw + mau }).then(tpl => {
      a.bajuMuat = null;
      if (L.avatar.get(p.id) !== a) return;
      const m = klonModel(tpl); m.userData.klip = tpl.userData.klip; m.userData.rigIdx = tpl.userData.rigIdx; m.userData.kedipIdx = tpl.userData.kedipIdx;
      if (p.av.benih != null) muatModul('npc').then(() => { if (a.model === m) { window.NPC.warnaiAvatar(m, tpl, bw, p.av.benih, mau); bayangKotor(); } }, () => {});
      if (a.model) a.g.remove(a.model);
      a.g.add(m); siapkanGerak(a, m); a.baju = mau; bayangKotor();
    }, () => { a.bajuMuat = null; if (mau) BAJU_TIADA.add(bw + mau); });
  }
  function buatAvatar(p) {
    if (!L.grup) { L.grup = new THREE.Group(); L.grup.userData.noExport = true; scene.add(L.grup); }
    const g = new THREE.Group(); g.visible = false; g.userData.noExport = true; L.grup.add(g);
    const d = el('div', 'lb-av'); d.hidden = true;
    let f;
    if (p.foto) { f = el('img', 'lb-foto'); f.alt = ''; f.src = p.foto; }
    else { f = el('div', 'lb-foto', ([...p.nama][0] || '?').toUpperCase()); f.style.background = p.warna; }
    d.appendChild(f); d.appendChild(el('div', 'lb-nm', p.nama)); d.style.setProperty('--c', p.warna);
    d.classList.toggle('lb-bicara', L.suara.has(p.id));
    lapisan().appendChild(d);
    return { g, d };
  }
  // gelembung obrolan: ≤ 3 baris (CSS), hilang sendiri setelah 6 detik
  function gelembung(id, teks) {
    const a = L.avatar.get(id); if (!a || !teks) return;
    if (a.gel) a.gel.remove();
    const b = el('div', 'lb-gel', teks); a.d.appendChild(b); a.gel = b; mulaiLambai(a);
    clearTimeout(a.gelT); a.gelT = setTimeout(() => { if (a.gel === b) { b.remove(); a.gel = null; } }, 6000);
  }
  const vKepala = new THREE.Vector3(), vLayar = new THREE.Vector3(), sinarTutup = new THREE.Raycaster();
  let tTutup = 0;
  function letakAvatar() {
    const kanvas = renderer.domElement, W = kanvas.clientWidth, H = kanvas.clientHeight, cekTutup = performance.now() - tTutup > 200;
    if (cekTutup) tTutup = performance.now();
    for (const a of L.avatar.values()) {
      const sr = L.suara.get(a.id);
      if (!a.g.visible) { a.d.hidden = true; if (sr) sr.a.volume = 0.8; continue; }
      vKepala.set(a.g.position.x, a.g.position.y + (a.kepala || KEPALA), a.g.position.z);
      vLayar.copy(vKepala).project(camera);
      const jarak = camera.position.distanceTo(vKepala);
      if (sr) sr.a.volume = clamp(2.5 / Math.max(jarak, 0.1), 0.12, 1);   // makin jauh makin pelan (iOS mengabaikan volume)
      if (vLayar.z > 1 || vLayar.z < -1 || jarak < 0.3) { a.d.hidden = true; continue; }
      if (cekTutup) {
        sinarTutup.set(camera.position, vKepala.clone().sub(camera.position).normalize()); sinarTutup.far = jarak - 0.35;
        a.tutup = sinarTutup.far > 0 && sinarTutup.intersectObject(worldRoot, true).some(h => h.object.visible && !h.object.userData.halo);
      }
      if (a.tutup) { a.d.hidden = true; continue; }
      const sk = camera.isPerspectiveCamera ? clamp(BULAT * H / (2 * jarak * Math.tan(camera.fov * Math.PI / 360)) / PX, 0.22, 1.3) : 0.8;
      a.d.hidden = false;
      a.d.style.transform = `translate3d(${((vLayar.x + 1) / 2 * W).toFixed(1)}px,${((1 - vLayar.y) / 2 * H).toFixed(1)}px,0) scale(${sk.toFixed(3)})`;
      a.d.style.zIndex = String(1000 - Math.round(jarak * 10));
    }
  }
  function hapusAvatar(id) {
    const a = L.avatar.get(id); if (!a) return; L.avatar.delete(id); clearTimeout(a.gelT);
    if (a.g.parent) a.g.parent.remove(a.g);
    a.d.remove();
  }
  const hapusSemuaAvatar = () => { for (const id of [...L.avatar.keys()]) hapusAvatar(id); };
  function posAman(d) {
    if (!d || !d.jalan) return null;
    // po: pose (JEV-103 0–5, JEV-109 6–10, JEV-110 11–14 aktivitas, 15–16 kasih sayang, JEV-113 17–18 berenang); ad: adegan/area tempat peserta berada (JEV-105) — avatar hanya tampil di area yang sama
    const po = Math.round(+d.po) || 0, ad = typeof d.ad === 'string' && /^[A-Za-z0-9_-]{1,24}$/.test(d.ad) ? d.ad : '';
    return { x: angkaAman(d.x, -1e4, 1e4), y: angkaAman(d.y, -100, 500), z: angkaAman(d.z, -1e4, 1e4), yaw: angkaAman(d.yaw, -100, 100),
      ...(po >= 1 && po <= 18 ? { po } : {}), ...(ad ? { ad } : {}) };
  }
  function perbaruiPos(id, pos) {
    if (L.saya && id === L.saya.id) return;
    const p = L.peserta.get(id); if (!p) return;
    let a = L.avatar.get(id); if (!a) { a = { ...buatAvatar(p), id, tuju: null }; L.avatar.set(id, a); pasang3D(a, p); }
    const sini = !!pos && (pos.ad || '') === (PROJECT.adeganKini || '');
    a.tuju = sini ? pos : null; bajuAvatar(a, p);
    if (sini && !a.g.visible) { a.g.position.set(pos.x, pos.y, pos.z); a.g.rotation.y = pos.yaw; }
    a.g.visible = sini;
  }
  // peta bayangan adegan hanya digambar ulang bila ditandai kotor: avatar yang bergerak menandainya ±10×/detik
  // (tanpa ini bayangan lengan pose T / langkah lama tertinggal di dinding & lantai)
  let tBayang = 0;
  function stepAvatar(dt) {
    let gerak = false;
    for (const a of L.avatar.values()) {
      if (!a.tuju) continue; const g = a.g, k = Math.min(1, dt * 10), x0 = g.position.x, z0 = g.position.z;
      g.position.x += (a.tuju.x - g.position.x) * k; g.position.y += (a.tuju.y - g.position.y) * k; g.position.z += (a.tuju.z - g.position.z) * k;
      const d = Math.atan2(Math.sin(a.tuju.yaw - g.rotation.y), Math.cos(a.tuju.yaw - g.rotation.y)); g.rotation.y += d * k;
      if (a.model && g.visible && dt > 0) {
        const laju = Math.hypot(g.position.x - x0, g.position.z - z0) / dt;
        gerakAvatar(a, dt, laju);
        if (laju > 0.02 || a.w > 0.02 || Math.abs(d) > 0.002) gerak = true;
      }
    }
    tBayang -= dt;
    if (gerak && tBayang <= 0) { BAYANG_KOTOR = Math.max(BAYANG_KOTOR, 1); tBayang = 0.1; }   // peta bayangan saja, bukan probe pantulan
  }
  const KODE_GAYA = { joget: 3, ngantuk: 4, lambai: 5, peluk: 6, gandeng: 7, dansa: 10, bawa: 11, mancing: 12, kapak: 13, masak: 14, cium: 15, renang: 17, bebas: 18 };
  function posSaya() {
    if (!FPS.on) return { jalan: 0 };
    // gaya pilihan sendiri berakhir saat mulai berjalan; melambai hanya ±2,6 dtk
    const G = FPS.gaya;
    const batas = G && (/^(gandeng|bawa|mancing|kapak|masak|renang|bebas)$/.test(G.k) ? Infinity : G.k === 'dansa' ? 1.2 : 0.2);
    if (G && (Math.hypot(camera.position.x - G.x, camera.position.z - G.z) > batas || (G.k === 'lambai' && performance.now() - G.t > 2600))) FPS.gaya = null;
    const B = FPS.duduk && FPS.duduk.baring;
    if (B) return { jalan: 1, x: +B.x.toFixed(2), y: +B.y.toFixed(2), z: +B.z.toFixed(2), yaw: +B.yaw.toFixed(3), po: 9, ...(PROJECT.adeganKini ? { ad: PROJECT.adeganKini } : {}) };
    const po = FPS.duduk ? (FPS.duduk.lantai ? 2 : 1) : FPS.gaya ? KODE_GAYA[FPS.gaya.k] || 0 : 0;
    return { jalan: 1, x: +camera.position.x.toFixed(2), y: +FPS.feet.toFixed(2), z: +camera.position.z.toFixed(2), yaw: +FPS.yaw.toFixed(3),
      ...(po ? { po } : {}), ...(PROJECT.adeganKini ? { ad: PROJECT.adeganKini } : {}) };
  }

  /* ---------- obrolan suara (opsional) ----------
     Peserta yang menyalakan mic memanggil setiap peserta lain lewat panggilan audio PeerJS (langsung
     antar-peramban, DTLS-SRTP); penerima menjawab tanpa mic-nya sendiri — satu arah per pembicara.
     Hanya panggilan dari peserta ruang ini yang dijawab, trek video dibuang. Volume mengikuti jarak avatar. */
  function tandaiBicara(id, on) { const a = L.avatar.get(id); if (a) a.d.classList.toggle('lb-bicara', on); }
  function pasangPenerimaSuara(P) {
    P.on('call', c => {
      const terima = () => {
        if (L.peer !== P || !L.peserta.has(c.peer) || (L.saya && c.peer === L.saya.id)) { try { c.close(); } catch (e) { /* abaikan */ } return; }
        c.answer();
        c.on('stream', st => putarSuara(c.peer, c, st));
        c.on('close', () => hentiSuara(c.peer, c)); c.on('error', () => hentiSuara(c.peer, c));
      };
      // pemanggil baru bisa tiba sedikit sebelum kabar "masuk"-nya
      if (L.peserta.has(c.peer)) terima(); else setTimeout(terima, 2500);
    });
  }
  function putarSuara(id, c, st) {
    hentiSuara(id);
    const trek = st.getAudioTracks(); if (!trek.length) return;
    const a = document.createElement('audio'); a.autoplay = true; a.setAttribute('playsinline', ''); a.hidden = true;
    a.srcObject = new MediaStream(trek); document.body.appendChild(a);
    L.suara.set(id, { c, a }); tandaiBicara(id, true);
    a.play().catch(() => {
      if (L.tundaSuara) return; L.tundaSuara = true; sistem('Ketuk layar untuk mendengar suara peserta');
      addEventListener('pointerdown', () => { L.tundaSuara = false; for (const x of L.suara.values()) x.a.play().catch(() => { /* coba lagi nanti */ }); }, { once: true, capture: true });
    });
  }
  function hentiSuara(id, c) {
    const x = L.suara.get(id); if (!x || (c && x.c !== c)) return;
    L.suara.delete(id); try { x.c.close(); } catch (e) { /* abaikan */ }
    x.a.srcObject = null; x.a.remove(); tandaiBicara(id, false);
  }
  const hentiSemuaSuara = () => { for (const id of [...L.suara.keys()]) hentiSuara(id); for (const c of L.keluar.values()) { try { c.close(); } catch (e) { /* abaikan */ } } L.keluar.clear(); };
  function panggil(id) {
    if (!L.mic || !L.peer || !L.saya || id === L.saya.id || L.keluar.has(id)) return;
    let c = null; try { c = L.peer.call(id, L.mic); } catch (e) { c = null; } if (!c) return;
    L.keluar.set(id, c);
    const lepas = () => { if (L.keluar.get(id) === c) L.keluar.delete(id); };
    c.on('close', lepas); c.on('error', lepas);
  }
  const panggilSemua = () => { if (L.mic) for (const id of L.peserta.keys()) panggil(id); };
  function tombolMic() {
    const b = document.querySelector('#lobiObrolan .lb-mic'); if (!b) return;
    b.classList.toggle('on', !!L.mic); b.setAttribute('aria-pressed', String(!!L.mic));
    b.title = L.mic ? 'Matikan mikrofon' : 'Nyalakan mikrofon — bicara dengan semua orang di ruang'; b.setAttribute('aria-label', b.title);
    b.querySelector('.lb-mic-t').textContent = L.mic ? 'Mic nyala' : 'Mic';
  }
  async function micNyala(on) {
    if (on && !L.mic) {
      if (!L.aktif) return;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast('Peramban ini tidak mendukung mikrofon'); return; }
      try { L.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false }); }
      catch (e) { toast('Mikrofon tidak diizinkan — izinkan di pengaturan peramban'); return; }
      if (!L.aktif) { for (const t of L.mic.getTracks()) t.stop(); L.mic = null; return; }
      panggilSemua(); sistem('Mikrofon menyala — semua orang di ruang bisa mendengarmu');
    } else if (!on && L.mic) {
      for (const c of L.keluar.values()) { try { c.close(); } catch (e) { /* abaikan */ } }
      L.keluar.clear(); for (const t of L.mic.getTracks()) t.stop(); L.mic = null;
      // penutupan panggilan media tidak selalu sampai ke seberang (PeerJS) — kabari lewat kanal data juga
      if (L.peran === 'pusat') siarkan({ t: 'mic', id: L.saya.id, on: false }); else kirim({ t: 'mic', on: false });
    }
    tombolMic();
  }
  L.mikrofon = micNyala;

  /* ---------- sinkron rumah ---------- */
  // ad: adegan/area yang sedang diubah (JEV-105) — perubahan dari area lain tidak menimpa area yang sedang dibuka
  const subsetProyek = () => ({ levels: PROJECT.levels, site: PROJECT.site, finish: PROJECT.finish, atap: PROJECT.atap, ...(PROJECT.adeganKini ? { ad: PROJECT.adeganKini } : {}) });
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
    try { const j = JSON.parse(s); if ((j.ad || '') !== (PROJECT.adeganKini || '')) return true;
      B = sanitasiProyek({ name: PROJECT.name, levels: j.levels, site: j.site, finish: j.finish, atap: j.atap }); } catch (e) { return false; }
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
    P.on('connection', terimaTamu); pasangPenerimaSuara(P);
    P.on('error', e => { if (e && e.type === 'peer-unavailable') return; console.warn('lobi', e); });
    P.on('disconnected', () => { if (L.peer === P && L.aktif) { try { P.reconnect(); } catch (e) { /* abaikan */ } } });
    hapusSemuaAvatar(); hentiSemuaSuara(); L.kon.clear(); L.peserta.clear();
    L.saya = { id: P.id, nama: L.nama, warna: (L.saya && L.saya.warna) || WARNA[0], pemilik: L.pemilik, pusat: true, urut: 0, foto: L.foto, av: L.av };
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
      const p = { id, nama: teksAman(d.nama, 24) || 'Tamu', warna: WARNA.includes(d.warna) && !pakai.has(d.warna) ? d.warna : warnaBebas(), pemilik, pusat: false, urut: L.urut++, foto: fotoAman(d.foto), av: avAman(d.av) };
      L.peserta.set(id, p);
      k.send({ t: 'selamat', id, peserta: daftar(), s: JSON.stringify(subsetProyek()), a: adeganKini(), k: keadaanAksi() });
      siarkan({ t: 'masuk', p: publik(p) }, id); sistem(p.nama + ' masuk ruang'); renderPeserta(); panggil(id);
      return;
    }
    const p = L.peserta.get(id); if (!p || p.pusat) return;     // belum menyapa
    if (d.t === 'pos') { p.pos = posAman(d); perbaruiPos(id, p.pos); return; }
    if (d.t === 'mic') { if (!kuotaOk(id, 'm', 6)) return; if (!d.on) hentiSuara(id); siarkan({ t: 'mic', id, on: !!d.on }, id); return; }
    if (d.t === 'chat') {
      if (!lajuOk(id)) return; const teks = teksAman(d.teks, 300); if (!teks) return;
      const m = { t: 'chat', id, nama: p.nama, warna: p.warna, teks }; tampilPesan(m); gelembung(id, teks); siarkan(m);
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
    L.peserta.delete(id); hapusAvatar(id); hentiSuara(id); L.keluar.delete(id);
    siarkan({ t: 'keluar', id }); sistem(p.nama + ' keluar dari ruang'); renderPeserta();
  }

  /* ---------- PESERTA BIASA (tersambung ke pusat) ---------- */
  function cobaTamu(P) {
    return new Promise((ok, no) => {
      const k = P.connect(L.ruang, { reliable: true }); let s = false, t = 0;
      const akhir = (f, v) => { if (s) return; s = true; clearTimeout(t); f(v); };
      t = setTimeout(() => { try { k.close(); } catch (e) { /* abaikan */ } akhir(no, new Error('pusat tidak menjawab')); }, 25000);
      P.on('error', e => { if (e && e.type === 'peer-unavailable') akhir(no, new Error('kosong')); });
      k.on('open', async () => { k.send({ t: 'halo', nama: L.nama, warna: L.saya && L.saya.warna, foto: L.foto || undefined, av: L.av || undefined, bukti: await buktiPemilik(P.id) }); });
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
    L.peer = P; L.peran = 'tamu'; L.pusat = k; L.dengar = performance.now(); L.kon.clear(); pasangPenerimaSuara(P);
    P.on('disconnected', () => { if (L.peer === P && L.aktif) { try { P.reconnect(); } catch (e) { /* abaikan */ } } });
    hapusSemuaAvatar(); hentiSemuaSuara(); L.peserta.clear();
    for (const p of (Array.isArray(d.peserta) ? d.peserta : []).slice(0, MAKS)) {
      if (!p || typeof p.id !== 'string') continue;
      L.peserta.set(p.id.slice(0, 64), { id: p.id.slice(0, 64), nama: teksAman(p.nama, 24) || 'Tamu', warna: WARNA.includes(p.warna) ? p.warna : WARNA[9], pemilik: !!p.pemilik, pusat: !!p.pusat, urut: p.urut | 0, foto: fotoAman(p.foto), av: avAman(p.av) });
    }
    L.saya = L.peserta.get(d.id) || { id: String(d.id), nama: L.nama, warna: WARNA[1], urut: 99 };
    L.saya.foto = L.foto; L.saya.av = L.av;
    L.pemilik = !!L.saya.pemilik;                              // diakui pusat setelah tanda tangan diperiksa
    if (typeof d.s === 'string') terapkanProyek(d.s, null);
    // suasana, langit & keadaan interaksi saat ini (lampu, pintu, TV, musik) — masuk ke dunia yang sama
    try { const a = adeganAman(d.a); if (a) pasangAdegan(a); pasangKeadaanAksi(d.k); } catch (e) { console.warn('lobi', e); }
    if (L.mode === 'edit' && LIHAT.on) bukaEdit();
    renderPeserta(); panggilSemua();
  }
  function pesanDariPusat(d) {
    if (!d || typeof d !== 'object' || typeof d.t !== 'string') return;
    if (d.t === 'pos' && Array.isArray(d.d)) { for (const x of d.d.slice(0, MAKS)) if (x && typeof x.id === 'string') perbaruiPos(x.id, posAman(x)); return; }
    if (d.t === 'chat') { const p = L.peserta.get(d.id), teks = teksAman(d.teks, 300); tampilPesan({ nama: p ? p.nama : teksAman(d.nama, 24), warna: p ? p.warna : '#ccc', teks });
      if (p && !(L.saya && p.id === L.saya.id)) gelembung(p.id, teks); return; }
    if (d.t === 'masuk' && d.p && typeof d.p.id === 'string') {
      const p = { id: d.p.id.slice(0, 64), nama: teksAman(d.p.nama, 24) || 'Tamu', warna: WARNA.includes(d.p.warna) ? d.p.warna : WARNA[9], pemilik: !!d.p.pemilik, pusat: false, urut: d.p.urut | 0, foto: fotoAman(d.p.foto), av: avAman(d.p.av) };
      L.peserta.set(p.id, p); sistem(p.nama + ' masuk ruang'); renderPeserta(); panggil(p.id); return;
    }
    if (d.t === 'mic') { if (typeof d.id === 'string' && !d.on) hentiSuara(d.id); return; }
    if (d.t === 'keluar') { const p = L.peserta.get(d.id); if (p) { L.peserta.delete(d.id); hapusAvatar(d.id); hentiSuara(d.id); L.keluar.delete(d.id); sistem(p.nama + ' keluar dari ruang'); renderPeserta(); } return; }
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
    hapusSemuaAvatar(); hentiSemuaSuara(); L.peserta.clear(); if (L.saya) L.peserta.set(L.saya.id, L.saya);
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
      if (P) { if (sesi !== L.sesi) { P.destroy(); return null; } jadiPusat(P); setTimeout(panggilSemua, 1500); return 'pusat'; }
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
    Object.assign(L, { ruang, aturan: a, mode: a.mode, maks: a.maks, nama, undangan, terakhir: '', peran: null, foto: fotoAman(FOTO_LOBI.d), av: avAman(AVATAR_LOBI.d) });
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
      const r = await buatTautanLihat(undefined, { bagikan: o.bagikan });
      // undangan lewat halaman kartu pratinjau …/l/<id>?r=<ruang> bila tautan pendek aktif (JEV-087)
      const url = r.urlBagikan ? r.urlBagikan + '?r=' + ruang : r.url + '&r=' + ruang;
      await masukRuang(ruang, nama, url);
      if (!L.kunci) { L.kunci = k; L.pemilik = true; if (L.saya) L.saya.pemilik = true; renderPeserta(); }
      sistem(`Ruang dibuka (${mode === 'edit' ? 'bangun bareng' : 'lihat saja'}, maks. ${maks} orang). Bagikan undangan.`);
      sistem('Undangan tetap berlaku walau kamu keluar.');
      if (!r.pendek) toast('Undangan memakai tautan panjang — aktifkan Vercel Blob agar lebih pendek');
      return r;
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
    // foto profil (opsional) — sama dengan pengatur di panel Main bareng
    const foto = el('div', 'row lobi-foto'), fl = el('img', 'lobi-foto-lihat'); fl.alt = ''; fl.hidden = true;
    foto.appendChild(fl); foto.appendChild(el('button', 'btn sm ghost lobi-foto-pilih', 'Foto profil (opsional)')); foto.appendChild(el('button', 'btn sm ghost lobi-foto-hapus', 'Hapus'));
    pasangPilihFoto(foto);
    const av3 = el('div', 'row lobi-av3d');
    av3.appendChild(el('span', 'lobi-av3d-nama')); av3.appendChild(el('button', 'btn sm ghost lobi-av3d-pilih', 'Avatar 3D (.glb / .vrm)')); av3.appendChild(el('button', 'btn sm ghost lobi-av3d-hapus', 'Hapus'));
    pasangPilihAvatar3D(av3);
    const info = el('p', 'hint'); const row = el('div', 'row');
    const masuk = el('button', 'btn', 'Masuk'), nanti = el('button', 'btn ghost', 'Lihat sendiri saja');
    row.appendChild(masuk); row.appendChild(nanti);
    k.appendChild(inp); k.appendChild(foto); k.appendChild(av3); k.appendChild(row); k.appendChild(info);
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
    const lari = t => { if (!detak) return; stepAvatar(Math.min(0.1, (t - (tLalu || t)) / 1000)); letakAvatar(); tLalu = t; requestAnimationFrame(lari); };
    requestAnimationFrame(lari);
  }
  // keluar: ruang tetap hidup untuk peserta lain (pusat pamit dulu agar penerus langsung mengambil alih)
  function tutup() {
    if (L.peran === 'pusat') siarkan({ t: 'pergi' });
    L.sesi++; L.aktif = false; L.pindah = false; clearInterval(detak); detak = null;
    hapusSemuaAvatar(); hentiSemuaSuara(); if (L.mic) { for (const t of L.mic.getTracks()) t.stop(); L.mic = null; }
    const k = L.peer; L.peer = null; L.kon.clear(); L.peserta.clear(); L.pusat = null; L.peran = null;
    setTimeout(() => { try { if (k) k.destroy(); } catch (e) { /* abaikan */ } }, 300);
    const o = document.getElementById('lobiObrolan'); if (o) o.remove();
    const la = document.getElementById('lobiAvatar'); if (la) la.remove();
    tampilAktif(false);
  }
  L.tutup = tutup;
  addEventListener('pagehide', () => { if (L.aktif) tutup(); });
})();
