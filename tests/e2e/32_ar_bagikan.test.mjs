import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { CORS } from './harness.mjs';

// JEV-083: AR dari tautan yang dibagikan. Android tanpa WebXR memakai Google Scene Viewer, yang
// tidak bisa membaca model blob: → GLB diunggah ke api/tautan?ar (beralamat isi) lalu dibuka lewat
// intent. Browser di dalam aplikasi chat di iOS tidak punya AR Quick Look → arahan ke Safari.
const require = createRequire(import.meta.url);
const api = require('../../api/tautan.js');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const IOS_IG = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0';
const HP = { width: 390, height: 844 };

function glb(n) {
  const b = Buffer.alloc(n); b.write('glTF', 0, 'latin1'); b.writeUInt32LE(2, 4); b.writeUInt32LE(n, 8); return b;
}
// rumah kecil → tautan lihat-saja panjang (api pendek tidak ada) → buka di halaman yang sama
async function bukaTautanRumah(page) {
  await page.route('**/api/tautan', r => r.fulfill({ status: 501, headers: CORS, json: { galat: 'blob-belum-diatur' } }));
  const url = await page.evaluate(async () => {
    PROJECT.levels[0].walls = [[0, 0, 4, 0], [4, 0, 4, 3], [4, 3, 0, 3], [0, 3, 0, 0]].map(([a, b, c, d]) => ({ id: uid('w'), x1: a, z1: b, x2: c, z2: d, thickness: 0.15, openings: [] }));
    rebuildScene(); return (await buatTautanLihat()).url;
  });
  assert.match(url, /#lihat=/);
  const dasar = page.url().split('#')[0];
  await page.goto('about:blank');               // hanya ganti hash = tidak memuat ulang
  await page.goto(dasar + url.slice(url.indexOf('#')), { timeout: 90000 });
  await page.waitForFunction(() => window.__siap && LIHAT.siap, undefined, { timeout: 90000 });
}

export const tes = {
  'fungsi api/tautan?ar: GLB beralamat isi → url publik; sidik salah, bukan GLB, terlalu besar ditolak': async () => {
    const toko = new Map();
    const blob = () => ({ put: async (n, buf) => { toko.set(n, buf); return { url: 'https://toko.example/' + n }; }, head: async n => { if (!toko.has(n)) throw new Error('404'); return { url: 'https://toko.example/' + n }; } });
    const panggil = async (h, metode, url, badan) => { const res = { h: {}, status: 0, isi: null, setHeader(k, v) { this.h[k] = v; }, end(b) { this.isi = b; } };
      Object.defineProperty(res, 'statusCode', { set(v) { res.status = v; }, get() { return res.status; } });
      await h({ method: metode, url, query: Object.fromEntries(new URL(url, 'http://x').searchParams), body: badan }, res); return res; };
    const h = api.buatHandler(blob, () => true), g = glb(4096), s = sha(g);
    const r = await panggil(h, 'POST', '/api/tautan?ar=' + s, g);
    assert.equal(r.status, 200);
    assert.deepEqual(JSON.parse(r.isi), { url: 'https://toko.example/ar/' + s + '.glb' });
    assert.deepEqual([...toko.keys()], ['ar/' + s + '.glb']);
    assert.equal((await panggil(h, 'POST', '/api/tautan?ar=' + s, g)).status, 200, 'unggah ulang isi yang sama');
    assert.equal(toko.size, 1);
    assert.equal((await panggil(h, 'POST', '/api/tautan?ar=' + sha(Buffer.from('lain')), g)).status, 400, 'nama ≠ sidik isi');
    const bukan = Buffer.from('bukan model sama sekali, hanya teks');
    assert.equal((await panggil(h, 'POST', '/api/tautan?ar=' + sha(bukan), bukan)).status, 400, 'bukan GLB');
    const besar = glb(api.BATAS_AR + 8);
    assert.equal((await panggil(h, 'POST', '/api/tautan?ar=' + sha(besar), besar)).status, 413);
    assert.equal((await panggil(h, 'GET', '/api/tautan?ar=' + s)).status, 405);
    assert.equal((await panggil(h, 'POST', '/api/tautan?ar=../../tautan/x', g)).status, 400);
    assert.equal((await panggil(api.buatHandler(blob, () => false), 'POST', '/api/tautan?ar=' + s, g)).status, 501);
  },
  'Android tanpa WebXR: tautan lihat → AR menyiapkan Scene Viewer dengan model di server': async (page) => {
    await bukaTautanRumah(page);
    const unggah = [];
    await page.route('**/api/tautan?ar=*', r => {
      const q = r.request(), b = q.postDataBuffer(), h = new URL(q.url()).searchParams.get('ar');
      unggah.push({ ok: sha(b) === h, glb: b.toString('latin1', 0, 4) });
      return r.fulfill({ headers: CORS, json: { url: 'https://toko.example/ar/' + h + '.glb' } });
    });
    await page.click('#lihatAR');
    await page.waitForSelector('#arSV:not([hidden])', { timeout: 90000 });
    assert.deepEqual(unggah, [{ ok: true, glb: 'glTF' }]);
    assert.match(await page.textContent('#arInfo'), /Google Scene Viewer/);
    const href = await page.evaluate(() => { let h = ''; const asli = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () { h = this.href; }; document.getElementById('arSV').click(); HTMLAnchorElement.prototype.click = asli; return h; });
    assert.match(href, /^intent:\/\/arvr\.google\.com\/scene-viewer\/1\.2\?/);
    assert.match(href, /package=com\.google\.android\.googlequicksearchbox/);
    const file = new URLSearchParams(href.slice(href.indexOf('?') + 1, href.indexOf('#'))).get('file');
    assert.match(file, /^https:\/\/toko\.example\/ar\/[0-9a-f]{64}\.glb$/);
    // ditutup → tombol hilang; hosting tanpa fungsi (GitHub Pages) → arahan unduh .glb
    await page.click('#arClose');
    assert.equal(await page.evaluate(() => document.getElementById('arSV').hidden), true);
    await page.unroute('**/api/tautan?ar=*');
    await page.route('**/api/tautan?ar=*', r => r.fulfill({ status: 405, body: '' }));
    await page.click('#lihatAR');
    await page.waitForFunction(() => AR.sv === 'gagal', undefined, { timeout: 90000 });
    assert.match(await page.textContent('#arInfo'), /Unduh \.glb/);
    assert.equal(await page.evaluate(() => document.getElementById('arSV').hidden), true);
  },
  'browser di dalam aplikasi iOS: AR diarahkan ke Safari + tombol salin tautan': async (page) => {
    await bukaTautanRumah(page);
    await page.click('#lihatAR');
    await page.waitForFunction(() => AR.open, undefined, { timeout: 90000 });
    assert.match(await page.textContent('#arInfo'), /Buka tautan ini di Safari/);
    const b = page.locator('#arInfo button', { hasText: 'Salin tautan' });
    assert.equal(await b.count(), 1);
    await page.evaluate(() => { window.__disalin = null; salinTeks = async t => { window.__disalin = t; return true; }; });
    await b.click();
    assert.match(await page.evaluate(() => window.__disalin), /#lihat=/);
    // tidak ada unggahan Scene Viewer di iOS
    assert.equal(await page.evaluate(() => AR.sv), '');
  },
  'iOS: panel AR tidak menunggu USDZ; penyusunan model yang menggantung dibatasi waktu, panel tetap terbuka dengan pesan': async (page) => {
    await bukaTautanRumah(page);
    const r = await page.evaluate(async () => {
      let usdz = 0; AR.usdzLib = Promise.resolve(class { parse() { usdz++; return new Promise(() => {}); } });
      await openAR(); const normal = { buka: AR.open, glb: !!AR.blob, usdz, loader: document.getElementById('loader').classList.contains('on') };
      closeAR();
      // penyusun GLB menggantung (perangkat lemah / tekstur raksasa): berhenti setelah batas waktu
      const asli = THREE.GLTFExporter.prototype.parse; THREE.GLTFExporter.prototype.parse = () => {}; AR.batasMs = 800;
      const t0 = performance.now(); await openAR(); const ms = performance.now() - t0;
      THREE.GLTFExporter.prototype.parse = asli; AR.batasMs = 25000;
      return { normal, gantung: { buka: AR.open, panel: !document.getElementById('arPanel').hidden, loader: document.getElementById('loader').classList.contains('on'), pesan: document.getElementById('arFallback').textContent, cepat: ms < 6000 } };
    });
    assert.deepEqual(r.normal, { buka: true, glb: true, usdz: 0, loader: false });
    assert.equal(r.gantung.buka, true); assert.equal(r.gantung.panel, true); assert.equal(r.gantung.loader, false); assert.equal(r.gantung.cepat, true);
    assert.match(r.gantung.pesan, /terlalu berat/);
  },
};
tes['iOS: panel AR tidak menunggu USDZ; penyusunan model yang menggantung dibatasi waktu, panel tetap terbuka dengan pesan'].opsi = { ua: IOS_IG, viewport: HP };
tes['Android tanpa WebXR: tautan lihat → AR menyiapkan Scene Viewer dengan model di server'].opsi = { ua: ANDROID, viewport: HP };
tes['browser di dalam aplikasi iOS: AR diarahkan ke Safari + tombol salin tautan'].opsi = { ua: IOS_IG, viewport: HP };
