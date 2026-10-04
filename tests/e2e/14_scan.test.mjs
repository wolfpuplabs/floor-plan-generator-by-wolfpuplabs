import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { FIX, CORS } from './harness.mjs';

// JEV-063: model hasil scan 3D — Sketchfab bertag photogrammetry/3D scan ikut dicari, ditandai &
// didahulukan; Google Scanned Objects (Gazebo Fuel, CC-BY 4.0) sebagai sumber tanpa token
function buatZip(entri) {
  const lokal = [], pusat = []; let off = 0;
  for (const e of entri) {
    const nm = Buffer.from(e.nama), isi = zlib.deflateRawSync(e.data), crc = zlib.crc32(e.data);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(8, 8);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(isi.length, 18); h.writeUInt32LE(e.data.length, 22); h.writeUInt16LE(nm.length, 26);
    lokal.push(h, nm, isi);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(8, 10);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(isi.length, 20); c.writeUInt32LE(e.data.length, 24); c.writeUInt16LE(nm.length, 28); c.writeUInt32LE(off, 42);
    pusat.push(c, nm); off += 30 + nm.length + isi.length;
  }
  const cd = Buffer.concat(pusat), e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(entri.length, 8); e.writeUInt16LE(entri.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...lokal, cd, e]);
}
const baca = n => fs.readFileSync(path.join(FIX, n));
const uid = c => c.repeat(32);
const model = (c, nama, lis, tags = [], suka = 0) => ({ uid: uid(c), name: nama, user: { displayName: 'P' + c }, license: { label: lis }, likeCount: suka,
  tags: tags.map(t => ({ slug: t, name: t })), thumbnails: { images: [{ url: 'https://media.sketchfab.example/' + c + '.jpg', width: 256 }] } });

// cangkir hasil scan ala Google Scanned Objects: meshes/model.obj + model.mtl, tekstur di materials/textures (satuan meter)
const OBJ = `mtllib model.mtl\n${[[0,0,0],[0.1,0,0],[0.1,0.1,0],[0,0.1,0],[0,0,0.1],[0.1,0,0.1],[0.1,0.1,0.1],[0,0.1,0.1]].map(v => 'v ' + v.join(' ')).join('\n')}
vt 0 0\nvt 1 0\nvt 1 1\nvt 0 1\nusemtl bahan\n${[[1,2,3,4],[5,8,7,6],[1,5,6,2],[2,6,7,3],[3,7,8,4],[5,1,4,8]].map(f => 'f ' + f.map((v, i) => v + '/' + (i + 1)).join(' ')).join('\n')}\n`;
const ZIP_GSO = () => buatZip([{ nama: 'model.config', data: Buffer.from('<model/>') }, { nama: 'model.sdf', data: Buffer.from('<sdf/>') },
  { nama: 'meshes/model.obj', data: Buffer.from(OBJ) }, { nama: 'meshes/model.mtl', data: Buffer.from('newmtl bahan\nKd 1 1 1\nmap_Kd texture.png\n') },
  { nama: 'materials/textures/texture.png', data: baca('plan_test.png') }, { nama: 'thumbnails/0.jpg', data: baca('kursi_diff_1k.jpg') }]);
const ID_GSO = 'Room_Essentials_Mug_White_Yellow';

