import assert from 'node:assert/strict';
import { muatProyekJSON } from './harness.mjs';

// JEV-096: beberapa track sekaligus — musik latar & media objek jadi daftar putar (berurutan / acak,
// tombol berikutnya), suara sendiri objek memilih acak tiap ketukan
function wav(hz) {                                       // 0,2 s nada, mono 8 kHz
  const n = 1600, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / 8000 * 2 * Math.PI * hz) * 8000), 44 + i * 2);
  return b;
}
const trek = (...nama) => nama.map((n, i) => ({ name: n + '.wav', mimeType: 'audio/wav', buffer: wav(300 + i * 110) }));
const rumah = { v: 1, levels: [{ name: 'L1', height: 3, walls: [], objects: [] }] };
const kotak = page => page.evaluate(() => {
  addObject('furn', 'bentuk_kotak'); const o = L().objects.at(-1); o.x = 0; o.z = 2; rebuildScene(); select('obj', o.id); renderInspector(); return o.id;
});
const pilihSaatDiketuk = (page, v) => page.evaluate(v => {
  const r = [...document.querySelectorAll('#inspector .f-row')].find(x => x.querySelector('label')?.textContent === 'Saat diketuk');
  const s = r.querySelector('select'); s.value = v; s.dispatchEvent(new Event('change'));
}, v);
async function unggahBanyak(page, tombol, berkas) {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.locator(tombol).first().click()]);
  assert.equal(fc.isMultiple(), true, 'pemilih menerima beberapa berkas sekaligus');
  await fc.setFiles(berkas);
}

