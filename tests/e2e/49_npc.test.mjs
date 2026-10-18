import assert from 'node:assert/strict';
import { muatProyekJSON } from './harness.mjs';

// JEV-106: NPC karakter F / M — warna kulit, rambut & pakaian acak dari benih; diam → jalan-jalan / aktivitas → diam
const rumah = { v: 1, levels: [{ name: 'L1', height: 3, walls: [[0, 0, 8, 0], [8, 0, 8, 6], [8, 6, 0, 6], [0, 6, 0, 0], [4, 0, 4, 6]].map(([x1, z1, x2, z2], i) => ({ id: 'w' + i, x1, z1, x2, z2, thickness: 0.15, openings: [] })), objects: [] }] };
const siap = (page, n = 1) => page.waitForFunction(n => window.NPC && [...window.NPC._uji.NPC.values()].filter(x => x.a).length >= n, n, { timeout: 60000 });

export const tes = {
  'tombol NPC: F / M / acak; penampilan dari benih (sama = sama, beda = beda), atlas terpetakan per bagian, inspector & duplikat': async (page) => {
    await muatProyekJSON(page, rumah);
    await page.click('.tabs button[data-tab="objects"]');
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('[data-npc]')].map(b => b.dataset.npc)), ['F', 'M', 'acak']);
    await page.evaluate(() => { orbit.target.set(2, 0, 3); document.querySelector('[data-npc="F"]').click(); });
    await siap(page);
    const r = await page.evaluate(() => {
      const o = L().objects.find(x => x.kind === 'npc'), N = window.NPC, n = N._uji.NPC.get(o.id);
      const peta = [...n.badan.children].find(c => c.userData.rigIdx); let mats = []; peta.traverse(m => { if (m.isMesh) mats.push(m.material); });
      const P = mats.map(m => m.map && !!m.map.npcWarna);
      const a = N.penampilan(o), b = N.penampilan(JSON.parse(JSON.stringify(o))), c = N.penampilan({ ...o, params: { ...o.params, benih: o.params.benih + 1 } });
      return { type: o.type, jelajah: o.params.jelajah, benihOk: Number.isInteger(o.params.benih), kanvas: P.every(Boolean) && P.length >= 2, sama: JSON.stringify(a) === JSON.stringify(b),
        beda: JSON.stringify(a) !== JSON.stringify(c), kunci: Object.keys(a), warna: $('#inspector .npc-warna') ? $('#inspector .npc-warna').children.length : 0 };
    });
    assert.deepEqual([r.type, r.jelajah, r.benihOk, r.kanvas, r.sama, r.beda], ['F', 4, true, true, true, true]);
    assert.deepEqual(r.kunci, ['kulit', 'rambut', 'atas', 'bawah', 'sepatu']);
    assert.equal(r.warna, 5, 'contoh warna di inspector');
    // peta atlas: tiap bagian (kulit, rambut, atasan, bawahan, sepatu) punya piksel; acuan kulit dari tangan berwarna kulit
    const peta = await page.evaluate(async () => { const out = {};
      for (const k of ['F', 'M']) { const tpl = await window.LOBI.muatAvatar3D({ bawaan: k }), P = tpl.userData.npcPeta; if (!P) { out[k] = null; continue; }
        const badan = P.daftar.find(p => !p.wajah), n = [0, 0, 0, 0, 0, 0]; for (const c of badan.kelas) n[c]++; out[k] = { n: n.slice(1).map(v => v > 500), ref: P.ref.map(Math.round), wajah: P.daftar.some(p => p.wajah) }; }
      return out; });
    for (const k of ['F']) { assert.deepEqual(peta[k].n, [true, true, true, true, true], k + ' bagian atlas: ' + JSON.stringify(peta[k]));
      const [R, G, B] = peta[k].ref; assert.ok(R > G && G > B && R > 180, 'acuan kulit: ' + peta[k].ref); assert.ok(peta[k].wajah); }
    // M dan acak; duplikat mendapat penampilan baru; Acak penampilan mengganti benih
    await page.evaluate(() => { document.querySelector('[data-npc="M"]').click(); document.querySelector('[data-npc="acak"]').click(); });
    await siap(page, 3);
    const d = await page.evaluate(() => { const n = L().objects.filter(o => o.kind === 'npc'); const b0 = n[0].params.benih; select('obj', n[0].id); renderInspector(); duplicateSelection();
      const dup = L().objects.at(-1); const tombol = [...document.querySelectorAll('#inspector button')].find(b => /Acak penampilan/.test(b.textContent)); const b1 = dup.params.benih; tombol.click();
      return { jenis: n.map(o => o.type), dupBeda: dup.params.benih !== b0, acak: dup.params.benih !== b1, jumlah: window.NPC.jumlah() }; });
    assert.deepEqual(d.jenis.slice(0, 2), ['F', 'M']); assert.ok(/^[FM]$/.test(d.jenis[2]));
    assert.deepEqual([d.dupBeda, d.acak, d.jumlah], [true, true, 4]);
    // penyaring proyek: NPC & parameternya tetap
    const s = await page.evaluate(() => sanitasiProyek(JSON.parse(JSON.stringify(PROJECT))).levels[0].objects.filter(o => o.kind === 'npc').map(o => [o.type, typeof o.params.benih, o.params.jelajah]));
    assert.equal(s.length, 4); assert.deepEqual(s[0], ['F', 'number', 4]);
    // batas 12
    const batas = await page.evaluate(() => { for (let i = 0; i < 12; i++) tambahNPC('acak'); return window.NPC.jumlah(); });
    assert.equal(batas, 12);
  },

  'perilaku: diam di editor; di mode jalan berjalan tanpa menembus dinding, duduk di kursi, beraktivitas, bisa disapa; keluar → kembali ke tempatnya': async (page) => {
    await muatProyekJSON(page, rumah);
    await page.evaluate(() => { orbit.target.set(2, 0, 3); addObject('npc', 'M'); addObject('furn', 'armchair'); const k = L().objects.at(-1); k.x = 1; k.z = 1.2; k.rotY = 0; rebuildScene(); });
    await siap(page);
    const r = await page.evaluate(() => {
      const N = window.NPC, U = N._uji, o = L().objects.find(x => x.kind === 'npc'), hasil = {}; let n = U.NPC.get(o.id);
      for (let i = 0; i < 40; i++) N.langkah(0.05);
      hasil.editor = [n.mode, n.badan.position.length()];
      enterFPS(); camera.position.set(3.5, 1.6, 5.5); FPS.yaw = Math.PI; n = U.NPC.get(o.id);
      N.langkah(0.05); hasil.mulai = n.mode;
      // jalan ke titik bebas di ruangan yang sama
      U.mulaiJalan(n, 3, 4); for (let i = 0; i < 120 && n.mode === 'jalan'; i++) N.langkah(0.05);
      hasil.jalan = [n.mode, +n.p.x.toFixed(1), +n.p.z.toFixed(1), n.a.w];
      U.aktivitas(n, 2, 30); N.langkah(0.05); rebuildScene(); const n2 = U.NPC.get(o.id); hasil.bawa = [n2 !== n, n2.mode, n2.po, n2.p.distanceTo(n.p) < 1e-6, !!n2.a]; n = n2;
      // tujuan di balik dinding x = 4: tertahan, lalu kembali diam
      n.mode = 'diam'; U.mulaiJalan(n, 6, 4); let maksX = 0; for (let i = 0; i < 200 && n.mode === 'jalan'; i++) { N.langkah(0.05); maksX = Math.max(maksX, n.p.x); }
      hasil.dinding = [n.mode, +maksX.toFixed(2)];
      // duduk di kursi santai terdekat
      const ks = U.cariKursi(n); hasil.kursiAda = !!ks;
      if (ks) { n.kursi = ks; U.mulaiJalan(n, ks.q.x, ks.q.z, 'kursi'); for (let i = 0; i < 200 && n.mode !== 'duduk'; i++) N.langkah(0.05); for (let i = 0; i < 30; i++) N.langkah(0.05);
        hasil.duduk = [n.mode, n.po, +(ks.s.pos.y - 0.45 - n.p.y).toFixed(2), +Math.hypot(n.p.x - ks.s.pos.x, n.p.z - ks.s.pos.z).toFixed(2), +n.a.pw[1].toFixed(2)];
        n.t = 0; for (let i = 0; i < 40; i++) N.langkah(0.05); hasil.berdiri = [n.mode, n.po]; }
      // aktivitas joget → selesai → diam
      U.aktivitas(n, 3, 1); for (let i = 0; i < 10; i++) N.langkah(0.05); hasil.joget = +n.a.pw[3].toFixed(2); for (let i = 0; i < 20; i++) N.langkah(0.05); hasil.sesudah = n.mode;
      // siklus otomatis: dalam 90 detik NPC berganti keadaan beberapa kali
      const urut = new Set(); for (let i = 0; i < 900; i++) { N.langkah(0.1); urut.add(n.mode); } hasil.siklus = [...urut].sort();
      // sapa lewat bidikan
      n.mode = 'diam'; n.t = 99; n.po = 0; n.p.set(3, 0, 4); camera.position.set(3, 1.6, 5.4); FPS.yaw = Math.PI; FPS.pitch = -0.35; N.langkah(0.05); fpsStep(0); scene.updateMatrixWorld();
      AIM_T = 0; stepBidik(0.2); hasil.bidik = AIM && [AIM.jenis, labelAksi(AIM), AIM.ekstra]; if (AIM) pakai({ ...AIM, jenis: 'sapa' }); hasil.sapa = [n.mode, n.po];
      exitFPS(); n = U.NPC.get(o.id); N.langkah(0.05); hasil.keluar = [n.mode, n.badan.position.length()];
      return hasil;
    });
    assert.deepEqual(r.editor, [null, 0], 'editor: berdiri di tempat');
    assert.equal(r.mulai, 'diam');
    assert.equal(r.jalan[0], 'diam'); assert.ok(Math.abs(r.jalan[1] - 3) < 0.3 && Math.abs(r.jalan[2] - 4) < 0.3, 'sampai tujuan: ' + r.jalan);
    assert.deepEqual(r.bawa, [true, 'aktivitas', 2, true, true], 'bangun ulang: keadaan NPC terbawa');
    assert.equal(r.dinding[0], 'diam'); assert.ok(r.dinding[1] < 3.8, 'tertahan dinding: ' + r.dinding);
    assert.ok(r.kursiAda, 'kursi ditemukan');
    assert.equal(r.duduk[0], 'duduk'); assert.equal(r.duduk[1], 1); assert.ok(Math.abs(r.duduk[2]) < 0.02 && r.duduk[3] < 0.05 && r.duduk[4] > 0.8, 'duduk di dudukan: ' + r.duduk);
    assert.deepEqual(r.berdiri, ['diam', 0]);
    assert.ok(r.joget > 0.3, 'joget: ' + r.joget); assert.equal(r.sesudah, 'diam');
    assert.ok(r.siklus.includes('diam') && r.siklus.length >= 3, 'siklus diam → aktivitas / jalan: ' + r.siklus);
    assert.deepEqual(r.bidik, ['ngobrol', 'Ngobrol', ['sapa']]); assert.deepEqual(r.sapa, ['aktivitas', 5]);
    assert.deepEqual(r.keluar, [null, 0], 'keluar mode jalan: kembali ke tempatnya');
  },

  'iPad / WebKit: program shader NPC gagal → tampilan aman bertahap (tanpa GI, lalu Lambert), diingat; diagnosa memuat kemampuan WebGL & status program': async (page) => {
    await muatProyekJSON(page, rumah);
    await page.evaluate(() => { localStorage.removeItem('npcAman'); orbit.target.set(2, 0, 3); addObject('npc', 'F'); });
    await siap(page);
    const r = await page.evaluate(async () => {
      const N = window.NPC, n = [...N._uji.NPC.values()][0], tunggu = () => new Promise(ok => setTimeout(ok, 400));
      await tunggu(); const awal = N.periksa();
      const rusak = () => n.a.model.traverse(x => { if (x.isMesh) { const pr = renderer.properties.get(x.material); if (pr.currentProgram) pr.currentProgram.diagnostics = { runnable: false, programLog: 'uji: link gagal' }; } });
      // uji gambar di diagnosa bisa memasang program baru; kegagalan sungguhan tetap gagal
      rusak(); const teksGagal = N.diagnosa(); rusak(); const t1 = N.periksa(); const bahan1 = []; n.a.model.traverse(x => { if (x.isMesh) bahan1.push([x.material.type, Object.prototype.hasOwnProperty.call(x.material, 'onBeforeCompile')]); });
      await tunggu(); rusak(); const t2 = N.periksa(); const bahan2 = []; n.a.model.traverse(x => { if (x.isMesh) bahan2.push(x.material.type); });
      return { awal, t1, t2, aman: N.aman(), simpan: localStorage.getItem('npcAman'), bahan1, bahan2, gagal: /GAGAL/.test(teksGagal) && /uji: link gagal/.test(teksGagal), webgl: /WebGL[12] · tekstur \d+/.test(teksGagal) };
    });
    assert.deepEqual([r.awal, r.t1, r.t2, r.aman, r.simpan], [false, true, true, 2, '2']);
    assert.ok(r.bahan1.length && r.bahan1.every(([t, sendiri]) => t !== 'MeshLambertMaterial' && sendiri), 'tingkat 1: bahan sama tanpa GI ' + JSON.stringify(r.bahan1));
    assert.ok(r.bahan2.every(t => t === 'MeshLambertMaterial'), 'tingkat 2: Lambert ' + r.bahan2);
    assert.ok(r.gagal && r.webgl, 'diagnosa');
    // NPC baru langsung memakai tingkat yang diingat; tombol diagnosa di inspector
    const b = await page.evaluate(async () => { addObject('npc', 'M'); for (let i = 0; i < 200 && [...window.NPC._uji.NPC.values()].filter(x => x.a).length < 2; i++) await new Promise(ok => setTimeout(ok, 100));
      const n = [...window.NPC._uji.NPC.values()].find(x => x.o.type === 'M'), t = []; n.a.model.traverse(x => { if (x.isMesh) t.push(x.material.type); });
      const tombol = [...document.querySelectorAll('#inspector button')].find(x => /Diagnosa/.test(x.textContent)); tombol.click(); const d = $('#npcDiagnosa pre').textContent; $('#npcDiagnosa').remove();
      localStorage.removeItem('npcAman'); return { t, d: /Mode aman: 2/.test(d) }; });
    assert.ok(b.t.every(t => t === 'MeshLambertMaterial') && b.d, JSON.stringify(b));
  },
  'uji gambar: NPC normal tergambar (tanpa perbaikan); tekstur kosong (iPad) → tekstur asli tanpa pewarnaan, diingat; diagnosa memuat hasil uji': async (page) => {
    await muatProyekJSON(page, rumah);
    await page.evaluate(() => { localStorage.removeItem('npcAman'); localStorage.removeItem('npcPerbaiki'); orbit.target.set(2, 0, 3); addObject('npc', 'F'); });
    await siap(page);
    const r = await page.evaluate(async () => {
      const N = window.NPC, U = N._uji, n = [...U.NPC.values()][0], tunggu = ms => new Promise(ok => setTimeout(ok, ms));
      await tunggu(400); const normal = U.ujiGambar(n); U.ujiDanPerbaiki(); const tetap = JSON.stringify(U.perbaikan());
      // tiru tekstur yang terbaca kosong: peta hasil pewarnaan diganti kanvas transparan + alphaTest (seperti potongan rambut/bulu mata)
      const kosong = document.createElement('canvas'); kosong.width = kosong.height = 8; const tk = new THREE.CanvasTexture(kosong);
      n.a.model.traverse(x => { if (x.isMesh) { x.material = x.material.clone(); x.material.map = tk; x.material.alphaTest = 0.5; } });
      const rusak = U.ujiGambar(n); U.ujiDanPerbaiki();
      const m = [...U.NPC.values()][0], pulih = U.ujiGambar(m), kanvas = []; const tpl = await window.LOBI.muatAvatar3D({ bawaan: 'F' }), asli = new Set(); tpl.traverse(x => { if (x.isMesh && x.material.map) asli.add(x.material.map); });
      m.a.model.traverse(x => { if (x.isMesh) kanvas.push(!asli.has(x.material.map)); });
      const d = N.diagnosa();
      return { normal, tetap, rusak, pulih, kanvas, simpan: localStorage.getItem('npcPerbaiki'), diag: /uji gambar K=\d+ A=\d+ B=\d+ C=\d+/.test(d) && /perbaikan: \{"v":3,"peta":"asli"\}/.test(d) };
    });
    await page.evaluate(() => localStorage.removeItem('npcPerbaiki'));
    assert.ok(r.normal.K > 20 && r.normal.A > 50 && r.normal.B > 50 && r.normal.C > 50, 'normal: ' + JSON.stringify(r.normal));
    assert.equal(r.tetap, '{"v":3}', 'tanpa perbaikan bila tergambar');
    assert.ok(r.rusak.A === 0 && r.rusak.B > 50, 'tekstur kosong: ' + JSON.stringify(r.rusak));
    assert.ok(r.pulih.A > 50, 'pulih dengan tekstur asli: ' + JSON.stringify(r.pulih));
    assert.ok(r.kanvas.every(k => !k), 'tekstur asli, bukan kanvas pewarnaan');
    assert.equal(r.simpan, '{"v":3,"peta":"asli"}'); assert.ok(r.diag, 'diagnosa');
  },
  'masuk mode jalan saat NPC terpilih (target orbit di NPC): pemain berdiri di depan NPC & menghadapnya, bukan di dalam badannya; badan NPC tetap tampak (tidak ikut disembunyikan sebagai penanda editor)': async (page) => {
    await muatProyekJSON(page, rumah);
    await page.evaluate(() => { orbit.target.set(2, 0, 3); addObject('npc', 'F'); });
    await siap(page);
    const r = await page.evaluate(() => {
      const o = L().objects.find(x => x.kind === 'npc'); o.rotY = 0; select('obj', o.id); orbit.target.set(o.x, 0, o.z); rebuildScene();
      enterFPS(); const d = Math.hypot(camera.position.x - o.x, camera.position.z - o.z), arah = Math.atan2(o.x - camera.position.x, o.z - camera.position.z);
      const beda = Math.abs(Math.atan2(Math.sin(arah - FPS.yaw), Math.cos(arah - FPS.yaw)));
      fpsStep(0); scene.updateMatrixWorld(); AIM_T = 0; stepBidik(0.2); const bidik = AIM && AIM.jenis;
      // karakter sudah termuat → NPC dirakit seketika saat adegan dibangun ulang; badannya tetap tampak di mode jalan
      const n = [...window.NPC._uji.NPC.values()][0], tampak = []; n.a.model.traverse(x => { if (x.isMesh) tampak.push(x.visible); }); const uji = window.NPC._uji.ujiGambar(n);
      // AO layar: badan NPC (bahan alpha-cutout) tetap ikut lintasan kedalaman — dulu AO dinding di belakangnya tergambar di wajahnya
      const fx = FX.on; FX.on = true; renderFrame(); const aoSembunyi = FX_SEMBUNYI.filter(o => o.isSkinnedMesh).length, aoBahan = n.a.model.getObjectByProperty('isSkinnedMesh', true).material.alphaTest; FX.on = fx;
      exitFPS(); return { d, beda, bidik, tampak, uji, aoSembunyi, aoBahan };
    });
    assert.ok(r.d >= 1 && r.d < 2.2, 'jarak dari NPC ' + r.d);
    assert.ok(r.beda < 0.05, 'menghadap NPC ' + r.beda);
    assert.equal(r.bidik, 'ngobrol', 'NPC di tengah bidikan');
    assert.ok(r.tampak.length && r.tampak.every(Boolean) && r.uji.A > 50, 'badan NPC tergambar di mode jalan: ' + JSON.stringify(r));
    assert.ok(r.aoBahan > 0 && r.aoSembunyi === 0, 'NPC ikut kedalaman AO: ' + JSON.stringify([r.aoBahan, r.aoSembunyi]));
  },
};