export const tes = {
  'Sketchfab: model bertag photogrammetry / 3D scan ikut dicari, ditandai 📷 & didahulukan, bisa disaring': async (page) => {
    const diminta = [];
    await page.route('https://api.sketchfab.com/**', r => {
      const u = new URL(r.request().url()); diminta.push(u.searchParams.get('tags') || '');
      const tag = u.searchParams.get('tags');
      const hasil = !tag ? [model('a', 'Sofa Biasa', 'CC Attribution', [], 900), model('b', 'Sofa Scan', 'CC0 Public Domain', ['photogrammetry', 'sofa'], 10),
        model('c', 'Sofa NC', 'CC Attribution-NonCommercial', ['photogrammetry'])]
        : tag === 'photogrammetry' ? [model('d', 'Kursi Kayu Scan', 'CC Attribution', [], 50)]
        : tag === '3dscan' ? [model('d', 'Kursi Kayu Scan', 'CC Attribution', [], 50), model('e', 'Bangku Batu', 'CC Attribution-ShareAlike', [], 5)]
        : [];
      return r.fulfill({ headers: CORS, json: { results: hasil } });
    });
    await page.route('https://media.sketchfab.example/**', r => r.fulfill({ headers: CORS, body: baca('kursi_diff_1k.jpg') }));
    await page.evaluate(() => bukaGaleri());
    await page.selectOption('#galeriSumber', 'skf');
    await page.fill('#galeriCari', 'sofa');
    // galeri sudah menampilkan hasil jelajah tanpa kata kunci: tunggu pencarian "sofa" benar-benar selesai
    await page.waitForFunction(() => SKF.q === 'sofa' && /hasil scan/.test(document.getElementById('galeriInfo').textContent), undefined, { timeout: 30000 });
    assert.deepEqual([...new Set(diminta)].sort(), ['', '3d-scan', '3dscan', 'photogrammetry', 'scan']);
    const kartu = await page.$$eval('#galeriGrid .gl-card', ks => ks.map(k => [k.dataset.id[0], !!k.querySelector('.gl-scan')]));
    assert.deepEqual(kartu, [['d', true], ['b', true], ['e', true], ['a', false]], 'hasil scan didahulukan (urut suka), NC disaring, tanpa duplikat');
    assert.match(await page.textContent('#galeriInfo'), /4 model berlisensi bebas-komersial .* · 3 hasil scan 3D \/ fotogrametri/);
    await page.selectOption('#galeriKat', 'scan');
    assert.deepEqual(await page.$$eval('#galeriGrid .gl-card', ks => ks.map(k => k.dataset.id[0])), ['d', 'b', 'e']);
  },
  'Google Scanned Objects: cari tanpa token, ZIP OBJ hasil scan jadi model, atribusi CC-BY & ikut tautan lihat': async (page) => {
    const zip = ZIP_GSO(), diminta = [];
    await page.route('https://fuel.gazebosim.org/**', r => {
      const u = new URL(r.request().url()); diminta.push(u.pathname + u.search);
      if (u.pathname.endsWith('.zip')) return r.fulfill({ headers: { ...CORS, 'content-type': 'application/zip' }, body: zip });
      if (u.pathname.endsWith('.jpg')) return r.fulfill({ headers: CORS, body: baca('kursi_diff_1k.jpg') });
      return r.fulfill({ headers: CORS, json: [
        { name: ID_GSO, owner: 'GoogleResearch', thumbnail_url: `/1.0/GoogleResearch/models/${ID_GSO}/1/files/thumbnails/0.jpg` },
        { name: '../../evil', owner: 'GoogleResearch' }, { name: 'Threshold_Porcelain_Teapot_White' }] });
    });
    await page.evaluate(() => bukaGaleri());
    await page.selectOption('#galeriSumber', 'gso');
    await page.locator('#galeriRuang button[data-ruang="dapur"]').click();
    await page.waitForFunction(() => document.querySelectorAll('#galeriGrid .gl-card').length === 2, undefined, { timeout: 30000 });
    assert.ok(diminta.some(d => /\/1\.0\/GoogleResearch\/models\?.*q=mug/.test(d)), JSON.stringify(diminta));
    const kartu = await page.$$eval('#galeriGrid .gl-card', ks => ks.map(k => [k.dataset.id, k.querySelector('span').textContent, k.querySelector('img').src]));
    assert.equal(kartu[0][0], ID_GSO); assert.equal(kartu[0][1], 'Room Essentials Mug White Yellow');
    assert.equal(kartu[0][2], `https://fuel.gazebosim.org/1.0/GoogleResearch/models/${ID_GSO}/1/files/thumbnails/0.jpg`);
    assert.match(kartu[1][2], /Threshold_Porcelain_Teapot_White\/tip\/files\/thumbnails\/0\.jpg$/);
    await page.locator(`#galeriGrid .gl-card[data-id="${ID_GSO}"]`).click();
    await page.waitForFunction(() => !GALERI.sibuk && /dipasang|Gagal/.test(document.getElementById('galeriInfo').textContent), undefined, { timeout: 60000 });
    assert.match(await page.textContent('#galeriInfo'), /dipasang/);
    const r = await page.evaluate(() => { const id = Object.keys(PROJECT.assets).pop(), a = PROJECT.assets[id]; let tex = 0;
      ASSET_OBJ.get(id).traverse(m => { if (m.isMesh && m.material && m.material.map) tex++; });
      const B = sanitasiProyek(JSON.parse(JSON.stringify(PROJECT)));
      return { sumber: a.sumber, lisensi: a.lisensi, dims: a.dims, tex, tersimpan: B.assets[id].sumber, rujukan: rujukanAset(a) }; });
    assert.equal(r.sumber, 'https://app.gazebosim.org/GoogleResearch/fuel/models/' + ID_GSO);
    assert.equal(r.lisensi, 'CC-BY 4.0 — Google Research (Google Scanned Objects)');
    assert.equal(r.tersimpan, r.sumber);
    assert.deepEqual(r.dims, [0.1, 0.1, 0.1], 'satuan meter dipertahankan');
    assert.equal(r.tex, 1, 'tekstur di materials/textures ikut terpasang');
    assert.deepEqual(r.rujukan, { jenis: 'gso', id: ID_GSO }, 'model ikut tautan lihat-saja sebagai rujukan');
    assert.equal(await page.evaluate(() => rujukanAset({ sumber: 'https://app.gazebosim.org/GoogleResearch/fuel/models/..%2F..%2Fevil' })), null);
  },
  'Google Scanned Objects: unduhan ditolak peramban → arahan unduh manual + tautan halaman model': async (page) => {
    await page.route('https://fuel.gazebosim.org/**', r => {
      if (r.request().url().endsWith('.zip')) return r.abort('failed');
      return r.fulfill({ headers: CORS, json: [{ name: ID_GSO }] });
    });
    await page.evaluate(() => bukaGaleri());
    await page.selectOption('#galeriSumber', 'gso');
    await page.waitForFunction(() => document.querySelectorAll('#galeriGrid .gl-card').length === 1, undefined, { timeout: 30000 });
    await page.locator('#galeriGrid .gl-card').click();
    await page.waitForFunction(() => !GALERI.sibuk && /Gagal/.test(document.getElementById('galeriInfo').textContent), undefined, { timeout: 30000 });
    assert.match(await page.textContent('#galeriInfo'), /unduh ZIP-nya, lalu unggah/);
    const a = await page.$eval('#galeriSitus a', x => [x.href, x.target, x.rel]);
    assert.deepEqual(a, ['https://app.gazebosim.org/GoogleResearch/fuel/models/' + ID_GSO, '_blank', 'noopener noreferrer']);
  },
};
