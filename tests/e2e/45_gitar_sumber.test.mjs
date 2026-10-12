import assert from 'node:assert/strict';
import { CORS, muatProyekJSON } from './harness.mjs';

// JEV-098: sumber suara otomatis di objek (3D, jangkauan) · JEV-099: gitar yang bisa dimainkan ·
// JEV-097 lanjutan: pencarian musik tanpa saringan kategori bila hasil sedikit, MP3 Jamendo ('mp32')
function wav(hz) {
  const n = 1600, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / 8000 * 2 * Math.PI * hz) * 8000), 44 + i * 2);
  return b;
}
const rumah = { v: 1, levels: [{ name: 'L1', height: 3, walls: [], objects: [] }] };
// objek di depan kamera mode jalan → dibidik
const bidik = page => page.evaluate(() => {
  enterFPS(); FPS.feet = 0; camera.position.set(0, 1.6, 2.2); FPS.yaw = Math.PI; FPS.pitch = -0.5; for (let i = 0; i < 3; i++) fpsStep(0);
  AIM_T = 0; stepBidik(0.2); return AIM && { jenis: AIM.jenis, label: labelAksi(AIM) };
});

export const tes = {
  'gitar: ada di katalog, dibidik di mode jalan → panel gitar; akor menentukan senar yang dipetik; sapu senar = genjreng; nada senar tepat': async (page) => {
    await muatProyekJSON(page, rumah);
    assert.ok(await page.evaluate(() => [...document.querySelectorAll('#cat-furn .cat-item')].some(b => /Gitar Akustik/.test(b.textContent))), 'gitar di katalog');
    const id = await page.evaluate(() => { addObject('furn', 'gitar'); const o = L().objects.at(-1); o.x = 0; o.z = 0.6; rebuildScene(); let n = 0; grupObjek(o.id)[0].traverse(m => { if (m.isMesh) n++; }); return [o.id, n]; });
    assert.ok(id[1] >= 15, 'model gitar berisi badan, leher, senar, standar');
    const a = await bidik(page);
    assert.deepEqual(a, { jenis: 'gitar', label: 'Mainkan gitar' });
    await page.evaluate(() => pakai(AIM));
    await page.waitForSelector('#gitarPanel:not([hidden])');
    const r = await page.evaluate(() => {
      const hasil = {}; audioSiap();
      document.querySelector('#gitarAkor button[data-a="G"]').click(); let n = GITAR.petikan(); GITAR.genjreng('D'); hasil.G = GITAR.petikan() - n;
      document.querySelector('#gitarAkor button[data-a="Am"]').click(); n = GITAR.petikan(); GITAR.genjreng('U'); hasil.Am = GITAR.petikan() - n;
      hasil.label = [...document.querySelectorAll('#gitarSenar .sn')].map(e => e.dataset.fret).join(' ');
      return hasil;
    });
    assert.deepEqual(r, { G: 6, Am: 5, label: '× ○ 2 2 1 ○' }, 'G: 6 senar, Am: 5 senar (E rendah diredam)');
    // sapu jari dari senar atas ke bawah
    const kotak = await page.locator('#gitarSenar').boundingBox();
    const awal = await page.evaluate(() => GITAR.petikan());
    await page.mouse.move(kotak.x + 200, kotak.y + 10); await page.mouse.down();
    await page.mouse.move(kotak.x + 200, kotak.y + kotak.height - 8, { steps: 12 }); await page.mouse.up();
    assert.ok(await page.evaluate(() => GITAR.petikan()) - awal >= 5, 'genjreng dengan menyapu senar');
    // keyboard: 1–9 akor, Esc menutup panel tanpa keluar mode jalan
    await page.keyboard.press('2');
    assert.equal(await page.evaluate(() => GITAR.akor()), 'G');
    await page.keyboard.press('Escape');
    assert.deepEqual(await page.evaluate(() => [$('#gitarPanel').hidden, FPS.on]), [true, true]);
    // nada: senar E rendah ±82,4 Hz, senar e tinggi ±329,6 Hz (periode dari autokorelasi; perlintasan nol tertipu nada atas)
    const hz = await page.evaluate(() => { const ctx = audioSiap(); return [40, 64].map(m => { const d = GITAR._bufferNot(ctx, m).getChannelData(0), sr = ctx.sampleRate, a = Math.floor(sr * 0.1), w = Math.floor(sr * 0.1);
      let terbaik = 0, lag = 0; for (let L = Math.floor(sr / 1000); L < Math.floor(sr / 60); L++) { let k = 0; for (let i = 0; i < w; i++) k += d[a + i] * d[a + i + L]; if (k > terbaik) { terbaik = k; lag = L; } }
      return sr / lag; }); });
    assert.ok(Math.abs(hz[0] - 82.4) / 82.4 < 0.04 && Math.abs(hz[1] - 329.6) / 329.6 < 0.04, 'nada senar: ' + hz.map(x => x.toFixed(1)));
    await page.evaluate(() => exitFPS());
  },

  'sumber suara otomatis: berbunyi sendiri di mode jalan sebagai suara 3D berjangkauan; ketuk mematikan / menyalakan; berhenti saat keluar': async (page) => {
    await muatProyekJSON(page, rumah);
    const id = await page.evaluate(async b64 => {
      addObject('furn', 'bentuk_kotak'); const o = L().objects.at(-1); o.x = 0; o.z = 0.6; rebuildScene(); select('obj', o.id); renderInspector();
      const f = new File([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], 'air mancur.wav', { type: 'audio/wav' });
      await tambahTrekObjek(o.id, false, f); return o.id;
    }, wav(330).toString('base64'));
    await page.evaluate(() => { const l = [...document.querySelectorAll('#inspector label.cek')].find(x => /Putar otomatis dari objek/.test(x.textContent)); l.querySelector('input').click(); });
    await page.evaluate(() => { const r = [...document.querySelectorAll('#inspector .f-row')].find(x => x.querySelector('label')?.textContent === 'Jangkauan suara'); const s = r.querySelector('select'); s.value = '20'; s.dispatchEvent(new Event('change')); });
    assert.deepEqual(await page.evaluate(id => { const a = aksiObjek(cariObjek(id)); return [a.mediaOto, a.mediaJarak, !!window.SUMBER && window.SUMBER.aktif(id)]; }, id), [true, 20, false], 'di editor tidak berbunyi');
    const a = await bidik(page);
    await page.waitForFunction(id => window.SUMBER && window.SUMBER.aktif(id), id, { timeout: 15000 });
    const p = await page.evaluate(id => { const S = SUMBER._jalan.get(id); return [S.pan.distanceModel, S.pan.maxDistance, S.pan.panningModel, Math.round(S.pan.positionZ.value * 10) / 10, $('#mediaDock').hidden]; }, id);
    assert.deepEqual(p, ['linear', 20, 'HRTF', 0.6, true], 'suara 3D dari posisi objek, tanpa pemutar di layar');
    assert.equal(a.jenis, 'bunyi');
    assert.equal(await page.evaluate(() => labelAksi(AIM)), 'Matikan suara');
    const t = await page.evaluate(id => { pakai(AIM); const mati = !SUMBER.aktif(id), lbl = labelAksi(AIM); rebuildScene(); const tetapMati = !SUMBER.aktif(id); pakai(AIM); return [mati, lbl, tetapMati, SUMBER.aktif(id)]; }, id);
    assert.deepEqual(t, [true, 'Nyalakan suara', true, true], 'ketuk mematikan (bertahan saat adegan dibangun ulang), ketuk lagi menyalakan');
    assert.equal(await page.evaluate(id => { exitFPS(); return SUMBER.aktif(id); }, id), false);
  },

  'jelajahi musik: hasil kategori sedikit → dicari lagi tanpa kategori; MP3 Jamendo (mp32) diterima; lisensi komersial kosong → tombol semua lisensi': async (page) => {
    const cari = [];
    const trek = (id, ft) => ({ id, title: 'Lagu ' + id, url: `https://audio.contoh.test/${id}`, creator: 'X', license: 'by-nc', license_version: '3.0', filetype: ft, duration: 90000, source: 'jamendo', foreign_landing_url: 'https://www.contoh.test/' + id });
    await page.route('https://api.openverse.org/v1/audio/**', r => {
      const u = new URL(r.request().url()), q = Object.fromEntries(u.searchParams); cari.push(q);
      const hasil = q.license_type === 'commercial' ? [] : q.category ? [trek('a', 'mp32')] : [trek('a', 'mp32'), trek('b', 'mp3'), trek('c', 'flac'), trek('d', null)];
      return r.fulfill({ headers: CORS, json: { page_count: 1, results: hasil } });
    });
    await muatProyekJSON(page, rumah);
    await page.evaluate(() => bukaMusik('music', 'Musik latar', () => {}));
    await page.waitForFunction(() => document.querySelectorAll('#musikHasil .mp-trek').length === 3);
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#musikHasil .mp-trek b')].map(b => b.textContent)), ['Lagu a', 'Lagu b', 'Lagu d']);
    assert.deepEqual(cari.map(c => c.category || '-'), ['music', '-']);
    await page.selectOption('#musikLisensi', 'commercial');
    const b = page.locator('#musikHasil button', { hasText: 'Tampilkan semua lisensi CC' });
    await b.waitFor(); await b.click();
    await page.waitForFunction(() => document.querySelectorAll('#musikHasil .mp-trek').length === 3);
    assert.equal(await page.evaluate(() => $('#musikLisensi').value), '');
  },
};
