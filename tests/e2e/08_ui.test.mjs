import assert from 'node:assert/strict';

// JEV-057: UI ramah pengguna — kartu Mulai + rumah contoh, tab berikon (Tampilan terpisah),
// toolbar berlabel dengan menu ⋯ Lainnya, pencarian furnitur, target sentuh ≥ 44 px
const iPad = { viewport: { width: 1180, height: 820 } };

export const tes = {
  'mulai: kartu pada proyek kosong → rumah contoh dimuat & bisa langsung dijelajahi': async (page) => {
    assert.equal(await page.isVisible('#mulaiKartu'), true, 'kartu Mulai harus tampil pada proyek kosong');
    await page.evaluate(() => { document.getElementById('toast').textContent = ''; });
    await page.click('#mulaiContoh');
    await page.waitForFunction(() => /Proyek dimuat: Rumah contoh/.test(document.getElementById('toast').textContent));
    const r = await page.evaluate(() => ({ dinding: L().walls.length, bukaan: L().walls.reduce((s, w) => s + w.openings.length, 0),
      objek: L().objects.length, ruang: (() => { const P = petaRuang(L()); return new Set([...P.lab].filter(v => v > 0 && !P.bocor[v])).size; })() }));
    assert.ok(r.dinding >= 7 && r.bukaan >= 9 && r.objek >= 15, JSON.stringify(r));
    assert.ok(r.ruang >= 3, 'rumah contoh: kamar tidur, kamar mandi, ruang keluarga + dapur: ' + JSON.stringify(r));
    assert.equal(await page.isVisible('#mulaiKartu'), false, 'kartu Mulai harus hilang setelah proyek terisi');
    // kosongkan lagi → kartu kembali; ditutup → tetap tertutup
    await page.evaluate(() => { PROJECT.levels.forEach(lv => { lv.walls = []; lv.objects = []; }); rebuildScene(); });
    assert.equal(await page.isVisible('#mulaiKartu'), true);
    await page.click('#mulaiTutup');
    await page.evaluate(() => rebuildScene());
    assert.equal(await page.isVisible('#mulaiKartu'), false);
  },
  'navigasi: 5 tab berikon, render & material di tab Tampilan, CTA terlihat tanpa menggulir': async (page) => {
    const tab = await page.$$eval('.tabs button', bs => bs.map(b => [b.dataset.tab, b.textContent.trim(), Math.round(b.getBoundingClientRect().height)]));
    assert.deepEqual(tab.map(t => t[0]), ['plan', 'levels', 'objects', 'tampilan', 'file']);
    assert.ok(tab.every(t => t[2] >= 44), 'tab harus ≥ 44 px: ' + JSON.stringify(tab));
    const di = await page.evaluate(() => ['rq', 'mood', 'langitMode', 'finIn', 'otherLevels'].map(id => document.getElementById(id).closest('.tab-body').dataset.panel));
    assert.deepEqual(di, ['tampilan', 'tampilan', 'tampilan', 'tampilan', 'tampilan']);
    await page.click('.tabs button[data-tab="tampilan"]');
    assert.equal(await page.isVisible('#rq'), true);
    assert.equal(await page.getAttribute('.tabs button[data-tab="tampilan"]', 'aria-selected'), 'true');
    await page.click('.tabs button[data-tab="plan"]');
    const cta = await page.$eval('#generateBtn', b => { const r = b.getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0 && r.height >= 44; });
    assert.equal(cta, true, 'tombol Buat dinding 3D harus terlihat tanpa menggulir');
  },
  'toolbar: semua alat berlabel & ≥ 44 px dalam satu baris di iPad, menu ⋯ Lainnya': async (page) => {
    const tb = await page.$$eval('#toolbar button', bs => bs.map(b => { const r = b.getBoundingClientRect(), lb = b.querySelector('.lb');
      return { id: b.id || b.dataset.tool, h: r.height, w: r.width, top: Math.round(r.top), label: lb && getComputedStyle(lb).display !== 'none' ? lb.textContent : '' }; }));
    assert.ok(tb.every(b => b.label), 'tombol tanpa label: ' + tb.filter(b => !b.label).map(b => b.id));
    assert.ok(tb.every(b => b.h >= 44 && b.w >= 44), 'tombol terlalu kecil: ' + JSON.stringify(tb.filter(b => b.h < 44 || b.w < 44)));
    assert.equal(new Set(tb.map(b => b.top)).size, 1, 'toolbar harus satu baris di iPad dengan panel terbuka');
    // menu: buka, pilih alat ukur → aktif & menu menutup; Esc & ketuk di luar menutup
    await page.click('#toolMore');
    assert.equal(await page.isVisible('#toolMenu'), true);
    assert.equal(await page.getAttribute('#toolMore', 'aria-expanded'), 'true');
    await page.click('#toolMenu button[data-tool="measure"]');
    assert.equal(await page.isVisible('#toolMenu'), false);
    assert.equal(await page.evaluate(() => TOOL), 'measure');
    assert.equal(await page.evaluate(() => document.querySelector('#toolMenu button[data-tool="measure"]').classList.contains('active')), true);
    await page.click('#toolMore'); await page.keyboard.press('Escape');
    assert.equal(await page.isVisible('#toolMenu'), false);
    await page.click('#toolMore'); await page.mouse.click(700, 600);
    assert.equal(await page.isVisible('#toolMenu'), false);
    // tombol berikon saja wajib punya nama yang bisa dibaca pembaca layar
    const tanpaNama = await page.$$eval('#toolbar button,#viewbar button,#mulaiKartu button', bs => bs.filter(b => !b.getAttribute('aria-label') && !b.textContent.replace(/[^\p{L}\p{N}]/gu, '').length).map(b => b.outerHTML.slice(0, 60)));
    assert.deepEqual(tanpaNama, []);
  },
  'objek: pencarian furnitur menyaring katalog': async (page) => {
    await page.click('.tabs button[data-tab="objects"]');
    await page.fill('#furnCari', 'kloset');
    await page.waitForFunction(() => document.querySelectorAll('#cat-furn .cat-item').length === 1);
    assert.match(await page.textContent('#cat-furn .cat-item'), /Kloset/);
    await page.fill('#furnCari', 'zzzz');
    await page.waitForFunction(() => /Tidak ada furnitur/.test(document.getElementById('cat-furn').textContent));
    await page.fill('#furnCari', '');
    await page.waitForFunction(() => document.querySelectorAll('#cat-furn .cat-item').length > 100);
  }
};
for (const t of Object.values(tes)) t.opsi = iPad;
