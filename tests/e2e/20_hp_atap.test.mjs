import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { CORS, bukaApp } from './harness.mjs';

// JEV-069: (1) tautan lihat di HP — bilah lihat, bilah lantai, petunjuk & bilah jalan tidak saling
// menumpuk; (2) status atap tertutup ikut proyek/tautan dan jalan-jalan selalu beratap;
// (3) tautan pendek yang gagal menyebut sebabnya
const require = createRequire(import.meta.url);
const api = require('../../api/tautan.js');
const kotak = (x0, z0, x1, z1) => [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]];
const rumah2 = (page, tutup) => page.evaluate(([k, tutup]) => {
  const isi = () => k.map(([a, b, c, d]) => ({ id: uid('w'), x1: a, z1: b, x2: c, z2: d, thickness: 0.15, openings: [] }));
  PROJECT.levels[0].walls = isi(); PROJECT.levels[0].objects = [];
  addLevel(); PROJECT.levels[1].walls = isi(); PROJECT.levels[1].objects = [];
  setActiveLevel(0); toggleAtap(tutup); rebuildScene();
}, [kotak(0, 0, 8, 6), tutup]);
const jumlahAtap = page => page.evaluate(() => { let n = 0; worldRoot.traverse(m => { if (m.isMesh && m.userData.atap) n++; }); return n; });
const potong = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const kotakEl = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); if (!e || e.hidden || getComputedStyle(e).display === 'none') return null;
  const r = e.getBoundingClientRect(); return r.width ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom } : null; }, sel);

export const tes = {
  'atap tertutup tersimpan di proyek & ikut tautan; jalan-jalan selalu beratap': async (page) => {
    await rumah2(page, true);
    const j = await page.evaluate(() => JSON.parse(JSON.stringify(PROJECT)));
    assert.equal(j.atap.tutup, true, 'status atap ikut berkas proyek');
    // dimuat ulang (berkas / tautan lihat memakai jalur yang sama)
    await page.evaluate(j => { toggleAtap(false); muatProyekObjek(j); }, j);
    assert.equal(await page.evaluate(() => ATAP_TUTUP), true);
    assert.ok(await jumlahAtap(page) > 0);
    // atap dibuka: editor tanpa atap, jalan-jalan tetap beratap, keluar → terbuka lagi
    await page.evaluate(() => toggleAtap(false));
    assert.equal(await jumlahAtap(page), 0);
    await page.evaluate(() => enterFPS());
    assert.ok(await jumlahAtap(page) > 0, 'mode jalan harus beratap');
    await page.evaluate(() => exitFPS());
    assert.equal(await jumlahAtap(page), 0);
    assert.equal(await page.evaluate(() => sanitasiProyek({ levels: [{}], atap: { tutup: 'ya' } }).atap.tutup), undefined, 'hanya true yang diterima');
  },
  'tautan lihat di HP: bilah lihat, lantai, petunjuk & bilah jalan tidak menumpuk': async (page) => {
    await page.route('**/api/tautan**', r => r.fulfill({ status: 501, headers: CORS, json: { galat: 'blob-belum-diatur' } }));
    await rumah2(page, true);
    const url = await page.evaluate(async () => (await buatTautanLihat()).url);
    assert.match(url, /#lihat=/);
    await page.goto('about:blank');
    const { page: b, log } = await bukaApp(page.context().browser(), url, { viewport: { width: 390, height: 664 }, bahasa: 'en' });
    try {
      await b.waitForFunction(() => LIHAT.siap, undefined, { timeout: 60000 });
      assert.equal(await b.evaluate(() => ATAP_TUTUP), true, 'penerima mendapat atap tertutup');
      // petunjuk hilang sendiri setelah 9 detik (WebGL CI lambat) — tampilkan lagi untuk diukur
      await b.evaluate(() => { document.getElementById('hint').hidden = false; }); await b.waitForTimeout(300);
      const [bar, lantai, petunjuk, tampak] = await Promise.all(['#lihatBar', '#levelbar', '#hint', '#viewbar'].map(s => kotakEl(b, s)));
      assert.ok(bar && lantai && petunjuk && tampak, JSON.stringify({ bar, lantai, petunjuk, tampak }));
      assert.ok(lantai.top >= bar.bottom, `bilah lantai (${lantai.top}) di bawah bilah lihat (${bar.bottom})`);
      assert.ok(!potong(petunjuk, tampak), 'petunjuk tidak menutupi tombol tampak: ' + JSON.stringify({ petunjuk, tampak }));
      await b.evaluate(() => enterFPS());
      const [bar2, jalan] = await Promise.all([kotakEl(b, '#lihatBar'), kotakEl(b, '#fpsbar')]);
      assert.equal(bar2, null, 'bilah lihat disembunyikan saat jalan-jalan');
      assert.ok(jalan, 'bilah jalan tampil');
      await b.evaluate(() => exitFPS());
      assert.ok(await kotakEl(b, '#lihatBar'), 'bilah lihat kembali');
      assert.deepEqual(log.galat, []);
    } finally { await b.close(); }
  },
  'tautan pendek gagal di server → keterangan menyebut kode galat': async (page) => {
    // fungsi asli: galat Blob dilaporkan dengan nama kelasnya saja
    class BlobStoreNotFoundError extends Error {}
    const h = api.buatHandler(() => ({ put: async () => { throw new BlobStoreNotFoundError('rahasia internal'); }, head: async () => null }), () => true);
    const res = { h: {}, status: 0, isi: null, setHeader(k, v) { this.h[k] = v; }, end(x) { this.isi = x; } };
    Object.defineProperty(res, 'statusCode', { set(v) { res.status = v; }, get() { return res.status; } });
    const zlib = await import('node:zlib');
    const asliErr = console.error; console.error = () => {};
    try { await h({ method: 'POST', url: '/api/tautan', query: {}, body: zlib.deflateRawSync(Buffer.from('{"v":1,"levels":[]}')) }, res); } finally { console.error = asliErr; }
    assert.equal(res.status, 500);
    assert.deepEqual(JSON.parse(res.isi), { galat: 'server', kode: 'BlobStoreNotFoundError' });
    await page.route('**/api/tautan**', r => r.fulfill({ status: 500, headers: CORS, body: res.isi, contentType: 'application/json' }));
    await rumah2(page, false);
    await page.evaluate(() => { pilihTab('file'); document.getElementById('bagikanBtn').click(); });
    await page.waitForFunction(() => document.getElementById('bagikanUrl').value.includes('#lihat='), undefined, { timeout: 30000 });
    assert.match(await page.textContent('#bagikanInfo'), /Tautan pendek gagal dibuat \(server: 500 BlobStoreNotFoundError\)/);
  },
};
