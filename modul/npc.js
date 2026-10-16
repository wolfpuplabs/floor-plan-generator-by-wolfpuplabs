/* Plan23D — NPC (JEV-106)
   Karakter bawaan F / M (avatar/*.vrm, berkasnya tidak diubah) sebagai penghuni proyek. Penampilan dibangkitkan
   dari benih (params.benih): warna kulit, rambut, atasan, bawahan & sepatu. Atlas tekstur karakter dipetakan sekali:
   tiap segitiga dikelompokkan menurut tulang yang menggerakkannya (rambut, kepala, tangan, kaki, tungkai, badan) dan
   warna tengahnya (kulit atau bukan); lalu tiap benih mewarnai ulang salinan 512 px di kanvas — bayangan, lipatan &
   motif kain tetap, aksen terang (lis, garis) dibiarkan. Hanya salinan di memori yang diwarnai.
   Di mode jalan / tautan lihat NPC hidup sendiri: diam → jalan-jalan dalam radius jelajah atau beraktivitas
   (duduk di kursi / sofa, duduk di lantai, joget kecil, mengantuk, meregang, melihat jam, melambai ke pengunjung)
   → diam lagi. NPC tidak menembus dinding & perabot, menunggu bila pengunjung menghalangi, dan bisa disapa.
   Di editor NPC berdiri di tempatnya (bernapas & berkedip) agar mudah ditata. */
/* global FPS, LIHAT, camera, levelGroups, PROJECT, klonModel, muatModul, fpsResolveWalls, fpsGround, levelElevation,
   adaTanahSitus, tinggiTanah, FURN, titikDuduk, MEDIA_OBJ, BAYANG_KOTOR:writable, el, fRow, selInput, numInput, HIST, rebuildScene,
   renderInspector, addTransformFields */
