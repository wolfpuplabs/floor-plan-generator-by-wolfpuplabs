import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { muatProyekJSON } from './harness.mjs';
const require = createRequire(import.meta.url);

// JEV-111: date sim — obrolan pilihan A–D (gagasan open-ai-npc, MIT), suasana hati, kencan + cutscene, nyatakan perasaan / pacaran
const npc = (id, x, z, kartu) => ({ id, kind: 'npc', type: 'F', x, y: 0, z, rotY: Math.PI, sx: 1, sy: 1, sz: 1, params: { benih: 7, jelajah: 0, kartu } });
const rumah = { v: 1, levels: [{ name: 'L1', height: 3, walls: [[0, 0, 10, 0], [10, 0, 10, 8], [10, 8, 0, 8], [0, 8, 0, 0]].map(([x1, z1, x2, z2], i) => ({ id: 'w' + i, x1, z1, x2, z2, thickness: 0.15, openings: [] })),
  objects: [npc('nA', 4, 3, 'tukang'), npc('nK', 8, 3, 'anak')] }] };

export const tes = {
  'api/npc mode pilihan: suasana disaring 0–3, prompt meminta 4 pilihan ramah semua umur (anak tanpa romansa); pilihan AI dibaca & disaring': async () => {
    const api = require('../../api/npc.js');
    const q = api.permintaanAman({ kartu: 'tukang', pesan: 'hai', pilihan: true, suasana: { senang: 9, nyaman: 2, tertarik: -4, kesal: 'x' } });
    assert.deepEqual([q.pilihan, q.suasana], [true, { senang: 3, nyaman: 2, tertarik: 0, kesal: 0 }]);
    const p = api.promptSistem(q), pa = api.promptSistem(api.permintaanAman({ kartu: 'anak', pesan: 'hai', pilihan: true }));
    assert.match(p, /exactly 4 short things/); assert.match(p, /no sexual content/); assert.match(pa, /NO romance or flirting/);
    assert.doesNotMatch(api.promptSistem(api.permintaanAman({ kartu: 'tukang', pesan: 'hai' })), /options/);
    const ok = api.bacaPilihan({ options: [{ text: 'Halo!', effect: 'happy+1' }, { text: 'Membosankan.', effect: 'annoyed+1' }, { text: 'Senyummu manis.', effect: 'attracted+1' }, { text: 'Dah!', effect: 'happy+1' }] }, false);
    assert.deepEqual(ok, [{ t: 'Halo!', efek: { senang: 1 } }, { t: 'Membosankan.', efek: { kesal: 1 } }, { t: 'Senyummu manis.', efek: { tertarik: 1 } }, { t: 'Dah!', efek: {}, akhir: true }]);
    assert.deepEqual(api.bacaPilihan({ options: [{ text: 'a', effect: 'attracted+1' }, { text: 'b', effect: 'x' }, { text: 'c', effect: 'happy-1' }, { text: 'd' }] }, true).map(o => o.efek), [{}, {}, { senang: -1 }, {}]);
    assert.throws(() => api.bacaPilihan({ options: [{ text: 'a' }, { text: 'sex' }, { text: 'c' }, { text: 'd' }] }, false));
    assert.throws(() => api.bacaPilihan({ options: [{ text: 'a' }] }, false));
    // Groq dipalsukan: balasan + 4 pilihan
    const palsu = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ reply: 'Halo juga!', sentiment: 0.5, options: [{ text: 'A', effect: 'happy+1' }, { text: 'B', effect: 'comfortable+1' }, { text: 'C', effect: 'annoyed+1' }, { text: 'D', effect: 'none' }] }) } }] }) });
    const r = await api.tanyaGroq(q, { GROQ_API_KEY: 'x' }, palsu);
    assert.equal(r.balas, 'Halo juga!'); assert.equal(r.pilihan.length, 4); assert.deepEqual(r.pilihan[1].efek, { nyaman: 1 });
  },

  'obrolan pilihan A–D: suasana hati tampil & berubah, relasi ikut; nyaman ≥ 2 → ajak kencan → cutscene → NPC hadir & mengingat; kesal 3 → pamit ketus': async (page) => {
    await muatProyekJSON(page, rumah);
    await page.evaluate(() => { localStorage.removeItem('npcIngat'); });
    await page.waitForFunction(() => window.NPC && ['nA', 'nK'].every(id => window.NPC.keadaan(id) && window.NPC.keadaan(id).siap), undefined, { timeout: 90000 });
    const buka = id => page.evaluate(async id => { enterFPS(); window.NPC.langkah(0.05); const s = window.NPC.keadaan(id).p; camera.position.set(s.x, 1.6, s.z + 1.2); FPS.yaw = Math.PI; FPS.pitch = -0.3;
      await muatModul('kartunpc'); await muatModul('dialog'); window.DIALOG._ai(false); window.DIALOG._kuisOtomatis = false; window.DIALOG.buka(id);
      for (let i = 0; i < 100 && !window.KENCAN; i++) await new Promise(r => setTimeout(r, 50)); window.KENCAN._uji.laju(40); return !$('#npcObrol').hidden; }, id);
    assert.equal(await buka('nA'), true);
    // mulai obrolan pilihan: 4 opsi (A–D), D = akhiri; suasana tampil
    // obrolan pilihan tampil langsung (obrolan utama) tanpa tombol; laci Sosial / Aktivitas tertutup
    const a = await page.evaluate(async () => { for (let i = 0; i < 60 && (!$('#npcObrol .no-pilih') || $('#npcObrol .no-pilih').hidden); i++) await new Promise(r => setTimeout(r, 50));
      const laci = [...document.querySelectorAll('#npcObrol .no-laci')].map(x => x.hidden), ketik = $('#npcObrol .no-form').hidden;
      $('#npcObrol [data-tab="sosial"]').click(); const sosial = [!$('#npcObrol .no-laci').hidden, document.querySelectorAll('#npcObrol .no-laci')[1].hidden]; $('#npcObrol [data-tab="sosial"]').click();
      return { laci, ketik, sosial, opsi: [...document.querySelectorAll('#npcObrol .no-pilih button')].map(b => [b.textContent.slice(0, 2), b.dataset.efek]), mood: $('#npcObrol .no-mood').textContent }; });
    assert.deepEqual([a.laci, a.ketik, a.sosial], [[true, true], true, [true, true]]);
    assert.deepEqual(a.opsi.map(x => x[0]), ['A.', 'B.', 'C.', 'D.']); assert.equal(a.opsi[3][1], 'akhir');
    assert.match(a.mood, /Senang|Happy/); assert.match(a.mood, /Kesal|Annoyed/);
    // pilih ucapan yang menambah "nyaman" sampai 2 → relasi naik; pilihan "Mau kencan sama aku?" muncul (relasi ≥ 20)
    const b = await page.evaluate(async () => { const D = window.DIALOG, m = D._dalam.ingatan('nA'); m.s = 25; m.hg = 0; const s0 = m.s; let naik = 0, kencan = null;
      for (let r = 0; r < 8 && !kencan; r++) {
        const bs = [...document.querySelectorAll('#npcObrol .no-pilih button')], ny = bs.find(x => /nyaman\+/.test(x.dataset.efek)) || bs.find(x => /senang\+/.test(x.dataset.efek));
        kencan = bs.find(x => x.dataset.efek === 'kencan'); if (kencan) break;
        ny.click(); for (let i = 0; i < 60 && $('#npcObrol .no-pilih').hidden; i++) await new Promise(r => setTimeout(r, 50)); }
      naik = m.s - s0; return { kencan: !!kencan, nyaman: m.mood.nyaman, naik, teks: kencan && kencan.textContent }; });
    assert.ok(b.kencan && b.nyaman >= 2 && b.naik > 0, 'ajak kencan muncul: ' + JSON.stringify(b));
    // ajak kencan → 4 jenis + batal (⭐ favorit tukang = BBQ) → BBQ → cutscene layar gelap → NPC hadir, kenangan, relasi naik
    const c = await page.evaluate(async () => { const m = window.DIALOG._dalam.ingatan('nA'), s0 = m.s;
      [...document.querySelectorAll('#npcObrol .no-pilih button')].find(x => x.dataset.efek === 'kencan').click();
      const jenis = [...document.querySelectorAll('#npcObrol .no-pilih button')].map(x => x.textContent);
      [...document.querySelectorAll('#npcObrol .no-pilih button')].find(x => /BBQ/.test(x.textContent)).click();
      let layar = false; for (let i = 0; i < 100 && !layar; i++) { layar = !!document.getElementById('kencanLayar'); await new Promise(r => setTimeout(r, 20)); }
      const teks = []; for (let i = 0; i < 200 && document.getElementById('kencanLayar'); i++) { const p = $('#kencanLayar p'); if (p && p.textContent && teks.at(-1) !== p.textContent) teks.push(p.textContent); await new Promise(r => setTimeout(r, 10)); }
      for (let i = 0; i < 60 && !window.DIALOG.terbuka(); i++) await new Promise(r => setTimeout(r, 50)); await new Promise(r => setTimeout(r, 800));
      const st = window.NPC.keadaan('nA'), jarak = Math.hypot(st.p.x - camera.position.x, st.p.z - camera.position.z);
      return { jenis, layar, teks, naik: m.s - s0, kh: m.kh, kencan: m.kencan.length, jarak: +jarak.toFixed(2), suasana: MOOD, log: [...document.querySelectorAll('#npcObrol .no-m')].map(x => x.textContent).slice(-2), lagi: null }; });
    assert.equal(c.jenis.length, 5); assert.ok(c.jenis.some(t => /BBQ.*⭐/.test(t)), 'favorit ditandai: ' + c.jenis);
    assert.ok(c.layar && c.teks.some(t => /BBQ|arang|charcoal/i.test(t)) && c.teks.some(t => /favorit|favourite/i.test(t)) && /Malam pun tiba|Night fell/.test(c.teks.at(-1)), 'cutscene: ' + JSON.stringify(c.teks));
    assert.ok(c.naik >= 10 && c.kencan === 1 && c.jarak < 1.6 && c.suasana === 'malam', 'sesudah kencan: ' + JSON.stringify(c));
    assert.ok(c.log.some(t => /BBQ/.test(t)), 'NPC mengingat kencan: ' + c.log);
    // kencan sekali sehari
    const d = await page.evaluate(async () => { window.KENCAN.ajak(); return [...document.querySelectorAll('#npcObrol .no-m')].at(-1).textContent; });
    assert.match(d, /sudah kencan hari ini|already went on a date/);
    // kesal 3 → pamit ketus, relasi −6, panel tertutup
    const e = await page.evaluate(async () => { const m = window.DIALOG._dalam.ingatan('nA'); m.mood.kesal = 2; const s0 = m.s;
      window.KENCAN.pilihan(); for (let i = 0; i < 60 && $('#npcObrol .no-pilih').hidden; i++) await new Promise(r => setTimeout(r, 50));
      [...document.querySelectorAll('#npcObrol .no-pilih button')].find(x => /kesal\+/.test(x.dataset.efek)).click();
      const t = [...document.querySelectorAll('#npcObrol .no-m')].at(-1).textContent; await new Promise(r => setTimeout(r, 1700));
      return { t, turun: m.s - s0, tutup: !window.DIALOG.terbuka(), kesal: m.mood.kesal }; });
    assert.match(e.t, /tidak mau ngobrol|don't want to talk/); assert.ok(e.turun <= -9 && e.tutup && e.kesal === 1, JSON.stringify(e));
  },

  'nyatakan perasaan: NPC (tertarik 3, relasi ≥ 80) → terima = 💞 Pacaran; pemain terlalu dini ditolak; kartu anak tanpa romansa & kencan': async (page) => {
    await muatProyekJSON(page, rumah);
    await page.evaluate(() => { localStorage.removeItem('npcIngat'); });
    await page.waitForFunction(() => window.NPC && ['nA', 'nK'].every(id => window.NPC.keadaan(id) && window.NPC.keadaan(id).siap), undefined, { timeout: 90000 });
    const r = await page.evaluate(async () => {
      await muatModul('kartunpc'); await muatModul('dialog'); await muatModul('kencan'); window.DIALOG._ai(false); window.DIALOG._kuisOtomatis = false;
      const tunggu = async f => { for (let i = 0; i < 80 && !f(); i++) await new Promise(r => setTimeout(r, 50)); };
      const opsi = () => [...document.querySelectorAll('#npcObrol .no-pilih button')], akhir = () => [...document.querySelectorAll('#npcObrol .no-m')].at(-1).textContent;
      enterFPS(); window.NPC.langkah(0.05); const s = window.NPC.keadaan('nA').p; camera.position.set(s.x, 1.6, s.z + 1.2); FPS.yaw = Math.PI;
      const D = window.DIALOG, m = D._dalam.ingatan('nA'); window.DIALOG.buka('nA'); await tunggu(() => !!$('#npcObrol .no-mood'));
      // pemain menyatakan terlalu dini (relasi 60, tertarik 2): ditolak halus, tertarik turun
      Object.assign(m, { s: 60, hg: 0 }); m.mood = { senang: 1, nyaman: 1, tertarik: 2, kesal: 0 };
      window.KENCAN.pilihan(); await tunggu(() => opsi().length); const ada = opsi().find(x => x.dataset.efek === 'nyatakan'); ada.click();
      const tolak = akhir(), tertarik = m.mood.tertarik;
      // NPC menyatakan sendiri: relasi 85, tertarik 3 → pilihan terima / tolak → terima
      Object.assign(m, { s: 85, hg: 0, nyh: null }); m.mood.tertarik = 3;
      window.KENCAN.pilihan(); await tunggu(() => opsi().some(x => x.dataset.efek === 'terima'));
      const tanya = akhir(); opsi().find(x => x.dataset.efek === 'terima').click();
      const status = m.status, tag = !$('#npcObrol .no-status').hidden, jawab = akhir();
      window.DIALOG.tutup();
      // kartu anak: tanpa "tertarik", tanpa kencan / nyatakan
      const k = D._dalam.ingatan('nK'); Object.assign(k, { s: 90, hg: 0 }); k.mood = { senang: 2, nyaman: 3, tertarik: 3, kesal: 0 };
      const sk = window.NPC.keadaan('nK').p; camera.position.set(sk.x, 1.6, sk.z + 1.2); window.DIALOG.buka('nK'); await tunggu(() => !!$('#npcObrol .no-mood'));
      const moodAnak = $('#npcObrol .no-mood').textContent;
      window.KENCAN.pilihan(); await tunggu(() => opsi().length);
      const efekAnak = opsi().map(x => x.dataset.efek); window.KENCAN.ajak(); const kencanAnak = akhir();
      return { ada: !!ada, tolak, tertarik, tanya, status, tag, jawab, moodAnak, efekAnak, kencanAnak };
    });
    assert.ok(r.ada && /belum siap|not ready/.test(r.tolak) && r.tertarik === 1, 'terlalu dini: ' + JSON.stringify(r));
    assert.match(r.tanya, /suka sama kamu|I like you/);
    assert.deepEqual([r.status, r.tag], ['pacaran', true]); assert.match(r.jawab, /pacaran|together/);
    assert.doesNotMatch(r.moodAnak, /Tertarik|Attracted/);
    assert.ok(!r.efekAnak.some(e => /tertarik|kencan|nyatakan/.test(e)), 'anak tanpa romansa: ' + r.efekAnak);
    assert.match(r.kencanAnak, /main sama teman|play with my friends/);
  },
  'hari dalam game: malam → siang = hari baru (jatah relasi +30 pulih, toast Hari ke-n); senja → siang tanpa malam tidak; tersimpan': async (page) => {
    await muatProyekJSON(page, rumah);
    const r = await page.evaluate(async () => {
      await muatModul('kartunpc'); await muatModul('dialog'); window.DIALOG._ai(false);
      const D = window.DIALOG._dalam, m = D.ingatan('nA'), n0 = HARI_GAME.n;
      setSuasana('siang'); m.h = D.hariIni(); m.hg = 30; const habis = D.ubahSkor(m, 5);
      setSuasana('senja'); setSuasana('siang'); const tanpaMalam = HARI_GAME.n - n0;
      setSuasana('malam'); setSuasana('malam'); const masihSama = HARI_GAME.n - n0;
      setSuasana('siang'); const naik = HARI_GAME.n - n0, pulih = D.ubahSkor(m, 5);
      return { habis, tanpaMalam, masihSama, naik, pulih, hari: D.hariIni(), simpan: localStorage.getItem('hariGame') };
    });
    assert.deepEqual([r.habis, r.tanpaMalam, r.masihSama, r.naik, r.pulih], [0, 0, 0, 1, 5], JSON.stringify(r));
    assert.match(r.hari, /^H\d+$/); assert.equal(r.simpan, r.hari.slice(1));
  },
};
