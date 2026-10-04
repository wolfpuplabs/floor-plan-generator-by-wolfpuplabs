import assert from 'node:assert/strict';

// JEV-070: (1) ruang dobel tinggi (void) — dinding lantai 1 & 2 di sekeliling void menerima
// pantulan cahaya ruang yang sama, lampu yang menggantung di void dihitung untuk ruang bawahnya;
// (2) atap lantai bawah tidak menumpuk dengan pelat/balkon lantai atas, tepi lengkung halus
const W = (a, b, c, d, x = {}) => ({ id: 'w' + Math.random().toString(36).slice(2, 9), x1: a, z1: b, x2: c, z2: d, thickness: 0.15, openings: [], ...x });
const kotak = (x0, z0, x1, z1) => [W(x0, z0, x1, z0), W(x1, z0, x1, z1), W(x1, z1, x0, z1), W(x0, z1, x0, z0)];

export const tes = {
  'void dobel tinggi: lampu di void untuk ruang bawah, peta GI menandai void, dinding atas & bawah menyatu': async (page) => {
    const r = await page.evaluate(async ([l1, l2]) => {
      const tidur = ms => new Promise(ok => setTimeout(ok, ms));
      PROJECT.levels[0].walls = l1; PROJECT.levels[0].objects = [];
      addLevel(); PROJECT.levels[1].walls = l2;
      PROJECT.levels[1].objects = [
        { id: 'v1', kind: 'void', type: 'rect', x: 2, y: 0, z: 3, rotY: 0, sx: 1, sy: 1, sz: 1, params: { shape: 'rect', w: 3.7, d: 5.7, railing: false, railH: 1, openSides: [] } },
        { id: 'p1', kind: 'furn', type: 'pendant', x: 2, y: 0, z: 3, rotY: 0, sx: 1, sy: 1, sz: 1, params: { lumen: 2500 } },
        { id: 'p2', kind: 'furn', type: 'pendant', x: 6, y: 0, z: 3, rotY: 0, sx: 1, sy: 1, sz: 1, params: { lumen: 1500 } }];
      setFX(false); setSuasana('malam'); toggleAtap(true); setActiveLevel(0); rebuildScene();
      enterFPS(); FPS.feet = 0; camera.position.set(3.6, 1.6, 3.0); FPS.yaw = -Math.PI / 2; FPS.pitch = 0.42;
      await tidur(6000); for (let i = 0; i < 10; i++) await tidur(600);
      const L = id => LAMPU_PASANG.find(x => x.id === id);
      const ruang1 = ruangDi(petaRuang(PROJECT.levels[0]), 2, 3);
      // atlas peta ruang: sel lantai 2 di dalam void bertanda 255
      const t = GI_U.giPeta.value.image, k = GI_KINI.peta.indexOf(petaRuang(PROJECT.levels[1]));
      const P = GI_KINI.peta[k], off = Math.round(GI_U.giBatas.value[k].z * t.height);
      const sel = (x, z) => t.data[(off + Math.floor((z - P.z0) / P.C)) * t.width + Math.floor((x - P.x0) / P.C)];
      renderer.render(scene, camera);
      const c = renderer.domElement, g = document.createElement('canvas'); g.width = c.width; g.height = c.height;
      const x = g.getContext('2d'); x.drawImage(c, 0, 0);
      const ukur = y => { const v = new THREE.Vector3(0.08, y, 3.0).project(camera); const px = Math.round((v.x + 1) / 2 * c.width), py = Math.round((1 - v.y) / 2 * c.height);
        const d = x.getImageData(px - 6, py - 6, 12, 12).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; return s / (d.length / 4); };
      const el2 = levelElevation(1);
      return { p1: [L('p1').idx, L('p1').lvGI, L('p1').ruang === ruang1], p2: [L('p2').lvGI, L('p2').ruang === L('p2').ruangAsli],
        void: sel(2, 3), kamar: sel(6, 3), bawah: ukur(el2 - 0.6), atas: ukur(el2 + 0.6) };
    }, [kotak(0, 0, 8, 6), kotak(0, 0, 8, 6).concat([W(4, 0, 4, 6)])]);
    assert.deepEqual(r.p1, [1, 0, true], 'lampu di void milik lantai 2 tetapi menerangi ruang lantai 1');
    assert.deepEqual(r.p2, [1, true], 'lampu di luar void tetap milik ruangnya sendiri');
    assert.equal(r.void, 255); assert.ok(r.kamar > 0 && r.kamar < 255);
    assert.ok(r.bawah > 0.78 * r.atas, `dinding bawah void (${r.bawah.toFixed(1)}) terlalu gelap dibanding atas (${r.atas.toFixed(1)})`);
  },
  'atap lantai bawah tidak menumpuk dengan balkon lantai atas; tepi lengkung halus': async (page) => {
    const r = await page.evaluate(([l1, l2]) => {
      PROJECT.levels[0].walls = l1; PROJECT.levels[0].objects = [];
      addLevel(); PROJECT.levels[1].walls = l2; PROJECT.levels[1].objects = [];
      toggleAtap(true); setActiveLevel(0); document.getElementById('otherLevels').value = 'solid'; rebuildScene(); scene.updateMatrixWorld(true);
      const kena = (x, z) => new THREE.Raycaster(new THREE.Vector3(x, 1.5, z), new THREE.Vector3(0, 1, 0)).intersectObjects(worldRoot.children, true)
        .filter(i => i.object.userData.atap).map(i => { let o = i.object; while (o && o.userData.levelIndex === undefined) o = o.parent; return o.userData.levelIndex; });
      let tri = 0; worldRoot.traverse(m => { if (m.isMesh && m.userData.atap && m.parent.userData.levelIndex === 0) tri += m.geometry.attributes.position.count / 3; });
      // tepi atap teluk lengkung (jari-jari 2 m + tritisan 0,6 m) mengikuti lingkaran
      const tepi = []; for (let a = 0.3; a < Math.PI - 0.3; a += 0.25) {
        let lo = 1.5, hi = 3.5; for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; (kena(5 - m * Math.cos(a), 8 + m * Math.sin(a)).includes(0) ? lo = m : hi = m); } tepi.push(lo); }
      return { balkon: kena(8, 2), teras: kena(9.5, 7), tri, tepi };
    }, (() => { const l1 = [W(0, 0, 10, 0), W(10, 0, 10, 8), W(7, 8, 10, 8), W(0, 8, 3, 8), W(0, 8, 0, 0)];
      for (let i = 0; i < 12; i++) { const a0 = Math.PI * i / 12, a1 = Math.PI * (i + 1) / 12; l1.push(W(5 - 2 * Math.cos(a0), 8 + 2 * Math.sin(a0), 5 - 2 * Math.cos(a1), 8 + 2 * Math.sin(a1))); }
      return [l1, kotak(0, 0, 6, 6).concat([W(6, 0, 9, 0, { rail: true }), W(9, 0, 9, 4, { rail: true }), W(9, 4, 6, 4, { rail: true })])]; })());
    assert.ok(!r.balkon.includes(0), 'balkon lantai 2 tidak tertutup atap lantai 1: ' + JSON.stringify(r.balkon));
    assert.ok(r.teras.includes(0), 'teras lantai 1 di luar pelat lantai 2 tetap beratap');
    assert.ok(r.tri < 400, 'atap dari kontur, bukan ratusan pita kisi: ' + r.tri);
    const sebar = Math.max(...r.tepi) - Math.min(...r.tepi);
    assert.ok(sebar < 0.08, 'tepi atap teluk mengikuti lengkung: ' + r.tepi.map(v => v.toFixed(3)).join(','));
  },
};
