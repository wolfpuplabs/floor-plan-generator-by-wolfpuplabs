/* Tautan pendek untuk "lihat saja" (JEV-067).
   Tautan lama membawa seluruh proyek di fragmen URL (#lihat=…) sehingga bisa puluhan KB dan
   terpotong aplikasi chat. Fungsi ini menyimpan proyek yang SUDAH dipadatkan (deflate-raw, dari
   peramban) di Vercel Blob milik pemilik situs dan mengembalikan id pendek: …/#l=<id>.
   - POST  /api/tautan        badan = byte deflate-raw  →  { id }
   - GET   /api/tautan?id=…   →  byte yang sama (penerima membukanya seperti tautan lama)
   Penjaga: ≤ 1,5 MB masuk, isi harus benar-benar proyek (dibuka dengan batas 20 MB lalu
   diperiksa bentuknya), id acak 10 karakter tanpa huruf mirip. Bila Blob belum diaktifkan
   (BLOB_READ_WRITE_TOKEN tidak ada) POST menjawab 501 dan aplikasi memakai tautan panjang. */
const zlib = require('node:zlib');
const crypto = require('node:crypto');

const BATAS_MASUK = 1.5 * 1048576, BATAS_BUKA = 20 * 1048576, ID = /^[A-HJ-NP-Za-km-z2-9]{10}$/;
const HURUF = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function idBaru() { let s = ''; for (const x of crypto.randomBytes(10)) s += HURUF[x % HURUF.length]; return s; }
function sahkan(buf) {
  let teks;
  try { teks = zlib.inflateRawSync(buf, { maxOutputLength: BATAS_BUKA }).toString('utf8'); } catch (e) { return false; }
  try { const j = JSON.parse(teks); return !!j && typeof j === 'object' && j.v === 1 && Array.isArray(j.levels); } catch (e) { return false; }
}
async function bacaBadan(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  const bag = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > BATAS_MASUK) { const e = new Error('ukuran'); e.kode = 413; throw e; } bag.push(c); }
  return Buffer.concat(bag);
}
function kirim(res, status, obj) {
  res.statusCode = status; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(obj));
}
function buatHandler(ambilBlob, siap = () => !!process.env.BLOB_READ_WRITE_TOKEN) {
  return async function handler(req, res) {
    res.setHeader('x-content-type-options', 'nosniff');
    try {
      if (req.method === 'POST') {
        if (!siap()) return kirim(res, 501, { galat: 'blob-belum-diatur' });
        const buf = await bacaBadan(req);
        if (!buf.length || buf.length > BATAS_MASUK) return kirim(res, 413, { galat: 'ukuran' });
        if (!sahkan(buf)) return kirim(res, 400, { galat: 'isi-tidak-sah' });
        const id = idBaru();
        await ambilBlob().put('tautan/' + id + '.bin', buf, { access: 'public', addRandomSuffix: false, contentType: 'application/octet-stream', cacheControlMaxAge: 31536000 });
        return kirim(res, 200, { id });
      }
      if (req.method === 'GET') {
        const id = String((req.query && req.query.id) || new URL(req.url, 'http://x').searchParams.get('id') || '');
        if (!ID.test(id)) return kirim(res, 400, { galat: 'id' });
        let info;
        try { info = await ambilBlob().head('tautan/' + id + '.bin'); } catch (e) { return kirim(res, 404, { galat: 'tidak-ada' }); }
        const r = await fetch(info.url); if (!r.ok) return kirim(res, 404, { galat: 'tidak-ada' });
        const buf = Buffer.from(await r.arrayBuffer());
        res.statusCode = 200; res.setHeader('content-type', 'application/octet-stream');
        res.setHeader('cache-control', 'public, max-age=31536000, immutable');
        return res.end(buf);
      }
      res.setHeader('allow', 'GET, POST'); return kirim(res, 405, { galat: 'metode' });
    } catch (e) { return kirim(res, e.kode || 500, { galat: e.kode ? 'ukuran' : 'server' }); }
  };
}
module.exports = buatHandler(() => require('@vercel/blob'));
module.exports.buatHandler = buatHandler;
module.exports.sahkan = sahkan;
module.exports.ID = ID;
