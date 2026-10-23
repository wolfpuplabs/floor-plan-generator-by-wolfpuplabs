/* Galeri adegan (JEV-137): adegan yang diterbitkan tampil sebagai contoh di kartu Mulai (halaman awal).
   Adegan diterbitkan = tautan pendek lihat-saja yang sudah ada (api/tautan.js, tautan/<id>.bin) + satu
   catatan kecil di Vercel Blob. Judul, pesan & gambar dibaca dari isi tautan itu sendiri (bukan dari badan
   permintaan), lalu di-escape oleh peramban (textContent) — isi tautan tetap masukan tak tepercaya.
   - GET    /api/galeri                    → { item: [{ id, judul, pesan, oleh, gambar, waktu }] }  (yang sudah tayang)
   - GET    /api/galeri?semua=1  + kunci   → { item, tunda }   (pemilik: termasuk antrean persetujuan)
   - POST   /api/galeri  { id, oleh }      → { status: 'tayang' | 'tunda', hapus }   (hapus = token penarik)
   - POST   /api/galeri?id=…&setujui=1 + kunci → { ok }   (antrean → tayang)
   - DELETE /api/galeri?id=…  + kunci atau x-hapus: <token>  → { ok }
   Moderasi: galeri tampil untuk semua orang, jadi kiriman siapa pun masuk antrean dan baru tayang setelah
   pemilik situs menyetujuinya. Pemilik = yang memegang GALERI_KUNCI (variabel lingkungan Vercel, ≥ 12 karakter),
   dikirim di kepala x-kunci-galeri; kiriman pemilik langsung tayang. Tanpa GALERI_KUNCI galeri menjawab 501. */
const crypto = require('node:crypto');
const { ID, SHA, bukaIsi, ada } = require('./tautan.js');

