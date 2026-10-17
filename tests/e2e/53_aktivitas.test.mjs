import assert from 'node:assert/strict';
import { muatProyekJSON } from './harness.mjs';

// JEV-110: aktivitas & mini game — mancing, potong kayu, panggang, angkat & taruh; bonding (kedekatan harian, hadiah dari tas, NPC menemani)
const dinding = [[0, 0, 12, 0], [12, 0, 12, 10], [12, 10, 0, 10], [0, 10, 0, 0]].map(([x1, z1, x2, z2], i) => ({ id: 'w' + i, x1, z1, x2, z2, thickness: 0.15, openings: [] }));
const obj = (id, kind, type, x, z, params = {}, rotY = 0) => ({ id, kind, type, x, y: 0, z, rotY, sx: 1, sy: 1, sz: 1, params });
const rumah = { v: 1, levels: [{ name: 'L1', height: 3, walls: dinding, objects: [
  obj('kolam', 'area', 'kolam_ikan', 3, 14, { jenis: 'kolam_ikan', kedalaman: 0.6, pts: [[-2, -1.4], [2, -1.4], [2, 1.4], [-2, 1.4]] }),
  obj('tunggul', 'furn', 'tunggul_kayu', 9, 3), obj('bbq', 'furn', 'panggangan', 9, 8), obj('pot', 'furn', 'pot_taman', 6, 2),
  obj('nS', 'npc', 'F', 4, 3, { benih: 5, jelajah: 4, kartu: 'tetangga' }, Math.PI)] }] };

const bidik = (page, x, z, yaw, pitch) => page.evaluate(([x, z, yaw, pitch]) => { camera.position.set(x, 1.6, z); FPS.yaw = yaw; FPS.pitch = pitch; fpsStep(0); scene.updateMatrixWorld(); AIM_T = 0; stepBidik(0.2);
  return AIM && { jenis: AIM.jenis, label: labelAksi(AIM), ekstra: AIM.ekstra || [] }; }, [x, z, yaw, pitch]);
const pakaiAim = page => page.evaluate(async () => { pakai(AIM); for (let i = 0; i < 100 && !window.AKT; i++) await new Promise(r => setTimeout(r, 50)); await new Promise(r => setTimeout(r, 50)); });

