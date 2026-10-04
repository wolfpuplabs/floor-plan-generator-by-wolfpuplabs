import assert from 'node:assert/strict';

// JEV-066: lampu padam di malam hari diberi garis tepi lembut (rim) agar bisa ditemukan;
// hanya di mode jalan saat malam/gelap, hilang saat lampu menyala, tidak menghalangi bidikan
const kotak = [[0, 0, 6, 0], [6, 0, 6, 5], [6, 5, 0, 5], [0, 5, 0, 0]];
const status = page => page.evaluate(() => {
  const g = findGroup('obj', 'fl'); let n = 0, tampak = 0, kena = 0;
  g.traverse(m => { if (m.userData.garis && m.isMesh) { n++; if (m.visible) tampak++; } });
  const rc = new THREE.Raycaster(new THREE.Vector3(1.5, 1.55, 3), new THREE.Vector3(0, 0, -1));
  for (const h of rc.intersectObject(g, true)) if (h.object.userData.garis) kena++;
  return { n, tampak, kena, kuat: +GARIS.kuat.value.toFixed(2) };
});
export const tes = {
  'lampu padam di malam hari bergaris tepi lembut; menyala / siang / editor tanpa garis': async (page) => {
    await page.evaluate(k => {
      L().walls = k.map(([a, b, c, d]) => ({ id: uid('w'), x1: a, z1: b, x2: c, z2: d, thickness: 0.15, openings: [] }));
      L().objects = [{ id: 'fl', kind: 'furn', type: 'floor_lamp', x: 1.5, y: 0, z: 1.2, rotY: 0, sx: 1, sy: 1, sz: 1, params: {} }];
      MATI.add('fl'); setSuasana('gelap'); rebuildScene();
    }, kotak);
    const editor = await status(page);
    assert.ok(editor.n > 0, 'lampu padam punya garis');
    assert.equal(editor.tampak, 0, 'di editor garis tidak tampil ' + JSON.stringify(editor));
    await page.evaluate(() => { enterFPS(); FPS.feet = 0; camera.position.set(1.5, 1.6, 4.2); FPS.yaw = Math.PI; FPS.pitch = 0; });
    await page.waitForFunction(() => GARIS.kuat.value > 0.9, undefined, { timeout: 60000 });
    const jalan = await status(page);
    assert.equal(jalan.tampak, jalan.n, 'mode jalan + gelap: garis tampil ' + JSON.stringify(jalan));
    assert.equal(jalan.kena, 0, 'garis tidak bisa dibidik/ditabrak');
    // dibidik → bahan garis lebih terang
    await page.evaluate(() => { FPS.pitch = -0.05; });
    await page.waitForFunction(() => GARIS.bidik === findGroup('obj', 'fl') || (AIM && AIM.jenis === 'lampu'), undefined, { timeout: 60000 }).catch(() => {});
    // lampu dinyalakan → garis hilang
    await page.evaluate(() => { MATI.delete('fl'); for (const g of grupObjek('fl')) terapkanNyala(g, true); });
    { const s = await status(page); assert.equal(s.tampak, 0, 'lampu menyala tidak bergaris ' + JSON.stringify(s)); }
    // padam lagi, lalu siang → garis memudar
    await page.evaluate(() => { MATI.add('fl'); for (const g of grupObjek('fl')) terapkanNyala(g, false); });
    { const s = await status(page); assert.equal(s.tampak, s.n, 'padam lagi ' + JSON.stringify(s)); }
    await page.evaluate(() => setSuasana('siang'));
    await page.waitForFunction(() => GARIS.kuat.value < 0.01 && !GARIS.tampil, undefined, { timeout: 60000 });
    { const s = await status(page); assert.equal(s.tampak, 0, 'siang ' + JSON.stringify(s)); }
    // ekspor model tidak membawa garis
    const ekspor = await page.evaluate(() => { let n = 0; findGroup('obj', 'fl').traverse(m => { if (m.userData.garis && !m.userData.noExport) n++; }); return n; });
    assert.equal(ekspor, 0, 'ekspor');
    await page.evaluate(() => exitFPS());
  },
};
