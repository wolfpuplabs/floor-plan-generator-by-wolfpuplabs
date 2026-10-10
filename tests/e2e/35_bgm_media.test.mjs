import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { muatProyekJSON } from './harness.mjs';

// JEV-086: musik latar (BGM) di tab Tampilan — unggah, ulang, otomatis, volume, tombol Musik di
// mode jalan, ikut tautan lihat; musik objek menerima MP4 berisi suara; media objek diputar saat diketuk (ulang opsional).

// WAV 0,2 dtk sunyi
function wav() {
  const n = 3200, b = Buffer.alloc(44 + n);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n, 40);
  return b;
}
const rumah = { v: 1, levels: [{ name: 'L1', height: 3, walls: [[0, 0, 4, 0], [4, 0, 4, 3], [4, 3, 0, 3], [0, 3, 0, 0]].map(([x1, z1, x2, z2], i) => ({ id: 'w' + i, x1, z1, x2, z2, thickness: 0.15, openings: [] })), objects: [] }] };

export const tes = {
  'musik latar: unggah lewat pemilih berkas, pilihan, tombol Musik di mode jalan, hapus': async (page) => {
    await muatProyekJSON(page, rumah);
    await page.click('.tabs button[data-tab="tampilan"]');
    assert.equal(await page.isVisible('#bgmAtur'), false);
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#bgmPilih')]);
    assert.match(await page.evaluate(() => document.querySelector('input[type=file][accept*="audio"]')?.accept || ''), /\.mp3/);
    await fc.setFiles({ name: 'hujan.wav', mimeType: 'audio/wav', buffer: wav() });
    await page.waitForFunction(() => !!PROJECT.bgm, undefined, { timeout: 15000 });
    const r = await page.evaluate(() => ({ bgm: { ...PROJECT.bgm, media: !!PROJECT.media[PROJECT.bgm.media] }, mime: PROJECT.media[PROJECT.bgm.media].mime,
      nama: document.getElementById('bgmNama').textContent, atur: !document.getElementById('bgmAtur').hidden, coba: !document.getElementById('bgmCoba').hidden }));
    assert.deepEqual(r, { bgm: { media: true, ulang: true, otomatis: true, vol: 0.6 }, mime: 'audio/wav', nama: '♪ hujan', atur: true, coba: true });
    // pilihan tersimpan di proyek
    await page.evaluate(() => { const u = document.getElementById('bgmUlang'); u.checked = false; u.dispatchEvent(new Event('change'));
      const v = document.getElementById('bgmVol'); v.value = '30'; v.dispatchEvent(new Event('change')); });
    assert.deepEqual(await page.evaluate(() => [PROJECT.bgm.ulang, PROJECT.bgm.vol]), [false, 0.3]);
    // mode jalan: musik mulai (atau menunggu ketukan bila peramban menolak), tombol Musik tampil & menghentikannya
    const j = await page.evaluate(() => { enterFPS(); const mulai = !!BGM.a && (bgmMain() || BGM.tunda), tombol = !document.getElementById('fpsBgm').hidden, vol = BGM.a.volume, loop = BGM.a.loop;
      togelBGM(); const henti = !bgmMain() && !BGM.tunda && BGM.mati; togelBGM(); const lagi = bgmMain() || BGM.tunda; exitFPS();
      return { mulai, tombol, vol, loop, henti, lagi, keluar: !bgmMain() }; });
    assert.deepEqual(j, { mulai: true, tombol: true, vol: 0.3, loop: false, henti: true, lagi: true, keluar: true });
    // tautan lihat: musik latar ikut sebagai lampiran
    await page.route('**/api/tautan**', async rt => { const u = new URL(rt.request().url());
      if (u.searchParams.get('cek')) return rt.fulfill({ json: { ada: false } });
      if (u.searchParams.get('bagian')) return rt.fulfill({ json: { ok: true } });
      rt.request().postDataBuffer() && (page.__isi = rt.request().postDataBuffer());
      return rt.fulfill({ json: { id: 'BgmMus1k2a' } }); });
    assert.equal(await page.evaluate(async () => (await buatTautanLihat()).nLampiran), 1);
    const isi = JSON.parse(zlib.inflateRawSync(page.__isi).toString());
    assert.equal(isi.bgm.ulang, false); assert.equal(Object.keys(isi.lampiran.media).length, 1);
    // hapus: musik & medianya hilang dari proyek
    await page.click('#bgmHapus');
    assert.deepEqual(await page.evaluate(() => [PROJECT.bgm === undefined, Object.keys(PROJECT.media || {}).length, document.getElementById('bgmAtur').hidden]), [true, 0, true]);
  },
  'berkas proyek: musik latar disaring (id tak sah dibuang, volume dijepit)': async (page) => {
    const b64 = wav().toString('base64');
    const p = { ...rumah, media: { mdbgm: { nama: 'lagu', mime: 'audio/wav', data: b64 } }, bgm: { media: 'mdbgm', vol: 7, ulang: true } };
    assert.match(await muatProyekJSON(page, p), /Proyek dimuat/);
    assert.deepEqual(await page.evaluate(() => PROJECT.bgm), { media: 'mdbgm', ulang: true, otomatis: true, vol: 1 });
    assert.equal(await page.evaluate(() => !!bgmData()), true);
    await muatProyekJSON(page, { ...p, bgm: { media: '../x<script>' } });
    assert.equal(await page.evaluate(() => 'bgm' in PROJECT), false);
  },
  'media objek: ulang, henti, tidak bertabrakan dengan suara, musik lama jadi media, musik latar mengalah': async (page) => {
    const r = await page.evaluate(async w => {
      const u8 = Uint8Array.from(atob(w), c => c.charCodeAt(0));
      const ma = await unggahMediaObjek(new File([u8], 'ombak.wav'), 'media');
      const mp4 = new Uint8Array(64); mp4.set([0, 0, 0, 24], 0); [...'ftypisom'].forEach((c, i) => { mp4[4 + i] = c.charCodeAt(0); });
      const mus = await unggahMediaObjek(new File([mp4], 'rekaman'), 'audio');
      L().objects.push({ id: 'om', kind: 'furn', type: 'bentuk_kotak', x: 1, y: 0, z: 1, rotY: 0, sx: 1, sy: 1, sz: 1, params: { aksi: { media: ma, mediaUlang: true, sfx: 'klik' } } },
                       { id: 'ol', kind: 'furn', type: 'bentuk_kotak', x: 3, y: 0, z: 1, rotY: 0, sx: 1, sy: 1, sz: 1, params: { aksi: { musik: mus } } });
      rebuildScene();
      // media & suara bersamaan di data lama: hanya media yang berbunyi (tidak bertabrakan)
      const akm = aksiObjek(cariObjek('om'));
      togelMediaObjek('om'); const loop = $('#mediaAudio').loop; togelMediaObjek('om'); const henti = !mediaObjekJalan('om');
      // "musik sendiri" lama dibaca sebagai media yang diulang
      const akl = aksiObjek(cariObjek('ol'));
      // musik latar dijeda selama media diputar, lalu lanjut
      PROJECT.bgm = { media: ma, ulang: true, otomatis: true, vol: 0.5 }; mulaiBGM(); await new Promise(r => setTimeout(r, 300));
      const bgmAwal = bgmMain(); togelMediaObjek('ol'); const bgmSaatMedia = bgmMain(); togelMediaObjek('ol'); await new Promise(r => setTimeout(r, 300)); const bgmLagi = bgmMain(); hentikanBGM();
      return { loop, henti, sfx: akm.sfx === undefined, lama: [akl.media === mus, akl.mediaUlang], mimeMusik: PROJECT.media[mus].mime, bgm: [bgmAwal, bgmSaatMedia, bgmLagi] };
    }, wav().toString('base64'));
    assert.deepEqual([r.loop, r.henti, r.sfx, r.lama, r.mimeMusik], [true, true, true, [true, true], 'audio/mp4']);
    if (r.bgm[0]) assert.deepEqual(r.bgm, [true, false, true]);   // peramban uji mengizinkan autoplay
  },
};
