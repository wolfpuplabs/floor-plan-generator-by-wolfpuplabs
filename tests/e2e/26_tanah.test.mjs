import assert from 'node:assert/strict';

// JEV-075: tanah situs selalu di bawah lantai (dulu rumput menembus ke dalam rumah bila pelat
// lantai 1 mati), tanah bisa dibentuk dengan kuas (naik/turun/ratakan/haluskan) dan dijalani
const rumah = (page, opsi = {}) => page.evaluate(o => {
  PROJECT.levels[0].walls = [[0, 0, 8, 0], [8, 0, 8, 6], [8, 6, 0, 6], [0, 6, 0, 0]].map(([a, b, c, d], i) => ({ id: uid('w'), x1: a, z1: b, x2: c, z2: d, thickness: 0.15,
    openings: i === 0 ? [{ id: uid('o'), type: 'door_single', at: 4, width: 0.9, sill: 0, head: 2.1 }] : [] }));
  PROJECT.levels[0].objects = []; PROJECT.levels[0].slab = o.pelat !== false;
  PROJECT.site = { tanah: 'rumput', margin: 12 }; rebuildScene();
}, opsi);
const atas = (page, x, z) => page.evaluate(([x, z]) => { const h = new THREE.Raycaster(new THREE.Vector3(x, 20, z), new THREE.Vector3(0, -1, 0)).intersectObjects(worldRoot.children, true)
  .find(i => i.object.isMesh && !i.object.userData.noExport && (i.object.userData.situs || i.object.userData.lantaiDasar || i.object.userData.slab));
  return h ? { y: +h.point.y.toFixed(3), apa: h.object.userData.situs ? 'tanah' : 'lantai' } : null; }, [x, z]);

export const tes = {
  'pelat lantai 1 mati: lantai dasar tetap menutup tapak, tanah di bawahnya': async (page) => {
    await rumah(page, { pelat: false });
    assert.deepEqual(await atas(page, 4, 3), { y: 0, apa: 'lantai' }, 'di dalam rumah yang terlihat lantai, bukan rumput');
    const luar = await atas(page, 4, -5);
    assert.equal(luar.apa, 'tanah'); assert.ok(luar.y < 0, 'tanah di luar sedikit di bawah lantai: ' + luar.y);
    // bukit tepat di samping rumah tetap ditekan di bawah lantai di sekitar tapak
    const r = await page.evaluate(() => { TANAH.mode = 'naik'; TANAH.kuas = 4; TANAH.kuat = 1; TANAH.sapuan = { datar: 0 };
      for (let i = 0; i < 25; i++) sapuTanah({ x: -1, z: 3 }, 0.1); TANAH.sapuan = null; rebuildScene();
      return { tepi: tinggiTanah(-0.3, 3), jauh: tinggiTanah(-3.5, 3), dalam: tinggiTanah(1, 3) }; });
    assert.ok(r.tepi < 0 && r.dalam < 0, 'dekat & di dalam tapak tanah di bawah lantai: ' + JSON.stringify(r));
    assert.ok(r.jauh > 1, 'menjauh dari rumah bukit tetap tinggi: ' + JSON.stringify(r));
    assert.deepEqual(await atas(page, 1, 3), { y: 0, apa: 'lantai' });
  },
  'kuas tanah: sapuan mouse menaikkan tanah, tercatat di riwayat, Esc kembali ke Pilih; data disaring': async (page) => {
    await rumah(page);
    await page.evaluate(() => { pilihTab('levels'); document.querySelector('.tanah-alat button[data-tanah="naik"]').click(); setSidebar(false);
      camera.position.set(4, 30, 22); orbit.target.set(4, 0, -6); orbit.update(); TANAH.kuat = 1; });
    assert.equal(await page.evaluate(() => TOOL), 'tanah');
    const c = await page.evaluate(() => { scene.updateMatrixWorld(true); const v = new THREE.Vector3(4, 0, -8).project(camera), r = renderer.domElement.getBoundingClientRect();
      return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; });
    await page.mouse.move(c[0], c[1]); await page.mouse.down();
    for (let i = 0; i < 12; i++) { await page.mouse.move(c[0] + i * 3, c[1]); await page.waitForTimeout(80); }
    await page.mouse.up();
    const r = await page.evaluate(() => ({ puncak: Math.max(...PROJECT.site.relief.h), label: HIST.label, orbit: orbit.enabled, dekat: reliefDi(4, -8) }));
    assert.ok(r.puncak > 0 && r.dekat > 0, JSON.stringify(r));
    assert.equal(r.orbit, true, 'kamera bebas lagi setelah sapuan');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => TOOL), 'select');
    const B = await page.evaluate(() => [sanitasiProyek({ levels: [{}], site: { tanah: 'rumput', relief: { c: 0.5, x0: 0, z0: 0, nx: 2, nz: 2, h: [1, 2, 99999, 'x'] } } }).site.relief.h,
      sanitasiProyek({ levels: [{}], site: { tanah: 'rumput', relief: { c: 0.5, x0: 0, z0: 0, nx: 1000, nz: 1000, h: [] } } }).site.relief]);
    assert.deepEqual(B, [[1, 2, 3000, 0], undefined]);
  },
  'mode jalan: kaki mengikuti bukit & lembah': async (page) => {
    await rumah(page);
    const j = await page.evaluate(() => {
      TANAH.kuas = 5; TANAH.kuat = 1; TANAH.sapuan = { datar: 0 };
      TANAH.mode = 'naik'; for (let i = 0; i < 20; i++) sapuTanah({ x: -9, z: 3 }, 0.1);
      TANAH.mode = 'turun'; for (let i = 0; i < 12; i++) sapuTanah({ x: 17, z: 3 }, 0.1);
      TANAH.sapuan = null; rebuildScene();
      enterFPS(); const jalan = (x, yaw, n) => { camera.position.set(x, 1.6, 3); FPS.feet = tinggiTanah(x, 3); FPS.vy = 0; FPS.yaw = yaw; FPS.keys.add('w');
        for (let i = 0; i < n; i++) fpsStep(1 / 30); FPS.keys.clear(); return FPS.feet; };
      const bukit = jalan(-17, Math.PI / 2, 110), lembah = jalan(10, Math.PI / 2, 90);
      exitFPS(); return { bukit, lembah, puncak: tinggiTanah(-9, 3), dasar: tinggiTanah(17, 3) };
    });
    assert.ok(j.bukit > 2 && Math.abs(j.bukit - j.puncak) < 0.6, 'mendaki bukit: ' + JSON.stringify(j));
    assert.ok(j.lembah < -1, 'turun ke lembah (tidak tertahan di 0): ' + JSON.stringify(j));
  },
};
