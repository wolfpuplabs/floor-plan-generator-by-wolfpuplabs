import assert from 'node:assert/strict';

// JEV-071: merek "Plan23D" dengan ikon denah sebagai logo; di layar penuh bilah jalan turun agar
// tombol ciut tidak tertutup tombol X keluar-layar-penuh milik Chrome (iPad/Android)
const kotak = (page, sel) => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return { top: r.top, left: r.left, bottom: r.bottom }; });

export const tes = {
  'merek: "Plan23D" dengan logo ikon denah, judul halaman ikut': async (page) => {
    const m = await page.evaluate(() => { const h = document.querySelector('#sidebar h1');
      return { teks: h.textContent.trim(), logo: h.querySelector('svg.logo use') && h.querySelector('svg.logo use').getAttribute('href'), judul: document.title }; });
    assert.deepEqual({ teks: m.teks, logo: m.logo }, { teks: 'Plan23D', logo: '#i-denah' });
    assert.match(m.judul, /^Plan23D — /);
  },
  'layar penuh: bilah jalan turun di bawah tombol X peramban, label tombol berganti': async (page) => {
    await page.evaluate(() => {
      PROJECT.levels[0].walls = [[0, 0, 6, 0], [6, 0, 6, 5], [6, 5, 0, 5], [0, 5, 0, 0]].map(([a, b, c, d]) => ({ id: uid('w'), x1: a, z1: b, x2: c, z2: d, thickness: 0.15, openings: [] }));
      rebuildScene(); enterFPS(); ciutkanFps(false);
    });
    const biasa = await kotak(page, '#fpsCiut');
    // tiru peramban yang sedang layar penuh
    await page.evaluate(() => { Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => document.documentElement });
      document.dispatchEvent(new Event('fullscreenchange')); });
    const penuh = await kotak(page, '#fpsCiut');
    assert.ok(penuh.top >= 56, `tombol ciut harus di bawah zona tombol X (top ${penuh.top})`);
    assert.ok(penuh.top > biasa.top + 40);
    assert.match(await page.textContent('#fpsFull'), /Keluar layar penuh/);
    await page.evaluate(() => { delete document.fullscreenElement; document.dispatchEvent(new Event('fullscreenchange')); exitFPS(); });
    assert.equal(await page.evaluate(() => document.body.classList.contains('layar-penuh')), false);
  },
};
