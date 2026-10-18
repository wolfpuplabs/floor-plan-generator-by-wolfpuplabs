/* Plan23D — NPC (JEV-106)
   Karakter bawaan F / M (avatar/*.vrm, berkasnya tidak diubah) sebagai penghuni proyek. Penampilan dibangkitkan
   dari benih (params.benih): warna kulit, rambut, atasan, bawahan & sepatu. Atlas tekstur karakter dipetakan sekali:
   tiap segitiga dikelompokkan menurut tulang yang menggerakkannya (rambut, kepala, tangan, kaki, tungkai, badan) dan
   warna tengahnya (kulit atau bukan); lalu tiap benih mewarnai ulang salinan 512 px di kanvas — bayangan, lipatan &
   motif kain tetap, aksen terang (lis, garis) dibiarkan. Hanya salinan di memori yang diwarnai.
   Di mode jalan / tautan lihat NPC hidup sendiri: diam → jalan-jalan dalam radius jelajah atau beraktivitas
   (duduk di kursi / sofa, duduk di lantai, joget kecil, mengantuk, meregang, melihat jam, melambai ke pengunjung)
   → diam lagi. NPC tidak menembus dinding & perabot, menunggu bila pengunjung menghalangi, dan bisa disapa.
   Di editor NPC berdiri di tempatnya (bernapas & berkedip) agar mudah ditata.
   Berenang (JEV-113): NPC yang ikut pengunjung ikut masuk kolam renang; sesekali NPC berenang sendiri di kolam dekat
   tempatnya. Selama di air NPC berganti ke baju renang — avatar/F_renang.vrm atau F_renang2.vrm (menurut benih) dan
   M_renang.vrm, karakter yang sama diekspor dari VRoid Studio; tanpa berkas itu tetap berbaju biasa. */
