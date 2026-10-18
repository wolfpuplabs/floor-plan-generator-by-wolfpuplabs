import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { FIX, muatProyekJSON } from './harness.mjs';

// JEV-131: berbaring — kepala di bantal tidur (ranjang pustaka & kasur model: bantal dicari dari bentuknya); pewarnaan kulit
// bertahap (tepi bikini tidak bercak pucat); resolusi adaptif pulih pada ≥ 30 fps & tidak turun di bawah 0,6
const o = (id, kind, type, x, z, params = {}) => ({ id, kind, type, x, y: 0, z, rotY: 0, sx: 1, sy: 1, sz: 1, params });

export const tes = {
  'berbaring: ranjang pustaka & kasur model (sandaran tebal, bangku kaki) → kepala di bantal tidur, bukan di tepi bawahnya': async (page) => {
    await muatProyekJSON(page, { v: 1, levels: [{ name: 'L1', height: 3, walls: [], objects: [o('b', 'furn', 'bed_double', 3, 3)] }] });
    await page.waitForFunction(() => !!window.KURSI, undefined, { timeout: 30000 });
    const gltf = JSON.parse(fs.readFileSync(path.join(FIX, 'kursi_1k.gltf'), 'utf8'));
    const bin = fs.readFileSync(path.join(FIX, 'kursi.bin')).toString('base64'), jpg = fs.readFileSync(path.join(FIX, 'kursi_diff_1k.jpg')).toString('base64');
    const r = await page.evaluate(async ([gltf, bin, jpg]) => {
      const out = {};
      enterFPS(); camera.position.set(4.3, 1.6, 3); fpsStep(0);
      baring({ id: 'b', grp: findGroup('obj', 'b') }); for (let i = 0; i < 40; i++) fpsStep(0.05);
      out.pustaka = { pinggul: +(FPS.duduk.baring.z - 3).toFixed(2), mata: +(camera.position.z - 3).toFixed(2) }; berdiri();
      // kasur model: kasur z −1…1, sandaran tebal di kepala, bangku di kaki (kotak batas memanjang ke kaki), bantal rebah di z −0,95…−0,5
      const isi = { 'kursi.bin': new Uint8Array(bufFromB64(bin)), 'textures/kursi_diff_1k.jpg': new Uint8Array(bufFromB64(jpg)) };
      const a = await daftarkanAset('Kursi', gltfKeGLB(gltf, uri => /^data:/.test(uri) ? dataURIkeU8(uri) : isi[uri]));
      L().objects.push({ id: 'mB', kind: 'model', type: a.id, x: 8, y: 0, z: 3, rotY: 0, sx: 1, sy: 1, sz: 1, params: { interaksi: 'baring', collider: false } }); rebuildScene();
      const kotak = (g, w, h, d, x, y, z) => { const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial()); k.position.set(x, y, z); g.add(k); };
      const g = findGroup('obj', 'mB'); for (const c of [...g.children]) g.remove(c); const w = new THREE.Group(); g.add(w);
      kotak(w, 1.6, 0.5, 2.0, 0, 0.25, 0); kotak(w, 1.7, 1.3, 0.12, 0, 0.65, -1.06); kotak(w, 1.4, 0.45, 0.4, 0, 0.225, 1.25);
      for (const x of [-0.4, 0.4]) kotak(w, 0.6, 0.14, 0.45, x, 0.57, -0.72);
      g.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(w), sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
      g.userData.baring = { a: 0, h: null, hl: 0.55, len: sz.z, wid: sz.x, cx: c.x - 8, cz: c.z - 3 };
      out.tengahLama = +(c.z - 3).toFixed(2);
      enterFPS(); camera.position.set(9.5, 1.6, 3); fpsStep(0);
      baring({ id: 'mB', grp: g }); for (let i = 0; i < 40; i++) fpsStep(0.05);
      out.model = { pinggul: +(FPS.duduk.baring.z - 3).toFixed(2), mata: +(camera.position.z - 3).toFixed(2) }; berdiri(); exitFPS();
      return out; }, [gltf, bin, jpg]);
    // ranjang pustaka 2 m: bantal tidur z −0,85…−0,43 → pinggul −0,22 (kepala ±0,5 m dari pinggul = di tengah bantal)
    assert.ok(Math.abs(r.pustaka.pinggul + 0.22) < 0.02 && Math.abs(r.pustaka.mata + 0.75) < 0.03, 'ranjang pustaka: ' + JSON.stringify(r));
    // kasur model: tengah kotak batas +0,15 (bangku kaki) → pinggul diukur dari bantal (tengah −0,72 + 0,42)
    assert.ok(r.tengahLama > 0.1, 'kotak batas memanjang ke kaki: ' + r.tengahLama);
    assert.ok(Math.abs(r.model.pinggul + 0.3) < 0.06, 'kasur model: pinggul dari bantal, bukan tengah kotak: ' + JSON.stringify(r));
    assert.ok(r.model.mata < r.model.pinggul - 0.45, 'mata di sisi kepala: ' + JSON.stringify(r.model));
  },

  'pewarnaan kulit bertahap: kulit & bayangannya penuh, kain kuning / putih tidak, tepi campuran sebagian; resolusi adaptif pulih ≥ 30 fps, batas bawah 0,6': async (page) => {
    await muatProyekJSON(page, { v: 1, levels: [{ name: 'L1', height: 3, walls: [], objects: [] }] });
    const r = await page.evaluate(async () => {
      await muatModul('npc'); const B = window.NPC._uji.bobotKulit, ref = [232, 186, 160], f = c => +B(...c, ref).toFixed(2);
      const out = { kulit: f(ref), bayang: f([116, 93, 80]), kuning: f([232, 190, 40]), putih: f([250, 250, 250]), campur: f([232, 188, 100]), hitam: f([5, 4, 4]) };
      // resolusi adaptif
      const dpr = RES.dasar; RES.skala = 0.6; RES.lambat = 0; RES.lancar = 0; renderer.setPixelRatio(dpr * 0.6);
      for (let i = 0; i < 35 * 20; i++) aturResolusi(1 / 35);                         // 35 fps selama 20 dtk
      out.pulih = +RES.skala.toFixed(2);
      for (let i = 0; i < 20 * 30; i++) aturResolusi(1 / 20);                          // 20 fps lama
      out.lambat = +RES.skala.toFixed(2);
      RES.skala = 1; renderer.setPixelRatio(dpr); RES.lambat = RES.lancar = 0;
      return out; });
    assert.ok(r.kulit > 0.95 && r.bayang > 0.9, 'kulit & bayangan: ' + JSON.stringify(r));
    assert.ok(r.kuning < 0.05 && r.putih < 0.05 && r.hitam < 0.05, 'kain / putih / hitam tidak: ' + JSON.stringify(r));
    assert.ok(r.campur > 0.1 && r.campur < 0.95, 'tepi campuran sebagian: ' + JSON.stringify(r));
    assert.equal(r.pulih, 1, 'pulih pada 35 fps');
    assert.ok(r.lambat >= 0.6 && r.lambat < 0.7, 'batas bawah 0,6: ' + r.lambat);
  },
};
