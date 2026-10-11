import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { CORS, ROOT } from './harness.mjs';

// JEV-087: tautan bagikan …/l/<id> menampilkan kartu pratinjau (judul, pesan & gambar dari tampilan 3D
// pilihan pengirim) di WhatsApp/iMessage, lalu meneruskan ke /#l=<id>; ikon layar utama (manifest PWA).
const require = createRequire(import.meta.url);
const tautan = require('../../api/tautan.js');
const lihat = require('../../api/lihat.js');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const kotak = [[0, 0, 5, 0], [5, 0, 5, 4], [5, 4, 0, 4], [0, 4, 0, 0]];

// Blob tiruan di memori + fetch ke URL-nya
function blobTiruan() {
  const toko = new Map(), tipe = new Map();
  const blob = () => ({ put: async (n, buf, o) => { toko.set(n, buf); tipe.set(n, o.contentType); return { url: 'https://blob.tiruan/' + n }; },
    head: async n => { if (!toko.has(n)) throw new Error('404'); return { url: 'https://blob.tiruan/' + n }; } });
  return { toko, tipe, blob };
}
async function panggil(h, metode, url, badan, headers = { host: 'plan23d.contoh.app' }) {
  const res = { h: {}, status: 0, isi: null, setHeader(k, v) { this.h[k.toLowerCase()] = v; }, end(b) { this.isi = b == null ? '' : String(b); } };
  Object.defineProperty(res, 'statusCode', { set(v) { res.status = v; }, get() { return res.status; } });
  await h({ method: metode, url, headers, query: Object.fromEntries(new URL(url, 'http://x').searchParams), body: badan }, res);
  return res;
}
const meta = (html, k) => (html.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]*)"`)) || [])[1];

