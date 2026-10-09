import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { CORS } from './harness.mjs';

// JEV-076: interaksi tambahan per objek — DETAIL (panel + tombol buka tautan), MUSIK (berkas
// sendiri), HADAP KAMERA; beberapa aksi pada satu objek (duduk + detail)
function wav() {                                         // 0,2 s nada 440 Hz, mono 8 kHz
  const n = 1600, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / 8000 * 2 * Math.PI * 440) * 8000), 44 + i * 2);
  return b;
}
const sofa = page => page.evaluate(() => {
  PROJECT.levels[0].walls = [[0, 0, 8, 0], [8, 0, 8, 6], [8, 6, 0, 6], [0, 6, 0, 0]].map(([a, b, c, d]) => ({ id: uid('w'), x1: a, z1: b, x2: c, z2: d, thickness: 0.15, openings: [] }));
  PROJECT.levels[0].objects = []; addObject('furn', 'sofa3'); const o = L().objects[L().objects.length - 1]; o.x = 4; o.z = 4; o.rotY = Math.PI; rebuildScene();
  select('obj', o.id); renderInspector(); return o.id;
});
const centang = (page, teks) => page.evaluate(t => { const l = [...document.querySelectorAll('#inspector label.cek')].find(x => x.textContent.includes(t)); l.querySelector('input').click(); }, teks);

