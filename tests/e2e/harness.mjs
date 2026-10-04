// Harness e2e: menyajikan index.html dari repo, mengarahkan CDN jsDelivr ke
// node_modules (byte identik dengan npm → SRI ikut teruji), dan mencatat galat
// halaman serta pelanggaran CSP/SRI. Satu halaman segar per tes.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const FIX = path.join(ROOT, 'tests/fixtures');
const NM = path.join(ROOT, 'tools/node_modules');
const require = createRequire(path.join(ROOT, 'tools/package.json'));
const { chromium } = require('playwright');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png',
  '.webp': 'image/webp', '.json': 'application/json', '.jpg': 'image/jpeg' };

export async function mulaiServer() {
  const srv = http.createServer((q, r) => {
    let p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
    if (p === '/') p = '/index.html';
    const f = path.normalize(path.join(ROOT, p));
    if (!f.startsWith(ROOT + path.sep) || /node_modules/.test(f) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(r);
  });
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
  return { srv, url: `http://127.0.0.1:${srv.address().port}/index.html` };
}

export function luncurkan() {
  // CHROMIUM_PATH: pakai Chromium yang sudah terpasang (mis. sandbox tanpa unduhan browser)
  return chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
}

export const CORS = { 'access-control-allow-origin': '*' };

export async function bukaApp(browser, url, opsi = {}) {
  const page = await browser.newPage({ viewport: opsi.viewport || { width: 1366, height: 1024 } });
  const log = { galat: [], csp: [] };
  page.on('pageerror', e => log.galat.push(e.message));
  page.on('console', m => { const t = m.text(); if (/Content Security Policy|Refused to|integrity/i.test(t)) log.csp.push(t); });
  await page.route('https://cdn.jsdelivr.net/npm/**', r => {
    const u = new URL(r.request().url());
    const m = u.pathname.match(/^\/npm\/((?:@[^/]+\/)?[^@/]+)@[^/]+\/(.*)$/);
    const f = m && path.join(NM, m[1], m[2]);
    if (f && fs.existsSync(f)) return r.fulfill({ body: fs.readFileSync(f), headers: { ...CORS, 'content-type': 'text/javascript' } });
    return r.abort();
  });
  // tes ditulis dengan teks UI bahasa Indonesia; bahasa bawaan aplikasi Inggris (JEV-061).
  // opsi.bahasa: 'en' / 'id' (bawaan 'id'), null = tanpa pilihan tersimpan (bawaan aplikasi)
  if (opsi.bahasa !== null) await page.addInitScript(b => { try { if (!localStorage.getItem('bahasa')) localStorage.setItem('bahasa', b); } catch (e) { /* abaikan */ } }, opsi.bahasa || 'id');
  if (opsi.rute) await opsi.rute(page);
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__siap, undefined, { timeout: 120000 });
  return { page, log };
}

// denah contoh → dinding; dipakai beberapa tes
export async function buatDenah(page) {
  await page.setInputFiles('#upload', path.join(FIX, 'plan_test.png'));
  await page.waitForTimeout(1500);
  await page.click('#generateBtn');
  await page.waitForFunction(() => L().walls.length > 0, undefined, { timeout: 60000 });
}

// menunggu sampai pemuatan benar-benar selesai (berhasil atau gagal) — bukan tidur buta
export async function muatProyekJSON(page, obj) {
  await page.evaluate(() => { document.getElementById('toast').textContent = ''; });
  await page.locator('#loadInput').setInputFiles({ name: 'proyek.json', mimeType: 'application/json', buffer: Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj)) });
  await page.waitForFunction(() => /Proyek dimuat|Gagal memuat/.test(document.getElementById('toast').textContent), undefined, { timeout: 60000 });
  return page.evaluate(() => document.getElementById('toast').textContent);
}
