import assert from 'node:assert/strict';
import { muatProyekJSON } from './harness.mjs';

// JEV-109: interaksi berpasangan — peluk, gandeng, duduk bersandar, berbaring di ranjang, dansa berdua
const dinding = [[0, 0, 10, 0], [10, 0, 10, 8], [10, 8, 0, 8], [0, 8, 0, 0]].map(([x1, z1, x2, z2], i) => ({ id: 'w' + i, x1, z1, x2, z2, thickness: 0.15, openings: [] }));
const npc = (id, x, z, kartu, extra = {}) => ({ id, kind: 'npc', type: 'F', x, y: 0, z, rotY: Math.PI, sx: 1, sy: 1, sz: 1, params: { benih: 11, jelajah: 6, kartu, ...extra } });
const rumah = { v: 1, levels: [{ name: 'L1', height: 3, walls: dinding, objects: [
  npc('nA', 3, 3, 'tetangga'), npc('nK', 7, 3, 'anak'),
  { id: 'sofa', kind: 'furn', type: 'sofa3', x: 3, y: 0, z: 6.6, rotY: Math.PI, sx: 1, sy: 1, sz: 1, params: {} },
  { id: 'ranjang', kind: 'furn', type: 'bed_double', x: 8, y: 0, z: 6.5, rotY: 0, sx: 1, sy: 1, sz: 1, params: {} }] }] };

