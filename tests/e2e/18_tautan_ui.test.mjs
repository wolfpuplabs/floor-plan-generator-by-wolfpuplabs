import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { CORS, bukaApp } from './harness.mjs';

// JEV-067: tautan lihat-saja pendek (fungsi Vercel + Blob, kembali ke tautan panjang bila tidak
// ada), isi tautan ringkas (tanpa data tekstur foto, angka dibulatkan), galat tautan tampil tetap,
// pelat lantai menghalangi lampu lantai lain, bilah mode jalan bisa diciutkan + pilihan kualitas,
// ikon SVG menggantikan emoji
const require = createRequire(import.meta.url);
const api = require('../../api/tautan.js');
const kotak = (x0, z0, x1, z1) => [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]];

// tiruan fungsi /api/tautan di peramban (seperti di Vercel)
async function ruteApi(page, simpan, status = 200) {
  await page.route('**/api/tautan**', async r => {
    const q = r.request();
    // lampiran (potongan berkas, JEV-068) diuji di 19_lampiran — di sini seolah belum didukung
    if (new URL(q.url()).searchParams.get('bagian')) return r.fulfill({ status: 501, headers: CORS, json: { galat: 'blob-belum-diatur' } });
    if (q.method() === 'POST') {
      if (status !== 200) return r.fulfill({ status, headers: CORS, json: { galat: 'blob-belum-diatur' } });
      const buf = q.postDataBuffer(); const id = 'Ab3dEf7hJk'; simpan.set(id, buf); simpan.last = buf;
      return r.fulfill({ headers: CORS, json: { id } });
    }
    const id = new URL(q.url()).searchParams.get('id');
    return simpan.has(id) ? r.fulfill({ headers: { ...CORS, 'content-type': 'application/octet-stream' }, body: simpan.get(id) }) : r.fulfill({ status: 404, json: { galat: 'tidak-ada' } });
  });
}
const isiRumah = (page, foto) => page.evaluate(([k, foto]) => {
  PROJECT.levels[0].walls = k.map(([a, b, c, d]) => ({ id: uid('w'), x1: a + 0.123456, z1: b, x2: c + 0.123456, z2: d, thickness: 0.15, openings: [] }));
  PROJECT.levels[0].objects = [{ id: 'ob1', kind: 'furn', type: 'sofa3', x: 2.3333333, y: 0, z: 1.7777777, rotY: 0.5, sx: 1, sy: 1, sz: 1, params: foto ? { tekstur: 'tfoto' } : {} }];
  if (foto) PROJECT.tekstur = { tfoto: { nama: 'kain', sumber: 'foto', data: 'data:image/jpeg;base64,' + 'A'.repeat(200000), aspek: 1 } };
  rebuildScene();
}, [kotak(0, 0, 6, 5), foto]);

