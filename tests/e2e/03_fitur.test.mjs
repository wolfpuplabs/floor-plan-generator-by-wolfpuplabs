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

// JEV-048: panorama dipilih sendiri (urutan tetap), bukan acak
const DAFTAR_PL = {
  gunung_c: { name: 'Gunung C', categories: ['outdoor', 'nature', 'midday'], tags: ['mountain'] },
  gunung_a: { name: 'Gunung A', categories: ['outdoor', 'nature', 'midday'], tags: ['mountain'] },
  gunung_b: { name: 'Gunung B', categories: ['outdoor', 'nature', 'midday'], tags: ['mountain'] },
  gunung_malam: { name: 'Gunung Malam', categories: ['outdoor', 'nature', 'night'], tags: ['mountain'] }
};
const unduhan = [];
const ruteLangit = async (page) => {
  unduhan.length = 0;
  await page.route('https://api.polyhaven.com/**', r => {
    const u = r.request().url();
    if (u.includes('/assets')) return r.fulfill({ json: DAFTAR_PL, headers: CORS });
    const id = u.split('/files/')[1];
    const f = res => ({ hdr: { url: `https://dl.polyhaven.org/x/${id}_${res}.hdr` } });
    return r.fulfill({ json: { hdri: { '1k': f('1k'), '4k': f('4k') } }, headers: CORS });
  });
  await page.route('https://dl.polyhaven.org/**', r => { unduhan.push(r.request().url().split('/x/')[1]); return r.fulfill({ body: hdr, headers: CORS }); });
  await page.route('https://cdn.polyhaven.com/**', r => r.fulfill({ body: fs.readFileSync(path.join(FIX, 'kursi_diff_1k.jpg')), headers: { 'content-type': 'image/jpeg' } }));
};
const tungguId = (page, id) => page.waitForFunction(id => FOTO.id === id && !FOTO.sibuk, id, { timeout: 30000 });

tes['langit 360°: pilih sendiri — ◀ ▶ berurutan, galeri, daftar, tidak diacak'] = async (page) => {
  await page.evaluate(() => { localStorage.clear(); caches.delete('langit360-v1'); langitP().jenis = 'gunung'; });
  assert.equal(await page.evaluate(() => langitP().pilih), 'manual', 'bawaan harus pilih sendiri');
  await page.evaluate(() => mulaiLangitFoto());
  await tungguId(page, 'gunung_a');                                   // urutan nama, waktu cocok dulu
  assert.deepEqual(unduhan.slice(0, 2), ['gunung_a_1k.hdr', 'gunung_a_4k.hdr'], 'pratinjau 1K harus dimuat sebelum 4K');
  await page.evaluate(() => langkahLangit(1)); await tungguId(page, 'gunung_b');
  await page.evaluate(() => langkahLangit(1)); await tungguId(page, 'gunung_c');
  await page.evaluate(() => langkahLangit(-1)); await tungguId(page, 'gunung_b');
  await page.evaluate(() => langkahLangit(-1)); await page.evaluate(() => langkahLangit(-1));
  await tungguId(page, 'gunung_malam');                               // memutar ke ujung daftar (waktu lain di belakang)
  // ganti suasana dalam mode pilih sendiri: panorama TIDAK diganti diam-diam
  await page.evaluate(() => langkahLangit(1)); await tungguId(page, 'gunung_a');
  await page.evaluate(() => setSuasana('malam')); await page.waitForTimeout(800);
  assert.equal(await page.evaluate(() => FOTO.id), 'gunung_a');
  await page.evaluate(() => setSuasana('siang'));
  // daftar dropdown
  await page.evaluate(() => { const s = document.getElementById('langitDaftar'); s.value = 'gunung_c'; s.dispatchEvent(new Event('change')); });
  await tungguId(page, 'gunung_c');
  // galeri bergambar
  await page.evaluate(() => bukaPilihLangit());
  await page.waitForFunction(() => document.querySelectorAll('#plGrid .gl-card').length === 3);   // waktu siang tersaring
  assert.equal(await page.evaluate(() => document.querySelector('#plGrid .gl-card.on')?.dataset.id), 'gunung_c');
  await page.locator('#plGrid .gl-card[data-id="gunung_b"]').click();
  await tungguId(page, 'gunung_b');
  assert.equal(await page.evaluate(() => document.getElementById('pilihLangit').hidden), true);
  // sakelar acak: barulah suasana boleh mengganti panorama
  await page.evaluate(() => { const c = document.getElementById('langitAcakCek'); c.checked = true; c.dispatchEvent(new Event('change')); setSuasana('malam'); });
  await tungguId(page, 'gunung_malam');
  // preferensi diingat
  const pr = await page.evaluate(() => JSON.parse(localStorage.getItem('langitPref')));
  assert.equal(pr.id, 'gunung_malam'); assert.equal(pr.pilih, 'acak');
};
tes['langit 360°: pilih sendiri — ◀ ▶ berurutan, galeri, daftar, tidak diacak'].opsi = { rute: ruteLangit };

