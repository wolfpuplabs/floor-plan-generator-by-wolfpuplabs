/* Server TURN opsional untuk "main bareng" (JEV-077).
   WebRTC antar-peramban cukup memakai STUN di kebanyakan jaringan, tetapi sebagian jaringan
   seluler/kantor (NAT simetris) butuh relai TURN. Pemilik situs boleh mengisi env Vercel:
     TURN_URLS        daftar dipisah koma, mis. "turn:turn.contoh.id:3478,turns:turn.contoh.id:5349"
     TURN_USERNAME    nama pengguna TURN
     TURN_CREDENTIAL  sandi TURN
   - GET /api/ice  →  { iceServers: [{ urls, username, credential }] }
     Env kosong → 200 { iceServers: [] } (bukan galat: peramban cukup memakai STUN, dan konsol
     pengunjung tidak penuh tulisan merah "501").
   Kredensial TURN memang harus sampai ke peramban agar bisa dipakai; pakai kredensial
   terbatas (kuota/berumur pendek dari penyedia TURN), bukan sandi akun. */
const URL_TURN = /^turns?:[A-Za-z0-9.-]+(:\d{1,5})?(\?transport=(udp|tcp))?$/;

function iceDariEnv(env) {
  const urls = String(env.TURN_URLS || '').split(',').map(s => s.trim()).filter(s => URL_TURN.test(s)).slice(0, 4);
  if (!urls.length) return null;
  const u = String(env.TURN_USERNAME || '').slice(0, 200), c = String(env.TURN_CREDENTIAL || '').slice(0, 200);
  return urls.map(x => ({ urls: x, ...(u ? { username: u } : {}), ...(c ? { credential: c } : {}) }));
}

module.exports = (req, res) => {
  res.setHeader('cache-control', 'no-store');
  res.setHeader('content-type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') { res.statusCode = 405; res.setHeader('allow', 'GET'); return res.end('{"galat":"metode"}'); }
  const s = iceDariEnv(process.env);
  res.statusCode = 200;
  res.end(JSON.stringify({ iceServers: s || [], turn: !!s }));
};
module.exports.iceDariEnv = iceDariEnv;
