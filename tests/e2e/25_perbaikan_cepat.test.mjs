import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { CORS, bukaApp } from './harness.mjs';

// JEV-074: salin tautan andal (Clipboard API ditolak/menggantung → cadangan), gizmo mengikuti
// rotasi objek, ketukan ganda di piano/kanvas tidak memperbesar halaman, AR di mode lihat,
// langit 360° unggahan ikut tautan pendek
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
async function ruteApi(page, simpan) {
  simpan.bagian = simpan.bagian || new Map();
  await page.route('**/api/tautan**', async r => {
    const q = r.request(), u = new URL(q.url()), h = u.searchParams.get('bagian');
    if (h) {
      if (q.method() === 'POST') { const b = q.postDataBuffer(); if (sha(b) !== h) return r.fulfill({ status: 400, headers: CORS, json: {} }); simpan.bagian.set(h, b); return r.fulfill({ headers: CORS, json: { ok: true } }); }
      if (u.searchParams.get('cek')) return r.fulfill({ headers: CORS, json: { ada: simpan.bagian.has(h) } });
      return simpan.bagian.has(h) ? r.fulfill({ headers: { ...CORS, 'content-type': 'application/octet-stream' }, body: simpan.bagian.get(h) }) : r.fulfill({ status: 404, json: {} });
    }
    if (q.method() === 'POST') { simpan.last = q.postDataBuffer(); simpan.set('Lgt36AbCdE', simpan.last); return r.fulfill({ headers: CORS, json: { id: 'Lgt36AbCdE' } }); }
    const id = u.searchParams.get('id');
    return simpan.has(id) ? r.fulfill({ headers: { ...CORS, 'content-type': 'application/octet-stream' }, body: simpan.get(id) }) : r.fulfill({ status: 404, json: {} });
  });
}
const rumah = page => page.evaluate(() => {
  PROJECT.levels[0].walls = [[0, 0, 6, 0], [6, 0, 6, 5], [6, 5, 0, 5], [0, 5, 0, 0]].map(([a, b, c, d]) => ({ id: uid('w'), x1: a, z1: b, x2: c, z2: d, thickness: 0.15, openings: [] }));
  PROJECT.levels[0].objects = []; rebuildScene();
});

