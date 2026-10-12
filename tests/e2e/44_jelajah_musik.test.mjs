import assert from 'node:assert/strict';
import { CORS, muatProyekJSON } from './harness.mjs';

// JEV-097: jelajahi musik & suara (Openverse, CC) — cari, coba dengar, tambah ke musik latar / objek,
// kredit pembuat & lisensi tersimpan + ikut disaring; sumber yang menolak CORS → tautan halaman asli
function wav(hz) {
  const n = 1600, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / 8000 * 2 * Math.PI * hz) * 8000), 44 + i * 2);
  return b;
}
const rumah = { v: 1, levels: [{ name: 'L1', height: 3, walls: [], objects: [] }] };
const trek = (id, title, extra = {}) => ({ id, title, url: `https://audio.contoh.test/${id}.wav`, creator: 'Pemusik ' + id, license: 'by', license_version: '4.0',
  filetype: 'wav', duration: 125000, source: 'jamendo', foreign_landing_url: `https://www.contoh.test/trek/${id}`, filesize: 3200, ...extra });

async function pasangRute(page, log) {
  await page.route('https://api.openverse.org/v1/audio/**', r => {
    const u = new URL(r.request().url()); log.cari.push(Object.fromEntries(u.searchParams));
    const hasil = u.searchParams.get('category') === 'sound_effect'
      ? [trek('ketuk', 'Ketukan pintu kayu', { source: 'freesound' }), trek('bel', 'Bel pintu')]
      : [trek('santai', 'Sore santai'), trek('xss', '<img src=x onerror="window.__xss=1">Piano'), trek('tolak', 'Tanpa CORS', { url: 'https://tolak.contoh.test/a.wav' }),
        trek('besar', 'Terlalu besar', { filesize: 40 * 1048576 }), trek('flac', 'Format lain', { filetype: 'flac' })];
    return r.fulfill({ headers: CORS, json: { result_count: hasil.length, page_count: 1, page: 1, results: hasil } });
  });
  await page.route('https://audio.contoh.test/**', r => { log.unduh.push(r.request().url()); return r.fulfill({ headers: { ...CORS, 'content-type': 'audio/wav' }, body: wav(440) }); });
  // sumber yang menolak CORS: peramban melaporkannya sebagai kegagalan jaringan (TypeError) — rute palsu Playwright melewati CORS, jadi ditiru begitu
  await page.route('https://tolak.contoh.test/**', r => r.abort('failed'));
}
const tombolTrek = (page, judul, teks) => page.locator('#musikHasil .mp-trek', { hasText: judul }).locator('button', { hasText: teks });

