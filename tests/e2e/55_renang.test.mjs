import assert from 'node:assert/strict';
import { muatProyekJSON } from './harness.mjs';

// JEV-113: berenang — masuk kolam renang dari bidikan, gerak di air, menyelam, naik ke tepi; pose 17/18 terkirim;
// NPC ikut berenang & berenang sendiri; baju renang (avatar/F_renang.vrm, F_renang2.vrm, M_renang.vrm) bila berkasnya ada
const dinding = [[0, 0, 12, 0], [12, 0, 12, 10], [12, 10, 0, 10], [0, 10, 0, 0]].map(([x1, z1, x2, z2], i) => ({ id: 'w' + i, x1, z1, x2, z2, thickness: 0.15, openings: [] }));
const obj = (id, kind, type, x, z, params = {}, rotY = 0) => ({ id, kind, type, x, y: 0, z, rotY, sx: 1, sy: 1, sz: 1, params });
const rumah = { v: 1, levels: [{ name: 'L1', height: 3, walls: dinding, objects: [
  obj('kolam', 'area', 'kolam_renang', 6, 14, { jenis: 'kolam_renang', bentuk: 'persegi', w: 4, d: 4, kedalaman: 1.4, pts: [[-2, -2], [2, -2], [2, 2], [-2, 2]] }),
  obj('nS', 'npc', 'F', 6, 11, { benih: 5, jelajah: 4, kartu: 'tetangga' }, Math.PI)] }] };
const tanpaNpc = { ...rumah, levels: [{ ...rumah.levels[0], objects: rumah.levels[0].objects.filter(o => o.kind !== 'npc') }] };

const bidik = (page, x, z, yaw, pitch) => page.evaluate(([x, z, yaw, pitch]) => { camera.position.set(x, 1.6, z); FPS.yaw = yaw; FPS.pitch = pitch; fpsStep(0); scene.updateMatrixWorld(); AIM_T = 0; stepBidik(0.2);
  return AIM && { jenis: AIM.jenis, label: labelAksi(AIM), ekstra: AIM.ekstra || [] }; }, [x, z, yaw, pitch]);
const siapNpc = page => page.waitForFunction(() => window.NPC && window.NPC.keadaan('nS') && window.NPC.keadaan('nS').siap, undefined, { timeout: 90000 });

