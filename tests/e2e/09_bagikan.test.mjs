import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { FIX, CORS, bukaApp, muatProyekJSON } from './harness.mjs';

// JEV-058: tautan lihat-saja — proyek di fragmen URL, model katalog sebagai rujukan,
// penerima bisa jalan-jalan tetapi tidak bisa mengedit; isi tautan disanitasi
const rutePH = async (page) => {
  const B = 'https://dl.polyhaven.org/file/ph-assets/Models/';
  await page.route('https://api.polyhaven.com/**', r => {
    if (r.request().url().includes('/assets')) return r.fulfill({ json: { kursi: { name: 'Wooden Chair', categories: ['furniture'], tags: ['chair'] } }, headers: CORS });
    return r.fulfill({ json: { gltf: { '1k': { gltf: { url: B + 'kursi_1k.gltf', size: 1114, include: {
      'kursi.bin': { url: B + 'kursi.bin', size: 768 }, 'textures/kursi_diff_1k.jpg': { url: B + 'kursi_diff_1k.jpg', size: 9143 } } } } } }, headers: CORS });
  });
  await page.route('https://dl.polyhaven.org/**', r => r.fulfill({ body: fs.readFileSync(path.join(FIX, r.request().url().split('/').pop())), headers: CORS }));
  await page.route('https://cdn.polyhaven.com/**', r => r.fulfill({ body: fs.readFileSync(path.join(FIX, 'kursi_diff_1k.jpg')), headers: { 'content-type': 'image/jpeg' } }));
};
// viewport kecil: dua rumah dirender dengan WebGL software di CI — ukuran tidak diuji di sini
const iPad = { viewport: { width: 1000, height: 700 } };

