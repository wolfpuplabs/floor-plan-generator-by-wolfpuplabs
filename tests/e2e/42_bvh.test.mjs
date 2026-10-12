import assert from 'node:assert/strict';

// JEV-093: raycast BVH untuk model besar — hasil sama dengan raycast bawaan, jauh lebih cepat;
// mode jalan dengan model ±390 rb segitiga tidak lagi ratusan milidetik per frame

const modelBerat = page => page.evaluate(async () => {
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: 0x8a7a66 });
  const lantai = new THREE.PlaneGeometry(11, 11, 400, 400); lantai.rotateX(-Math.PI / 2);
  const p = lantai.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, 0.05 * Math.sin(p.getX(i) * 3) * Math.cos(p.getZ(i) * 2)); lantai.computeVertexNormals();
  g.add(new THREE.Mesh(lantai, mat));
  for (let k = 0; k < 6; k++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 4, 96, 60), mat); c.position.set(-4 + k * 1.6, 2, -4); g.add(c); }
  const glb = await new Promise(ok => new THREE.GLTFExporter().parse(g, ok, { binary: true }));
  const id = (await daftarkanAset('Reruntuhan uji', glb)).id;
  L().objects.push({ id: 'rr', kind: 'model', type: id, x: 0, y: 0, z: 0, rotY: 0.3, sx: 1, sy: 1, sz: 1, params: {} }); rebuildScene();
  return id;
});

export const tes = {
  'BVH: sinar acak mengenai titik yang sama dengan raycast bawaan (jarak, objek, sisi)': async (page) => {
    await modelBerat(page);
    await page.waitForFunction(() => window.BVH && !BVH.sisa(), undefined, { timeout: 60000 });
    const r = await page.evaluate(() => {
      const g = findGroup('obj', 'rr'); g.updateMatrixWorld(true);
      const rc = new THREE.Raycaster(), acak = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
      let sama = 0, beda = [], kena = 0, bvh = 0;
      g.traverse(m => { if (m.isMesh && m.geometry.bvhPohon) bvh++; });
      const asli = new Map(); g.traverse(m => { if (m.isMesh) asli.set(m, m.geometry.bvhPohon); });
      for (let i = 0; i < 300; i++) {
        const o = new THREE.Vector3((acak() - 0.5) * 12, 0.2 + acak() * 5, (acak() - 0.5) * 12), d = new THREE.Vector3(acak() - 0.5, acak() - 0.8, acak() - 0.5).normalize();
        rc.set(o, d); rc.far = 20;
        const a = rc.intersectObject(g, true).map(h => +h.distance.toFixed(4));
        for (const m of asli.keys()) m.geometry.bvhPohon = null;
        const b = rc.intersectObject(g, true).map(h => +h.distance.toFixed(4));
        for (const [m, t] of asli) m.geometry.bvhPohon = t;
        if (a.length) kena++;
        if (JSON.stringify(a) === JSON.stringify(b)) sama++; else beda.push([a.slice(0, 3), b.slice(0, 3)]);
      }
      return { sama, kena, bvh, beda: beda.slice(0, 2) };
    });
    assert.ok(r.bvh >= 2, 'mesh besar diberi BVH: ' + r.bvh);
    assert.ok(r.kena > 100, 'sinar uji cukup banyak yang kena: ' + r.kena);
    assert.equal(r.sama, 300, JSON.stringify(r.beda));
  },
  'mode jalan dengan model ±390 rb segitiga: logika per frame jauh lebih cepat & kaki di permukaan model': async (page) => {
    await modelBerat(page);
    await page.waitForFunction(() => window.BVH && !BVH.sisa(), undefined, { timeout: 60000 });
    const r = await page.evaluate(() => {
      enterFPS(); camera.position.set(0, 1.7, 3); FPS.feet = 0.05;
      const ukur = () => { const t0 = performance.now(); for (let i = 0; i < 20; i++) fpsStep(1 / 60); return (performance.now() - t0) / 20; };
      const cepat = ukur(), kaki = FPS.feet;
      const simpan = []; findGroup('obj', 'rr').traverse(m => { if (m.isMesh && m.geometry.bvhPohon) { simpan.push([m.geometry, m.geometry.bvhPohon]); m.geometry.bvhPohon = null; } });
      const lambat = ukur(); for (const [g, t] of simpan) g.bvhPohon = t; exitFPS();
      return { cepat, lambat, kaki };
    });
    assert.ok(r.cepat * 5 < r.lambat, `BVH ${r.cepat.toFixed(1)} ms vs tanpa ${r.lambat.toFixed(1)} ms`);
    assert.ok(Math.abs(r.kaki) < 0.12 && r.kaki > -0.02, 'kaki di permukaan lantai model: ' + r.kaki);
  },
};
