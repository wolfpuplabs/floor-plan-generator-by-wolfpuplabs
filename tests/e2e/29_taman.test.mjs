import assert from 'node:assert/strict';

// JEV-080: tab Taman terpisah (rumput 6 × 6 m bawaan, bisa disembunyikan), objek lingkungan
// (pohon, semak, batu, jalan), bentuk dasar berwarna, suara interaksi (klik / swoosh / audio
// sendiri), unggah audio & gambar yang dulu gagal (input lepas di iOS, M4A "mp42", HEIC/BMP)
function wav() {                                         // 0,2 s nada 440 Hz, mono 8 kHz
  const n = 1600, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / 8000 * 2 * Math.PI * 440) * 8000), 44 + i * 2);
  return b;
}
function m4a() {                                         // kepala ftyp bermerek "mp42" (umum pada M4A iPhone/perekam)
  const b = Buffer.alloc(64); b.writeUInt32BE(32, 0); b.write('ftyp', 4); b.write('mp42', 8); b.write('isommp42M4A ', 16); return b;
}
function bmp() {                                         // 2 × 2 piksel, 24 bit — bukan format web: dikonversi ke JPEG
  const b = Buffer.alloc(54 + 16); b.write('BM', 0); b.writeUInt32LE(b.length, 2); b.writeUInt32LE(54, 10); b.writeUInt32LE(40, 14);
  b.writeInt32LE(2, 18); b.writeInt32LE(2, 22); b.writeUInt16LE(1, 26); b.writeUInt16LE(24, 28); b.writeUInt32LE(16, 34);
  for (let i = 0; i < 16; i++) b[54 + i] = i % 3 === 2 ? 220 : 40; return b;
}
const pilihDiInspector = (page, label, nilai) => page.evaluate(([l, v]) => {
  const r = [...document.querySelectorAll('#inspector .f-row')].find(x => x.querySelector('label') && x.querySelector('label').textContent.trim() === l);
  const s = r.querySelector('select,input'); s.value = v; s.dispatchEvent(new Event('change'));
}, [label, nilai]);
async function unggahLewatTombol(page, teksTombol, berkas) {
  const [pilih] = await Promise.all([page.waitForEvent('filechooser'),
    page.evaluate(t => [...document.querySelectorAll('#inspector button')].find(b => b.textContent.includes(t)).click(), teksTombol)]);
  await pilih.setFiles(berkas);
}

