/* Halaman pratinjau tautan lihat-saja (JEV-087).
   Tautan pendek …/#l=<id> menyimpan id di fragmen URL yang TIDAK pernah dikirim ke server, jadi
   WhatsApp/iMessage/Telegram hanya melihat halaman editor biasa. Tautan bagikan kini …/l/<id>
   (vercel.json → /api/lihat?id=<id>): fungsi ini membaca judul, pesan & gambar pratinjau yang
   dipilih pengirim dari isi tautan itu sendiri, menulis tag Open Graph, lalu langsung meneruskan
   orang ke /#l=<id> (meta refresh — tanpa skrip). Undangan lobi: …/l/<id>?r=<ruang>.
   Isi tautan = masukan tak tepercaya: semua teks di-escape & dipotong, gambar hanya lewat sidik
   SHA-256 yang dicari di Blob (bukan URL dari isi tautan), id & ruang dicocokkan pola. */
const { ID, SHA, bukaIsi, ada } = require('./tautan.js');

const RUANG = /^p23d-(?:[le][2-9a]-[0-9a-f]{16}|[a-z0-9]{12})$/;
const HOST = /^[a-z0-9.-]{1,253}(?::\d{1,5})?$/i;
const TEKS = {
  id: { judul: 'Rumah 3D', pesan: 'Jalan-jalan di dalam rumah ini — denah 3D interaktif, langsung di peramban HP.', buka: 'Buka di Plan23D' },
  en: { judul: '3D house', pesan: 'Take a walk inside this house — an interactive 3D floor plan that opens right in your phone browser.', buka: 'Open in Plan23D' },
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// teks dari isi tautan: satu baris, tanpa karakter kendali, dipotong
const teks = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n) : '');
const param = (req, k) => String((req.query && req.query[k]) || new URL(req.url, 'http://x').searchParams.get(k) || '');

function halaman({ judul, pesan, gambar, url, tujuan, buka }) {
  return `<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(judul)} — Plan23D</title>
<meta name="description" content="${esc(pesan)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Plan23D">
<meta property="og:title" content="${esc(judul)}">
<meta property="og:description" content="${esc(pesan)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(gambar)}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#101014">
<link rel="icon" href="/ikon/ikon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/ikon/apple-touch-icon.png">
<meta http-equiv="refresh" content="0;url=${esc(tujuan)}">
</head><body style="background:#101014;color:#ececf1;font:16px -apple-system,Roboto,sans-serif;display:grid;place-items:center;min-height:90vh">
<p><a style="color:#4ec9b0" href="${esc(tujuan)}">${esc(buka)}: ${esc(judul)}</a></p>
</body></html>`;
}

function buatHandler(ambilBlob, siap = () => !!process.env.BLOB_READ_WRITE_TOKEN) {
  return async function handler(req, res) {
    const id = param(req, 'id'), r = param(req, 'r');
    res.setHeader('x-content-type-options', 'nosniff');
    if (!ID.test(id)) { res.statusCode = 302; res.setHeader('location', '/'); return res.end(); }
    const tujuan = '/#l=' + id + (RUANG.test(r) ? '&r=' + r : '');
    const h = req.headers || {}, host = String(h['x-forwarded-host'] || h.host || '').split(',')[0].trim();
    const asal = HOST.test(host) ? (String(h['x-forwarded-proto'] || 'https').split(',')[0].trim() === 'http' ? 'http://' : 'https://') + host : '';
    let isi = null, foto = '';
    if (siap()) {
      try {
        const info = await ada(ambilBlob, 'tautan/' + id + '.bin');
        const rs = info && await fetch(info.url);
        if (rs && rs.ok) isi = bukaIsi(Buffer.from(await rs.arrayBuffer()));
        const g = isi && isi.bagikan && isi.bagikan.gambar;
        if (typeof g === 'string' && SHA.test(g)) { const gi = await ada(ambilBlob, 'gambar/' + g + '.jpg'); if (gi && /^https:\/\//.test(gi.url)) foto = gi.url; }
      } catch (e) { console.error('api/lihat', e); isi = null; }
    }
    const b = (isi && isi.bagikan && typeof isi.bagikan === 'object') ? isi.bagikan : {};
    const T = TEKS[b.bahasa === 'id' ? 'id' : 'en'];
    const judul = teks(b.judul, 80) || teks(isi && isi.name, 80) || T.judul;
    const pesan = teks(b.pesan, 200) || T.pesan;
    res.statusCode = 200;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.setHeader('content-security-policy', "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'");
    res.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
    // isi tautan tidak pernah berubah: kartu bisa disimpan lama di CDN; tautan tak ditemukan hanya sebentar
    res.setHeader('cache-control', isi ? 'public, max-age=300, s-maxage=31536000' : 'public, max-age=60');
    return res.end(halaman({ judul, pesan, gambar: foto || asal + '/ikon/sampul.jpg', url: asal + '/l/' + id + (RUANG.test(r) ? '?r=' + r : ''), tujuan, buka: T.buka }));
  };
}
module.exports = buatHandler(() => require('@vercel/blob'));
module.exports.buatHandler = buatHandler;
module.exports.halaman = halaman;
