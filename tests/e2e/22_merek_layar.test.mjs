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
  'tata letak mode jalan: Keluar di kiri bilah, tombol sembunyikan di kanan; pemutar media di tengah bawah; --bilah-atas = tepi bawah bilah': async (page) => {
    const r = await page.evaluate(async () => {
      enterFPS(); ciutkanFps(false); const d = $('#mediaDock'); d.hidden = false; $('#mediaAudio').hidden = false;
      await new Promise(r => setTimeout(r, 300));
      const bar = $('#fpsbar'), anak = [...bar.children].filter(e => e.offsetParent), m = d.getBoundingClientRect(), b = bar.getBoundingClientRect();
      const out = { awal: anak[0].id, akhir: anak[anak.length - 1].id, tengah: Math.abs(m.left + m.width / 2 - innerWidth / 2) < 2, bawah: m.bottom > innerHeight * 0.7,
        atas: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--bilah-atas')) === Math.ceil(b.bottom) };
      ciutkanFps(true); await new Promise(r => setTimeout(r, 300));
      out.ciut = [...bar.children].filter(e => e.offsetParent).map(e => e.id);
      out.atasCiut = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--bilah-atas')) === Math.ceil(bar.getBoundingClientRect().bottom);
      d.hidden = true; ciutkanFps(false); exitFPS(); return out;
    });
    assert.deepEqual(r, { awal: 'fpsExit', akhir: 'fpsCiut', tengah: true, bawah: true, atas: true, ciut: ['fpsExit', 'fpsFoto', 'fpsCiut'], atasCiut: true });
  },
  'foto mode jalan: tombol kamera menyimpan JPEG tampilan sekarang (diunduh di desktop), kilat & nama berwaktu': async (page) => {
    await page.evaluate(() => { PROJECT.levels[0].walls = [[0, 0, 5, 0], [5, 0, 5, 4], [5, 4, 0, 4], [0, 4, 0, 0]].map(([a, b, c, d]) => ({ id: uid('w'), x1: a, z1: b, x2: c, z2: d, thickness: 0.15, openings: [] })); rebuildScene(); enterFPS(); });
    await page.waitForTimeout(500);
    const [unduh] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => document.getElementById('fpsFoto').click())]);
    assert.match(unduh.suggestedFilename(), /^Plan23D-\d{8}-\d{6}\.jpg$/);
    const buf = Buffer.from(await (await unduh.createReadStream()).toArray().then(b => Buffer.concat(b)));
    assert.deepEqual([buf[0], buf[1], buf.length > 5000], [0xff, 0xd8, true]);
    assert.equal(await page.evaluate(() => !!document.getElementById('kilat')), true, 'efek kilat');
    const r = await page.evaluate(() => { const r = fotoJalan(), o = [r.lebar === renderer.domElement.width, r.tinggi === renderer.domElement.height, r.bagikan]; exitFPS(); return o; });
    assert.deepEqual(r, [true, true, false]);
  },
};