export const tes = {
  'musik latar: jelajahi pustaka, coba dengar, tambah dengan kredit; judul luar sebagai teks; sumber tanpa CORS → halaman asli': async (page) => {
    const log = { cari: [], unduh: [] };
    await pasangRute(page, log);
    await muatProyekJSON(page, rumah);
    await page.click('.tabs button[data-tab="tampilan"]');
    await page.click('#bgmJelajah');
    await page.waitForSelector('#musikPustaka:not([hidden]) #musikHasil .mp-trek');
    assert.equal(log.cari[0].category, 'music');
    const daftar = await page.evaluate(() => [...document.querySelectorAll('#musikHasil .mp-trek b')].map(b => b.textContent));
    assert.deepEqual(daftar, ['Sore santai', '<img src=x onerror="window.__xss=1">Piano', 'Tanpa CORS', 'Terlalu besar'], 'format tak didukung disaring; judul tampil sebagai teks');
    assert.equal(await page.evaluate(() => !!window.__xss || !!document.querySelector('#musikHasil img')), false);
    assert.match(await page.locator('#musikHasil .mp-trek', { hasText: 'Sore santai' }).textContent(), /Pemusik santai · 2:05 · CC BY 4\.0 · jamendo/);
    assert.equal(await tombolTrek(page, 'Terlalu besar', 'Terlalu besar').isDisabled(), true);
    // genre & lisensi komersial → pencarian baru
    await page.locator('#musikSaran button', { hasText: 'Piano' }).click();
    await page.selectOption('#musikLisensi', 'commercial');
    await page.waitForSelector('#musikHasil .mp-trek');
    assert.ok(log.cari.some(c => c.q === 'piano'), 'saran genre mencari');
    assert.equal(log.cari.at(-1).license_type, 'commercial');
    // coba dengar: diunduh sekali ke blob, tombol berganti ■
    await tombolTrek(page, 'Sore santai', '▶').click();
    const baris = page.locator('#musikHasil .mp-trek', { hasText: 'Sore santai' });
    await page.waitForFunction(() => { const b = [...document.querySelectorAll('#musikHasil .mp-trek')].find(r => /Sore santai/.test(r.textContent)).querySelector('button'); return b.textContent !== '…'; });
    assert.equal(await baris.locator('button').first().textContent(), '■', 'sedang diputar');
    assert.equal(await baris.locator('.mp-awas').count(), 0);
    // tambah ke musik latar
    await tombolTrek(page, 'Sore santai', 'Tambah').click();
    await page.waitForFunction(() => bgmData()?.daftar.length === 1, undefined, { timeout: 15000 });
    assert.equal(log.unduh.filter(u => /santai/.test(u)).length, 1, 'coba dengar + tambah = satu unduhan');
    const m = await page.evaluate(() => { const d = bgmData(); return { nama: d.m.nama, mime: d.m.mime, kredit: d.m.kredit, baris: document.querySelector('#bgmDaftar .trek span').textContent }; });
    assert.deepEqual(m, { nama: 'Sore santai', mime: 'audio/wav', kredit: { oleh: 'Pemusik santai', lisensi: 'CC BY 4.0', url: 'https://www.contoh.test/trek/santai' }, baris: '♪ Sore santai — Pemusik santai · CC BY 4.0' });
    // sumber tanpa CORS: tidak terpasang, ada tautan ke halaman aslinya
    await tombolTrek(page, 'Tanpa CORS', 'Tambah').click();
    const a = page.locator('#musikHasil .mp-trek', { hasText: 'Tanpa CORS' }).locator('a');
    await a.waitFor();
    assert.deepEqual(await a.evaluate(x => [x.href, x.rel, x.target]), ['https://www.contoh.test/trek/tolak', 'noopener noreferrer', '_blank']);
    assert.equal(await page.evaluate(() => bgmData().daftar.length), 1);
    // kredit lolos penyaring proyek; kredit berbahaya dibuang / dipotong
    const s = await page.evaluate(() => { const j = JSON.parse(JSON.stringify(PROJECT)); const k = Object.keys(j.media)[0];
      j.media[k].kredit = { oleh: 'x'.repeat(500), lisensi: 'CC0', url: 'javascript:alert(1)' }; return sanitasiProyek(j).media[k].kredit; });
    assert.deepEqual([s.oleh.length, s.lisensi, s.url], [120, 'CC0', '']);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => $('#musikPustaka').hidden), true);
  },

  'objek: jelajahi suara (efek suara) & musik dari inspector — langsung masuk daftar track objek': async (page) => {
    const log = { cari: [], unduh: [] };
    await pasangRute(page, log);
    await muatProyekJSON(page, rumah);
    const id = await page.evaluate(() => { addObject('furn', 'bentuk_kotak'); const o = L().objects.at(-1); rebuildScene(); select('obj', o.id); renderInspector(); return o.id; });
    const pilih = v => page.evaluate(v => { const r = [...document.querySelectorAll('#inspector .f-row')].find(x => x.querySelector('label')?.textContent === 'Saat diketuk');
      const s = r.querySelector('select'); s.value = v; s.dispatchEvent(new Event('change')); }, v);
    await pilih('sfx');
    await page.locator('#inspector button', { hasText: 'Jelajahi suara' }).click();
    await page.waitForSelector('#musikPustaka:not([hidden]) #musikHasil .mp-trek');
    assert.equal(log.cari.at(-1).category, 'sound_effect');
    for (const j of ['Ketukan pintu kayu', 'Bel pintu']) await tombolTrek(page, j, 'Tambah').click();
    await page.waitForFunction(id => aksiObjek(cariObjek(id))?.sfxDaftar?.length === 2, id, { timeout: 15000 });
    assert.match(await page.locator('#inspector .trek').first().textContent(), /Ketukan pintu kayu — Pemusik ketuk · CC BY 4\.0/);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(id => SEL && SEL.id === id, id), true, 'Escape menutup dialog tanpa membatalkan pilihan objek');
    // media objek
    await pilih('media');
    await page.locator('#inspector button', { hasText: 'Jelajahi musik' }).click();
    await page.waitForFunction(() => /Sore santai/.test($('#musikHasil').textContent));
    await tombolTrek(page, 'Sore santai', 'Tambah').click();
    await page.waitForFunction(id => aksiObjek(cariObjek(id))?.mediaDaftar?.length === 1, id, { timeout: 15000 });
    const k = await page.evaluate(id => { const ak = aksiObjek(cariObjek(id)); pakai({ jenis: 'bunyi', id }); const t = $('#mediaJudul').title; hentikanMediaObjek(id); return [PROJECT.media[ak.media].kredit.oleh, t]; }, id);
    assert.deepEqual(k, ['Pemusik santai', 'Pemusik santai · CC BY 4.0']);
  },
};
