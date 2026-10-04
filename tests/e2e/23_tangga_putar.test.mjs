import assert from 'node:assert/strict';

// JEV-072: tangga putar — pegangan tangan heliks + rel tengah menyambung baluster (dulu tiang
// berdiri sendiri-sendiri tanpa pegangan), dua baluster per anak tangga, dan pagarnya menahan
// badan di mode jalan selama kaki di atas anak tangga
const pasang = (page, varian) => page.evaluate(v => {
  PROJECT.levels[0].walls = [[0, 0, 6, 0], [6, 0, 6, 5], [6, 5, 0, 5], [0, 5, 0, 0]].map(([a, b, c, d]) => ({ id: uid('w'), x1: a, z1: b, x2: c, z2: d, thickness: 0.15, openings: [] }));
  PROJECT.levels[0].objects = [];
  addObject('stair', v); const o = L().objects[L().objects.length - 1]; o.x = 3; o.z = 2.5; o.params.railing = true; rebuildScene();
  let pegangan = 0, baluster = 0, puncak = -1e9;
  for (const g of grupObjek(o.id)) g.traverse(m => { if (!m.isMesh) return;
    if (m.userData.pegangan) { pegangan++; m.geometry.computeBoundingBox(); puncak = Math.max(puncak, m.geometry.boundingBox.max.y); }
    if (m.geometry.type === 'CylinderGeometry' && m.geometry.parameters.radiusTop === 0.013) baluster++; });
  const c = stairCalc(o.params, L().height);
  return { id: o.id, n: c.n, rise: c.rise, riser: c.riser, pegangan, baluster, puncak, R: o.params.radius || 0.95 };
}, varian);

export const tes = {
  'tangga putar: pegangan heliks menyambung dua baluster per anak tangga': async (page) => {
    const t = await pasang(page, 'spiral');
    assert.equal(t.pegangan, 1, 'satu pegangan tangan heliks');
    assert.equal(t.baluster, 2 * t.n);
    assert.ok(Math.abs(t.puncak - (t.rise + 0.95)) < 0.3, `pegangan berakhir setinggi pagar di atas anak tangga teratas (${t.puncak.toFixed(2)})`);
    const l = await pasang(page, 'curved');
    assert.equal(l.pegangan, 2, 'tangga lengkung: pegangan sisi luar & dalam');
  },
  'mode jalan: pagar tangga putar menahan badan di atas anak tangga, tidak di lantai': async (page) => {
    const t = await pasang(page, 'spiral');
    const r = await page.evaluate(t => {
      const o = L().objects.find(x => x.id === t.id), jari = ([x, z]) => Math.hypot(x - o.x, z - o.z);
      const diTangga = jari(fpsResolveWalls(o.x + 1.3, o.z, t.riser * 6));           // kaki di anak tangga ke-6, melangkah keluar pagar
      const diLantai = jari(fpsResolveWalls(o.x + 1.3, o.z, 0));                      // berdiri di lantai di samping tangga
      const diAtas = jari(fpsResolveWalls(o.x + 1.3, o.z, t.rise));                   // sudah di lantai atas
      return { diTangga, diLantai, diAtas, batas: t.R - 0.06 - FPS.r };
    }, t);
    assert.ok(r.diTangga <= r.batas + 1e-6, 'tertahan pagar: ' + JSON.stringify(r));
    assert.ok(Math.abs(r.diLantai - 1.3) < 1e-6, 'di lantai bawah tidak terhalang pagar');
    assert.ok(Math.abs(r.diAtas - 1.3) < 1e-6, 'di lantai atas tidak terhalang pagar');
  },
};
