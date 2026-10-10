import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
import { luncurkan, bukaApp, sajikan, butuh } from './harness.mjs';

const require = createRequire(import.meta.url);

// JEV-077: LOBI MAIN BARENG — host membuat ruang (lihat saja / bangun bareng, maks. orang),
// tamu masuk lewat undangan dengan nama, tampil sebagai avatar, mengobrol, dan (bila boleh)
// ikut mengubah rumah. Server sinyal PeerJS lokal dipasang di origin yang sama dengan aplikasi
// (CSP connect-src 'self' tetap utuh); Chromium tanpa penyamaran mDNS agar WebRTC lokal tersambung.
async function lingkungan() {
  const express = butuh('express'), { ExpressPeerServer } = butuh('peer');
  const app = express(), srv = http.createServer(app);
  app.use('/sinyal', ExpressPeerServer(srv, { path: '/' }));
  app.use(sajikan);
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
  const port = srv.address().port, url = `http://127.0.0.1:${port}/index.html`;
  const opsi = { host: '127.0.0.1', port, path: '/sinyal', secure: false, debug: 0, config: { iceServers: [] } };
  const browser = await luncurkan(['--disable-features=WebRtcHideLocalIpsWithMdns']);
  const halaman = [];
  // simpan: [kunci, nilai] localStorage yang dipasang sebelum halaman dimuat (mis. kunci pemilik ruang)
  const buka = async (u, simpan) => {
    const h = await bukaApp(browser, u, { viewport: { width: 720, height: 480 }, waktuBuka: 120000, rute: async p => {
      await p.addInitScript(o => { window.__peerOpsi = o; }, opsi);
      if (simpan) await p.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch (e) { /* abaikan */ } }, simpan);
    } });
    halaman.push(h); return h.page;
  };
  const tutup = async () => {
    for (const h of halaman) {
      assert.deepEqual(h.log.galat, [], 'galat halaman'); assert.deepEqual(h.log.csp, [], 'pelanggaran CSP/SRI');
    }
    await browser.close(); srv.close();
  };
  return { url, buka, tutup };
}
const rumah = page => page.evaluate(() => {
  PROJECT.levels[0].walls = [[0, 0, 8, 0], [8, 0, 8, 6], [8, 6, 0, 6], [0, 6, 0, 0]].map(([a, b, c, d]) => ({ id: uid('w'), x1: a, z1: b, x2: c, z2: d, thickness: 0.15, openings: [] }));
  rebuildScene(); pushHistory();
});
async function bukaRuang(page, nama, mode, maks) {
  await page.evaluate(([n, m, k]) => {
    document.querySelector('#lobiNamaHost').value = n;
    document.querySelector(`[data-lobi-mode="${m}"]`).click();
    document.querySelector('#lobiMaks').value = String(k);
    document.querySelector('#lobiBuat').click();
  }, [nama, mode, maks]);
  await page.waitForFunction(() => /&r=p23d-[le][2-9a]-[0-9a-f]{16}$/.test(document.querySelector('#lobiUrl').value), undefined, { timeout: 75000 });
  return page.evaluate(() => document.querySelector('#lobiUrl').value);
}
async function masuk(page, nama) {
  await page.waitForSelector('#lobiMasuk input', { timeout: 60000 });
  await page.fill('#lobiMasuk input', nama);
  await page.evaluate(() => [...document.querySelectorAll('#lobiMasuk button')].find(b => b.textContent === 'Masuk').click());
}
const peserta = page => page.evaluate(() => window.LOBI ? [...LOBI.peserta.values()].map(p => p.nama).sort() : []);
const peran = page => page.evaluate(() => window.LOBI && LOBI.aktif ? LOBI.peran : null);

