import assert from 'node:assert/strict';

// JEV-065: lantai lain yang tembus pandang tidak lagi menyala putih (kaca), material lantai per
// tingkat, dan layar TV yang menyala memutar tayangan bergerak (saluran bawaan, GIF, video)
const kotak = (x0, z0, x1, z1) => [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]]
  .map(([a, b, c, d]) => ({ x1: a, z1: b, x2: c, z2: d }));

// GIF animasi 4×4, dua bingkai (merah lalu biru), LZW tanpa kamus (CLEAR sebelum tiap piksel)
function buatGIF() {
  const b = [...Buffer.from('GIF89a'), 4, 0, 4, 0, 0xF1, 0, 0, 255, 0, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255];
  b.push(0x21, 0xFF, 11, ...Buffer.from('NETSCAPE2.0'), 3, 1, 0, 0, 0);
  for (const warna of [0, 1]) {
    b.push(0x21, 0xF9, 4, 0x04, 2, 0, 0, 0);                      // jeda 20 ms
    b.push(0x2C, 0, 0, 0, 0, 4, 0, 4, 0, 0, 2);
    const kode = []; for (let i = 0; i < 16; i++) kode.push(4, warna); kode.push(5);
    const bytes = []; let acc = 0, n = 0;
    for (const k of kode) { acc |= k << n; n += 3; while (n >= 8) { bytes.push(acc & 255); acc >>= 8; n -= 8; } }
    if (n) bytes.push(acc & 255);
    b.push(bytes.length, ...bytes, 0);
  }
  b.push(0x3B);
  return Buffer.from(b);
}
const pasangTV = page => page.evaluate(() => {
  PROJECT.levels[0].walls = []; PROJECT.levels[0].objects = [];
  addObject('furn', 'tv_set'); const o = L().objects[L().objects.length - 1]; select('obj', o.id); renderInspector(); return o.id;
});
const layar = (page, id) => page.evaluate(id => { let m = null; for (const g of grupObjek(id)) g.traverse(x => { if (x.isMesh && x.userData.layarTV) m = x; });
  const t = m && m.material.emissiveMap, c = t && t.image;
  const isi = c && c.getContext ? c.getContext('2d').getImageData(0, 0, c.width, c.height).data : null;
  let jumlah = 0; if (isi) for (let i = 0; i < isi.length; i += 97) jumlah += isi[i];
  const px = isi ? [isi[0], isi[1], isi[2]] : null;
  return { ada: !!m, kanvas: !!(c && c.getContext), video: !!(t && t.isVideoTexture), jumlah, px }; }, id);