/* global GPU, FPS, LIHAT, camera, levelGroups, PROJECT, areaDunia, pointInPoly, klonModel, muatModul, fpsResolveWalls, fpsGround, levelElevation,
   adaTanahSitus, tinggiTanah, FURN, titikDuduk, MEDIA_OBJ, MOOD, BAYANG_KOTOR:writable, el, fRow, selInput, numInput, HIST, rebuildScene,
   renderInspector, addTransformFields, toast, BAHASA, renderer, scene */
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
  const BAGIAN = [['kulit', 'Kulit'], ['rambut', 'Rambut'], ['atas', 'Atasan'], ['bawah', 'Bawahan'], ['sepatu', 'Sepatu']];
  const HEX = /^#[0-9a-f]{6}$/i, keRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  function penampilan(o) {
    const r = rng(benihAman(o) ^ (jenisAman(o.type) === 'M' ? 0x5bd1e995 : 0x27d4eb2f));
    for (let i = 0; i < 3; i++) r();
    const kulit = pilih(r, KULIT), rambut = r() < 0.14 ? pilih(r, RAMBUT_WARNA) : pilih(r, RAMBUT), atas = pilih(r, BAJU);
    let bawah = r() < 0.35 ? BAWAH[0] : pilih(r, r() < 0.5 ? BAWAH : BAJU);
    for (let i = 0; i < 4 && Math.abs(bawah[0] - atas[0]) + Math.abs(bawah[1] - atas[1]) + Math.abs(bawah[2] - atas[2]) < 60; i++) bawah = pilih(r, BAWAH);
    const hasil = { kulit, rambut, atas, bawah, sepatu: pilih(r, SEPATU) }, w = warnaAman(o.params && o.params.warna);
    if (w) for (const k in w) hasil[k] = keRgb(w[k]);                   // warna pilihan sendiri menimpa warna acak dari benih
    return hasil;
  }
  /* ---------- KUSTOM TAMPILAN: warna per bagian (params.warna {kulit, rambut, atas, bawah, sepatu: '#rrggbb'}) & pakaian
     (params.baju: '' biasa, 'renang' / 'renang2' = berkas avatar/*_renang*.vrm). Dipakai NPC & avatar Main bareng. ---------- */
  function warnaAman(w) { if (!w || typeof w !== 'object') return null; const o = {}; for (const [k] of BAGIAN) if (typeof w[k] === 'string' && HEX.test(w[k])) o[k] = w[k].toLowerCase(); return Object.keys(o).length ? o : null; }
  const keHex = c => '#' + c.map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  const kunciWarna = w => { const a = warnaAman(w); return a ? ':' + BAGIAN.map(([k]) => a[k] || '-').join(',') : ''; };
  const PAKAIAN = { F: [['', 'Baju biasa'], ['renang', 'Bikini'], ['renang2', 'Baju renang bandeau']], M: [['', 'Baju biasa'], ['renang', 'Celana renang']] };
  const bajuAman = (jenis, b) => ((PAKAIAN[jenis] || []).some(([k]) => k && k === b) ? b : '');
  let GAYA_SUNTING = false;
  // penyunting tampilan: 5 pemilih warna + pakaian + kembali ke warna otomatis; ubah(jenisPerubahan) dipanggil sesudah d.params diubah
  function penyunting(akar, d, ubah) {
    if (!GAYA_SUNTING) { GAYA_SUNTING = true; const st = document.createElement('style');
      st.textContent = `.npc-warna{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.npc-warna label{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:.66rem;color:var(--muted);cursor:pointer}
.npc-warna input[type=color]{width:30px;height:30px;padding:0;border:1px solid var(--line);border-radius:50%;background:none;cursor:pointer;-webkit-appearance:none;appearance:none}
.npc-warna input[type=color]::-webkit-color-swatch-wrapper{padding:0}.npc-warna input[type=color]::-webkit-color-swatch{border:none;border-radius:50%}
.npc-sunting-bar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:.74rem}.npc-sunting-bar select{flex:1;min-width:120px}`;
      document.head.appendChild(st); }
    d.params = d.params || {};
    const jenis = jenisAman(d.type), p = penampilan(d), w = el('div', 'npc-warna');
    for (const [k, l] of BAGIAN) {
      const lb = el('label'), inp = document.createElement('input'); inp.type = 'color'; inp.value = p[k] ? keHex(p[k]) : '#f4f4f4'; inp.dataset.bagian = k; inp.title = l; inp.setAttribute('aria-label', 'Warna ' + l.toLowerCase());
      inp.onchange = () => { d.params.warna = { ...(warnaAman(d.params.warna) || {}), [k]: inp.value.toLowerCase() }; ubah('warna'); };
      lb.append(inp, el('span', null, l)); w.appendChild(lb);
    }
    const bar = el('div', 'npc-sunting-bar'), pakai = document.createElement('select'); pakai.setAttribute('aria-label', 'Pakaian');
    for (const [v, l] of PAKAIAN[jenis]) { const op = document.createElement('option'); op.value = v; op.textContent = l; pakai.appendChild(op); }
    pakai.value = bajuAman(jenis, d.params.baju); pakai.onchange = () => { if (pakai.value) d.params.baju = pakai.value; else delete d.params.baju; ubah('baju'); };
    const ulang = el('button', 'btn sm ghost', '↺ Warna otomatis'); ulang.type = 'button'; ulang.hidden = !warnaAman(d.params.warna);
    ulang.onclick = () => { delete d.params.warna; ubah('warna'); };
    bar.append(el('span', null, 'Pakaian'), pakai, ulang); akar.append(w, bar);
  }

  /* ---------- PETA ATLAS (sekali per karakter) ---------- */
  const KELAS = { kulit: 1, rambut: 2, atas: 3, bawah: 4, sepatu: 5 };
  const katTulang = n => /hair/i.test(n) ? 'r' : /head|face|eye/i.test(n) ? 'k' : /foot|toe/i.test(n) ? 's'
    : /upperleg|lowerleg|hips|skirt|leg/i.test(n) ? 'b' : /hand|thumb|index|middle|ring|little/i.test(n) ? 't' : 'a';
  const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
  function bacaPiksel(tex, uk) {
    const c = document.createElement('canvas'); c.width = c.height = uk;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(tex.image, 0, 0, uk, uk);
    const d = x.getImageData(0, 0, uk, uk).data; c.width = c.height = 0; return d;
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
  // uk: sisi kanvas peta & pewarnaan — 512 untuk baju biasa; baju renang 1024 agar tepi kain yang tipis tidak bergerigi
  function petakan(tpl, uk = UK) {
    if (tpl.userData.npcPeta) return tpl.userData.npcPeta;
    const meshes = []; tpl.traverse(m => { if (m.isMesh && m.material && !Array.isArray(m.material) && m.material.map && m.material.map.image) meshes.push(m); });
    const perPeta = new Map();
    for (const m of meshes) { const t = m.material.map; if (!perPeta.has(t)) perPeta.set(t, { tex: t, wajah: /face/i.test(m.name) || /face/i.test(m.material.name || ''), tri: [] }); perPeta.get(t).tri.push(...segitiga(m)); }
    const daftar = [...perPeta.values()];
    for (const p of daftar) { p.src = bacaPiksel(p.tex, uk); p.uk = uk; }
    const ambil = (p, u, v, balik) => { const x = clamp(Math.floor(u * uk), 0, uk - 1), y = clamp(Math.floor((balik ? 1 - v : v) * uk), 0, uk - 1), i = (y * uk + x) * 4; return [p.src[i], p.src[i + 1], p.src[i + 2], p.src[i + 3]]; };
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
      p.kelas = new Uint8Array(uk * uk);
      if (p.wajah) continue;
      const kel = { 1: [], 2: [], 3: [], 4: [], 5: [] }, suara = new Map(), sisa = [];
      for (const s of p.tri) {
        const c = ambil(p, ...tengah(s), balik);
        if (s.kat === 'r' || s.kat === 'k') kel[KELAS.rambut].push(s);
        else if (s.kat === 't' || miripKulit(c[0], c[1], c[2], ref)) kel[KELAS.kulit].push(s);
        else { sisa.push(s); const u = suara.get(s.pulau) || { a: 0, b: 0, s: 0 }; u[s.kat === 's' ? 's' : s.kat === 'b' ? 'b' : 'a']++; suara.set(s.pulau, u); }
      }
      for (const s of sisa) { const u = suara.get(s.pulau), k = u.s >= u.a && u.s >= u.b ? KELAS.sepatu : u.b > u.a ? KELAS.bawah : KELAS.atas; kel[k].push(s); }
      const c = document.createElement('canvas'); c.width = c.height = uk; const x = c.getContext('2d', { willReadFrequently: true });
      for (const k of [1, 3, 4, 5, 2]) {
        x.clearRect(0, 0, uk, uk); x.fillStyle = x.strokeStyle = '#fff'; x.lineWidth = 2; x.lineJoin = 'round';
        x.beginPath();
        for (const s of kel[k]) { const q = s.uv.map(([u, v]) => [u * uk, (balik ? 1 - v : v) * uk]); x.moveTo(q[0][0], q[0][1]); x.lineTo(q[1][0], q[1][1]); x.lineTo(q[2][0], q[2][1]); x.closePath(); }
        x.fill(); x.stroke();
        const d = x.getImageData(0, 0, uk, uk).data;
        for (let i = 0; i < uk * uk; i++) if (d[i * 4 + 3] > 40) p.kelas[i] = k;
      }
      c.width = c.height = 0;
      // kecerahan rata-rata tiap kelas: acuan pewarnaan yang mempertahankan bayangan & motif
      const jum = new Float64Array(6), n = new Float64Array(6);
      for (let i = 0; i < uk * uk; i++) { const k = p.kelas[i]; if (k < 2 || p.src[i * 4 + 3] < 128) continue; jum[k] += lum(p.src[i * 4], p.src[i * 4 + 1], p.src[i * 4 + 2]); n[k]++; }
      p.rata = [...jum].map((v, k) => (n[k] ? v / n[k] : 128));
      delete p.tri;
    }
    for (const p of daftar) delete p.tri;
    return (tpl.userData.npcPeta = { daftar, ref });
  }

  const NPC = new Map();   // id objek → keadaan NPC (lihat PASANG)
  /* ---------- PEWARNAAN per benih (tembolok LRU) ---------- */
  const SIMPAN = new Map();
  // kainAsli: kain (atasan / bawahan / sepatu) tetap berwarna asli — baju renang dirancang pemiliknya; kulit & rambut tetap ikut benih
  function warnai(p, ref, look, kainAsli) {
    const uk = p.uk, out = new Uint8ClampedArray(p.src), rasio = look.kulit.map((v, i) => v / Math.max(1, ref[i]));
    const tujuan = [null, null, look.rambut, look.atas, look.bawah, look.sepatu];
    for (let i = 0; i < uk * uk; i++) {
      const j = i * 4, r = p.src[j], g = p.src[j + 1], b = p.src[j + 2], k = p.kelas[i];
      if (k === 0 || k === 1) { if ((p.wajah || k === 1) && miripKulit(r, g, b, ref)) { out[j] = r * rasio[0]; out[j + 1] = g * rasio[1]; out[j + 2] = b * rasio[2]; } continue; }
      const t = tujuan[k]; if (!t || (kainAsli && k !== 2)) continue;
      const l = lum(r, g, b), m = p.rata[k];
      if (k !== 2 && l > m * 1.7 && l > 150) continue;                    // lis / garis terang: tetap
      const f = clamp(l / Math.max(8, m), 0, 2.2);
      out[j] = t[0] * f; out[j + 1] = t[1] * f; out[j + 2] = t[2] * f;
    }
    // tekstur data (bukan kanvas): iOS WebKit membatasi total memori kanvas — melewatinya membuat kanvas baru diam-diam
    // kosong (NPC tak terlihat). Baris piksel sama seperti hasil getImageData, jadi orientasinya sama dengan peta asal
    const tex = new THREE.DataTexture(new Uint8Array(out.buffer), uk, uk, THREE.RGBAFormat), asal = p.tex;
    tex.flipY = asal.flipY; tex.encoding = asal.encoding; tex.wrapS = asal.wrapS; tex.wrapT = asal.wrapT; tex.anisotropy = asal.anisotropy || 1;
    tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.npcWarna = true; tex.needsUpdate = true;
    return tex;
  }
  function buangSet(k) { const s = SIMPAN.get(k); if (!s) return; SIMPAN.delete(k); for (const t of s.texs.values()) t.dispose(); for (const b of s.peta.values()) b.dispose(); }
  function materiUntuk(tpl, kunci, look, baju = '') {
    if (SIMPAN.has(kunci)) { const s = SIMPAN.get(kunci); SIMPAN.delete(kunci); SIMPAN.set(kunci, s); return s.peta; }
    const renang = /^_renang2?$/.test(baju), P = petakan(tpl, renang ? 1024 : UK), texs = new Map(), peta = new Map();
    for (const p of P.daftar) texs.set(p.tex, warnai(p, P.ref, look, renang));
    tpl.traverse(m => { if (!m.isMesh || !m.material || Array.isArray(m.material) || !texs.has(m.material.map) || peta.has(m.material)) return;
      const b = m.material.clone(); b.map = texs.get(m.material.map); peta.set(m.material, b); });
    SIMPAN.set(kunci, { peta, texs });
    // memori grafis (iPad): tiap kombinasi warna = satu set tekstur (±13 MB, baju renang ±50 MB). Set yang tidak dipakai NPC
    // mana pun dibuang selain 2 terakhir (memilih warna di inspector tidak menumpuk tekstur); batas keras SIMPAN_MAKS
    const dipakai = new Set([kunci]); for (const n of NPC.values()) if (n.kunciMat) dipakai.add(n.kunciMat);
    let bebas = [...SIMPAN.keys()].filter(k => !dipakai.has(k));
    while (bebas.length > 2 || SIMPAN.size > SIMPAN_MAKS) { const k = bebas.length ? bebas.shift() : SIMPAN.keys().next().value; buangSet(k); }
    return peta;
  }

  /* ---------- PASANG ke grup objek ---------- */
  const kotor = () => { BAYANG_KOTOR = Math.max(BAYANG_KOTOR, 1); };
  // bangun ulang adegan (edit, masuk mode jalan, pintu…) membuat grup baru: NPC dipasang seketika bila karakternya
  // sudah dimuat, dan keadaannya (posisi, kegiatan, kursi, bobot pose) dibawa ke grup baru selama tempat asalnya sama
  let AMAN = 0; try { AMAN = Math.min(2, +localStorage.getItem('npcAman') || 0); } catch (e) { AMAN = 0; }
  const TPL = {};
  // perbaikan hasil uji gambar (lihat ujiDanPerbaiki), diingat per perangkat
  let PERBAIKI = {}; try { PERBAIKI = JSON.parse(localStorage.getItem('npcPerbaiki') || '{}') || {}; } catch (e) { PERBAIKI = {}; }
  // tanda lama (versi < 2) bisa terpasang keliru: 'tulang' saat NPC berenang (badan meledak / hilang — three r128 mengunci
  // tekstur tulang saat renderer dibuat), 'asli' / 'polos' sesaat setelah memori grafis habis & dipulihkan. Dibuang sekali.
  // v3: 'asli' yang terekam saat memori kanvas iOS penuh (semua tekstur terbaca kosong) juga dibuang
  if (PERBAIKI.v !== 3) { PERBAIKI = { ...(PERBAIKI.kul ? { kul: 1 } : {}), v: 3 }; try { localStorage.setItem('npcPerbaiki', JSON.stringify(PERBAIKI)); } catch (e) { /* mode privat */ } }
  const BAWA = ['mode', 't', 'p', 'yaw', 'yawTuju', 'rumah', 'tuju', 'lanjut', 'kursi', 'po', 'laju', 'jelajah', 'dari', 'ke', 'tunggu', 'macet', 'menoleh', 'disapa', 'tg', 'jarak', 'pangku', 'renang', 'kolamTuju'];
  const diDunia = g => { for (let x = g; x; x = x.parent) if (x.isScene) return true; return false; };
  let PERINGATAN = false;
  function rakit(n, tpl, lama, baju = '') {
    const o = n.o;
    let peta;
    const km = jenisAman(o.type) + baju + ':' + benihAman(o) + kunciWarna(o.params && o.params.warna);
    try { peta = materiUntuk(tpl, km, penampilan(o), baju); n.kunciMat = km; }
    catch (e) { peta = new Map(); console.warn('NPC warna', e); if (!PERINGATAN) { PERINGATAN = true; toast('Warna NPC tidak bisa diacak di perangkat ini — memakai warna asli'); } }
    const m = klonModel(tpl); m.userData.rigIdx = tpl.userData.rigIdx; m.userData.kedipIdx = tpl.userData.kedipIdx; m.userData.klip = [];
    m.traverse(x => { if (x.isMesh) { if (peta.has(x.material) && !PERBAIKI.peta) x.material = peta.get(x.material); if (AMAN) x.material = bahanAman(x.material, AMAN); if (PERBAIKI.kul) x.frustumCulled = false; x.raycast = () => {}; x.userData.bersama = true; x.userData.tetapTampak = true; } });
    n.badan.add(m);
    setTimeout(() => periksa(), 1500); setTimeout(() => periksa(), 4000);
    const a = { g: n.badan, tuju: { po: 0 }, baju, tpl, npc: true }; window.LOBI.gerak.siapkanGerak(a, m); n.a = a;
    if (lama && lama.a) { for (const k of ['pw', 'w', 'v', 'mikro', 'lambai', 'diam']) if (lama.a[k] != null) a[k] = Array.isArray(lama.a[k]) ? lama.a[k].slice() : lama.a[k]; }
    if (n.mode && n.p) pasangBadan(n);
    if ((n.renang || bajuTetap(n)) && !baju) pakaiBaju(n, true);   // sedang berenang / pakaian renang dipilih di inspector
    kotor();
  }
  // baju renang: model karakter diganti utuh (klon baru, warna dari benih yang sama); bobot pose & keadaan gerak dibawa
  const BAJU_RENANG = {};
  function bajuRenang(k, suf = '_renang') {
    const kk = k + suf;
    if (!(kk in BAJU_RENANG)) BAJU_RENANG[kk] = muatModul('lobi').then(() => window.LOBI.muatAvatar3D({ bawaan: kk })).then(t => t, () => null);
    return BAJU_RENANG[kk];
  }
  function bajuTetap(n) { return bajuAman(jenisAman(n.o.type), n.o.params && n.o.params.baju); }   // pakaian pilihan di inspector: dipakai terus
  function pakaiBaju(n, renang) {
    if (!n.a) return;
    const k = jenisAman(n.o.type), tetap = bajuTetap(n), suf = tetap ? '_' + tetap : window.LOBI.sufiksRenang(k, benihAman(n.o)), mau = renang || tetap ? suf : '';
    n.bajuMau = mau;
    if ((n.a.baju || '') === mau) return;
    const ganti = tpl => { if (!tpl || !n.a || n.bajuMau !== mau || (n.a.baju || '') === mau || !diDunia(n.g)) return; n.badan.remove(n.a.model); rakit(n, tpl, { a: n.a }, mau); };
    if (renang) bajuRenang(k, suf).then(ganti); else ganti(TPL[k]);
  }
  // avatar Main bareng (karakter bawaan + benih warna): klon model diwarnai sama seperti NPC — penampilan dari benih yang
  // sama di semua peserta, jadi tiap orang melihat warna yang sama (JEV-112)
  function warnaiAvatar(model, tpl, jenis, benih, baju = '', warna = null) {
    const o = { type: jenisAman(jenis), params: { benih: benih >>> 0, ...(warnaAman(warna) ? { warna: warnaAman(warna) } : {}) } };
    let peta; try { peta = materiUntuk(tpl, 'av:' + o.type + (/^_renang2?$/.test(baju) ? baju : '') + ':' + o.params.benih + kunciWarna(o.params.warna), penampilan(o), baju); } catch (e) { console.warn('avatar warna', e); return false; }
    model.traverse(x => { if (x.isMesh && peta.has(x.material)) x.material = peta.get(x.material); });
    return true;
  }
  /* MODE TAMPIL AMAN (iPad / WebKit): program shader NPC (berkulit + morf + sisipan GI per ruang) bisa gagal
     dikompilasi di sebagian GPU sehingga karakter tidak tergambar sama sekali. Program diperiksa setelah tampil;
     bila gagal: 1 = bahan sama tanpa sisipan GI, 2 = bahan Lambert sederhana. Tingkat diingat per perangkat. */
  const CATAT = [];
  for (const [k, t] of [['error', 'E'], ['warn', 'W']]) { const asli = console[k]; console[k] = function (...a) { try { CATAT.push(t + ': ' + a.map(x => (x && x.message) || String(x)).join(' ').replace(/\s+/g, ' ').slice(0, 400)); if (CATAT.length > 30) CATAT.shift(); } catch (e) { /* abaikan */ } return asli.apply(console, a); }; }
  const SIMPAN_AMAN = new Map();
  function bahanAman(mt, t) {
    const kunci = mt.uuid + ':' + t; if (SIMPAN_AMAN.has(kunci)) return SIMPAN_AMAN.get(kunci);
    let b;
    if (t >= 2) b = new THREE.MeshLambertMaterial({ map: mt.map || null, color: mt.color ? mt.color.clone() : 0xffffff, transparent: !!mt.transparent, opacity: mt.opacity, alphaTest: mt.alphaTest || 0, side: mt.side, skinning: true, morphTargets: !!mt.morphTargets });
    else { b = mt.clone(); b.onBeforeCompile = function () { /* tanpa sisipan GI */ }; }
    b.name = (mt.name || '') + ' (aman ' + t + ')'; SIMPAN_AMAN.set(kunci, b); return b;
  }
  function statusProgram(m) {
    let gagal = 0, ok = 0, belum = 0;
    m.traverse(x => { if (!x.isMesh) return; const pr = renderer.properties.get(x.material), pg = pr && pr.currentProgram;
      if (!pg) belum++; else if (pg.diagnostics && pg.diagnostics.runnable === false) gagal++; else ok++; });
    return { gagal, ok, belum };
  }
  /* UJI GAMBAR: NPC digambar sendirian (lapisan 31) ke target kecil dalam 3 varian untuk memilah sebab NPC tak terlihat
     padahal programnya sah — A normal, B tanpa tekstur, C tanpa tekstur & tanpa tulang (pose ikat). Nilai = piksel terisi. */
  function ujiGambar(n) {
    const m = n.a && n.a.model; if (!m || !renderer || typeof scene === 'undefined') return null;
    m.updateMatrixWorld(true);
    const kotak = new THREE.Box3().setFromObject(m), pusat = kotak.getCenter(new THREE.Vector3()), uk = kotak.getSize(new THREE.Vector3());
    if (kotak.isEmpty() || !isFinite(pusat.x + pusat.y + pusat.z)) return { galat: 'kotak batas kosong / NaN' };
    const cam = new THREE.PerspectiveCamera(35, 0.5, 0.05, 50), q = n.badan.getWorldQuaternion(new THREE.Quaternion());
    cam.position.copy(pusat).add(new THREE.Vector3(0, 0, 1).applyQuaternion(q).multiplyScalar(Math.max(0.5, uk.y) * 1.9)); cam.lookAt(pusat); cam.layers.set(31); cam.updateMatrixWorld();
    const rt = new THREE.WebGLRenderTarget(32, 64), buf = new Uint8Array(32 * 64 * 4), mesh = [], temp = [], hasil = { ukuran: uk.toArray().map(v => +v.toFixed(2)).join('×') };
    m.traverse(x => { if (x.isMesh) { mesh.push([x, x.material, x.layers.mask]); x.layers.enable(31); if (!x.visible) hasil.sembunyi = (hasil.sembunyi || 0) + 1; } });
    const latar = scene.background, kabut = scene.fog, warna = renderer.getClearColor(new THREE.Color()), alfa = renderer.getClearAlpha(), rtLama = renderer.getRenderTarget(), auto = renderer.autoClear;
    try {
      scene.background = null; scene.fog = null; renderer.setClearColor(0x000000, 0); renderer.autoClear = true; renderer.setRenderTarget(rt);
      // K = pembanding: kotak biasa di tempat NPC (NPC dikeluarkan dari lapisan uji) — 0 berarti uji ini tak berlaku di perangkat
      const kotakUji = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      kotakUji.position.copy(pusat); kotakUji.layers.set(31); scene.add(kotakUji); kotakUji.updateMatrixWorld(true);
      for (const [x, , mask] of mesh) x.layers.mask = mask;
      renderer.clear(); renderer.render(scene, cam); renderer.readRenderTargetPixels(rt, 0, 0, 32, 64, buf);
      let kk = 0; for (let i = 0; i < buf.length; i += 4) if (buf[i] | buf[i + 1] | buf[i + 2] | buf[i + 3]) kk++; hasil.K = kk;
      scene.remove(kotakUji); kotakUji.geometry.dispose(); kotakUji.material.dispose();
      for (const [x] of mesh) x.layers.enable(31);
      for (const v of ['A', 'B', 'C']) {
        for (const [x, mt] of mesh) { if (v === 'A') { x.material = mt; continue; }
          const b = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, skinning: v === 'B' && !!x.isSkinnedMesh, morphTargets: v === 'B' && !!mt.morphTargets }); temp.push(b); x.material = b; }
        renderer.clear(); renderer.render(scene, cam); renderer.readRenderTargetPixels(rt, 0, 0, 32, 64, buf);
        let k = 0; for (let i = 0; i < buf.length; i += 4) if (buf[i] | buf[i + 1] | buf[i + 2] | buf[i + 3]) k++; hasil[v] = k;
      }
    } catch (e) { hasil.galat = (e && e.message) || String(e); }
    finally {
      for (const [x, mt, mask] of mesh) { x.material = mt; x.layers.mask = mask; }
      scene.background = latar; scene.fog = kabut; renderer.setClearColor(warna, alfa); renderer.autoClear = auto; renderer.setRenderTarget(rtLama);
      rt.dispose(); for (const b of temp) b.dispose();
    }
    return hasil;
  }
  // perbaikan menurut uji gambar, diingat per perangkat: tekstur kosong → tekstur asli (tanpa pewarnaan);
  // (B = 0, C > 0 hanya dicatat di diagnosa: tulang tidak bisa dipindah ke uniform setelah renderer dibuat)
  const simpanPerbaiki = () => { try { localStorage.setItem('npcPerbaiki', JSON.stringify(PERBAIKI)); } catch (e) { /* mode privat */ } };
  function terapkanPerbaikan() {
    for (const n of NPC.values()) if (n.badan) { const lama = n.a && n.a.model; if (lama) { n.badan.remove(lama); n.a = null; } }
    for (const n of NPC.values()) { const t = TPL[jenisAman(n.o.type)]; if (t && n.badan) rakit(n, t, n); }
  }
  let UJI_T = -1e9;
  // memori grafis habis / baru dipulihkan (GPU di index.html): tekstur & program belum siap → uji & periksa ditunda
  const gpuBaruPulih = () => (renderer.getContext && renderer.getContext().isContextLost()) || (typeof GPU !== 'undefined' && performance.now() - GPU.t < 20000);
  function ujiDanPerbaiki() {
    if (performance.now() - UJI_T < 8000) return;
    // memori grafis habis / baru dipulihkan: tekstur belum terunggah ulang → hasil uji keliru
    if (gpuBaruPulih()) return;
    // hanya NPC yang berdiri biasa: berenang / berbaring / duduk menggeser badan keluar kotak ikat → bingkai uji meleset
    const tegak = x => !x.renang && x.mode !== 'renang' && !(x.a.pw || []).some((w, i) => i > 0 && w > 0.05);
    const n = [...NPC.values()].find(x => x.a && x.a.model && x.badan && x.badan.visible && tegak(x)); if (!n) return;
    UJI_T = performance.now();
    const r = ujiGambar(n); n.uji = r; if (!r || r.galat || r.A > 0 || !r.K || r.sembunyi) return;   // mesh disembunyikan kode lain: bukan soal perangkat
    if (r.C === 0 && !PERBAIKI.kul) { PERBAIKI.kul = 1; simpanPerbaiki(); for (const m of NPC.values()) if (m.a && m.a.model) m.a.model.traverse(x => { if (x.isMesh) x.frustumCulled = false; }); toast('NPC selalu digambar (tanpa pemangkasan pandang) di perangkat ini'); }
    else if (r.B > 0 && !PERBAIKI.peta) { PERBAIKI.peta = 'asli'; simpanPerbaiki(); terapkanPerbaikan(); toast('NPC memakai tekstur asli di perangkat ini'); }
    else return;
    UJI_T = -1e9; kotor(); setTimeout(() => ujiDanPerbaiki(), 1500);
  }
  function periksa() {
    if (gpuBaruPulih()) { setTimeout(() => periksa(), 21000); return false; }   // memori grafis habis / baru dipulihkan: program & tekstur belum siap
    let gagal = false;
    for (const n of NPC.values()) if (n.a && n.a.model && statusProgram(n.a.model).gagal) gagal = true;
    if (!gagal) { try { ujiDanPerbaiki(); } catch (e) { console.warn('NPC uji', e && e.message); } return false; }
    if (AMAN >= 2) return false;
    AMAN++; try { localStorage.setItem('npcAman', String(AMAN)); } catch (e) { /* mode privat */ }
    for (const n of NPC.values()) if (n.a && n.a.model) n.a.model.traverse(x => { if (x.isMesh) x.material = bahanAman(x.material, AMAN); });
    toast(AMAN >= 2 ? 'NPC memakai tampilan sederhana di perangkat ini' : 'NPC memakai tampilan aman di perangkat ini');
    kotor(); setTimeout(() => periksa(), 2500);
    return true;
  }
  // rata-rata alfa tekstur (0–255) dari salinan 8×8 — 0 berarti tekstur kosong / tak terbaca
  function rataAlfa(im) { try { const c = document.createElement('canvas'); c.width = c.height = 8; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 8, 8);
    const d = x.getImageData(0, 0, 8, 8).data; let j = 0; for (let i = 3; i < d.length; i += 4) j += d[i]; c.width = c.height = 0; return Math.round(j / 64); } catch (e) { return '?'; } }
  function diagnosa() {
    const c = renderer.capabilities, gl = renderer.getContext(), baris = [];
    baris.push('Plan23D · diagnosa NPC · ' + new Date().toISOString());
    baris.push('Peramban: ' + navigator.userAgent);
    baris.push(`WebGL${c.isWebGL2 ? '2' : '1'} · tekstur ${c.maxTextures} · tekstur verteks ${c.maxVertexTextures} · uniform verteks ${c.maxVertexUniforms} · uniform fragmen ${gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS)} · atribut ${c.maxAttributes} · varying ${c.maxVaryings} · float verteks ${c.floatVertexTextures} · ukuran ${c.maxTextureSize} · presisi ${c.precision}`);
    baris.push('Mode aman: ' + AMAN + ' · perbaikan: ' + JSON.stringify(PERBAIKI) + ' · tulang tekstur float: ' + c.floatVertexTextures + ' · karakter termuat: ' + Object.keys(TPL).join(', '));
    for (const n of NPC.values()) {
      baris.push(`NPC ${n.id} (${jenisAman(n.o.type)}) siap=${!!n.a} mode=${n.mode} posisi=${n.p ? n.p.x.toFixed(1) + ',' + n.p.y.toFixed(2) + ',' + n.p.z.toFixed(1) : '-'} tampak=${(() => { for (let x = n.g; x; x = x.parent) if (!x.visible) return false; return true; })()}`);
      if (n.a && n.a.model) n.a.model.traverse(x => { if (!x.isMesh) return; const mt = x.material, im = mt.map && mt.map.image, pr = renderer.properties.get(mt), pg = pr && pr.currentProgram;
        baris.push(`  · ${x.name || 'mesh'}${x.visible ? '' : ' TERSEMBUNYI'} ${x.isSkinnedMesh ? 'berkulit ' + x.skeleton.bones.length + ' tulang' : ''} ${mt.type} peta=${im ? im.width + '×' + im.height + ' α' + rataAlfa(im) : '-'} transp=${!!mt.transparent} αuji=${mt.alphaTest} op=${mt.opacity} sisi=${mt.side} skin=${!!mt.skinning} morf=${!!mt.morphTargets} program=${!pg ? 'belum' : pg.diagnostics && pg.diagnostics.runnable === false ? 'GAGAL' : 'ok'}`);
        if (pg && pg.diagnostics && pg.diagnostics.runnable === false) baris.push('    ' + String(pg.diagnostics.programLog || '').slice(0, 300) + ' | ' + String((pg.diagnostics.vertexShader || {}).log || '').slice(0, 300) + ' | ' + String((pg.diagnostics.fragmentShader || {}).log || '').slice(0, 300)); });
      // uji gambar SETELAH status program dicatat: menggambar ke target lain bisa memasang program baru
      if (n.a && n.a.model) { const u = ujiGambar(n), p = new THREE.Vector3(), sk = new THREE.Vector3(); n.badan.getWorldPosition(p); n.badan.getWorldScale(sk);
        baris.push(`  uji gambar${u && u.sembunyi ? ' (' + u.sembunyi + ' mesh tersembunyi)' : ''} K=${u && u.K} A=${u && u.A} B=${u && u.B} C=${u && u.C} ukuran=${u && u.ukuran}${u && u.galat ? ' galat=' + u.galat : ''} · dunia ${p.toArray().map(v => v.toFixed(1)).join(',')} skala ${sk.x.toFixed(2)}`); }
    }
    baris.push('Galat terakhir:'); for (const g of CATAT.slice(-12)) baris.push('  ' + g);
    return baris.join('\n');
  }
  function tampilDiagnosa() {
    let d = document.getElementById('npcDiagnosa');
    if (!d) { d = el('div', 'float'); d.id = 'npcDiagnosa'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Diagnosa NPC');
      d.style.cssText = 'left:50%;top:50%;transform:translate(-50%,-50%);z-index:80;width:min(560px,calc(100% - 24px));max-height:80%;display:flex;flex-direction:column;gap:8px;padding:12px';
      const pre = el('pre'); pre.style.cssText = 'margin:0;overflow:auto;white-space:pre-wrap;font-size:.7rem;max-height:60vh;user-select:text;-webkit-user-select:text';
      const r = el('div', 'row'), salin = el('button', 'btn sm', 'Salin'), ulang = el('button', 'btn sm ghost', 'Atur ulang tampilan NPC'), tutup = el('button', 'btn sm ghost', 'Tutup');
      ulang.onclick = () => { PERBAIKI = { v: 3 }; AMAN = 0; try { localStorage.setItem('npcPerbaiki', JSON.stringify(PERBAIKI)); localStorage.removeItem('npcAman'); } catch (e) { /* mode privat */ } terapkanPerbaikan(); kotor(); d.querySelector('pre').textContent = diagnosa(); toast('Tampilan NPC diatur ulang'); };
      salin.onclick = () => { try { navigator.clipboard.writeText(pre.textContent).then(() => toast('Diagnosa disalin'), () => toast('Tidak bisa menyalin — ambil tangkapan layar saja')); } catch (e) { toast('Tidak bisa menyalin — ambil tangkapan layar saja'); } };
      tutup.onclick = () => d.remove(); r.append(salin, ulang, tutup); d.append(pre, r); document.body.appendChild(d); }
    d.querySelector('pre').textContent = diagnosa();
  }
  // siluet tembus pandang selama karakter diunduh & disiapkan (unduhan ±12 MB pertama kali)
  let SIL = null;
  function siluet() {
    if (!SIL) { const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, depthWrite: false });
      const badan = new THREE.CylinderGeometry(0.19, 0.15, 1.05, 14).translate(0, 0.98, 0), kaki = new THREE.CylinderGeometry(0.13, 0.1, 0.5, 10).translate(0, 0.25, 0), kepala = new THREE.SphereGeometry(0.13, 14, 10).translate(0, 1.6, 0);
      SIL = [badan, kaki, kepala].map(gm => [gm, m]); }
    const s = new THREE.Group(); s.userData.siluet = true;
    for (const [gm, m] of SIL) { const x = new THREE.Mesh(gm, m); x.userData.noExport = true; x.userData.bersama = true; x.userData.tetapTampak = true; x.raycast = () => {}; s.add(x); }
    return s;
  }
  const MUAT = {};
  function muatTpl(k) {
    if (!MUAT[k]) {
      const lama = setTimeout(() => toast('Memuat karakter NPC ' + k + '…'), 700);
      MUAT[k] = muatModul('lobi').then(() => window.LOBI.muatAvatar3D({ bawaan: k })).then(tpl => { clearTimeout(lama); TPL[k] = tpl; return tpl; },
        e => { clearTimeout(lama); delete MUAT[k]; toast('NPC gagal dimuat — ' + (e && e.message || e)); throw e; });
    }
    return MUAT[k];
  }
  function pasang(g, o, lv) {
    const lama = NPC.get(o.id), n = { id: o.id, o, g, badan: g.userData.badan, li: Math.max(0, PROJECT.levels.indexOf(lv)), mode: null, po: 0 };
    if (lama && lama.mode && lama.o.x === o.x && lama.o.z === o.z && (lama.o.y || 0) === (o.y || 0) && lama.o.type === o.type && lama.li === n.li) for (const k of BAWA) n[k] = lama[k];
    NPC.set(o.id, n);
    const k = jenisAman(o.type);
    if (TPL[k] && window.LOBI) { rakit(n, TPL[k], lama); return Promise.resolve(); }
    const sil = siluet(); n.badan.add(sil);
    return muatTpl(k).then(tpl => {
      n.badan.remove(sil);
      if (NPC.get(o.id) !== n || !diDunia(g)) return;
      try { rakit(n, tpl, lama); } catch (e) { toast('NPC gagal ditampilkan — ' + (e && e.message || e)); throw e; }
    }).catch(e => { n.badan.remove(sil); console.warn('NPC', e && e.message); });
  }

  /* ---------- PERILAKU ---------- */
  const hidup = () => FPS.on || !!(typeof LIHAT !== 'undefined' && LIHAT.on);
  const tampak = n => { for (let x = n.g; x; x = x.parent) if (!x.visible) return false; return true; };
  const adaMusik = () => { try { return (typeof window.bgmMain === 'function' && window.bgmMain()) || (typeof MEDIA_OBJ !== 'undefined' && MEDIA_OBJ.size > 0); } catch (e) { return false; } };
  const jarakPengunjung = n => FPS.on ? Math.hypot(camera.position.x - n.p.x, camera.position.z - n.p.z) : Infinity;
  // kolam (renang / ikan) bukan pijakan: NPC berjalan mengitarinya, masuk air hanya lewat Berenang
  function diKolam(n, x, z) {
    const lv = PROJECT.levels[n.li]; if (!lv) return false;
    for (const o of lv.objects) if (o.kind === 'area' && /^kolam/.test((o.params || {}).jenis || '') && pointInPoly(x, z, areaDunia(o))) return true;
    return false;
  }
  function tanahDi(n, x, z) {
    if (diKolam(n, x, z)) return null;
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
      calon.push({ s, q, kunci, id: c.userData.id, d: Math.hypot(q.x - n.p.x, q.z - n.p.z), x: s.pos.x, z: s.pos.z, y: s.pos.y - 0.45, yaw: Math.atan2(s.arah.x, s.arah.z), po: 1 });
    }
    calon.sort((a, b) => a.d - b.d);
    for (const k of calon.slice(0, 3)) if (k.d < 0.3 || jalurBebas(n, k.q.x, k.q.z, k.id)) return k;
    return null;
  }
  // kasur: berbaring telentang (pose 9) di tengah ranjang, kepala ke arah sandaran (−Z lokal ranjang)
  // rangka kasur: ranjang pustaka (bed_*) atau model unggahan berkategori Berbaring (JEV-125). titik(x, y, z): x ke samping,
  // y di atas permukaan kasur, z ke arah kaki (kepala di −z); w = lebar; yaw = arah hadap orang berbaring
  function rangkaKasur(c, o) {
    if (!o) return null;
    if (/^bed_/.test(o.type) && FURN[o.type] && c.userData.duduk) { const h = c.userData.duduk.h || 0.55;
      return { w: FURN[o.type].f[0], yaw: o.rotY || 0, titik: (x, y, z) => c.localToWorld(new THREE.Vector3(x, h + y, z)) }; }
    const B = c.userData.baring; if (o.kind !== 'model' || !B) return null;
    const s = Math.sin(B.a), k = Math.cos(B.a), y0 = c.getWorldPosition(new THREE.Vector3()).y + (B.h != null ? B.h : B.hl * c.scale.y);
    return { w: B.wid || 1, yaw: (o.rotY || 0) + B.a, titik: (x, y, z) => c.localToWorld(new THREE.Vector3(B.cx + x * k + z * s, 0, B.cz - x * s + z * k)).setY(y0 + y) };
  }
  function cariKasur(n, jauh) {
    const lg = levelGroups[n.li], lv = PROJECT.levels[n.li]; if (!lg || !lv) return null;
    const calon = [];
    for (const c of lg.children) {
      if (c.userData.kind !== 'obj' || !c.visible || !(c.userData.duduk || c.userData.baring)) continue;
      const o = lv.objects.find(x => x.id === c.userData.id); c.updateMatrixWorld(true);
      const R = rangkaKasur(c, o); if (!R) continue;
      const kunci = 'kasur:' + o.id; if (KURSI_DIPAKAI.has(kunci) || (FPS.duduk && FPS.duduk.id === o.id)) continue;
      const tengah = R.titik(0, 0, -0.05);
      if (!jauh && Math.hypot(tengah.x - n.rumah.x, tengah.z - n.rumah.z) > n.jelajah + 2) continue;   // diminta pengunjung: kasur mana pun di lantai ini
      const sisi = R.titik((R.w / 2 + 0.5) * (Math.random() < 0.5 ? 1 : -1), 0, 0.2);
      const yaw = R.yaw, q = { x: sisi.x, z: sisi.z };
      if (!jalurBebas(n, q.x, q.z, o.id)) continue;
      calon.push({ id: o.id, kunci, q, x: tengah.x, z: tengah.z, y: tengah.y, yaw, po: 9, lama: 20 + Math.random() * 25, d: Math.hypot(q.x - n.p.x, q.z - n.p.z) });
    }
    calon.sort((a, b) => a.d - b.d); return calon[0] || null;
  }
  function diam(n, t) { n.mode = 'diam'; n.t = t != null ? t : 2.5 + Math.random() * 5; n.po = 0; n.menoleh = Math.random() < 0.6; }
  function aktivitas(n, po, t, mikro) { n.mode = 'aktivitas'; n.po = po; n.t = t; if (mikro) n.a.mikro = { k: mikro, t: 0, d: mikro === 'regang' ? 2.6 : mikro === 'jam' ? 2.2 : 1.2 }; }
  function berikutnya(n) {
    const r = Math.random(), dekat = jarakPengunjung(n) < 6;
    if (dekat && !n.disapa && Math.random() < 0.25) { n.disapa = true; return sapaAuto(n); }
    if (r < 0.48 && cobaJalan(n)) return;
    const malam = typeof MOOD !== 'undefined' && (MOOD === 'malam' || MOOD === 'gelap');
    const pilihan = [['kursi', 0.24], ['kasur', malam ? 0.45 : 0.08], ['lantai', 0.12], ['joget', n.akhirAkt === 'joget' ? 0 : adaMusik() ? 0.1 : 0.025], ['ngantuk', 0.1], ['mikro', 0.3], ['renang', adaKolam(n) ? (malam ? 0.04 : 0.16) : 0]];
    let x = Math.random() * pilihan.reduce((s, p) => s + p[1], 0), k = 'mikro';
    for (const [nm, w] of pilihan) { x -= w; if (x <= 0) { k = nm; break; } }
    n.akhirAkt = k;                                                   // joget jarang (JEV-123): ±2 % tanpa musik, ±8 % dengan musik, tidak dua kali beruntun
    if (k === 'renang') { const K = kolamDekat(n); if (K) { n.kolamTuju = K; return mulaiJalan(n, K.q.x, K.q.z, 'renang'); } k = 'kursi'; }
    if (k === 'kasur') { const ks = cariKasur(n); if (ks) { KURSI_DIPAKAI.add(ks.kunci); n.kursi = ks; return mulaiJalan(n, ks.q.x, ks.q.z, 'kursi'); } k = 'kursi'; }
    if (k === 'kursi') { const ks = cariKursi(n); if (ks) { KURSI_DIPAKAI.add(ks.kunci); n.kursi = ks; return ks.d < 0.3 ? masukKursi(n) : mulaiJalan(n, ks.q.x, ks.q.z, 'kursi'); } k = 'lantai'; }
    if (k === 'lantai') return aktivitas(n, 2, 8 + Math.random() * 10);
    if (k === 'joget') return aktivitas(n, 3, 5 + Math.random() * 6);
    if (k === 'ngantuk') { if (jarakPengunjung(n) < 6) huft(n.id, 1.2); return aktivitas(n, 4, 7 + Math.random() * 7); }
    return aktivitas(n, 0, 2.8, pilih(Math.random, ['regang', 'jam', 'bahu']));
  }
  function masukKursi(n) { const k = n.kursi; n.mode = 'masuk'; n.t = 0; n.dari = { x: n.p.x, z: n.p.z, y: n.p.y }; n.po = k.po || 1; n.yawTuju = k.yaw; if (k.sandar != null) n.a.sandar = k.sandar; if (k.sisi != null) n.a.sisi = k.sisi; }
  // berbaring bareng: pengunjung rebahan di tengah kasur, NPC di sisi kasur yang lain. peluk: meringkuk rapat menghadap
  // pengunjung (pose 19) — miring, lengan merangkul; a.sisi = arah kepala (1 kiri avatar, −1 kanan) agar kepala tetap di bantal.
  // dada: sama, tetapi badan bergeser ke arah kaki ranjang & ke tengah sehingga kepala NPC bersandar di dada pengunjung
  function kasurBareng(n, D, peluk, dada) {
    const lg = levelGroups[n.li], lv = PROJECT.levels[n.li], g = lg && lg.children.find(c => c.userData.kind === 'obj' && c.userData.id === D.id), o = lv && lv.objects.find(x => x.id === D.id);
    if (!g || !o) return null;
    g.updateMatrixWorld(true);
    const R = rangkaKasur(g, o); if (!R) return null;
    const jx = dada ? 0.4 : peluk ? 0.36 : R.w / 4, jz = dada ? 0.3 : -0.05;
    // peluk / dada: relatif terhadap tempat pengunjung berbaring (bisa sudah bergeser ke satu sisi — rapikanBaring), ke arah tengah kasur
    const c0 = R.titik(0, 0, jz), c1 = R.titik(1, 0, jz), ex = c1.x - c0.x, ez = c1.z - c0.z;
    const u = peluk ? ((D.baring.x - c0.x) * ex + (D.baring.z - c0.z) * ez) / (ex * ex + ez * ez || 1) : 0;
    const ki = R.titik(u - jx, 0, jz), ka = R.titik(u + jx, 0, jz);
    const s = Math.abs(u) > 0.05 ? (u > 0 ? -1 : 1) : Math.hypot(ki.x - D.baring.x, ki.z - D.baring.z) > Math.hypot(ka.x - D.baring.x, ka.z - D.baring.z) ? -1 : 1, t = s < 0 ? ki : ka;
    const sisi = R.titik((R.w / 2 + 0.5) * s, 0, 0.2), rot = R.yaw;
    return { id: o.id, kunci: 'kasur:' + o.id + ':bareng', bareng: o.id, q: { x: sisi.x, z: sisi.z }, x: t.x, z: t.z, y: t.y, lama: 45, d: 0,
      ...(peluk ? { po: dada ? 20 : 19, sisi: -s, yaw: rot - s * Math.PI / 2, wajah: dada ? R.titik(u + s * 0.1, 0.26, jz - 0.4) : R.titik(u + s * jx, 0.22, jz - 0.53) } : { po: 9, yaw: rot }) };
  }
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
  // obrolan (modul/dialog.js): NPC berhenti & menghadap pengunjung; reaksi kecil menurut niat pesan
  function ngobrol(id, ev) {
    const n = NPC.get(id); if (!n || !n.a) return;
    const G = window.LOBI.gerak;
    if (ev === 'mulai') { n.obrol = true; if (n.mode !== 'duduk' && n.mode !== 'masuk') { if (n.mode === 'jalan') { lepasKursi(n); n.kursi = null; } n.mode = 'ngobrol'; n.po = 0; n.a.mikro = null; } return; }
    if (ev === 'selesai') { n.obrol = false; if (n.mode === 'ngobrol') diam(n, 2 + Math.random() * 3); return; }
    if (ev === 'salam' || ev === 'pamit') G.mulaiLambai(n.a);
    else if (ev === 'puji' || ev === 'terimakasih') n.a.mikro = { k: 'bahu', t: 0, d: 1.2 };
    else if (ev === 'hina') n.a.mikro = { k: 'jam', t: 0, d: 2.2 };
  }
  /* INTERAKSI BERPASANGAN dengan pengunjung (JEV-109): peluk, gandeng (mengikuti di sisi kanan), dansa berdua, duduk bareng */
  function aksiPasangan(id, k) {
    const n = NPC.get(id); if (!n || !n.a || !FPS.on || !n.mode) return false;
    if (k === 'lepas') { if (n.mode === 'duduk' && n.kursi && n.kursi.minta) { n.kursi.bareng = null; n.t = 0; return true; } if (n.mode === 'renang') keluarKolam(n); else if (n.mode === 'pangku') turunPangku(n); else if (/^(gandeng|dansa|peluk|cium|ikut|temani)$/.test(n.mode)) diam(n, 1.5); return true; }
    if (n.mode === 'duduk' || n.mode === 'masuk') { lepasKursi(n); n.kursi = null; }
    n.a.mikro = null; n.a.lambai = null;
    if (k === 'peluk' || k === 'dansa') { n.mode = k; n.po = k === 'peluk' ? 6 : 10; n.t = k === 'peluk' ? 4.5 : 18; n.jarak = k === 'peluk' ? 0.34 : 0.48; return true; }
    if (k === 'cium') { n.mode = 'cium'; n.po = 15; n.t = 3; n.jarak = 0.3; hati(n); return true; }
    if (k === 'pangku') {                                 // NPC duduk menyamping di pangkuan pengunjung yang sedang duduk di kursi / sofa
      const D = FPS.duduk; if (!D || !D.id || D.lantai || D.baring || !D.mata) return false;
      n.pangku = { D, yaw: FPS.yaw, x: D.mata.x, z: D.mata.z, y: D.mata.y - 0.72 }; n.mode = 'pangku'; n.po = 16; hati(n); return true;
    }
    if (k === 'meringkuk' || k === 'bersandar') {         // peluk sambil berbaring / bersandar di dada: pengunjung harus sedang berbaring di ranjang
      const D = FPS.duduk; if (!D || !D.baring || !D.id) return false;
      const ks = kasurBareng(n, D, true, k === 'bersandar'); if (!ks) return false;
      ks.minta = true; ks.lama = 60; KURSI_DIPAKAI.add(ks.kunci); n.kursi = ks;
      FPS.yaw = Math.atan2(ks.wajah.x - D.mata.x, ks.wajah.z - D.mata.z); FPS.pitch = -0.25;   // pengunjung menoleh ke wajah NPC
      if ((n.mode === 'duduk' || n.mode === 'masuk') && Math.hypot(n.p.x - ks.x, n.p.z - ks.z) < 1.2) masukKursi(n);   // sudah rebahan di kasur ini: bergeser merapat
      else mulaiJalan(n, ks.q.x, ks.q.z, 'kursi');
      hati(n); return true;
    }
    if (k === 'baring') {                                 // rebahan di kasur terdekat; bila pengunjung sedang berbaring: di sisi lain kasurnya
      const D = FPS.duduk; let ks = D && D.baring && D.id ? kasurBareng(n, D) : null;
      for (let i = 0; i < 12 && !ks; i++) ks = cariKasur(n, true);   // sisi kasur dipilih acak; sisi yang menempel dinding dibuang
      if (!ks) return false;
      ks.minta = true; ks.lama = 45; KURSI_DIPAKAI.add(ks.kunci); n.kursi = ks; mulaiJalan(n, ks.q.x, ks.q.z, 'kursi'); return true;
    }
    if (k === 'gandeng') { n.mode = 'gandeng'; n.po = 7; n.a.sisi = -1; return true; }
    if (k === 'ikut') { n.mode = 'ikut'; n.po = 0; return true; }
    if (k === 'duduk') {
      const D = FPS.duduk; if (!D || !D.id || D.lantai || D.baring) return false;
      const lg = levelGroups[n.li], g = lg && lg.children.find(c => c.userData.kind === 'obj' && c.userData.id === D.id), S = g && g.userData.duduk; if (!S) return false;
      g.updateMatrixWorld(true);
      const arah = new THREE.Vector3(0, 0, 1).transformDirection(g.matrixWorld); arah.y = 0; arah.normalize();
      let best = null;
      for (let i = 0; i < (S.n || 1); i++) {
        const x = S.n > 1 ? ((i + 0.5) / S.n - 0.5) * S.w * 0.8 : 0, p = g.localToWorld(new THREE.Vector3(x, S.h, S.z || 0)), dd = Math.hypot(p.x - camera.position.x, p.z - camera.position.z);
        if (dd < 0.35) continue; if (!best || dd < best.dd) best = { p, dd };
      }
      if (!best) return false;
      const yaw = Math.atan2(arah.x, arah.z), kanan = { x: -Math.cos(yaw), z: Math.sin(yaw) }, sisi = (camera.position.x - best.p.x) * kanan.x + (camera.position.z - best.p.z) * kanan.z > 0 ? 1 : -1;
      const ks = { id: D.id, bareng: D.id, kunci: D.id + ':' + best.p.x.toFixed(1) + ':' + best.p.z.toFixed(1), s: { pos: best.p, arah }, q: { x: best.p.x + arah.x * 0.62, z: best.p.z + arah.z * 0.62 },
        x: best.p.x, z: best.p.z, y: best.p.y - 0.45, yaw, po: 8, sandar: sisi, lama: 30 };
      KURSI_DIPAKAI.add(ks.kunci); n.kursi = ks; mulaiJalan(n, ks.q.x, ks.q.z, 'kursi'); return true;
    }
    return false;
  }
  // gandeng: berjalan di sisi kanan pengunjung, menyamai arah pandangnya
  function ikut(n, dt, sampingM = 0.55, belakangM = 0) {
    const yaw = FPS.yaw, kx = -Math.cos(yaw), kz = Math.sin(yaw), tx = camera.position.x + kx * sampingM - Math.sin(yaw) * belakangM, tz = camera.position.z + kz * sampingM - Math.cos(yaw) * belakangM;
    const dx = tx - n.p.x, dz = tz - n.p.z, d = Math.hypot(dx, dz);
    if (d > 6) { diam(n, 1); return 0; }
    if (d < 0.04) { putarKe(n, yaw, dt, 4); return 0; }
    const v = Math.min(d * 9, 6), l = Math.min(d, v * dt);                     // cepat menyusul: tetap sejajar di samping, tidak tertinggal di belakang
    let [px, pz] = fpsResolveWalls(n.p.x + dx / d * l, n.p.z + dz / d * l, n.p.y);
    const t = tanahDi(n, px, pz); if (t != null && Math.abs(t - n.p.y) < 0.3) n.p.y = t; else { px = n.p.x; pz = n.p.z; }
    const maju = Math.hypot(px - n.p.x, pz - n.p.z); n.p.x = px; n.p.z = pz;
    putarKe(n, d > 0.4 ? Math.atan2(dx, dz) : yaw, dt, 5);
    return maju / Math.max(dt, 1e-4);
  }
  function turunPangku(n) {
    const P = n.pangku; n.pangku = null; if (!P) { diam(n, 1.5); return; }
    const [px, pz] = fpsResolveWalls(P.x + Math.sin(P.yaw) * 0.7, P.z + Math.cos(P.yaw) * 0.7, n.rumah ? n.rumah.y : P.y - 0.45);
    const t = tanahDi(n, px, pz); n.p.set(px, t != null ? t : (n.rumah ? n.rumah.y : P.y - 0.45), pz); n.yaw = P.yaw + Math.PI; diam(n, 2);
  }
  // hati kecil (ikon hati Lucide, ISC) yang melayang naik dari kepala NPC (cium / pangku)
  const HATI = []; let TEX_HATI = null;
  function hati(n) {
    if (!TEX_HATI) { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.scale(2.4, 2.4); x.translate(1, 1.5); x.fillStyle = '#ff6f91'; x.fill(new Path2D('M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5')); TEX_HATI = new THREE.CanvasTexture(c); }
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX_HATI, transparent: true, depthWrite: false }));
    s.scale.set(0.22, 0.22, 1); s.position.set(n.p.x, n.p.y + 1.75, n.p.z); s.userData.noExport = true; s.raycast = () => {};
    scene.add(s); HATI.push({ s, t: 0 });
  }
  // setelah cutscene kencan: NPC berdiri ±1,2 m di depan pengunjung, menghadapnya
  function hadirkan(id) {
    const n = NPC.get(id); if (!n || !n.a || !FPS.on || !n.mode) return false;
    if (n.mode === 'duduk' || n.mode === 'masuk') lepasKursi(n); n.kursi = null; n.pangku = null;
    const fx = Math.sin(FPS.yaw), fz = Math.cos(FPS.yaw);
    const [px, pz] = fpsResolveWalls(camera.position.x + fx * 1.2, camera.position.z + fz * 1.2, n.p.y), t = tanahDi(n, px, pz);
    n.p.set(px, t != null ? t : n.p.y, pz); n.yaw = Math.atan2(camera.position.x - px, camera.position.z - pz); diam(n, 4); n.menoleh = true; return true;
  }
  function langkahHati(dt) {
    for (let i = HATI.length - 1; i >= 0; i--) { const h = HATI[i]; h.t += dt; h.s.position.y += dt * 0.3; h.s.material.opacity = Math.max(0, 1 - h.t / 1.8);
      if (h.t > 1.8) { scene.remove(h.s); h.s.material.dispose(); HATI.splice(i, 1); } }
  }
  // peluk & dansa: berdiri ±0,4–0,5 m di depan pengunjung, menghadapnya
  function rapat(n, dt) {
    const fx = camera.position.x - n.p.x, fz = camera.position.z - n.p.z, d = Math.hypot(fx, fz) || 1, tx = camera.position.x - fx / d * n.jarak, tz = camera.position.z - fz / d * n.jarak;
    const l = Math.min(Math.hypot(tx - n.p.x, tz - n.p.z), 2.5 * dt), ax = tx - n.p.x, az = tz - n.p.z, al = Math.hypot(ax, az);
    if (al > 1e-4) { const [px, pz] = fpsResolveWalls(n.p.x + ax / al * l, n.p.z + az / al * l, n.p.y); n.p.x = px; n.p.z = pz; }
    putarKe(n, Math.atan2(fx, fz), dt, 4);
    if (d > 2.5) diam(n, 1);
    return 0;
  }
  // aktivitas.js: NPC yang sedang ikut berpindah ke titik di samping pengunjung, menghadap tempat aktivitas
  function temani(titik, hadap, po = 0) {
    const daftar = [];
    for (const n of NPC.values()) {
      if (!n.a || (n.mode !== 'ikut' && n.mode !== 'temani') || !n.p) continue;
      const i = daftar.length, x = titik.x + Math.cos(i * 1.3) * 0.5 * i, z = titik.z + Math.sin(i * 1.3) * 0.5 * i;
      n.mode = 'temani'; n.temani = { x, z, yaw: Math.atan2(hadap.x - x, hadap.z - z), po }; n.sorak = 0; daftar.push(n.id);
    }
    return daftar;
  }
  function selesaiTemani() { for (const n of NPC.values()) if (n.mode === 'temani') { if (n.dariApi) { n.dariApi = false; diam(n); } else { n.mode = 'ikut'; n.po = 0; } } }
  /* api unggun / perapian (aktivitas.js): NPC yang ikut, menemani, atau sedang santai ≤ 10 m datang duduk melingkari api
     (pose 25 menghangatkan tangan), di kiri-kanan pengunjung; yang tadinya santai kembali santai setelah selesai */
  function kumpulApi(pusat, r, sudutPengunjung, maks = 4) {
    const daftar = [], geser = [1.05, -1.05, 2.1, -2.1, 3.14];
    for (const n of NPC.values()) {
      if (daftar.length >= maks) break;
      if (!n.a || !n.p || !/^(ikut|temani|diam|jalan|aktivitas|duduk|masuk)$/.test(n.mode) || Math.hypot(n.p.x - pusat.x, n.p.z - pusat.z) > 10) continue;
      if (/^(duduk|masuk)$/.test(n.mode) && n.kursi && n.kursi.bareng) continue;   // sedang duduk / berbaring bersama pengunjung
      if (/^(jalan|duduk|masuk)$/.test(n.mode)) { lepasKursi(n); n.kursi = null; n.lanjut = null; const t = tanahDi(n, n.p.x, n.p.z); if (t != null) n.p.y = t; }
      const s = sudutPengunjung + geser[daftar.length], x = pusat.x + Math.sin(s) * r, z = pusat.z + Math.cos(s) * r;
      n.dariApi = !/^(ikut|temani)$/.test(n.mode); n.foto = false;
      n.mode = 'temani'; n.temani = { x, z, yaw: Math.atan2(pusat.x - x, pusat.z - z), po: 25 }; n.sorak = 0; daftar.push(n.id);
    }
    return daftar;
  }
  // main air (aktivitas.js): cipratan pengunjung mengenai NPC di depannya (≤ 3,5 m, ±40°) — NPC tertawa; yang berenang membalas
  function ciprat(x, z, fx, fz) {
    const kena = [];
    for (const n of NPC.values()) {
      if (!n.a || !n.p) continue; const dx = n.p.x - x, dz = n.p.z - z, d = Math.hypot(dx, dz);
      if (d > 3.5 || d < 0.05 || (dx * fx + dz * fz) / d < 0.75) continue;
      kena.push(n.id); gumam(n.id, 'Hahaha!', 'puji');
      if (n.mode === 'renang' && n.renang) { const id = n.id; setTimeout(() => balasCiprat(id), 900 + Math.random() * 500); }
      else n.a.mikro = { k: 'bahu', t: 0, d: 1.2 };
    }
    return kena;
  }
  function balasCiprat(id) {
    const n = NPC.get(id); if (!n || n.mode !== 'renang' || !n.renang || !n.a) return;
    n.cip = 1.1; setTimeout(() => { if (window.AKT && window.AKT.dicipratkan && NPC.get(id) === n && n.p) window.AKT.dicipratkan(n.p.x, n.p.z); }, 350);
  }
  /* FOTO (index.html, tombol kamera mode jalan): NPC yang tampak di bingkai (≤ 12 m, di depan kamera, sedang santai / berjalan)
     berhenti, menoleh ke kamera & berpose — ✌️ (22), tangan di pinggang (23), 🫶 (24), atau melambai (5) — selama `lama` detik */
  const POSE_FOTO = [22, 23, 24, 5];
  let FOTO_N = 0;
  function poseFoto(lama = 10) {
    if (!hidup()) return 0;
    camera.updateMatrixWorld(); const v = new THREE.Vector3(); let k = 0;
    for (const n of NPC.values()) {
      if (!n.a || !n.p || !/^(diam|jalan|aktivitas)$/.test(n.mode) || (n.mode === 'aktivitas' && n.po && n.po !== 3 && n.po !== 5 && !n.foto)) continue;
      if (Math.hypot(camera.position.x - n.p.x, camera.position.z - n.p.z) > 12) continue;
      v.set(n.p.x, n.p.y + 1.1, n.p.z).project(camera); if (v.z > 1 || Math.abs(v.x) > 0.95 || Math.abs(v.y) > 0.95) continue;
      if (n.mode === 'jalan') { lepasKursi(n); n.kursi = null; n.lanjut = null; }
      const po = POSE_FOTO[(benihAman(n.o) + FOTO_N + k) % POSE_FOTO.length];
      aktivitas(n, po, lama); n.foto = true; hadapPengunjung(n); n.a.lambai = null; k++;
    }
    FOTO_N++; return k;
  }
  function selesaiFoto() { for (const n of NPC.values()) if (n.foto && n.mode === 'aktivitas') n.t = Math.min(n.t, 1.2); }
  /* tombol kamera mode jalan: ketukan pertama — NPC di bingkai berpose & tombol berdenyut; ketukan kedua (≤ 10 dtk) memotret.
     Tanpa NPC di bingkai langsung memotret. Dua ketukan, karena berbagi ke galeri (navigator.share) harus tepat dari ketukan */
  let FOTO_SIAP = 0;
  function tombolFoto(potret) {
    const b = document.getElementById('fpsFoto');
    if (!document.getElementById('npcFotoGaya')) { const st = document.createElement('style'); st.id = 'npcFotoGaya';
      st.textContent = '#fpsFoto.siap{box-shadow:0 0 0 4px #ffd54a;animation:npcFoto 1s ease-in-out infinite}@keyframes npcFoto{50%{box-shadow:0 0 0 9px rgba(255,213,74,.35)}}@media (prefers-reduced-motion:reduce){#fpsFoto.siap{animation:none}}';
      document.head.appendChild(st); }
    if (FOTO_SIAP && performance.now() - FOTO_SIAP < 10000) { FOTO_SIAP = 0; b.classList.remove('siap'); const r = potret(); selesaiFoto(); return r; }
    const n = poseFoto(10);
    if (!n) { FOTO_SIAP = 0; b.classList.remove('siap'); return potret(); }
    FOTO_SIAP = performance.now(); b.classList.add('siap');
    setTimeout(() => { if (FOTO_SIAP && performance.now() - FOTO_SIAP >= 9900) { FOTO_SIAP = 0; b.classList.remove('siap'); } }, 10000);
    toast('📸 NPC berpose — ketuk kamera lagi untuk memotret');
    return null;
  }

  function sorak() { let i = 0; for (const n of NPC.values()) if (n.mode === 'temani' && n.a) { n.sorak = 1.8; window.LOBI.gerak.mulaiLambai(n.a); suaraSorak(n.id, 0.12 * i++); } }
  /* ---------- SUARA NPC: disintesis WebAudio (tanpa berkas) — gumaman saat bicara (suku kata pendek bergaya "Animal Crossing":
     nada dasar menurut karakter F / M & benih, vokal dari teks, lengkung nada menurut niat: tanya naik, puji / salam
     ceria, hina datar & rendah), sorakan "yay!" + tepuk tangan, dan "huft" (hembusan napas) saat kesal / menolak / mengantuk.
     Volume & kiri-kanan mengikuti jarak NPC dari pengunjung. Mode (tombol suara di obrolan): gumam (bawaan), tts, mati. */
  let MODE_SUARA = 'gumam'; try { const v = localStorage.getItem('npcSuara'); MODE_SUARA = v === '1' ? 'tts' : v === 'mati' ? 'mati' : 'gumam'; } catch (e) { MODE_SUARA = 'gumam'; }
  let AC = null, DERAU = null;
  const ac = () => { try { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) { AC = null; } return AC; };
  const FORMAN = { a: [800, 1200], i: [300, 2300], u: [350, 800], e: [500, 1900], o: [500, 900] };
  function nadaDasar(n) {                                              // Hz: F ± 300, M ± 150; ±8 % menurut benih
    const b = (benihAman(n.o) % 1000) / 1000 - 0.5;
    return (jenisAman(n.o.type) === 'M' ? 145 : 285) * (1 + 0.16 * b);
  }
  function keluaran(c, n, vol) {
    let v = vol;
    if (n && n.p && FPS.on) { const d = Math.hypot(camera.position.x - n.p.x, camera.position.z - n.p.z); if (d > 20) return null; v *= clamp(2 / Math.max(2, d), 0.08, 1); }
    const g = c.createGain(); g.gain.value = v;
    if (c.createStereoPanner && n && n.p && FPS.on) { const dx = n.p.x - camera.position.x, dz = n.p.z - camera.position.z, pn = c.createStereoPanner();
      pn.pan.value = clamp((-Math.cos(FPS.yaw) * dx + Math.sin(FPS.yaw) * dz) / Math.max(1, Math.hypot(dx, dz)), -0.8, 0.8); g.connect(pn).connect(c.destination); }
    else g.connect(c.destination);
    return g;
  }
  function suku(c, ke, t, dur, f0, f1, vokal, skala, vol) {          // satu suku kata: gelombang gergaji → dua formant → amplop
    const o = c.createOscillator(), g = c.createGain(), [F1, F2] = FORMAN[vokal] || FORMAN.a;
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f1, t + dur);
    for (const [f, q, a] of [[F1 * skala, 6, 1], [F2 * skala, 9, 0.55]]) { const bp = c.createBiquadFilter(), ga = c.createGain(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; ga.gain.value = a; o.connect(bp).connect(ga).connect(g); }
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(ke); o.start(t); o.stop(t + dur + 0.02);
  }
  function derau(c) { if (!DERAU) { const b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; DERAU = b; } const s = c.createBufferSource(); s.buffer = DERAU; s.loop = true; return s; }
  // gumaman: kembalikan lama (detik) agar "huft" bisa menyusul
  function gumam(id, teks, niat) {
    const n = NPC.get(id), c = MODE_SUARA === 'gumam' && ac(); if (!c || !n || !n.o) return 0;
    const bersih = String(teks || '').replace(/\*[^*]*\*/g, ' ').replace(/[\u{1F000}-\u{1FFFF}\u2600-\u27BF]/gu, '').trim(); if (!bersih) return 0;
    const ke = keluaran(c, n, 0.32); if (!ke) return 0;
    const f = nadaDasar(n) * (niat === 'hina' ? 0.86 : niat === 'puji' || niat === 'salam' ? 1.08 : 1), skala = jenisAman(n.o.type) === 'M' ? 1 : 1.15;
    const vok = (bersih.toLowerCase().match(/[aiueo]/g) || ['a', 'e', 'o']), tanya = /\?\s*$/.test(bersih), n0 = clamp(Math.round(bersih.replace(/\s+/g, '').length / 2.6), 2, 28);
    let t = c.currentTime + 0.03, j = 0;
    const jeda = []; bersih.replace(/[.,!?…;:]/g, (m, i) => { jeda.push(Math.round(i / bersih.length * n0)); return m; });
    for (let i = 0; i < n0; i++) {
      const dur = 0.07 + Math.random() * 0.045, akhir = i === n0 - 1, u = i / Math.max(1, n0 - 1);
      const kontur = niat === 'hina' ? 1 - 0.06 * u : tanya && akhir ? 1.28 : 1 + 0.1 * Math.sin(i * 1.7 + u * 2) + (niat === 'puji' ? 0.12 * u : 0);
      const f0 = f * kontur * (0.94 + Math.random() * 0.12);
      suku(c, ke, t, dur, f0, f0 * (tanya && akhir ? 1.25 : 0.97), vok[j++ % vok.length], skala, 0.9);
      t += dur + 0.012 + Math.random() * 0.02 + (jeda.includes(i + 1) ? 0.14 : 0);
    }
    return t - c.currentTime;
  }
  // sorakan: "ye-aay!" naik + tiga tepukan
  function suaraSorak(id, tunda = 0) {
    const n = NPC.get(id), c = MODE_SUARA !== 'mati' && ac(); if (!c || !n || !n.o) return;
    const ke = keluaran(c, n, 0.4); if (!ke) return;
    const f = nadaDasar(n) * 1.15, skala = jenisAman(n.o.type) === 'M' ? 1 : 1.15, t = c.currentTime + 0.03 + tunda;
    suku(c, ke, t, 0.13, f, f * 1.1, 'e', skala, 0.9); suku(c, ke, t + 0.14, 0.38, f * 1.2, f * 1.55, 'a', skala, 1);
    for (let i = 0; i < 3; i++) { const s = derau(c), bp = c.createBiquadFilter(), g = c.createGain(), tt = t + 0.1 + i * 0.13;
      bp.type = 'bandpass'; bp.frequency.value = 1400 + Math.random() * 600; bp.Q.value = 1.2; g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.7, tt + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.06);
      s.connect(bp).connect(g).connect(ke); s.start(tt, Math.random() * 0.5); s.stop(tt + 0.08); }
  }
  // "huft": hembusan napas — derau melewati filter yang turun, diawali "hu" bersuara pelan, diakhiri desis "ft"
  function huft(id, tunda = 0) {
    const n = NPC.get(id), c = MODE_SUARA !== 'mati' && ac(); if (!c || !n || !n.o) return;
    const ke = keluaran(c, n, 0.45); if (!ke) return;
    const t = c.currentTime + 0.03 + tunda, s = derau(c), lp = c.createBiquadFilter(), g = c.createGain();
    lp.type = 'bandpass'; lp.Q.value = 0.9; lp.frequency.setValueAtTime(1600, t); lp.frequency.exponentialRampToValueAtTime(420, t + 0.55);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55, t + 0.09); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.62);
    s.connect(lp).connect(g).connect(ke); s.start(t, Math.random() * 0.3); s.stop(t + 0.65);
    suku(c, ke, t + 0.01, 0.16, nadaDasar(n) * 0.82, nadaDasar(n) * 0.72, 'u', jenisAman(n.o.type) === 'M' ? 1 : 1.15, 0.18);
    const s2 = derau(c), hp = c.createBiquadFilter(), g2 = c.createGain(), t2 = t + 0.6;
    hp.type = 'highpass'; hp.frequency.value = 4200; g2.gain.setValueAtTime(0.0001, t2); g2.gain.exponentialRampToValueAtTime(0.35, t2 + 0.01); g2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.09);
    s2.connect(hp).connect(g2).connect(ke); s2.start(t2, Math.random() * 0.3); s2.stop(t2 + 0.1);
  }
  // NPC dalam jarak tertentu dari pengunjung (bonus kedekatan saat beraktivitas di dekatnya)
  const dekat = r => [...NPC.values()].filter(n => n.a && n.p && Math.hypot(n.p.x - camera.position.x, n.p.z - camera.position.z) <= r).map(n => n.id);
  /* ---------- BERENANG (JEV-113) ---------- geometri kolam dari modul aktivitas (window.AKT.kolam) */
  function adaKolam(n) {
    const lv = PROJECT.levels[n.li], ada = !!lv && lv.objects.some(o => o.kind === 'area' && (o.params || {}).jenis === 'kolam_renang');
    if (ada && !window.AKT) muatModul('aktivitas').catch(() => {});
    return ada && !!window.AKT;
  }
  function kolamDekat(n) {
    const K = window.AKT && window.AKT.kolam, lv = PROJECT.levels[n.li]; if (!K || !lv) return null;
    let best = null;
    for (const o of lv.objects) {
      if (o.kind !== 'area' || (o.params || {}).jenis !== 'kolam_renang') continue;
      const A = K.air(o), t = A && K.tepi(A.poli, n.p.x, n.p.z); if (!t) continue;
      const q = { x: t.x + t.nx * 0.45, z: t.z + t.nz * 0.45 }, d = Math.hypot(q.x - n.rumah.x, q.z - n.rumah.z);
      if (d > n.jelajah + 3 || (best && d >= best.d) || !jalurBebas(n, q.x, q.z)) continue;
      best = { poli: A.poli, airY: A.airY, q, d };
    }
    return best;
  }
  function masukKolam(n, K, bareng) {
    const Ka = window.AKT && window.AKT.kolam, p = Ka && Ka.keDalam(K.poli, n.p.x, n.p.z, 0.4); n.kolamTuju = null;
    if (!p) { diam(n, 1); return false; }
    lepasKursi(n); n.kursi = null; n.pangku = null; n.a.mikro = null; n.a.lambai = null;
    n.renang = { poli: K.poli, airY: K.airY, bareng: !!bareng, tuju: null, jeda: 0, t: bareng ? Infinity : 25 + Math.random() * 25 };
    n.mode = 'renang'; n.po = 17; n.p.set(p.x, K.airY, p.z);
    if (Math.hypot(camera.position.x - p.x, camera.position.z - p.z) < 25) Ka.cebur(new THREE.Vector3(p.x, K.airY, p.z));
    pakaiBaju(n, true);
    return true;
  }
  function keluarKolam(n) {
    const R = n.renang, K = window.AKT && window.AKT.kolam; n.renang = null; pakaiBaju(n, false);
    const t = R && K && K.tepi(R.poli, n.p.x, n.p.z);
    if (t) { const x = t.x + t.nx * 0.5, z = t.z + t.nz * 0.5; n.p.set(x, R.airY + 0.15, z); const g = tanahDi(n, x, z); if (g != null) n.p.y = g; n.yaw = Math.atan2(t.nx, t.nz); }
    else if (n.rumah) n.p.copy(n.rumah);
    if (R && R.bareng && FPS.on) { n.mode = 'ikut'; n.po = 0; } else diam(n, 2);
  }
  function renang(n, dt) {
    const R = n.renang, K = window.AKT && window.AKT.kolam; if (!R || !K) { keluarKolam(n); return; }
    let tx = n.p.x, tz = n.p.z;
    if (R.bareng) {                                       // di samping-belakang pengunjung
      if (!window.AKT.renang()) { keluarKolam(n); return; }
      const yaw = FPS.yaw; tx = camera.position.x - Math.cos(yaw) * 1.1 - Math.sin(yaw) * 0.5; tz = camera.position.z + Math.sin(yaw) * 1.1 - Math.cos(yaw) * 0.5;
      if (!K.dalam(R.poli, tx, tz, 0.35)) { const p = K.keDalam(R.poli, tx, tz, 0.35); if (p) { tx = p.x; tz = p.z; } }
    } else {
      R.t -= dt; if (R.t <= 0) { keluarKolam(n); return; }
      if (R.jeda > 0) R.jeda -= dt;
      else if (!R.tuju || Math.hypot(R.tuju.x - n.p.x, R.tuju.z - n.p.z) < 0.3) {
        if (R.tuju && Math.random() < 0.35) { R.jeda = 1.5 + Math.random() * 3; R.tuju = null; }
        else for (let i = 0; i < 14; i++) { const a = Math.random() * Math.PI * 2, r = 1.2 + Math.random() * 4, x = n.p.x + Math.sin(a) * r, z = n.p.z + Math.cos(a) * r;
          if (K.dalam(R.poli, x, z, 0.45)) { R.tuju = { x, z }; break; } }
      }
      if (R.tuju && R.jeda <= 0) { tx = R.tuju.x; tz = R.tuju.z; }
    }
    const dx = tx - n.p.x, dz = tz - n.p.z, d = Math.hypot(dx, dz);
    let v = 0;
    if (d > 0.25) {
      v = R.bareng ? Math.min(d * 1.4, 1.9) : 0.9;
      const px = n.p.x + dx / d * v * dt, pz = n.p.z + dz / d * v * dt;
      if (K.dalam(R.poli, px, pz, 0.3)) { n.p.x = px; n.p.z = pz; } else { v = 0; if (R.tuju) R.tuju = null; }
      putarKe(n, Math.atan2(dx, dz), dt, 2.5);
    } else if (R.bareng) putarKe(n, FPS.yaw, dt, 1.5);
    n.p.y = R.airY; n.po = v > 0.2 ? 18 : 17;
    // main air: membalas / sesekali lebih dulu mencipratkan air ke pengunjung yang berenang di dekatnya (pose 21, menghadapnya)
    if (R.bareng && !(n.cip > 0) && Math.random() < dt * 0.02 && Math.hypot(camera.position.x - n.p.x, camera.position.z - n.p.z) < 3) balasCiprat(n.id);
    if (n.cip > 0) { n.cip -= dt; n.po = 21; putarKe(n, Math.atan2(camera.position.x - n.p.x, camera.position.z - n.p.z), dt, 5); }
  }
  /* POTRET untuk ilustrasi (kencan): klon model karakter dengan bahan berwarna NPC ini, diberi pose, dirender sendirian ke
     kanvas transparan memakai renderer yang sama (render target, keadaan renderer dikembalikan). cahaya: {kunci, isi, tepi}
     warna; arah: sudut pandang kamera dari depan (rad); bingkai + periode: daftar kanvas satu putaran animasi (napas, gerak
     pose) untuk diputar berulang. Gagal → null (ilustrasi tetap tampil tanpa tokoh). */
  function potret(id, po = 0, opsi = {}) {
    const n = NPC.get(id); if (!n || !n.a || !n.a.tpl || !n.a.model || !window.LOBI) return null;
    const w = opsi.w || 480, h = opsi.h || 560, G = window.LOBI.gerak;
    try {
      const m = klonModel(n.a.tpl); m.userData.rigIdx = n.a.tpl.userData.rigIdx; m.userData.kedipIdx = []; m.userData.klip = [];
      const asli = []; n.a.model.traverse(x => { if (x.isMesh) asli.push(x.material); }); let i = 0;
      m.traverse(x => { if (x.isMesh) { if (asli[i]) x.material = asli[i]; i++; x.frustumCulled = false; } });
      const sc = new THREE.Scene(), g = new THREE.Group(); g.add(m); sc.add(g);
      const a = { g, tuju: { po }, sisi: 1 }; G.siapkanGerak(a, m);
      a.tm = a.lt = 1e9;                                      // tanpa gerak kecil / lirikan acak: putaran animasi bisa berulang mulus
      for (let k = 0; k < 70; k++) G.gerakAvatar(a, 0.05, 0);
      g.updateMatrixWorld(true);
      const kepala = a.rig && a.rig.head ? a.rig.head.b.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, 1.45, 0);
      const C = opsi.cahaya || {};
      sc.add(new THREE.HemisphereLight(C.isi || 0xdfe6ff, 0x3a3030, 0.38));
      const kunci = new THREE.DirectionalLight(C.kunci || 0xffffff, 0.72); kunci.position.set(-1.5, 2.5, 2.5); sc.add(kunci);
      const tepi = new THREE.DirectionalLight(C.tepi || 0xaac4ff, 0.35); tepi.position.set(2, 1.8, -2.5); sc.add(tepi);
      const arah = opsi.arah != null ? opsi.arah : 0.38, jarak = opsi.jarak || 2.6, turun = opsi.turun != null ? opsi.turun : 0.32;
      const cam = new THREE.PerspectiveCamera(30, w / h, 0.05, 20);
      cam.position.set(kepala.x + Math.sin(arah) * jarak, kepala.y - 0.05, kepala.z + Math.cos(arah) * jarak); cam.lookAt(kepala.x, kepala.y - turun, kepala.z);
      const rt = new THREE.WebGLRenderTarget(w, h); rt.texture.encoding = THREE.sRGBEncoding;
      const lama = renderer.getRenderTarget(), cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha(), ac = renderer.autoClear, tm = renderer.toneMapping, ek = renderer.toneMappingExposure;
      renderer.toneMapping = THREE.NoToneMapping; renderer.toneMappingExposure = 1;   // eksposur otomatis adegan (mis. malam) tidak ikut: kulit (bahan tanpa cahaya) tidak memutih
      const px = new Uint8Array(w * h * 4), hasil = [], N = Math.max(1, Math.min(32, opsi.bingkai | 0 || 1)), dt = (opsi.periode || 3.7) / N;
      try {
        for (let f = 0; f < N; f++) {
          // bingkai animasi: satu putaran napas / gerak pose dibagi rata (bingkai > 1)
          if (f) { G.gerakAvatar(a, dt, 0); g.updateMatrixWorld(true); }
          renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.autoClear = true; renderer.clear(); renderer.render(sc, cam);
          renderer.readRenderTargetPixels(rt, 0, 0, w, h, px);
          const kan = document.createElement('canvas'); kan.width = w; kan.height = h; const x = kan.getContext('2d'), im = x.createImageData(w, h);
          for (let y = 0; y < h; y++) im.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);   // WebGL membaca dari bawah
          x.putImageData(im, 0, 0); hasil.push(kan);
        }
      } finally { renderer.setRenderTarget(lama); renderer.setClearColor(cc, ca); renderer.autoClear = ac; renderer.toneMapping = tm; renderer.toneMappingExposure = ek; rt.dispose(); }
      return opsi.bingkai ? hasil : hasil[0];
    } catch (e) { console.warn('potret NPC', e); return null; }
  }
  // aktivitas.js: pengunjung masuk kolam → NPC yang ikut / menemani / bergandengan ikut berenang
  function renangBareng(poli, airY) {
    const ids = [];
    for (const n of NPC.values()) if (n.a && n.p && /^(ikut|temani|gandeng)$/.test(n.mode) && masukKolam(n, { poli, airY }, true)) ids.push(n.id);
    return ids;
  }
  function selesaiRenang() { for (const n of NPC.values()) if (n.mode === 'renang' && n.renang && n.renang.bareng) keluarKolam(n); }
  function putarKe(n, yaw, dt, laju = 3) { const d = sudut(yaw - n.yaw); n.yaw += clamp(d, -laju * dt, laju * dt); return Math.abs(d); }
  function jalan(n, dt) {
    const dx = n.tuju.x - n.p.x, dz = n.tuju.z - n.p.z, d = Math.hypot(dx, dz);
    if (d < 0.18) { if (n.lanjut === 'kursi') masukKursi(n); else if (n.lanjut === 'renang' && n.kolamTuju) masukKolam(n, n.kolamTuju); else diam(n); return 0; }
    const beda = putarKe(n, Math.atan2(dx, dz), dt);
    let v = beda > 1 ? 0 : n.laju * (d < 0.6 ? Math.max(0.35, d / 0.6) : 1) * (1 - beda * 0.5);
    // pengunjung / NPC lain di depan: tunggu sebentar, lalu cari tujuan lain
    const fx = Math.sin(n.yaw), fz = Math.cos(n.yaw), halang = (x, z, r) => { const ax = x - n.p.x, az = z - n.p.z, j = Math.hypot(ax, az); return j < r && (ax * fx + az * fz) / Math.max(j, 1e-6) > 0.4; };
    let tutup = FPS.on && !(n.kursi && n.kursi.bareng) && halang(camera.position.x, camera.position.z, 0.95);   // diajak duduk bareng: pengunjung bukan penghalang
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
    if (n.renang) { n.renang = null; pakaiBaju(n, false); }
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
  // berbaring telentang di kasur yang sama dengan pengunjung (JEV-127): masing-masing satu sisi, tidak saling menumpuk —
  // NPC yang sudah rebahan di tengah lalu pengunjung ikut berbaring, atau diajak berbaring bareng. Pengunjung bergeser ke sisi
  // yang kosong (mata ikut), NPC meluncur ke sisi lainnya; jarak antarbadan ≥ 0,6 m
  function rapikanBaring() {
    const D = FPS.on && FPS.duduk && FPS.duduk.baring; if (!D || !FPS.duduk.id) return;
    for (const n of NPC.values()) {
      const k = n.kursi; if (!k || k.id !== FPS.duduk.id || k.po !== 9 || k.rapi === D || !/^(masuk|duduk)$/.test(n.mode)) continue;
      const lg = levelGroups[n.li], g = lg && lg.children.find(c => c.userData.kind === 'obj' && c.userData.id === k.id), o = PROJECT.levels[n.li] && PROJECT.levels[n.li].objects.find(x => x.id === k.id);
      if (!g) return; g.updateMatrixWorld(true); const R = rangkaKasur(g, o); if (!R) return;
      const j = Math.max(0.3, Math.min(R.w / 4, 0.45)), ki = R.titik(-j, 0, -0.05), ka = R.titik(j, 0, -0.05);
      const s = Math.hypot(k.x - ki.x, k.z - ki.z) < Math.hypot(k.x - ka.x, k.z - ka.z) ? -1 : 1, tn = s < 0 ? ki : ka, tp = s < 0 ? ka : ki;
      Object.assign(k, { x: tn.x, y: tn.y, z: tn.z, rapi: D });                 // sekali per kali pengunjung berbaring
      if (n.mode === 'duduk') masukKursi(n);                                 // sudah rebahan: meluncur ke sisinya
      const dx = tp.x - D.x, dz = tp.z - D.z; D.x = tp.x; D.z = tp.z; FPS.duduk.mata.x += dx; FPS.duduk.mata.z += dz;
      return;
    }
  }
  function langkah(dt) {
    if (HATI.length) langkahHati(Math.min(dt, 0.1));
    if (!NPC.size) return;
    dt = Math.min(dt, 0.1);
    rapikanBaring();
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
        n.t -= dt; if (n.foto) hadapPengunjung(n); if (n.yawTuju != null && (n.po === 5 || n.foto)) putarKe(n, n.yawTuju, dt, n.foto ? 4 : 2.5);
        if (n.t <= 0) { n.a.mikro = null; n.foto = false; diam(n); }
      } else if (n.mode === 'gandeng') laju = ikut(n, dt);
      else if (n.mode === 'renang') renang(n, dt);
      else if (n.mode === 'ikut') { laju = ikut(n, dt, 0.8, 0.9); if (laju < 0.05 && Math.random() < dt * 0.05) n.a.mikro = { k: pilih(Math.random, ['regang', 'bahu']), t: 0, d: 2 }; }
      else if (n.mode === 'temani') {                       // menemani aktivitas pengunjung (aktivitas.js): ke titik di sebelahnya, lalu menonton / duduk
        const T = n.temani, dx = T.x - n.p.x, dz = T.z - n.p.z, d = Math.hypot(dx, dz);
        if (d > 0.08) { const l = Math.min(d, 2.4 * dt); const [px, pz] = fpsResolveWalls(n.p.x + dx / d * l, n.p.z + dz / d * l, n.p.y); laju = Math.hypot(px - n.p.x, pz - n.p.z) / Math.max(dt, 1e-4); n.p.x = px; n.p.z = pz; putarKe(n, Math.atan2(dx, dz), dt, 5); n.po = 0; }
        else { putarKe(n, T.yaw, dt, 3); n.po = n.sorak > 0 ? 3 : T.po; }
        if (n.sorak > 0) n.sorak -= dt;
      }
      else if (n.mode === 'peluk' || n.mode === 'dansa' || n.mode === 'cium') { rapat(n, dt); n.t -= dt; if (n.t <= 0) diam(n, 2); }
      else if (n.mode === 'pangku') {
        const P = n.pangku;
        if (FPS.duduk !== P.D) turunPangku(n);          // pengunjung berdiri: NPC turun ke depan kursi
        else { const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw), kx = -Math.cos(P.yaw), kz = Math.sin(P.yaw);
          n.p.set(P.x + fx * 0.3 + kx * 0.1, P.y - 0.3, P.z + fz * 0.3 + kz * 0.1); n.yaw = P.yaw + Math.PI / 2; n.yawTuju = null; n.po = 16; }
      }
      else if (n.mode === 'ngobrol') {
        if (FPS.on) { hadapPengunjung(n); putarKe(n, n.yawTuju, dt, 3); }
      } else if (n.mode === 'masuk') {
        const k = n.kursi; n.t = Math.min(1, n.t + dt / 0.7); const e = n.t * n.t * (3 - 2 * n.t);
        n.p.set(n.dari.x + (k.x - n.dari.x) * e, n.dari.y + (k.y - n.dari.y) * e, n.dari.z + (k.z - n.dari.z) * e);
        putarKe(n, n.yawTuju, dt, 5);
        if (n.t >= 1) { n.mode = 'duduk'; n.t = k.lama || 10 + Math.random() * 14; }
      } else if (n.mode === 'duduk') {
        if (n.kursi && n.kursi.bareng && FPS.duduk && FPS.duduk.id === n.kursi.bareng) n.t = Math.max(n.t, 3 + Math.random() * 3);   // menemani selama pengunjung masih duduk
        if (!n.obrol) n.t -= dt; if (n.t <= 0) { const k = n.kursi; n.mode = 'keluar'; n.t = 0; n.dari = { x: n.p.x, y: n.p.y, z: n.p.z }; n.po = 0; n.ke = { x: k.q.x, z: k.q.z, y: n.rumah.y }; }
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
    const ba = el('button', 'btn sm', '🎲 Acak penampilan'); ba.onclick = () => { d.params.benih = Math.floor(Math.random() * 4294967296); delete d.params.warna; HIST.label = 'Acak penampilan NPC'; rebuildScene(); renderInspector(); };
    ins.appendChild(ba);
    penyunting(ins, d, k => { HIST.label = k === 'baju' ? 'Pakaian NPC' : 'Warna NPC'; rebuildScene(); renderInspector(); });
    const KN = window.KARTU_NPC;
    if (KN) {
      fRow(ins, 'Kepribadian', selInput([['', 'Otomatis'], ...KN.URUT.map(k => [k, KN.KARTU[k].nama + ' — ' + KN.KARTU[k].peran[BAHASA.kode === 'id' ? 'id' : 'en']])], typeof d.params.kartu === 'string' && KN.KARTU[d.params.kartu] ? d.params.kartu : '',
        v => { if (v) d.params.kartu = v; else delete d.params.kartu; HIST.label = 'Kepribadian NPC'; rebuildScene(); renderInspector(); }));
      const nm = document.createElement('input'); nm.type = 'text'; nm.maxLength = 30; nm.value = typeof d.params.nama === 'string' ? d.params.nama : '';
      const kk = KN.KARTU[d.params.kartu] || KN.KARTU[KN.URUT[benihAman(d) % 5 % 4]]; nm.placeholder = kk.nama;
      nm.onchange = () => { const v = nm.value.trim().slice(0, 30); if (v) d.params.nama = v; else delete d.params.nama; HIST.label = 'Nama NPC'; rebuildScene(); };
      fRow(ins, 'Nama', nm);
    } else muatModul('kartunpc').then(() => { if (window.KARTU_NPC) renderInspector(); }, () => {});
    fRow(ins, 'Jelajah (m)', numInput(jelajahAman(d), 0.5, v => { d.params.jelajah = clamp(v, 0, 15); rebuildScene(); }, 0, 15));
    ins.appendChild(el('p', 'hint', 'Di mode jalan NPC berjalan-jalan dalam radius ini dari tempatnya, duduk di kursi / sofa terdekat, duduk di lantai, joget, mengantuk & melambai. 0 = tetap di tempat. Di mode jalan bidik lalu Ngobrol untuk bercakap (kepribadian & ingatan per NPC), atau Sapa.'));
    const bd = el('button', 'btn sm ghost', '🩺 Diagnosa tampilan'); bd.title = 'Bila NPC tidak terlihat di perangkat ini'; bd.onclick = () => { periksa(); tampilDiagnosa(); }; ins.appendChild(bd);
    ins.appendChild(el('div', 'section-title', 'Penempatan'));
    addTransformFields(ins, d, false);
  }
  const jumlah = () => PROJECT.levels.reduce((s, l) => s + l.objects.filter(o => o.kind === 'npc').length, 0);
  window.NPC = { pasang, langkah, sapa, ngobrol, aksiPasangan, temani, selesaiTemani, kumpulApi, ciprat, poseFoto, selesaiFoto, tombolFoto, sorak, dekat, renang: renangBareng, selesaiRenang, potret, ekstra: id => { const n = NPC.get(id); return n && (/^(gandeng|dansa|ikut|temani|pangku)$/.test(n.mode) || (n.mode === 'duduk' && n.kursi && n.kursi.minta)) ? ['lepas'] : []; },
    warnaiAvatar, penyunting, warnaAman, bajuAman, hadirkan,
    suara: { gumam, sorak: suaraSorak, huft, mode: m => { if (m) MODE_SUARA = m; return MODE_SUARA; } }, hati: id => { const n = NPC.get(id); if (n && n.p) hati(n); },
    pasangan: () => { for (const n of NPC.values()) if (n.a && (/^(gandeng|dansa|peluk|cium|pangku|ikut|temani)$/.test(n.mode) || (n.mode === 'duduk' && n.kursi && n.kursi.minta))) return n.id; return null; }, penampilan, jumlah, inspektor, MAKS, siapkan: k => muatTpl(jenisAman(k)).catch(() => {}), keadaan: id => { const n = NPC.get(id); return n && { mode: n.mode, po: n.po, p: n.p && n.p.clone(), siap: !!n.a, kursi: n.kursi && n.kursi.id }; },
    diagnosa, periksa, aman: () => AMAN,
    _uji: { NPC, mulaiJalan, aktivitas, berikutnya, cariKursi, cariKasur, kolamDekat: id => kolamDekat(NPC.get(id)), masukKolam: (id, K) => masukKolam(NPC.get(id), K), bajuRenang, diPerabot: (id, x, z) => diPerabot(NPC.get(id), x, z), ujiGambar, ujiDanPerbaiki: () => { UJI_T = -1e9; ujiDanPerbaiki(); }, perbaikan: () => PERBAIKI, simpan: () => SIMPAN.size } };
})();
