import assert from 'node:assert/strict';
import { muatProyekJSON } from './harness.mjs';

// JEV-100: waktu berganti halus (siang → senja → malam), siklus waktu otomatis, cuaca hujan / badai
const rumah = { v: 1, levels: [{ name: 'L1', height: 3, walls: [[0, 0, 6, 0], [6, 0, 6, 5], [6, 5, 0, 5], [0, 5, 0, 0]].map(([x1, z1, x2, z2], i) => ({ id: 'w' + i, x1, z1, x2, z2, thickness: 0.15, openings: [] })), objects: [] }] };

export const tes = {
  'waktu: pilihan Waktu di mode jalan berganti halus siang → senja → malam (bukan meloncat)': async (page) => {
    await muatProyekJSON(page, rumah);
    await page.evaluate(() => { setSuasana('siang'); enterFPS(); });
    const awal = await page.evaluate(() => sun.intensity);
    const pilih = v => page.evaluate(v => { const e = $('#fpsMood'); e.value = v; e.dispatchEvent(new Event('change')); }, v);
    await page.evaluate(() => muatModul('cuaca'));
    await pilih('senja');
    await page.waitForFunction(() => window.CUACA && CUACA.keadaan().transisi);
    // transisi digerakkan langsung (frame headless lambat): setengah jalan lalu sampai selesai
    const r = await page.evaluate(() => { const T = []; CUACA.langkah(2); T.push({ mood: MOOD, sun: sun.intensity, transisi: CUACA.keadaan().transisi });
      CUACA.langkah(2.5); T.push({ sun: sun.intensity, transisi: CUACA.keadaan().transisi }); return T; });
    const [tengah, akhir] = r;
    assert.equal(tengah.mood, 'senja');
    assert.equal(tengah.transisi, true);
    assert.equal(akhir.transisi, false);
    assert.ok(Math.abs(akhir.sun - 1.2) < 1e-3, 'akhir = senja: ' + akhir.sun);
    assert.ok(tengah.sun > Math.min(awal, akhir.sun) + 1e-3 && tengah.sun < Math.max(awal, akhir.sun) - 1e-3, 'di tengah transisi nilainya antara: ' + [awal, tengah.sun, akhir.sun]);
    await pilih('malam'); await page.evaluate(() => CUACA.langkah(5));
    assert.equal(await page.evaluate(() => MOOD), 'malam');
    await page.evaluate(() => exitFPS());
  },

  'siklus waktu: berputar sendiri di mode jalan; tersimpan di proyek & lolos penyaring; diam di editor': async (page) => {
    await muatProyekJSON(page, rumah);
    await page.click('.tabs button[data-tab="tampilan"]');
    await page.selectOption('#siklus', '2');
    assert.deepEqual(await page.evaluate(() => PROJECT.cuaca), { jenis: 'cerah', siklus: 2 });
    await page.waitForFunction(() => !!window.CUACA);
    const r = await page.evaluate(async () => {
      setSuasana('siang'); for (let i = 0; i < 40; i++) CUACA.langkah(1); const editor = MOOD;          // editor: siklus tidak berjalan
      enterFPS(); const urut = [MOOD];
      for (let i = 0; i < 400; i++) { CUACA.langkah(0.5); if (urut.at(-1) !== MOOD) urut.push(MOOD); }    // 200 dtk ≥ satu putaran 2 menit
      exitFPS(); return { editor, urut };
    });
    assert.equal(r.editor, 'siang');
    assert.deepEqual(r.urut.slice(0, 5), ['siang', 'senja', 'malam', 'senja', 'siang'], 'siang → senja → malam → fajar → siang');
    const s = await page.evaluate(() => { const j = JSON.parse(JSON.stringify(PROJECT)); const a = sanitasiProyek(j).cuaca; j.cuaca = { jenis: '<x>', siklus: 99 }; return [a, sanitasiProyek(j).cuaca]; });
    assert.deepEqual(s, [{ jenis: 'cerah', siklus: 2 }, undefined]);
  },

  'hujan: tetes hanya di mode jalan, tidak di dalam rumah, langit mendung & matahari redup, tanah basah; badai berkilat; kembali cerah': async (page) => {
    await muatProyekJSON(page, rumah);
    await page.click('.tabs button[data-tab="tampilan"]');
    await page.selectOption('#cuaca', 'hujan');
    await page.waitForFunction(() => !!window.CUACA);
    const r = await page.evaluate(async () => {
      setSuasana('siang'); const sunCerah = sun.intensity;
      for (let i = 0; i < 10; i++) CUACA.langkah(0.5); const editor = CUACA.keadaan().tetes;
      enterFPS(); for (let i = 0; i < 10; i++) CUACA.langkah(0.5);
      const k = CUACA.keadaan(); let kasar = null; worldRoot.traverse(m => { if (m.isMesh && m.userData.situs && kasar == null) kasar = [].concat(m.material)[0].roughness; });
      return { editor, tetes: k.tetes, w: k.w, sun: sun.intensity, sunCerah, dalam: CUACA.diDalam(3, 2.5), luar: CUACA.diDalam(-3, -3), kasar,
        sinkron: $('#fpsCuaca').value, adegan: adeganKini().cuaca };
    });
    assert.equal(r.editor, 0, 'editor tanpa hujan');
    assert.ok(r.tetes > 1000 && r.w > 0.79, 'hujan turun di mode jalan: ' + r.tetes);
    assert.ok(r.sun < r.sunCerah * 0.4, 'matahari redup');
    assert.deepEqual([r.dalam, r.luar], [true, false], 'masker beratap = tapak rumah');
    assert.ok(r.kasar == null || r.kasar < 0.8, 'tanah basah mengkilap: ' + r.kasar);
    assert.equal(r.sinkron, 'hujan');
    assert.deepEqual(r.adegan, { jenis: 'hujan', siklus: 0 }, 'cuaca ikut keadaan lobi');
    // badai: kilat menyalakan cahaya langit sesaat
    await page.selectOption('#fpsCuaca', 'badai');
    const kilat = await page.evaluate(() => { for (let i = 0; i < 8; i++) CUACA.langkah(0.5); let maks = 0; const dasar = hemiL.intensity;
      for (let i = 0; i < 400; i++) { CUACA.langkah(0.05); maks = Math.max(maks, hemiL.intensity); } return maks / Math.max(1e-6, dasar); });
    assert.ok(kilat > 3, 'kilat: ' + kilat);
    // cerah lagi → tetes hilang, matahari pulih
    await page.selectOption('#fpsCuaca', 'cerah');
    const c = await page.evaluate(() => { for (let i = 0; i < 10; i++) CUACA.langkah(0.5); const k = CUACA.keadaan(); exitFPS(); return [k.tetes, Math.round(sun.intensity * 100) / 100, PROJECT.cuaca]; });
    assert.deepEqual(c, [0, 0.9, undefined]);
  },

  'cuaca Acak: bawaan Cerah; pilihan Acak membuat hujan turun tiba-tiba lalu reda (tanpa perlu siklus waktu)': async (page) => {
    await muatProyekJSON(page, rumah);
    await page.click('.tabs button[data-tab="tampilan"]');
    assert.equal(await page.evaluate(() => $('#cuaca').value), 'cerah', 'bawaan cerah');
    await page.selectOption('#cuaca', 'acak');
    await page.waitForFunction(() => !!window.CUACA);
    const r = await page.evaluate(() => {
      const asli = Math.random; Math.random = () => 0.3;                 // peluang terpenuhi, jenis 'gerimis'
      enterFPS(); let mulai = -1, jenis = null, tetes = 0, toast1 = '';
      for (let i = 0; i < 200 && mulai < 0; i++) { CUACA.langkah(0.5); const k = CUACA.keadaan(); if (k.acak) { mulai = i; jenis = k.acak; toast1 = $('#toast').textContent + ' | ' + $('#fpsCuaca').selectedOptions[0].textContent; } }
      for (let i = 0; i < 12; i++) CUACA.langkah(0.5); tetes = CUACA.keadaan().tetes;
      let reda = -1; for (let i = 0; i < 400 && reda < 0; i++) { CUACA.langkah(0.5); if (!CUACA.keadaan().acak) reda = i; }
      const toast2 = $('#toast').textContent;
      for (let i = 0; i < 12; i++) CUACA.langkah(0.5); const sisa = CUACA.keadaan().tetes;
      Math.random = asli; exitFPS();
      return { mulai, jenis, tetes, reda, sisa, toast1, toast2, simpan: PROJECT.cuaca };
    });
    assert.ok(r.mulai >= 0, 'hujan turun sendiri');
    assert.equal(r.jenis, 'gerimis');
    assert.ok(r.tetes > 0, 'tetes tampil');
    assert.match(r.toast1, /Gerimis.*\| 🎲 Acak · sekarang gerimis/);
    assert.ok(r.reda >= 0, 'hujan reda lagi');
    assert.match(r.toast2, /reda/);
    assert.equal(r.sisa, 0);
    assert.deepEqual(r.simpan, { jenis: 'acak', siklus: 0 }, 'pengaturan proyek tetap Acak');
    // cuaca Cerah (meski siklus waktu berjalan): tidak pernah hujan sendiri
    const tanpa = await page.evaluate(() => { aturCuaca({ jenis: 'cerah', siklus: 2 }); const asli = Math.random; Math.random = () => 0.01; enterFPS();
      for (let i = 0; i < 300; i++) CUACA.langkah(0.5); const k = CUACA.keadaan(); Math.random = asli; exitFPS(); return [k.acak, k.tetes]; });
    assert.deepEqual(tanpa, [null, 0]);
  },

  'sakelar Siklus waktu di mode jalan: nyala → waktu berjalan & cuaca Cerah jadi Acak; pilihan cuaca tetap dihormati; mati → waktu tetap': async (page) => {
    await muatProyekJSON(page, rumah);
    await page.evaluate(() => enterFPS());
    const klik = () => page.evaluate(() => $('#fpsOto').click());
    await klik();
    await page.waitForFunction(() => window.CUACA && CUACA.keadaan().siklus === 6);
    assert.deepEqual(await page.evaluate(() => [PROJECT.cuaca, $('#fpsOto').getAttribute('aria-pressed'), $('#fpsCuaca').value]), [{ jenis: 'acak', siklus: 6 }, 'true', 'acak']);
    // memilih Hujan: tetap hujan (bukan acak), siklus waktu tetap berjalan
    await page.evaluate(() => { const e = $('#fpsCuaca'); e.value = 'hujan'; e.dispatchEvent(new Event('change')); });
    await page.waitForFunction(() => CUACA.keadaan().jenis === 'hujan');
    const r = await page.evaluate(() => { for (let i = 0; i < 10; i++) CUACA.langkah(0.5); const k = CUACA.keadaan(); return [k.efektif, k.tetes > 0, $('#fpsCuaca').value, PROJECT.cuaca]; });
    assert.deepEqual(r, ['hujan', true, 'hujan', { jenis: 'hujan', siklus: 6 }]);
    // mati: waktu berhenti, cuaca pilihan tetap
    await klik();
    await page.waitForFunction(() => CUACA.keadaan().siklus === 0);
    const m = await page.evaluate(() => { for (let i = 0; i < 4; i++) CUACA.langkah(0.5); const k = CUACA.keadaan(); return [PROJECT.cuaca, k.efektif, k.tetes > 0, $('#fpsOto').getAttribute('aria-pressed')]; });
    assert.deepEqual(m, [{ jenis: 'hujan', siklus: 0 }, 'hujan', true, 'false']);
    await page.evaluate(() => exitFPS());
  },
};
