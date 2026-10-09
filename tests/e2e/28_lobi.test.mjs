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
  const buka = async u => {
    const h = await bukaApp(browser, u, { viewport: { width: 720, height: 480 }, waktuBuka: 120000, rute: p => p.addInitScript(o => { window.__peerOpsi = o; }, opsi) });
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
  await page.waitForFunction(() => /&r=p23d-[a-z0-9]{12}$/.test(document.querySelector('#lobiUrl').value), undefined, { timeout: 75000 });
  return page.evaluate(() => document.querySelector('#lobiUrl').value);
}
async function masuk(page, nama) {
  await page.waitForSelector('#lobiMasuk input', { timeout: 60000 });
  await page.fill('#lobiMasuk input', nama);
  await page.evaluate(() => [...document.querySelectorAll('#lobiMasuk button')].find(b => b.textContent === 'Masuk').click());
}
const peserta = page => page.evaluate(() => window.LOBI ? [...LOBI.peserta.values()].map(p => p.nama).sort() : []);

export const tes = {
  'lobi bangun bareng: tamu masuk dengan nama, avatar ikut berjalan, obrolan aman, edit dua arah, host menutup ruang': async () => {
    const L = await lingkungan();
    try {
      const H = await L.buka(L.url); await rumah(H);
      const undangan = await bukaRuang(H, 'Budi', 'edit', 3);
      assert.match(undangan, /#lihat=.+&r=p23d-/, 'undangan = tautan lihat + kode ruang');
      const G = await L.buka(undangan);
      await masuk(G, 'Sari');
      await G.waitForFunction(() => window.LOBI && LOBI.aktif && LOBI.peserta.size === 2, undefined, { timeout: 75000 });
      await H.waitForFunction(() => LOBI.peserta.size === 2, undefined, { timeout: 25000 });
      assert.deepEqual(await peserta(H), ['Budi', 'Sari']); assert.deepEqual(await peserta(G), ['Budi', 'Sari']);
      assert.match(await H.textContent('#lobiDaftar'), /Budi \(host\)Sari/);
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
      await G.locator('#lobiObrolan form input').pressSequentially('wasd');
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

      // host menutup ruang → tamu diberi tahu, avatar & obrolan hilang
      await H.evaluate(() => document.querySelector('#lobiTutup').click());
      await G.waitForFunction(() => !LOBI.aktif && !document.querySelector('#lobiObrolan'), undefined, { timeout: 25000 });
      assert.equal(await H.evaluate(() => [LOBI.aktif, document.querySelector('#lobiSiap').hidden, document.querySelector('#lobiAktif').hidden].join()), 'false,false,true');
    } finally { await L.tutup(); }
  },
  'lobi lihat saja: perubahan tamu ditolak, ruang penuh menolak orang ke-3': async () => {
    const L = await lingkungan();
    try {
      const H = await L.buka(L.url); await rumah(H);
      const undangan = await bukaRuang(H, 'Budi', 'lihat', 2);
      const A = await L.buka(undangan); await masuk(A, 'Ani');
      await A.waitForFunction(() => window.LOBI && LOBI.aktif, undefined, { timeout: 75000 });
      assert.deepEqual(await A.evaluate(() => [LIHAT.on, LOBI.mode]), [true, 'lihat'], 'tamu tetap lihat-saja');
      // tamu nakal mengirim rumah langsung lewat kanal → host menolak
      await A.evaluate(() => LOBI.host.send({ t: 'proyek', s: JSON.stringify({ levels: [{ name: 'X', walls: [], objects: [] }] }) }));
      await H.waitForTimeout(3000);
      assert.equal(await H.evaluate(() => PROJECT.levels[0].walls.length), 4, 'rumah host tidak berubah');
      // pesan aneh / raksasa tidak membuat host galat
      await A.evaluate(() => { LOBI.host.send({ t: 'chat', teks: 'x'.repeat(5000) }); LOBI.host.send({ t: 'pos', jalan: 1, x: 'NaN', y: 1e9, z: {}, yaw: null }); LOBI.host.send(42); });
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
  'api/ice: TURN hanya dari env, alamat disaring; tanpa env 501': async () => {
    const api = require('../../api/ice.js');
    assert.equal(api.iceDariEnv({}), null);
    assert.deepEqual(api.iceDariEnv({ TURN_URLS: 'turn:turn.contoh.id:3478, javascript:alert(1), turns:turn.contoh.id:5349?transport=tcp,https://x.example', TURN_USERNAME: 'u', TURN_CREDENTIAL: 'k' }),
      [{ urls: 'turn:turn.contoh.id:3478', username: 'u', credential: 'k' }, { urls: 'turns:turn.contoh.id:5349?transport=tcp', username: 'u', credential: 'k' }]);
    const jalankan = (method) => new Promise(ok => { const res = { h: {}, setHeader(k, v) { this.h[k] = v; }, end(b) { ok({ status: this.statusCode, b: JSON.parse(b), h: this.h }); } }; api({ method }, res); });
    const lama = process.env.TURN_URLS; delete process.env.TURN_URLS;
    try {
      assert.equal((await jalankan('GET')).status, 501);
      assert.equal((await jalankan('POST')).status, 405);
      process.env.TURN_URLS = 'turn:turn.contoh.id:3478';
      const r = await jalankan('GET'); assert.equal(r.status, 200); assert.equal(r.h['cache-control'], 'no-store');
      assert.deepEqual(r.b, { iceServers: [{ urls: 'turn:turn.contoh.id:3478' }] });
    } finally { if (lama === undefined) delete process.env.TURN_URLS; else process.env.TURN_URLS = lama; }
  },
};
