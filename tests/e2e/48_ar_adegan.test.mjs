import assert from 'node:assert/strict';
import { muatProyekJSON } from './harness.mjs';

// JEV-104: AR satu objek / model pustaka, ukuran asli · JEV-105: adegan / area + interaksi "Pindah ke adegan"
const rumah = { v: 1, levels: [{ name: 'L1', height: 3, walls: [[0, 0, 6, 0], [6, 0, 6, 5], [6, 5, 0, 5], [0, 5, 0, 0]].map(([x1, z1, x2, z2], i) => ({ id: 'w' + i, x1, z1, x2, z2, thickness: 0.15, openings: [] })), objects: [] }] };

export const tes = {
  'AR satu objek: tombol di inspector & daftar model; hanya objek itu, ukuran asli 1 : 1; skala maket pulih setelah ditutup': async (page) => {
    await muatProyekJSON(page, rumah);
    const r = await page.evaluate(async () => {
      addObject('furn', 'sofa3'); const o = L().objects.at(-1); o.x = 3; o.z = 2.5; rebuildScene(); select('obj', o.id); renderInspector();
      const tombol = [...document.querySelectorAll('#inspector button')].some(b => /Lihat di AR/.test(b.textContent));
      AR.hanya = { obj: o.id }; AR.denom = 1; const m = arBuildModel(); AR.hanya = null; AR.denom = 50;
      const semua = arBuildModel();
      // model pustaka
      const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.4), new THREE.MeshStandardMaterial()));
      const glb = await new Promise(ok => new THREE.GLTFExporter().parse(g, ok, { binary: true })); const id = (await daftarkanAset('Kursi uji', glb)).id; renderCatalogs();
      const daftar = [...document.querySelectorAll('#model-list button')].some(b => b.title === 'Lihat di AR (ukuran asli)');
      AR.hanya = { aset: id }; AR.denom = 1; const ma = arBuildModel(); AR.hanya = null; AR.denom = 50;
      return { tombol, daftar, sofa: m.size.toArray().map(v => +v.toFixed(2)), skala: m.wrap.scale.x, semua: semua.size.x > 5, aset: ma.size.toArray().map(v => +v.toFixed(2)) };
    });
    assert.ok(r.tombol && r.daftar, 'tombol AR ada');
    assert.equal(r.skala, 1, 'ukuran asli');
    assert.ok(r.sofa[0] > 1.5 && r.sofa[0] < 3 && r.sofa[1] < 1.2, 'hanya sofa: ' + r.sofa);
    assert.ok(r.semua, 'AR rumah tetap utuh');
    assert.deepEqual(r.aset, [0.6, 0.9, 0.4]);
    // panel: info ukuran asli, skala maket kembali setelah ditutup
    await page.evaluate(() => lihatAR({ obj: L().objects.at(-1).id }));
    await page.waitForFunction(() => !$('#arPanel').hidden, undefined, { timeout: 30000 });
    const p = await page.evaluate(() => { const t = $('#arInfo').textContent, s = $('#arScale').value; closeAR(); return [/ukuran asli/.test(t), s, AR.denom, $('#arScale').value]; });
    assert.deepEqual(p, [true, '1', 50, '50']);
  },

  'adegan: area baru, nama, gerbang "Pindah ke adegan" di mode jalan, muncul di depan gerbang balik, tersimpan & lolos penyaring': async (page) => {
    page.on('dialog', d => d.accept());
    await muatProyekJSON(page, rumah);
    await page.click('.tabs button[data-tab="file"]');
    assert.match(await page.evaluate(() => $('#adeganDaftar').textContent), /satu area/);
    await page.click('#adeganBaru');
    await page.waitForFunction(() => (PROJECT.adegan || []).length === 2);
    const a = await page.evaluate(() => ({ kini: PROJECT.adeganKini, ids: PROJECT.adegan.map(x => x.id), dinding: L().walls.length, tanah: PROJECT.site.tanah, simpan: PROJECT.adegan[0].isi.levels[0].walls.length, baris: document.querySelectorAll('#adeganDaftar .row').length }));
    assert.equal(a.kini, a.ids[1]); assert.deepEqual([a.dinding, a.tanah, a.simpan, a.baris], [0, 'rumput', 4, 2]);
    const [rumahId, pantaiId] = a.ids;
    // ganti nama area baru
    await page.evaluate(() => { const i = document.querySelectorAll('#adeganDaftar input')[1]; i.value = 'Pantai'; i.dispatchEvent(new Event('change')); });
    await page.evaluate(() => { const i = document.querySelectorAll('#adeganDaftar input')[0]; i.value = 'Rumah'; i.dispatchEvent(new Event('change')); });
    // gerbang di Pantai → Rumah lewat inspector
    const gerbang = await page.evaluate(() => { addObject('furn', 'bentuk_kotak'); const o = L().objects.at(-1); o.x = 0; o.z = 0.6; rebuildScene(); select('obj', o.id); renderInspector(); return o.id; });
    await page.evaluate(id => { const r = [...document.querySelectorAll('#inspector .f-row')].find(x => x.querySelector('label')?.textContent === 'Pindah ke adegan'); const s = r.querySelector('select'); s.value = id; s.dispatchEvent(new Event('change')); }, rumahId);
    // tersimpan & lolos penyaring (isi area lain ikut disaring)
    const sz = await page.evaluate(() => { const B = sanitasiProyek(JSON.parse(JSON.stringify(PROJECT))); return [B.adeganKini, B.adegan.map(x => [x.nama, !!x.isi]), B.adegan[0].isi.levels[0].walls.length, B.levels[0].objects[0].params.aksi.pindah]; });
    assert.deepEqual(sz, [pantaiId, [['Rumah', true], ['Pantai', false]], 4, rumahId]);
    const rusak = await page.evaluate(() => { const j = JSON.parse(JSON.stringify(PROJECT)); j.adegan[0].isi.levels = 'x'; j.adegan.push({ id: '<x>', nama: 'jahat' }); return sanitasiProyek(j).adegan.map(x => x.nama); });
    assert.deepEqual(rusak, ['Pantai'], 'area rusak / id tak sah dibuang');
    // mode jalan: bidik gerbang → "Pergi ke Rumah" → pindah, tetap berjalan
    const j = await page.evaluate(() => { enterFPS(); FPS.feet = 0; camera.position.set(0, 1.6, 2.2); FPS.yaw = Math.PI; FPS.pitch = -0.5; for (let i = 0; i < 3; i++) fpsStep(0); AIM_T = 0; stepBidik(0.2); return AIM && [AIM.jenis, labelAksi(AIM)]; });
    assert.deepEqual(j, ['pindah', 'Pergi ke Rumah']);
    await page.evaluate(() => pakai(AIM));
    await page.waitForFunction(id => PROJECT.adeganKini === id, rumahId, { timeout: 15000 });
    assert.deepEqual(await page.evaluate(() => [FPS.on, L().walls.length, !!PROJECT.adegan.find(x => x.nama === 'Pantai').isi]), [true, 4, true]);
    // kembali ke Pantai: muncul 1,4 m di depan gerbang yang mengarah ke Rumah
    const k = await page.evaluate(id => { window.ADEGAN.buka(id); return [FPS.on, +camera.position.x.toFixed(2), +camera.position.z.toFixed(2)]; }, pantaiId);
    assert.deepEqual(k, [true, 0, 2]);
    await page.evaluate(() => exitFPS());
    // berkas proyek: dimuat ulang utuh (adegan & cuaca ikut)
    const muat = await page.evaluate(() => { PROJECT.cuaca = { jenis: 'hujan', siklus: 0 }; const s = JSON.stringify(PROJECT); muatProyekObjek(s); return [PROJECT.adegan.length, PROJECT.adeganKini === PROJECT.adegan[1].id, PROJECT.cuaca && PROJECT.cuaca.jenis]; });
    assert.deepEqual(muat, [2, true, 'hujan']);
    // hapus area Rumah: gerbang ikut lepas, proyek kembali satu area
    await page.evaluate(() => { window.ADEGAN.render(); document.querySelectorAll('#adeganDaftar .btn.danger')[0].click(); });
    const h = await page.evaluate(() => [PROJECT.adegan, PROJECT.levels[0].objects[0].params.aksi && PROJECT.levels[0].objects[0].params.aksi.pindah, /satu area/.test($('#adeganDaftar').textContent)]);
    assert.deepEqual(h, [undefined, undefined, true]);
  },
};
