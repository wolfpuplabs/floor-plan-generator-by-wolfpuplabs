import assert from 'node:assert/strict';
import { muatProyekJSON } from './harness.mjs';

// JEV-102: karakter bawaan F & M (avatar/*.vrm, tidak diubah) · JEV-103: pose & gaya avatar (duduk kursi/lantai,
// joget, ngantuk, lambai, varian diam otomatis) + menu Gaya & duduk di lantai di mode jalan
const rumah = { v: 1, levels: [{ name: 'L1', height: 3, walls: [[0, 0, 6, 0], [6, 0, 6, 5], [6, 5, 0, 5], [0, 5, 0, 0]].map(([x1, z1, x2, z2], i) => ({ id: 'w' + i, x1, z1, x2, z2, thickness: 0.15, openings: [] })), objects: [] }] };

export const tes = {
  'karakter bawaan: kartu F & M di panel Main bareng, pilihan diingat, VRM dimuat dari situs dengan kerangka humanoid & kedip': async (page) => {
    await muatProyekJSON(page, rumah);
    const kartu = await page.evaluate(() => [...document.querySelectorAll('#lobiSiap .lobi-kartu')].map(b => [b.textContent.trim(), b.querySelector('img') && b.querySelector('img').getAttribute('src')]));
    assert.deepEqual(kartu, [['Karakter F', 'avatar/F.webp'], ['Karakter M', 'avatar/M.webp'], ['🎲Acak', null]]);
    await page.evaluate(() => document.querySelectorAll('#lobiSiap .lobi-kartu')[1].click());
    const r = await page.evaluate(() => ({ d: AVATAR_LOBI.d, simpan: JSON.parse(localStorage.getItem('lobiAvatar3D')), tekan: [...document.querySelectorAll('#lobiSiap .lobi-kartu')].map(b => b.getAttribute('aria-pressed')) }));
    assert.deepEqual([r.d.nama, r.d.bawaan, r.simpan.bawaan, r.simpan.benih, r.tekan], ['Karakter M', 'M', 'M', r.d.benih, ['false', 'true', null]]);
    assert.ok(Number.isInteger(r.d.benih) && r.d.benih >= 0 && r.d.benih <= 0xffffffff, 'benih warna acak: ' + r.d.benih);
    // warna acak seperti NPC (JEV-112): 5 contoh warna; Ganti warna = benih baru; Acak = F/M acak + benih baru
    const w = await page.evaluate(async () => { for (let i = 0; i < 100 && document.querySelectorAll('#lobiSiap .lobi-av-contoh i').length < 5; i++) await new Promise(r => setTimeout(r, 50));
      const contoh = document.querySelectorAll('#lobiSiap .lobi-av-contoh i').length, b0 = AVATAR_LOBI.d.benih;
      [...document.querySelectorAll('#lobiSiap .lobi-av-warna button')][0].click(); const b1 = AVATAR_LOBI.d.benih;
      document.querySelector('#lobiSiap [data-av="acak"]').click(); const acak = AVATAR_LOBI.d;
      const L = window.LOBI; await muatModul('lobi');
      return { contoh, ganti: b1 !== b0 && AVATAR_LOBI.d.bawaan !== undefined, acak: /^(F|M)$/.test(acak.bawaan) && acak.benih !== b1,
        aman: [window.LOBI.avAman({ bawaan: 'F', benih: 5 }), window.LOBI.avAman({ bawaan: 'M', benih: -1 }), window.LOBI.avAman({ bawaan: 'F', benih: 2 ** 33 }), window.LOBI.avAman({ bawaan: 'X', benih: 1 })], ada: !!L }; });
    assert.deepEqual([w.contoh, w.ganti, w.acak], [5, true, true], JSON.stringify(w));
    assert.deepEqual(w.aman, [{ bawaan: 'F', benih: 5 }, { bawaan: 'M' }, { bawaan: 'F' }, null]);
    // klon karakter diwarnai dari benih (sama di semua peserta): tekstur kanvas hasil pewarnaan, benih sama = warna sama
    const p = await page.evaluate(async () => { await muatModul('npc'); const tpl = await window.LOBI.muatAvatar3D({ bawaan: 'M' });
      const warnai = b => { const m = klonModel(tpl); window.NPC.warnaiAvatar(m, tpl, 'M', b); const t = []; m.traverse(x => { if (x.isMesh && x.material.map) t.push(x.material.map); }); return t; };
      const petaTpl = () => { const t = []; tpl.traverse(x => { if (x.isMesh) t.push(x.material.map); }); return t; }, asli = petaTpl();
      const a = warnai(77), b = warnai(77), c = warnai(78), sesudah = petaTpl();
      return { kanvas: a.length > 0 && a.every(t => t.isCanvasTexture), sama: a.every((t, i) => t === b[i]), beda: a.some((t, i) => t !== c[i]), asliUtuh: asli.every((t, i) => t === sesudah[i]) && a.every(t => !asli.includes(t)) }; });
    assert.deepEqual(p, { kanvas: true, sama: true, beda: true, asliUtuh: true });
    await page.evaluate(() => { if (!AVATAR_LOBI.d || AVATAR_LOBI.d.bawaan !== 'M') document.querySelectorAll('#lobiSiap .lobi-kartu')[1].click(); });   // Acak bisa memilih F: pilih M dulu
    // ketuk lagi = batal pilih
    await page.evaluate(() => document.querySelectorAll('#lobiSiap .lobi-kartu')[1].click());
    assert.equal(await page.evaluate(() => AVATAR_LOBI.d), null);
    // muat karakter F: dari avatar/F.vrm (situs sendiri), kerangka VRM 1.0 terpetakan, kedip dari ekspresi blink
    const m = await page.evaluate(async () => {
      await muatModul('lobi'); const diambil = []; const f = window.fetch; window.fetch = (u, o) => { diambil.push(String(u)); return f(u, o); };
      const tpl = await window.LOBI.muatAvatar3D({ bawaan: 'F' }); window.fetch = f;
      const b = new THREE.Box3().setFromObject(tpl).getSize(new THREE.Vector3());
      return { diambil, rig: Object.keys(tpl.userData.rigIdx).length, kedip: tpl.userData.kedipIdx.length, tinggi: +b.y.toFixed(2) };
    });
    assert.ok(m.diambil.some(u => /avatar\/F\.vrm$/.test(u)), 'diambil dari situs: ' + m.diambil);
    assert.equal(m.rig, 15, 'semua tulang animasi terpetakan');
    assert.ok(m.kedip >= 1, 'kedip VRM');
    assert.ok(Math.abs(m.tinggi - 1.7) < 0.05, 'tinggi disamakan 1,7 m: ' + m.tinggi);
    // data peserta: hanya kode bawaan yang dikirim, kode lain ditolak
    assert.deepEqual(await page.evaluate(() => [window.LOBI.gerak.posAman({ jalan: 1, x: 1, y: 0, z: 2, yaw: 0, po: 2, ad: 'aRumah' }), window.LOBI.gerak.posAman({ jalan: 1, x: 0, y: 0, z: 0, yaw: 0, po: 19, ad: '<x>' })]),
      [{ x: 1, y: 0, z: 2, yaw: 0, po: 2, ad: 'aRumah' }, { x: 0, y: 0, z: 0, yaw: 0 }]);
  },

  'pose avatar: duduk di kursi & duduk di lantai (lutut ditekuk) menurunkan badan & menekuk kaki; joget memantul; lama diam → mengantuk; musik → joget pelan': async (page) => {
    await muatProyekJSON(page, rumah);
    const r = await page.evaluate(async () => {
      await muatModul('lobi'); const G = window.LOBI.gerak, tpl = await window.LOBI.muatAvatar3D({ bawaan: 'M' });
      const buat = () => { const a = { g: new THREE.Group() }, m = klonModel(tpl); m.userData.rigIdx = tpl.userData.rigIdx; m.userData.kedipIdx = tpl.userData.kedipIdx; m.userData.klip = [];
        a.g.add(m); scene.add(a.g); G.siapkanGerak(a, m); return a; };
      const jalankan = (a, po, detik, laju = 0) => { a.tuju = { po }; for (let i = 0; i < detik * 20; i++) G.gerakAvatar(a, 0.05, laju); };
      const sudut = (a, k) => 2 * Math.acos(Math.min(1, Math.abs(a.rig[k].b.quaternion.dot(a.rig[k].rest))));
      const hasil = {};
      for (const [nama, po] of [['berdiri', 0], ['kursi', 1], ['lantai', 2]]) { const a = buat(); jalankan(a, po, 3); hasil[nama] = { turun: +(a.dasarY - a.model.position.y).toFixed(2), paha: +sudut(a, 'leftUpperLeg').toFixed(2), lutut: +sudut(a, 'leftLowerLeg').toFixed(2) }; scene.remove(a.g); }
      // joget: tinggi badan berubah-ubah
      { const a = buat(); jalankan(a, 3, 2); const y = []; for (let i = 0; i < 20; i++) { G.gerakAvatar(a, 0.05, 0); y.push(a.model.position.y); } hasil.joget = +(Math.max(...y) - Math.min(...y)).toFixed(3); scene.remove(a.g); }
      // diam lama tanpa pose → bobot mengantuk naik; kepala tertunduk
      { const a = buat(); jalankan(a, 0, 50); hasil.ngantuk = +a.pw[4].toFixed(2); scene.remove(a.g); }
      // musik diputar → joget pelan setelah diam beberapa detik
      { const a = buat(); const asli = window.bgmMain; window.bgmMain = () => true; jalankan(a, 0, 8); window.bgmMain = asli; hasil.musik = +a.pw[3].toFixed(2); scene.remove(a.g); }
      // berjalan → pose lepas
      { const a = buat(); jalankan(a, 2, 3); jalankan(a, 0, 3, 1.2); hasil.berjalan = +a.pw[2].toFixed(2); scene.remove(a.g); }
      return hasil;
    });
    assert.ok(r.berdiri.turun < 0.05 && r.berdiri.paha < 0.2, 'berdiri: ' + JSON.stringify(r.berdiri));
    assert.ok(Math.abs(r.kursi.turun - 0.42) < 0.05 && r.kursi.paha > 1.2 && r.kursi.lutut > 1.2, 'duduk di kursi: ' + JSON.stringify(r.kursi));
    assert.ok(Math.abs(r.lantai.turun - 0.72) < 0.05 && r.lantai.paha > 1.8 && r.lantai.lutut > 1.4, 'duduk di lantai: ' + JSON.stringify(r.lantai));
    assert.ok(r.joget > 0.01, 'joget memantul: ' + r.joget);
    assert.ok(r.ngantuk > 0.9, 'mengantuk: ' + r.ngantuk);
    assert.ok(r.musik > 0.5, 'joget pelan saat musik: ' + r.musik);
    assert.ok(r.berjalan < 0.1, 'berjalan melepas pose: ' + r.berjalan);
  },

  'menu Gaya di mode jalan: duduk di lantai menurunkan kamera & terkirim sebagai pose 2; joget terkirim lalu lepas saat berjalan': async (page) => {
    await muatProyekJSON(page, rumah);
    await page.evaluate(() => muatModul('lobi'));
    const pilih = v => page.evaluate(v => { $('#fpsDok [data-lembar="gaya"]').click(); document.querySelector('[data-gaya="' + v + '"]').click(); }, v);
    await page.evaluate(() => { enterFPS(); camera.position.set(3, FPS.feet + FPS.eye, 2.5); });
    await pilih('lantai');
    const a = await page.evaluate(() => { for (let i = 0; i < 20; i++) fpsStep(0.05); return { lantai: !!(FPS.duduk && FPS.duduk.lantai), mata: +(camera.position.y - FPS.feet).toFixed(2), pos: window.LOBI.gerak.posSaya().po, label: labelAksi({ jenis: 'berdiri' }) }; });
    assert.deepEqual([a.lantai, a.mata, a.pos], [true, 0.8, 2]);
    await page.evaluate(() => berdiri());
    await pilih('joget');
    const b = await page.evaluate(() => { const po1 = window.LOBI.gerak.posSaya().po; camera.position.x += 1; const po2 = window.LOBI.gerak.posSaya().po; return [po1, po2, $('#fpsLembar').hidden]; });
    assert.deepEqual(b, [3, undefined, true], 'joget terkirim, lepas setelah berjalan, lembar menu tertutup');
    await page.evaluate(() => exitFPS());
  },
};