export const tes = {
  'taman: tab sendiri, rumput 6 × 6 m bawaan, bisa disembunyikan & tersimpan; objek lingkungan per kategori': async (page) => {
    assert.deepEqual(await page.evaluate(() => [PROJECT.site.tanah, adaTanahSitus(), luasSitus()]), ['rumput', true, [-3, 3, -3, 3]]);
    assert.equal(await page.evaluate(() => { let n = 0; scene.traverse(o => { if (o.userData.situs && o.visible) n++; }); return n > 0; }), true, 'rumput tampil sejak awal');
    // tempatnya: tab Taman, bukan Objek
    const panel = await page.evaluate(() => ['situsTanah', 'situsTampil', 'cat-taman', 'cat-situs', 'tanahKuas', 'cat-bentuk'].map(id => document.getElementById(id).closest('.tab-body').dataset.panel));
    assert.deepEqual(panel, ['taman', 'taman', 'taman', 'taman', 'taman', 'objects']);
    assert.equal(await page.evaluate(() => !!document.querySelector('#furn-filter option[value="taman"]')), false);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('#cat-furn .cat-item')].some(b => ['Pohon Rindang', 'Batu Hias', 'Semak', 'Gazebo', 'Kotak'].includes(b.textContent))), false, 'katalog furnitur tanpa objek taman & bentuk');
    await page.click('.tabs button[data-tab="taman"]');
    const semua = await page.$$eval('#cat-taman .cat-item', bs => bs.map(b => b.textContent));
    for (const n of ['Pohon Rindang', 'Semak Bulat', 'Batu Besar', 'Jalan Paving', 'Batu Pijakan', 'Jalan Papan Kayu', 'Rumput Hias']) assert.ok(semua.includes(n), n + ' ada di katalog taman');
    await page.selectOption('#taman-filter', 'batu');
    assert.deepEqual((await page.$$eval('#cat-taman .cat-item', bs => bs.map(b => b.textContent))).sort(), ['Batu Besar', 'Batu Hias', 'Kerikil Hias']);
    await page.selectOption('#taman-filter', 'jalan');
    assert.deepEqual((await page.$$eval('#cat-taman .cat-item', bs => bs.map(b => b.textContent))).sort(), ['Batu Pijakan', 'Jalan Kerikil', 'Jalan Papan Kayu', 'Jalan Paving']);
    // menaruh jalan paving: objek taman biasa (bisa digeser/diputar), tidak menghalangi
    await page.click('#cat-taman .cat-item:has-text("Jalan Paving")');
    assert.equal(await page.evaluate(() => L().objects.at(-1).type), 'jalur_paving');
    // sembunyikan → tidak ada tanah; tersimpan & disaring; tampilkan lagi
    await page.click('#situsTampil');
    assert.deepEqual(await page.evaluate(() => [PROJECT.site.sembunyi, adaTanahSitus()]), [true, false]);
    assert.equal(await page.evaluate(() => { let n = 0; scene.traverse(o => { if (o.userData.situs && o.visible) n++; }); return n; }), 0);
    assert.equal(await page.evaluate(() => sanitasiProyek(JSON.parse(JSON.stringify({ levels: PROJECT.levels, site: PROJECT.site }))).site.sembunyi), true);
    assert.equal(await page.evaluate(() => sanitasiProyek({ levels: PROJECT.levels, site: { tanah: 'rumput', sembunyi: 'ya' } }).site.sembunyi), undefined, 'hanya true yang diterima');
    await page.click('#situsTampil');
    assert.deepEqual(await page.evaluate(() => [PROJECT.site.sembunyi, adaTanahSitus()]), [undefined, true]);
    // dengan rumah: tanah meluas sejauh "luas di luar bangunan"
    const luas = await page.evaluate(() => { PROJECT.levels[0].walls = [{ id: uid('w'), x1: 0, z1: 0, x2: 10, z2: 0, thickness: 0.15, openings: [] }, { id: uid('w'), x1: 10, z1: 0, x2: 10, z2: 8, thickness: 0.15, openings: [] }];
      PROJECT.levels[0].objects = []; rebuildScene(); return luasSitus(); });
    assert.deepEqual(luas, [-6, 16, -6, 14]);
  },
  'bentuk dasar: kotak, silinder, bola, kerucut; warna dari inspector tersimpan & disaring': async (page) => {
    await page.click('.tabs button[data-tab="objects"]');
    assert.deepEqual(await page.$$eval('#cat-bentuk .cat-item', bs => bs.map(b => b.textContent)), ['Kotak', 'Silinder', 'Bola', 'Kerucut', 'Prisma bebas (tracing)']);
    await page.click('#cat-bentuk .cat-item:has-text("Bola")');
    const id = await page.evaluate(() => SEL && SEL.id);
    assert.ok(id, 'bola terpilih setelah ditaruh');
    await pilihDiInspector(page, 'Warna', '#c0392b');
    const warna = await page.evaluate(id => { let c = null; for (const g of grupObjek(id)) g.traverse(m => { if (m.isMesh && m.userData.bentuk) c = m.material.color.getHexString(); }); return [cariObjek(id).params.warna, c]; }, id);
    assert.deepEqual(warna, ['#c0392b', 'c0392b']);
    // warna tidak sah dari berkas: diabaikan, bentuk tetap warna bawaan
    const aman = await page.evaluate(id => { const o = cariObjek(id); o.params.warna = 'red;background:url(x)'; rebuildScene(); let c = null; for (const g of grupObjek(id)) g.traverse(m => { if (m.isMesh && m.userData.bentuk) c = m.material.color.getHexString(); }); return c; }, id);
    assert.equal(aman, 'd8d2c4');
  },
  'suara interaksi: klik / swoosh / audio sendiri; unggah audio (M4A mp42, WAV) & gambar non-web (BMP → JPEG) lewat pemilih berkas': async (page) => {
    const id = await page.evaluate(() => {
      PROJECT.levels[0].walls = []; PROJECT.levels[0].objects = []; addObject('furn', 'bentuk_kotak'); const o = L().objects.at(-1); o.x = 0; o.z = 2; rebuildScene();
      select('obj', o.id); renderInspector();
      // input berkas harus menempel di dokumen saat diklik (iOS Safari)
      window.__terpasang = []; const asli = HTMLInputElement.prototype.click;
      HTMLInputElement.prototype.click = function () { if (this.type === 'file') window.__terpasang.push(this.isConnected); return asli.call(this); };
      window.__sfx = []; const sfxAsli = window.sfx; window.sfx = (j, t) => { window.__sfx.push(j); return sfxAsli(j, t); };
      return o.id;
    });
    // objek tanpa aksi lain + suara swoosh → di mode jalan aksinya "Bunyikan"
    await pilihDiInspector(page, 'Suara saat diketuk', 'swoosh');
    assert.equal(await page.evaluate(id => aksiObjek(cariObjek(id)).sfx, id), 'swoosh');
    const aksi = await page.evaluate(id => {
      enterFPS(); FPS.feet = 0; camera.position.set(0, 1.6, 4.2); FPS.yaw = Math.PI; FPS.pitch = -0.35; for (let i = 0; i < 3; i++) fpsStep(0);
      AIM_T = 0; stepBidik(0.2); const lbl = labelAksi(AIM); const j = AIM && AIM.jenis; pakai(AIM); const pos = camera.position.toArray().map(v => +v.toFixed(2)); exitFPS(); return [j, lbl, pos];
    }, id);
    assert.deepEqual(aksi.slice(0, 2), ['bunyi', 'Bunyikan'], JSON.stringify(aksi));
    assert.ok((await page.evaluate(() => window.__sfx)).includes('swoosh'), 'swoosh berbunyi');
    // audio sendiri: pilih "Audio sendiri" lalu unggah WAV → diputar dari objek
    await page.evaluate(id => { select('obj', id); renderInspector(); }, id);
    await pilihDiInspector(page, 'Suara saat diketuk', 'unggah');
    await unggahLewatTombol(page, 'Pilih audio', { name: 'ketuk.wav', mimeType: 'audio/wav', buffer: wav() });
    await page.waitForFunction(id => aksiObjek(cariObjek(id))?.sfxMedia, id, { timeout: 15000 });
    const main = await page.evaluate(async id => { let n = 0; document.getElementById('toast').textContent = ''; const s = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function (...a) { n++; return s.apply(this, a); };
      audioSiap(); await sfxObjek(id); return [n, SFX.on, document.getElementById('toast').textContent, PROJECT.media[aksiObjek(cariObjek(id)).sfxMedia].mime]; }, id);
    assert.ok(main[0] >= 1 && !/tidak bisa diputar/.test(main[2]), 'audio sendiri diputar: ' + JSON.stringify(main));
    // musik sendiri berupa M4A berlabel "mp42" diterima sebagai audio (dulu ditolak sebagai video)
    await unggahLewatTombol(page, 'Musik sendiri', { name: 'lagu.m4a', mimeType: 'audio/mp4', buffer: m4a() });
    await page.waitForFunction(id => aksiObjek(cariObjek(id))?.musik, id, { timeout: 15000 });
    assert.equal(await page.evaluate(id => PROJECT.media[aksiObjek(cariObjek(id)).musik].mime, id), 'audio/mp4');
    // gambar detail berformat lain (BMP; HEIC di iPhone) dikonversi ke JPEG
    await page.evaluate(() => { const l = [...document.querySelectorAll('#inspector label.cek')].find(x => x.textContent.includes('Detail')); l.querySelector('input').click(); });
    await unggahLewatTombol(page, 'Gambar sendiri', { name: 'foto.bmp', mimeType: 'image/bmp', buffer: bmp() });
    await page.waitForFunction(id => aksiObjek(cariObjek(id))?.detail?.gambar, id, { timeout: 15000 });
    assert.equal(await page.evaluate(id => PROJECT.media[aksiObjek(cariObjek(id)).detail.gambar].mime, id), 'image/jpeg');
    assert.ok((await page.evaluate(() => window.__terpasang)).every(Boolean), 'semua input berkas terpasang di dokumen saat diklik');
    // media ikut disaring: suara sendiri bertahan setelah simpan → muat
    const ulang = await page.evaluate(() => { const B = sanitasiProyek(JSON.parse(JSON.stringify(PROJECT))); const o = B.levels[0].objects[0]; return [o.params.aksi.sfx, !!B.media[o.params.aksi.sfxMedia]]; });
    assert.deepEqual(ulang, ['unggah', true]);
  },
};
