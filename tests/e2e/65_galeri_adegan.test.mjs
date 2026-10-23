import assert from 'node:assert/strict';
import http from 'node:http';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { luncurkan, bukaApp, sajikan, butuh } from './harness.mjs';

// JEV-137: GALERI ADEGAN — adegan diterbitkan ke galeri halaman awal (kartu Mulai). Kiriman siapa pun masuk antrean,
// tayang setelah pemilik situs (GALERI_KUNCI) menyetujuinya; penerbit bisa menariknya kembali dengan token di perangkatnya.
// Pengunjung mengetuk kartu → masuk adegan (mode lihat) → "Ajak teman" membuka ruang main bareng memakai tautan adegan
// yang sama (tidak diunggah ulang) → teman masuk lewat undangan.
const require = createRequire(import.meta.url);
const galeri = require('../../api/galeri.js'), tautan = require('../../api/tautan.js');
const KUNCI = 'kunci-galeri-uji-123';
const ASAL = 'https://blob.test/';

// Vercel Blob tiruan di memori (+ fetch ke URL publiknya)
function blobPalsu() {
  const toko = new Map(); let jam = 0;
  const jalur = u => String(u).replace(ASAL, '');
  const api = () => ({
    put: async (n, buf) => { if (toko.has(n)) throw new Error('BlobAlreadyExists'); toko.set(n, { buf: Buffer.from(buf), t: ++jam }); return { url: ASAL + n }; },
    head: async n => { if (!toko.has(jalur(n))) throw new Error('BlobNotFound'); return { url: ASAL + jalur(n) }; },
    list: async ({ prefix }) => ({ blobs: [...toko].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => ({ pathname: k, url: ASAL + k, uploadedAt: new Date(1e12 + v.t * 1000) })) }),
    del: async u => { toko.delete(jalur(u)); },
  });
  const asli = globalThis.fetch;
  globalThis.fetch = async (u, o) => String(u).startsWith(ASAL) ? (toko.has(jalur(u)) ? new Response(toko.get(jalur(u)).buf) : new Response('', { status: 404 })) : asli(u, o);
  return { toko, api, pulih: () => { globalThis.fetch = asli; } };
}
async function panggil(h, metode, url, badan, kepala = {}) {
  const res = { h: {}, status: 0, isi: null, setHeader(k, v) { this.h[k] = v; }, end(b) { this.isi = b; } };
  Object.defineProperty(res, 'statusCode', { set(v) { res.status = v; }, get() { return res.status; } });
  await h({ method: metode, url, headers: kepala, query: Object.fromEntries(new URL(url, 'http://x').searchParams), body: badan }, res);
  return { status: res.status, j: res.isi ? JSON.parse(res.isi) : null, h: res.h };
}
const proyek = (bagikan, name = 'Rumah') => zlib.deflateRawSync(Buffer.from(JSON.stringify({ v: 1, name, levels: [], bagikan })));

