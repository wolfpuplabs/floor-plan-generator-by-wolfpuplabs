import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { FIX, muatProyekJSON } from './harness.mjs';

// JEV-130: duduk di model unggahan — jok & arah hadap dicari dari bentuk model (dua kursi dalam satu model, jok mobil,
// kursi yang depannya bukan +Z); kepribadian NPC mengikuti tubuhnya (NPC F → kartu perempuan, NPC M → kartu laki-laki)
const RUANG = { v: 1, levels: [{ name: 'L1', height: 3, walls: [], objects: [] }] };

export const tes = {
  'duduk di model: dua kursi kemah dalam satu model → duduk di kursi yang dibidik, menghadap depan kursi; mobil → jok terdekat menghadap kaca depan; arah manual tetap dihormati': async (page) => {
    await muatProyekJSON(page, RUANG);
    await page.waitForFunction(() => !!window.KURSI, undefined, { timeout: 30000 });
    const gltf = JSON.parse(fs.readFileSync(path.join(FIX, 'kursi_1k.gltf'), 'utf8'));
    const bin = fs.readFileSync(path.join(FIX, 'kursi.bin')).toString('base64'), jpg = fs.readFileSync(path.join(FIX, 'kursi_diff_1k.jpg')).toString('base64');
    const r = await page.evaluate(async ([gltf, bin, jpg]) => {
      const isi = { 'kursi.bin': new Uint8Array(bufFromB64(bin)), 'textures/kursi_diff_1k.jpg': new Uint8Array(bufFromB64(jpg)) };
      const a = await daftarkanAset('Kursi', gltfKeGLB(gltf, uri => /^data:/.test(uri) ? dataURIkeU8(uri) : isi[uri]));
      const m = (id, x, z, rotY, params = {}) => ({ id, kind: 'model', type: a.id, x, y: 0, z, rotY, sx: 1, sy: 1, sz: 1, params: { interaksi: 'duduk', collider: false, ...params } });
      L().objects.push(m('mDua', 2, 2, 0), m('mMobil', 8, 2, 0), m('mPutar', 2, 7, Math.PI / 2), m('mManual', 5, 7, 0, { arahDuduk: 90 }));
      rebuildScene();
      // isi model diganti bentuk uji (bentuk berkas aslinya tidak penting di sini)
      const kotak = (g, w, h, d, x, y, z, rx = 0) => { const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial()); k.position.set(x, y, z); k.rotation.x = rx; g.add(k); };
      const ganti = (id, isiBaru) => { const g = findGroup('obj', id); for (const c of [...g.children]) g.remove(c); const w = new THREE.Group(); isiBaru(w); g.add(w); g.updateMatrixWorld(true); return g; };
      const duaKursi = w => { for (const x of [-0.35, 0.35]) { kotak(w, 0.5, 0.04, 0.45, x, 0.42, 0); kotak(w, 0.5, 0.5, 0.04, x, 0.7, 0.24, -0.2);
        for (const [dx, dz] of [[-0.23, -0.2], [0.23, -0.2], [-0.23, 0.2], [0.23, 0.2]]) kotak(w, 0.03, 0.42, 0.03, x + dx, 0.21, dz); } };   // depan kursi = −Z
      const gD = ganti('mDua', duaKursi), gP = ganti('mPutar', duaKursi), gM = ganti('mManual', duaKursi);
      const gC = ganti('mMobil', w => { kotak(w, 4, 0.5, 1.8, 0, 0.55, 0); kotak(w, 2.6, 0.06, 1.8, -0.4, 1.95, 0);   // depan mobil = +X
        kotak(w, 4, 1.15, 0.05, 0, 1.38, 0.9); kotak(w, 4, 1.15, 0.05, 0, 1.38, -0.9); kotak(w, 0.3, 0.5, 1.7, 0.75, 1.1, 0);
        for (const z of [-0.45, 0.45]) { kotak(w, 0.5, 0.12, 0.5, 0.2, 0.86, z); kotak(w, 0.1, 0.6, 0.5, -0.1, 1.2, z); }
        kotak(w, 0.5, 0.12, 1.4, -1.0, 0.86, 0); kotak(w, 0.1, 0.6, 1.4, -1.3, 1.2, 0); });
      enterFPS(); camera.position.set(2, 1.6, 0); fpsStep(0);
      const out = {}, sudut = y => +(((y % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI).toFixed(2);
      const coba = (id, grp, titik) => { duduk({ id, grp, titik: new THREE.Vector3(...titik) }); for (let i = 0; i < 40; i++) fpsStep(0.05);
        const v = { x: +camera.position.x.toFixed(2), y: +camera.position.y.toFixed(2), z: +camera.position.z.toFixed(2), yaw: sudut(FPS.yaw) }; berdiri(); return v; };
      out.kanan = coba('mDua', gD, [2.45, 0.6, 1.7]); out.kiri = coba('mDua', gD, [1.6, 0.6, 1.7]);
      out.sopir = coba('mMobil', gC, [8.2, 1.2, 1.1]); out.penumpang = coba('mMobil', gC, [8.2, 1.2, 2.9]); out.belakang = coba('mMobil', gC, [7.0, 1.2, 2.9]);
      out.putar = coba('mPutar', gP, [1.7, 0.6, 7.4]); out.manual = coba('mManual', gM, [5.3, 0.6, 7]);
      exitFPS();
      // panel: Arah hadap bawaan = Otomatis
      select('obj', 'mDua'); renderInspector();
      const s = [...document.querySelectorAll('#inspector select')].find(x => [...x.options].some(o => o.value === '270')); out.opsi = s && [s.value, s.options[0].textContent];
      return out; }, [gltf, bin, jpg]);
    // dua kursi: duduk di kursi yang dibidik (bukan celah tengah x = 2), menghadap −Z (yaw ±π)
    assert.ok(Math.abs(r.kanan.x - 2.35) < 0.08 && Math.abs(r.kiri.x - 1.65) < 0.08, 'kursi yang dibidik: ' + JSON.stringify(r));
    assert.ok(Math.abs(Math.abs(r.kanan.yaw) - Math.PI) < 0.05 && Math.abs(Math.abs(r.kiri.yaw) - Math.PI) < 0.05, 'menghadap depan kursi: ' + JSON.stringify(r));
    assert.ok(Math.abs(r.kanan.y - (0.44 + 0.02 + 0.72)) < 0.05, 'mata di atas dudukan: ' + r.kanan.y);
    // mobil: jok sopir / penumpang / belakang, semua menghadap kaca depan (+X → yaw π/2)
    assert.ok(Math.abs(r.sopir.z - 1.55) < 0.1 && Math.abs(r.penumpang.z - 2.45) < 0.1 && r.belakang.x < 7.3, 'jok mobil: ' + JSON.stringify(r));
    for (const k of ['sopir', 'penumpang', 'belakang']) assert.ok(Math.abs(r[k].yaw - Math.PI / 2) < 0.05, k + ' menghadap depan mobil: ' + JSON.stringify(r[k]));
    // model diputar 90°: depan kursi (−Z model) → −X dunia (yaw −π/2)
    assert.ok(Math.abs(r.putar.yaw + Math.PI / 2) < 0.05, 'ikut putaran model: ' + JSON.stringify(r.putar));
    // arah manual (Kanan +X) tetap dipakai, posisinya tetap di jok
    assert.ok(Math.abs(r.manual.yaw - Math.PI / 2) < 0.05 && Math.abs(r.manual.x - 5.35) < 0.12, 'arah manual: ' + JSON.stringify(r.manual));
    assert.deepEqual(r.opsi, ['', 'Otomatis']);
  },

  'kepribadian NPC mengikuti tubuhnya: NPC F hanya kartu perempuan (kartu laki-laki lama diganti), NPC M hanya laki-laki': async (page) => {
    const o = (id, type, x, params) => ({ id, kind: 'npc', type, x, y: 0, z: 3, rotY: Math.PI, sx: 1, sy: 1, sz: 1, params: { jelajah: 0, ...params } });
    await muatProyekJSON(page, { v: 1, levels: [{ name: 'L1', height: 3, walls: [], objects: [o('nF', 'F', 2, { benih: 1, kartu: 'tukang' }), o('nM', 'M', 4, { benih: 2, kartu: 'agen' }), o('nF2', 'F', 6, { benih: 3 })] }] });
    const r = await page.evaluate(async () => {
      await muatModul('kartunpc'); await muatModul('npc'); const K = window.KARTU_NPC, out = {};
      for (let b = 0; b < 40; b++) { out.f = out.f || new Set(); out.m = out.m || new Set(); out.f.add(K.kartuNpc(undefined, 'F', b)); out.m.add(K.kartuNpc(undefined, 'M', b)); }
      out.f = [...out.f].map(k => K.KARTU[k].jk); out.m = [...out.m].map(k => K.KARTU[k].jk);
      out.ganti = [K.KARTU[K.kartuNpc('tukang', 'F', 1)].jk, K.KARTU[K.kartuNpc('agen', 'M', 2)].jk, K.kartuNpc('pedagang', 'F', 0)];
      const opsi = id => { select('obj', id); renderInspector(); const s = [...document.querySelectorAll('#inspector select')].find(x => [...x.options].some(o => o.textContent.includes(' — ')));
        return s ? [...s.options].slice(1).map(o => K.KARTU[o.value].jk) : null; };
      out.opsiF = opsi('nF'); out.opsiM = opsi('nM');
      await new Promise(ok => setTimeout(ok, 50)); out.opsiF = out.opsiF || opsi('nF'); out.opsiM = out.opsiM || opsi('nM');
      return out; });
    assert.ok(r.f.length && r.f.every(j => j === 'F'), 'otomatis F: ' + JSON.stringify(r));
    assert.ok(r.m.length && r.m.every(j => j === 'M'), 'otomatis M: ' + JSON.stringify(r));
    assert.deepEqual(r.ganti, ['F', 'M', 'pedagang']);
    assert.ok(r.opsiF && r.opsiF.length >= 3 && r.opsiF.every(j => j === 'F'), 'pilihan F: ' + JSON.stringify(r.opsiF));
    assert.ok(r.opsiM && r.opsiM.length >= 4 && r.opsiM.every(j => j === 'M'), 'pilihan M: ' + JSON.stringify(r.opsiM));
  },
};