export const tes = {
  'fungsi api/tautan: simpan & ambil, tolak isi palsu / terlalu besar, 501 bila Blob belum diatur': async () => {
    const toko = new Map();
    const blob = () => ({ put: async (n, buf) => { toko.set(n, buf); return { url: 'mem://' + n }; }, head: async n => { if (!toko.has(n)) throw new Error('404'); return { url: 'mem://' + n }; } });
    const asliFetch = globalThis.fetch;
    globalThis.fetch = async u => { const n = String(u).replace('mem://', ''); return toko.has(n) ? new Response(toko.get(n)) : new Response('', { status: 404 }); };
    const panggil = async (h, metode, url, badan) => { const res = { h: {}, status: 0, isi: null, setHeader(k, v) { this.h[k] = v; }, end(b) { this.isi = b; } };
      Object.defineProperty(res, 'statusCode', { set(v) { res.status = v; }, get() { return res.status; } });
      await h({ method: metode, url, query: Object.fromEntries(new URL(url, 'http://x').searchParams), body: badan }, res); return res; };
    try {
      const h = api.buatHandler(blob, () => true);
      const proyek = zlib.deflateRawSync(Buffer.from(JSON.stringify({ v: 1, name: 'Rumah', levels: [] })));
      const s = await panggil(h, 'POST', '/api/tautan', proyek);
      assert.equal(s.status, 200); const id = JSON.parse(s.isi).id; assert.match(id, api.ID);
      const g = await panggil(h, 'GET', '/api/tautan?id=' + id);
      assert.equal(g.status, 200); assert.deepEqual(Buffer.from(g.isi), proyek);
      assert.equal((await panggil(h, 'POST', '/api/tautan', zlib.deflateRawSync(Buffer.from('{"v":2}')))).status, 400, 'bukan proyek');
      assert.equal((await panggil(h, 'POST', '/api/tautan', Buffer.from('bukan deflate'))).status, 400);
      assert.equal((await panggil(h, 'POST', '/api/tautan', Buffer.alloc(2 * 1048576))).status, 413);
      assert.equal((await panggil(h, 'GET', '/api/tautan?id=../../x')).status, 400);
      assert.equal((await panggil(h, 'GET', '/api/tautan?id=ZZZZZZZZZZ')).status, 404);
      assert.equal((await panggil(h, 'DELETE', '/api/tautan')).status, 405);
      assert.equal((await panggil(api.buatHandler(blob, () => false), 'POST', '/api/tautan', proyek)).status, 501);
    } finally { globalThis.fetch = asliFetch; }
  },
  'bagikan: tautan pendek #l=…, isi ringkas tanpa data tekstur foto, penerima membukanya': async (page) => {
    const simpan = new Map();
    await ruteApi(page, simpan);
    await isiRumah(page, true);
    const r = await page.evaluate(async () => { const r = await buatTautanLihat(); return { url: r.url, pendek: r.pendek, foto: r.fotoDitinggal }; });
    assert.equal(r.pendek, true); assert.match(r.url, /#l=Ab3dEf7hJk$/); assert.equal(r.foto, 1);
    const isi = JSON.parse(zlib.inflateRawSync(simpan.last).toString());
    assert.deepEqual(isi.tekstur, {}, 'data tekstur foto tidak ikut');
    assert.ok(simpan.last.length < 4000, 'isi tautan ringkas: ' + simpan.last.length + ' byte');
    assert.equal(isi.levels[0].objects[0].x, 2.333); assert.equal(isi.levels[0].walls[0].x1, 0.123);
    // penerima membuka …/#l=<id> (halaman pengirim dikosongkan dulu: dua rumah sekaligus terlalu berat untuk WebGL CI)
    const dasar = page.url().split('#')[0];
    await page.goto('about:blank');
    const { page: b, log } = await bukaApp(page.context().browser(), dasar + '#l=Ab3dEf7hJk', { viewport: { width: 900, height: 600 }, rute: p => ruteApi(p, simpan) });
    try {
      await b.waitForFunction(() => LIHAT.siap, undefined, { timeout: 60000 });
      const h = await b.evaluate(() => ({ lihat: LIHAT.on, dinding: L().walls.length, objek: L().objects.length, galat: document.getElementById('lihatNama').classList.contains('galat') }));
      assert.deepEqual(h, { lihat: true, dinding: 4, objek: 1, galat: false });
      assert.deepEqual(log.galat, []);
    } finally { await b.close(); }
  },
  'bagikan: Blob belum diatur → tautan panjang + keterangan; tautan pendek rusak → galat tampil tetap': async (page) => {
    await ruteApi(page, new Map(), 501);
    await isiRumah(page, false);
    await page.evaluate(() => { pilihTab('file'); });
    await page.click('#bagikanBtn');
    await page.waitForFunction(() => document.getElementById('bagikanUrl').value.includes('#lihat='), undefined, { timeout: 30000 });
    assert.match(await page.textContent('#bagikanInfo'), /Tautan pendek belum aktif/);
    const spans = await page.$$eval('#bagikanInfo span', s => s.length);
    assert.ok(spans >= 2, 'satu kalimat per elemen (diterjemahkan sendiri-sendiri)');
    // galat tetap terlihat (bukan toast yang hilang)
    await page.evaluate(() => gagalTautanLihat(new Error('tautan tidak ditemukan atau sudah dihapus')));
    assert.equal(await page.isVisible('#lihatBar'), true);
    assert.match(await page.textContent('#lihatNama'), /tidak ditemukan/);
  },
  'pelat lantai menghalangi lampu lantai bawah: kamar lantai 2 tidak ikut terang': async (page) => {
    const r = await page.evaluate(async () => {
      const tidur = ms => new Promise(r => setTimeout(r, ms));
      const dinding = (k, buka) => k.map(([a, b2, c, d], i) => ({ id: uid('w'), x1: a, z1: b2, x2: c, z2: d, thickness: 0.15, openings: buka && buka[i] ? [{ id: uid('o'), ...buka[i] }] : [] }));
      PROJECT.levels[0].walls = dinding([[0, 0, 8, 0], [8, 0, 8, 6], [8, 6, 0, 6], [0, 6, 0, 0]]);
      PROJECT.levels[0].objects = [{ id: 'd1', kind: 'furn', type: 'pendant', x: 2.5, y: 0, z: 3, rotY: 0, sx: 1, sy: 1, sz: 1, params: { lumen: 2000 } }];
      addLevel();
      PROJECT.levels[1].walls = dinding([[0, 0, 5, 0], [5, 0, 5, 6], [5, 6, 0, 6], [0, 6, 0, 0]], [null, { type: 'door_sliding', at: 3, width: 1.8, sill: 0, head: 2.2 }, null, null]);
      PROJECT.levels[1].objects = [];
      setFX(false); setSuasana('malam'); toggleAtap(true); rebuildScene();
      enterFPS(); FPS.feet = levelElevation(1); camera.position.set(1.0, levelElevation(1) + 1.6, 3.0); FPS.yaw = -Math.PI / 2; FPS.pitch = 0.25;
      const terang = () => { const c = renderer.domElement, g = document.createElement('canvas'); g.width = 48; g.height = 36; const x = g.getContext('2d'); x.drawImage(c, 0, 0, 48, 36);
        const d = x.getImageData(0, 0, 48, 36).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; return s / (d.length / 4); };
      const tenang = async () => { await tidur(4000); let a = terang(); for (let i = 0; i < 24; i++) { await tidur(600); const b = terang(); if (Math.abs(b - a) < 0.2) return b; a = b; } return a; };
      const nyala = await tenang();
      MATI.add('d1'); rebuildScene();
      const padam = await tenang(); exitFPS(); setFX(true);
      return { nyala, padam };
    });
    assert.ok(Math.abs(r.nyala - r.padam) < 1.5, `cahaya lantai bawah tembus ke kamar atas: ${r.nyala.toFixed(1)} vs ${r.padam.toFixed(1)}`);
  },
  'mode jalan: menu bisa diciutkan & diingat; kualitas render sinkron dengan panel Tampilan': async (page) => {
    await isiRumah(page, false);
    await page.evaluate(() => { localStorage.removeItem('fps_ciut'); enterFPS(); });
    // klik lewat DOM: di WebGL perangkat lunak bingkai 1–2 detik, pemeriksaan 'stabil' Playwright tidak pernah lolos
    const klik = () => page.evaluate(() => document.getElementById('fpsCiut').click());
    if (await page.evaluate(() => document.getElementById('fpsbar').classList.contains('ciut'))) await klik();
    await klik();
    assert.equal(await page.isVisible('#fpsMood'), false, 'menu diciutkan');
    assert.equal(await page.isVisible('#fpsExit'), true, 'tombol keluar tetap ada');
    assert.equal(await page.evaluate(() => localStorage.getItem('fps_ciut')), '1');
    await klik();
    await page.selectOption('#fpsRq', 'tinggi', { force: true });
    assert.deepEqual(await page.evaluate(() => [RQ_KINI, document.getElementById('rq').value]), ['tinggi', 'tinggi']);
    await page.evaluate(() => { setRenderQuality('halus'); exitFPS(); });
    assert.equal(await page.inputValue('#fpsRq'), 'halus');
  },
  'ikon: tab, toolbar, menu & bilah jalan memakai ikon SVG, bukan emoji': async (page) => {
    const r = await page.evaluate(() => {
      const emoji = /\p{Extended_Pictographic}/u;
      const sel = '.tabs button, #toolbar button, #toolMenu button, #fpsbar button, #fpsbar option, #lihatBar, #mulaiKartu button, #galeriRuang button';
      const sisa = [...document.querySelectorAll(sel)].filter(e => emoji.test(e.textContent)).map(e => e.id || e.textContent.trim().slice(0, 20));
      const tanpaIkon = [...document.querySelectorAll('.tabs button, #toolbar button')].filter(b => !b.querySelector('svg use')).map(b => b.id || b.textContent.trim());
      const rusak = [...document.querySelectorAll('svg use')].map(u => u.getAttribute('href')).filter(h => !document.querySelector(h));
      return { sisa, tanpaIkon, rusak: [...new Set(rusak)] };
    });
    assert.deepEqual(r, { sisa: [], tanpaIkon: [], rusak: [] });
  },
};
