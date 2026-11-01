import assert from 'node:assert/strict';
import { muatProyekJSON } from './harness.mjs';

// JEV-141: (1) beton ekspos — anti pola berulang dulu mencampur salinan tekstur yang DIPUTAR 37°, sehingga sambungan bekisting
// tampak sebagai garis diagonal di dinding; kini salinannya digeser satu panel (sambungan tetap lurus). Tekstur acak tanpa
// sambungan (cat, plester, lantai beton, teraso) tetap memakai putaran. (2) dinding lantai atas yang bertumpuk tepat di atas
// dinding lantai bawah: kaki 6 cm yang dibenamkan dulu sebidang dengan puncak dinding bawah → di void tampak strip putus-putus
// (z-fighting); kini kakinya balok terpisah yang lebih tipis.
const kotak = (x0, z0, x1, z1, p) => [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]].map(([a, b, c, d], i) => ({ id: p + i, x1: a, z1: b, x2: c, z2: d, thickness: 0.2, openings: [] }));

export const tes = {
  'beton ekspos: salinan anti-ulang digeser satu panel (bukan diputar); dinding bertumpuk di lantai atas tidak sebidang dengan dinding bawah': async (page) => {
    await muatProyekJSON(page, { v: 1, finish: { in: 'beton', out: 'beton', floor: 'parket' }, levels: [
      { name: 'L1', height: 3.2, walls: kotak(0, 0, 8, 6, 'a'), objects: [] },
      { name: 'L2', height: 3, walls: kotak(0, 0, 8, 6, 'b'), objects: [] }] });
    const r = await page.evaluate(() => {
      // shader: rakit dengan shader standar three lalu baca bagian map_fragment
      const frag = kunci => { const tabel = kunci[0] === 'L' ? LANTAI : FINISH, m = finMat(tabel, kunci.slice(2));
        const sh = { vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} };
        m.onBeforeCompile(sh); const f = sh.fragmentShader; return { geser: /vUv\+vec2\(0\.5\)/.test(f), putar: /mat2\(0\.8,-0\.6,0\.6,0\.8\)/.test(f) }; };
      const out = { W_beton: frag('W_beton'), W_plester: frag('W_plester'), L_beton: frag('L_beton') };
      // dinding: kotak batas tiap panel (koordinat lokal grup dinding) di lantai 2
      const cari = (i, id) => levelGroups[i].children.find(c => c.userData.kind === 'wall' && c.userData.id === id), g2 = cari(1, 'b0'), g1 = cari(0, 'a0');
      const panel = g => { const a = []; g.traverse(m => { if (m.isMesh && m.userData.wallPanel) { m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox;
        a.push({ y0: +(m.position.y + b.min.y).toFixed(3), y1: +(m.position.y + b.max.y).toFixed(3), tebal: +(b.max.z - b.min.z).toFixed(3) }); } }); return a; };
      out.l2 = panel(g2); out.l1 = panel(g1);
      return out; });
    assert.deepEqual(r.W_beton, { geser: true, putar: false }, 'beton: geser satu panel');
    assert.deepEqual(r.W_plester, { geser: false, putar: true }, 'plester tetap diputar');
    assert.deepEqual(r.L_beton, { geser: false, putar: true }, 'lantai beton (tanpa sambungan) tetap diputar');
    // lantai 1: kaki dibenamkan seperti dulu (tidak ada dinding di bawahnya)
    assert.ok(r.l1.length === 1 && r.l1[0].y0 === -0.06 && r.l1[0].tebal === 0.2, 'lantai 1: ' + JSON.stringify(r.l1));
    // lantai 2: panel setebal dinding mulai tepat di lantai; kaki 6 cm lebih tipis
    const tebal = r.l2.filter(p => p.tebal === 0.2), kaki = r.l2.filter(p => p.tebal < 0.2);
    assert.ok(tebal.length === 1 && tebal[0].y0 === 0, 'panel lantai 2 tidak turun ke puncak dinding bawah: ' + JSON.stringify(r.l2));
    assert.ok(kaki.length === 1 && kaki[0].y0 === -0.06 && kaki[0].y1 === 0 && kaki[0].tebal === 0.194, 'kaki tipis: ' + JSON.stringify(r.l2));
  },
};
