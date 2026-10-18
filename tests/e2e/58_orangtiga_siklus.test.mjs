import assert from 'node:assert/strict';
import { muatProyekJSON } from './harness.mjs';

// JEV-122: kamera orang ketiga di mode jalan (avatar pemain terlihat, logika tetap dari kepala pemain, kamera maju bila terhalang);
// siklus waktu menyala sebagai bawaan (mati tersimpan eksplisit); kayu api unggun berbentuk kerucut
const obj = (id, kind, type, x, z, params = {}, rotY = 0) => ({ id, kind, type, x, y: 0, z, rotY, sx: 1, sy: 1, sz: 1, params });
const dinding = [[0, 0, 10, 0], [10, 0, 10, 8], [10, 8, 0, 8], [0, 8, 0, 0]].map(([x1, z1, x2, z2], i) => ({ id: 'w' + i, x1, z1, x2, z2, thickness: 0.15, openings: [] }));
const rumah = { v: 1, levels: [{ name: 'L1', height: 3, walls: dinding, objects: [obj('unggun', 'furn', 'api_unggun', 5, 12)] }] };

export const tes = {
  'orang ketiga: tombol di mode jalan → avatar pemain tampil saat digambar, kamera kembali ke kepala sesudahnya; kamera maju dekat dinding; diingat; baju renang tetap saat main air': async (page) => {
    await muatProyekJSON(page, rumah);
    const r = await page.evaluate(async () => {
      localStorage.removeItem('kamera3'); enterFPS(); camera.position.set(5, 1.6, 4); FPS.yaw = 0; FPS.pitch = 0; fpsStep(0);
      $('#fpsO3').click();
      for (let i = 0; i < 300 && !(window.ORANG3 && window.ORANG3._uji.S.a); i++) await new Promise(ok => setTimeout(ok, 100));
      const S = window.ORANG3._uji.S, out = { aktif: window.ORANG3.aktif(), tekan: $('#fpsO3').getAttribute('aria-pressed'), simpan: localStorage.getItem('kamera3') };
      // satu bingkai digambar: avatar terlihat & kamera digeser hanya selama menggambar
      let saatGambar = null; const kepala = camera.position.clone();
      window.ORANG3.render(() => { saatGambar = { avatar: S.g.visible, jarak: +camera.position.distanceTo(kepala).toFixed(2) }; });
      out.gambar = saatGambar; out.kembali = +camera.position.distanceTo(kepala).toFixed(3); out.avatarSesudah = S.g.visible;
      out.posisi = [+S.g.position.x.toFixed(2), +S.g.position.z.toFixed(2)];
      // menghadap dinding belakang yang dekat: kamera maju
      camera.position.set(5, 1.6, 1.2); FPS.yaw = 0; fpsStep(0); for (let i = 0; i < 5; i++) window.ORANG3.render(() => {});
      out.dekatDinding = +S.d.toFixed(2);
      // berenang (17) → baju renang; main air (21) tetap berbaju renang tanpa memuat ulang; keluar → baju biasa dari simpanan, langsung
      camera.position.set(5, 1.6, 4); fpsStep(0);
      const gaya = k => { FPS.gaya = { k, x: camera.position.x, z: camera.position.z, t: performance.now() }; };
      const tunggu = async () => { for (let i = 0; i < 300; i++) { window.ORANG3.render(() => {}); if (!S.memuat) { window.ORANG3.render(() => {}); if (!S.memuat) return; } await new Promise(ok => setTimeout(ok, 50)); } };
      const avBiasa = S.a; gaya('renang'); await tunggu(); out.renang = S.baju;
      const avRenang = S.a; gaya('ciprat'); window.ORANG3.render(() => {}); out.ciprat = [S.baju, S.memuat, S.a === avRenang, window.LOBI.poseAir(21)];
      FPS.gaya = null; window.ORANG3.render(() => {}); out.keluar = [S.baju, S.memuat, S.a === avBiasa, window.ORANG3._uji.SIMPAN.size];
      $('#fpsO3').click(); await new Promise(ok => setTimeout(ok, 50)); out.mati = [window.ORANG3.aktif(), localStorage.getItem('kamera3')]; localStorage.removeItem('kamera3'); exitFPS();
      return out; });
    assert.deepEqual([r.aktif, r.tekan, r.simpan], [true, 'true', '1']);
    assert.ok(r.gambar && r.gambar.avatar && r.gambar.jarak > 2, 'kamera di belakang-atas saat menggambar: ' + JSON.stringify(r.gambar));
    assert.deepEqual([r.kembali, r.avatarSesudah], [0, false], 'logika tetap dari kepala pemain');
    assert.deepEqual(r.posisi, [5, 4]);
    assert.ok(r.dekatDinding < 1.3, 'kamera tidak menembus dinding: ' + r.dekatDinding);
    assert.deepEqual(r.mati, [false, '0']);
    assert.equal(r.renang, '_renang', 'berenang: baju renang');
    assert.deepEqual(r.ciprat, ['_renang', false, true, true], 'main air: tetap baju renang, tanpa memuat ulang');
    assert.deepEqual(r.keluar, ['', false, true, 2], 'keluar kolam: avatar baju biasa dari simpanan');
  },

  'siklus waktu menyala sebagai bawaan; mati tersimpan & lolos penyaring; api unggun: kayu bersandar membentuk kerucut': async (page) => {
    await muatProyekJSON(page, rumah);
    await page.waitForFunction(() => window.CUACA && CUACA.keadaan().siklus === 6);
    const r = await page.evaluate(() => {
      const out = { awal: PROJECT.cuaca || null, pilih: $('#siklus').value, tombol: $('#fpsOto').getAttribute('aria-pressed') };
      aturCuaca({ siklus: 0 }); out.mati = PROJECT.cuaca; out.saring = sanitasiProyek(JSON.parse(JSON.stringify(PROJECT))).cuaca;
      // kayu api unggun: ujung bawah di tanah melingkar, ujung atas bertemu di puncak
      const g = findGroup('obj', 'unggun'), k = g.getObjectByName('kayu'); g.updateMatrixWorld(true);
      out.kayu = k.children.map(l => { const a = new THREE.Vector3(0, 0.3, 0), b = new THREE.Vector3(0, -0.3, 0); l.localToWorld(a); l.localToWorld(b); g.worldToLocal(a); g.worldToLocal(b);
        return { atas: +Math.hypot(a.x, a.z).toFixed(2), tinggi: +a.y.toFixed(2), bawah: +Math.hypot(b.x, b.z).toFixed(2), dasar: +b.y.toFixed(2) }; });
      return out; });
    assert.deepEqual([r.awal, r.pilih, r.tombol], [null, '6', 'true']);
    assert.deepEqual([r.mati, r.saring], [{ jenis: 'cerah', siklus: 0 }, { jenis: 'cerah', siklus: 0 }]);
    assert.equal(r.kayu.length, 6);
    for (const k of r.kayu) assert.ok(k.atas < 0.06 && k.tinggi > 0.45 && Math.abs(k.bawah - 0.3) < 0.04 && k.dasar < 0.06, 'kerucut: ' + JSON.stringify(r.kayu));
  }
};