export const tes = {
  'mini game: mancing (lempar → sambar → tarik dengan tegangan), potong kayu (zona), panggang (balik & angkat), hasil masuk tas; pose terkirim': async (page) => {
    await muatProyekJSON(page, rumah);
    await page.evaluate(() => { localStorage.removeItem('aktTas'); localStorage.removeItem('npcIngat'); enterFPS(); });
    // ---- mancing
    const a = await bidik(page, 3, 11.8, 0, -0.7);
    assert.deepEqual([a.jenis, a.label], ['mancing', 'Mancing']);
    await pakaiAim(page);
    const m = await page.evaluate(() => { const K = window.AKT, U = K._uji, A = U.A(), out = { kunci: K.kunci(), hud: !$('#aktHud').hidden, pose: window.LOBI ? null : null };
      U.tekan(1, true); for (let i = 0; i < 10; i++) K.langkah(0.05); U.tekan(1, false); out.terbang = A.tahap;
      for (let i = 0; i < 30 && A.tahap !== 'tunggu'; i++) K.langkah(0.05); out.tunggu = A.tahap; out.diAir = pointInPoly(A.pelampung.position.x, A.pelampung.position.z, A.poli);
      A.tunggu = 0; K.langkah(0.05); out.gigit = A.tahap; U.tekan(1, true); out.tarik = A.tahap; U.tekan(1, false);
      A.ikan = U.pilihIkan(); A.ikan = { ...A.ikan, kuat: 0.3, sampah: false, k: 'nila', n: ['Ikan Nila', 'Tilapia'], b: [1, 1] };
      U.tekan(1, true); let maks = 0; for (let i = 0; i < 600 && A.tahap === 'tarik'; i++) { K.langkah(0.05); maks = Math.max(maks, A.T); }
      U.tekan(1, false); out.hasil = A.tahap; out.tegMaks = +maks.toFixed(2); out.ikan = U.TAS().ikan.map(x => x.nama); out.meter = !!$('#aktHud .ak-meter canvas');
      return out; });
    assert.deepEqual([m.kunci, m.hud, m.terbang, m.tunggu, m.diAir, m.gigit, m.tarik], [true, true, 'terbang', 'tunggu', true, 'gigit', 'tarik']);
    assert.equal(m.hasil, 'hasil'); assert.ok(m.tegMaks > 0.3 && m.tegMaks < 1, 'tegangan: ' + m.tegMaks); assert.deepEqual(m.ikan, ['Ikan Nila 1 kg']);
    // tali putus bila tegangan dibiarkan terlalu tinggi
    const putus = await page.evaluate(() => { const K = window.AKT, U = K._uji, A = U.A(); for (let i = 0; i < 60 && A.tahap !== 'siap'; i++) K.langkah(0.05);
      U.tekan(1, true); for (let i = 0; i < 10; i++) K.langkah(0.05); U.tekan(1, false); for (let i = 0; i < 30 && A.tahap !== 'tunggu'; i++) K.langkah(0.05); A.tunggu = 0; K.langkah(0.05); U.tekan(1, true); U.tekan(1, false);
      A.ikan = { ...A.ikan, kuat: 1.6 }; U.tekan(1, true); for (let i = 0; i < 200 && A.tahap === 'tarik'; i++) K.langkah(0.05); U.tekan(1, false); return [A.tahap, $('#aktHud .ak-teks').textContent]; });
    assert.equal(putus[0], 'hasil'); assert.match(putus[1], /putus|snapped/);
    assert.equal(await page.evaluate(() => window.LOBI ? true : (muatModul('lobi').then(() => true))), true);
    assert.equal(await page.evaluate(() => window.LOBI.gerak.posSaya().po), 12, 'pose memancing terkirim');
    await page.evaluate(() => window.AKT.selesai());
    assert.deepEqual(await page.evaluate(() => [window.AKT.kunci(), $('#aktHud').hidden, document.body.classList.contains('aktivitas')]), [false, true, false]);
    // ---- potong kayu
    const p = await bidik(page, 9, 1.6, 0, -0.5);
    assert.deepEqual([p.jenis, p.label], ['potong', 'Potong kayu']);
    await pakaiAim(page);
    const k = await page.evaluate(() => { const K = window.AKT, U = K._uji, A = U.A(), out = {};
      A.v = 0; A.m = (A.zona[0] + A.zona[1]) / 2; U.tekan(1, true); U.tekan(1, false); for (let i = 0; i < 8; i++) K.langkah(0.05); out.kena = U.TAS().kayu;
      for (let i = 0; i < 40; i++) K.langkah(0.05); A.v = 0; A.m = A.zona[1] + 0.1 > 1 ? A.zona[0] - 0.1 : A.zona[1] + 0.1; U.tekan(1, true); U.tekan(1, false); for (let i = 0; i < 8; i++) K.langkah(0.05); out.meleset = U.TAS().kayu;
      out.pose = window.LOBI.gerak.posSaya().po; K.selesai(); return out; });
    assert.deepEqual(k, { kena: 2, meleset: 2, pose: 13 });
    // ---- panggang: butuh kayu, pilih ikan dari tas, balik & angkat tepat → sempurna
    const g = await bidik(page, 9, 6.6, 0, -0.55);
    assert.deepEqual([g.jenis, g.label], ['panggang', 'Panggang']);
    await pakaiAim(page);
    const c = await page.evaluate(() => { const K = window.AKT, U = K._uji, A = U.A(), out = { kayu: U.TAS().kayu, pilihan: [...document.querySelectorAll('#aktHud [data-bahan]')].map(b => b.dataset.bahan) };
      document.querySelector('#aktHud [data-bahan="ikan"]').click(); out.tahap = A.tahap; out.ikanSisa = U.TAS().ikan.length;
      A.sisi[A.bawah] = 0.7; U.tekan(1, true); U.tekan(1, false); for (let i = 0; i < 10; i++) K.langkah(0.05); A.sisi[A.bawah] = 0.7; U.tekan(2, true); U.tekan(2, false);
      out.masakan = U.TAS().masakan; out.pose = window.LOBI.gerak.posSaya().po; K.selesai(); return out; });
    assert.equal(c.kayu, 1, 'satu kayu terpakai'); assert.ok(c.pilihan.includes('ikan') && c.pilihan.includes('jagung'));
    assert.deepEqual([c.tahap, c.ikanSisa, c.pose], ['masak', 0, 14]);
    assert.deepEqual([c.masakan.length, c.masakan[0].mutu], [1, 'sempurna']);
    assert.match(c.masakan[0].nama, /Ikan bakar|Grilled fish/);
    // tanpa kayu: panggangan menolak
    const tolak = await page.evaluate(async () => { const T = window.AKT._uji.TAS(); T.kayu = 0; let pesan = ''; const asli = window.toast; window.toast = m => { pesan = m; return asli(m); };
      pakai({ jenis: 'panggang', id: 'bbq' }); await new Promise(r => setTimeout(r, 150)); window.toast = asli; return [window.AKT.kunci(), pesan]; });
    assert.equal(tolak[0], false); assert.match(tolak[1], /kayu bakar|firewood/);
    await page.evaluate(() => exitFPS());
  },

  'bonding: hadiah masakan dari tas menaikkan relasi, batas harian, NPC ikut menemani aktivitas & bersorak; angkat & taruh barang kecil': async (page) => {
    await muatProyekJSON(page, rumah);
    await page.evaluate(() => { localStorage.setItem('aktTas', JSON.stringify({ ikan: [{ nama: 'Ikan Mas 2 kg', berat: 2 }], kayu: 3, masakan: [{ nama: 'Ikan bakar', mutu: 'sempurna' }] })); localStorage.removeItem('npcIngat'); });
    await page.reload(); await muatProyekJSON(page, rumah);
    await page.waitForFunction(() => window.NPC && window.NPC.keadaan('nS') && window.NPC.keadaan('nS').siap, undefined, { timeout: 90000 });
    await page.evaluate(async () => { enterFPS(); for (let i = 0; i < 3; i++) window.NPC.langkah(0.05); await muatModul('aktivitas'); await muatModul('kartunpc'); await muatModul('dialog'); window.DIALOG._ai(false); });
    // hadiah masakan sempurna dari tas → +18
    const h = await page.evaluate(() => { const p = window.NPC.keadaan('nS').p; camera.position.set(p.x, 1.6, p.z + 1.2); FPS.yaw = Math.PI; window.DIALOG.buka('nS');
      const s0 = window.DIALOG.skor('nS'); document.querySelector('#npcObrol [data-cepat="hadiah"]').click();
      const tombol = [...document.querySelectorAll('#npcObrol [data-barang]')].map(b => b.dataset.barang); document.querySelector('#npcObrol [data-barang="masakan"]').click();
      return { tombol, naik: window.DIALOG.skor('nS') - s0, sisa: window.AKT.tas().masakan.length, batang: document.querySelector('#npcObrol .no-batang i').style.width }; });
    assert.deepEqual(h.tombol.sort(), ['ikan', 'kayu', 'masakan']); assert.equal(h.naik, 18); assert.equal(h.sisa, 0); assert.ok(parseInt(h.batang) > 0);
    // batas harian: total kenaikan ≤ 30 per hari
    const cap = await page.evaluate(() => { const a = window.DIALOG.tambahRelasi('nS', 50); return [a, window.DIALOG.skor('nS')]; });
    assert.ok(cap[0] <= 12 && cap[1] <= 30, 'batas harian: ' + cap);
    // ajak ikut → NPC mengikuti; saat mancing NPC menemani (duduk di dekat) & bersorak ketika ikan didapat
    const ikut = await page.evaluate(() => { document.querySelector('#npcObrol [data-cepat="ikut"]').click(); const m1 = window.NPC.keadaan('nS').mode;
      camera.position.set(4, 1.6, 4.4); FPS.yaw = 0; for (let i = 0; i < 80; i++) window.NPC.langkah(0.05); const p = window.NPC.keadaan('nS').p;
      return { m1, jarak: +Math.hypot(p.x - camera.position.x, p.z - camera.position.z).toFixed(2) }; });
    assert.equal(ikut.m1, 'ikut'); assert.ok(ikut.jarak < 2, 'mengikuti: ' + ikut.jarak);
    const tem = await page.evaluate(() => { const ib = window.DIALOG.skor('nS'); const a = window.NPC.keadaan('nS'); void a;
      pakai({ jenis: 'mancing', id: 'kolam', titik: new THREE.Vector3(3, -0.16, 14) });
      return new Promise(ok => setTimeout(() => { const K = window.AKT, A = K._uji.A(); for (let i = 0; i < 60; i++) window.NPC.langkah(0.05);
        const mode = window.NPC.keadaan('nS').mode, po = window.NPC.keadaan('nS').po; A.ikan = { k: 'mas', n: ['Ikan Mas', 'Carp'], b: [1, 1], kuat: 0.5, w: 0xd9a03c }; A.ke = A.lihat.clone(); A.jarakAwal = 3; A.pelampung.position.copy(A.ke);
        K._uji.dapat(); setTimeout(() => ok({ mode, po, naik: window.DIALOG.skor('nS') - ib, sorak: window.NPC._uji.NPC.get('nS').sorak > 0 }), 400); }, 300)); });
    assert.deepEqual([tem.mode, tem.po, tem.sorak], ['temani', 2, true]);
    assert.ok(tem.naik >= 0, 'bonus (dibatasi batas harian): ' + tem.naik);
    await page.evaluate(() => window.AKT.selesai());
    assert.equal(await page.evaluate(() => window.NPC.keadaan('nS').mode), 'ikut', 'kembali mengikuti');
    // angkat & taruh pot taman
    const ang = await bidik(page, 6, 0.9, 0, -0.75);
    assert.ok(ang && (ang.jenis === 'angkat' || ang.ekstra.includes('angkat')), 'aksi Angkat: ' + JSON.stringify(ang));
    const t = await page.evaluate(() => { window.AKT.pakai({ jenis: 'angkat', id: 'pot' }); const bawa = window.AKT.membawa(), po = window.LOBI.gerak.posSaya().po;
      camera.position.set(8, 1.6, 4); FPS.yaw = 0; FPS.pitch = -0.6; fpsStep(0); for (let i = 0; i < 5; i++) window.AKT.langkah(0.05); scene.updateMatrixWorld(); AIM_T = 0; stepBidik(0.2);
      const label = labelAksi(AIM), jenis = AIM.jenis; window.AKT.pakai(AIM); const o = cariObjek('pot');
      return { bawa, po, jenis, label, x: o.x, z: o.z, masih: window.AKT.membawa(), sesudah: window.LOBI.gerak.posSaya().po }; });
    assert.deepEqual([t.bawa, t.po, t.jenis, t.label, t.masih], [true, 11, 'taruh', 'Taruh', false]);
    assert.ok(Math.abs(t.x - 8) < 0.3 && t.z > 4.5 && t.z < 7, 'ditaruh di depan: ' + t.x + ',' + t.z);
    assert.notEqual(t.sesudah, 11);
    // pose aktivitas diterima lobi
    assert.deepEqual(await page.evaluate(() => [window.LOBI.gerak.posAman({ jalan: 1, x: 0, y: 0, z: 0, yaw: 0, po: 14 }).po, window.LOBI.gerak.posAman({ jalan: 1, x: 0, y: 0, z: 0, yaw: 0, po: 20 }).po]), [14, undefined]);
    await page.evaluate(() => exitFPS());
  },
};
