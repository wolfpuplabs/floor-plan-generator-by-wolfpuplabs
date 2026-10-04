import assert from 'node:assert/strict';

// JEV-062: model dari situs luar dirampingkan sebelum masuk pustaka (tekstur 4K → 1024 px,
// PNG tanpa alfa → JPEG, data lain utuh) dan aplikasi pulih bila konteks WebGL hilang
// (memori grafis iPad habis) — pantulan & tekstur model tidak boleh menjadi hitam.

// GLB uji: kubus logam bertekstur derau 4096×2048 (PNG besar) + ekstensi yang tidak dikenal eksporter
const buatGLB = page => page.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 4096; c.height = 2048;
  const x = c.getContext('2d'), im = x.createImageData(4096, 2048);
  for (let i = 0; i < im.data.length; i += 4) { im.data[i] = 120 + ((Math.random() * 120) | 0); im.data[i + 1] = 150; im.data[i + 2] = 170; im.data[i + 3] = 255; }
  x.putImageData(im, 0, 0);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), metalness: 1, roughness: 0.25 }));
  const glb = await new Promise((ok, no) => { try { new THREE.GLTFExporter().parse(mesh, ok, { binary: true, maxTextureSize: 8192 }); } catch (e) { no(e); } });
  const g = bacaGLB(glb);
  g.json.extensionsUsed = (g.json.extensionsUsed || []).concat('KHR_materials_emissive_strength');
  g.json.materials[0].extensions = { KHR_materials_emissive_strength: { emissiveStrength: 2 } };
  window.__glbUji = tulisGLB(g.json, g.bin);
  return { ukuran: window.__glbUji.byteLength, posisi: g.json.accessors[g.json.meshes[0].primitives[0].attributes.POSITION].count };
});
const impor = page => page.evaluate(async () => {
  document.getElementById('toast').textContent = '';
  await importModelFiles([new File([window.__glbUji], 'mobil.glb', { type: 'model/gltf-binary' })]);
  const id = Object.keys(PROJECT.assets).pop(); return id;
});
// terang rata-rata model, digambar sendirian ke render target dengan lingkungan adegan saat ini
const ukurTerang = (page, id) => page.evaluate(id => {
  const rt = new THREE.WebGLRenderTarget(64, 64), sc = new THREE.Scene(); sc.environment = scene.environment;
  const k = ASSET_OBJ.get(id).clone(); sc.add(k);
  const b = new THREE.Box3().setFromObject(k), c = b.getCenter(new THREE.Vector3()), r = b.getSize(new THREE.Vector3()).length();
  const cam = new THREE.PerspectiveCamera(40, 1, 0.01, 100); cam.position.copy(c).add(new THREE.Vector3(r * 0.8, r * 0.5, r * 1.2)); cam.lookAt(c);
  const lama = renderer.getRenderTarget(), warna = renderer.getClearColor(new THREE.Color()), alfa = renderer.getClearAlpha();
  renderer.setRenderTarget(rt); renderer.setClearColor(0, 0); renderer.clear(); renderer.render(sc, cam);
  const px = new Uint8Array(64 * 64 * 4); renderer.readRenderTargetPixels(rt, 0, 0, 64, 64, px);
  renderer.setRenderTarget(lama); renderer.setClearColor(warna, alfa); rt.dispose();
  let s = 0, n = 0; for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 0) { s += px[i] + px[i + 1] + px[i + 2]; n++; }
  return { rata: s / Math.max(1, n * 3), n };
}, id);

