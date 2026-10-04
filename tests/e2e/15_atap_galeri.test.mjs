import assert from 'node:assert/strict';
import { CORS } from './harness.mjs';

// JEV-064: (1) plat atap tertutup menaungi SEMUA bagian bangunan yang terbuka ke langit — termasuk
// lantai bawah yang lebih luas dari lantai atas; (2) galeri model menjelajah semua kategori yang
// bisa diunduh gratis, tanpa kata kunci, dengan Muat lebih banyak
const kotak = (x0, z0, x1, z1) => [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]]
  .map(([a, b, c, d]) => ({ x1: a, z1: b, x2: c, z2: d }));
const uid = c => c.repeat(32);
const model = (c, nama, tags = [], suka = 0) => ({ uid: uid(c), name: nama, user: { displayName: 'P' + c }, license: { label: 'CC Attribution' },
  likeCount: suka, tags: tags.map(t => ({ slug: t })), thumbnails: { images: [] } });

export const tes = {
  'atap tertutup: lantai bawah yang lebih luas dari lantai atas tetap beratap (tidak tembus langit)': async (page) => {
    const r = await page.evaluate(kt => {
      const isi = k => k.map(w => ({ id: uid('w'), ...w, thickness: 0.15, openings: [] }));
      PROJECT.levels[0].walls = isi(kt[0]); PROJECT.levels[0].objects = [];
      addLevel();
      PROJECT.levels[1].walls = isi(kt[1]); PROJECT.levels[1].objects = [];
      toggleAtap(true); rebuildScene(); scene.updateMatrixWorld(true);
      const atap = (x, z, y) => { const h = new THREE.Raycaster(new THREE.Vector3(x, y, z), new THREE.Vector3(0, 1, 0)).intersectObjects(worldRoot.children, true)
        .filter(i => i.object.userData.atap)[0];
        if (!h) return null; let o = h.object; while (o && o.userData.levelIndex === undefined) o = o.parent; return { y: +h.point.y.toFixed(2), lantai: o.userData.levelIndex }; };
      const r = { teras: atap(8, 6, 1.5), bawahLt2: atap(2, 2, 1.5), lt2: atap(2, 2, 4.8) };
      toggleAtap(false); rebuildScene(); scene.updateMatrixWorld(true);
      r.terbuka = atap(8, 6, 1.5); return r;
    }, [kotak(0, 0, 10, 8), kotak(0, 0, 4, 4)]);
    assert.deepEqual(r.teras, { y: 3.2, lantai: 0 }, 'bagian lantai 1 di luar lantai 2 harus beratap sendiri');
    assert.equal(r.bawahLt2.lantai, 1, 'di bawah lantai 2 tidak ada atap ganda di lantai 1');
    assert.equal(r.lt2.lantai, 1);
    assert.equal(r.terbuka, null, 'atap dibuka → tidak ada atap');
  },
  'galeri Sketchfab: jelajah tanpa kata kunci, kategori lengkap, Muat lebih banyak': async (page) => {
    const diminta = [];
    await page.route('https://api.sketchfab.com/**', r => {
      const u = new URL(r.request().url()); diminta.push(u.search);
      const tag = u.searchParams.get('tags'), hal = u.searchParams.get('cursor');
      if (hal === '2') return r.fulfill({ headers: CORS, json: { results: [model('c', 'Lampu Kedua'), model('a', 'Duplikat')], next: null } });
      if (tag) return r.fulfill({ headers: CORS, json: { results: [], next: null } });
      return r.fulfill({ headers: CORS, json: { results: [model('a', 'Kursi', [], 9), model('b', 'Rak', ['photogrammetry'], 1)],
        next: 'https://api.sketchfab.com/v3/search?type=models&downloadable=true&cursor=2' } });
    });
    await page.evaluate(() => bukaGaleri());
    await page.selectOption('#galeriSumber', 'skf');
    await page.waitForFunction(() => document.querySelectorAll('#galeriGrid .gl-card').length === 2, undefined, { timeout: 30000 });
    assert.ok(diminta.some(q => !/[?&]q=/.test(q) && !/tags=/.test(q)), 'tanpa kata kunci tetap mencari: ' + JSON.stringify(diminta));
    const chip = await page.$$eval('#galeriRuang button', bs => bs.map(b => b.dataset.ruang));
    for (const k of ['tidur', 'duduk', 'mandi', 'dapur', 'lampu', 'meja', 'simpan', 'dekor', 'tanaman', 'luar', 'elektronik', 'kendaraan']) assert.ok(chip.includes(k), 'kategori ' + k);
    await page.click('#galeriGrid .gl-lagi');
    await page.waitForFunction(() => document.querySelectorAll('#galeriGrid .gl-card').length === 3, undefined, { timeout: 30000 });
    assert.equal(await page.$('#galeriGrid .gl-lagi'), null, 'tidak ada halaman lagi → tombol hilang');
    assert.ok(diminta.some(q => q.includes('cursor=2')));
    // kategori → kata kunci
    diminta.length = 0;
    await page.locator('#galeriRuang button[data-ruang="lampu"]').click();
    await page.waitForFunction(() => document.querySelectorAll('#galeriGrid .gl-card').length >= 1, undefined, { timeout: 30000 });
    assert.ok(diminta.some(q => /q=lamp(&|$)/.test(q)), JSON.stringify(diminta));
  },
  'galeri Google Scanned Objects & Poly Haven: Muat lebih banyak sampai habis': async (page) => {
    await page.route('https://fuel.gazebosim.org/**', r => {
      const u = new URL(r.request().url()), hal = +u.searchParams.get('page');
      if (u.pathname.endsWith('.jpg')) return r.fulfill({ status: 404, body: '' });
      const n = hal === 1 ? 40 : 7;
      return r.fulfill({ headers: CORS, json: Array.from({ length: n }, (_, i) => ({ name: `Benda_${hal}_${i}` })) });
    });
    await page.evaluate(() => bukaGaleri());
    await page.selectOption('#galeriSumber', 'gso');
    await page.waitForFunction(() => document.querySelectorAll('#galeriGrid .gl-card').length === 40, undefined, { timeout: 30000 });
    await page.click('#galeriGrid .gl-lagi');
    await page.waitForFunction(() => document.querySelectorAll('#galeriGrid .gl-card').length === 47, undefined, { timeout: 30000 });
    assert.equal(await page.$('#galeriGrid .gl-lagi'), null);
    // Poly Haven: daftar lokal ditampilkan bertahap 160 demi 160
    const n = await page.evaluate(() => { GALERI.daftar = Array.from({ length: 200 }, (_, i) => ({ id: 'aset_' + i, nama: 'Aset ' + i, kat: ['furniture'], tag: [] }));
      GALERI.sumber = 'ph'; GALERI.cari = ''; GALERI.ruang = ''; GALERI.kat = 'semua'; GALERI.batas = 160; renderGaleri();
      const a = document.querySelectorAll('#galeriGrid .gl-card').length; document.querySelector('#galeriGrid .gl-lagi').click();
      return [a, document.querySelectorAll('#galeriGrid .gl-card').length, !!document.querySelector('#galeriGrid .gl-lagi')]; });
    assert.deepEqual(n, [160, 200, false]);
  },
};