export const tes = {
  'berenang: bidik kolam → Berenang; gerak di air tertahan tepi, menyelam membirukan layar, Selesai naik ke tepi; pose 17/18 terkirim': async (page) => {
    await muatProyekJSON(page, tanpaNpc);
    await page.evaluate(() => enterFPS());
    const a = await bidik(page, 6, 11.4, 0, -0.75);
    assert.deepEqual([a.jenis, a.label], ['renang', 'Berenang']);
    await page.evaluate(async () => { pakai(AIM); for (let i = 0; i < 100 && !(window.AKT && window.AKT.kunci()); i++) await new Promise(r => setTimeout(r, 50)); await muatModul('lobi'); });
    const r = await page.evaluate(() => {
      const K = window.AKT, A = K._uji.A(), G = window.LOBI.gerak, out = { kunci: K.kunci(), renang: K.renang(), hud: !$('#aktHud').hidden, airY: +A.airY.toFixed(2), feet: +FPS.feet.toFixed(2) };
      K.langkah(0.05); out.camY = +camera.position.y.toFixed(2); out.diam = G.posSaya().po;
      out.masuk = pointInPoly(camera.position.x, camera.position.z, A.poli);
      // maju (+Z) terus: berenang lalu tertahan dinding kolam di z = 16
      const z0 = camera.position.z; FPS.yaw = 0; FPS.keys.add('w');
      for (let i = 0; i < 20; i++) K.langkah(0.05); out.maju = +(camera.position.z - z0).toFixed(2); out.gerak = G.posSaya().po;
      for (let i = 0; i < 200; i++) K.langkah(0.05); out.zMaks = +camera.position.z.toFixed(2); FPS.keys.delete('w');
      for (let i = 0; i < 40; i++) K.langkah(0.05); out.berhenti = G.posSaya().po; out.jarak = Math.round(A.jarak);
      // menyelam: tahan Selam
      K._uji.tekan(1, true); for (let i = 0; i < 40; i++) K.langkah(0.05);
      out.selamY = +camera.position.y.toFixed(2); out.biru = +$('#aktHud .ak-air').style.opacity;
      K._uji.tekan(1, false); for (let i = 0; i < 60; i++) K.langkah(0.05);
      out.naikY = +camera.position.y.toFixed(2); out.biru2 = +$('#aktHud .ak-air').style.opacity;
      out.aman = [G.posAman({ jalan: 1, x: 0, y: 0, z: 0, yaw: 0, po: 17 }).po, G.posAman({ jalan: 1, x: 0, y: 0, z: 0, yaw: 0, po: 18 }).po, G.posAman({ jalan: 1, x: 0, y: 0, z: 0, yaw: 0, po: 27 }).po];
      return out; });
    assert.deepEqual([r.kunci, r.renang, r.hud, r.airY, r.feet, r.masuk], [true, true, true, -0.12, -0.12, true]);
    assert.ok(Math.abs(r.camY - (-0.01)) < 0.06, 'kepala tepat di atas air: ' + r.camY);
    assert.equal(r.diam, 17, 'mengapung');
    assert.ok(r.maju > 0.4, 'berenang maju: ' + r.maju); assert.equal(r.gerak, 18, 'gaya bebas');
    assert.ok(r.zMaks <= 16 - 0.29 && r.zMaks > 15.4, 'tertahan dinding kolam: ' + r.zMaks);
    assert.equal(r.berhenti, 17); assert.ok(r.jarak >= 2, 'jarak tercatat: ' + r.jarak);
    assert.ok(r.selamY < -0.9 && r.biru > 0.8, 'menyelam: ' + r.selamY + ' / ' + r.biru);
    assert.ok(r.naikY > -0.1 && r.biru2 < 0.1, 'muncul lagi: ' + r.naikY + ' / ' + r.biru2);
    assert.deepEqual(r.aman, [17, 18, undefined]);
    const k = await page.evaluate(() => { const A = window.AKT._uji.A(), poli = A.poli; window.AKT.selesai();
      return { kunci: window.AKT.kunci(), di: pointInPoly(camera.position.x, camera.position.z, poli), feet: +FPS.feet.toFixed(2), z: +camera.position.z.toFixed(2), pose: window.LOBI.gerak.posSaya().po || 0, kelas: document.body.classList.contains('aktivitas') }; });
    assert.deepEqual([k.kunci, k.di, k.pose, k.kelas], [false, false, 0, false]);
    assert.ok(k.feet > -0.05 && k.feet < 0.2 && k.z > 16.3, 'naik ke tepi terdekat: ' + JSON.stringify(k));
    await page.evaluate(() => exitFPS());
  },

  'NPC berenang: yang ikut ikut masuk kolam (mengapung / gaya bebas, badan telungkup), keluar bersama; berenang sendiri lalu naik ke tepi; tanpa berkas baju renang tetap berbaju biasa': async (page) => {
    // berkas baju renang karakter ini (benih 5 → F_renang2.vrm) dianggap tidak ada
    await page.route('**/avatar/F_renang2.vrm', r => r.fulfill({ status: 404, body: '' }));
    await muatProyekJSON(page, rumah);
    await siapNpc(page);
    await page.evaluate(async () => { enterFPS(); for (let i = 0; i < 3; i++) window.NPC.langkah(0.05); await muatModul('aktivitas'); });
    const r = await page.evaluate(async () => {
      const N = window.NPC, n = N._uji.NPC.get('nS'), out = {};
      camera.position.set(6, 1.6, 11.2); FPS.yaw = 0; N.aksiPasangan('nS', 'ikut'); for (let i = 0; i < 40; i++) N.langkah(0.05);
      pakai({ jenis: 'renang', id: 'kolam', titik: new THREE.Vector3(6, -0.12, 13) }); await new Promise(r => setTimeout(r, 200));
      const K = window.AKT, A = K._uji.A();
      out.mode = N.keadaan('nS').mode; out.y = +n.p.y.toFixed(2); out.di = pointInPoly(n.p.x, n.p.z, A.poli);
      for (let i = 0; i < 80; i++) { K.langkah(0.05); N.langkah(0.05); }
      const tulang = k => n.a.rig[k].b.getWorldPosition(new THREE.Vector3());
      n.a.model.updateMatrixWorld(true); out.apung = { po: n.po, kepala: +(tulang('head').y - A.airY).toFixed(2), pinggul: +(tulang('hips').y - A.airY).toFixed(2) };
      // pengunjung berenang menjauh → NPC menyusul dengan gaya bebas, badan mendatar
      FPS.keys.add('w'); let po18 = 0;
      for (let i = 0; i < 40; i++) { K.langkah(0.05); N.langkah(0.05); if (n.po === 18) po18++; }
      out.bebas = { po18, di: K.kolam.dalam(A.poli, n.p.x, n.p.z, 0.25) };
      FPS.keys.delete('w');
      out.baju = n.a.baju || '';
      K.selesai(); for (let i = 0; i < 5; i++) N.langkah(0.05);
      out.keluar = { mode: N.keadaan('nS').mode, di: pointInPoly(n.p.x, n.p.z, A.poli), y: +n.p.y.toFixed(2) };
      // berenang sendiri: kolam terdekat dalam jangkauan jelajah → masuk, berkeliling, waktu habis → naik ke tepi
      N.aksiPasangan('nS', 'lepas'); for (let i = 0; i < 3; i++) N.langkah(0.05);
      const kd = N._uji.kolamDekat('nS'); out.dekat = !!kd && Math.abs(kd.airY - A.airY) < 1e-6;
      N._uji.masukKolam('nS', kd); let datar = null, bobot = 0, jalur = 0;   // panjang lintasan (titik tuju acak & jeda: perpindahan bersih bisa kecil)
      for (let i = 0; i < 160; i++) { const q = n.p.clone(); N.langkah(0.05); jalur += Math.hypot(n.p.x - q.x, n.p.z - q.z); bobot = Math.max(bobot, n.a.pw[18]); if (n.a.pw[18] > 0.9) { const d = Math.abs(tulang('head').y - tulang('hips').y); datar = datar == null ? d : Math.max(datar, d); } }
      out.sendiri = { mode: n.mode, gerak: +jalur.toFixed(2), di: K.kolam.dalam(A.poli, n.p.x, n.p.z, 0.25), datar: datar == null ? null : +datar.toFixed(2), bobot: +bobot.toFixed(2) };
      n.renang.t = 0; N.langkah(0.05);
      out.naik = { mode: n.mode, di: pointInPoly(n.p.x, n.p.z, A.poli), y: +n.p.y.toFixed(2) };
      out.bajuAda = await N._uji.bajuRenang('F', '_renang2');
      return out; });
    assert.deepEqual([r.mode, r.y, r.di], ['renang', -0.12, true]);
    assert.equal(r.apung.po, 17);
    assert.ok(r.apung.kepala > 0.05 && r.apung.pinggul < -0.3, 'mengapung tegak, terendam sebatas bahu: ' + JSON.stringify(r.apung));
    assert.ok(r.bebas.po18 > 5 && r.bebas.di, 'gaya bebas saat menyusul, tetap di kolam: ' + JSON.stringify(r.bebas));
    assert.equal(r.baju, '', 'tanpa avatar/F_renang2.vrm: baju biasa');
    assert.deepEqual([r.keluar.mode, r.keluar.di], ['ikut', false]); assert.ok(r.keluar.y > -0.05, 'naik ke tepi: ' + r.keluar.y);
    assert.equal(r.dekat, true);
    assert.equal(r.sendiri.mode, 'renang'); assert.ok(r.sendiri.gerak > 1 && r.sendiri.di, 'berkeliling kolam: ' + JSON.stringify(r.sendiri));
    assert.ok(r.sendiri.bobot > 0.9 && r.sendiri.datar != null && r.sendiri.datar < 0.35, 'gaya bebas: badan telungkup mendatar: ' + JSON.stringify(r.sendiri));
    assert.deepEqual([r.naik.mode, r.naik.di], ['diam', false]); assert.ok(r.naik.y > -0.05);
    assert.equal(r.bajuAda, null);
    await page.evaluate(() => exitFPS());
  },

  'baju renang: NPC berganti ke avatar/*_renang*.vrm selama di air & kembali saat naik; karakter F memakai salah satu dari dua baju menurut benih': async (page) => {
    const dua = { ...rumah, levels: [{ ...rumah.levels[0], objects: [...rumah.levels[0].objects, obj('nM', 'npc', 'M', 8, 11, { benih: 4, jelajah: 4 }, Math.PI)] }] };
    await muatProyekJSON(page, dua);
    await siapNpc(page);
    await page.waitForFunction(() => window.NPC.keadaan('nM') && window.NPC.keadaan('nM').siap, undefined, { timeout: 90000 });
    await page.evaluate(async () => { enterFPS(); for (let i = 0; i < 3; i++) window.NPC.langkah(0.05); await muatModul('aktivitas'); });
    const r = await page.evaluate(async () => {
      const N = window.NPC, out = { sufiks: [['F', 4], ['F', 5], ['M', 5]].map(([k, b]) => window.LOBI.sufiksRenang(k, b)) };
      const diambil = []; const f = window.fetch; window.fetch = (u, o) => { diambil.push(String(u)); return f(u, o); };
      for (const id of ['nS', 'nM']) {
        const n = N._uji.NPC.get(id), lama = n.a.model;
        N._uji.masukKolam(id, N._uji.kolamDekat(id));
        for (let i = 0; i < 300 && !/_renang/.test(n.a.baju || ''); i++) { await new Promise(r => setTimeout(r, 50)); N.langkah(0.05); }
        let kain = 0, uk = 0; n.a.model.traverse(x => { if (x.isMesh && x.material.map && x.material.map.npcWarna) { kain++; uk = Math.max(uk, x.material.map.image.width); } });
        out[id] = { baju: n.a.baju, lepas: !lama.parent, po: n.po, rig: Object.keys(n.a.rig || {}).length, warna: kain > 0, uk };
        n.renang.t = 0; N.langkah(0.05);
        for (let i = 0; i < 40 && (n.a.baju || '') !== ''; i++) { await new Promise(r => setTimeout(r, 50)); N.langkah(0.05); }
        out[id].naik = { baju: n.a.baju || '', mode: n.mode };
      }
      window.fetch = f; out.diambil = diambil.filter(u => /avatar\//.test(u)).map(u => u.replace(/^.*avatar\//, ''));
      return out; });
    assert.deepEqual(r.sufiks, ['_renang', '_renang2', '_renang']);
    assert.deepEqual(r.diambil.sort(), ['F_renang2.vrm', 'M_renang.vrm']);
    for (const [id, baju] of [['nS', '_renang2'], ['nM', '_renang']]) {
      assert.equal(r[id].baju, baju, id + ': ' + JSON.stringify(r[id]));
      assert.ok(r[id].lepas && r[id].rig >= 10 && r[id].warna, 'model baju renang terpasang & diwarnai dari benih: ' + JSON.stringify(r[id]));
      assert.equal(r[id].uk, 1024, 'baju renang diwarnai pada 1024 px (tepi kain tipis tidak bergerigi)');
      assert.deepEqual(r[id].naik, { baju: '', mode: 'diam' });
    }
    await page.evaluate(() => exitFPS());
  },

  'arah badan: berbaring (9) telentang dengan kepala ke −Z (sandaran ranjang); gaya bebas (18) telungkup dengan kepala ke arah renang (+Z) — F & M': async (page) => {
    const r = await page.evaluate(async () => {
      await muatModul('lobi'); const G = window.LOBI.gerak, out = {};
      for (const jenis of ['F', 'M']) {
        const tpl = await window.LOBI.muatAvatar3D({ bawaan: jenis });
        for (const po of [0, 9, 18]) {
          const g = new THREE.Group(); scene.add(g); const m = klonModel(tpl); m.userData.rigIdx = tpl.userData.rigIdx; m.userData.kedipIdx = tpl.userData.kedipIdx; m.userData.klip = [];
          g.add(m); const a = { g, tuju: { po } }; G.siapkanGerak(a, m);
          for (let i = 0; i < 80; i++) G.gerakAvatar(a, 0.05, 0);
          g.updateMatrixWorld(true);
          const t = k => a.rig[k].b.getWorldPosition(new THREE.Vector3()), U = t('head').sub(t('hips'));
          const F = new THREE.Vector3().crossVectors(t('leftUpperArm').sub(t('rightUpperArm')), U).normalize();
          out[jenis + po] = { kepala: Math.sign(Math.round(U.z * 10)), wajah: Math.sign(Math.round(F.y * 10)), depan: Math.sign(Math.round(F.z * 10)) };
          scene.remove(g);
        }
      }
      return out; });
    for (const j of ['F', 'M']) {
      assert.equal(r[j + '0'].depan, 1, j + ' berdiri menghadap +Z: ' + JSON.stringify(r[j + '0']));
      assert.deepEqual([r[j + '9'].kepala, r[j + '9'].wajah], [-1, 1], j + ' berbaring telentang, kepala ke sandaran: ' + JSON.stringify(r[j + '9']));
      assert.deepEqual([r[j + '18'].kepala, r[j + '18'].wajah], [1, -1], j + ' gaya bebas telungkup, kepala ke depan: ' + JSON.stringify(r[j + '18']));
    }
  }
};