export const tes = {
  'bagikan: penerima bisa jalan-jalan, model katalog diunduh ulang, tidak bisa mengedit': async (page, ctx) => {
    // pengirim: satu ruangan berperabot + model Poly Haven (rujukan) + model unggahan sendiri (ditinggal).
    // Ruangan kecil, bukan rumah contoh: tiap aksi Playwright menunggu frame, dan WebGL software
    // butuh detik per frame untuk rumah penuh perabot.
    await muatProyekJSON(page, { name: 'Ruang uji', levels: [{ name: 'L1', height: 3, walls: [
      { x1: -3, z1: -3, x2: 3, z2: -3, openings: [{ id: 'o1', type: 'door', at: 3, width: 0.9, sill: 0, head: 2.1 }] }, { x1: 3, z1: -3, x2: 3, z2: 3 }, { x1: 3, z1: 3, x2: -3, z2: 3 }, { x1: -3, z1: 3, x2: -3, z2: -3 }],
      objects: [{ id: 'sofa', kind: 'furn', type: 'sofa3', x: 0, y: 0, z: -2.4, rotY: 0, params: {} }, { id: 'lampu', kind: 'furn', type: 'pendant', x: 0, y: 0, z: 0, rotY: 0, params: {} }] }] });
    await page.evaluate(() => bukaGaleri());
    await page.waitForFunction(() => document.querySelectorAll('#galeriGrid .gl-card').length > 0);
    await page.locator('#galeriGrid .gl-card').first().click();
    await page.waitForFunction(() => !GALERI.sibuk && /dipasang|Gagal/.test(document.getElementById('galeriInfo').textContent), undefined, { timeout: 20000 });
    await page.evaluate(async () => {
      document.getElementById('galeri').hidden = true;
      const sumber = Object.values(PROJECT.assets)[0];
      const r = await daftarkanAset('Model sendiri', bufFromB64(sumber.data));     // tanpa sumber → tidak bisa dirujuk
      L().objects.push({ id: 'mSendiri', kind: 'model', type: r.id, x: 0, y: 0, z: 0, rotY: 0, sx: 1, sy: 1, sz: 1, params: {} });
      rebuildScene();
    });
    await page.click('.tabs button[data-tab="file"]');
    await page.click('#bagikanBtn');
    await page.waitForFunction(() => /#lihat=/.test(document.getElementById('bagikanUrl').value));
    const kirim = await page.evaluate(() => ({ url: document.getElementById('bagikanUrl').value, info: document.getElementById('bagikanInfo').textContent,
      dinding: L().walls.length, objek: L().objects.length }));
    assert.match(kirim.info, /Model sendiri/, 'model unggahan yang ditinggal harus disebut');
    assert.ok(kirim.url.length < 4000, 'tautan harus ringkas: ' + kirim.url.length);
    // dua halaman WebGL software sekaligus saling berebut CPU (halaman kedua butuh > 30 s
    // hanya untuk menjalankan skripnya) — halaman pengirim dikosongkan dulu
    await page.goto('about:blank');

    // penerima: halaman baru dari tautan
    const b = await bukaApp(page.context().browser(), kirim.url, { ...iPad, rute: rutePH });
    const p = b.page;
    try {
      await p.waitForFunction(() => LIHAT.siap, undefined, { timeout: 60000 });
      const r = await p.evaluate(() => ({ lihat: document.body.classList.contains('lihat'), nama: document.getElementById('lihatNama').textContent,
        dinding: L().walls.length, objek: L().objects.length, model: L().objects.filter(o => o.kind === 'model').map(o => o.id),
        dimuat: Object.values(PROJECT.assets).filter(a => ASSET_OBJ.size).map(a => a.sumber),
        sidebar: getComputedStyle(document.getElementById('sidebar')).display, toolbar: getComputedStyle(document.getElementById('toolbar')).display,
        lihatBar: !document.getElementById('lihatBar').hidden }));
      assert.equal(r.lihat, true);
      assert.equal(r.nama, 'Ruang uji');
      assert.equal(r.dinding, kirim.dinding);
      assert.equal(r.objek, kirim.objek - 1, 'objek dari model sendiri tidak ikut');
      assert.ok(!r.model.includes('mSendiri'));
      assert.deepEqual(r.dimuat, ['https://polyhaven.com/a/kursi'], 'model Poly Haven harus diunduh ulang dari rujukan');
      assert.equal(r.sidebar, 'none'); assert.equal(r.toolbar, 'none'); assert.equal(r.lihatBar, true);
      // tidak bisa mengedit: pilih, tambah, hapus, urung, pintasan alat
      const e = await p.evaluate(() => {
        const n0 = L().objects.length, id = L().objects[0].id;
        select('obj', id); addObject('furn', 'sofa3'); deleteSelection(); setTool('wall'); addLevel(false); undo();
        return { sel: SEL, n: L().objects.length === n0, tool: TOOL, lantai: PROJECT.levels.length, plus: [...document.querySelectorAll('#levelbar button')].some(b => b.textContent === '+') };
      });
      assert.deepEqual(e, { sel: null, n: true, tool: 'select', lantai: 1, plus: false });
      await p.keyboard.press('l'); await p.keyboard.press('Delete'); await p.keyboard.press('Control+z');
      assert.equal(await p.evaluate(() => TOOL), 'select');
      assert.equal(await p.evaluate(() => L().objects.length), r.objek);
      // jalan-jalan boleh
      await p.click('#lihatJalan');
      assert.equal(await p.evaluate(() => FPS.on), true);
      assert.deepEqual(b.log.galat, []);
    } finally { await p.close(); }
  },
  'bagikan: tautan rusak / bom kompresi ditolak tanpa merusak aplikasi': async (page) => {
    const dasar = page.url().split('#')[0];
    const kode = await page.evaluate(async () => {
      const bom = b64url(await padatkan(' '.repeat(25 * 1048576)));            // 25 MB spasi → ±25 KB terkompresi
      const jahat = b64url(await padatkan(JSON.stringify({ name: '<img src=x onerror=alert(1)>', levels: [{ name: 'L', walls: [{ x1: 0, z1: 0, x2: 1e30, z2: 'x' }], objects: [] }] })));
      return { bom, jahat };
    });
    await page.goto('about:blank');                                           // lihat catatan di tes pertama
    const buka = async (hash) => {
      const b = await bukaApp(page.context().browser(), dasar + '#lihat=' + hash, iPad);
      await b.page.waitForFunction(() => LIHAT.siap, undefined, { timeout: 60000 });
      const r = await b.page.evaluate(() => ({ toast: document.getElementById('toast').textContent, nama: document.getElementById('lihatNama').innerHTML,
        dinding: L().walls.map(w => [w.x2, w.z2]), img: document.querySelectorAll('#lihatBar img').length }));
      const galat = b.log.galat; await b.page.close(); return { ...r, galat };
    };
    const bom = await buka(kode.bom);
    assert.match(bom.toast, /tidak bisa dibuka.*melebihi/);
    const rusak = await buka('%%%rusak');
    assert.match(rusak.toast, /tidak bisa dibuka/);
    const jahat = await buka(kode.jahat);
    assert.equal(jahat.img, 0, 'nama proyek tidak boleh menjadi HTML');
    assert.ok(jahat.dinding.every(([x, z]) => Number.isFinite(x) && Math.abs(x) <= 1e4 && Number.isFinite(z)), 'angka liar harus disaring: ' + JSON.stringify(jahat.dinding));
    for (const r of [bom, rusak, jahat]) assert.deepEqual(r.galat, []);
  }
};
for (const t of Object.values(tes)) t.opsi = { ...iPad, rute: rutePH };