export const tes = {
  'rampingkan: tekstur 4K → 1024 px JPEG, mesh & ekstensi utuh, laporan model di inspector': async (page) => {
    const asal = await buatGLB(page);
    assert.ok(asal.ukuran > 3 * 1048576, 'GLB uji harus besar: ' + asal.ukuran);
    const id = await impor(page);
    await page.waitForFunction(() => /dirampingkan/.test(document.getElementById('toast').textContent), undefined, { timeout: 60000 });
    const r = await page.evaluate(id => {
      const a = PROJECT.assets[id], g = bacaGLB(ASSET_BUF.get(id)), bv = g.json.bufferViews[g.json.images[0].bufferView];
      const gambar = g.bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
      return { size: a.size, asli: a.asli, mime: g.json.images[0].mimeType, dim: ukuranGambar(gambar), ext: g.json.materials[0].extensions,
        posisi: g.json.accessors[g.json.meshes[0].primitives[0].attributes.POSITION].count, lap: laporanModel(id),
        disimpan: bufFromB64(a.data).byteLength };
    }, id);
    assert.equal(r.mime, 'image/jpeg');
    assert.deepEqual(r.dim, [1024, 512]);
    assert.deepEqual(r.ext, { KHR_materials_emissive_strength: { emissiveStrength: 2 } }, 'ekstensi material harus utuh');
    assert.equal(r.posisi, asal.posisi, 'mesh tidak boleh berubah');
    assert.ok(r.size < asal.ukuran / 4 && r.disimpan === r.size, JSON.stringify(r));
    assert.equal(r.asli, asal.ukuran);
    assert.equal(r.lap.maks, 1024); assert.equal(r.lap.tri, 12);
    assert.ok(r.lap.gpuMB < 8, 'memori GPU model ±' + r.lap.gpuMB + ' MB');
    // inspector: laporan + perkecil lagi ke 512 px
    await page.evaluate(id => { addObject('model', id); }, id);
    await page.waitForSelector('#inspector:not([hidden])');
    assert.match(await page.textContent('#inspector'), /Laporan model[\s\S]*12 segitiga · 1 tekstur ≤ 1024 px/);
    await page.click('#inspector button:has-text("Perkecil tekstur ke 512 px")');
    await page.waitForFunction(id => laporanModel(id) && laporanModel(id).maks === 512, id, { timeout: 60000 });
    // berkas proyek yang disimpan → dibuka lagi: tetap kecil, tidak dirampingkan dua kali
    const simpan = await page.evaluate(() => JSON.stringify(PROJECT));
    const ulang = await page.evaluate(async s => { const j = JSON.parse(s); const sebelum = j.assets[Object.keys(j.assets)[0]].size;
      PROJECT.assets = j.assets; const r = await loadProjectAssets(); return { r, sebelum, sesudah: Object.values(PROJECT.assets)[0].size }; }, simpan);
    assert.equal(ulang.r.ramping, 0); assert.equal(ulang.sebelum, ulang.sesudah);
  },
  'proyek lama bertekstur 4K diperkecil saat dibuka': async (page) => {
    await buatGLB(page);
    const r = await page.evaluate(async () => {
      PROJECT.assets = { aslama: { name: 'Mobil lama', size: window.__glbUji.byteLength, dims: [1, 1, 1], fit: 1, data: b64FromBuf(window.__glbUji) } };
      const r = await loadProjectAssets(); return { r, a: PROJECT.assets.aslama, maks: laporanModel('aslama').maks };
    });
    assert.equal(r.r.ramping, 1); assert.equal(r.maks, 1024);
    assert.ok(r.a.size < r.a.asli / 4, JSON.stringify({ size: r.a.size, asli: r.a.asli }));
  },
  'konteks WebGL hilang → pulih: pantulan & tekstur model tidak hitam': async (page) => {
    await buatGLB(page);
    const id = await impor(page);
    await page.evaluate(id => { setPBR(true); addObject('model', id); }, id);
    const sebelum = await ukurTerang(page, id);
    assert.ok(sebelum.n > 200 && sebelum.rata > 25, 'model harus terlihat sebelum konteks hilang: ' + JSON.stringify(sebelum));
    await page.evaluate(() => { window.__ext = renderer.getContext().getExtension('WEBGL_lose_context'); window.__ext.loseContext(); });
    await page.waitForFunction(() => GPU.hilang === 1);
    await page.evaluate(() => { document.getElementById('toast').textContent = ''; window.__ext.restoreContext(); });
    await page.waitForFunction(() => /Tampilan dipulihkan/.test(document.getElementById('toast').textContent), undefined, { timeout: 60000 });
    const sesudah = await ukurTerang(page, id);
    assert.ok(sesudah.rata > sebelum.rata * 0.7, `model menjadi gelap setelah pulih: ${sebelum.rata.toFixed(1)} → ${sesudah.rata.toFixed(1)}`);
    assert.equal(await page.evaluate(() => renderer.getContext().isContextLost()), false);
  },
};
