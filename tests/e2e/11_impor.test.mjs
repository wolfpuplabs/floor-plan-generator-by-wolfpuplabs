import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { FIX, CORS } from './harness.mjs';

// JEV-060: impor model dari situs lain (ZIP glTF, OBJ+MTL, FBX) + Sketchfab (lisensi, token, atribusi)
function buatZip(entri) {
  const lokal = [], pusat = []; let off = 0;
  for (const e of entri) {
    const nm = Buffer.from(e.nama), simpan = !!e.simpan, isi = simpan ? e.data : zlib.deflateRawSync(e.data), crc = zlib.crc32(e.data);
    const uk = e.ukuranPalsu ?? e.data.length;
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(simpan ? 0 : 8, 8);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(isi.length, 18); h.writeUInt32LE(uk, 22); h.writeUInt16LE(nm.length, 26);
    lokal.push(h, nm, isi);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(simpan ? 0 : 8, 10);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(isi.length, 20); c.writeUInt32LE(uk, 24); c.writeUInt16LE(nm.length, 28); c.writeUInt32LE(off, 42);
    pusat.push(c, nm); off += 30 + nm.length + isi.length;
  }
  const cd = Buffer.concat(pusat), e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(entri.length, 8); e.writeUInt16LE(entri.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...lokal, cd, e]);
}
const baca = n => fs.readFileSync(path.join(FIX, n));
// kubus 100 satuan (cm) dengan UV + bahan bertekstur
const OBJ = `mtllib kubus.mtl\no Kubus\n${[[0,0,0],[100,0,0],[100,100,0],[0,100,0],[0,0,100],[100,0,100],[100,100,100],[0,100,100]].map(v => 'v ' + v.join(' ')).join('\n')}
vt 0 0\nvt 1 0\nvt 1 1\nvt 0 1\nusemtl kayu\n${[[1,2,3,4],[5,8,7,6],[1,5,6,2],[2,6,7,3],[3,7,8,4],[5,1,4,8]].map(f => 'f ' + f.map((v, i) => v + '/' + (i + 1)).join(' ')).join('\n')}\n`;
const MTL = 'newmtl kayu\nKd 1 1 1\nmap_Kd tekstur/kursi_diff_1k.jpg\n';
const unggah = async (page, files) => {
  const n0 = await page.evaluate(() => Object.keys(PROJECT.assets).length);
  await page.evaluate(() => { document.getElementById('toast').textContent = ''; });
  await page.setInputFiles('#glbInput', files);
  await page.waitForFunction(n0 => Object.keys(PROJECT.assets).length > n0 || /Gagal/.test(document.getElementById('toast').textContent), n0, { timeout: 60000 });
  return page.evaluate(() => { const a = Object.values(PROJECT.assets).pop(); let tex = 0; const id = Object.keys(PROJECT.assets).pop();
    ASSET_OBJ.get(id)?.traverse(m => { if (m.isMesh && m.material && m.material.map) tex++; });
    return { n: Object.keys(PROJECT.assets).length, nama: a && a.name, dims: a && a.dims, tex, toast: document.getElementById('toast').textContent }; });
};

