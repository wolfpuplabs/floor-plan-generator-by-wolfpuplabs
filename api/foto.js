/* Percantik foto dengan AI (JEV-139): tangkapan mode jalan → foto fotoreal, sudut kamera & tata letak tetap.
   Pemilik situs mengisi env Vercel (tidak pernah lewat peramban / obrolan), salah satu:
     GEMINI_API_KEY   kunci Google AI Studio (https://aistudio.google.com/apikey)   — dipakai lebih dulu bila ada
     GEMINI_IMAGE_MODEL   opsional, bawaan gemini-2.5-flash-image
     OPENAI_API_KEY   kunci OpenAI (https://platform.openai.com/api-keys)
     OPENAI_IMAGE_MODEL   opsional, bawaan gpt-image-1
     FOTO_KUNCI       opsional (≥ 12 karakter): bila diisi, hanya yang memegang kunci ini (kepala x-kunci-foto) yang boleh
                      memakai — tiap foto memakan kuota / biaya API pemilik situs
   - GET  /api/foto  → { ai, kunci }   (ai:false = belum diatur, tombol ✨ tidak tampil)
   - POST /api/foto  { gambar: data:image/jpeg;base64,… (≤ 2 MB), gaya }  → { gambar: data:image/…;base64,… }
   Bukan proksi gambar bebas: prompt disusun di server dari daftar gaya tetap (tanpa teks bebas dari peramban),
   isinya harus JPEG sungguhan, asal harus situs ini, ±5 permintaan / menit / IP per instans. */
const crypto = require('node:crypto');

const BATAS_MASUK = 2 * 1048576, BATAS_KELUAR = 4 * 1048576, BATAS_BADAN = 3 * 1048576, WAKTU = 55000;
const GAYA = {
  asli: 'Keep the lighting and time of day of the render.',
  siang: 'Bright natural daylight, clear sky, soft realistic shadows.',
  senja: 'Warm golden-hour sunset light, long soft shadows, glowing sky.',
  malam: 'Night scene, warm interior and exterior lamps glowing, deep blue sky.',
  mendung: 'Soft overcast daylight, diffuse light, gentle shadows.',
};
const prompt = gaya => 'Turn this real-time 3D render of a house / architectural walkthrough into a photorealistic photograph, ' +
  'as if shot with a full-frame camera. Keep EXACTLY the same camera angle, framing, room layout, walls, openings, furniture, ' +
  'objects and their positions, materials and colors. Make materials, textures, reflections, lighting and shadows realistic and ' +
  'remove render artifacts. ' + GAYA[gaya] + ' Any characters stay in the same pose and outfit and look like real people, ' +
  'family-friendly. Do not add or remove objects or people. No text, no logos, no watermark.';

