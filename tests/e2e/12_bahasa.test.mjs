import assert from 'node:assert/strict';

// JEV-061: bahasa Inggris bawaan, Indonesia pilihan — lapisan terjemahan DOM dari lang/en.js
const EN = { bahasa: 'en' };
// kata Indonesia yang tidak pernah muncul di UI berbahasa Inggris (nama produk/proyek dikecualikan)
const KATA_ID = /\b(dan|yang|untuk|dengan|atau|dari|ketuk|pilih|unggah|lantai|dinding|denah|simpan|hapus|tampilan|jendela|pintu|belum|gambar|tekan|buka|tutup|ukuran|tinggi|lebar)\b/i;
// teks & title yang terlihat di bawah selektor; opsional pindah tab dulu (satu evaluate = tanpa menunggu frame)
const teksTerlihat = (page, sel, tab) => page.evaluate(([s, tab]) => {
  if (tab) pilihTab(tab);
  const keluar = []; const w = document.createTreeWalker(document.querySelector(s), NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    const p = n.parentElement; const t = n.nodeValue.replace(/\s+/g, ' ').trim();
    if (!t || !p || p.closest('[hidden],script,style,textarea,option') || !p.getClientRects().length || getComputedStyle(p).visibility === 'hidden') continue;
    keluar.push(t);
  }
  for (const e of document.querySelectorAll(s + ' [title]')) if (e.getClientRects().length) keluar.push(e.title);
  return keluar;
}, [sel, tab]);

const sisaIndonesia = arr => arr.filter(t => KATA_ID.test(t) && !/Rumah contoh|Denah 3D/.test(t));

export const tes = {
  'bawaan: tanpa pilihan tersimpan, UI tampil dalam bahasa Inggris': Object.assign(async (page) => {
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
    const tab = await page.$$eval('.tabs button', bs => bs.map(b => b.textContent.replace(/\s+/g, ' ').trim()));
    assert.deepEqual(tab, ['📐Plan', '🏢Floors', '🛋Objects', '🎨Display', '💾File']);
    assert.equal(await page.inputValue('#bahasa'), 'en');
    // pesan dinamis: pola + isi tangkapan ikut diterjemahkan; nama buatan pengguna tidak disentuh
    await page.evaluate(() => toast('Gagal: berkas kosong'));
    await page.waitForFunction(() => document.getElementById('toast').textContent === 'Failed: empty file');
    await page.evaluate(() => toast('Proyek dimuat: Rumah <b>Saya</b>'));
    await page.waitForFunction(() => document.getElementById('toast').textContent === 'Project loaded: Rumah <b>Saya</b>');
    // mode jalan: bar info & tombol aksi (diisi lewat innerHTML saat duduk/membidik)
    const jalan = await page.evaluate(async () => {
      document.getElementById('fpsinfo').innerHTML = '<b>Duduk</b> · ketuk <b>Berdiri</b> atau geser stik';
      document.getElementById('fpsAct').innerHTML = '👆 Buka pintu garasi';
      await new Promise(r => setTimeout(r, 0));
      return [document.getElementById('fpsinfo').textContent, document.getElementById('fpsAct').textContent];
    });
    assert.deepEqual(jalan, ['Seated · tap Stand up or move the stick', '👆 Open garage door']);
  }, { opsi: { bahasa: null } }),
  'inggris: semua tab, kartu Mulai, toolbar & inspector tanpa sisa teks Indonesia': Object.assign(async (page) => {
    const sisa = new Set();
    const ambil = async (sel, tab) => sisaIndonesia(await teksTerlihat(page, sel, tab)).forEach(t => sisa.add(t));
    await ambil('#app');
    for (const t of ['plan', 'levels', 'objects', 'tampilan', 'file']) await ambil('#sidebar', t);
    await page.evaluate(() => { document.getElementById('toast').textContent = ''; });
    await page.click('#mulaiContoh');
    await page.waitForFunction(() => /^Project loaded:/.test(document.getElementById('toast').textContent), undefined, { timeout: 60000 });
    for (const t of ['plan', 'levels', 'objects', 'tampilan', 'file']) await ambil('#sidebar', t);
    await ambil('#toolbar');
    await page.evaluate(() => { const o = L().objects.find(o => o.kind === 'furn'); select('obj', o.id); });
    await page.waitForSelector('#inspector:not([hidden])');
    await ambil('#inspector');
    await page.evaluate(() => { const w = L().walls.find(w => w.openings.length); select('wall', w.id); });
    await ambil('#inspector');
    assert.equal(sisa.size, 0, 'teks belum diterjemahkan: ' + JSON.stringify([...sisa]));
  }, { opsi: EN }),
  'ganti bahasa: pilihan disimpan & dimuat ulang — Indonesia ↔ Inggris': Object.assign(async (page) => {
    await Promise.all([page.waitForEvent('load'), page.selectOption('#bahasa', 'id')]);
    await page.waitForFunction(() => window.__siap, undefined, { timeout: 120000 });
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'id');
    assert.equal((await page.textContent('.tabs button[data-tab="plan"]')).trim(), '📐Denah');
    await Promise.all([page.waitForEvent('load'), page.selectOption('#bahasa', 'en')]);
    await page.waitForFunction(() => window.__siap, undefined, { timeout: 120000 });
    assert.equal((await page.textContent('.tabs button[data-tab="plan"]')).trim(), '📐Plan');
  }, { opsi: EN }),
};
