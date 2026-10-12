import assert from 'node:assert/strict';
import { CORS } from './harness.mjs';

// JEV-091: info berkas 3D sebelum diunduh, batalkan unduhan, tekstur galeri 2K tajam tapi dikompres

const produkUji = page => page.evaluate(() => {
  KATALOG_PRODUK.push({ id: 'LampuUji', nama: 'Lampu uji', kat: 'Lampu', lisensi: 'CC0 — Uji', sha: '0'.repeat(64), b: 3 * 1048576, p: { interaksi: 'lampu' } });
  GALERI.sumber = 'khr'; document.getElementById('galeriSumber').value = 'khr'; bukaGaleri();
});

export const tes = {
  'galeri: kartu membuka info berkas dulu (ukuran, lisensi, interaksi) — Batal tidak mengunduh apa pun': async (page) => {
    let diminta = 0;
    await page.route('https://cdn.jsdelivr.net/gh/**', r => { if (!r.request().url().endsWith('.jpg')) diminta++; return r.fulfill({ body: '', headers: CORS }); });
    await produkUji(page);
    await page.locator('#galeriGrid .gl-card[data-id="LampuUji"]').click();
    await page.waitForSelector('#galeriDetail:not([hidden]) .gd-tombol');
    const r = await page.evaluate(() => ({ teks: $('#galeriDetail').textContent, sibuk: GALERI.sibuk, aset: Object.keys(PROJECT.assets).length }));
    assert.match(r.teks, /Lampu uji/);
    assert.match(r.teks, /3[.,]0 MB/);
    assert.match(r.teks, /CC0 — Uji/);
    assert.match(r.teks, /SHA-256/);
    assert.match(r.teks, /2048 px/);
    assert.deepEqual([r.sibuk, r.aset], [false, 0]);
    await page.locator('#galeriDetail .gd-tombol .btn.ghost').click();
    assert.equal(await page.evaluate(() => $('#galeriDetail').hidden), true);
    assert.equal(diminta, 0, 'tanpa menekan Unduh, tidak ada berkas yang diminta');
  },

  'unduhan galeri bisa dibatalkan: tombol Batalkan menghentikan unduhan, tidak ada model terpasang': async (page) => {
    let lepas;
    // server menahan jawaban → unduhan menggantung sampai dibatalkan
    await page.route('https://cdn.jsdelivr.net/gh/**', r => { if (r.request().url().endsWith('.jpg')) return r.fulfill({ body: '', headers: CORS }); return new Promise(ok => { lepas = ok; }).then(() => r.abort().catch(() => {})); });
    await produkUji(page);
    await page.locator('#galeriGrid .gl-card[data-id="LampuUji"]').click();
    await page.locator('#galeriDetail .gd-tombol .btn:not(.ghost)').click();
    await page.waitForFunction(() => GALERI.sibuk && !$('#galeriBatal').hidden);
    await page.locator('#galeriBatal').click();
    await page.waitForFunction(() => !GALERI.sibuk, undefined, { timeout: 10000 });
    const r = await page.evaluate(() => ({ info: $('#galeriInfo').textContent, tombol: $('#galeriBatal').hidden, aset: Object.keys(PROJECT.assets).length, objek: L().objects.length }));
    if (lepas) lepas();
    assert.match(r.info, /dibatalkan/);
    assert.deepEqual([r.tombol, r.aset, r.objek], [true, 0, 0]);
  },

  'tekstur model: warna & normal maks. 2048 px, peta lain 1024 px, dikompres; filter anisotropik terpasang': async (page) => {
    const r = await page.evaluate(async () => {
      const kanvasPola = (w, warna) => { const c = document.createElement('canvas'); c.width = c.height = w; const x = c.getContext('2d'); x.fillStyle = '#777'; x.fillRect(0, 0, w, w);   // buram: tanpa alfa → JPEG
        for (let i = 0; i < 400; i++) { x.fillStyle = warna[i % warna.length]; x.fillRect(Math.random() * w, Math.random() * w, w / 20, w / 20); } return new THREE.CanvasTexture(c); };
      const kasar = kanvasPola(3000, ['#111', '#999']);   // GLTFExporter r128: metalness & roughness harus satu tekstur
      const mat = new THREE.MeshStandardMaterial({ map: kanvasPola(3000, ['#a33', '#3a3', '#33a', '#eee']), roughnessMap: kasar, metalnessMap: kasar });
      const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat));
      const glb = await new Promise(ok => new THREE.GLTFExporter().parse(g, ok, { binary: true, maxTextureSize: 4096 }));
      const o = await rampingkanGLB(glb), G = bacaGLB(o.buf), bv = G.json.bufferViews;
      const uk = i => { const v = bv[G.json.images[i].bufferView]; return ukuranGambar(G.bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength)); };
      const m = G.json.materials[0], tx = G.json.textures;
      const warna = uk(tx[m.pbrMetallicRoughness.baseColorTexture.index].source), kasarUk = uk(tx[m.pbrMetallicRoughness.metallicRoughnessTexture.index].source);
      const id = (await daftarkanAset('Kotak tekstur', glb)).id; let an = 0;
      ASSET_OBJ.get(id).traverse(n => { if (n.isMesh && n.material.map) an = n.material.map.anisotropy; });
      return { warna, kasar: kasarUk, lebihKecil: o.buf.byteLength < glb.byteLength, an, maks: renderer.capabilities.getMaxAnisotropy(), mime: G.json.images.map(i => i.mimeType) };
    });
    assert.deepEqual(r.warna, [2048, 2048], 'tekstur warna 2K');
    assert.deepEqual(r.kasar, [1024, 1024], 'peta kekasaran 1K');
    assert.ok(r.lebihKecil, 'GLB dikompres lebih kecil');
    assert.ok(r.mime.every(m => m === 'image/jpeg'), 'dikodekan ulang JPEG: ' + r.mime);
    assert.equal(r.an, Math.min(8, r.maks), 'anisotropik');
  },
};