export const tes = {
  'pose 6–10: peluk & dansa menekuk lengan ke depan, gandeng satu lengan ke samping, bersandar duduk miring, berbaring telentang di permukaan; kode pose 6–10 diterima lobi': async (page) => {
    await muatProyekJSON(page, rumah);
    const r = await page.evaluate(async () => {
      await muatModul('lobi'); const G = window.LOBI.gerak, tpl = await window.LOBI.muatAvatar3D({ bawaan: 'M' });
      const buat = ek => { const a = { g: new THREE.Group(), ...ek }, m = klonModel(tpl); m.userData.rigIdx = tpl.userData.rigIdx; m.userData.kedipIdx = tpl.userData.kedipIdx; m.userData.klip = [];
        a.g.add(m); scene.add(a.g); G.siapkanGerak(a, m); a.lt = 1e9; return a; };   // tanpa lirikan acak: sudut kepala pose pasti
      const sudut = (a, k) => 2 * Math.acos(Math.min(1, Math.abs(a.rig[k].b.quaternion.dot(a.rig[k].rest))));
      const out = {};
      for (const [po, ek] of [[6], [7, { sisi: 1 }], [8, { sandar: 1 }], [9], [10], [15], [16]]) {
        const a = buat(ek); a.tuju = { po }; for (let i = 0; i < 60; i++) G.gerakAvatar(a, 0.05, 0);
        out[po] = { turun: +(a.dasarY - a.model.position.y).toFixed(2), pinggul: +sudut(a, 'hips').toFixed(2), lenganKa: +sudut(a, 'rightUpperArm').toFixed(2), lenganKi: +sudut(a, 'leftUpperArm').toFixed(2), kepala: +sudut(a, 'head').toFixed(2), tinggi: +(a.tinggiPinggul || 0).toFixed(2) };
        scene.remove(a.g); }
      out.aman = [G.posAman({ jalan: 1, x: 0, y: 0, z: 0, yaw: 0, po: 9 }).po, G.posAman({ jalan: 1, x: 0, y: 0, z: 0, yaw: 0, po: 27 }).po];
      return out;
    });
    assert.ok(r[6].lenganKa > 0.6 && r[6].lenganKi > 0.6 && r[6].turun < 0.05, 'peluk: ' + JSON.stringify(r[6]));
    // gandeng: lengan kanan turun sedikit ke arah pasangan (dekat posisi diam — letak tangan diuji di 60), lengan kiri diam.
    // JEV-134: arah acuan lengan M kini dari sendi siku (bukan tulang kain), putaran lengannya tidak lagi berlebihan
    assert.ok(r[7].lenganKa > 0.1 && r[7].lenganKa > r[7].lenganKi + 0.08 && r[7].lenganKi < 0.2, 'gandeng satu tangan: ' + JSON.stringify(r[7]));
    assert.ok(Math.abs(r[8].turun - 0.42) < 0.05 && r[8].kepala > 0.3, 'duduk bersandar: ' + JSON.stringify(r[8]));
    assert.ok(Math.abs(r[9].pinggul - Math.PI / 2) < 0.1 && Math.abs(r[9].turun - (r[9].tinggi - 0.09)) < 0.05 && r[9].tinggi > 0.7, 'berbaring: ' + JSON.stringify(r[9]));
    assert.ok(r[10].lenganKa > 0.5 && r[10].lenganKi > 0.5, 'dansa: ' + JSON.stringify(r[10]));
    assert.ok(r[15].kepala > 0.3 && r[15].turun < 0.05 && r[15].lenganKa > 0.4, 'cium pipi: ' + JSON.stringify(r[15]));
    assert.ok(Math.abs(r[16].turun - 0.42) < 0.05 && r[16].lenganKi > 1.2, 'dipangku: ' + JSON.stringify(r[16]));
    assert.deepEqual(r.aman, [9, undefined]);
  },

  'NPC: syarat relasi; peluk & dansa berdiri rapat menghadap; gandeng mengikuti di sisi kanan; duduk bareng di sofa yang sama & bersandar; kartu lama "anak" jadi kartu bertema rumah; Berbaring di ranjang (pemain) & NPC tidur di kasur': async (page) => {
    await muatProyekJSON(page, rumah);
    await page.evaluate(() => localStorage.removeItem('npcIngat'));
    await page.waitForFunction(() => window.NPC && ['nA', 'nK'].every(id => window.NPC.keadaan(id) && window.NPC.keadaan(id).siap), undefined, { timeout: 90000 });
    const ngobrol = id => page.evaluate(async id => { const s = window.NPC.keadaan(id).p; camera.position.set(s.x, 1.6, s.z + 1.2); FPS.yaw = Math.PI; FPS.pitch = -0.3;
      await muatModul('kartunpc'); await muatModul('dialog'); window.DIALOG._ai(false); return window.DIALOG.buka(id); }, id);
    const aksi = k => page.evaluate(k => { document.querySelector('#npcObrol [data-aksi="' + k + '"]').click(); return [...document.querySelectorAll('#npcObrol .no-m')].at(-1).textContent; }, k);
    await page.evaluate(() => { enterFPS(); for (let i = 0; i < 3; i++) window.NPC.langkah(0.05); });
    // relasi netral: peluk ditolak
    assert.equal(await ngobrol('nA'), true);
    assert.match(await aksi('peluk'), /belum seakrab|not that close/);
    assert.equal(await page.evaluate(() => window.NPC.keadaan('nA').mode), 'ngobrol');
    // relasi suka: peluk → rapat & menghadap, pose 6; avatar sendiri ikut berpose
    await page.evaluate(() => { const m = JSON.parse(localStorage.getItem('npcIngat')); m.nA.s = 30; localStorage.setItem('npcIngat', JSON.stringify(m)); });
    await page.evaluate(() => { window.DIALOG.tutup(); }); await page.reload(); await muatProyekJSON(page, rumah);
    await page.waitForFunction(() => window.NPC && window.NPC.keadaan('nA') && window.NPC.keadaan('nA').siap, undefined, { timeout: 90000 });
    await page.evaluate(() => { enterFPS(); for (let i = 0; i < 3; i++) window.NPC.langkah(0.05); });
    await ngobrol('nA'); await aksi('peluk');
    const p = await page.evaluate(() => { for (let i = 0; i < 30; i++) window.NPC.langkah(0.05); const s = window.NPC.keadaan('nA'); return { mode: s.mode, po: s.po, jarak: +Math.hypot(s.p.x - camera.position.x, s.p.z - camera.position.z).toFixed(2), panel: $('#npcObrol').hidden, gaya: FPS.gaya && FPS.gaya.k, kirim: window.LOBI.gerak.posSaya().po }; });
    assert.deepEqual([p.mode, p.po, p.panel, p.gaya, p.kirim], ['peluk', 6, true, 'peluk', 6]);
    assert.ok(Math.abs(p.jarak - 0.34) < 0.06, 'rapat: ' + p.jarak);
    // gandeng: pengunjung berjalan 2 m, NPC mengikuti di sisi kanan; Lepas lewat bidikan
    await ngobrol('nA'); await aksi('gandeng');
    const g = await page.evaluate(() => { const yaw = Math.PI; camera.position.set(3, 1.6, 4.4); FPS.yaw = yaw;
      for (let i = 0; i < 40; i++) { camera.position.z -= 0.05; window.NPC.langkah(0.05); }
      const s = window.NPC.keadaan('nA'), kx = -Math.cos(yaw), kz = Math.sin(yaw), dx = s.p.x - camera.position.x, dz = s.p.z - camera.position.z;
      return { mode: s.mode, po: s.po, samping: +(dx * kx + dz * kz).toFixed(2), depan: +Math.abs(dx * Math.sin(yaw) + dz * Math.cos(yaw)).toFixed(2), lepas: window.NPC.ekstra('nA') }; });
    assert.deepEqual([g.mode, g.po, g.lepas], ['gandeng', 7, ['lepas']]);
    assert.ok(Math.abs(g.samping - 0.55) < 0.15 && g.depan < 0.25, 'di sisi kanan: ' + JSON.stringify(g));
    // NPC di samping tak bisa dibidik: bidik ke langit → tombol utama = Lepas untuk NPC itu
    const lp = await page.evaluate(() => { FPS.pitch = 1.2; fpsStep(0); scene.updateMatrixWorld(); AIM_T = 0; stepBidik(0.2); const a = AIM && { jenis: AIM.jenis, id: AIM.id, label: labelAksi(AIM), tampil: !$('#fpsAct').hidden }; if (AIM) pakai(AIM); FPS.pitch = 0; return a; });
    assert.deepEqual(lp, { jenis: 'lepas', id: 'nA', label: 'Lepas', tampil: true });
    assert.equal(await page.evaluate(() => window.NPC.keadaan('nA').mode), 'diam');
    // dansa berdua
    await ngobrol('nA'); await aksi('dansa');
    assert.deepEqual(await page.evaluate(() => { for (let i = 0; i < 10; i++) window.NPC.langkah(0.05); const s = window.NPC.keadaan('nA'); return [s.mode, s.po]; }), ['dansa', 10]);
    await page.evaluate(() => window.NPC.aksiPasangan('nA', 'lepas'));
    // duduk bareng: pengunjung duduk di sofa, NPC duduk di dudukan lain sofa yang sama & bersandar
    const d = await page.evaluate(async () => { const grp = findGroup('obj', 'sofa'); camera.position.set(3, 1.6, 5.4); duduk({ grp, id: 'sofa', titik: grp.localToWorld(new THREE.Vector3(-0.6, 0.4, 0)) });
      await ngobrolLagi(); const t = document.querySelector('#npcObrol [data-aksi="duduk"]'); const tampak = !t.hidden; t.click();
      for (let i = 0; i < 400 && window.NPC.keadaan('nA').mode !== 'duduk'; i++) window.NPC.langkah(0.05);
      for (let i = 0; i < 20; i++) window.NPC.langkah(0.05);
      const s = window.NPC.keadaan('nA'), n = window.NPC._uji.NPC.get('nA');
      return { tampak, mode: s.mode, po: s.po, kursi: s.kursi, beda: +Math.hypot(s.p.x - camera.position.x, s.p.z - camera.position.z).toFixed(2), sandar: +n.a.pw[8].toFixed(2) };
      async function ngobrolLagi() { const p = window.NPC.keadaan('nA').p; window.DIALOG.buka('nA'); return p; } });
    assert.deepEqual([d.tampak, d.mode, d.po, d.kursi], [true, 'duduk', 8, 'sofa']);
    assert.ok(d.beda > 0.4 && d.beda < 1.6 && d.sandar > 0.8, 'duduk di sebelah: ' + JSON.stringify(d));
    // cium pipi & pangku butuh relasi Sayang (≥ 50): di relasi Suka ditolak
    const tolak = await page.evaluate(() => { window.DIALOG.buka('nA'); document.querySelector('#npcObrol [data-aksi="cium"]').click(); const t = [...document.querySelectorAll('#npcObrol .no-m')].at(-1).textContent; window.DIALOG.tutup(); return t; });
    assert.match(tolak, /belum seakrab|not that close/);
    // pangku: NPC duduk menyamping di pangkuan pemain yang duduk di sofa; pemain berdiri → NPC turun ke lantai; lalu cium pipi
    const pk = await page.evaluate(() => {
      const ok = window.NPC.aksiPasangan('nA', 'pangku'); for (let i = 0; i < 30; i++) window.NPC.langkah(0.05);
      const s = window.NPC.keadaan('nA'), n = window.NPC._uji.NPC.get('nA'), D = FPS.duduk;
      const r = { ok, mode: s.mode, po: s.po, dekat: +Math.hypot(s.p.x - D.mata.x, s.p.z - D.mata.z).toFixed(2), y: +(s.p.y - (D.mata.y - 0.72)).toFixed(2), pw: +n.a.pw[16].toFixed(2), lepas: window.NPC.ekstra('nA') };
      berdiri(); for (let i = 0; i < 5; i++) window.NPC.langkah(0.05); const s2 = window.NPC.keadaan('nA'); r.sesudah = s2.mode; r.yTurun = +s2.p.y.toFixed(2);
      const c = window.NPC.aksiPasangan('nA', 'cium'); for (let i = 0; i < 10; i++) window.NPC.langkah(0.05);
      r.cium = [c, window.NPC.keadaan('nA').mode, window.NPC.keadaan('nA').po, scene.children.some(x => x.isSprite && x.userData.noExport)];
      for (let i = 0; i < 70; i++) window.NPC.langkah(0.05); r.ciumSesudah = window.NPC.keadaan('nA').mode; return r; });
    assert.deepEqual([pk.ok, pk.mode, pk.po, pk.lepas, pk.sesudah], [true, 'pangku', 16, ['lepas'], 'diam'], JSON.stringify(pk));
    assert.ok(pk.dekat < 0.45 && Math.abs(pk.y + 0.3) < 0.02 && pk.pw > 0.8 && pk.yTurun < 0.05, 'pangku: ' + JSON.stringify(pk));
    assert.deepEqual([...pk.cium, pk.ciumSesudah], [true, 'cium', 15, true, 'diam'], 'cium pipi: ' + JSON.stringify(pk));
    // kartu anak "Dimas" dihapus (JEV-123): NPC lama berkartu 'anak' memakai kartu bertema rumah, baris aksi tampil
    await ngobrol('nK');
    assert.deepEqual(await page.evaluate(() => [document.querySelector('#npcObrol .no-aksi').hidden, /Dimas/.test($('#npcObrol').textContent), 'anak' in window.KARTU_NPC.KARTU, window.KARTU_NPC.URUT.length]), [false, false, false, 7]);
    await page.evaluate(() => window.DIALOG.tutup());
    // pemain berbaring di ranjang: aksi tambahan "Berbaring", mata di bantal, terkirim sebagai pose 9 di tengah kasur
    const b = await page.evaluate(() => { const grp = findGroup('obj', 'ranjang'); camera.position.set(8, 1.6, 4.6); FPS.yaw = 0; FPS.pitch = -0.5; fpsStep(0); scene.updateMatrixWorld(); AIM_T = 0; stepBidik(0.2);
      const ek = AIM && AIM.ekstra; pakai({ ...AIM, jenis: 'baring' }); for (let i = 0; i < 30; i++) fpsStep(0.05);
      const pos = window.LOBI.gerak.posSaya(); return { ek, baring: !!(FPS.duduk && FPS.duduk.baring), mata: +(camera.position.y - FPS.duduk.baring.y).toFixed(2), po: pos.po, y: +pos.y.toFixed(2), label: labelAksi({ jenis: 'baring' }) }; });
    assert.ok(b.ek.includes('baring'), 'aksi Berbaring: ' + b.ek);
    assert.deepEqual([b.baring, b.po, b.label], [true, 9, 'Berbaring']);
    assert.ok(Math.abs(b.mata - 0.3) < 0.03 && b.y > 0.4, 'mata di atas bantal tidur yang rebah: ' + JSON.stringify(b));
    // NPC diminta berbaring saat pemain rebahan: berbaring di sisi lain kasur yang sama (pose 9); Lepas = NPC bangun
    const bb = await page.evaluate(() => { const U = window.NPC._uji, n = U.NPC.get('nA'); U.aktivitas(n, 0, 1); n.kursi = null; n.mode = 'diam'; n.p.set(6, 0, 4.5);
      const ok = window.NPC.aksiPasangan('nA', 'baring'); for (let i = 0; i < 600 && n.mode !== 'duduk'; i++) window.NPC.langkah(0.05); for (let i = 0; i < 20; i++) window.NPC.langkah(0.05);
      const D = FPS.duduk.baring, r = { ok, mode: n.mode, po: n.po, bareng: n.kursi && n.kursi.bareng, jarak: +Math.hypot(n.p.x - D.x, n.p.z - D.z).toFixed(2), y: +(n.p.y - D.y).toFixed(2), lepas: window.NPC.ekstra('nA') };
      pakai({ jenis: 'lepas', id: 'nA' }); for (let i = 0; i < 30; i++) window.NPC.langkah(0.05); r.bangun = n.mode; return r; });
    assert.deepEqual([bb.ok, bb.mode, bb.po, bb.bareng, bb.lepas], [true, 'duduk', 9, 'ranjang', ['lepas']], JSON.stringify(bb));
    assert.ok(bb.jarak > 0.55 && bb.jarak < 0.95 && Math.abs(bb.y) < 0.05 && bb.bangun !== 'duduk', 'berbaring di sebelah (masing-masing separuh kasur, JEV-127): ' + JSON.stringify(bb));
    // peluk berbaring (meringkuk): NPC rebah miring rapat di sebelah pemain menghadapnya (pose 19), pemain menoleh ke wajahnya
    const mk = await page.evaluate(() => { const U = window.NPC._uji, n = U.NPC.get('nA'); U.aktivitas(n, 0, 1); n.kursi = null; n.mode = 'diam'; n.p.set(6, 0, 4.5);
      const yaw0 = FPS.yaw, ok = window.NPC.aksiPasangan('nA', 'meringkuk'); for (let i = 0; i < 600 && n.mode !== 'duduk'; i++) window.NPC.langkah(0.05); for (let i = 0; i < 30; i++) window.NPC.langkah(0.05);
      const D = FPS.duduk.baring, ke = Math.atan2(D.x - n.p.x, D.z - n.p.z), hadap = Math.cos(ke - n.yaw);
      const r = { ok, mode: n.mode, po: n.po, sisi: Math.abs(n.a.sisi), jarak: +Math.hypot(n.p.x - D.x, n.p.z - D.z).toFixed(2), hadap: +hadap.toFixed(2), noleh: Math.abs(FPS.yaw - yaw0) > 0.5, lepas: window.NPC.ekstra('nA'), bobot: +n.a.pw[19].toFixed(2) };
      pakai({ jenis: 'lepas', id: 'nA' }); for (let i = 0; i < 30; i++) window.NPC.langkah(0.05); r.bangun = n.mode; return r; });
    assert.deepEqual([mk.ok, mk.mode, mk.po, mk.sisi, mk.lepas, mk.noleh], [true, 'duduk', 19, 1, ['lepas'], true], JSON.stringify(mk));
    assert.ok(mk.jarak > 0.25 && mk.jarak < 0.5 && mk.hadap > 0.9 && mk.bobot > 0.8 && mk.bangun !== 'duduk', 'meringkuk rapat menghadap pemain: ' + JSON.stringify(mk));
    // bersandar di dada (pose 20): badan NPC rebah di samping pemain, lebih ke arah kaki ranjang; badan atas condong — pipinya di dada pemain
    const bs = await page.evaluate(() => { const U = window.NPC._uji, n = U.NPC.get('nA'); U.aktivitas(n, 0, 1); n.kursi = null; n.mode = 'diam'; n.p.set(6, 0, 4.5);
      const ok = window.NPC.aksiPasangan('nA', 'bersandar'); for (let i = 0; i < 600 && n.mode !== 'duduk'; i++) window.NPC.langkah(0.05); for (let i = 0; i < 30; i++) window.NPC.langkah(0.05);
      const D = FPS.duduk.baring, kepala = n.a.rig.head.b.getWorldPosition(new THREE.Vector3());
      const r = { ok, mode: n.mode, po: n.po, samping: +Math.abs(n.p.x - D.x).toFixed(2), keKaki: +(n.p.z - D.z).toFixed(2), kepalaDada: +Math.hypot(kepala.x - D.x, kepala.z - (D.z - 0.15)).toFixed(2), tinggi: +(kepala.y - D.y).toFixed(2) };
      pakai({ jenis: 'lepas', id: 'nA' }); for (let i = 0; i < 30; i++) window.NPC.langkah(0.05); return r; });
    assert.deepEqual([bs.ok, bs.mode, bs.po], [true, 'duduk', 20], JSON.stringify(bs));
    assert.ok(bs.samping > 0.3 && bs.keKaki > 0.2 && bs.kepalaDada < 0.2 && bs.tinggi > 0.18, 'kepala bersandar di dada: ' + JSON.stringify(bs));
    await page.evaluate(() => berdiri());
    assert.equal(await page.evaluate(() => window.NPC.aksiPasangan('nA', 'meringkuk') || window.NPC.aksiPasangan('nA', 'bersandar')), false, 'tanpa rebahan: ditolak');
    // NPC tidur di kasur
    // sisi kasur dipilih acak: sisi yang menempel dinding dibuang, sisi yang jalurnya macet membuat NPC memilih tempat lain — ulangi
    const t = await page.evaluate(() => { const U = window.NPC._uji, n = U.NPC.get('nA'); let r = null;
      for (let coba = 0; coba < 3 && !(r && r.po === 9); coba++) {
        U.aktivitas(n, 0, 1); n.kursi = null; n.mode = 'diam'; n.p.set(5, 0, 4);
        let k = null; for (let i = 0; i < 12 && !k; i++) k = U.cariKasur(n); if (!k) continue;
        n.kursi = k; U.mulaiJalan(n, k.q.x, k.q.z, 'kursi');
        for (let i = 0; i < 600 && n.mode !== 'duduk'; i++) window.NPC.langkah(0.05); for (let i = 0; i < 20; i++) window.NPC.langkah(0.05);
        r = { mode: n.mode, po: n.po, y: +n.p.y.toFixed(2), kasur: k.id, baring: +n.a.pw[9].toFixed(2) };
      }
      return r; });
    assert.ok(t, 'kasur ditemukan');
    assert.deepEqual([t.mode, t.po, t.kasur], ['duduk', 9, 'ranjang']); assert.ok(t.y > 0.4 && t.baring > 0.8, 'tidur di kasur: ' + JSON.stringify(t));
    await page.evaluate(() => exitFPS());
  },
};