export const tes = {
  'fungsi api/galeri: antrean → disetujui pemilik → tayang; judul dari isi tautan; token penarik; 501 tanpa GALERI_KUNCI': async () => {
    const B = blobPalsu();
    try {
      const T = tautan.buatHandler(B.api, () => true), G = galeri.buatHandler(B.api, () => true, () => KUNCI);
      const id = (await panggil(T, 'POST', '/api/tautan', proyek({ judul: 'Vila <b>Pantai</b>\u0007', pesan: 'Mampir yuk', gambar: 'a'.repeat(64) }))).j.id;
      B.toko.set('gambar/' + 'a'.repeat(64) + '.jpg', { buf: Buffer.from([0xff, 0xd8, 0xff]), t: 0 });
      // tanpa kunci situs: galeri kosong & tidak menerima kiriman
      const G0 = galeri.buatHandler(B.api, () => true, () => '');
      assert.deepEqual((await panggil(G0, 'GET', '/api/galeri')).j, { item: [] });
      assert.equal((await panggil(G0, 'POST', '/api/galeri', JSON.stringify({ id }))).status, 501);
      // kiriman tamu → antrean (tidak tayang)
      const k = await panggil(G, 'POST', '/api/galeri', JSON.stringify({ id, oleh: '  Wila\n ', judul: 'diabaikan' }));
      assert.equal(k.status, 200); assert.equal(k.j.status, 'tunda'); assert.ok(k.j.hapus.length >= 20);
      assert.deepEqual((await panggil(G, 'GET', '/api/galeri')).j.item, []);
      assert.match((await panggil(G, 'GET', '/api/galeri')).h['cache-control'], /s-maxage=60/);
      assert.equal((await panggil(G, 'POST', '/api/galeri', JSON.stringify({ id }))).status, 409, 'tidak terbit dua kali');
      assert.equal((await panggil(G, 'POST', '/api/galeri', JSON.stringify({ id: 'ZZZZZZZZZZ' }))).status, 404, 'tautan harus ada');
      assert.equal((await panggil(G, 'POST', '/api/galeri', JSON.stringify({ id: '../x' }))).status, 400);
      assert.equal((await panggil(G, 'POST', '/api/galeri', '{rusak')).status, 400);
      // antrean & persetujuan hanya untuk pemilik
      assert.equal((await panggil(G, 'GET', '/api/galeri?semua=1', null, { 'x-kunci-galeri': 'salah-salah-salah' })).status, 403);
      assert.equal((await panggil(G, 'POST', '/api/galeri?setujui=1&id=' + id)).status, 403);
      const s = await panggil(G, 'GET', '/api/galeri?semua=1', null, { 'x-kunci-galeri': KUNCI });
      assert.deepEqual(s.j.tunda.map(x => [x.id, x.judul, x.pesan, x.oleh, x.gambar]), [[id, 'Vila <b>Pantai</b>', 'Mampir yuk', 'Wila', ASAL + 'gambar/' + 'a'.repeat(64) + '.jpg']]);
      assert.equal(s.j.tunda[0].hapus, undefined, 'sidik token tidak pernah keluar');
      assert.equal((await panggil(G, 'POST', '/api/galeri?setujui=1&id=' + id, null, { 'x-kunci-galeri': KUNCI })).status, 200);
      assert.deepEqual((await panggil(G, 'GET', '/api/galeri')).j.item.map(x => x.id), [id]);
      // kiriman pemilik langsung tayang, terbaru di depan
      const id2 = (await panggil(T, 'POST', '/api/tautan', proyek({}, 'Kafe'))).j.id;
      const p = await panggil(G, 'POST', '/api/galeri', JSON.stringify({ id: id2 }), { 'x-kunci-galeri': KUNCI });
      assert.equal(p.j.status, 'tayang');
      assert.deepEqual((await panggil(G, 'GET', '/api/galeri')).j.item.map(x => [x.id, x.judul]), [[id2, 'Kafe'], [id, 'Vila <b>Pantai</b>']]);
      // menarik: token salah ditolak, token benar / kunci pemilik boleh
      assert.equal((await panggil(G, 'DELETE', '/api/galeri?id=' + id, null, { 'x-hapus': 'bukan' })).status, 403);
      assert.equal((await panggil(G, 'DELETE', '/api/galeri?id=' + id, null, { 'x-hapus': k.j.hapus })).status, 200);
      assert.equal((await panggil(G, 'DELETE', '/api/galeri?id=' + id2, null, { 'x-kunci-galeri': KUNCI })).status, 200);
      assert.deepEqual((await panggil(G, 'GET', '/api/galeri')).j.item, []);
      assert.equal((await panggil(G, 'DELETE', '/api/galeri?id=' + id)).status, 404);
      assert.equal((await panggil(G, 'PUT', '/api/galeri')).status, 405);
      assert.ok(B.toko.has('tautan/' + id + '.bin'), 'tautan lihat-saja tetap berlaku setelah ditarik dari galeri');
    } finally { B.pulih(); }
  },

  'terbitkan dari tab File → pemilik menyetujui → kartu di halaman awal → masuk adegan → Ajak teman → teman masuk lewat undangan': async (page) => {
    await page.goto('about:blank');
    const B = blobPalsu();
    const express = butuh('express'), { ExpressPeerServer } = butuh('peer');
    const app = express(), srv = http.createServer(app);
    app.use('/sinyal', ExpressPeerServer(srv, { path: '/' }));
    app.use('/api/tautan', tautan.buatHandler(B.api, () => true));
    app.use('/api/galeri', galeri.buatHandler(B.api, () => true, () => KUNCI));
    app.use(sajikan);
    await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
    const port = srv.address().port, url = `http://127.0.0.1:${port}/index.html`;
    const opsi = { host: '127.0.0.1', port, path: '/sinyal', secure: false, debug: 0, config: { iceServers: [] } };
    const browser = await luncurkan(['--disable-features=WebRtcHideLocalIpsWithMdns']);
    const semua = [];
    const buka = async (u, kunci) => {
      const h = await bukaApp(browser, u, { viewport: { width: 720, height: 480 }, waktuBuka: 120000, rute: async p => {
        await p.addInitScript(o => { window.__peerOpsi = o; }, opsi);
        if (kunci) await p.addInitScript(k => { try { localStorage.setItem('pustakaKunci', JSON.stringify(k)); } catch (e) { /* abaikan */ } }, kunci);
        await p.route(ASAL + '**', r => { const n = r.request().url().replace(ASAL, ''); return B.toko.has(n) ? r.fulfill({ body: B.toko.get(n).buf, headers: { 'content-type': 'image/jpeg' } }) : r.fulfill({ status: 404 }); });
      } });
      semua.push(h); return h.page;
    };
    try {
      // penerbit: rumah contoh → judul di kolom Bagikan → Terbitkan ke galeri
      const P = await buka(url);
      await P.waitForFunction(() => !!document.getElementById('pustakaTerbit'), undefined, { timeout: 30000 });
      assert.equal(await P.evaluate(() => document.getElementById('pustakaAwal')), null, 'galeri kosong: kartu Mulai tanpa bagian galeri');
      await P.evaluate(() => { // rumah ringan (tiga halaman WebGL sekaligus di CI): empat dinding & satu sofa
      PROJECT.levels[0].walls = [[0, 0, 8, 0], [8, 0, 8, 6], [8, 6, 0, 6], [0, 6, 0, 0]].map(([a, b, c, d]) => ({ id: uid('w'), x1: a, z1: b, x2: c, z2: d, thickness: 0.15, openings: [] }));
      PROJECT.levels[0].objects = [{ id: 'sofa', kind: 'furn', type: 'sofa3', x: 4, y: 0, z: 3, rotY: 0, sx: 1, sy: 1, sz: 1, params: {} }]; rebuildScene(); pushHistory();
      document.getElementById('bagikanJudul').value = 'Rumah Pantai'; document.getElementById('pustakaOleh').value = 'Wila'; });
      await P.evaluate(() => document.getElementById('pustakaTerbit').click());
      await P.waitForFunction(() => /^Terkirim/.test(document.getElementById('pustakaInfo').textContent), undefined, { timeout: 60000 });
      const saya = await P.evaluate(() => JSON.parse(localStorage.getItem('pustakaSaya')));
      assert.equal(saya.length, 1); assert.equal(saya[0].judul, 'Rumah Pantai');
      const id = saya[0].id;
      assert.match(await P.textContent('#pustakaSaya'), /Rumah Pantai/);
      const nTautan = () => [...B.toko.keys()].filter(k => k.startsWith('tautan/')).length;
      assert.equal(nTautan(), 1);

      // pemilik situs: kunci di perangkat → antrean → Setujui
      await P.evaluate(k => { localStorage.setItem('pustakaKunci', JSON.stringify(k)); window.PUSTAKA.muatAntrean(); }, KUNCI);
      await P.waitForFunction(() => [...document.querySelectorAll('#pustakaAntrean button')].some(b => /Setujui/.test(b.textContent)), undefined, { timeout: 20000 });
      assert.match(await P.textContent('#pustakaAntrean'), /Rumah Pantai · Wila/);
      await P.evaluate(() => [...document.querySelectorAll('#pustakaAntrean button')].find(b => /Setujui/.test(b.textContent)).click());
      await P.waitForFunction(() => [...document.querySelectorAll('#pustakaAntrean button')].some(b => /Turunkan/.test(b.textContent)), undefined, { timeout: 20000 });
      await P.close();

      // pengunjung baru: halaman awal menampilkan kartu adegan → ketuk → masuk mode lihat
      const V = await buka(url);
      await V.waitForSelector('#pustakaAwal .pustaka-kartu', { timeout: 30000 });
      const k = await V.evaluate(() => { const c = document.querySelector('#pustakaAwal .pustaka-kartu'); const im = c.querySelector('img');
        return { teks: c.textContent, img: im && im.getAttribute('src'), terlihat: !document.getElementById('mulaiKartu').hidden }; });
      assert.equal(k.teks, 'Rumah PantaiWila'); assert.match(k.img, /^https:\/\/blob\.test\/gambar\/[0-9a-f]{64}\.jpg$/); assert.ok(k.terlihat);
      await Promise.all([V.waitForNavigation({ timeout: 60000 }), V.evaluate(() => document.querySelector('#pustakaAwal .pustaka-kartu').click())]);
      await V.waitForFunction(() => typeof LIHAT !== 'undefined' && LIHAT.siap, undefined, { timeout: 120000 });
      assert.equal(new URL(V.url()).hash, '#l=' + id);
      assert.deepEqual(await V.evaluate(() => [LIHAT.on, L().walls.length === 4, !document.getElementById('lihatAjak').hidden && !document.getElementById('lihatBar').hidden]), [true, true, true]);

      // Ajak teman: ruang "lihat saja" memakai tautan adegan yang sama
      await V.evaluate(() => document.getElementById('lihatAjak').click());
      await V.fill('#pustakaAjak input[aria-label="Namamu"]', 'Dina');
      await V.evaluate(() => [...document.querySelectorAll('#pustakaAjak button')].find(b => /Buat ruang/.test(b.textContent)).click());
      await V.waitForFunction(() => { const i = document.querySelector('#pustakaAjak input[readonly]'); return i && !i.hidden && i.value; }, undefined, { timeout: 150000 });
      const undangan = await V.evaluate(() => document.querySelector('#pustakaAjak input[readonly]').value);
      assert.match(undangan, new RegExp('/l/' + id + '\\?r=p23d-la-[0-9a-f]{16}$'), 'undangan memakai id adegan galeri');
      assert.equal(nTautan(), 1, 'adegan tidak diunggah ulang');
      assert.deepEqual(await V.evaluate(() => [LOBI.aktif, LOBI.mode, LOBI.peran]), [true, 'lihat', 'pusat']);

      // teman membuka undangan (/l/<id>?r=… diteruskan api/lihat ke /#l=<id>&r=…)
      const ruang = undangan.split('?r=')[1];
      const T = await buka(url + '#l=' + id + '&r=' + ruang);
      await T.waitForSelector('#lobiMasuk input', { timeout: 120000 });
      // isi langsung (tiga halaman WebGL sekaligus: pemeriksaan "stabil" Playwright bisa macet di CI)
      await T.evaluate(() => { document.querySelector('#lobiMasuk input').value = 'Rafi'; });
      await T.evaluate(() => [...document.querySelectorAll('#lobiMasuk button')].find(b => b.textContent === 'Masuk').click());
      await V.waitForFunction(() => LOBI.peserta.size === 2, undefined, { timeout: 150000 });
      assert.deepEqual(await V.evaluate(() => [...LOBI.peserta.values()].map(p => p.nama).sort()), ['Dina', 'Rafi']);
      // tombol Ajak teman saat sudah di ruang: langsung menampilkan undangan ruang ini
      await T.evaluate(() => document.getElementById('lihatAjak').click());
      assert.match(await T.evaluate(() => document.querySelector('#pustakaAjak input[readonly]').value), new RegExp(ruang + '$'));
      for (const h of semua) { assert.deepEqual(h.log.galat, [], 'galat halaman'); assert.deepEqual(h.log.csp, [], 'pelanggaran CSP/SRI'); }
    } finally { await browser.close(); srv.close(); B.pulih(); }
  },
};
