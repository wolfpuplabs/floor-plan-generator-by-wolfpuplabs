import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { FIX, muatProyekJSON } from './harness.mjs';

// JEV-123: model unggahan bisa jadi tempat berbaring, perapian, atau api unggun; kartu NPC "Dimas" dihapus;
// NPC tidak ikut berjoget hanya karena musik diputar & jarang memilih joget sendiri
// JEV-125: NPC berbaring (sendiri / bareng) di model unggahan; iPad: tekstur model diperkecil hanya saat dimuat ke GPU
const dinding = [[0, 0, 12, 0], [12, 0, 12, 10], [12, 10, 0, 10], [0, 10, 0, 0]].map(([x1, z1, x2, z2], i) => ({ id: 'w' + i, x1, z1, x2, z2, thickness: 0.15, openings: [] }));
const RUANG = { v: 1, levels: [{ name: 'L1', height: 3, walls: dinding, objects: [
  { id: 'nK', kind: 'npc', type: 'F', x: 10, y: 0, z: 8, rotY: 0, sx: 1, sy: 1, sz: 1, params: { benih: 4, jelajah: 0, kartu: 'anak' } }] }] };

async function siapkan(page) {
  await muatProyekJSON(page, RUANG);
  const gltf = JSON.parse(fs.readFileSync(path.join(FIX, 'kursi_1k.gltf'), 'utf8'));
  const bin = fs.readFileSync(path.join(FIX, 'kursi.bin')).toString('base64');
  const jpg = fs.readFileSync(path.join(FIX, 'kursi_diff_1k.jpg')).toString('base64');
  await page.evaluate(async ([gltf, bin, jpg]) => {
    const isi = { 'kursi.bin': new Uint8Array(bufFromB64(bin)), 'textures/kursi_diff_1k.jpg': new Uint8Array(bufFromB64(jpg)) };
    const glb = gltfKeGLB(gltf, uri => /^data:/.test(uri) ? dataURIkeU8(uri) : isi[uri]);
    const r = await daftarkanAset('Model uji', glb);
    const m = (id, x, z, params) => ({ id, kind: 'model', type: r.id, x, y: 0, z, rotY: 0, sx: 1, sy: 1, sz: 1, params: { collider: false, ...params } });
    L().objects.push(m('mBaring', 3, 3, { interaksi: 'baring' }), m('mApi', 6, 2, { interaksi: 'api', titikApi: 0.2 }), m('mUnggun', 6, 6, { interaksi: 'unggun' }));
    rebuildScene();
  }, [gltf, bin, jpg]);
}

