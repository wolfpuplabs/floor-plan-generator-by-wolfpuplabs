import assert from 'node:assert/strict';
import { bukaApp } from './harness.mjs';

// Pertama membuka tautan lihat / undangan main bareng: mode jalan muncul di DEPAN rumah — di luar pintu
// luar utama, menghadapnya — bukan di tengah ruangan terbesar.
// Rumah 8 × 6: ruang tamu (x 0–5) & kamar (x 5–8); pintu dalam di sekat, pintu depan ganda di dinding
// bawah (z = 6), pintu garasi di dinding kiri (x = 0).
const rumah = () => {
  const w = (id, x1, z1, x2, z2, openings = []) => ({ id, x1, z1, x2, z2, thickness: 0.15, openings });
  return [
    w('atas', 0, 0, 8, 0),
    w('kanan', 8, 0, 8, 6),
    w('bawah', 8, 6, 0, 6, [{ id: 'od', type: 'door2', at: 5.5, width: 1.4, sill: 0, head: 2.1 }]),
    w('kiri', 0, 6, 0, 0, [{ id: 'og', type: 'garage', at: 3, width: 2.8, sill: 0, head: 2.4 }]),
    w('sekat', 5, 0, 5, 6, [{ id: 'oi', type: 'door', at: 3, width: 0.8, sill: 0, head: 2.1 }]),
  ];
};

export const tes = {
  'titik depan: pintu luar utama (ganda > garasi, pintu dalam diabaikan), berdiri di luar menghadap pintu': async (page) => {
    const r = await page.evaluate(w => {
      PROJECT.levels[0].walls = w; PROJECT.levels[0].objects = []; rebuildScene();
      const t = titikDepan(L());
      // tanpa pintu luar: tidak ada titik depan
      const tanpa = JSON.parse(JSON.stringify(w)); for (const d of tanpa) if (d.id !== 'sekat') d.openings = [];
      PROJECT.levels[0].walls = tanpa; rebuildScene(); const kosong = titikDepan(L());
      PROJECT.levels[0].walls = w; rebuildScene();
      return { x: +t.x.toFixed(2), z: +t.z.toFixed(2), yaw: +t.yaw.toFixed(3), kosong };
    }, rumah());
    // pintu ganda di dinding bawah: tengahnya x = 8 − 5,5 = 2,5; berdiri 1,8 m di luar (z > 6), menghadap −z
    assert.deepEqual({ x: r.x, z: r.z, kosong: r.kosong }, { x: 2.5, z: 7.88, kosong: null });
    assert.ok(Math.abs(Math.abs(r.yaw) - Math.PI) < 1e-3, 'menghadap ke rumah (−z): ' + r.yaw);
  },
  'mode jalan {depan:true}: kamera di luar pintu & membidik pintunya; tombol Jalan biasa tetap di dalam': async (page) => {
    const r = await page.evaluate(w => {
      PROJECT.levels[0].walls = w; PROJECT.levels[0].objects = []; rebuildScene();
      enterFPS({ depan: true }); for (let i = 0; i < 3; i++) fpsStep(0); AIM_T = 0; stepBidik(0.2);
      const d = { x: camera.position.x, z: camera.position.z, aim: AIM && AIM.jenis, pintu: AIM && AIM.o && AIM.o.id };
      exitFPS(); orbit.target.set(2, 0, 3); enterFPS();
      const b = { x: camera.position.x, z: camera.position.z }; exitFPS();
      return { d, b };
    }, rumah());
    assert.ok(Math.abs(r.d.x - 2.5) < 0.2 && r.d.z > 6.5, 'di luar depan: ' + JSON.stringify(r.d));
    assert.deepEqual([r.d.aim, r.d.pintu], ['bukaan', 'od']);
    assert.ok(r.b.z > 0 && r.b.z < 6 && r.b.x > 0 && r.b.x < 5, 'tombol Jalan dari editor tetap di dalam: ' + JSON.stringify(r.b));
  },
  'tautan lihat: penerima muncul di depan rumah': async (page) => {
    const url = await page.evaluate(async w => {
      PROJECT.levels[0].walls = w; PROJECT.levels[0].objects = []; rebuildScene();
      $('#bagikanFoto').checked = false; return (await buatTautanLihat()).url;
    }, rumah());
    assert.match(url, /#lihat=/);
    await page.goto('about:blank');
    const { page: b, log } = await bukaApp(page.context().browser(), url, { viewport: { width: 900, height: 600 } });
    try {
      await b.waitForFunction(() => LIHAT.siap && FPS.on, undefined, { timeout: 60000 });
      const p = await b.evaluate(() => ({ x: camera.position.x, z: camera.position.z, yaw: FPS.yaw }));
      assert.ok(Math.abs(p.x - 2.5) < 0.2 && p.z > 6.5, JSON.stringify(p));
      assert.ok(Math.abs(Math.abs(p.yaw) - Math.PI) < 0.01);
      assert.deepEqual(log.galat, []);
    } finally { await b.close(); }
  },
};
