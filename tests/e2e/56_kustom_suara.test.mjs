import assert from 'node:assert/strict';
import { muatProyekJSON } from './harness.mjs';

// JEV-116: kustom tampilan karakter (warna per bagian & pakaian) untuk NPC & avatar Main bareng; suara NPC sintetis —
// gumaman saat bicara, sorakan, "huft"
const rumah = { v: 1, levels: [{ name: 'L1', height: 3, walls: [[0, 0, 8, 0], [8, 0, 8, 6], [8, 6, 0, 6], [0, 6, 0, 0]].map(([x1, z1, x2, z2], i) => ({ id: 'w' + i, x1, z1, x2, z2, thickness: 0.15, openings: [] })),
  objects: [{ id: 'nF', kind: 'npc', type: 'F', x: 3, y: 0, z: 3, rotY: 0, sx: 1, sy: 1, sz: 1, params: { benih: 5, jelajah: 0 } }] }] };
const siap = page => page.waitForFunction(() => window.NPC && window.NPC.keadaan('nF') && window.NPC.keadaan('nF').siap, undefined, { timeout: 90000 });

export const tes = {
  'kustom NPC: pilih warna per bagian & pakaian di inspector → model diwarnai ulang, pakaian renang dipakai terus; warna otomatis mengembalikan': async (page) => {
    await muatProyekJSON(page, rumah);
    await siap(page);
    await page.evaluate(() => { select('obj', 'nF'); renderInspector(); });
    const r = await page.evaluate(async () => {
      const N = window.NPC, n = () => N._uji.NPC.get('nF'), peta = () => { const t = []; n().a.model.traverse(m => { if (m.isMesh && m.material.map) t.push(m.material.map); }); return t; };
      const inp = [...document.querySelectorAll('#inspector .npc-warna input[type=color]')], out = { bagian: inp.map(i => i.dataset.bagian), pakaian: [...document.querySelectorAll('#inspector .npc-sunting-bar option')].map(o => o.value) };
      const t0 = peta();
      const atas = document.querySelector('#inspector .npc-warna input[data-bagian="atas"]'); atas.value = '#ff0000'; atas.dispatchEvent(new Event('change'));
      for (let i = 0; i < 40 && peta()[0] === t0[0]; i++) await new Promise(r => setTimeout(r, 50));
      const o = L().objects.find(x => x.id === 'nF');
      out.warna = o.params.warna; out.penampilan = N.penampilan(o).atas; out.berubah = peta().some((t, i) => t !== t0[i]); out.ulang = !document.querySelector('#inspector .npc-sunting-bar button').hidden;
      // pakaian: bikini dipakai terus (bukan hanya saat berenang)
      const sel = document.querySelector('#inspector .npc-sunting-bar select'); sel.value = 'renang'; sel.dispatchEvent(new Event('change'));
      enterFPS(); for (let i = 0; i < 200 && (n().a.baju || '') !== '_renang'; i++) { await new Promise(r => setTimeout(r, 50)); N.langkah(0.05); }
      out.baju = n().a.baju; out.paramBaju = o.params.baju; exitFPS();
      // warna otomatis: warna pilihan dihapus
      select('obj', 'nF'); renderInspector(); document.querySelector('#inspector .npc-sunting-bar button').click();
      out.sesudahUlang = L().objects.find(x => x.id === 'nF').params.warna || null;
      out.aman = [N.warnaAman({ atas: '#ABCDEF', rambut: 'red', kulit: '#12345g', lain: '#000000' }), N.bajuAman('M', 'renang2'), N.bajuAman('F', 'renang2'), N.bajuAman('F', '../x')];
      return out; });
    assert.deepEqual(r.bagian, ['kulit', 'rambut', 'atas', 'bawah', 'sepatu']);
    assert.deepEqual(r.pakaian, ['', 'renang', 'renang2']);
    assert.deepEqual([r.warna, r.penampilan, r.berubah, r.ulang], [{ atas: '#ff0000' }, [255, 0, 0], true, true], JSON.stringify(r));
    assert.deepEqual([r.baju, r.paramBaju], ['_renang', 'renang'], 'pakaian renang dipakai terus');
    assert.equal(r.sesudahUlang, null, 'warna otomatis');
    assert.deepEqual(r.aman, [{ atas: '#abcdef' }, '', 'renang2', '']);
  },

  'kustom avatar Main bareng: warna & pakaian dipilih di panel, diingat, terkirim tersaring (avAman)': async (page) => {
    await muatProyekJSON(page, rumah);
    await page.evaluate(() => document.querySelectorAll('#lobiSiap .lobi-kartu')[0].click());
    const r = await page.evaluate(async () => {
      for (let i = 0; i < 100 && document.querySelectorAll('#lobiSiap .lobi-av-contoh input[type=color]').length < 5; i++) await new Promise(r => setTimeout(r, 50));
      const out = { jumlah: document.querySelectorAll('#lobiSiap .lobi-av-contoh input[type=color]').length };
      const rb = document.querySelector('#lobiSiap .lobi-av-contoh input[data-bagian="rambut"]'); rb.value = '#3366ff'; rb.dispatchEvent(new Event('change'));
      await new Promise(r => setTimeout(r, 300));
      const sel = document.querySelector('#lobiSiap .lobi-av-contoh select'); sel.value = 'renang2'; sel.dispatchEvent(new Event('change'));
      await new Promise(r => setTimeout(r, 300));
      out.d = { warna: AVATAR_LOBI.d.warna, baju: AVATAR_LOBI.d.baju }; out.simpan = JSON.parse(localStorage.getItem('lobiAvatar3D'));
      await muatModul('lobi'); const A = window.LOBI.avAman;
      out.aman = [A({ bawaan: 'F', benih: 1, warna: { rambut: '#3366FF', atas: 'javascript:1' }, baju: 'renang2' }), A({ bawaan: 'M', benih: 1, warna: 'x', baju: 'renang2' }), A({ bawaan: 'M', baju: 'renang' })];
      // Ganti warna: benih baru, warna pilihan dilepas, pakaian tetap
      [...document.querySelectorAll('#lobiSiap .lobi-av-warna > button')].find(b => /Ganti warna/.test(b.textContent)).click();
      out.ganti = { warna: AVATAR_LOBI.d.warna || null, baju: AVATAR_LOBI.d.baju };
      return out; });
    assert.equal(r.jumlah, 5);
    assert.deepEqual(r.d, { warna: { rambut: '#3366ff' }, baju: 'renang2' });
    assert.deepEqual([r.simpan.warna, r.simpan.baju], [{ rambut: '#3366ff' }, 'renang2']);
    assert.deepEqual(r.aman, [{ bawaan: 'F', benih: 1, warna: { rambut: '#3366ff' }, baju: 'renang2' }, { bawaan: 'M', benih: 1 }, { bawaan: 'M', baju: 'renang' }]);
    assert.deepEqual(r.ganti, { warna: null, baju: 'renang2' });
  },

  'NPC tetap tergambar: tanda lama (tulang cadangan, warna polos) dibuang; NPC berenang / berbaring & sesaat setelah memori grafis pulih tidak ikut uji gambar; ganti warna tidak menumpuk tekstur; memori grafis habis → kualitas render turun & diingat': async (page) => {
    await page.evaluate(() => localStorage.setItem('npcPerbaiki', JSON.stringify({ tulang: 1, kul: 1, peta: 'polos' })));
    await muatProyekJSON(page, rumah);
    await siap(page);
    const r = await page.evaluate(async () => {
      const U = window.NPC._uji, n = U.NPC.get('nF');
      const out = { simpan: JSON.parse(localStorage.getItem('npcPerbaiki')), perbaikan: { ...U.perbaikan() }, fvt: renderer.capabilities.floatVertexTextures };
      n.renang = { airY: 0 }; n.uji = undefined; U.ujiDanPerbaiki(); out.renang = n.uji === undefined; n.renang = null;
      const pw = n.a.pw.slice(); n.a.pw[9] = 1; U.ujiDanPerbaiki(); out.baring = n.uji === undefined; n.a.pw = pw;
      // memori grafis baru dipulihkan: uji gambar ditunda (tekstur belum terunggah ulang)
      GPU.t = performance.now(); n.uji = undefined; U.ujiDanPerbaiki(); out.pulih = n.uji === undefined; GPU.t = -1e9;
      U.ujiDanPerbaiki(); out.tegak = !!n.uji && n.uji.A > 50;
      // ganti warna berkali-kali: set tekstur lama dibuang (yang dipakai + 2 terakhir)
      const o = L().objects.find(x => x.id === 'nF');
      for (const w of ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff']) { o.params.warna = { atas: w }; rebuildScene(); for (let i = 0; i < 40 && U.NPC.get('nF').kunciMat.indexOf(w) < 0; i++) await new Promise(ok => setTimeout(ok, 50)); }
      out.simpan2 = U.simpan();
      // memori grafis habis: kualitas render turun satu tingkat tiap kali, diingat di perangkat ini; tidak turun di bawah Cepat
      setRenderQuality('tinggi'); out.rq = [turunkanKualitas(), RQ_KINI, turunkanKualitas(), RQ_KINI, turunkanKualitas(), RQ_KINI, localStorage.getItem('rqPerangkat'), kualitasAwal()];
      localStorage.removeItem('rqPerangkat'); setRenderQuality('halus');
      localStorage.removeItem('npcPerbaiki');
      return out; });
    assert.deepEqual([r.simpan, r.perbaikan, r.fvt], [{ kul: 1, v: 3 }, { kul: 1, v: 3 }, true]);
    assert.deepEqual([r.renang, r.baring, r.pulih, r.tegak], [true, true, true, true], JSON.stringify(r));
    assert.ok(r.simpan2 <= 3, 'tekstur warna lama dibuang: ' + r.simpan2);
    assert.deepEqual(r.rq, [true, 'halus', true, 'cepat', false, 'cepat', 'cepat', 'cepat']);
  },

  'iPad / iPhone: rasio piksel ≤ 1,5×, MSAA adegan 2×, peta bayangan ≤ 1024 (memori grafis terbatas)': Object.assign(async (page) => {
    const r = await page.evaluate(async () => { enterFPS(); for (let i = 0; i < 20; i++) await new Promise(ok => requestAnimationFrame(ok));
      const out = { hemat: perangkatHemat(), pr: RES.dasar, bayang: sun.shadow.mapSize.x, efekHalus: fxAktif(), bufHalus: FX.pipa ? FX.pipa.rtAdegan.width : 2 };
      // efek real-time (AO, bloom, HDR) hanya di kualitas Tinggi (JEV-124)
      setRenderQuality('tinggi'); out.prTinggi = RES.dasar; for (let i = 0; i < 5; i++) await new Promise(ok => requestAnimationFrame(ok));
      out.msaa = FX.pipa ? FX.pipa.rtAdegan.samples : null; out.bufTinggi = FX.pipa ? FX.pipa.rtAdegan.width > 2 : false;
      setRenderQuality('halus'); out.bufKembali = FX.pipa.rtAdegan.width; out.centang = [$('#fxOn').checked, $('#fxOn').disabled]; exitFPS(); return out; });
    assert.deepEqual(r, { hemat: true, pr: 1.5, bayang: 1024, efekHalus: false, bufHalus: 2, msaa: 2, prTinggi: 2, bufTinggi: true, bufKembali: 2, centang: [true, true] });
  }, { opsi: { ua: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/155.0 Mobile/15E148 Safari/604.1', konteks: { deviceScaleFactor: 2 } } }),

  'suara NPC: gumaman sepanjang teks (mati = diam), huft saat kesal, sorakan; tombol suara gumam → dibacakan → mati': async (page) => {
    await muatProyekJSON(page, rumah);
    await siap(page);
    const r = await page.evaluate(async () => {
      // hitung simpul audio yang dibuat (tanpa mendengarkan)
      const H = { osc: 0, buf: 0 }, P = (window.AudioContext || window.webkitAudioContext).prototype, o1 = P.createOscillator, o2 = P.createBufferSource;
      P.createOscillator = function () { H.osc++; return o1.call(this); }; P.createBufferSource = function () { H.buf++; return o2.call(this); };
      enterFPS(); camera.position.set(3, 1.6, 4.5); for (let i = 0; i < 3; i++) window.NPC.langkah(0.05);
      const S = window.NPC.suara, out = {}; S.mode('gumam');
      out.pendek = +S.gumam('nF', 'Halo!', 'salam').toFixed(2); out.oscPendek = H.osc;
      out.panjang = +S.gumam('nF', 'Hari ini cuacanya cerah sekali, ya. Kamu mau jalan-jalan ke taman?', 'tanya').toFixed(2);
      H.osc = H.buf = 0; S.huft('nF'); out.huft = { ...H }; H.osc = H.buf = 0; S.sorak('nF'); out.sorak = { ...H };
      S.mode('mati'); H.osc = H.buf = 0; out.mati = S.gumam('nF', 'Halo!', 'salam'); S.huft('nF'); S.sorak('nF'); out.matiNode = H.osc + H.buf; S.mode('gumam');
      camera.position.set(3, 1.6, 40); out.jauh = S.gumam('nF', 'Halo!', 'salam');                  // terlalu jauh: tidak terdengar
      // obrolan: tombol suara berputar & tersimpan; ucapan kesal memicu huft
      await muatModul('kartunpc'); await muatModul('dialog'); window.DIALOG._ai(false); camera.position.set(3, 1.6, 4.5);
      window.DIALOG.buka('nF'); const b = document.querySelector('#npcObrol .no-suara'); out.mode = [b.dataset.mode];
      b.click(); out.mode.push(b.dataset.mode, localStorage.getItem('npcSuara')); b.click(); out.mode.push(b.dataset.mode, localStorage.getItem('npcSuara')); b.click(); out.mode.push(b.dataset.mode);
      H.osc = H.buf = 0; window.DIALOG._dalam.ucap('Hmm. Itu kurang sopan.', 'hina'); out.ucapHina = { ...H };
      P.createOscillator = o1; P.createBufferSource = o2; exitFPS();
      return out; });
    assert.ok(r.pendek > 0.1 && r.panjang > r.pendek * 3 && r.oscPendek >= 2, 'gumaman mengikuti panjang teks: ' + JSON.stringify(r));
    assert.ok(r.huft.buf >= 2 && r.huft.osc >= 1, 'huft: desah derau + "hu": ' + JSON.stringify(r.huft));
    assert.ok(r.sorak.osc >= 2 && r.sorak.buf >= 3, 'sorakan "ye-aay" + tepuk tangan: ' + JSON.stringify(r.sorak));
    assert.deepEqual([r.mati, r.matiNode, r.jauh], [0, 0, 0]);
    assert.deepEqual(r.mode, ['gumam', 'tts', '1', 'mati', 'mati', 'gumam']);
    assert.ok(r.ucapHina.buf >= 2 && r.ucapHina.osc >= 3, 'ucapan kesal: gumaman + huft: ' + JSON.stringify(r.ucapHina));
  }
};
