import assert from 'node:assert/strict';
import { bukaApp } from './harness.mjs';

// JEV-073: editor di HP — panel samping bisa ditutup (tombol X & ketuk di luar panel), toolbar
// satu baris, petunjuk tidak menimpa tombol tampak, panel di HP miring tidak terjepit
const kotak = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); if (!e || e.hidden || getComputedStyle(e).display === 'none') return null;
  const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; }, sel);
const buka = async (browser, url, viewport) => {
  const { page, log } = await bukaApp(browser, url, { viewport, bahasa: 'en' });
  await page.evaluate(() => { const k = document.querySelector('.mulai-tutup'); if (k) k.click(); setSidebar(false); });
  return { page, log };
};
const panelTerbuka = page => page.evaluate(() => !document.getElementById('app').classList.contains('nosidebar'));

export const tes = {
  'HP tegak: panel bisa ditutup lewat X & ketuk di luar; toolbar satu baris; petunjuk di atas tombol tampak': async (page) => {
    const url = page.url(), browser = page.context().browser();
    const { page: p, log } = await buka(browser, url, { width: 390, height: 664 });
    try {
      const [tb, lv, hint, vb] = await Promise.all(['#toolbar', '#levelbar', '#hint', '#viewbar'].map(s => kotak(p, s)));
      assert.ok(tb.b - tb.t < 72, 'toolbar satu baris: tinggi ' + (tb.b - tb.t));
      assert.ok(tb.r <= lv.l, 'toolbar tidak menimpa pemilih lantai');
      assert.ok(hint.b <= vb.t, 'petunjuk di atas tombol tampak: ' + JSON.stringify({ hint, vb }));
      await p.evaluate(() => document.getElementById('sideBtn').click());
      assert.equal(await panelTerbuka(p), true);
      assert.ok(await kotak(p, '#sideTutup'), 'tombol tutup tampil di HP');
      await p.evaluate(() => document.getElementById('sideTutup').click());
      assert.equal(await panelTerbuka(p), false, 'X menutup panel');
      await p.evaluate(() => document.getElementById('sideBtn').click());
      await p.mouse.click(375, 330);                                   // ketuk viewport di samping panel
      assert.equal(await panelTerbuka(p), false, 'ketuk di luar panel menutupnya');
      assert.deepEqual(log.galat, []);
    } finally { await p.close(); }
  },
  'HP miring: kepala panel ringkas, tombol utama tidak menjepit isi panel': async (page) => {
    const { page: p } = await buka(page.context().browser(), page.url(), { width: 844, height: 340 });
    try {
      await p.evaluate(() => setSidebar(true));
      const r = await p.evaluate(() => ({ sub: getComputedStyle(document.querySelector('#sidebar header p')).display,
        cta: [...document.querySelectorAll('.cta-lekat')].map(e => getComputedStyle(e).position),
        tab: document.querySelector('.tabs').getBoundingClientRect().bottom }));
      assert.equal(r.sub, 'none');
      assert.ok(r.cta.length && r.cta.every(x => x === 'static'), JSON.stringify(r.cta));
      assert.ok(r.tab < 120, 'tab berakhir di atas 120 px: ' + r.tab);
    } finally { await p.close(); }
  },
  'layar lebar: tanpa tombol tutup & tirai (panel tidak menutupi viewport)': async (page) => {
    await page.evaluate(() => setSidebar(true));
    assert.equal(await kotak(page, '#sideTutup'), null);
    assert.equal(await kotak(page, '#sideTirai'), null);
  },
};
