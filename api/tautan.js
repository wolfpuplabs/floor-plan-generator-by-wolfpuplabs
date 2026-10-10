/* Tautan pendek untuk "lihat saja" (JEV-067).
   Tautan lama membawa seluruh proyek di fragmen URL (#lihat=…) sehingga bisa puluhan KB dan
   terpotong aplikasi chat. Fungsi ini menyimpan proyek yang SUDAH dipadatkan (deflate-raw, dari
   peramban) di Vercel Blob milik pemilik situs dan mengembalikan id pendek: …/#l=<id>.
   - POST  /api/tautan        badan = byte deflate-raw  →  { id }
   - GET   /api/tautan?id=…   →  byte yang sama (penerima membukanya seperti tautan lama)
   Lampiran (JEV-068): model unggahan, foto tekstur & video TV dipotong ≤ 3 MB di peramban dan
   disimpan per potongan, beralamat isi (nama = SHA-256 potongan, diperiksa ulang di sini):
   - GET   /api/tautan?bagian=<sha256>&cek=1  →  { ada }   (lewati unggah ulang potongan yang sama)
   - POST  /api/tautan?bagian=<sha256>        badan = potongan  →  { ok }
   - GET   /api/tautan?bagian=<sha256>        →  byte potongan
   AR Android (JEV-083): Scene Viewer berjalan di aplikasi Google, bukan di peramban, sehingga tidak
   bisa membaca model `blob:` buatan halaman — modelnya butuh alamat https publik:
   - POST  /api/tautan?ar=<sha256>            badan = GLB ≤ 4 MB  →  { url }   (beralamat isi)
   Penjaga: ≤ 1,5 MB masuk, isi harus benar-benar proyek (dibuka dengan batas 20 MB lalu
   diperiksa bentuknya), id acak 10 karakter tanpa huruf mirip. Bila Blob belum diaktifkan
   (BLOB_READ_WRITE_TOKEN tidak ada) POST menjawab 501 dan aplikasi memakai tautan panjang. */
const zlib = require('node:zlib');
const crypto = require('node:crypto');

