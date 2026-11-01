import assert from 'node:assert/strict';
import { muatProyekJSON } from './harness.mjs';

// JEV-142: void lantai atas yang tidak dikelilingi dinding lantai itu (mezanin bersisi miring): dulu sebagian void beratap
// rendah (atap lantai 1) dan celah di antara kotak pelat & dinding miring tidak beratap sama sekali — malam hari tampak
// hitam bergerigi. Kini atap lantai 2 menutup void-nya sendiri (satu atap, tanpa sambungan) & atap lantai 1 tidak dipasang
// di void (ruang tetap dobel tinggi).
const seg = (p, pts) => pts.slice(0, -1).map((a, i) => ({ id: p + i, x1: a[0], z1: a[1], x2: pts[i + 1][0], z2: pts[i + 1][1], thickness: 0.2, openings: [] }));
const o = (id, kind, type, x, z, params = {}) => ({ id, kind, type, x, y: 0, z, rotY: 0, sx: 1, sy: 1, sz: 1, params });

export const tes = {
  'atap menutup void lantai atas sebagai satu atap di puncak lantai atas; tidak ada atap rendah di void & tidak ada celah tanpa atap': async (page) => {
    await muatProyekJSON(page, { v: 1, atap: { tutup: true, tritisan: 0.6, tebal: 0.12 }, levels: [
      { name: 'L1', height: 3.2, walls: seg('a', [[0, 0], [10, 0], [10, 8], [0, 8], [0, 0]]), objects: [] },
      { name: 'L2', height: 3, walls: seg('b', [[6, 0], [10, 0], [10, 8], [4, 8], [6, 0]]),
        objects: [o('v', 'void', 'rect', 2.6, 4, { shape: 'rect', w: 5.2, d: 8, railing: false, railH: 1, openSides: [] })] }] });
    const r = await page.evaluate(() => {
      document.getElementById('otherLevels').value = 'solid'; rebuildScene(); scene.updateMatrixWorld(true);
      const naik = (x, z) => new THREE.Raycaster(new THREE.Vector3(x, 1.5, z), new THREE.Vector3(0, 1, 0)).intersectObjects(worldRoot.children, true)
        .filter(i => i.object.userData.atap).map(i => +i.point.y.toFixed(2));
      let atap2 = 0; levelGroups[1].traverse(m => { if (m.isMesh && m.userData.atap) atap2++; });
      return { void: naik(1, 4), celah: naik(4.6, 1), kamar: naik(8, 4), atap2, teras: naik(10.4, 4) };
    });
    assert.deepEqual(r.void, [6.2], 'void: hanya atap lantai 2, tanpa atap rendah lantai 1: ' + JSON.stringify(r));
    assert.deepEqual(r.celah, [6.2], 'celah di antara kotak pelat & dinding miring kini beratap: ' + JSON.stringify(r));
    assert.deepEqual(r.kamar, [6.2]);
    assert.equal(r.atap2, 1, 'satu atap lantai 2 (tanpa sambungan)');
    assert.ok(r.teras.length >= 1, 'tritisan tetap ada: ' + JSON.stringify(r.teras));
  },
};