const MAKS_TAYANG = 60, MAKS_TUNDA = 200, BATAS_BADAN = 4096;
const TAYANG = 'galeri/tayang/', TUNDA = 'galeri/tunda/';
const sidik = s => crypto.createHash('sha256').update(String(s)).digest();
const sidikHex = s => sidik(s).toString('hex');
// teks dari isi tautan / badan: satu baris, tanpa karakter kendali, dipotong
const teks = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n) : '');
const param = (req, k) => String((req.query && req.query[k]) || new URL(req.url, 'http://x').searchParams.get(k) || '');
function kirim(res, status, obj, cache = 'no-store') {
  res.statusCode = status; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', cache);
  res.end(JSON.stringify(obj));
}
async function bacaBadan(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body);
  if (req.body && typeof req.body === 'object') return Buffer.from(JSON.stringify(req.body));
  const bag = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > BATAS_BADAN) { const e = new Error('ukuran'); e.kode = 413; throw e; } bag.push(c); }
  return Buffer.concat(bag);
}
async function bacaJSON(url) {
  try { const r = await fetch(url); return r.ok ? await r.json() : null; } catch (e) { return null; }
}
// catatan galeri → bentuk publik (token penarik tidak pernah keluar)
const publik = c => ({ id: c.id, judul: teks(c.judul, 80), pesan: teks(c.pesan, 200), oleh: teks(c.oleh, 40), gambar: typeof c.gambar === 'string' && /^https:\/\//.test(c.gambar) ? c.gambar : '', waktu: c.waktu });

function buatHandler(ambilBlob, siap = () => !!process.env.BLOB_READ_WRITE_TOKEN, kunciSitus = () => process.env.GALERI_KUNCI || '') {
  // kunci pemilik dibandingkan lewat sidiknya dengan waktu tetap
  const pemilik = req => {
    const k = kunciSitus(), h = String((req.headers || {})['x-kunci-galeri'] || '');
    return k.length >= 12 && !!h && crypto.timingSafeEqual(sidik(k), sidik(h));
  };
  async function daftar(prefix, maks) {
    // daftar Blob urut nama, bukan waktu: ambil semua (≤ 1000) lalu pilih yang terbaru
    const r = await ambilBlob().list({ prefix, limit: 1000 });
    const blobs = (r.blobs || []).sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)).slice(0, maks);
    return (await Promise.all(blobs.map(b => bacaJSON(b.url)))).filter(c => c && ID.test(c.id)).map(publik);
  }
  return async function handler(req, res) {
    res.setHeader('x-content-type-options', 'nosniff');
    try {
      if (!siap() || kunciSitus().length < 12) return req.method === 'GET' && !param(req, 'semua') ? kirim(res, 200, { item: [] }) : kirim(res, 501, { galat: 'galeri-belum-diatur' });
      const id = param(req, 'id');
      if (req.method === 'GET') {
        if (param(req, 'semua')) {
          if (!pemilik(req)) return kirim(res, 403, { galat: 'kunci' });
          return kirim(res, 200, { item: await daftar(TAYANG, MAKS_TAYANG), tunda: await daftar(TUNDA, MAKS_TUNDA) });
        }
        // galeri publik: disimpan sebentar di CDN Vercel — halaman awal tidak memanggil Blob tiap kunjungan
        return kirim(res, 200, { item: await daftar(TAYANG, MAKS_TAYANG) }, 'public, max-age=0, s-maxage=60, stale-while-revalidate=600');
      }
      if (req.method === 'DELETE') {
        if (!ID.test(id)) return kirim(res, 400, { galat: 'id' });
        const tok = String((req.headers || {})['x-hapus'] || ''), boss = pemilik(req);
        let dihapus = 0;
        for (const p of [TAYANG, TUNDA]) {
          const info = await ada(ambilBlob, p + id + '.json'); if (!info) continue;
          if (!boss) { const c = await bacaJSON(info.url); if (!c || !tok || !SHA.test(c.hapus || '') || !crypto.timingSafeEqual(Buffer.from(c.hapus, 'hex'), sidik(tok))) return kirim(res, 403, { galat: 'kunci' }); }
          await ambilBlob().del(info.url); dihapus++;
        }
        return dihapus ? kirim(res, 200, { ok: true }) : kirim(res, 404, { galat: 'tidak-ada' });
      }
      if (req.method !== 'POST') { res.setHeader('allow', 'GET, POST, DELETE'); return kirim(res, 405, { galat: 'metode' }); }
      if (param(req, 'setujui')) {
        if (!pemilik(req)) return kirim(res, 403, { galat: 'kunci' });
        if (!ID.test(id)) return kirim(res, 400, { galat: 'id' });
        const info = await ada(ambilBlob, TUNDA + id + '.json'); if (!info) return kirim(res, 404, { galat: 'tidak-ada' });
        const c = await bacaJSON(info.url); if (!c) return kirim(res, 404, { galat: 'tidak-ada' });
        if (!(await ada(ambilBlob, TAYANG + id + '.json'))) await ambilBlob().put(TAYANG + id + '.json', JSON.stringify(c), { access: 'public', addRandomSuffix: false, contentType: 'application/json', cacheControlMaxAge: 60 });
        await ambilBlob().del(info.url);
        return kirim(res, 200, { ok: true });
      }
      let badan;
      try { badan = JSON.parse((await bacaBadan(req)).toString('utf8')); } catch (e) { if (e.kode) throw e; return kirim(res, 400, { galat: 'json' }); }
      const tid = badan && typeof badan.id === 'string' ? badan.id : '';
      if (!ID.test(tid)) return kirim(res, 400, { galat: 'id' });
      if ((await ada(ambilBlob, TAYANG + tid + '.json')) || (await ada(ambilBlob, TUNDA + tid + '.json'))) return kirim(res, 409, { galat: 'sudah-terbit' });
      // judul, pesan & gambar dari isi tautan itu sendiri
      const tautan = await ada(ambilBlob, 'tautan/' + tid + '.bin'); if (!tautan) return kirim(res, 404, { galat: 'tautan-tidak-ada' });
      const r = await fetch(tautan.url); if (!r.ok) return kirim(res, 404, { galat: 'tautan-tidak-ada' });
      const isi = bukaIsi(Buffer.from(await r.arrayBuffer())); if (!isi) return kirim(res, 400, { galat: 'isi-tidak-sah' });
      const b = isi.bagikan && typeof isi.bagikan === 'object' ? isi.bagikan : {};
      let gambar = '';
      if (SHA.test(b.gambar || '')) { const g = await ada(ambilBlob, 'gambar/' + b.gambar + '.jpg'); if (g) gambar = g.url; }
      const boss = pemilik(req), tujuan = boss ? TAYANG : TUNDA;
      if (!boss) { const t = await ambilBlob().list({ prefix: TUNDA, limit: MAKS_TUNDA }); if ((t.blobs || []).length >= MAKS_TUNDA) return kirim(res, 429, { galat: 'antrean-penuh' }); }
      const hapus = crypto.randomBytes(18).toString('base64url');
      const c = { id: tid, judul: teks(b.judul, 80) || teks(isi.name, 80) || 'Adegan', pesan: teks(b.pesan, 200), oleh: teks(badan.oleh, 40), gambar, waktu: new Date().toISOString(), hapus: sidikHex(hapus) };
      await ambilBlob().put(tujuan + tid + '.json', JSON.stringify(c), { access: 'public', addRandomSuffix: false, contentType: 'application/json', cacheControlMaxAge: 60 });
      return kirim(res, 200, { status: boss ? 'tayang' : 'tunda', hapus });
    } catch (e) {
      if (!e.kode) console.error('api/galeri', e);
      return kirim(res, e.kode || 500, e.kode ? { galat: 'ukuran' } : { galat: 'server', kode: String((e && e.constructor && e.constructor.name) || 'Error').slice(0, 40) });
    }
  };
}
module.exports = buatHandler(() => require('@vercel/blob'));
module.exports.buatHandler = buatHandler;