export const tes = {
  'musik latar: beberapa track sekaligus jadi daftar putar, acak tanpa mengulang, lanjut di elemen yang sama, hapus per track': async (page) => {
    await muatProyekJSON(page, rumah);
    await page.click('.tabs button[data-tab="tampilan"]');
    await unggahBanyak(page, '#bgmPilih', trek('hujan', 'ombak', 'angin'));
    await page.waitForFunction(() => bgmData()?.daftar.length === 3, undefined, { timeout: 20000 });
    const ui = await page.evaluate(() => ({ baris: [...document.querySelectorAll('#bgmDaftar .trek span')].map(s => s.textContent),
      acak: !document.getElementById('bgmAcakL').hidden, tombol: document.getElementById('bgmPilih').textContent.trim(), hapus: document.getElementById('bgmHapus').textContent.trim() }));
    assert.deepEqual(ui, { baris: ['1. hujan', '2. ombak', '3. angin'], acak: true, tombol: 'Tambah musik…', hapus: 'Hapus semua' });
    await page.evaluate(() => { const c = document.getElementById('bgmAcak'); c.checked = true; c.dispatchEvent(new Event('change')); });
    // tersimpan & lolos penyaring proyek
    const B = await page.evaluate(() => sanitasiProyek(JSON.parse(JSON.stringify(PROJECT))).bgm);
    assert.equal(B.acak, true); assert.equal(B.lain.length, 2);
    // putar: urutan acak berisi ketiganya; akhir track → track berikutnya di <audio> yang sama; habis → diacak ulang (ulang terus)
    const r = await page.evaluate(() => {
      mulaiBGM(); const a = BGM.a, urutan = [...BGM.urutan], dimainkan = [BGM.mid];
      for (let i = 0; i < 2; i++) { a.onended(); dimainkan.push(BGM.mid); }
      a.onended(); const putaran2 = BGM.mid, sama = BGM.a === a, loop = a.loop;
      hentikanBGM(); return { urutan: urutan.length, unik: new Set(dimainkan).size, sesuai: dimainkan.join() === urutan.join(), putaran2: putaran2 !== dimainkan[2], sama, loop, k: 0 };
    });
    assert.deepEqual(r, { urutan: 3, unik: 3, sesuai: true, putaran2: true, sama: true, loop: false, k: 0 });
    // tanpa ulang: berhenti setelah track terakhir
    const henti = await page.evaluate(() => { PROJECT.bgm.ulang = false; mulaiBGM(); const a = BGM.a; for (let i = 0; i < 3; i++) a.onended(); const k = BGM.k; hentikanBGM(); return k; });
    assert.equal(henti, 3);
    // hapus satu track → berkasnya ikut dibuang dari proyek
    const sebelum = await page.evaluate(() => Object.keys(PROJECT.media).length);
    await page.locator('#bgmDaftar .trek').nth(1).locator('button').click();
    assert.deepEqual(await page.evaluate(() => [bgmData().daftar.map(m => PROJECT.media[m].nama), Object.keys(PROJECT.media).length]), [['hujan', 'angin'], sebelum - 1]);
    await page.click('#bgmHapus');
    assert.deepEqual(await page.evaluate(() => [!!PROJECT.bgm, Object.keys(PROJECT.media || {}).length]), [false, 0]);
  },

  'media objek: daftar putar berurutan / acak, tombol berikutnya di pemutar, berhenti di akhir daftar; tautan membawa semua track': async (page) => {
    await muatProyekJSON(page, rumah);
    const id = await kotak(page);
    await pilihSaatDiketuk(page, 'media');
    await unggahBanyak(page, '#inspector button:has-text("Pilih audio / video")', trek('satu', 'dua', 'tiga'));
    await page.waitForFunction(id => aksiObjek(cariObjek(id))?.mediaDaftar?.length === 3, id, { timeout: 20000 });
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('#inspector label.cek')].some(l => /Acak urutan/.test(l.textContent))), true);
    const r = await page.evaluate(id => {
      pakai({ jenis: 'bunyi', id }); const judul = [$('#mediaJudul').textContent], lanjut = !$('#mediaLanjut').hidden;
      $('#mediaLanjut').click(); judul.push($('#mediaJudul').textContent);
      $('#mediaAudio').onended(); judul.push($('#mediaJudul').textContent);
      $('#mediaAudio').onended(); const henti = !mediaObjekJalan(id);
      return { judul, lanjut, henti };
    }, id);
    assert.deepEqual(r, { judul: ['satu · 1/3', 'dua · 2/3', 'tiga · 3/3'], lanjut: true, henti: true });
    // acak: tiap putaran berisi ketiga track, tanpa mulai dari track terakhir sebelumnya
    const acak = await page.evaluate(id => {
      const o = cariObjek(id); o.params.aksi.mediaAcak = true; const hasil = [];
      for (let i = 0; i < 6; i++) { const akhir = TREK_AKHIR.get(id); mulaiMediaObjek(id); const M = MEDIA_OBJ.get(id); hasil.push([new Set(M.urutan).size, M.urutan[0] !== akhir]); hentikanMediaObjek(id); }
      return hasil.every(([n, beda]) => n === 3 && beda);
    }, id);
    assert.equal(acak, true);
    // hapus track dari inspector
    await page.evaluate(id => { select('obj', id); renderInspector(); }, id);
    await page.locator('#inspector .trek').first().locator('button').click();
    assert.deepEqual(await page.evaluate(id => aksiObjek(cariObjek(id)).mediaDaftar.map(m => PROJECT.media[m].nama), id), ['dua', 'tiga']);
    // semua track ikut tautan lihat
    await page.route('**/api/tautan**', rt => { const u = new URL(rt.request().url());
      if (u.searchParams.get('cek')) return rt.fulfill({ json: { ada: false } });
      if (u.searchParams.get('bagian')) return rt.fulfill({ json: { ok: true } });
      return rt.fulfill({ json: { id: 'Trek2AbCdE' } }); });
    assert.equal(await page.evaluate(async () => (await buatTautanLihat()).nLampiran), 2);
  },

  'suara sendiri: beberapa audio, tiap ketukan memilih acak & tidak sama dengan ketukan sebelumnya': async (page) => {
    await muatProyekJSON(page, rumah);
    const id = await kotak(page);
    await pilihSaatDiketuk(page, 'sfx');
    await unggahBanyak(page, '#inspector button:has-text("Pilih audio")', trek('a', 'b', 'c'));
    await page.waitForFunction(id => aksiObjek(cariObjek(id))?.sfxDaftar?.length === 3, id, { timeout: 20000 });
    const r = await page.evaluate(async id => {
      audioSiap(); const dipilih = [];
      for (let i = 0; i < 20; i++) { await sfxObjek(id); dipilih.push(TREK_AKHIR.get(id)); }
      return { beruntun: dipilih.some((m, i) => i && m === dipilih[i - 1]), ragam: new Set(dipilih).size, hint: [...document.querySelectorAll('#inspector p.hint')].some(p => /3 audio/.test(p.textContent)) };
    }, id);
    assert.deepEqual(r, { beruntun: false, ragam: 3, hint: true });
  },
};
