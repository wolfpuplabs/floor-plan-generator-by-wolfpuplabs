import assert from 'node:assert/strict';
import { muatProyekJSON } from './harness.mjs';

// JEV-134: pose memancing — kedua tangan memegang joran di depan perut (bukan terangkat di atas kepala); di kamera orang
// ketiga joran menempel di tangan kanan avatar & condong ke depan-atas ke arah air; arah acuan lengan dari sendi berikutnya
// (bukan tulang kain M.vrm)
const obj = (id, kind, type, x, z, params = {}) => ({ id, kind, type, x, y: 0, z, rotY: 0, sx: 1, sy: 1, sz: 1, params });

export const tes = {
  'pose memancing: tangan di depan perut, berdekatan, di bawah bahu; orang ketiga: joran di tangan kanan avatar, condong ke depan-atas': async (page) => {
    await muatProyekJSON(page, { v: 1, levels: [{ name: 'L1', height: 3, walls: [], objects: [obj('kolam', 'area', 'kolam_ikan', 3, 14, { jenis: 'kolam_ikan', kedalaman: 0.6, pts: [[-2, -1.4], [2, -1.4], [2, 1.4], [-2, 1.4]] })] }] });
    const r = await page.evaluate(async () => {
      const out = {};
      await muatModul('lobi'); await muatModul('npc'); const G = window.LOBI.gerak;
      for (const k of ['F', 'M']) {
        const tpl = await window.LOBI.muatAvatar3D({ bawaan: k }), m = klonModel(tpl); m.userData.rigIdx = tpl.userData.rigIdx; m.userData.kedipIdx = []; m.userData.klip = [];
        const g = new THREE.Group(); g.add(m); scene.add(g); const a = { g, tuju: { po: 12 } }; G.siapkanGerak(a, m); a.tm = a.lt = 1e9;
        for (let i = 0; i < 60; i++) G.gerakAvatar(a, 0.05, 0); scene.updateMatrixWorld(true);
        // tulang tangan sesungguhnya (M.vrm punya tulang kain sebagai anak pertama lengan)
        const ujung = r => { let h = null; r.b.traverse(x => { if (!h && x !== r.b && x.isBone && /hand/i.test(x.name) && !/(thumb|index|middle|ring|little)/i.test(x.name)) h = x; });
          return (h || r.b.children.find(x => x.isBone)).getWorldPosition(new THREE.Vector3()); };
        const ka = ujung(a.rig.rightLowerArm), ki = ujung(a.rig.leftLowerArm), bahu = a.rig.rightUpperArm.b.getWorldPosition(new THREE.Vector3());
        out[k] = { ka: ka.toArray().map(v => +v.toFixed(2)), ki: ki.toArray().map(v => +v.toFixed(2)), bahuY: +bahu.y.toFixed(2), jarak: +ka.distanceTo(ki).toFixed(2) };
        scene.remove(g);
      }
      // orang ketiga: joran di tangan kanan avatar
      enterFPS(); camera.position.set(3, 1.6, 11.8); FPS.yaw = 0; FPS.pitch = -0.7; fpsStep(0); scene.updateMatrixWorld(); AIM_T = 0; stepBidik(0.2);
      pakai(AIM); for (let i = 0; i < 100 && !window.AKT; i++) await new Promise(ok => setTimeout(ok, 50)); await new Promise(ok => setTimeout(ok, 100));
      await muatModul('orangtiga'); window.ORANG3.togel(); for (let i = 0; i < 300 && !window.ORANG3._uji.S.a; i++) await new Promise(ok => setTimeout(ok, 100));
      for (let i = 0; i < 40; i++) await new Promise(ok => requestAnimationFrame(ok));
      const A = window.AKT._uji.A(), tg = window.ORANG3.tangan(), arah = new THREE.Vector3(0, 1, 0).applyQuaternion(A.alat.quaternion);
      out.joran = { jarak: +A.alat.position.distanceTo(tg).toFixed(2), naik: +arah.y.toFixed(2), maju: +arah.z.toFixed(2) };
      window.ORANG3.togel(); localStorage.removeItem('kamera3'); window.AKT.selesai && window.AKT.selesai(); exitFPS();
      return out; });
    for (const k of ['F', 'M']) {
      const v = r[k];
      assert.ok(v.ka[2] > 0.2 && v.ki[2] > 0.2, k + ' tangan di depan badan: ' + JSON.stringify(v));
      assert.ok(v.ka[1] < v.bahuY - 0.12 && v.ki[1] < v.bahuY - 0.12 && v.ka[1] > 0.75, k + ' setinggi perut, bukan di atas kepala: ' + JSON.stringify(v));
      assert.ok(v.jarak < 0.3, k + ' kedua tangan memegang joran berdekatan: ' + JSON.stringify(v));
    }
    assert.ok(r.joran.jarak < 0.15, 'joran di tangan avatar: ' + JSON.stringify(r.joran));
    assert.ok(r.joran.naik > 0.4 && r.joran.naik < 0.95 && r.joran.maju > 0.3, 'joran condong ke depan-atas (ke air): ' + JSON.stringify(r.joran));
  },

  'JEV-135: duduk di depan api / di lantai menapak tanah (kaki tidak tenggelam, bokong tidak melayang); ikan 3D bersirip & bermotif, sepatu bot untuk sampah; tombol kamera orang ketiga sendiri di dok': async (page) => {
    await muatProyekJSON(page, { v: 1, levels: [{ name: 'L1', height: 3, walls: [], objects: [] }] });
    const r = await page.evaluate(async () => {
      const out = {};
      await muatModul('lobi'); await muatModul('npc'); const G = window.LOBI.gerak;
      for (const po of [25, 2]) for (const k of ['F', 'M']) {
        const tpl = await window.LOBI.muatAvatar3D({ bawaan: k }), m = klonModel(tpl); m.userData.rigIdx = tpl.userData.rigIdx; m.userData.kedipIdx = []; m.userData.klip = [];
        const g = new THREE.Group(); g.add(m); scene.add(g); const a = { g, tuju: { po } }; G.siapkanGerak(a, m); a.tm = a.lt = 1e9;
        for (let i = 0; i < 80; i++) G.gerakAvatar(a, 0.05, 0); scene.updateMatrixWorld(true);
        let minY = 1e9; m.traverse(o => { if (o.isSkinnedMesh) { const p = o.geometry.attributes.position, v = new THREE.Vector3();
          for (let i = 0; i < p.count; i += 5) { v.fromBufferAttribute(p, i); o.boneTransform(i, v); v.applyMatrix4(o.matrixWorld); minY = Math.min(minY, v.y); } } });
        out[po + k] = { kulit: +minY.toFixed(3), pinggul: +a.rig.hips.b.getWorldPosition(new THREE.Vector3()).y.toFixed(2) }; scene.remove(g);
      }
      await muatModul('aktivitas'); const U = window.AKT._uji;
      out.ikan = U.IKAN.map(f => { const g = f.sampah ? U.sepatuMesh(f.w) : U.ikanMesh(f.w, f.k); let n = 0, kanvas = 0; g.traverse(x => { if (x.isMesh) { n++; if (x.material.map && x.material.map.isCanvasTexture) kanvas++; } });
        const bb = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3()); return { k: f.k, n, kanvas, panjang: +bb.z.toFixed(2), tinggi: +bb.y.toFixed(2) }; });
      const o3 = $('#fpsO3'); out.tombol = { diDok: !!o3.closest('#fpsDok'), kelas: o3.classList.contains('fps-ik'), ikon: !!o3.querySelector('use[href="#l-switch-camera"]'), diLembar: !!o3.closest('#fpsLembar'), label: o3.getAttribute('aria-label') };
      return out; });
    for (const k of ['25F', '25M', '2F', '2M']) {
      assert.ok(r[k].kulit > -0.06 && r[k].kulit < 0.05, k + ' menapak tanah (tidak tenggelam / melayang): ' + JSON.stringify(r[k]));
      assert.ok(r[k].pinggul < 0.32, k + ' bokong di tanah, bukan jongkok: ' + JSON.stringify(r[k]));
    }
    for (const f of r.ikan.filter(x => x.k !== 'sepatu')) {
      assert.ok(f.n >= 10 && f.kanvas === 1, f.k + ' badan bertekstur + sirip & mata: ' + JSON.stringify(f));
      assert.ok(f.panjang > 1.6 * f.tinggi, f.k + ' memanjang (gurame memang tinggi): ' + JSON.stringify(f));
    }
    const sp = r.ikan.find(x => x.k === 'sepatu'); assert.ok(sp.kanvas === 0 && sp.tinggi > 0.15, 'sepatu bot: ' + JSON.stringify(sp));
    assert.deepEqual(r.tombol, { diDok: true, kelas: true, ikon: true, diLembar: false, label: 'Kamera orang ketiga' });
  },
};
