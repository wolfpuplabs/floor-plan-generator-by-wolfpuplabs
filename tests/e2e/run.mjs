// Pelari tes e2e sederhana (tanpa framework): node tests/e2e/run.mjs [pola]
// Gagal bila ada assert gagal, galat halaman, atau pelanggaran CSP/SRI.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mulaiServer, luncurkan, bukaApp } from './harness.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const pola = process.argv[2] ? new RegExp(process.argv[2]) : null;
const berkas = fs.readdirSync(DIR).filter(f => f.endsWith('.test.mjs') && (!pola || pola.test(f))).sort();

const { srv, url } = await mulaiServer();
const browser = await luncurkan();
let gagal = 0;
for (const f of berkas) {
  const mod = await import(path.join(DIR, f));
  for (const [nama, fn] of Object.entries(mod.tes || {})) {
    const t0 = Date.now(); let ctx;
    try {
      ctx = await bukaApp(browser, url, fn.opsi || {});
      await fn(ctx.page, ctx);
      if (!fn.izinGalat && ctx.log.galat.length) throw new Error('galat halaman: ' + ctx.log.galat.join(' | '));
      if (ctx.log.csp.length) throw new Error('pelanggaran CSP/SRI: ' + ctx.log.csp.join(' | '));
      console.log(`  ✓ ${f} › ${nama} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    } catch (e) {
      gagal++;
      console.log(`  ✗ ${f} › ${nama}\n      ${String(e && e.stack || e).split('\n').slice(0, 4).join('\n      ')}`);
    } finally { if (ctx) await ctx.page.close().catch(() => {}); }
  }
}
await browser.close(); srv.close();
console.log(gagal ? `\n${gagal} tes GAGAL` : '\nSemua tes lolos');
process.exit(gagal ? 1 : 0);