// JEV-054: model produk nyata (Khronos glTF Sample Assets) — unduhan dikunci SHA-256
const glbUji = async (page) => {
  // GLB kecil dari fixture glTF + satu lampu KHR_lights_punctual (harus dibuang saat impor)
  const gltf = JSON.parse(fs.readFileSync(path.join(FIX, 'kursi_1k.gltf'), 'utf8'));
  gltf.extensionsUsed = ['KHR_lights_punctual'];
  gltf.extensions = { KHR_lights_punctual: { lights: [{ type: 'point', intensity: 5 }] } };
  gltf.nodes.push({ name: 'lampuBawaan', extensions: { KHR_lights_punctual: { light: 0 } } });
  gltf.scenes[0].nodes.push(1);
  const bin = fs.readFileSync(path.join(FIX, 'kursi.bin')).toString('base64');
  const jpg = fs.readFileSync(path.join(FIX, 'kursi_diff_1k.jpg')).toString('base64');
  const b64 = await page.evaluate(([gltf, bin, jpg]) => {
    const isi = { 'kursi.bin': new Uint8Array(bufFromB64(bin)), 'textures/kursi_diff_1k.jpg': new Uint8Array(bufFromB64(jpg)) };
    return b64FromBuf(gltfKeGLB(gltf, uri => /^data:/.test(uri) ? dataURIkeU8(uri) : isi[uri]));
  }, [gltf, bin, jpg]);
  return Buffer.from(b64, 'base64');
};
tes['produk nyata: unduhan terverifikasi SHA-256, kredit lisensi, interaksi bawaan, lampu bawaan dibuang'] = async (page) => {
  const glb = await glbUji(page);
  let rusak = false;
  await page.route('https://cdn.jsdelivr.net/gh/**', r => {
    const u = r.request().url();
    if (u.endsWith('.jpg')) return r.fulfill({ body: fs.readFileSync(path.join(FIX, 'kursi_diff_1k.jpg')), headers: { ...CORS, 'content-type': 'image/jpeg' } });
    const isi = Buffer.from(glb); if (rusak) isi[isi.length - 1] ^= 0xff;     // satu bita diubah di perjalanan
    return r.fulfill({ body: isi, headers: CORS });
  });
  const sha = await page.evaluate(async b64 => sha256Hex(bufFromB64(b64)), glb.toString('base64'));
  await page.evaluate(([sha, n]) => {
    KATALOG_PRODUK.push({ id: 'KursiUji', nama: 'Kursi uji', kat: 'Sofa & kursi', lisensi: 'CC-BY 4.0 — Uji', sha, b: n, p: { interaksi: 'duduk', tinggiDuduk: 0.45 } });
    GALERI.sumber = 'khr'; document.getElementById('galeriSumber').value = 'khr'; bukaGaleri();
  }, [sha, glb.length]);
  assert.ok(await page.locator('#galeriGrid .gl-card[data-id="KursiUji"]').count() === 1, 'kartu produk tidak tampil');
  assert.ok(await page.locator('#galeriGrid .gl-card').count() >= 14, 'katalog produk kurang lengkap');
  await page.locator('#galeriGrid .gl-card[data-id="KursiUji"]').click();
  await page.waitForFunction(() => !GALERI.sibuk && /dipasang|Gagal/.test(document.getElementById('galeriInfo').textContent), undefined, { timeout: 20000 });
  const r = await page.evaluate(() => {
    const id = Object.keys(PROJECT.assets).find(k => PROJECT.assets[k].name === 'Kursi uji'), a = PROJECT.assets[id];
    const o = L().objects.find(x => x.type === id); let lampu = 0; ASSET_OBJ.get(id).traverse(n => { if (n.isLight) lampu++; });
    const B = sanitasiProyek(JSON.parse(JSON.stringify(PROJECT)));
    return { info: document.getElementById('galeriInfo').textContent, sumber: a.sumber, lisensi: a.lisensi, interaksi: o && o.params.interaksi,
      jenis: o && findGroup('obj', o.id).userData.nyalaJenis, lampu, sumberTersimpan: B.assets[id] && B.assets[id].sumber, lisensiTersimpan: B.assets[id] && B.assets[id].lisensi };
  });
  assert.match(r.info, /dipasang/);
  assert.match(r.sumber, /^https:\/\/github\.com\/KhronosGroup\/glTF-Sample-Assets\/tree\/[0-9a-f]{40}\/Models\/KursiUji$/);
  assert.equal(r.lisensi, 'CC-BY 4.0 — Uji');
  assert.equal(r.interaksi, 'duduk');
  assert.equal(r.jenis, 'duduk');
  assert.equal(r.lampu, 0, 'lampu bawaan glTF harus dibuang');
  assert.equal(r.sumberTersimpan, r.sumber, 'sumber harus lolos sanitasi saat proyek disimpan/dimuat');
  assert.equal(r.lisensiTersimpan, r.lisensi);
  // berkas diubah di perjalanan → ditolak, tidak ada aset baru
  rusak = true;
  const n0 = await page.evaluate(() => Object.keys(PROJECT.assets).length);
  await page.evaluate(() => { document.getElementById('galeriInfo').textContent = ''; });
  await page.locator('#galeriGrid .gl-card[data-id="KursiUji"]').click();
  await page.waitForFunction(() => !GALERI.sibuk && /dipasang|Gagal/.test(document.getElementById('galeriInfo').textContent), undefined, { timeout: 20000 });
  assert.match(await page.textContent('#galeriInfo'), /SHA-256/);
  assert.equal(await page.evaluate(() => Object.keys(PROJECT.assets).length), n0, 'berkas rusak tidak boleh masuk pustaka');
};