const LAJU = new Map();
const lajuOk = (ip, now = Date.now()) => {
  const l = (LAJU.get(ip) || []).filter(t => now - t < 60000);
  if (l.length >= 5) { LAJU.set(ip, l); return false; }
  l.push(now); LAJU.set(ip, l); if (LAJU.size > 5000) LAJU.clear(); return true;
};
const asalOk = req => {
  const h = String((req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || ''), o = String((req.headers && (req.headers.origin || req.headers.referer)) || '');
  if (!o) return true;
  try { return new URL(o).host === h; } catch (e) { return false; }
};
const sidik = s => crypto.createHash('sha256').update(String(s)).digest();
const jpegSah = b => b.length > 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
// keluaran penyedia: hanya PNG / JPEG / WebP sungguhan yang diteruskan ke peramban
function gambarSah(b64) {
  if (typeof b64 !== 'string' || !b64 || b64.length > BATAS_KELUAR * 1.4) return null;
  const b = Buffer.from(b64, 'base64');
  if (b.length < 8 || b.length > BATAS_KELUAR) return null;
  const mime = b[0] === 0x89 && b.toString('latin1', 1, 4) === 'PNG' ? 'image/png' : jpegSah(b) ? 'image/jpeg'
    : b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP' ? 'image/webp' : '';
  return mime ? `data:${mime};base64,${b.toString('base64')}` : null;
}
async function bacaBadan(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  let teks;
  if (Buffer.isBuffer(req.body) || typeof req.body === 'string') teks = String(req.body);
  else {
    const bag = []; let n = 0;
    for await (const c of req) { n += c.length; if (n > BATAS_BADAN) { const e = new Error('ukuran'); e.kode = 413; throw e; } bag.push(c); }
    teks = Buffer.concat(bag).toString('utf8');
  }
  if (teks.length > BATAS_BADAN) { const e = new Error('ukuran'); e.kode = 413; throw e; }
  return JSON.parse(teks);
}

// galat penyedia: status + pesan singkatnya (mis. kuota / kunci / model) — tanpa kunci API, dipotong
async function galatPenyedia(r) {
  let pesan = '';
  try { const j = await r.json(); pesan = (j && j.error && (j.error.message || j.error.status)) || ''; } catch (e) { /* bukan JSON */ }
  const e = new Error('penyedia ' + r.status); e.penyedia = r.status;
  e.pesan = String(pesan).replace(/AIza[\w-]{20,}|sk-[\w-]{16,}/g, '…').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, 240);
  return e;
}
// model gambar Gemini berganti nama dari waktu ke waktu: yang diisi pemilik dulu, lalu cadangan bila model tidak ditemukan (404)
const MODEL_GEMINI = ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview', 'gemini-2.5-flash-image-preview', 'gemini-2.0-flash-preview-image-generation'];
async function tanyaGemini(jpg, gaya, env, ambil) {
  const pilihan = /^[\w.-]{1,80}$/.test(env.GEMINI_IMAGE_MODEL || '') ? [env.GEMINI_IMAGE_MODEL] : [];
  let galat = null;
  for (const model of [...new Set([...pilihan, ...MODEL_GEMINI])]) {
    const r = await ambil(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt(gaya) }, { inline_data: { mime_type: 'image/jpeg', data: jpg.toString('base64') } }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } }) });
    if (!r.ok) { galat = await galatPenyedia(r); galat.model = model; if (r.status === 404) continue; throw galat; }
    const j = await r.json(), bag = (j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
    const p = bag.find(x => x && (x.inlineData || x.inline_data)), d = p && (p.inlineData || p.inline_data);
    return d && d.data;
  }
  throw galat;
}
async function tanyaOpenAI(jpg, gaya, env, ambil) {
  const model = /^[\w.-]{1,80}$/.test(env.OPENAI_IMAGE_MODEL || '') ? env.OPENAI_IMAGE_MODEL : 'gpt-image-1';
  const f = new FormData();
  f.append('model', model); f.append('prompt', prompt(gaya)); f.append('size', 'auto'); f.append('quality', 'medium');
  f.append('image', new Blob([jpg], { type: 'image/jpeg' }), 'render.jpg');
  const r = await ambil('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { authorization: 'Bearer ' + env.OPENAI_API_KEY }, body: f });
  if (!r.ok) throw await galatPenyedia(r);
  const j = await r.json();
  return j && j.data && j.data[0] && j.data[0].b64_json;
}

function buatHandler(ambilEnv = () => process.env, ambil = (u, o) => fetch(u, o)) {
  return async function handler(req, res) {
    res.setHeader('cache-control', 'no-store'); res.setHeader('content-type', 'application/json; charset=utf-8'); res.setHeader('x-content-type-options', 'nosniff');
    const kirim = (s, o) => { res.statusCode = s; res.end(JSON.stringify(o)); };
    const env = ambilEnv(), penyedia = env.GEMINI_API_KEY ? 'gemini' : env.OPENAI_API_KEY ? 'openai' : '';
    const kunci = String(env.FOTO_KUNCI || ''), perluKunci = kunci.length >= 12;
    if (req.method === 'GET') return kirim(200, { ai: !!penyedia, kunci: !!penyedia && perluKunci });
    if (req.method !== 'POST') { res.setHeader('allow', 'GET, POST'); return kirim(405, { galat: 'metode' }); }
    if (!penyedia) return kirim(501, { galat: 'ai-belum-diatur' });
    if (!asalOk(req)) return kirim(403, { galat: 'asal' });
    if (perluKunci) { const h = String((req.headers || {})['x-kunci-foto'] || ''); if (!h || !crypto.timingSafeEqual(sidik(h), sidik(kunci))) return kirim(403, { galat: 'kunci' }); }
    const ip = String((req.headers && req.headers['x-forwarded-for']) || '').split(',')[0].trim() || 'x';
    if (!lajuOk(ip)) return kirim(429, { galat: 'terlalu-sering' });
    let b;
    try { b = await bacaBadan(req); } catch (e) { return kirim(e.kode || 400, { galat: e.kode ? 'ukuran' : 'json' }); }
    const gaya = b && typeof b.gaya === 'string' && Object.prototype.hasOwnProperty.call(GAYA, b.gaya) ? b.gaya : 'asli';
    const m = b && typeof b.gambar === 'string' && /^data:image\/jpeg;base64,([A-Za-z0-9+/]+=*)$/.exec(b.gambar);
    if (!m) return kirim(400, { galat: 'gambar' });
    const jpg = Buffer.from(m[1], 'base64');
    if (!jpegSah(jpg)) return kirim(400, { galat: 'bukan-jpeg' });
    if (jpg.length > BATAS_MASUK) return kirim(413, { galat: 'ukuran' });
    const henti = new AbortController(), t = setTimeout(() => henti.abort(), WAKTU);
    const ambilBatas = (u, o) => ambil(u, { ...o, signal: henti.signal });
    try {
      const keluar = gambarSah(await (penyedia === 'gemini' ? tanyaGemini : tanyaOpenAI)(jpg, gaya, env, ambilBatas));
      if (!keluar) return kirim(502, { galat: 'tanpa-gambar' });             // mis. ditolak saringan keamanan penyedia
      return kirim(200, { gambar: keluar, penyedia });
    } catch (e) {
      if (henti.signal.aborted) return kirim(504, { galat: 'waktu-habis' });
      // dicatat di log Vercel agar pemilik bisa melihat sebabnya (status & pesan penyedia, tanpa kunci)
      if (!e.penyedia) console.error('api/foto', e); else console.warn('api/foto', penyedia, e.model || '', e.penyedia, e.pesan || '');
      return kirim(502, { galat: 'penyedia', kode: e.penyedia || 0, pesan: e.pesan || '' });
    } finally { clearTimeout(t); }
  };
}
module.exports = buatHandler();
module.exports.buatHandler = buatHandler;
module.exports.prompt = prompt;
module.exports.GAYA = GAYA;