export const tes = {
  'impor: ZIP glTF, OBJ+MTL+tekstur (cm → m), FBX — semua jadi GLB di pustaka': async (page) => {
    const gltf = baca('kursi_1k.gltf');
    const zip = buatZip([{ nama: 'kursi/kursi_1k.gltf', data: gltf }, { nama: 'kursi/kursi.bin', data: baca('kursi.bin') },
      { nama: 'kursi/textures/kursi_diff_1k.jpg', data: baca('kursi_diff_1k.jpg'), simpan: true }, { nama: '__MACOSX/kursi/._kursi_1k.gltf', data: Buffer.from('x') }]);
    const a = await unggah(page, [{ name: 'kursi-cgtrader.zip', mimeType: 'application/zip', buffer: zip }]);
    assert.equal(a.nama, 'kursi_1k'); assert.ok(a.tex >= 1, 'tekstur dari dalam ZIP harus ikut');
    const b = await unggah(page, [{ name: 'kubus.obj', mimeType: 'text/plain', buffer: Buffer.from(OBJ) }, { name: 'kubus.mtl', mimeType: 'text/plain', buffer: Buffer.from(MTL) },
      { name: 'kursi_diff_1k.jpg', mimeType: 'image/jpeg', buffer: baca('kursi_diff_1k.jpg') }]);
    assert.equal(b.nama, 'kubus'); assert.deepEqual(b.dims, [1, 1, 1], 'OBJ 100 cm → 1 m'); assert.ok(b.tex >= 1, 'tekstur MTL harus ikut');
    const c = await unggah(page, [{ name: 'vCube.fbx', mimeType: 'application/octet-stream', buffer: baca('vCube.fbx') }]);
    assert.equal(c.nama, 'vCube'); assert.equal(c.n, 3);
    // loader tambahan dimuat dengan SRI dari jsDelivr hanya saat diperlukan
    assert.deepEqual(await page.evaluate(() => [typeof THREE.OBJLoader, typeof THREE.FBXLoader, document.querySelectorAll('script[integrity][src*="loaders/FBXLoader"]').length]), ['function', 'function', 1]);
  },
  'impor: bom ZIP & glTF yang merujuk alamat luar ditolak': async (page) => {
    const bom = buatZip([{ nama: 'a.gltf', data: Buffer.alloc(30 * 1048576, 32), ukuranPalsu: 10 }]);
    const r1 = await unggah(page, [{ name: 'bom.zip', mimeType: 'application/zip', buffer: bom }]);
    assert.match(r1.toast, /Gagal memuat bom\.zip: isi ZIP lebih besar/);
    const luar = buatZip([{ nama: 'x.gltf', data: Buffer.from(JSON.stringify({ asset: { version: '2.0' }, buffers: [{ uri: 'https://evil.example/x.bin', byteLength: 4 }] })) }]);
    const r2 = await unggah(page, [{ name: 'luar.zip', mimeType: 'application/zip', buffer: luar }]);
    assert.match(r2.toast, /alamat luar/);
    assert.equal(r2.n, 0);
  },
  'Sketchfab: hanya lisensi bebas-komersial, unduh dengan token, atribusi tersimpan, token tidak ikut proyek': async (page) => {
    const glb = await page.evaluate(([g, bin, jpg]) => {
      const isi = { 'kursi.bin': new Uint8Array(bufFromB64(bin)), 'textures/kursi_diff_1k.jpg': new Uint8Array(bufFromB64(jpg)) };
      return b64FromBuf(gltfKeGLB(JSON.parse(g), u => /^data:/.test(u) ? dataURIkeU8(u) : isi[u]));
    }, [baca('kursi_1k.gltf').toString('utf8'), baca('kursi.bin').toString('base64'), baca('kursi_diff_1k.jpg').toString('base64')]);
    const auth = [];
    await page.route('https://api.sketchfab.com/**', r => {
      const u = r.request().url();
      if (u.includes('/search')) return r.fulfill({ headers: CORS, json: { results: [
        { uid: 'a'.repeat(32), name: 'Sofa Kain', user: { displayName: 'Ani' }, license: { label: 'CC Attribution' }, thumbnails: { images: [{ url: 'https://media.sketchfab.example/t.jpg', width: 256 }] }, archives: { glb: { size: 900000 } } },
        { uid: 'b'.repeat(32), name: 'Sofa NC', user: { displayName: 'Budi' }, license: { label: 'CC Attribution-NonCommercial' } },
        { uid: 'c'.repeat(32), name: 'Sofa CC0', user: { displayName: 'Cici' }, license: { label: 'CC0 Public Domain' } },
        { uid: 'tidak-sah', name: 'x', license: { label: 'CC0' } }] } });
      auth.push(r.request().headers().authorization || '');
      return r.fulfill({ headers: CORS, json: { glb: { url: 'https://unduh.sketchfab.example/m.glb', size: Buffer.from(glb, 'base64').length } } });
    });
    await page.route('https://unduh.sketchfab.example/**', r => r.fulfill({ headers: CORS, body: Buffer.from(glb, 'base64') }));
    await page.route('https://media.sketchfab.example/**', r => r.fulfill({ headers: CORS, body: baca('kursi_diff_1k.jpg') }));
    await page.evaluate(() => { try { localStorage.removeItem('sketchfab_token'); } catch (e) {} SKF.token = ''; bukaGaleri(); });
    await page.selectOption('#galeriSumber', 'skf');
    await page.locator('#galeriRuang button[data-ruang="duduk"]').click();
    await page.waitForFunction(() => document.querySelectorAll('#galeriGrid .gl-card').length > 0);
    const kartu = await page.$$eval('#galeriGrid .gl-card', ks => ks.map(k => k.dataset.id[0]).sort());
    assert.deepEqual(kartu, ['a', 'c'], 'NC dan uid tidak sah disaring');
    // tanpa token → pesan jelas, tanpa permintaan unduhan
    await page.locator(`#galeriGrid .gl-card[data-id="${'a'.repeat(32)}"]`).click();
    await page.waitForFunction(() => /token/.test(document.getElementById('galeriInfo').textContent));
    assert.equal(auth.length, 0);
    await page.fill('#skfToken', 'rahasia123'); await page.click('#skfSimpan');
    await page.locator(`#galeriGrid .gl-card[data-id="${'a'.repeat(32)}"]`).click();
    await page.waitForFunction(() => !GALERI.sibuk && /dipasang|Gagal/.test(document.getElementById('galeriInfo').textContent), undefined, { timeout: 30000 });
    assert.deepEqual(auth, ['Token rahasia123']);
    const r = await page.evaluate(() => { const a = Object.values(PROJECT.assets).pop(); const B = sanitasiProyek(JSON.parse(JSON.stringify(PROJECT)));
      const id = Object.keys(PROJECT.assets).pop();
      return { sumber: a.sumber, lisensi: a.lisensi, tersimpan: B.assets[id].sumber, bocor: JSON.stringify({ v: 3, ...PROJECT }).includes('rahasia123'),
        situs: [...document.querySelectorAll('#galeriSitus a')].map(x => [x.textContent, x.href.includes('sofa'), x.target, x.rel]) }; });
    assert.equal(r.sumber, 'https://sketchfab.com/3d-models/' + 'a'.repeat(32));
    assert.equal(r.lisensi, 'CC-BY 4.0 — Ani (Sketchfab)');
    assert.equal(r.tersimpan, r.sumber);
    assert.equal(r.bocor, false, 'token tidak boleh masuk berkas proyek');
    assert.ok(r.situs.length >= 6 && r.situs.every(([, q, t, rel]) => q && t === '_blank' && /noopener/.test(rel)), JSON.stringify(r.situs));
  }
};