(function () {
  'use strict';
  const UK = 512, SIMPAN_MAKS = 24, MAKS = 12;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sudut = a => Math.atan2(Math.sin(a), Math.cos(a));
  const rng = s => () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pilih = (r, a) => a[Math.floor(r() * a.length) % a.length];
  const jenisAman = t => (t === 'M' ? 'M' : 'F');
  const benihAman = o => { const b = o && o.params ? +o.params.benih : 0; return Number.isFinite(b) ? (b >>> 0) : 0; };
  const jelajahAman = o => { const j = o && o.params ? o.params.jelajah : undefined; return j == null || !Number.isFinite(+j) ? 4 : clamp(+j, 0, 15); };

  /* ---------- PENAMPILAN ---------- */
  const KULIT = [[255, 228, 212], [247, 212, 186], [236, 192, 160], [219, 168, 128], [192, 136, 98], [158, 104, 72], [118, 76, 52], [86, 56, 40]];
  const RAMBUT = [[22, 18, 18], [40, 28, 22], [64, 42, 30], [96, 62, 38], [128, 86, 52], [172, 124, 72], [212, 172, 110], [232, 210, 160], [150, 64, 36], [170, 170, 176]];
  const RAMBUT_WARNA = [[232, 132, 172], [112, 150, 232], [150, 112, 212], [90, 190, 172], [236, 236, 240]];
  const BAJU = [[34, 44, 78], [26, 26, 30], [236, 236, 232], [128, 132, 140], [178, 42, 48], [110, 32, 44], [96, 108, 58], [214, 164, 52], [32, 120, 128], [120, 176, 222],
    [232, 150, 170], [170, 150, 212], [210, 190, 156], [116, 78, 52], [40, 92, 60], [232, 120, 52], [70, 96, 140], [244, 232, 206], [60, 62, 68], [238, 120, 108]];
  const BAWAH = [[62, 84, 120], [40, 52, 82], [30, 30, 34], [120, 124, 130], [196, 176, 140], [92, 72, 52], [72, 86, 58], [236, 234, 228], [140, 40, 46]];
  const SEPATU = [null, null, [28, 28, 30], [92, 62, 42], [150, 150, 156], [178, 42, 48], [44, 64, 120]];
  function penampilan(o) {
    const r = rng(benihAman(o) ^ (jenisAman(o.type) === 'M' ? 0x5bd1e995 : 0x27d4eb2f));
    for (let i = 0; i < 3; i++) r();
    const kulit = pilih(r, KULIT), rambut = r() < 0.14 ? pilih(r, RAMBUT_WARNA) : pilih(r, RAMBUT), atas = pilih(r, BAJU);
    let bawah = r() < 0.35 ? BAWAH[0] : pilih(r, r() < 0.5 ? BAWAH : BAJU);
    for (let i = 0; i < 4 && Math.abs(bawah[0] - atas[0]) + Math.abs(bawah[1] - atas[1]) + Math.abs(bawah[2] - atas[2]) < 60; i++) bawah = pilih(r, BAWAH);
    return { kulit, rambut, atas, bawah, sepatu: pilih(r, SEPATU) };
  }

  /* ---------- PETA ATLAS (sekali per karakter) ---------- */
  const KELAS = { kulit: 1, rambut: 2, atas: 3, bawah: 4, sepatu: 5 };
  const katTulang = n => /hair/i.test(n) ? 'r' : /head|face|eye/i.test(n) ? 'k' : /foot|toe/i.test(n) ? 's'
    : /upperleg|lowerleg|hips|skirt|leg/i.test(n) ? 'b' : /hand|thumb|index|middle|ring|little/i.test(n) ? 't' : 'a';
  const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
  function bacaPiksel(tex) {
    const c = document.createElement('canvas'); c.width = c.height = UK;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(tex.image, 0, 0, UK, UK);
    return x.getImageData(0, 0, UK, UK).data;
  }
  const miripKulit = (r, g, b, ref) => { const rb = ref[0] - ref[2];
    return r >= g && g >= b - 4 && r - b > Math.max(8, rb * 0.45) && r - b < rb * 2.2 + 24 && lum(r, g, b) > lum(...ref) * 0.42; };
  const KOMP = ['getX', 'getY', 'getZ', 'getW'], komp = (a, q, j) => a[KOMP[j]](q);
  function segitiga(m) {
    const gm = m.geometry, uv = gm.attributes.uv, si = gm.attributes.skinIndex, sw = gm.attributes.skinWeight;
    if (!uv) return [];
    const idx = gm.index ? gm.index.array : null, n = idx ? idx.length : uv.count, kat = m.skeleton ? m.skeleton.bones.map(b => katTulang(b.name || '')) : null;
    const hasil = [];
    for (let i = 0; i + 2 < n; i += 3) {
      const v = [0, 1, 2].map(k => (idx ? idx[i + k] : i + k)), b = { r: 0, k: 0, s: 0, b: 0, t: 0, a: 0 };
      if (kat && si && sw) for (const q of v) for (let j = 0; j < 4; j++) { const w = komp(sw, q, j); if (w > 0) b[kat[komp(si, q, j)] || 'a'] += w; }
      let km = 'a', bm = -1; for (const k in b) if (b[k] > bm) { bm = b[k]; km = k; }
      hasil.push({ uv: v.map(q => [uv.getX(q), uv.getY(q)]), kat: km, v0: v[0], v });
    }
    // pulau: segitiga yang bersambung (satu potong kain / sepatu / rambut) — ujung kaus yang digerakkan pinggul tetap atasan
    const ind = new Int32Array(uv.count).map((_, i) => i), akar = i => { while (ind[i] !== i) { ind[i] = ind[ind[i]]; i = ind[i]; } return i; };
    for (const t of hasil) { const r0 = akar(t.v[0]); for (const q of [t.v[1], t.v[2]]) { const r = akar(q); if (r !== r0) ind[r] = r0; } }
    for (const t of hasil) { t.pulau = m.id + ':' + akar(t.v0); delete t.v; delete t.v0; }
    return hasil;
  }
  function petakan(tpl) {
    if (tpl.userData.npcPeta) return tpl.userData.npcPeta;
    const meshes = []; tpl.traverse(m => { if (m.isMesh && m.material && !Array.isArray(m.material) && m.material.map && m.material.map.image) meshes.push(m); });
    const perPeta = new Map();
    for (const m of meshes) { const t = m.material.map; if (!perPeta.has(t)) perPeta.set(t, { tex: t, wajah: /face/i.test(m.name) || /face/i.test(m.material.name || ''), tri: [] }); perPeta.get(t).tri.push(...segitiga(m)); }
    const daftar = [...perPeta.values()];
    for (const p of daftar) p.src = bacaPiksel(p.tex);
    const ambil = (p, u, v, balik) => { const x = clamp(Math.floor(u * UK), 0, UK - 1), y = clamp(Math.floor((balik ? 1 - v : v) * UK), 0, UK - 1), i = (y * UK + x) * 4; return [p.src[i], p.src[i + 1], p.src[i + 2], p.src[i + 3]]; };
    const tengah = s => [(s.uv[0][0] + s.uv[1][0] + s.uv[2][0]) / 3, (s.uv[0][1] + s.uv[1][1] + s.uv[2][1]) / 3];
    // orientasi gambar (ImageBitmap Chrome vs <img> Safari bisa berbeda): pilih yang membuat segitiga tangan berwarna kulit
    const badan = daftar.find(p => !p.wajah) || daftar[0];
    if (!badan) return (tpl.userData.npcPeta = { daftar: [] });
    const tangan = badan.tri.filter(s => s.kat === 't');
    const skor = balik => tangan.reduce((n, s) => { const [r, g, b] = ambil(badan, ...tengah(s), balik); return n + (r > g && g > b && r - b > 12 && lum(r, g, b) > 80 ? 1 : 0); }, 0);
    const balik = tangan.length ? skor(true) > skor(false) : false;
    let ref = [0, 0, 0], nr = 0;
    for (const s of tangan) { const c = ambil(badan, ...tengah(s), balik); if (c[0] > c[2] && lum(...c) > 80) { ref[0] += c[0]; ref[1] += c[1]; ref[2] += c[2]; nr++; } }
    ref = nr ? ref.map(v => v / nr) : [250, 230, 220];
    // kelas per piksel: segitiga digambar ke kanvas topeng (sedikit dilebarkan agar tepi tidak bocor)
    for (const p of daftar) {
      p.kelas = new Uint8Array(UK * UK);
      if (p.wajah) continue;
      const kel = { 1: [], 2: [], 3: [], 4: [], 5: [] }, suara = new Map(), sisa = [];
      for (const s of p.tri) {
        const c = ambil(p, ...tengah(s), balik);
        if (s.kat === 'r' || s.kat === 'k') kel[KELAS.rambut].push(s);
        else if (s.kat === 't' || miripKulit(c[0], c[1], c[2], ref)) kel[KELAS.kulit].push(s);
        else { sisa.push(s); const u = suara.get(s.pulau) || { a: 0, b: 0, s: 0 }; u[s.kat === 's' ? 's' : s.kat === 'b' ? 'b' : 'a']++; suara.set(s.pulau, u); }
      }
      for (const s of sisa) { const u = suara.get(s.pulau), k = u.s >= u.a && u.s >= u.b ? KELAS.sepatu : u.b > u.a ? KELAS.bawah : KELAS.atas; kel[k].push(s); }
      const c = document.createElement('canvas'); c.width = c.height = UK; const x = c.getContext('2d', { willReadFrequently: true });
      for (const k of [1, 3, 4, 5, 2]) {
        x.clearRect(0, 0, UK, UK); x.fillStyle = x.strokeStyle = '#fff'; x.lineWidth = 2; x.lineJoin = 'round';
        x.beginPath();
        for (const s of kel[k]) { const q = s.uv.map(([u, v]) => [u * UK, (balik ? 1 - v : v) * UK]); x.moveTo(q[0][0], q[0][1]); x.lineTo(q[1][0], q[1][1]); x.lineTo(q[2][0], q[2][1]); x.closePath(); }
        x.fill(); x.stroke();
        const d = x.getImageData(0, 0, UK, UK).data;
        for (let i = 0; i < UK * UK; i++) if (d[i * 4 + 3] > 40) p.kelas[i] = k;
      }
      // kecerahan rata-rata tiap kelas: acuan pewarnaan yang mempertahankan bayangan & motif
      const jum = new Float64Array(6), n = new Float64Array(6);
      for (let i = 0; i < UK * UK; i++) { const k = p.kelas[i]; if (k < 2 || p.src[i * 4 + 3] < 128) continue; jum[k] += lum(p.src[i * 4], p.src[i * 4 + 1], p.src[i * 4 + 2]); n[k]++; }
      p.rata = [...jum].map((v, k) => (n[k] ? v / n[k] : 128));
      delete p.tri;
    }
    for (const p of daftar) delete p.tri;
    return (tpl.userData.npcPeta = { daftar, ref });
  }

  /* ---------- PEWARNAAN per benih (tembolok LRU) ---------- */
  const SIMPAN = new Map();
  function warnai(p, ref, look) {
    const out = new Uint8ClampedArray(p.src), rasio = look.kulit.map((v, i) => v / Math.max(1, ref[i]));
    const tujuan = [null, null, look.rambut, look.atas, look.bawah, look.sepatu];
    for (let i = 0; i < UK * UK; i++) {
      const j = i * 4, r = p.src[j], g = p.src[j + 1], b = p.src[j + 2], k = p.kelas[i];
      if (k === 0 || k === 1) { if ((p.wajah || k === 1) && miripKulit(r, g, b, ref)) { out[j] = r * rasio[0]; out[j + 1] = g * rasio[1]; out[j + 2] = b * rasio[2]; } continue; }
      const t = tujuan[k]; if (!t) continue;
      const l = lum(r, g, b), m = p.rata[k];
      if (k !== 2 && l > m * 1.7 && l > 150) continue;                    // lis / garis terang: tetap
      const f = clamp(l / Math.max(8, m), 0, 2.2);
      out[j] = t[0] * f; out[j + 1] = t[1] * f; out[j + 2] = t[2] * f;
    }
    const c = document.createElement('canvas'); c.width = c.height = UK;
    c.getContext('2d').putImageData(new ImageData(out, UK, UK), 0, 0);
    const tex = new THREE.CanvasTexture(c), asal = p.tex;
    tex.flipY = asal.flipY; tex.encoding = asal.encoding; tex.wrapS = asal.wrapS; tex.wrapT = asal.wrapT; tex.anisotropy = asal.anisotropy || 1;
    return tex;
  }
  function materiUntuk(tpl, kunci, look) {
    if (SIMPAN.has(kunci)) { const s = SIMPAN.get(kunci); SIMPAN.delete(kunci); SIMPAN.set(kunci, s); return s.peta; }
    const P = petakan(tpl), texs = new Map(), peta = new Map();
    for (const p of P.daftar) texs.set(p.tex, warnai(p, P.ref, look));
    tpl.traverse(m => { if (!m.isMesh || !m.material || Array.isArray(m.material) || !texs.has(m.material.map) || peta.has(m.material)) return;
      const b = m.material.clone(); b.map = texs.get(m.material.map); peta.set(m.material, b); });
    SIMPAN.set(kunci, { peta, texs });
    while (SIMPAN.size > SIMPAN_MAKS) { const [k, s] = SIMPAN.entries().next().value; SIMPAN.delete(k); for (const t of s.texs.values()) t.dispose(); for (const b of s.peta.values()) b.dispose(); }
    return peta;
  }

  /* ---------- PASANG ke grup objek ---------- */
  const NPC = new Map();
  const kotor = () => { BAYANG_KOTOR = Math.max(BAYANG_KOTOR, 1); };
  // bangun ulang adegan (edit, masuk mode jalan, pintu…) membuat grup baru: NPC dipasang seketika bila karakternya
  // sudah dimuat, dan keadaannya (posisi, kegiatan, kursi, bobot pose) dibawa ke grup baru selama tempat asalnya sama
  const TPL = {};
  const BAWA = ['mode', 't', 'p', 'yaw', 'yawTuju', 'rumah', 'tuju', 'lanjut', 'kursi', 'po', 'laju', 'jelajah', 'dari', 'ke', 'tunggu', 'macet', 'menoleh', 'disapa', 'tg'];
  const diDunia = g => { for (let x = g; x; x = x.parent) if (x.isScene) return true; return false; };
  function rakit(n, tpl, lama) {
    const o = n.o, peta = materiUntuk(tpl, jenisAman(o.type) + ':' + benihAman(o), penampilan(o));
    const m = klonModel(tpl); m.userData.rigIdx = tpl.userData.rigIdx; m.userData.kedipIdx = tpl.userData.kedipIdx; m.userData.klip = [];
    m.traverse(x => { if (x.isMesh) { if (peta.has(x.material)) x.material = peta.get(x.material); x.raycast = () => {}; x.userData.bersama = true; } });
    n.badan.add(m);
    const a = { g: n.badan, tuju: { po: 0 } }; window.LOBI.gerak.siapkanGerak(a, m); n.a = a;
    if (lama && lama.a) { for (const k of ['pw', 'w', 'v', 'mikro', 'lambai', 'diam']) if (lama.a[k] != null) a[k] = Array.isArray(lama.a[k]) ? lama.a[k].slice() : lama.a[k]; }
    if (n.mode && n.p) pasangBadan(n);
    kotor();
  }
  function pasang(g, o, lv) {
    const lama = NPC.get(o.id), n = { id: o.id, o, g, badan: g.userData.badan, li: Math.max(0, PROJECT.levels.indexOf(lv)), mode: null, po: 0 };
    if (lama && lama.mode && lama.o.x === o.x && lama.o.z === o.z && (lama.o.y || 0) === (o.y || 0) && lama.o.type === o.type && lama.li === n.li) for (const k of BAWA) n[k] = lama[k];
    NPC.set(o.id, n);
    const k = jenisAman(o.type);
    if (TPL[k] && window.LOBI) { rakit(n, TPL[k], lama); return Promise.resolve(); }
    return muatModul('lobi').then(() => window.LOBI.muatAvatar3D({ bawaan: k })).then(tpl => {
      TPL[k] = tpl;
      if (NPC.get(o.id) !== n || !diDunia(g)) return;
      rakit(n, tpl, lama);
    }).catch(e => console.warn('NPC', e.message));
  }

  /* ---------- PERILAKU ---------- */
  const hidup = () => FPS.on || !!(typeof LIHAT !== 'undefined' && LIHAT.on);
  const tampak = n => { for (let x = n.g; x; x = x.parent) if (!x.visible) return false; return true; };
  const adaMusik = () => { try { return (typeof window.bgmMain === 'function' && window.bgmMain()) || (typeof MEDIA_OBJ !== 'undefined' && MEDIA_OBJ.size > 0); } catch (e) { return false; } };
  const jarakPengunjung = n => FPS.on ? Math.hypot(camera.position.x - n.p.x, camera.position.z - n.p.z) : Infinity;
  function tanahDi(n, x, z) {
    const g = fpsGround(x, z, n.p.y), t0 = n.li === 0 ? levelElevation(0) + (adaTanahSitus() ? tinggiTanah(x, z) : 0) : -Infinity;
    const h = Math.max(g == null ? -Infinity : g, t0); return Number.isFinite(h) ? h : null;
  }
  // tapak perabot (bukan karpet / hiasan dinding / lampu gantung) — NPC berjalan mengitarinya
  function diPerabot(n, x, z, kecuali) {
    const lv = PROJECT.levels[n.li]; if (!lv) return false;
    for (const o of lv.objects) {
      if (o.kind !== 'furn' || o.id === kecuali) continue; const d = FURN[o.type];
      if (!d || !d.f || d.c === 'karpet' || d.c === 'dekor' || d.c === 'bentuk' || d.wall || (o.y || 0) > 1.2) continue;
      const a = o.rotY || 0, c = Math.cos(a), s = Math.sin(a), dx = x - o.x, dz = z - o.z;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.abs(lx) < d.f[0] * (o.sx || 1) / 2 + 0.22 && Math.abs(lz) < d.f[1] * (o.sz || 1) / 2 + 0.22) return true;
    }
    return false;
  }
  function jalurBebas(n, x, z, kecuali) {
    const d = Math.hypot(x - n.p.x, z - n.p.z), k = Math.max(1, Math.ceil(d / 0.3));
    for (let i = 1; i <= k; i++) {
      const px = n.p.x + (x - n.p.x) * i / k, pz = n.p.z + (z - n.p.z) * i / k;
      const [rx, rz] = fpsResolveWalls(px, pz, n.p.y); if (Math.hypot(rx - px, rz - pz) > 0.03) return false;
      if (diPerabot(n, px, pz, i === k ? kecuali : null)) return false;
      if (i % 2 === 0 || i === k) { const t = tanahDi(n, px, pz); if (t == null || Math.abs(t - n.p.y) > 0.3) return false; }
    }
    return true;
  }
  function cobaJalan(n) {
    const R = n.jelajah; if (R < 0.3) return false;
    for (let i = 0; i < 10; i++) {
      const pusatX = Math.hypot(n.p.x - n.rumah.x, n.p.z - n.rumah.z) > R * 0.7 ? n.rumah.x : n.p.x, pusatZ = pusatX === n.rumah.x ? n.rumah.z : n.p.z;
      const a = Math.random() * Math.PI * 2, r = 0.8 + Math.random() * Math.min(R, 4);
      const x = pusatX + Math.sin(a) * r, z = pusatZ + Math.cos(a) * r;
      if (Math.hypot(x - n.rumah.x, z - n.rumah.z) > R || Math.hypot(x - n.p.x, z - n.p.z) < 0.6) continue;
      if (jalurBebas(n, x, z)) { mulaiJalan(n, x, z); return true; }
    }
    return false;
  }
  function mulaiJalan(n, x, z, lanjut) { n.mode = 'jalan'; n.tuju = { x, z }; n.lanjut = lanjut || null; n.tunggu = n.macet = 0; n.po = 0; n.a.mikro = null; }
  const KURSI_DIPAKAI = new Set();
  function cariKursi(n) {
    const lg = levelGroups[n.li]; if (!lg) return null;
    const calon = [];
    for (const c of lg.children) {
      if (!c.userData.duduk || c.userData.kind !== 'obj' || !c.visible) continue;
      if (FPS.duduk && FPS.duduk.id === c.userData.id) continue;
      const s = titikDuduk({ grp: c, titik: n.p }); if (!s) continue;
      const kunci = c.userData.id + ':' + s.pos.x.toFixed(1) + ':' + s.pos.z.toFixed(1); if (KURSI_DIPAKAI.has(kunci)) continue;
      if (Math.hypot(s.pos.x - n.rumah.x, s.pos.z - n.rumah.z) > n.jelajah + 1.5) continue;
      const q = { x: s.pos.x + s.arah.x * 0.62, z: s.pos.z + s.arah.z * 0.62 };
      calon.push({ s, q, kunci, id: c.userData.id, d: Math.hypot(q.x - n.p.x, q.z - n.p.z) });
    }
    calon.sort((a, b) => a.d - b.d);
    for (const k of calon.slice(0, 3)) if (k.d < 0.3 || jalurBebas(n, k.q.x, k.q.z, k.id)) return k;
    return null;
  }
  function diam(n, t) { n.mode = 'diam'; n.t = t != null ? t : 2.5 + Math.random() * 5; n.po = 0; n.menoleh = Math.random() < 0.6; }
  function aktivitas(n, po, t, mikro) { n.mode = 'aktivitas'; n.po = po; n.t = t; if (mikro) n.a.mikro = { k: mikro, t: 0, d: mikro === 'regang' ? 2.6 : mikro === 'jam' ? 2.2 : 1.2 }; }
  function berikutnya(n) {
    const r = Math.random(), dekat = jarakPengunjung(n) < 6;
    if (dekat && !n.disapa && Math.random() < 0.25) { n.disapa = true; return sapaAuto(n); }
    if (r < 0.48 && cobaJalan(n)) return;
    const pilihan = [['kursi', 0.24], ['lantai', 0.12], ['joget', adaMusik() ? 0.4 : 0.12], ['ngantuk', 0.1], ['mikro', 0.3]];
    let x = Math.random() * pilihan.reduce((s, p) => s + p[1], 0), k = 'mikro';
    for (const [nm, w] of pilihan) { x -= w; if (x <= 0) { k = nm; break; } }
    if (k === 'kursi') { const ks = cariKursi(n); if (ks) { KURSI_DIPAKAI.add(ks.kunci); n.kursi = ks; return ks.d < 0.3 ? masukKursi(n) : mulaiJalan(n, ks.q.x, ks.q.z, 'kursi'); } k = 'lantai'; }
    if (k === 'lantai') return aktivitas(n, 2, 8 + Math.random() * 10);
    if (k === 'joget') return aktivitas(n, 3, 5 + Math.random() * 6);
    if (k === 'ngantuk') return aktivitas(n, 4, 7 + Math.random() * 7);
    return aktivitas(n, 0, 2.8, pilih(Math.random, ['regang', 'jam', 'bahu']));
  }
  function masukKursi(n) { const k = n.kursi; n.mode = 'masuk'; n.t = 0; n.dari = { x: n.p.x, z: n.p.z, y: n.p.y }; n.po = 1; n.yawTuju = Math.atan2(k.s.arah.x, k.s.arah.z); }
  function lepasKursi(n) { if (n.kursi) KURSI_DIPAKAI.delete(n.kursi.kunci); }
  function hadapPengunjung(n) { n.yawTuju = Math.atan2(camera.position.x - n.p.x, camera.position.z - n.p.z); }
  function sapaAuto(n) { hadapPengunjung(n); aktivitas(n, 5, 2.8); }
  function sapa(id) {
    const n = NPC.get(id); if (!n || !n.a) return false;
    if (!hidup() || !n.mode) { window.LOBI.gerak.mulaiLambai(n.a); return true; }
    if (n.mode === 'duduk' || n.mode === 'masuk') { window.LOBI.gerak.mulaiLambai(n.a); return true; }
    if (n.mode === 'jalan') { n.lanjut = null; lepasKursi(n); n.kursi = null; }
    sapaAuto(n); n.a.lambai = null; return true;
  }
  function putarKe(n, yaw, dt, laju = 3) { const d = sudut(yaw - n.yaw); n.yaw += clamp(d, -laju * dt, laju * dt); return Math.abs(d); }
  function jalan(n, dt) {
    const dx = n.tuju.x - n.p.x, dz = n.tuju.z - n.p.z, d = Math.hypot(dx, dz);
    if (d < 0.18) { if (n.lanjut === 'kursi') masukKursi(n); else diam(n); return 0; }
    const beda = putarKe(n, Math.atan2(dx, dz), dt);
    let v = beda > 1 ? 0 : n.laju * (d < 0.6 ? Math.max(0.35, d / 0.6) : 1) * (1 - beda * 0.5);
    // pengunjung / NPC lain di depan: tunggu sebentar, lalu cari tujuan lain
    const fx = Math.sin(n.yaw), fz = Math.cos(n.yaw), halang = (x, z, r) => { const ax = x - n.p.x, az = z - n.p.z, j = Math.hypot(ax, az); return j < r && (ax * fx + az * fz) / Math.max(j, 1e-6) > 0.4; };
    let tutup = FPS.on && halang(camera.position.x, camera.position.z, 0.95);
    for (const m of NPC.values()) if (m !== n && m.p && m.li === n.li && halang(m.p.x, m.p.z, 0.7)) { tutup = true; break; }
    if (tutup) { v = 0; n.tunggu += dt; if (n.tunggu > 2.5) { lepasKursi(n); n.kursi = null; diam(n, 1); return 0; } } else n.tunggu = 0;
    if (v <= 0) return 0;
    let px = n.p.x + fx * v * dt, pz = n.p.z + fz * v * dt;
    [px, pz] = fpsResolveWalls(px, pz, n.p.y);
    const masuk = n.lanjut === 'kursi' && n.kursi ? n.kursi.id : null;
    n.tg = (n.tg || 0) - dt;
    let y = n.p.y;
    if (n.tg <= 0) { n.tg = 0.12; const t = tanahDi(n, px, pz); if (t == null || Math.abs(t - n.p.y) > 0.3) px = NaN; else y = t; }
    if (Number.isNaN(px) || diPerabot(n, px, pz, masuk)) { n.macet += dt; if (n.macet > 0.6) { lepasKursi(n); n.kursi = null; diam(n, 1); } return 0; }
    const maju = Math.hypot(px - n.p.x, pz - n.p.z);
    if (maju < v * dt * 0.3) { n.macet += dt; if (n.macet > 0.8) { lepasKursi(n); n.kursi = null; diam(n, 1); return 0; } } else n.macet = 0;
    n.p.set(px, y, pz);
    return maju / Math.max(dt, 1e-4);
  }
  function mulai(n) {
    n.g.updateMatrixWorld(true);
    n.rumah = n.g.getWorldPosition(new THREE.Vector3()); n.p = n.rumah.clone(); n.yaw = n.o.rotY || 0; n.yawTuju = null;
    n.laju = 0.85 + Math.random() * 0.35; n.jelajah = jelajahAman(n.o); n.disapa = false;
    diam(n, 1 + Math.random() * 4);
  }
  function kembali(n) {
    lepasKursi(n); n.kursi = null; n.mode = null; n.po = 0; n.p = null;
    n.badan.position.set(0, 0, 0); n.badan.rotation.set(0, 0, 0); if (n.a) { n.a.mikro = null; n.a.lambai = null; }
  }
  const _v = new THREE.Vector3();
  function pasangBadan(n) {
    n.g.updateMatrixWorld(true);
    n.badan.position.copy(n.g.worldToLocal(_v.copy(n.p)));
    n.badan.rotation.y = n.yaw - (n.o.rotY || 0);
  }
  let tBayang = 0;
  function langkah(dt) {
    if (!NPC.size) return;
    dt = Math.min(dt, 0.1);
    const aktif = hidup(); let gerak = false;
    for (const [id, n] of NPC) {
      if (!diDunia(n.g)) { if (NPC.get(id) === n) { lepasKursi(n); NPC.delete(id); } continue; }
      if (!n.a || !tampak(n)) continue;
      if (!aktif) { if (n.mode) kembali(n); n.a.tuju.po = 0; window.LOBI.gerak.gerakAvatar(n.a, dt, 0); continue; }
      if (!n.mode) mulai(n);
      let laju = 0;
      if (n.mode === 'diam') {
        n.t -= dt;
        if (n.menoleh && jarakPengunjung(n) < 3.2) { hadapPengunjung(n); putarKe(n, n.yawTuju, dt, 1.6); }
        if (n.t <= 0) berikutnya(n);
      } else if (n.mode === 'jalan') laju = jalan(n, dt);
      else if (n.mode === 'aktivitas') {
        n.t -= dt; if (n.yawTuju != null && n.po === 5) putarKe(n, n.yawTuju, dt, 2.5);
        if (n.t <= 0) { n.a.mikro = null; diam(n); }
      } else if (n.mode === 'masuk') {
        const k = n.kursi; n.t = Math.min(1, n.t + dt / 0.7); const e = n.t * n.t * (3 - 2 * n.t);
        n.p.set(n.dari.x + (k.s.pos.x - n.dari.x) * e, n.dari.y + (k.s.pos.y - 0.45 - n.dari.y) * e, n.dari.z + (k.s.pos.z - n.dari.z) * e);
        putarKe(n, n.yawTuju, dt, 5);
        if (n.t >= 1) { n.mode = 'duduk'; n.t = 10 + Math.random() * 14; }
      } else if (n.mode === 'duduk') {
        n.t -= dt; if (n.t <= 0) { const k = n.kursi; n.mode = 'keluar'; n.t = 0; n.dari = { x: n.p.x, y: n.p.y, z: n.p.z }; n.po = 0; n.ke = { x: k.q.x, z: k.q.z, y: n.rumah.y }; }
      } else if (n.mode === 'keluar') {
        n.t = Math.min(1, n.t + dt / 0.8); const e = n.t * n.t * (3 - 2 * n.t);
        n.p.set(n.dari.x + (n.ke.x - n.dari.x) * e, n.dari.y + (n.ke.y - n.dari.y) * e, n.dari.z + (n.ke.z - n.dari.z) * e);
        if (n.t >= 1) { const t = tanahDi(n, n.p.x, n.p.z); if (t != null && Math.abs(t - n.p.y) < 0.6) n.p.y = t; lepasKursi(n); n.kursi = null; diam(n); }
      }
      n.a.tuju.po = n.po;
      pasangBadan(n);
      if (Math.hypot(camera.position.x - n.p.x, camera.position.z - n.p.z) < 40) window.LOBI.gerak.gerakAvatar(n.a, dt, laju);
      if (laju > 0.02 || n.a.w > 0.02 || n.po || n.mode === 'masuk' || n.mode === 'keluar') gerak = true;
    }
    tBayang -= dt;
    if (gerak && tBayang <= 0) { kotor(); tBayang = 0.1; }
  }
  /* ---------- INSPECTOR ---------- */
  function inspektor(ins, d) {
    d.params = d.params || {};
    const h = el('h3', null, 'NPC'); h.appendChild(el('span', 'tag', d.type === 'M' ? 'Karakter M' : 'Karakter F')); ins.appendChild(h);
    fRow(ins, 'Karakter', selInput([['F', 'Karakter F'], ['M', 'Karakter M']], jenisAman(d.type), v => { d.type = v; HIST.label = 'Karakter NPC'; rebuildScene(); renderInspector(); }));
    const ba = el('button', 'btn sm', '🎲 Acak penampilan'); ba.onclick = () => { d.params.benih = Math.floor(Math.random() * 4294967296); HIST.label = 'Acak penampilan NPC'; rebuildScene(); renderInspector(); };
    ins.appendChild(ba);
    const p = penampilan(d), w = el('div', 'npc-warna');
    for (const [k, l] of [['kulit', 'Kulit'], ['rambut', 'Rambut'], ['atas', 'Atasan'], ['bawah', 'Bawahan'], ['sepatu', 'Sepatu']]) {
      const s = el('span'); s.title = l; s.setAttribute('aria-label', l); s.style.background = p[k] ? 'rgb(' + p[k].join(',') + ')' : '#f4f4f4'; w.appendChild(s); }
    ins.appendChild(w);
    fRow(ins, 'Jelajah (m)', numInput(jelajahAman(d), 0.5, v => { d.params.jelajah = clamp(v, 0, 15); rebuildScene(); }, 0, 15));
    ins.appendChild(el('p', 'hint', 'Di mode jalan NPC berjalan-jalan dalam radius ini dari tempatnya, duduk di kursi / sofa terdekat, duduk di lantai, joget, mengantuk & melambai. 0 = tetap di tempat. Bidik lalu Sapa untuk menyapanya.'));
    ins.appendChild(el('div', 'section-title', 'Penempatan'));
    addTransformFields(ins, d, false);
  }
  const jumlah = () => PROJECT.levels.reduce((s, l) => s + l.objects.filter(o => o.kind === 'npc').length, 0);
  window.NPC = { pasang, langkah, sapa, penampilan, jumlah, inspektor, MAKS, keadaan: id => { const n = NPC.get(id); return n && { mode: n.mode, po: n.po, p: n.p && n.p.clone(), siap: !!n.a, kursi: n.kursi && n.kursi.id }; },
    _uji: { NPC, mulaiJalan, aktivitas, berikutnya, cariKursi, diPerabot: (id, x, z) => diPerabot(NPC.get(id), x, z) } };
})();
