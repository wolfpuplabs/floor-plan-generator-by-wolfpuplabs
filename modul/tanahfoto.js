/* Plan23D — TANAH & KAYU FOTO ASLI (JEV-092, JEV-094)
   Tanah situs, area & cat tanah memakai tekstur foto Poly Haven (CC0): peta warna, normal &
   kekasaran 1K, dipilih otomatis dari katalog tekstur mereka menurut kata kunci (rumput, tanah,
   kerikil, paving, batu) — yang paling banyak diunduh, bukan foto udara. Berkas disimpan di Cache
   Storage (ambilCache) jadi dibuka ulang tanpa mengunduh lagi. Gambar foto MENGGANTIKAN isi tekstur
   prosedural yang sama, sehingga semua bahan yang memakainya (tanah, area, campuran cat) ikut
   berubah tanpa membangun ulang adegan. Luring / gagal → tekstur prosedural tetap dipakai. */
/* global DECOTEX, teksturSitus, unduhTeksturPH, ambilCache, bayangKotor, MAT, uvMetrik, rebuildScene */
(function () {
  'use strict';
  // kata kunci per jenis; foto udara (skala puluhan meter) dan salju/pasir tidak cocok untuk halaman rumah
  const KATA = { rumput: /\b(grass|lawn)/, tanah: /\b(soil|dirt|mud|forest ground|ground)/, kerikil: /\bgravel/, paving: /\b(paving|pavement|cobble)/, batu: /\b(rock|rocks|stone ground|rocky)/ };
  const TOLAK = /aerial|snow|sand|beach|moss_wall|wall|plaster|brick|roof|tiles?_|leaves_wall/;
  const UKURAN = { rumput: 2, tanah: 1.5, kerikil: 1.2, paving: 2, batu: 1.8 };   // meter per ulangan prosedural (matSitus)
  const DATA = new Map(), JANJI = new Map();
  let daftar = null;

  async function katalog() {
    if (daftar) return daftar;
    const b = await ambilCache('https://api.polyhaven.com/assets?t=textures');
    const j = JSON.parse(await b.text());
    daftar = Object.entries(j).filter(([id]) => /^[a-z0-9_]{1,80}$/.test(id)).map(([id, a]) => ({
      id, teks: (String(a.name || '') + ' ' + [].concat(a.tags || [], a.categories || []).join(' ')).toLowerCase(),
      kat: [].concat(a.categories || []).map(String), unduh: +a.download_count || 0, dim: Array.isArray(a.dimensions) ? a.dimensions : null }));
    return daftar;
  }
  async function pilih(jenis) {
    const d = await katalog(), re = KATA[jenis];
    const calon = d.filter(a => re.test(a.teks) && !TOLAK.test(a.id) && !/aerial/.test(a.teks));
    calon.sort((a, b) => (b.kat.includes('terrain') - a.kat.includes('terrain')) || (b.unduh - a.unduh));
    return calon[0] || null;
  }
  // normal & kekasaran foto dipasang di bahan tanah jenis ini (dipanggil juga saat bahan baru dibuat)
  function lengkapi(m, jenis) {
    const d = DATA.get(jenis); if (!d || !m) return;
    if (d.normal) { m.normalMap = d.normal; m.normalScale = new THREE.Vector2(1, 1); }
    if (d.kasar) { m.roughnessMap = d.kasar; m.roughness = 1; }
    m.needsUpdate = true;
  }
  function pasang(jenis) {
    if (!KATA[jenis]) return Promise.resolve(false);
    if (JANJI.has(jenis)) return JANJI.get(jenis);
    const p = (async () => {
      const a = await pilih(jenis); if (!a) return false;
      const t = await unduhTeksturPH(a.id, '1k');
      // ukuran asli fotonya (mm) bila ada → skala ulangan; prosedural memakai UKURAN[jenis] meter
      const m = a.dim && +a.dim[0] > 0 ? Math.min(8, Math.max(0.5, a.dim[0] / 1000)) : UKURAN[jenis], r = UKURAN[jenis] / m;
      const tx = teksturSitus(jenis);
      tx.image = t.peta.image; tx.format = THREE.RGBFormat; tx.repeat.set(r, r); tx.needsUpdate = true;
      for (const x of [t.normal, t.kasar]) if (x) { x.repeat.set(r, r); x.needsUpdate = true; }
      DATA.set(jenis, { id: a.id, normal: t.normal || null, kasar: t.kasar || null });
      for (const k of ['m_situs_' + jenis, 'm_situs_cat_' + jenis]) lengkapi(DECOTEX.get(k), jenis);
      bayangKotor();
      return true;
    })().catch(e => { console.warn('tanah foto', jenis, e); return false; });
    JANJI.set(jenis, p);
    return p;
  }

  /* PERABOT (JEV-094): bahan kayu polos katalog (perabot, pintu, kusen) memakai foto kayu Poly Haven —
     terang & gelap. Mesh yang memakainya diberi UV per meter (uvMetrik) supaya serat tidak meregang
     mengikuti ukuran tiap muka. Kain & marmer sudah bertekstur sendiri, tidak diganti. */
  const KAYU = [{ mat: ['wood', 'door'], suka: /veneer|fine|table|oak|plywood|beech|birch|light/ },
    { mat: ['woodDark', 'frame'], suka: /dark|walnut|mahogany|brown/ }];
  const BUANG_KAYU = /floor|plank|bark|log|pallet|fence|paint|rough|old|worn|shutter|door|wall|roof|crate|branch|burnt|chip|board/;
  const METRIK = new WeakMap(), FOTO = new Set();
  let janjiKayu = null;
  async function pilihKayu(suka, kecuali) {
    const d = await katalog();
    const c = d.filter(a => (a.kat.includes('wood') || /\bwood/.test(a.teks)) && !BUANG_KAYU.test(a.id) && a.id !== kecuali);
    c.sort((a, b) => (suka.test(b.teks) - suka.test(a.teks)) || (b.unduh - a.unduh));
    return c[0] || null;
  }
  function kayu() {
    if (janjiKayu) return janjiKayu;
    janjiKayu = (async () => {
      let lalu = null, n = 0;
      for (const k of KAYU) {
        const a = await pilihKayu(k.suka, lalu); if (!a) continue; lalu = a.id;
        const t = await unduhTeksturPH(a.id, '1k'), u = 1 / 0.8;                 // satu ulangan ±80 cm
        t.peta.encoding = THREE.sRGBEncoding;
        for (const x of [t.peta, t.normal, t.kasar]) if (x) { x.repeat.set(u, u); x.needsUpdate = true; }
        for (const nm of k.mat) { const m = MAT[nm]; if (!m) continue;
          m.map = t.peta; m.color.setHex(0xffffff);
          if (t.normal) { m.normalMap = t.normal; m.normalScale = new THREE.Vector2(0.8, 0.8); }
          if (t.kasar) { m.roughnessMap = t.kasar; m.roughness = 1; }
          m.needsUpdate = true; FOTO.add(m); n++; }
      }
      if (n) rebuildScene();                                       // UV per meter dipasang lewat uv() di rebuildScene
      return n > 0;
    })().catch(e => { console.warn('kayu foto', e); return false; });
    return janjiKayu;
  }
  function uv(akar) {
    if (!FOTO.size) return;
    akar.traverse(m => {
      if (!m.isMesh || m.isInstancedMesh || !m.geometry || m.geometry.userData.metrik) return;
      if (![].concat(m.material).some(b => FOTO.has(b))) return;
      let g = METRIK.get(m.geometry);
      if (!g) { g = m.geometry.clone(); if (!g.attributes.normal) g.computeVertexNormals(); uvMetrik(g); METRIK.set(m.geometry, g); }
      m.geometry = g;
    });
  }

  window.TANAHFOTO = { pasang, lengkapi, info: jenis => DATA.get(jenis) || null, kayu, uv, kayuSiap: () => FOTO.size > 0 };
})();