export const tes = {
  'lobi bangun bareng: tamu masuk dengan nama, avatar, obrolan aman, edit dua arah; pembuat keluar → ruang tetap hidup, pusat pindah': async () => {
    const L = await lingkungan();
    try {
      const H = await L.buka(L.url); await rumah(H);
      const undangan = await bukaRuang(H, 'Budi', 'edit', 3);
      assert.match(undangan, /#lihat=.+&r=p23d-e3-[0-9a-f]{16}$/, 'undangan = tautan lihat + kode ruang (aturan ikut kode)');
      assert.equal(await peran(H), 'pusat', 'pembuat yang pertama di ruang jadi pusat koneksi');
      const G = await L.buka(undangan);
      await masuk(G, 'Sari');
      await G.waitForFunction(() => window.LOBI && LOBI.aktif && LOBI.peserta.size === 2, undefined, { timeout: 75000 });
      await H.waitForFunction(() => LOBI.peserta.size === 2, undefined, { timeout: 25000 });
      assert.deepEqual(await peserta(H), ['Budi', 'Sari']); assert.deepEqual(await peserta(G), ['Budi', 'Sari']);
      assert.deepEqual(await H.evaluate(() => [...document.querySelectorAll('#lobiDaftar li')].map(li => li.textContent)), ['Budipemilikpusat koneksikamu', 'Sari']);
      assert.deepEqual(await G.evaluate(() => [LOBI.peran, LOBI.pemilik]), ['tamu', false]);
      assert.match(await H.textContent('#lobiInfo'), /Bangun bareng · 2\/3 orang/);
      // tamu "bangun bareng" keluar dari mode lihat-saja; rumah host sudah ada di tamu
      assert.deepEqual(await G.evaluate(() => [LIHAT.on, LOBI.mode, PROJECT.levels[0].walls.length]), [false, 'edit', 4]);

      // obrolan dua arah; teks peserta tidak pernah jadi HTML
      await G.fill('#lobiObrolan form input', 'halo semua'); await G.press('#lobiObrolan form input', 'Enter');
      await H.waitForFunction(() => /Sari: halo semua/.test(document.querySelector('#lobiObrolan .lb-pesan').textContent), undefined, { timeout: 25000 });
      await H.fill('#lobiObrolan form input', '<img src=x onerror="window.__xss=1">'); await H.press('#lobiObrolan form input', 'Enter');
      await G.waitForFunction(() => /Budi: <img/.test(document.querySelector('#lobiObrolan .lb-pesan').textContent), undefined, { timeout: 25000 });
      assert.deepEqual(await G.evaluate(() => [document.querySelectorAll('#lobiObrolan img').length, window.__xss || 0]), [0, 0]);

      // avatar: tamu berjalan → host melihat karakter bernama di posisi tamu
      const posG = await G.evaluate(() => { enterFPS(); camera.position.set(2.5, 1.6, 3.2); FPS.feet = 0; FPS.yaw = 1.1; return { x: camera.position.x, z: camera.position.z }; });
      // mengetik W A S D di obrolan saat berjalan tidak menggerakkan avatar
      // tombol dikirim langsung ke kolom obrolan (input sungguhan di 3 halaman berat bisa macet di CI)
      await G.evaluate(() => { const i = document.querySelector('#lobiObrolan form input'); i.focus();
        for (const key of 'wasd') i.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); });
      assert.equal(await G.evaluate(() => FPS.keys.size), 0, 'tombol obrolan tidak bocor ke kontrol jalan');
      await H.waitForFunction(() => [...LOBI.avatar.values()].some(a => a.g.visible && a.tuju), undefined, { timeout: 25000 });
      const av = await H.evaluate(() => { const a = [...LOBI.avatar.values()][0]; return { x: a.tuju.x, z: a.tuju.z, yaw: a.tuju.yaw, label: !!a.g.children.find(c => c.isSprite) }; });
      assert.ok(Math.abs(av.x - posG.x) < 0.5 && Math.abs(av.z - posG.z) < 0.5, 'avatar di posisi tamu: ' + JSON.stringify([av, posG]));
      assert.ok(av.label, 'avatar berlabel nama');
      // host juga berjalan → tamu melihat avatar host
      await H.evaluate(() => { enterFPS(); camera.position.set(5, 1.6, 2); FPS.feet = 0; });
      await G.waitForFunction(() => [...LOBI.avatar.values()].some(a => a.g.visible), undefined, { timeout: 25000 });
      await G.evaluate(() => exitFPS()); await H.evaluate(() => exitFPS());

      // bangun bareng: tamu menambah dinding → host ikut; host menghapus → tamu ikut
      await G.evaluate(() => { PROJECT.levels[0].walls.push({ id: uid('w'), x1: 4, z1: 0, x2: 4, z2: 6, thickness: 0.12, openings: [] }); rebuildScene(); pushHistory(); });
      await H.waitForFunction(() => PROJECT.levels[0].walls.length === 5, undefined, { timeout: 25000 });
      await H.waitForFunction(() => /Sari mengubah rumah/.test(document.querySelector('#lobiObrolan .lb-pesan').textContent), undefined, { timeout: 15000 });
      await H.evaluate(() => { PROJECT.levels[0].walls.splice(0, 2); rebuildScene(); pushHistory(); });
      await G.waitForFunction(() => PROJECT.levels[0].walls.length === 3, undefined, { timeout: 25000 });

      // pembuat keluar → ruang tetap hidup: tamu mengambil alih pusat koneksi
      await H.evaluate(() => document.querySelector('#lobiTutup').click());
      assert.equal(await H.evaluate(() => [LOBI.aktif, document.querySelector('#lobiSiap').hidden, document.querySelector('#lobiAktif').hidden].join()), 'false,false,true');
      await G.waitForFunction(() => LOBI.aktif && LOBI.peran === 'pusat' && LOBI.peserta.size === 1, undefined, { timeout: 75000 });
      await G.waitForFunction(() => /Kamu kini pusat koneksi/.test(document.querySelector('#lobiObrolan .lb-pesan').textContent), undefined, { timeout: 15000 });
      // undangan yang sama tetap berlaku walau pembuatnya offline: orang baru tersambung lewat pusat baru
      const C = await L.buka(undangan); await masuk(C, 'Cici');
      await C.waitForFunction(() => window.LOBI && LOBI.aktif && LOBI.peserta.size === 2, undefined, { timeout: 75000 });
      assert.deepEqual(await peserta(C), ['Cici', 'Sari']);
      assert.deepEqual(await C.evaluate(() => [LOBI.peran, PROJECT.levels[0].walls.length]), ['tamu', 3], 'orang baru menerima rumah terbaru dari pusat');
    } finally { await L.tutup(); }
  },
  'lobi lihat saja: hanya pemilik mengubah rumah, perubahan tamu ditolak, ruang penuh menolak orang ke-3': async () => {
    const L = await lingkungan();
    try {
      const H = await L.buka(L.url); await rumah(H);
      const undangan = await bukaRuang(H, 'Budi', 'lihat', 2);
      const A = await L.buka(undangan); await masuk(A, 'Ani');
      await A.waitForFunction(() => window.LOBI && LOBI.aktif, undefined, { timeout: 75000 });
      assert.deepEqual(await A.evaluate(() => [LIHAT.on, LOBI.mode]), [true, 'lihat'], 'tamu tetap lihat-saja');
      // tamu nakal mengirim rumah langsung lewat kanal → host menolak
      await A.evaluate(() => LOBI.pusat.send({ t: 'proyek', s: JSON.stringify({ levels: [{ name: 'X', walls: [], objects: [] }] }) }));
      await H.waitForTimeout(3000);
      assert.equal(await H.evaluate(() => PROJECT.levels[0].walls.length), 4, 'rumah host tidak berubah');
      // pemilik (pembuat undangan) mengubah rumah → tamu ikut
      await H.evaluate(() => { PROJECT.levels[0].walls.push({ id: uid('w'), x1: 4, z1: 0, x2: 4, z2: 6, thickness: 0.12, openings: [] }); rebuildScene(); pushHistory(); });
      await A.waitForFunction(() => PROJECT.levels[0].walls.length === 5, undefined, { timeout: 25000 });
      // pesan aneh / raksasa tidak membuat host galat
      await A.evaluate(() => { LOBI.pusat.send({ t: 'chat', teks: 'x'.repeat(5000) }); LOBI.pusat.send({ t: 'pos', jalan: 1, x: 'NaN', y: 1e9, z: {}, yaw: null }); LOBI.pusat.send(42); });
      await H.waitForFunction(() => [...document.querySelectorAll('#lobiObrolan .lb-pesan div')].some(d => /^Ani: x+$/.test(d.textContent) && d.textContent.length <= 306), undefined, { timeout: 15000 });
      // orang ke-3 pada ruang maks. 2
      const B = await L.buka(undangan); await masuk(B, 'Bayu');
      await B.waitForFunction(() => /ruang penuh \(maks\. 2 orang\)/.test(document.querySelector('#lobiMasuk').textContent), undefined, { timeout: 75000 });
      assert.deepEqual(await peserta(H), ['Ani', 'Budi']);
      // "Lihat sendiri saja" menutup kartu tanpa bergabung
      await B.evaluate(() => [...document.querySelectorAll('#lobiMasuk button')].find(b => b.textContent === 'Lihat sendiri saja').click());
      assert.equal(await B.evaluate(() => !!document.querySelector('#lobiMasuk')), false);
    } finally { await L.tutup(); }
  },
  'lobi: suasana host diikuti tamu; lampu, pintu, TV & piano terasa oleh semua (JEV-078)': async () => {
    const L = await lingkungan();
    try {
      const H = await L.buka(L.url);
      const ids = await H.evaluate(() => {
        PROJECT.levels[0].walls = [[0, 0, 8, 0], [8, 0, 8, 6], [8, 6, 0, 6], [0, 6, 0, 0]].map(([a, b, c, d]) => ({ id: uid('w'), x1: a, z1: b, x2: c, z2: d, thickness: 0.15, openings: [] }));
        const pintu = { id: uid('o'), type: 'door', at: 4, width: 0.9, sill: 0, head: 2.1 }; PROJECT.levels[0].walls[0].openings.push(pintu);
        PROJECT.levels[0].objects = [];
        const taruh = (t, x, z) => { addObject('furn', t); const o = L().objects[L().objects.length - 1]; o.x = x; o.z = z; return o.id; };
        const r = { pintu: pintu.id, lampu: taruh('wall_sconce', 2, 5.8), tv: taruh('tv_set', 6, 5.6), piano: taruh('piano', 2, 1) };
        rebuildScene(); pushHistory(); return r;
      });
      // sebelum tamu masuk: host mematikan lampu & memilih senja
      await H.evaluate(id => { setSuasana('senja'); pakai({ jenis: 'lampu', id, grp: findGroup('obj', id) }); }, ids.lampu);
      const undangan = await bukaRuang(H, 'Budi', 'lihat', 3);
      const G = await L.buka(undangan); await masuk(G, 'Sari');
      await G.waitForFunction(() => window.LOBI && LOBI.aktif, undefined, { timeout: 75000 });
      // tamu masuk ke dunia yang sama: suasana & lampu mati ikut
      assert.deepEqual(await G.evaluate(id => [MOOD, MATI.has(id)], ids.lampu), ['senja', true]);

      // tamu (mode lihat saja) menyalakan TV & membuka pintu → host ikut
      await G.evaluate(([tv, pintu]) => {
        pakai({ jenis: 'tv', id: tv, grp: findGroup('obj', tv) });
        const b = cariBukaanId(pintu); pakai({ jenis: 'bukaan', o: b.o });
      }, [ids.tv, ids.pintu]);
      const pintuG = await G.evaluate(id => keadaanSatu('bukaan', id), ids.pintu);
      await H.waitForFunction(([tv, pintu, p]) => TV_NYALA.has(tv) && keadaanSatu('bukaan', pintu) === p, [ids.tv, ids.pintu, pintuG], { timeout: 25000 });
      // host menyalakan lampu lagi → tamu ikut
      await H.evaluate(id => pakai({ jenis: 'lampu', id, grp: findGroup('obj', id) }), ids.lampu);
      await G.waitForFunction(id => !MATI.has(id), ids.lampu, { timeout: 25000 });
      // host mengganti suasana → tamu ikut
      await H.evaluate(() => setSuasana('malam'));
      await G.waitForFunction(() => MOOD === 'malam', undefined, { timeout: 25000 });
      // tamu memainkan piano → host mendengar not itu dari piano yang sama
      await G.evaluate(id => { PIANO.grp = findGroup('obj', id); bunyiPiano(64); bunyiPiano(67); }, ids.piano);
      await H.waitForFunction(id => PIANO.luar && PIANO.luar.has(id), ids.piano, { timeout: 25000 });
      assert.equal(await G.evaluate(() => !PIANO.luar), true, 'not sendiri tidak dipantulkan balik ke pemain');
      // pesan aksi/not palsu dari tamu: jenis/id/nada tak sah diabaikan, host tidak galat
      await G.evaluate(() => { LOBI.pusat.send({ t: 'aksi', j: 'hapus', id: 'x' }); LOBI.pusat.send({ t: 'aksi', j: 'lampu', id: '../../x' }); LOBI.pusat.send({ t: 'nada', m: 1e9 }); LOBI.pusat.send({ t: 'adegan', a: { mood: 'siang' } }); });
      await H.waitForTimeout(2000);
      assert.equal(await H.evaluate(() => MOOD), 'malam', 'tamu tidak bisa mengganti suasana host');
    } finally { await L.tutup(); }
  },
  'api/ice: TURN hanya dari env, alamat disaring; tanpa env daftar kosong (200)': async () => {
    const api = require('../../api/ice.js');
    assert.equal(api.iceDariEnv({}), null);
    assert.deepEqual(api.iceDariEnv({ TURN_URLS: 'turn:turn.contoh.id:3478, javascript:alert(1), turns:turn.contoh.id:5349?transport=tcp,https://x.example', TURN_USERNAME: 'u', TURN_CREDENTIAL: 'k' }),
      [{ urls: 'turn:turn.contoh.id:3478', username: 'u', credential: 'k' }, { urls: 'turns:turn.contoh.id:5349?transport=tcp', username: 'u', credential: 'k' }]);
    const jalankan = (method) => new Promise(ok => { const res = { h: {}, setHeader(k, v) { this.h[k] = v; }, end(b) { ok({ status: this.statusCode, b: JSON.parse(b), h: this.h }); } }; api({ method }, res); });
    const lama = process.env.TURN_URLS; delete process.env.TURN_URLS;
    try {
      const kosong = await jalankan('GET');             // tanpa TURN: bukan galat, daftar kosong (konsol bersih)
      assert.equal(kosong.status, 200); assert.deepEqual(kosong.b, { iceServers: [], turn: false });
      assert.equal((await jalankan('POST')).status, 405);
      process.env.TURN_URLS = 'turn:turn.contoh.id:3478';
      const r = await jalankan('GET'); assert.equal(r.status, 200); assert.equal(r.h['cache-control'], 'no-store');
      assert.deepEqual(r.b, { iceServers: [{ urls: 'turn:turn.contoh.id:3478' }], turn: true });
    } finally { if (lama === undefined) delete process.env.TURN_URLS; else process.env.TURN_URLS = lama; }
  },
  'lobi tanpa host: pembuat offline, pengunjung pertama jadi pusat; pemilik dikenali dari tanda tangan; pusat mati → penerus mengambil alih': async () => {
    const L = await lingkungan();
    try {
      const H = await L.buka(L.url); await rumah(H);
      const undangan = await bukaRuang(H, 'Budi', 'lihat', 4);
      const [ruang, kunci] = await H.evaluate(() => [LOBI.ruang, localStorage.getItem('lobiKunci:' + LOBI.ruang)]);
      assert.ok(kunci && !/"d"/.test(undangan), 'kunci rahasia pemilik tetap di peramban pemilik, tidak ada di undangan');
      await H.close();                                        // pembuat offline sebelum siapa pun datang
      // pengunjung pertama otomatis jadi pusat koneksi
      const A = await L.buka(undangan); await masuk(A, 'Ani');
      await A.waitForFunction(() => window.LOBI && LOBI.aktif && LOBI.peran === 'pusat', undefined, { timeout: 75000 });
      await A.waitForFunction(() => /Kamu orang pertama/.test(document.querySelector('#lobiObrolan .lb-pesan').textContent), undefined, { timeout: 15000 });
      assert.equal(await A.evaluate(() => LOBI.pemilik), false);
      // pemilik datang lagi (perangkat yang sama, kunci tersimpan) → pusat memeriksa tanda tangannya
      const O = await L.buka(undangan, ['lobiKunci:' + ruang, kunci]); await masuk(O, 'Budi');
      await O.waitForFunction(() => window.LOBI && LOBI.aktif && LOBI.peran === 'tamu', undefined, { timeout: 75000 });
      assert.equal(await O.evaluate(() => LOBI.pemilik), true, 'pemilik diakui pusat');
      assert.deepEqual(await A.evaluate(() => [...LOBI.peserta.values()].map(p => [p.nama, p.pemilik, p.pusat]).sort()), [['Ani', false, true], ['Budi', true, false]]);
      // ruang lihat saja: pemilik boleh mengubah rumah lewat pusat yang bukan dirinya; pusat bukan pemilik tidak menyiarkan
      await O.evaluate(() => { PROJECT.levels[0].walls.push({ id: uid('w'), x1: 4, z1: 0, x2: 4, z2: 6, thickness: 0.12, openings: [] }); rebuildScene(); pushHistory(); });
      await A.waitForFunction(() => PROJECT.levels[0].walls.length === 5, undefined, { timeout: 25000 });
      // pusat yang bukan pemilik tidak bisa mengubah rumah peserta lain
      await A.evaluate(() => { PROJECT.levels[0].walls.pop(); rebuildScene(); LOBI.proyekBerubah(); });
      await A.waitForTimeout(1500);
      assert.equal(await O.evaluate(() => PROJECT.levels[0].walls.length), 5, 'pusat bukan pemilik tidak bisa mengubah rumah di ruang lihat saja');
      // pusat mati tanpa pamit (tab ditutup) → peserta tersisa mengambil alih
      await A.close();
      await O.waitForFunction(() => LOBI.aktif && LOBI.peran === 'pusat' && LOBI.pemilik, undefined, { timeout: 90000 });
      assert.deepEqual(await peserta(O), ['Budi']);
    } finally { await L.tutup(); }
  },
};
