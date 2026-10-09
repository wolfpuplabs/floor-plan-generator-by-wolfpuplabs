// Lint skrip utama index.html dengan ESLint. Galat = gagal. Peringatan memakai
// RATCHET: jumlahnya tidak boleh naik dari baseline.json (hanya boleh turun —
// turunkan angkanya di baseline.json saat Anda membereskan utang).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(DIR, '../index.html'), 'utf8');
const m = html.match(/<script>\n([\s\S]*?)\n<\/script>/);
if (!m) { console.error('skrip utama tidak ditemukan'); process.exit(1); }
const baris0 = html.slice(0, m.index).split('\n').length;            // agar nomor baris = baris di index.html
const kode = '\n'.repeat(baris0) + m[1];

const eslint = new ESLint({ useEslintrc: false, overrideConfig: JSON.parse(fs.readFileSync(path.join(DIR, 'eslint.json'), 'utf8')) });
const [hasil] = await eslint.lintText(kode, { filePath: 'index.html.js' });
const galat = hasil.messages.filter(x => x.severity === 2), warn = hasil.messages.filter(x => x.severity === 1);
const tulis = x => `  index.html:${x.line}:${x.column}  ${x.ruleId || 'parse'}  ${x.message}`;
const base = JSON.parse(fs.readFileSync(path.join(DIR, 'baseline.json'), 'utf8'));

if (galat.length) console.log('GALAT:\n' + galat.map(tulis).join('\n'));
const perAturan = {};
for (const x of warn) perAturan[x.ruleId] = (perAturan[x.ruleId] || 0) + 1;
console.log(`ESLint: ${galat.length} galat, ${warn.length} peringatan (baseline ${base.eslintPeringatan})`, perAturan);
if (process.argv.includes('--rinci')) console.log(warn.map(tulis).join('\n'));
let gagal = galat.length > 0;
// modul/*.js (dimuat belakangan): aturan yang sama, tanpa utang — 0 peringatan
const dirModul = path.join(DIR, '../modul');
for (const f of fs.existsSync(dirModul) ? fs.readdirSync(dirModul).filter(x => /\.js$/.test(x)).sort() : []) {
  const [h] = await eslint.lintText(fs.readFileSync(path.join(dirModul, f), 'utf8'), { filePath: 'modul/' + f });
  const t = x => `  modul/${f}:${x.line}:${x.column}  ${x.ruleId || 'parse'}  ${x.message}`;
  console.log(`ESLint modul/${f}: ${h.messages.length} temuan`);
  if (h.messages.length) { gagal = true; console.log(h.messages.map(t).join('\n')); }
}
if (warn.length > base.eslintPeringatan) { gagal = true; console.log(`Peringatan naik ${base.eslintPeringatan} → ${warn.length}. Perbaiki yang baru (jalankan: node lint.mjs --rinci).`); }
else if (warn.length < base.eslintPeringatan) console.log(`Bagus — turun ${base.eslintPeringatan - warn.length}. Perbarui baseline.json → ${warn.length} agar tidak naik lagi.`);
process.exit(gagal ? 1 : 0);