export const tes = {
  'detail: diisi di inspector, tautan hanya http(s); di mode jalan sofa punya dua aksi — Duduk & Lihat detail': async (page) => {
    const id = await sofa(page);
    await centang(page, 'Detail');
    const isi = async (label, nilai) => page.evaluate(([l, v]) => { const r = [...document.querySelectorAll('#inspector .f-row, #inspector .row, #inspector div')].find(x => x.querySelector('label') && x.querySelector('label').textContent.trim() === l);
      const i = r.querySelector('input,textarea'); i.value = v; i.dispatchEvent(new Event('change')); }, [label, nilai]);
    await isi('Judul', 'Sofa Linen Abu'); await isi('Keterangan', 'Rp 8.900.000 · 3 dudukan');
    await isi('Tautan', 'javascript:alert(1)');
    assert.equal(await page.evaluate(id => aksiObjek(cariObjek(id)).detail.url, id), '', 'tautan berbahaya ditolak');
    await isi('Tautan', 'https://contoh.example/sofa-linen');
    const ak = await page.evaluate(id => aksiObjek(cariObjek(id)), id);
    assert.deepEqual(ak.detail, { judul: 'Sofa Linen Abu', teks: 'Rp 8.900.000 · 3 dudukan', url: 'https://contoh.example/sofa-linen', gambar: null });
    // mode jalan: bidik sofa
    const r = await page.evaluate(async id => {
      window.__buka = []; window.open = (u, t, f) => { window.__buka.push([u, t, f]); return null; };
      enterFPS(); FPS.feet = 0; camera.position.set(4, 1.6, 5.4); FPS.yaw = Math.PI; FPS.pitch = -0.7; for (let i = 0; i < 3; i++) fpsStep(0);
      AIM_T = 0; stepBidik(0.2);
      const lain = [...document.querySelectorAll('#fpsAksiLain button')].map(b => b.textContent);
      document.querySelector('#fpsAksiLain button').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await new Promise(r => setTimeout(r, 300));
      const out = { jenis: AIM && AIM.jenis, ekstra: AIM && AIM.ekstra, utama: document.getElementById('fpsAct').textContent, lain,
        panel: !document.getElementById('detailPanel').hidden, judul: document.getElementById('detailJudul').textContent,
        teks: document.getElementById('detailTeks').textContent, host: document.getElementById('detailHost').textContent, gambar: !document.getElementById('detailGambar').hidden };
      document.getElementById('detailBuka').click(); out.buka = window.__buka;
      exitFPS(); out.tutup = document.getElementById('detailPanel').hidden; return out;
    }, id);
    assert.equal(r.jenis, 'duduk'); assert.deepEqual(r.ekstra, ['detail']);
    assert.match(r.utama, /Duduk/); assert.deepEqual(r.lain.map(t => t.replace(/^2/, '')), ['Lihat detail']);
    assert.deepEqual([r.panel, r.judul, r.teks, r.host, r.gambar], [true, 'Sofa Linen Abu', 'Rp 8.900.000 · 3 dudukan', 'contoh.example', true]);
    assert.deepEqual(r.buka, [['https://contoh.example/sofa-linen', '_blank', 'noopener,noreferrer']]);
    assert.equal(r.tutup, true, 'panel ditutup saat keluar mode jalan');
  },
  'musik sendiri: unggah WAV di inspector, diputar dari aksi objek, ikut lampiran tautan; berkas palsu ditolak': async (page) => {
    const id = await sofa(page);
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => [...document.querySelectorAll('#inspector button')].find(b => /Musik sendiri/.test(b.textContent)).click())]);
    await fc.setFiles({ name: 'santai.wav', mimeType: 'audio/wav', buffer: wav() });
    await page.waitForFunction(id => aksiObjek(cariObjek(id))?.musik, id, { timeout: 15000 });
    const m = await page.evaluate(id => { const ak = aksiObjek(cariObjek(id)); return [PROJECT.media[ak.musik].mime, PROJECT.media[ak.musik].nama, ak.ulang]; }, id);
    assert.deepEqual(m, ['audio/wav', 'santai', true]);
    const main = await page.evaluate(id => { enterFPS(); pakai({ jenis: 'musik', id }); const ada = MUSIK.main.has(id), loop = MUSIK.main.get(id).a.loop; pakai({ jenis: 'musik', id }); const henti = !MUSIK.main.has(id); exitFPS(); return [ada, loop, henti]; }, id);
    assert.deepEqual(main, [true, true, true]);
    // berkas bukan audio
    await page.evaluate(() => { document.getElementById('toast').textContent = ''; select('obj', L().objects[0].id); renderInspector(); });
    const [fc2] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => [...document.querySelectorAll('#inspector button')].find(b => /Ganti musik/.test(b.textContent)).click())]);
    await fc2.setFiles({ name: 'virus.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('<script>alert(1)</script>') });
    await page.waitForFunction(() => /Gagal/.test(document.getElementById('toast').textContent));
    // ikut tautan pendek sebagai lampiran
    const simpan = new Map();
    await page.route('**/api/tautan**', async r => { const q = r.request(), u = new URL(q.url()), h = u.searchParams.get('bagian');
      if (h) { if (q.method() === 'POST') { simpan.set(h, q.postDataBuffer()); return r.fulfill({ headers: CORS, json: { ok: true } }); } return r.fulfill({ headers: CORS, json: { ada: simpan.has(h) } }); }
      simpan.last = q.postDataBuffer(); return r.fulfill({ headers: CORS, json: { id: 'Mus1kAbCdE' } }); });
    await page.evaluate(() => buatTautanLihat());
    const isi = JSON.parse(zlib.inflateRawSync(simpan.last).toString());
    const mid = await page.evaluate(id => aksiObjek(cariObjek(id)).musik, id);
    assert.deepEqual(Object.keys(isi.lampiran.media), [mid]);
    assert.equal(isi.lampiran.media[mid].mime, 'audio/wav');
    assert.ok([...simpan.keys()].some(k => k === crypto.createHash('sha256').update(wav()).digest('hex')));
  },
  'hadap kamera: objek menoleh ke pengunjung di mode jalan, kembali saat keluar; jenis berkas dari isinya': async (page) => {
    const id = await sofa(page);
    await centang(page, 'menghadap pengunjung');
    const r = await page.evaluate(id => {
      const rot0 = grupObjek(id)[0].rotation.y;
      enterFPS(); const g = grupObjek(id)[0];                     // mode jalan membangun ulang scene
      camera.position.set(7, 1.6, 4); for (let i = 0; i < 60; i++) stepHadap(0.1);
      const ke = g.rotation.y, tuju = Math.atan2(7 - 4, 0);
      exitFPS(); for (let i = 0; i < 60; i++) stepHadap(0.1);
      const b = s => new Uint8Array([...s].map(c => c.charCodeAt(0)));
      return { selisih: Math.abs(Math.atan2(Math.sin(ke - tuju), Math.cos(ke - tuju))), balik: Math.abs(Math.atan2(Math.sin(grupObjek(id)[0].rotation.y - rot0), Math.cos(grupObjek(id)[0].rotation.y - rot0))),
        jenis: [jenisMedia(b('ID3\x03\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00')), jenisMedia(b('OggS\x00\x02\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00')), jenisMedia(b('\x00\x00\x00\x20ftypM4A \x00\x00\x00\x00')),
          jenisMedia(b('\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x00\x00')), jenisMedia(b('<html><body>xxxxxx'))] };
    }, id);
    assert.ok(r.selisih < 0.05, 'menoleh ke kamera: ' + r.selisih);
    assert.ok(r.balik < 0.05, 'kembali ke rotasinya di editor: ' + r.balik);
    assert.deepEqual(r.jenis, ['audio/mpeg', 'audio/ogg', 'audio/mp4', 'image/jpeg', null]);
  },
};