export const tes = {
  'lantai lain tembus pandang: kaca tidak menyala putih (blending normal)': async (page) => {
    const r = await page.evaluate(kt => {
      const isi = k => k.map(w => ({ id: uid('w'), ...w, thickness: 0.15, openings: [] }));
      PROJECT.levels[0].walls = isi(kt); PROJECT.levels[0].walls[0].openings = [{ id: uid('o'), type: 'window', at: 2, width: 1.5, sill: 0.9, head: 2.1 }];
      PROJECT.levels[0].objects = [];
      addLevel(); PROJECT.levels[1].walls = isi(kt); PROJECT.levels[1].walls[0].openings = [{ id: uid('o'), type: 'window', at: 2, width: 1.5, sill: 0.9, head: 2.1 }];
      PROJECT.active = 0; document.getElementById('otherLevels').value = 'ghost'; rebuildScene();
      let khusus = 0, kacaHantu = 0;
      levelGroups[1].traverse(m => { if (!m.isMesh) return; for (const b of [].concat(m.material)) { if (b.transparent && b.blending === THREE.CustomBlending) khusus++; if (b.opacity <= 0.08 && b.transparent) kacaHantu++; } });
      return { khusus, kacaHantu, kacaAsli: !!MAT.glass.userData.kaca && MAT.glass.blending === THREE.CustomBlending };
    }, kotak(0, 0, 6, 5));
    assert.equal(r.khusus, 0, 'bahan lantai hantu tidak boleh memakai blending premultiplied kaca');
    assert.ok(r.kacaHantu >= 1, 'kaca lantai hantu dibuat lebih tipis');
    assert.equal(r.kacaAsli, true, 'kaca lantai aktif tetap memakai shader kaca');
  },
  'material lantai per tingkat: bawah keramik, atas parket — tersimpan & disaring': async (page) => {
    const r = await page.evaluate(kt => {
      const isi = k => k.map(w => ({ id: uid('w'), ...w, thickness: 0.15, openings: [] }));
      PROJECT.levels[0].walls = isi(kt); PROJECT.levels[0].objects = []; PROJECT.finish.floor = 'keramik';
      addLevel(); PROJECT.levels[1].walls = isi(kt); PROJECT.levels[1].objects = [];
      setActiveLevel(1); pilihTab('levels'); renderLevels();
      return true;
    }, kotak(0, 0, 6, 5));
    assert.ok(r);
    const sel = page.locator('#lvl-props select').filter({ has: page.locator('option[value="parket"]') });
    await sel.selectOption('parket');
    const h = await page.evaluate(() => {
      const pelat = i => { let m = null; levelGroups[i].traverse(x => { if (x.isMesh && x.userData.slab) m = x; }); return [].concat(m.material).map(b => b.uuid); };
      const B = sanitasiProyek(JSON.parse(JSON.stringify({ ...PROJECT, levels: PROJECT.levels.map((l, i) => i === 0 ? { ...l, lantai: '<img onerror=x>' } : l) })));
      return { l1: pelat(0), l2: pelat(1), simpan: PROJECT.levels[1].lantai, tersaring: [B.levels[0].lantai, B.levels[1].lantai] };
    });
    assert.equal(h.simpan, 'parket');
    assert.notDeepEqual(h.l1, h.l2, 'pelat lantai 1 dan 2 harus memakai bahan berbeda');
    assert.deepEqual(h.tersaring, [undefined, 'parket'], 'nilai lantai tak dikenal dibuang');
    // kembali ikut proyek
    await sel.selectOption('');
    assert.equal(await page.evaluate(() => PROJECT.levels[1].lantai), undefined);
  },
  'TV menyala: saluran bawaan bergerak, bisa diganti, mati kembali ke layar gelap': async (page) => {
    const id = await pasangTV(page);
    await page.waitForSelector('#inspector:not([hidden])');
    assert.match(await page.textContent('#inspector'), /Layar TV/);
    await page.click('#inspector button:has-text("Nyalakan TV")');
    await page.waitForFunction(id => TV_NYALA.has(id), id);
    const a = await layar(page, id);
    assert.ok(a.ada && a.kanvas, JSON.stringify(a));
    await page.waitForFunction(([id, j]) => { let m = null; for (const g of grupObjek(id)) g.traverse(x => { if (x.isMesh && x.userData.layarTV) m = x; });
      const c = m.material.emissiveMap.image, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 0; i < d.length; i += 97) s += d[i]; return s !== j; }, [id, a.jumlah], { timeout: 30000 });
    // ganti saluran
    const pil = page.locator('#inspector select').filter({ has: page.locator('option[value="kanal:akuarium"]') });
    await pil.selectOption('kanal:akuarium');
    assert.equal(await page.evaluate(id => cariObjek(id).params.tvKanal, id), 'akuarium');
    assert.equal(await page.evaluate(id => TV.kunci.get(id), id), 'kanal:akuarium');
    await page.click('#inspector button:has-text("Matikan TV")');
    assert.equal(await page.evaluate(id => { let m = null; for (const g of grupObjek(id)) g.traverse(x => { if (x.isMesh && x.userData.layarTV) m = x; }); return m.material === MAT.screen; }, id), true);
  },
  'TV: GIF sendiri diputar bingkai demi bingkai, tersimpan di proyek; berkas bukan video ditolak': async (page) => {
    const id = await pasangTV(page);
    await page.waitForSelector('#inspector:not([hidden])');
    await page.evaluate(() => { document.getElementById('toast').textContent = ''; });
    await page.evaluate(id => { document.getElementById('tvMediaInput').dataset.obj = id; }, id);
    await page.setInputFiles('#tvMediaInput', { name: 'film.gif', mimeType: 'image/gif', buffer: buatGIF() });
    await page.waitForFunction(() => /Tayangan TV/.test(document.getElementById('toast').textContent), undefined, { timeout: 30000 });
    const m = await page.evaluate(() => Object.values(PROJECT.media).map(x => [x.nama, x.mime]));
    assert.deepEqual(m, [['film', 'image/gif']]);
    const warna = new Set();
    // WebGL perangkat lunak di CI: satu bingkai gambar bisa 1–2 detik — beri waktu cukup
    // layar dicicipi tiap bingkai gambar (rAF), bukan tiap 250 ms: GIF 2 bingkai berganti tiap langkah render,
    // dan cicipan berselang tetap bisa selalu jatuh pada bingkai yang sama di mesin CI yang lajunya stabil
    await page.evaluate(id => { window.__warnaTV = new Set();
      const cicip = () => { let m = null; for (const g of grupObjek(id)) g.traverse(x => { if (x.isMesh && x.userData.layarTV) m = x; });
        const c = m && m.material.emissiveMap && m.material.emissiveMap.image;
        if (c && c.getContext) { const d = c.getContext('2d').getImageData(0, 0, 1, 1).data; window.__warnaTV.add(d[0] + ',' + d[1] + ',' + d[2]); }
        if (window.__warnaTV.size < 8) requestAnimationFrame(cicip); };
      requestAnimationFrame(cicip); }, id);
    await page.waitForFunction(() => window.__warnaTV.has('255,0,0') && window.__warnaTV.has('0,0,255'), undefined, { timeout: 30000 })
      .catch(() => {});
    for (const w of await page.evaluate(() => [...window.__warnaTV])) warna.add(w);
    assert.deepEqual([...warna].filter(w => w === '255,0,0' || w === '0,0,255').sort(), ['0,0,255', '255,0,0'], 'kedua bingkai GIF tampil bergantian: ' + [...warna].join(' | '));
    const B = await page.evaluate(() => { const j = sanitasiProyek(JSON.parse(JSON.stringify(PROJECT)));
      const jahat = sanitasiProyek({ ...JSON.parse(JSON.stringify(PROJECT)), media: { x1: { nama: 'a', mime: 'text/html', data: 'PGI+' } } });
      return [Object.keys(j.media).length, Object.keys(jahat.media).length]; });
    assert.deepEqual(B, [1, 0]);
    await page.evaluate(() => { document.getElementById('toast').textContent = ''; });
    await page.setInputFiles('#tvMediaInput', { name: 'bukan.mp4', mimeType: 'video/mp4', buffer: Buffer.from('ini bukan video sama sekali') });
    await page.waitForFunction(() => /Gagal/.test(document.getElementById('toast').textContent));
    assert.equal(await page.evaluate(() => Object.keys(PROJECT.media).length), 1);
  },
  'TV: video sendiri (WebM) diputar bisu & berulang lewat VideoTexture': async (page) => {
    const id = await pasangTV(page);
    // video uji direkam dari kanvas di halaman itu sendiri (tanpa berkas biner di repo)
    const b64 = await page.evaluate(async () => {
      if (typeof MediaRecorder !== 'function' || !MediaRecorder.isTypeSupported('video/webm')) return null;
      const c = document.createElement('canvas'); c.width = 64; c.height = 36; const x = c.getContext('2d');
      const rec = new MediaRecorder(c.captureStream(15), { mimeType: 'video/webm' }), bag = [];
      rec.ondataavailable = e => bag.push(e.data); rec.start();
      for (let i = 0; i < 12; i++) { x.fillStyle = `hsl(${i * 30},80%,50%)`; x.fillRect(0, 0, 64, 36); await new Promise(r => setTimeout(r, 70)); }
      rec.stop(); await new Promise(r => { rec.onstop = r; });
      return b64FromBuf(await new Blob(bag, { type: 'video/webm' }).arrayBuffer());
    });
    if (!b64) { console.log('      (MediaRecorder tidak tersedia — uji video dilewati)'); return; }
    await page.evaluate(id => { document.getElementById('toast').textContent = ''; document.getElementById('tvMediaInput').dataset.obj = id; }, id);
    await page.setInputFiles('#tvMediaInput', { name: 'klip.webm', mimeType: 'video/webm', buffer: Buffer.from(b64, 'base64') });
    await page.waitForFunction(() => /Tayangan TV/.test(document.getElementById('toast').textContent), undefined, { timeout: 30000 });
    const s = await layar(page, id);
    assert.equal(s.video, true);
    const v = await page.evaluate(() => { const S = [...TV.sumber.values()].find(x => x.video); return { muted: S.video.muted, loop: S.video.loop, inline: S.video.playsInline }; });
    assert.deepEqual(v, { muted: true, loop: true, inline: true });
  },
};
