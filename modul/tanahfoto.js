/* Plan23D — TANAH FOTO ASLI (JEV-092)
   Tanah situs, area & cat tanah memakai tekstur foto Poly Haven (CC0): peta warna, normal &
   kekasaran 1K, dipilih otomatis dari katalog tekstur mereka menurut kata kunci (rumput, tanah,
   kerikil, paving, batu) — yang paling banyak diunduh, bukan foto udara. Berkas disimpan di Cache
   Storage (ambilCache) jadi dibuka ulang tanpa mengunduh lagi. Gambar foto MENGGANTIKAN isi tekstur
   prosedural yang sama, sehingga semua bahan yang memakainya (tanah, area, campuran cat) ikut
   berubah tanpa membangun ulang adegan. Luring / gagal → tekstur prosedural tetap dipakai. */
/* global DECOTEX, teksturSitus, unduhTeksturPH, ambilCache, bayangKotor */
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

  window.TANAHFOTO = { pasang, lengkapi, info: jenis => DATA.get(jenis) || null };
})();