export const tes = {
  'salin tautan: Clipboard API ditolak atau menggantung → cadangan execCommand; gagal total → arahan jujur': async (page) => {
    const r = await page.evaluate(async () => {
      const hasil = {}; let disalin = null, perintah = 0;
      const asliExec = document.execCommand.bind(document);
      document.getElementById('bagikanHasil').hidden = false; document.getElementById('bagikanUrl').value = 'https://contoh.app/#l=Ab3dEf7hJk';
      const tunggu = async () => { for (let i = 0; i < 40 && !/disalin|menolak/.test(document.getElementById('toast').textContent); i++) await new Promise(r => setTimeout(r, 100)); return document.getElementById('toast').textContent; };
      const klik = async () => { document.getElementById('toast').textContent = ''; document.getElementById('bagikanSalin').click(); return tunggu(); };
      // jalur sinkron tidak tersedia → Clipboard API
      document.execCommand = () => false;
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async t => { disalin = t; } } });
      hasil.api = [await klik(), disalin];
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => new Promise(() => {}) } });   // menggantung (iOS)
      document.execCommand = c => { perintah++; return c === 'copy'; };
      hasil.gantung = [await klik(), perintah];
      // iPad/iPhone: hanya boleh menyalin LANGSUNG di dalam ketukan — jalur sinkron dicoba sebelum menunggu apa pun
      let api = 0; perintah = 0;
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { api++; } } });
      document.execCommand = c => { perintah++; return c === 'copy'; };
      document.getElementById('toast').textContent = ''; document.getElementById('bagikanSalin').click();
      const langsung = perintah;                                       // sebelum await pertama
      hasil.sinkron = [await tunggu(), langsung, api];
      // tombol "Salin undangan" lobi memakai jalur yang sama
      document.getElementById('lobiUrl').value = 'https://contoh.app/#l=Ab3dEf7hJk&r=p23d-abcdefghijkl'; perintah = 0;
      document.getElementById('toast').textContent = ''; document.getElementById('lobiSalin').click();
      hasil.lobi = [perintah, await tunggu()];
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('NotAllowedError'); } } });
      document.execCommand = () => false;
      hasil.gagal = await klik();
      document.execCommand = asliExec;
      return hasil;
    });
    assert.deepEqual(r.api, ['Tautan disalin', 'https://contoh.app/#l=Ab3dEf7hJk']);
    assert.equal(r.gantung[0], 'Tautan disalin'); assert.equal(r.gantung[1], 1);
    assert.deepEqual(r.sinkron, ['Tautan disalin', 1, 0]);
    assert.deepEqual(r.lobi, [1, 'Undangan disalin']);
    assert.match(r.gagal, /tekan lama/);
  },
  'gizmo: sumbu geser & skala mengikuti rotasi objek, putar tetap sumbu dunia': async (page) => {
    await rumah(page);
    const r = await page.evaluate(() => { addObject('furn', 'sofa3'); const o = L().objects[L().objects.length - 1]; o.rotY = 0.7; rebuildScene();
      select('obj', o.id); const out = {};
      for (const t of ['translate', 'scale', 'rotate']) { setTool(t); out[t] = gizmo.space; }
      return out; });
    assert.deepEqual(r, { translate: 'local', scale: 'local', rotate: 'world' });
  },
  'ketukan ganda cepat di piano / kanvas ditahan (iOS tidak memperbesar halaman)': async (page) => {
    const r = await page.evaluate(async () => {
      const jeda = () => new Promise(ok => setTimeout(ok, 450));
      const ketuk = el => { const e = new TouchEvent('touchend', { bubbles: true, cancelable: true }); el.dispatchEvent(e); return e.defaultPrevented; };
      const piano = document.getElementById('pianoPanel'), kanvas = renderer.domElement, tombol = document.getElementById('bagikanBtn');
      const dua = async el => { await jeda(); return [ketuk(el), ketuk(el)]; };
      return { piano: await dua(piano), kanvas: await dua(kanvas), tombol: await dua(tombol) };
    });
    assert.deepEqual(r.piano, [false, true]); assert.deepEqual(r.kanvas, [false, true]);
    assert.deepEqual(r.tombol, [false, false], 'tombol biasa tidak terpengaruh');
  },
  'tautan lihat: tombol AR tersedia; langit 360° unggahan ikut tautan pendek dan dipasang penerima': async (page) => {
    const simpan = new Map();
    await ruteApi(page, simpan);
    await rumah(page);
    await page.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#3a6fd8'); g.addColorStop(1, '#d8c29a'); x.fillStyle = g; x.fillRect(0, 0, 256, 128);
      const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.9));
      langitP().mode = 'foto'; await unggahLangit(new File([blob], 'pantai senja.jpg', { type: 'image/jpeg' }));
    });
    assert.equal(await page.evaluate(() => FOTO.id), 'unggah');
    const r = await page.evaluate(async () => { const r = await buatTautanLihat(); return { url: r.url, n: r.nLampiran, tinggal: r.langitDitinggal }; });
    assert.deepEqual([r.n, r.tinggal], [1, false]);
    const isi = JSON.parse(zlib.inflateRawSync(simpan.last).toString());
    assert.equal(isi.lampiran.langit.nama, 'pantai senja.jpg');
    const dasar = page.url().split('#')[0];
    await page.goto('about:blank');
    const { page: b, log } = await bukaApp(page.context().browser(), dasar + '#l=Lgt36AbCdE', { viewport: { width: 900, height: 600 }, rute: p => ruteApi(p, simpan) });
    try {
      try { await b.waitForFunction(() => LIHAT.siap && FOTO.id === 'unggah' && !!FOTO.tex, undefined, { timeout: 90000 }); }
      catch (e) { throw new Error('langit tidak terpasang: ' + JSON.stringify(await b.evaluate(() => ({ siap: LIHAT.siap, id: FOTO.id, tex: !!FOTO.tex, mode: langitP().mode, toast: document.getElementById('toast').textContent, info: (document.getElementById('langitInfo') || {}).textContent }))) + ' ' + log.galat.join('|')); }
      assert.equal(await b.evaluate(() => FOTO.nama), 'pantai senja');
      assert.equal(await b.isVisible('#lihatAR'), true, 'tombol AR di bilah lihat');
      assert.deepEqual(log.galat, []);
    } finally { await b.close(); }
  },
};
