import assert from 'node:assert/strict';
import { muatProyekJSON } from './harness.mjs';

// JEV-118: main air (ciprat) saat berenang; kayu bakar & api unggun (ambil kayu, tambah kayu, hangatkan diri, bakar marshmallow);
// NPC berpose saat difoto (ketuk kamera dua kali) & pose foto sendiri; pose 20–26 terkirim di Main bareng
const obj = (id, kind, type, x, z, params = {}, rotY = 0) => ({ id, kind, type, x, y: 0, z, rotY, sx: 1, sy: 1, sz: 1, params });
const kolam = { v: 1, levels: [{ name: 'L1', height: 3, walls: [], objects: [
  obj('kolam', 'area', 'kolam_renang', 6, 14, { jenis: 'kolam_renang', bentuk: 'persegi', w: 5, d: 5, kedalaman: 1.4, pts: [[-2.5, -2.5], [2.5, -2.5], [2.5, 2.5], [-2.5, 2.5]] }),
  obj('nS', 'npc', 'F', 6, 10.5, { benih: 5, jelajah: 0, kartu: 'tetangga' }, Math.PI)] }] };
const api = { v: 1, levels: [{ name: 'L1', height: 3, walls: [], objects: [
  obj('unggun', 'furn', 'api_unggun', 4, 4), obj('tumpuk', 'furn', 'kayu_bakar', 7, 4),
  obj('nA', 'npc', 'F', 2.5, 7, { benih: 11, jelajah: 0 }), obj('nB', 'npc', 'M', 5.5, 7, { benih: 9, jelajah: 0 })] }] };
const foto = { v: 1, levels: [{ name: 'L1', height: 3, walls: [], objects: [
  obj('nD', 'npc', 'F', 4, 7, { benih: 11, jelajah: 0 }, Math.PI), obj('nB', 'npc', 'M', 4, 0.5, { benih: 9, jelajah: 0 })] }] };
const siap = (page, ids) => page.waitForFunction(ids => window.NPC && ids.every(i => window.NPC.keadaan(i) && window.NPC.keadaan(i).siap), ids, { timeout: 90000 });
const bidik = (page, x, z, yaw, pitch) => page.evaluate(([x, z, yaw, pitch]) => { camera.position.set(x, 1.6, z); FPS.yaw = yaw; FPS.pitch = pitch; fpsStep(0); scene.updateMatrixWorld(); AIM_T = 0; stepBidik(0.2);
  return AIM && { jenis: AIM.jenis, label: labelAksi(AIM), ekstra: AIM.ekstra || [], lain: (AIM.ekstra || []).map(j => labelAksi({ ...AIM, jenis: j })) }; }, [x, z, yaw, pitch]);