export const tes = {
  'model unggahan: Berbaring (mata di sisi kepala, Bangun lagi), Perapian & Api unggun (lidah api, cahaya api, padam/nyala, kayu & hangatkan diri, marshmallow), inspector': async (page) => {
    await siapkan(page);
    const r = await page.evaluate(async () => {
      const out = {}, info = id => { const g = findGroup('obj', id); let lidah = 0; g.traverse(x => { if (x.name === 'lidahApi') lidah++; });
        return { jenis: g.userData.nyalaJenis, lidah, lampu: LAMPU_PASANG.some(L => L.id === id && L.jenis === 'api'), aksi: aksiAktivitas(cariObjek(id)) }; };
      out.info = ['mBaring', 'mApi', 'mUnggun'].map(info);
      enterFPS(); camera.position.set(3, 1.6, 5); fpsStep(0);
      // berbaring: dari kotak batas model, kepala ke −Z, memandang ke kaki (+Z)
      const gB = findGroup('obj', 'mBaring'); pakai({ jenis: 'baring', id: 'mBaring', grp: gB }); for (let i = 0; i < 30; i++) fpsStep(0.05);
      const D = FPS.duduk;
      out.baring = { ada: !!(D && D.baring), y: D && +D.baring.y.toFixed(2), mataZ: +(camera.position.z - 3).toFixed(2), yaw: +FPS.yaw.toFixed(2), label: labelAksi({ jenis: 'baring', id: 'mBaring' }), po: window.LOBI ? window.LOBI.gerak.posSaya().po : 9 };
      pakai({ jenis: 'baring', id: 'mBaring', grp: gB }); out.bangun = FPS.duduk == null;
      // perapian: E memadamkan / menyalakan api
      const gA = findGroup('obj', 'mApi'); pakai({ jenis: 'api', id: 'mApi', grp: gA });
      let halo = null; findGroup('obj', 'mApi').traverse(x => { if (x.name === 'lidahApi') halo = x.children[0]; });
      out.padam = [MATI.has('mApi'), halo.visible, labelAksi({ jenis: 'api', id: 'mApi' })];
      pakai({ jenis: 'api', id: 'mApi', grp: findGroup('obj', 'mApi') }); out.nyala = !MATI.has('mApi');
      // api unggun: tambah kayu membesarkan api; hangatkan diri di luar kotak batas model, menghadap api
      await muatModul('aktivitas'); const K = window.AKT; K._uji.TAS().kayu = 2;
      const gU = findGroup('obj', 'mUnggun'); camera.position.set(6, 1.6, 8.5); fpsStep(0);
      pakai({ jenis: 'kayu', id: 'mUnggun', grp: gU }); await new Promise(ok => setTimeout(ok, 100));
      out.kayu = [+(findGroup('obj', 'mUnggun').userData.apiKuat || 0).toFixed(2), K.tas().kayu];
      pakai({ jenis: 'hangat', id: 'mUnggun', grp: findGroup('obj', 'mUnggun') }); await new Promise(ok => setTimeout(ok, 100));
      const pusat = findGroup('obj', 'mUnggun').localToWorld(findGroup('obj', 'mUnggun').userData.apiTitik.clone());
      out.hangat = { kunci: K.kunci(), jarak: +Math.hypot(camera.position.x - pusat.x, camera.position.z - pusat.z).toFixed(2), hadap: +Math.cos(Math.atan2(pusat.x - camera.position.x, pusat.z - camera.position.z) - FPS.yaw).toFixed(2) };
      K.selesai();
      pakai({ id: 'mUnggun', jenis: 'marshmallow' }); await new Promise(ok => setTimeout(ok, 100)); out.marsh = !!(K._uji.A() && K._uji.A().alat); K.selesai();
      exitFPS();
      // inspector: kategori baru & pengaturannya
      const ins = id => { select('obj', id); renderInspector(); return [...document.querySelectorAll('#inspector .f-row, #inspector label, #inspector .row')].map(x => x.textContent).join('|'); };
      out.insB = ins('mBaring'); out.insU = ins('mUnggun'); out.insA = ins('mApi');
      out.pilihan = [...[...document.querySelectorAll('#inspector select')].find(x => [...x.options].some(o => o.value === 'unggun')).options].map(o => o.value);
      return out;
    });
    assert.deepEqual(r.info, [{ jenis: 'baring', lidah: 0, lampu: false, aksi: null }, { jenis: 'api', lidah: 1, lampu: true, aksi: ['kayu', 'hangat'] },
      { jenis: 'api', lidah: 1, lampu: true, aksi: ['kayu', 'hangat', 'marshmallow'] }]);
    assert.ok(r.baring.ada && r.baring.y > 0.1 && r.baring.y <= 0.56 && r.baring.mataZ < 0 && Math.abs(r.baring.yaw) < 0.01, 'berbaring: ' + JSON.stringify(r.baring));
    assert.deepEqual([r.baring.label, r.baring.po, r.bangun], ['Bangun', 9, true]);
    assert.deepEqual([r.padam, r.nyala], [[true, false, 'Nyalakan api'], true]);
    assert.deepEqual(r.kayu, [1.4, 1]);
    assert.ok(r.hangat.kunci && r.hangat.jarak >= 1.15 && r.hangat.hadap > 0.95, 'hangatkan diri: ' + JSON.stringify(r.hangat));
    assert.equal(r.marsh, true);
    assert.match(r.insB, /Tinggi kasur/); assert.match(r.insB, /Arah kepala/);
    assert.match(r.insU, /Titik api/); assert.match(r.insU, /Besar api/); assert.doesNotMatch(r.insU, /Maju/);
    assert.match(r.insA, /Maju–mundur api/);
    assert.ok(['baring', 'api', 'unggun'].every(k => r.pilihan.includes(k)), r.pilihan.join());
  },

  'NPC berbaring di model unggahan berkategori Berbaring: sendiri (cari kasur) & bareng pengunjung yang rebahan di model itu': async (page) => {
    await siapkan(page);
    await page.evaluate(() => { L().objects.push({ id: 'nB', kind: 'npc', type: 'F', x: 3, y: 0, z: 5.5, rotY: 0, sx: 1, sy: 1, sz: 1, params: { benih: 3, jelajah: 4 } }); rebuildScene(); });
    await page.waitForFunction(() => window.NPC && window.NPC.keadaan('nB') && window.NPC.keadaan('nB').siap, undefined, { timeout: 120000 });
    const r = await page.evaluate(async () => {
      enterFPS(); camera.position.set(8, 1.6, 8); fpsStep(0); window.NPC.langkah(0.05);
      const U = window.NPC._uji, n = U.NPC.get('nB'), g = findGroup('obj', 'mBaring'), B = g.userData.baring;
      const ks = U.cariKasur(n, true), out = { ks: ks && { id: ks.id, po: ks.po, y: +ks.y.toFixed(2), yaw: +ks.yaw.toFixed(2), x: +ks.x.toFixed(2), z: +ks.z.toFixed(2) }, hl: +B.hl.toFixed(2), wid: +B.wid.toFixed(2) };
      // NPC berjalan ke kasur model & berbaring (pose 9)
      U.aktivitas(n, 0, 1); n.kursi = ks; window.NPC._uji.mulaiJalan(n, ks.q.x, ks.q.z, 'kursi');
      for (let i = 0; i < 800 && n.mode !== 'duduk'; i++) window.NPC.langkah(0.05);
      out.sendiri = { mode: n.mode, po: n.po, dekat: +Math.hypot(n.p.x - ks.x, n.p.z - ks.z).toFixed(2) };
      U.aktivitas(n, 0, 1); n.kursi = null; n.mode = 'diam'; n.p.set(3, 0, 5.5);
      // pengunjung rebahan di model, NPC diajak berbaring bareng → sisi lain kasur yang sama
      pakai({ jenis: 'baring', id: 'mBaring', grp: g }); for (let i = 0; i < 20; i++) fpsStep(0.05);
      await muatModul('kartunpc'); await muatModul('dialog');
      const m = window.DIALOG._dalam.ingatan('nB'); m.s = 90;
      out.bareng = window.NPC.aksiPasangan('nB', 'baring');
      for (let i = 0; i < 800 && n.mode !== 'duduk'; i++) window.NPC.langkah(0.05);
      out.barengHasil = { mode: n.mode, po: n.po, kasur: n.kursi && n.kursi.bareng, beda: n.kursi && +Math.hypot(n.kursi.x - FPS.duduk.baring.x, n.kursi.z - FPS.duduk.baring.z).toFixed(2) };
      exitFPS(); return out; });
    assert.ok(r.ks && r.ks.id === 'mBaring' && r.ks.po === 9 && Math.abs(r.ks.y - r.hl) < 0.02 && r.ks.yaw === 0 && Math.abs(r.ks.x - 3) < 0.3, 'kasur model: ' + JSON.stringify(r));
    assert.ok(r.wid > 0.2, 'lebar kasur model: ' + r.wid);
    assert.deepEqual([r.sendiri.mode, r.sendiri.po], ['duduk', 9], 'NPC berbaring di model: ' + JSON.stringify(r.sendiri));
    assert.equal(r.bareng, true);
    assert.ok(r.barengHasil.mode === 'duduk' && r.barengHasil.po === 9 && r.barengHasil.kasur === 'mBaring' && r.barengHasil.beda > 0.05, 'berbaring bareng di model: ' + JSON.stringify(r.barengHasil));
  },

  'NPC sudah rebahan di tengah kasur lalu pengunjung ikut berbaring: masing-masing satu sisi, tidak menumpuk (model unggahan & ranjang pustaka)': async (page) => {
    await siapkan(page);
    await page.evaluate(() => { L().objects.push({ id: 'nB', kind: 'npc', type: 'F', x: 3, y: 0, z: 5.5, rotY: 0, sx: 1, sy: 1, sz: 1, params: { benih: 3, jelajah: 4 } },
      { id: 'ranjang', kind: 'furn', type: 'bed_double', x: 8, y: 0, z: 7, rotY: 0, sx: 1, sy: 1, sz: 1, params: {} }); rebuildScene(); });
    await page.waitForFunction(() => window.NPC && window.NPC.keadaan('nB') && window.NPC.keadaan('nB').siap, undefined, { timeout: 120000 });
    const r = await page.evaluate(async () => {
      enterFPS(); camera.position.set(6, 1.6, 4); fpsStep(0); window.NPC.langkah(0.05);
      const U = window.NPC._uji, n = U.NPC.get('nB'), out = {};
      for (const id of ['mBaring', 'ranjang']) {
        // NPC rebahan sendiri di kasur ini (di tengah)
        if (id === 'ranjang') n.p.set(10, 0, 6.8);                         // di samping ranjang: kasur terdekat & jalur bebas
        let ks = null; for (let i = 0; i < 20 && !(ks && ks.id === id); i++) ks = U.cariKasur(n, true);
        U.aktivitas(n, 0, 1); n.kursi = ks; n.p.set(ks.q.x, n.p.y, ks.q.z); window.NPC._uji.mulaiJalan(n, ks.q.x, ks.q.z, 'kursi');
        for (let i = 0; i < 400 && n.mode !== 'duduk'; i++) window.NPC.langkah(0.05);
        const tengah = [n.p.x, n.p.z];
        // pengunjung ikut berbaring di kasur yang sama
        pakai({ jenis: 'baring', id, grp: findGroup('obj', id) }); for (let i = 0; i < 60; i++) { window.NPC.langkah(0.05); fpsStep(0.05); }
        const B = FPS.duduk.baring, lebar = id === 'ranjang' ? 1.6 : findGroup('obj', id).userData.baring.wid;
        out[id] = { mode: n.mode, po: n.po, jarak: +Math.hypot(n.p.x - B.x, n.p.z - B.z).toFixed(2), mataIkut: +Math.hypot(camera.position.x - B.x, camera.position.z - B.z).toFixed(2),
          npcGeser: +Math.hypot(n.p.x - tengah[0], n.p.z - tengah[1]).toFixed(2), lebar: +lebar.toFixed(2) };
        berdiri(); U.aktivitas(n, 0, 1); n.kursi = null; n.mode = 'diam'; n.p.set(3, 0, 5.5);
      }
      exitFPS(); return out; });
    for (const id of ['mBaring', 'ranjang']) {
      const x = r[id];
      assert.ok(x.mode === 'duduk' && x.po === 9 && x.jarak >= 0.55 && x.npcGeser > 0.2, id + ' berdampingan: ' + JSON.stringify(x));
    }
  },

  'iPad: tekstur model unggahan diperkecil saat dimuat ke GPU (warna 1K), berkas proyek & tautan tetap memakai aslinya': Object.assign(async (page) => {
    await muatProyekJSON(page, RUANG);
    const gltf = JSON.parse(fs.readFileSync(path.join(FIX, 'kursi_1k.gltf'), 'utf8'));
    const bin = fs.readFileSync(path.join(FIX, 'kursi.bin')).toString('base64');
    const r = await page.evaluate(async ([gltf, bin]) => {
      // tekstur warna 2048 px (dibuat di kanvas) — tersimpan 2K, di GPU iPad 1K
      const c = document.createElement('canvas'); c.width = c.height = 2048; const x = c.getContext('2d');
      for (let i = 0; i < 64; i++) { x.fillStyle = `hsl(${i * 37},60%,50%)`; x.fillRect((i % 8) * 256, (i >> 3) * 256, 256, 256); }
      const jpg = new Uint8Array(await (await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.9))).arrayBuffer()); c.width = 0;
      const isi = { 'kursi.bin': new Uint8Array(bufFromB64(bin)), 'textures/kursi_diff_1k.jpg': jpg };
      const glb = gltfKeGLB(gltf, uri => /^data:/.test(uri) ? dataURIkeU8(uri) : isi[uri]);
      const a = await daftarkanAset('Model 2K', glb), id = a.id; let maks = 0;
      ASSET_OBJ.get(id).traverse(m => { if (m.isMesh) for (const mt of [].concat(m.material)) if (mt.map && mt.map.image) maks = Math.max(maks, mt.map.image.width); });
      const simpan = bufFromB64(PROJECT.assets[id].data).byteLength;
      return { hemat: perangkatHemat(), gpu: maks, simpan, buf: ASSET_BUF.get(id).byteLength, size: PROJECT.assets[id].size };
    }, [gltf, bin]);
    assert.deepEqual([r.hemat, r.gpu], [true, 1024], JSON.stringify(r));
    assert.deepEqual([r.buf, r.size], [r.simpan, r.simpan], 'berkas proyek & salinan untuk tautan tetap asli: ' + JSON.stringify(r));
  }, { opsi: { ua: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/155.0 Mobile/15E148 Safari/604.1' } }),

  'NPC: kartu Dimas dihapus (kartu lama "anak" → kartu bertema rumah); musik tidak membuat NPC berjoget; joget sendiri jarang & tidak beruntun': async (page) => {
    await muatProyekJSON(page, RUANG);
    await page.waitForFunction(() => window.NPC && window.NPC.keadaan('nK') && window.NPC.keadaan('nK').siap, undefined, { timeout: 120000 });
    const r = await page.evaluate(async () => {
      await muatModul('kartunpc'); await muatModul('dialog');
      const KN = window.KARTU_NPC, out = { kartu: Object.keys(KN.KARTU), dimas: Object.values(KN.KARTU).some(k => k.nama === 'Dimas') };
      enterFPS(); window.NPC.langkah(0.05); const p = window.NPC.keadaan('nK').p; camera.position.set(p.x, 1.6, p.z - 1.2); FPS.yaw = 0;
      window.DIALOG.buka('nK'); await new Promise(ok => setTimeout(ok, 200)); out.nama = $('#npcObrol').textContent.includes('Bu Sari'); window.DIALOG.tutup();
      // musik: avatar pemain berjoget pelan sesudah diam, avatar NPC tidak
      const U = window.NPC._uji, n = U.NPC.get('nK'), G = window.LOBI.gerak, asli = window.bgmMain; window.bgmMain = () => true;
      U.aktivitas(n, 0, 30); for (let i = 0; i < 160; i++) window.NPC.langkah(0.05);
      out.npcJoget = +n.a.pw[3].toFixed(2);
      // pilihan aktivitas acak: hitung joget dari 600 kali (musik menyala)
      let joget = 0, beruntun = 0, lalu = '';
      for (let i = 0; i < 600; i++) { U.berikutnya(n); const j = n.mode === 'aktivitas' && n.po === 3; if (j) joget++; if (j && lalu === 'j') beruntun++; lalu = j ? 'j' : '';
        n.kursi = null; n.mode = 'diam'; }
      window.bgmMain = asli; exitFPS();
      Object.assign(out, { joget, beruntun });
      return out;
    });
    assert.ok(!r.kartu.includes('anak') && !r.dimas && r.kartu.length === 7, r.kartu.join());
    assert.equal(r.nama, true, 'kartu lama "anak" → Bu Sari');
    assert.ok(r.npcJoget < 0.05, 'NPC tidak ikut joget karena musik: ' + r.npcJoget);
    assert.ok(r.joget < 600 * 0.12 && r.beruntun === 0, 'joget jarang: ' + r.joget + ' beruntun ' + r.beruntun);
  },
};