export const tes = {
  'fungsi api/lihat: kartu Open Graph dari isi tautan, teks di-escape, gambar lewat sidik, diteruskan ke #l=': async () => {
    const { toko, tipe, blob } = blobTiruan();
    const asliFetch = globalThis.fetch;
    globalThis.fetch = async u => { const n = String(u).replace('https://blob.tiruan/', ''); return toko.has(n) ? new Response(toko.get(n)) : new Response('', { status: 404 }); };
    try {
      const ht = tautan.buatHandler(blob, () => true), hl = lihat.buatHandler(blob, () => true);
      // gambar pratinjau: hanya JPEG, beralamat isi
      const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), crypto.randomBytes(3000)]);
      assert.equal((await panggil(ht, 'POST', '/api/tautan?gambar=' + sha(jpg), jpg)).status, 200);
      assert.equal(tipe.get('gambar/' + sha(jpg) + '.jpg'), 'image/jpeg');
      const png = Buffer.from('\x89PNG\r\n\x1a\nxxxxxxxx', 'latin1');
      assert.equal((await panggil(ht, 'POST', '/api/tautan?gambar=' + sha(png), png)).status, 400, 'bukan JPEG');
      assert.equal((await panggil(ht, 'POST', '/api/tautan?gambar=' + sha(png), jpg)).status, 400, 'sidik salah');
      assert.equal((await panggil(ht, 'POST', '/api/tautan?gambar=' + 'a'.repeat(64), Buffer.alloc(700 * 1024))).status, 413);
      assert.equal((await panggil(ht, 'GET', '/api/tautan?gambar=' + sha(jpg))).status, 405);
      // tautan dengan judul/pesan buatan pengirim (berisi tag) + gambar
      const isi = { v: 1, name: 'Rumah Lama', levels: [], bagikan: { bahasa: 'id', judul: 'Rumah <b>Bu</b> "Ani"', pesan: 'Yuk mampir!\n<script>alert(1)</script>', gambar: sha(jpg) } };
      const id = JSON.parse((await panggil(ht, 'POST', '/api/tautan', zlib.deflateRawSync(Buffer.from(JSON.stringify(isi))))).isi).id;
      const r = await panggil(hl, 'GET', '/api/lihat?id=' + id + '&r=p23d-l4-0123456789abcdef');
      assert.equal(r.status, 200); assert.match(r.h['content-type'], /text\/html/); assert.match(r.h['content-security-policy'], /default-src 'none'/);
      assert.equal(meta(r.isi, 'og:title'), 'Rumah &lt;b&gt;Bu&lt;/b&gt; &quot;Ani&quot;');
      assert.equal(meta(r.isi, 'og:description'), 'Yuk mampir! &lt;script&gt;alert(1)&lt;/script&gt;');
      assert.equal(meta(r.isi, 'og:image'), 'https://blob.tiruan/gambar/' + sha(jpg) + '.jpg');
      assert.equal(meta(r.isi, 'og:url'), `https://plan23d.contoh.app/l/${id}?r=p23d-l4-0123456789abcdef`);
      assert.equal(meta(r.isi, 'twitter:card'), 'summary_large_image');
      assert.ok(r.isi.includes(`<meta http-equiv="refresh" content="0;url=/#l=${id}&amp;r=p23d-l4-0123456789abcdef">`), r.isi);
      assert.ok(!/<script/i.test(r.isi), 'tanpa skrip');
      // tanpa pilihan pengirim: nama proyek + pesan bawaan (bahasa pengirim) + sampul situs; ruang tak sah dibuang
      const isi2 = zlib.deflateRawSync(Buffer.from(JSON.stringify({ v: 1, name: 'Villa', levels: [], bagikan: { gambar: '../x' } })));
      const id2 = JSON.parse((await panggil(ht, 'POST', '/api/tautan', isi2)).isi).id;
      const r2 = await panggil(hl, 'GET', `/api/lihat?id=${id2}&r=javascript:alert(1)`);
      assert.equal(meta(r2.isi, 'og:title'), 'Villa'); assert.match(meta(r2.isi, 'og:description'), /^Take a walk inside this house/);
      assert.equal(meta(r2.isi, 'og:image'), 'https://plan23d.contoh.app/ikon/sampul.jpg');
      assert.ok(r2.isi.includes(`content="0;url=/#l=${id2}"`));
      // undangan main bareng tanpa pesan: kalimat ajakan bawaan (bahasa pengirim); pesan sendiri tetap menang
      const isi3 = zlib.deflateRawSync(Buffer.from(JSON.stringify({ v: 1, name: 'Villa', levels: [], bagikan: { bahasa: 'id', judul: 'Main di Villa' } })));
      const id3 = JSON.parse((await panggil(ht, 'POST', '/api/tautan', isi3)).isi).id;
      const r5 = await panggil(hl, 'GET', `/api/lihat?id=${id3}&r=p23d-e3-0123456789abcdef`);
      assert.equal(meta(r5.isi, 'og:title'), 'Main di Villa'); assert.match(meta(r5.isi, 'og:description'), /^Ayo main bareng!/);
      assert.match(meta((await panggil(hl, 'GET', `/api/lihat?id=${id3}`)).isi, 'og:description'), /^Jalan-jalan di dalam rumah ini/);
      assert.equal(meta((await panggil(hl, 'GET', `/api/lihat?id=${id}&r=p23d-e3-0123456789abcdef`)).isi, 'og:description'), 'Yuk mampir! &lt;script&gt;alert(1)&lt;/script&gt;');
      // id tak sah → beranda; id tak ada → kartu bawaan, tetap diteruskan (aplikasi yang memberi tahu galatnya)
      const r3 = await panggil(hl, 'GET', '/api/lihat?id=../../etc');
      assert.deepEqual([r3.status, r3.h.location], [302, '/']);
      const r4 = await panggil(hl, 'GET', '/api/lihat?id=ZZZZZZZZZZ', null, { host: 'evil.com/"><x' });
      assert.equal(r4.status, 200); assert.equal(meta(r4.isi, 'og:title'), '3D house'); assert.equal(meta(r4.isi, 'og:image'), '/ikon/sampul.jpg');
      assert.match(r4.h['cache-control'], /max-age=60$/);
    } finally { globalThis.fetch = asliFetch; }
  },
  'bagikan: judul, pesan & gambar pratinjau ikut di isi tautan; tautan …/l/<id> ditampilkan': async (page) => {
    const simpan = {};
    await page.route('**/api/tautan**', async rt => {
      const q = rt.request(), u = new URL(q.url());
      if (u.searchParams.get('gambar')) { simpan.gambar = { sha: u.searchParams.get('gambar'), buf: q.postDataBuffer(), tipe: q.headers()['content-type'] }; return rt.fulfill({ headers: CORS, json: { ok: true } }); }
      if (q.method() === 'POST') { simpan.isi = q.postDataBuffer(); return rt.fulfill({ headers: CORS, json: { id: 'Pr3vXwQz9k' } }); }
      return rt.fulfill({ status: 404, json: {} });
    });
    await page.evaluate(k => { PROJECT.levels[0].walls = k.map(([a, b, c, d]) => ({ id: uid('w'), x1: a, z1: b, x2: c, z2: d, thickness: 0.15, openings: [] })); rebuildScene(); }, kotak);
    await page.click('.tabs button[data-tab="file"]');
    await page.fill('#bagikanJudul', 'Rumah Pak Budi');
    await page.fill('#bagikanPesan', 'Yuk lihat rumah baru kami!');
    assert.equal(await page.isChecked('#bagikanFoto'), true);
    await page.click('#bagikanBtn');
    await page.waitForFunction(() => !document.getElementById('bagikanHasil').hidden && document.getElementById('bagikanUrl').value, undefined, { timeout: 30000 });
    const ui = await page.evaluate(() => ({ url: document.getElementById('bagikanUrl').value, img: !document.getElementById('bagikanGambar').hidden,
      src: document.getElementById('bagikanGambar').src.slice(0, 23), info: document.getElementById('bagikanInfo').textContent }));
    assert.equal(ui.url, new URL(page.url()).origin + '/l/Pr3vXwQz9k');
    assert.deepEqual([ui.img, ui.src], [true, 'data:image/jpeg;base64,']);
    assert.match(ui.info, /Kartu pratinjau/);
    // gambar: JPEG ≤ 280 KB, sidik = isi, 1200×630
    const g = simpan.gambar;
    assert.equal(g.tipe, 'image/jpeg'); assert.equal(sha(g.buf), g.sha); assert.ok(g.buf.length < 280 * 1024, g.buf.length + ' byte');
    assert.deepEqual([g.buf[0], g.buf[1]], [0xff, 0xd8]);
    const ukuran = await page.evaluate(async b64 => { const im = new Image(); im.src = 'data:image/jpeg;base64,' + b64; await im.decode(); return [im.naturalWidth, im.naturalHeight]; }, g.buf.toString('base64'));
    assert.deepEqual(ukuran, [1200, 630]);
    const isi = JSON.parse(zlib.inflateRawSync(simpan.isi).toString());
    assert.deepEqual(isi.bagikan, { bahasa: 'id', judul: 'Rumah Pak Budi', pesan: 'Yuk lihat rumah baru kami!', gambar: g.sha });
    assert.ok(tautan.sahkan(simpan.isi), 'isi tetap diterima server');
    // tanpa gambar: tidak diunggah, tidak ada di isi
    simpan.gambar = null; await page.uncheck('#bagikanFoto');
    const r = await page.evaluate(async () => { const r = await buatTautanLihat(); return { url: r.url, gambar: r.gambar }; });
    assert.equal(simpan.gambar, null); assert.equal(r.gambar, ''); assert.match(r.url, /#l=Pr3vXwQz9k$/);
    assert.equal(JSON.parse(zlib.inflateRawSync(simpan.isi).toString()).bagikan.gambar, undefined);
    // undangan main bareng: kolom judul/pesan/gambar sendiri di bagian lobi, diteruskan ke tautannya
    const lobi = await page.evaluate(() => ({ judul: !!document.getElementById('lobiJudul'), pesan: !!document.getElementById('lobiPesan'),
      foto: document.getElementById('lobiFoto').checked, gambar: !!document.getElementById('lobiGambar') }));
    assert.deepEqual(lobi, { judul: true, pesan: true, foto: true, gambar: true });
    simpan.gambar = null;
    const u = await page.evaluate(async () => { const r = await buatTautanLihat(undefined, { bagikan: { judul: 'Main bareng di rumahku', pesan: 'Gabung yuk!', foto: true } }); return { url: r.urlBagikan, gambar: r.gambar.slice(0, 11) }; });
    assert.deepEqual(u, { url: new URL(page.url()).origin + '/l/Pr3vXwQz9k', gambar: 'data:image/' });
    assert.deepEqual(JSON.parse(zlib.inflateRawSync(simpan.isi).toString()).bagikan, { bahasa: 'id', judul: 'Main bareng di rumahku', pesan: 'Gabung yuk!', gambar: simpan.gambar.sha });
  },
  'ikon layar utama: manifest, ikon PNG sesuai ukuran, tag kepala halaman': async (page) => {
    const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
    assert.deepEqual([m.short_name, m.display, m.start_url], ['Plan23D', 'standalone', './']);
    const ukuranPNG = f => { const b = fs.readFileSync(path.join(ROOT, f)); assert.equal(b.toString('latin1', 1, 4), 'PNG', f); return b.readUInt32BE(16) + 'x' + b.readUInt32BE(20); };
    for (const i of m.icons) { assert.ok(fs.existsSync(path.join(ROOT, i.src)), i.src); if (i.type === 'image/png') assert.equal(ukuranPNG(i.src), i.sizes); }
    assert.ok(m.icons.some(i => i.purpose === 'maskable' && i.sizes === '512x512'));
    const kepala = await page.evaluate(() => ({ manifest: document.querySelector('link[rel=manifest]')?.getAttribute('href'),
      apple: document.querySelector('link[rel=apple-touch-icon]')?.getAttribute('href'), judul: document.querySelector('meta[name=apple-mobile-web-app-title]')?.content,
      og: document.querySelector('meta[property="og:image"]')?.content }));
    assert.deepEqual(kepala, { manifest: 'manifest.webmanifest', apple: 'apple-touch-icon.png', judul: 'Plan23D', og: 'ikon/sampul.jpg' });
    // iOS mencari ikon di akar situs (Chrome iPad/iPhone tidak selalu membaca tag kepala); manifest tanpa SVG (WebKit bisa memilihnya lalu gagal)
    for (const f of ['apple-touch-icon.png', 'apple-touch-icon-precomposed.png']) assert.equal(ukuranPNG(f), '180x180');
    assert.ok(fs.readFileSync(path.join(ROOT, 'favicon.ico')).readUInt16LE(2) === 1, 'favicon.ico');
    assert.ok(!m.icons.some(i => /svg/.test(i.type)), 'manifest tanpa ikon SVG');
    assert.equal(ukuranPNG(kepala.apple), '180x180');
    const sampul = fs.readFileSync(path.join(ROOT, kepala.og)); assert.ok(sampul[0] === 0xff && sampul[1] === 0xd8 && sampul.length < 280 * 1024);
    // vercel.json meneruskan /l/<id> ke fungsi kartu pratinjau
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')).rewrites, [{ source: '/l/:id', destination: '/api/lihat?id=:id' }]);
  },
};