export const tes = {
  'main air: Ciprat memercikkan air & berpose 21; NPC di depan tertawa lalu membalas (pose 21) — layar basah sebentar': async (page) => {
    await page.route('**/avatar/F_renang*.vrm', r => r.fulfill({ status: 404, body: '' }));
    await muatProyekJSON(page, kolam);
    await siap(page, ['nS']);
    await page.evaluate(async () => { enterFPS(); for (let i = 0; i < 3; i++) window.NPC.langkah(0.05); await muatModul('aktivitas'); });
    const r = await page.evaluate(async () => {
      const N = window.NPC, n = N._uji.NPC.get('nS'), K = window.AKT, tunggu = ms => new Promise(ok => setTimeout(ok, ms)), out = {};
      camera.position.set(6, 1.6, 11); FPS.yaw = 0; N.aksiPasangan('nS', 'ikut'); for (let i = 0; i < 40; i++) N.langkah(0.05);
      pakai({ jenis: 'renang', id: 'kolam', titik: new THREE.Vector3(6, -0.12, 13.5) }); await tunggu(200);
      for (let i = 0; i < 60; i++) { K.langkah(0.05); N.langkah(0.05); }
      out.tombol = [...document.querySelectorAll('#aktHud .ak-tombol button')].filter(b => !b.hidden).map(b => b.textContent);
      // menghadap NPC lalu ciprat
      FPS.yaw = Math.atan2(n.p.x - camera.position.x, n.p.z - camera.position.z);
      K._uji.tekan(2, true); K._uji.tekan(2, false); K.langkah(0.05); out.pose = window.LOBI.gerak.posSaya().po;
      let balas = 0; for (let i = 0; i < 40 && !balas; i++) { await tunggu(50); K.langkah(0.02); N.langkah(0.02); if (n.po === 21) balas = 1; }
      out.balas = balas; await tunggu(500); out.tetes = !!document.querySelector('#aktHud .ak-tetes');
      // ciprat ke arah lain: NPC tidak kena
      FPS.yaw += Math.PI; K.langkah(1); const sebelum = n.cip; K._uji.tekan(2, true); K._uji.tekan(2, false); await tunggu(1600); out.melesetCip = n.cip > (sebelum || 0) ? 'kena' : 'tidak';
      K.selesai(); exitFPS(); return out; });
    assert.deepEqual(r.tombol, ['💦 Ciprat', 'Selam']);
    assert.equal(r.pose, 21, 'pose ciprat terkirim');
    assert.deepEqual([r.balas, r.tetes, r.melesetCip], [1, true, 'tidak'], JSON.stringify(r));
  },

  'api unggun: ambil kayu bakar (+3, jeda), tambah kayu menyalakan & membesarkan api, hangatkan diri (duduk 25, NPC melingkar), bakar marshmallow': async (page) => {
    await muatProyekJSON(page, api);
    await siap(page, ['nA', 'nB']);
    await page.evaluate(async () => { localStorage.removeItem('aktTas'); enterFPS(); for (let i = 0; i < 3; i++) window.NPC.langkah(0.05); await muatModul('aktivitas'); window.AKT._uji.TAS().kayu = 0; });
    const g = await page.evaluate(() => { const grp = findGroup('obj', 'unggun'); let lidah = 0; grp.traverse(x => { if (x.name === 'lidahApi') lidah++; });
      return { jenis: grp.userData.nyalaJenis, titik: !!grp.userData.lampuTitik, lidah, lampu: LAMPU_PASANG.some(L => L.id === 'unggun' && L.jenis === 'api') }; });
    assert.deepEqual(g, { jenis: 'api', titik: true, lidah: 1, lampu: true });
    // tumpukan kayu bakar
    const t = await bidik(page, 7, 5.2, Math.PI, -0.9);
    assert.deepEqual([t.jenis, t.label], ['ambilkayu', 'Ambil kayu bakar']);
    const kayu = await page.evaluate(async () => { pakai(AIM); await new Promise(r => setTimeout(r, 300)); const a = window.AKT.tas().kayu; pakai(AIM); await new Promise(r => setTimeout(r, 100)); return [a, window.AKT.tas().kayu]; });
    assert.deepEqual(kayu, [3, 3], 'ambil +3, lalu jeda');
    // api unggun: Berinteraksi = nyala/padam; aksi lain: tambah kayu, hangatkan diri, bakar marshmallow
    const u = await bidik(page, 4, 5.5, Math.PI, -0.72);
    assert.deepEqual([u.jenis, u.lain], ['api', ['Tambah kayu bakar', 'Hangatkan diri', 'Bakar marshmallow']]);
    const r = await page.evaluate(async () => {
      const K = window.AKT, N = window.NPC, out = {};
      pakai(AIM); out.padam = MATI.has('unggun');                      // padamkan
      pakai({ ...AIM, jenis: 'hangat' }); await new Promise(r => setTimeout(r, 100)); out.hangatPadam = K.kunci();
      pakai({ ...AIM, jenis: 'kayu' }); await new Promise(r => setTimeout(r, 100));
      const grp = findGroup('obj', 'unggun'); let sk = 0; grp.traverse(x => { if (x.name === 'lidahApi') sk = x.scale.y; });
      out.kayu = { nyala: !MATI.has('unggun'), kuat: +grp.userData.apiKuat.toFixed(2), lidah: +sk.toFixed(2), sisa: K.tas().kayu };
      // hangatkan diri: duduk menghadap api, NPC datang duduk melingkar (pose 25)
      pakai({ ...AIM, jenis: 'hangat' }); await new Promise(r => setTimeout(r, 100));
      const pusat = new THREE.Vector3(4, 0, 4);
      out.duduk = { kunci: K.kunci(), po: window.LOBI.gerak.posSaya().po, jarak: +Math.hypot(camera.position.x - 4, camera.position.z - 4).toFixed(2), mata: +(camera.position.y - FPS.feet).toFixed(2) };
      for (let i = 0; i < 200; i++) { K.langkah(0.05); N.langkah(0.05); }
      out.npc = ['nA', 'nB'].map(id => { const n = N._uji.NPC.get(id); return { mode: n.mode, po: n.po, jarak: +Math.hypot(n.p.x - pusat.x, n.p.z - pusat.z).toFixed(2), hadap: +Math.cos(Math.atan2(pusat.x - n.p.x, pusat.z - n.p.z) - n.yaw).toFixed(2) }; });
      K.selesai(); for (let i = 0; i < 3; i++) N.langkah(0.05);
      out.selesai = { npc: ['nA', 'nB'].map(id => N.keadaan(id).mode), mata: +(camera.position.y - FPS.feet).toFixed(2), po: window.LOBI.gerak.posSaya().po || 0 };
      // marshmallow: tahan Panggang sampai keemasan, lalu angkat
      pakai({ id: 'unggun', jenis: 'marshmallow' }); await new Promise(r => setTimeout(r, 100));
      const A = K._uji.A(); out.marsh = { po: window.LOBI.gerak.posSaya().po, alat: !!A.alat };
      K._uji.tekan(1, true); for (let i = 0; i < 400 && A.mt < 0.62; i++) K.langkah(0.05);
      out.marsh.warna = A.mm.color.getHexString(); K._uji.tekan(1, false); K._uji.tekan(2, true); K._uji.tekan(2, false);
      out.marsh.hasil = K.tas().masakan.slice(-1)[0];
      K.selesai(); exitFPS(); return out; });
    assert.deepEqual([r.padam, r.hangatPadam], [true, false], 'api padam: tidak bisa menghangatkan diri');
    assert.deepEqual([r.kayu.nyala, r.kayu.sisa], [true, 2]);
    assert.ok(r.kayu.kuat > 1.38 && r.kayu.kuat <= 1.4, 'api membesar 1,4× lalu susut pelan: ' + r.kayu.kuat);
    assert.ok(r.kayu.lidah > 1.1, 'lidah api membesar: ' + r.kayu.lidah);
    assert.deepEqual([r.duduk.kunci, r.duduk.po, r.duduk.mata], [true, 25, 0.8]);
    assert.ok(Math.abs(r.duduk.jarak - 1.15) < 0.05, 'duduk di tepi api: ' + r.duduk.jarak);
    for (const n of r.npc) assert.ok(n.mode === 'temani' && n.po === 25 && Math.abs(n.jarak - 1.15) < 0.2 && n.hadap > 0.9, 'NPC duduk melingkari api: ' + JSON.stringify(r.npc));
    assert.deepEqual(r.selesai, { npc: ['diam', 'diam'], mata: 1.6, po: 0 });
    assert.deepEqual([r.marsh.po, r.marsh.alat], [26, true]);
    assert.notEqual(r.marsh.warna, 'f6f2ea', 'marshmallow kecokelatan');
    assert.equal(r.marsh.hasil.mutu, 'sempurna', JSON.stringify(r.marsh));
  },

  'foto: ketukan pertama — NPC di bingkai menoleh & berpose (NPC di belakang tidak), ketukan kedua memotret; pose foto sendiri; kode pose 20–26 terkirim': async (page) => {
    await muatProyekJSON(page, foto);
    await siap(page, ['nD', 'nB']);
    await page.evaluate(() => { enterFPS(); for (let i = 0; i < 3; i++) window.NPC.langkah(0.05); camera.position.set(4, 1.6, 3.5); FPS.yaw = 0; FPS.pitch = 0; fpsStep(0); camera.updateMatrixWorld(); });
    const r = await page.evaluate(() => {
      const N = window.NPC, a = N._uji.NPC.get('nD'), b = N._uji.NPC.get('nB');
      a.yaw = 0.8; const hasil = tombolFoto();
      for (let i = 0; i < 40; i++) N.langkah(0.05);
      return { hasil, siap: $('#fpsFoto').classList.contains('siap'), a: { mode: a.mode, po: a.po, hadap: +Math.cos(Math.atan2(camera.position.x - a.p.x, camera.position.z - a.p.z) - a.yaw).toFixed(2) }, b: { mode: b.mode, po: b.po } };
    });
    assert.equal(r.hasil, null, 'belum memotret');
    assert.equal(r.siap, true);
    assert.ok(r.a.mode === 'aktivitas' && [22, 23, 24, 5].includes(r.a.po) && r.a.hadap > 0.95, 'NPC di depan berpose & menghadap kamera: ' + JSON.stringify(r.a));
    assert.ok(r.b.mode !== 'aktivitas' || ![22, 23, 24].includes(r.b.po), 'NPC di belakang kamera tidak berpose');
    const [unduh] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => document.getElementById('fpsFoto').click())]);
    assert.match(unduh.suggestedFilename(), /^Plan23D-\d{8}-\d{6}\.jpg$/);
    const s = await page.evaluate(() => {
      const out = { siap: $('#fpsFoto').classList.contains('siap'), selesai: window.NPC._uji.NPC.get('nD').t <= 1.2 };
      // pose foto sendiri dari lembar gaya (terlihat teman Main bareng)
      out.gaya = ['peace', 'pinggang', 'hati'].map(v => { pilihGaya(v); return window.LOBI.gerak.posSaya().po; });
      const G = window.LOBI.gerak; out.aman = [20, 21, 22, 23, 24, 25, 26, 27].map(po => G.posAman({ jalan: 1, x: 0, y: 0, z: 0, yaw: 0, po }).po || 0);
      FPS.gaya = null; exitFPS(); return out; });
    assert.deepEqual(s, { siap: false, selesai: true, gaya: [22, 23, 24], aman: [20, 21, 22, 23, 24, 25, 26, 0] });
  }
};
