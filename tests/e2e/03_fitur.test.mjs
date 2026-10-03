import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { FIX, CORS, buatDenah } from './harness.mjs';

export const tes = {
  'tracing: alas denah dibersihkan saat mulai ulang / tambah lantai': async (page) => {
    await buatDenah(page);
    const n = () => page.evaluate(() => helperRoot.children.filter(c => c.userData.alasDenah).length);
    await page.evaluate(() => mulaiTraceVoid(null));
    assert.equal(await n(), 1);
    await page.evaluate(() => mulaiTraceVoid(null));
    assert.equal(await n(), 1, 'alas lama tertinggal saat tracing dimulai ulang');
    await page.evaluate(() => addLevel(false));
    assert.equal(await n(), 0, 'alas tertinggal setelah tambah lantai');
    assert.equal(await page.evaluate(() => TOOL), 'select');
  }
};

// Poly Haven tiruan — sandbox/CI tidak boleh bergantung pada internet
const hdr = fs.readFileSync(path.join(FIX, 'langit_sintetis.hdr'));
tes['langit 360°: HDRI dimuat, matahari dari foto, fallback offline'] = async (page) => {
  await page.evaluate(() => { langitP().jenis = 'gunung'; langitP().mode = 'foto'; muatLangitFoto(); });
  await page.waitForFunction(() => FOTO.tex && !FOTO.sibuk, undefined, { timeout: 30000 });
  const r = await page.evaluate(() => ({ id: FOTO.id, sun: sun.userData.arah.toArray(), env: scene.environment === LANGIT_FOTO_ENV }));
  assert.equal(r.id, 'gunung_siang');
  // matahari sintetis: u=0.25, elevasi 35° → (0, 0.574, -0.819)
  assert.ok(Math.abs(r.sun[0]) < 0.02 && Math.abs(r.sun[1] - 0.574) < 0.02 && Math.abs(r.sun[2] + 0.819) < 0.02, 'arah matahari ' + r.sun);
  assert.ok(r.env);
  await page.evaluate(() => matikanLangitFoto());
  assert.equal(await page.evaluate(() => !!LANGIT_FOTO_ENV), false);
};
tes['langit 360°: HDRI dimuat, matahari dari foto, fallback offline'].opsi = { rute: async (page) => {
  await page.route('https://api.polyhaven.com/**', r => {
    const u = r.request().url();
    if (u.includes('/assets')) return r.fulfill({ json: { gunung_siang: { name: 'Gunung', categories: ['outdoor', 'nature', 'midday'], tags: ['mountain'] } }, headers: CORS });
    return r.fulfill({ json: { hdri: { '4k': { hdr: { url: 'https://dl.polyhaven.org/x/gunung_siang.hdr' } } } }, headers: CORS });
  });
  await page.route('https://dl.polyhaven.org/**', r => r.fulfill({ body: hdr, headers: CORS }));
} };

tes['galeri fotogrametri: glTF + bin + tekstur dikemas jadi GLB & dipasang'] = async (page) => {
  await page.evaluate(() => bukaGaleri());
  await page.waitForFunction(() => document.querySelectorAll('.gl-card').length > 0);
  await page.locator('.gl-card').first().click();
  await page.waitForFunction(() => !GALERI.sibuk && /dipasang|Gagal/.test(document.getElementById('galeriInfo').textContent), undefined, { timeout: 20000 });
  const r = await page.evaluate(() => {
    const id = Object.keys(PROJECT.assets)[0]; let tex = null;
    ASSET_OBJ.get(id)?.traverse(m => { if (m.isMesh && m.material.map) tex = m.material.map.image.width; });
    return { info: document.getElementById('galeriInfo').textContent, dims: PROJECT.assets[id]?.dims, tex, obj: L().objects.some(o => o.kind === 'model') };
  });
  assert.match(r.info, /dipasang/);
  assert.deepEqual(r.dims, [0.5, 0.9, 0.5]);
  assert.equal(r.tex, 256);
  assert.ok(r.obj);
};
tes['galeri fotogrametri: glTF + bin + tekstur dikemas jadi GLB & dipasang'].opsi = { rute: async (page) => {
  const B = 'https://dl.polyhaven.org/file/ph-assets/Models/';
  await page.route('https://api.polyhaven.com/**', r => {
    if (r.request().url().includes('/assets')) return r.fulfill({ json: { kursi: { name: 'Wooden Chair', categories: ['furniture'], tags: ['chair'] } }, headers: CORS });
    return r.fulfill({ json: { gltf: { '1k': { gltf: { url: B + 'kursi_1k.gltf', size: 1114, include: {
      'kursi.bin': { url: B + 'kursi.bin', size: 768 }, 'textures/kursi_diff_1k.jpg': { url: B + 'kursi_diff_1k.jpg', size: 9143 } } } } } }, headers: CORS });
  });
  await page.route('https://dl.polyhaven.org/**', r => r.fulfill({ body: fs.readFileSync(path.join(FIX, r.request().url().split('/').pop())), headers: CORS }));
  await page.route('https://cdn.polyhaven.com/**', r => r.fulfill({ body: fs.readFileSync(path.join(FIX, 'kursi_diff_1k.jpg')), headers: { 'content-type': 'image/jpeg' } }));
} };