const BATAS_MASUK = 1.5 * 1048576, BATAS_BUKA = 20 * 1048576, ID = /^[A-HJ-NP-Za-km-z2-9]{10}$/;
// potongan lampiran: 3 MB dari peramban (batas badan fungsi Vercel 4,5 MB)
const BATAS_BAGIAN = 3 * 1048576, SHA = /^[0-9a-f]{64}$/;
// GLB untuk Scene Viewer: satu badan permintaan (batas fungsi Vercel 4,5 MB)
const BATAS_AR = 4 * 1048576;
const HURUF = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function idBaru() { let s = ''; for (const x of crypto.randomBytes(10)) s += HURUF[x % HURUF.length]; return s; }
// GLB sah: tanda 'glTF', versi 2, panjang di kepala = panjang badan
function glbSah(buf) { return buf.length >= 20 && buf.toString('latin1', 0, 4) === 'glTF' && buf.readUInt32LE(4) === 2 && buf.readUInt32LE(8) === buf.length; }
function sahkan(buf) {
  let teks;
  try { teks = zlib.inflateRawSync(buf, { maxOutputLength: BATAS_BUKA }).toString('utf8'); } catch (e) { return false; }
  try { const j = JSON.parse(teks); return !!j && typeof j === 'object' && j.v === 1 && Array.isArray(j.levels); } catch (e) { return false; }
}
async function bacaBadan(req, batas = BATAS_MASUK) {
  if (Buffer.isBuffer(req.body)) return req.body;
  const bag = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > batas) { const e = new Error('ukuran'); e.kode = 413; throw e; } bag.push(c); }
  return Buffer.concat(bag);
}
function kirim(res, status, obj) {
  res.statusCode = status; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(obj));
}
const param = (req, k) => String((req.query && req.query[k]) || new URL(req.url, 'http://x').searchParams.get(k) || '');
async function ada(ambilBlob, path) { try { return await ambilBlob().head(path); } catch (e) { return null; } }
async function kirimBlob(res, info) {
  const r = await fetch(info.url); if (!r.ok) return kirim(res, 404, { galat: 'tidak-ada' });
  const buf = Buffer.from(await r.arrayBuffer());
  res.statusCode = 200; res.setHeader('content-type', 'application/octet-stream');
  res.setHeader('cache-control', 'public, max-age=31536000, immutable');
  return res.end(buf);
}
function buatHandler(ambilBlob, siap = () => !!process.env.BLOB_READ_WRITE_TOKEN) {
  return async function handler(req, res) {
    res.setHeader('x-content-type-options', 'nosniff');
    try {
      const ar = param(req, 'ar');
      if (ar) {
        if (!SHA.test(ar)) return kirim(res, 400, { galat: 'ar' });
        if (req.method !== 'POST') { res.setHeader('allow', 'POST'); return kirim(res, 405, { galat: 'metode' }); }
        if (!siap()) return kirim(res, 501, { galat: 'blob-belum-diatur' });
        const buf = await bacaBadan(req, BATAS_AR);
        if (!buf.length || buf.length > BATAS_AR) return kirim(res, 413, { galat: 'ukuran' });
        if (crypto.createHash('sha256').update(buf).digest('hex') !== ar) return kirim(res, 400, { galat: 'sidik' });
        if (!glbSah(buf)) return kirim(res, 400, { galat: 'bukan-glb' });
        const path = 'ar/' + ar + '.glb';
        const info = (await ada(ambilBlob, path)) || await ambilBlob().put(path, buf, { access: 'public', addRandomSuffix: false, contentType: 'model/gltf-binary', cacheControlMaxAge: 31536000 });
        return kirim(res, 200, { url: info.url });
      }
      const bagian = param(req, 'bagian');
      if (bagian) {
        if (!SHA.test(bagian)) return kirim(res, 400, { galat: 'bagian' });
        const path = 'bagian/' + bagian + '.bin';
        if (req.method === 'POST') {
          if (!siap()) return kirim(res, 501, { galat: 'blob-belum-diatur' });
          const buf = await bacaBadan(req, BATAS_BAGIAN);
          if (!buf.length || buf.length > BATAS_BAGIAN) return kirim(res, 413, { galat: 'ukuran' });
          // beralamat isi: nama harus sama dengan sidik isinya — potongan tidak bisa ditimpa isi lain
          if (crypto.createHash('sha256').update(buf).digest('hex') !== bagian) return kirim(res, 400, { galat: 'sidik' });
          if (!(await ada(ambilBlob, path))) await ambilBlob().put(path, buf, { access: 'public', addRandomSuffix: false, contentType: 'application/octet-stream', cacheControlMaxAge: 31536000 });
          return kirim(res, 200, { ok: true });
        }
        if (req.method === 'GET') {
          if (!siap()) return kirim(res, 501, { galat: 'blob-belum-diatur' });
          const info = await ada(ambilBlob, path);
          if (param(req, 'cek')) return kirim(res, 200, { ada: !!info });
          return info ? kirimBlob(res, info) : kirim(res, 404, { galat: 'tidak-ada' });
        }
        res.setHeader('allow', 'GET, POST'); return kirim(res, 405, { galat: 'metode' });
      }
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
        const id = param(req, 'id');
        if (!ID.test(id)) return kirim(res, 400, { galat: 'id' });
        const info = await ada(ambilBlob, 'tautan/' + id + '.bin');
        return info ? kirimBlob(res, info) : kirim(res, 404, { galat: 'tidak-ada' });
      }
      res.setHeader('allow', 'GET, POST'); return kirim(res, 405, { galat: 'metode' });
    } catch (e) {
      // nama kelas galat (mis. BlobStoreNotFoundError) membantu pemilik situs mendiagnosis tanpa membocorkan isi
      if (!e.kode) console.error('api/tautan', e);
      return kirim(res, e.kode || 500, e.kode ? { galat: 'ukuran' } : { galat: 'server', kode: String((e && e.constructor && e.constructor.name) || 'Error').slice(0, 40) });
    }
  };
}
module.exports = buatHandler(() => require('@vercel/blob'));
module.exports.buatHandler = buatHandler;
module.exports.sahkan = sahkan;
module.exports.ID = ID;
module.exports.BATAS_BAGIAN = BATAS_BAGIAN;
module.exports.BATAS_AR = BATAS_AR;
