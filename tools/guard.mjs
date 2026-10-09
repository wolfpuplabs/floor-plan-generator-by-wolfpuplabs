// Guardrail statis untuk index.html + repo. Dijalankan di CI dan sebelum merge.
// Tiap pemeriksaan punya kode (G-…) yang dirujuk di docs/AUDIT.md & docs/SDLC.md.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.join(DIR, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(DIR, 'guard-config.json'), 'utf8'));
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
// modul yang dimuat belakangan (modul/*.js) ikut diperiksa host, CDN, sink & eval — kecuali anggaran ukuran index.html
const modul = fs.existsSync(path.join(ROOT, 'modul')) ? fs.readdirSync(path.join(ROOT, 'modul')).filter(f => /\.js$/.test(f)).sort() : [];
const kodeModul = modul.map(f => fs.readFileSync(path.join(ROOT, 'modul', f), 'utf8'));
const semuaKode = [html, ...kodeModul].join('\n');
const hasil = [];
const cek = (kode, lolos, pesan) => hasil.push({ kode, lolos: !!lolos, pesan });

// G-SRI: semua <script src=http…> wajib integrity + crossorigin + versi terkunci
const skrip = [...html.matchAll(/<script\b[^>]*\bsrc="(https?:[^"]+)"[^>]*>/g)];
const tanpaSRI = skrip.filter(m => !/\bintegrity="sha(256|384|512)-/.test(m[0]) || !/\bcrossorigin=/.test(m[0]));
cek('G-SRI', !tanpaSRI.length, tanpaSRI.length ? 'tanpa SRI: ' + tanpaSRI.map(m => m[1]).join(', ') : `${skrip.length} skrip luar terkunci SRI`);
const takTerkunci = [...semuaKode.matchAll(/https:\/\/cdn\.jsdelivr\.net\/npm\/((?:@[^/@]+\/)?[^/@"']+)(@[^/"']*)?/g)].filter(m => !/^@\d+\.\d+\.\d+$/.test(m[2] || ''));
const modulTanpaSRI = modul.filter((f, i) => /cdn\.jsdelivr\.net/.test(kodeModul[i]) && !/sha(256|384|512)-[A-Za-z0-9+/=]{40,}/.test(kodeModul[i]));
cek('G-SRI-MODUL', !modulTanpaSRI.length, modulTanpaSRI.length ? 'modul memuat CDN tanpa SRI: ' + modulTanpaSRI.join(', ') : `${modul.length} modul diperiksa`);
cek('G-PIN', !takTerkunci.length, takTerkunci.length ? 'versi tidak dikunci: ' + takTerkunci.map(m => m[0]).join(', ') : 'semua paket CDN terkunci versi x.y.z');

// G-CSP: kebijakan ada & tidak dilonggarkan
const csp = (html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/) || [])[1] || '';
const cspSalah = [];
if (!csp) cspSalah.push('meta CSP hilang');
for (const w of ["object-src 'none'", "base-uri 'none'", "form-action 'none'"]) if (!csp.includes(w)) cspSalah.push('kurang ' + w);
if (/'unsafe-eval'/.test(csp)) cspSalah.push("'unsafe-eval' dilarang (pakai 'wasm-unsafe-eval' bila perlu WASM)");
if (/script-src[^;]*\s(https:|\*)(\s|;|$)/.test(csp)) cspSalah.push('script-src terlalu luas');
cek('G-CSP', !cspSalah.length, cspSalah.join('; ') || 'CSP utuh');

// G-HOST: host luar hanya dari daftar izin (keputusan privasi/hukum tercatat)
const host = new Set([...semuaKode.matchAll(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)].map(m => m[1].toLowerCase()));
const asing = [...host].filter(h => !cfg.hostDiizinkan[h] && !/\.example$/.test(h));
cek('G-HOST', !asing.length, asing.length ? 'host belum disetujui: ' + asing.join(', ') : `${host.size} host, semua di daftar izin`);

// G-SINK: interpolasi ke innerHTML yang memuat data tak tepercaya wajib lewat esc()
const rx = new RegExp(cfg.identitasTakTepercaya);
const sink = [], semua = [];
// satu pernyataan penuh (bisa multi-baris) sejak innerHTML= / insertAdjacentHTML( sampai ';' di akhir baris
for (const [nama, teks] of [['index.html', html], ...modul.map((f, i) => ['modul/' + f, kodeModul[i]])])
for (const st of teks.matchAll(/(?:innerHTML\s*\+?=|insertAdjacentHTML\s*\()([\s\S]*?);[ \t]*(?:\/\/[^\n]*)?\n/g)) {
  const baris = (nama === 'index.html' ? '' : nama + ' ') + teks.slice(0, st.index).split('\n').length;
  for (const m of st[1].matchAll(/\$\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g)) {
    semua.push(baris);
    if (rx.test(m[1]) && !/^\s*(esc|fmt|ikonObjek)\(/.test(m[1])) sink.push(`baris ${baris}: \${${m[1].slice(0, 60)}}`);
  }
}
cek('G-SINK', !sink.length, sink.length ? 'tanpa esc(): ' + sink.join(' · ') : 'tidak ada interpolasi data tak tepercaya tanpa esc()');
cek('G-SINK-RATCHET', semua.length <= cfg.anggaran.innerHTMLInterpolasi, `${semua.length} interpolasi innerHTML (batas ${cfg.anggaran.innerHTMLInterpolasi}) — utamakan textContent/el()`);

// G-EVAL: tidak ada eksekusi kode dari teks
const evalB = semuaKode.split('\n').map((b, i) => [b, i + 1]).filter(([b]) => /\beval\s*\(|new Function\s*\(|set(Timeout|Interval)\s*\(\s*['"`]/.test(b));
cek('G-EVAL', !evalB.length, evalB.length ? 'baris ' + evalB.map(x => x[1]).join(', ') : 'tidak ada eval/new Function');

// G-RAHASIA: tidak ada kunci/token di berkas yang dilacak git
const pola = [/AKIA[0-9A-Z]{16}/, /gh[pousr]_[A-Za-z0-9]{36}/, /github_pat_[A-Za-z0-9_]{40,}/, /\bsk-[A-Za-z0-9]{32,}/, /\bhf_[A-Za-z0-9]{30,}/,
  /xox[baprs]-[A-Za-z0-9-]{10,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /AIza[0-9A-Za-z_-]{35}/];
let berkas = [];
try { berkas = execSync('git ls-files', { cwd: ROOT }).toString().split('\n').filter(f => f && !/\.(png|jpe?g|webp|hdr|bin|glb)$/i.test(f) && !/package-lock\.json$/.test(f)); } catch (e) { berkas = ['index.html']; }
const bocor = [];
for (const f of berkas) { let t; try { t = fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (e) { continue; } for (const p of pola) if (p.test(t)) bocor.push(`${f} (${p.source.slice(0, 14)}…)`); }
cek('G-RAHASIA', !bocor.length, bocor.length ? 'kemungkinan rahasia: ' + bocor.join(', ') : `${berkas.length} berkas bersih`);

// G-UKURAN: anggaran unduhan halaman (iPad di jaringan seluler)
const kb = Buffer.byteLength(html) / 1024;
cek('G-UKURAN', kb <= cfg.anggaran.indexHtmlKB, `index.html ${kb.toFixed(0)} KB (anggaran ${cfg.anggaran.indexHtmlKB} KB)`);

// G-PENJAGA: pertahanan di kode tidak boleh hilang diam-diam
const wajib = { 'esc()': /const esc=v=>/, 'sanitasiProyek': /function sanitasiProyek\(/, 'uriLuarGLTF': /function uriLuarGLTF\(/, 'penangkap galat': /addEventListener\('unhandledrejection'/ };
const hilang = Object.entries(wajib).filter(([, r]) => !r.test(html)).map(([k]) => k);
cek('G-PENJAGA', !hilang.length, hilang.length ? 'pertahanan hilang: ' + hilang.join(', ') : 'G1–G3, G6 ada');

for (const h of hasil) console.log(`${h.lolos ? '✓' : '✗'} ${h.kode.padEnd(15)} ${h.pesan}`);
const gagal = hasil.filter(h => !h.lolos).length;
console.log(gagal ? `\n${gagal} guardrail GAGAL` : '\nSemua guardrail lolos');
process.exit(gagal ? 1 : 0);
