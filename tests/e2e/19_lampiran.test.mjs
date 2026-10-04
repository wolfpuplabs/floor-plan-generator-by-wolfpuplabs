import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { CORS, bukaApp } from './harness.mjs';

// JEV-068: model unggahan sendiri, foto tekstur & video/GIF TV ikut tautan lihat pendek sebagai
// lampiran — dipotong ≤ 3 MB, beralamat isi (SHA-256) di api/tautan; penerima memeriksa sidik
// lalu menyaringnya seperti berkas proyek
const require = createRequire(import.meta.url);
const api = require('../../api/tautan.js');
const kotak = (x0, z0, x1, z1) => [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]];
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

// GIF 2×2 satu bingkai merah
const GIF = Buffer.from([...Buffer.from('GIF89a'), 2, 0, 2, 0, 0x80, 0, 0, 255, 0, 0, 0, 0, 0, 0x2C, 0, 0, 0, 0, 2, 0, 2, 0, 0, 2, 2, 0x44, 0x01, 0, 0x3B]);

// tiruan fungsi /api/tautan: isi tautan + potongan lampiran (sidik diperiksa seperti di server)
async function ruteApi(page, simpan) {
  simpan.bagian = simpan.bagian || new Map(); simpan.post = simpan.post || 0;
  await page.route('**/api/tautan**', async r => {
    const q = r.request(), u = new URL(q.url()), h = u.searchParams.get('bagian');
    if (h) {
      if (q.method() === 'POST') { const b = q.postDataBuffer(); simpan.post++;
        if (sha(b) !== h) return r.fulfill({ status: 400, headers: CORS, json: { galat: 'sidik' } });
        simpan.bagian.set(h, b); return r.fulfill({ headers: CORS, json: { ok: true } }); }
      if (u.searchParams.get('cek')) return r.fulfill({ headers: CORS, json: { ada: simpan.bagian.has(h) } });
      return simpan.bagian.has(h) ? r.fulfill({ headers: { ...CORS, 'content-type': 'application/octet-stream' }, body: simpan.bagian.get(h) }) : r.fulfill({ status: 404, json: {} });
    }
    if (q.method() === 'POST') { simpan.last = q.postDataBuffer(); simpan.set('Lmp4ran2Ab', simpan.last); return r.fulfill({ headers: CORS, json: { id: 'Lmp4ran2Ab' } }); }
    const id = u.searchParams.get('id');
    return simpan.has(id) ? r.fulfill({ headers: { ...CORS, 'content-type': 'application/octet-stream' }, body: simpan.get(id) }) : r.fulfill({ status: 404, json: {} });
  });
}

export const tes = {
  'fungsi api/tautan: potongan lampiran beralamat isi — sidik salah ditolak, cek ada, ambil, batas ukuran': async () => {
    const toko = new Map();
    const blob = () => ({ put: async (n, buf) => { toko.set(n, buf); return { url: 'mem://' + n }; }, head: async n => { if (!toko.has(n)) throw new Error('404'); return { url: 'mem://' + n }; } });
    const asliFetch = globalThis.fetch;
    globalThis.fetch = async u => { const n = String(u).replace('mem://', ''); return toko.has(n) ? new Response(toko.get(n)) : new Response('', { status: 404 }); };
    const panggil = async (h, metode, url, badan) => { const res = { h: {}, status: 0, isi: null, setHeader(k, v) { this.h[k] = v; }, end(b) { this.isi = b; } };
      Object.defineProperty(res, 'statusCode', { set(v) { res.status = v; }, get() { return res.status; } });
      await h({ method: metode, url, query: Object.fromEntries(new URL(url, 'http://x').searchParams), body: badan }, res); return res; };
    try {
      const h = api.buatHandler(blob, () => true), isi = crypto.randomBytes(5000), s = sha(isi);
      assert.deepEqual(JSON.parse((await panggil(h, 'GET', '/api/tautan?cek=1&bagian=' + s)).isi), { ada: false });
      assert.equal((await panggil(h, 'POST', '/api/tautan?bagian=' + sha(Buffer.from('lain')), isi)).status, 400, 'nama ≠ sidik isi');
      assert.equal((await panggil(h, 'POST', '/api/tautan?bagian=' + s, isi)).status, 200);
      assert.deepEqual([...toko.keys()], ['bagian/' + s + '.bin']);
      assert.deepEqual(JSON.parse((await panggil(h, 'GET', '/api/tautan?cek=1&bagian=' + s)).isi), { ada: true });
      const g = await panggil(h, 'GET', '/api/tautan?bagian=' + s);
      assert.equal(g.status, 200); assert.deepEqual(Buffer.from(g.isi), isi);
      const besar = Buffer.alloc(api.BATAS_BAGIAN + 1);
      assert.equal((await panggil(h, 'POST', '/api/tautan?bagian=' + sha(besar), besar)).status, 413);
      assert.equal((await panggil(h, 'GET', '/api/tautan?bagian=../../tautan/x')).status, 400);
      assert.equal((await panggil(h, 'GET', '/api/tautan?bagian=' + sha(Buffer.from('tidak ada')))).status, 404);
      assert.equal((await panggil(api.buatHandler(blob, () => false), 'POST', '/api/tautan?bagian=' + s, isi)).status, 501);
    } finally { globalThis.fetch = asliFetch; }
  },
  'model unggahan, foto tekstur & GIF TV ikut tautan pendek; penerima memasangnya': async (page) => {
    const simpan = new Map();
    await ruteApi(page, simpan);
    const id = await page.evaluate(async ([k, gif]) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.6), new THREE.MeshStandardMaterial({ color: 0x884422 }));
      const glb = await new Promise((ok, no) => { try { new THREE.GLTFExporter().parse(mesh, ok, { binary: true }); } catch (e) { no(e); } });
      await importModelFiles([new File([glb], 'kursiku.glb', { type: 'model/gltf-binary' })]);
      const id = Object.keys(PROJECT.assets).pop();
      PROJECT.levels[0].walls = k.map(([a, b, c, d]) => ({ id: uid('w'), x1: a, z1: b, x2: c, z2: d, thickness: 0.15, openings: [] }));
      const c = document.createElement('canvas'); c.width = c.height = 16; c.getContext('2d').fillStyle = '#c33'; c.getContext('2d').fillRect(0, 0, 16, 16);
      PROJECT.tekstur = { tfoto: { nama: 'kain', sumber: 'foto', data: c.toDataURL('image/jpeg'), aspek: 1 } };
      PROJECT.media = { mdtv: { nama: 'film', mime: 'image/gif', data: gif }, mdlain: { nama: 'tak dipakai', mime: 'image/gif', data: gif } };
      PROJECT.levels[0].objects = [
        { id: 'om1', kind: 'model', type: id, x: 2, y: 0, z: 2, rotY: 0, sx: 1, sy: 1, sz: 1, params: {} },
        { id: 'of1', kind: 'furn', type: 'sofa3', x: 4, y: 0, z: 3, rotY: 0, sx: 1, sy: 1, sz: 1, params: { tekstur: 'tfoto' } },
        { id: 'ot1', kind: 'furn', type: 'tv_set', x: 1, y: 0, z: 4, rotY: 0, sx: 1, sy: 1, sz: 1, params: { tvMedia: 'mdtv' } }];
      rebuildScene(); return id;
    }, [kotak(0, 0, 6, 5), GIF.toString('base64')]);
    const r = await page.evaluate(async () => { const r = await buatTautanLihat(); return { url: r.url, n: r.nLampiran, d: r.ditinggal, f: r.fotoDitinggal, m: r.mediaDitinggal }; });
    assert.deepEqual(r, { url: r.url, n: 3, d: [], f: 0, m: 0 });
    assert.match(r.url, /#l=Lmp4ran2Ab$/);
    assert.equal(simpan.bagian.size, 3, 'GIF yang tidak dipakai TV tidak ikut');
    const isi = JSON.parse(zlib.inflateRawSync(simpan.last).toString());
    assert.deepEqual(Object.keys(isi.lampiran.aset), [id]); assert.deepEqual(Object.keys(isi.lampiran.media), ['mdtv']);
    assert.deepEqual(isi.tekstur, {}, 'data foto tetap tidak tertanam di isi tautan');
    assert.ok(simpan.last.length < 4000, 'isi tautan tetap ringkas: ' + simpan.last.length);
    // bagikan lagi: potongan yang sama tidak diunggah ulang
    const sebelum = simpan.post;
    await page.evaluate(() => buatTautanLihat());
    assert.equal(simpan.post, sebelum);

    const dasar = page.url().split('#')[0];
    await page.goto('about:blank');
    const { page: b, log } = await bukaApp(page.context().browser(), dasar + '#l=Lmp4ran2Ab', { viewport: { width: 900, height: 600 }, rute: p => ruteApi(p, simpan) });
    try {
      await b.waitForFunction(() => LIHAT.siap, undefined, { timeout: 90000 });
      const h = await b.evaluate(id => ({ model: ASSET_OBJ.has(id), aset: !!PROJECT.assets[id], objek: L().objects.map(o => o.id).sort(),
        foto: /^data:image\/jpeg;base64,/.test((PROJECT.tekstur.tfoto || {}).data || ''), tv: (PROJECT.media.mdtv || {}).mime, lain: !!PROJECT.media.mdlain,
        galat: document.getElementById('lihatNama').classList.contains('galat') }), id);
      assert.deepEqual(h, { model: true, aset: true, objek: ['of1', 'om1', 'ot1'], foto: true, tv: 'image/gif', lain: false, galat: false });
      assert.deepEqual(log.galat, []);
      // potongan ditukar isinya → ditolak; berkas > 3 MB dipotong & disusun ulang utuh
      const k = await b.evaluate(async () => {
        const u = new Uint8Array(7 * 1048576); for (let i = 0; i < u.length; i += 65536) crypto.getRandomValues(u.subarray(i, i + 65536));
        const d = await unggahLampiran(u), v = await ambilLampiran(d, LAMPIRAN.maks);
        let sama = v.length === u.length; for (let i = 0; sama && i < u.length; i += 4099) sama = v[i] === u[i];
        return { n: d.length, sama, d };
      });
      assert.equal(k.n, 3); assert.equal(k.sama, true);
      simpan.bagian.set(k.d[1], Buffer.from('isi ditukar'));
      const tolak = await b.evaluate(async d => { try { await ambilLampiran(d, LAMPIRAN.maks); return 'diterima'; } catch (e) { return e.message; } }, k.d);
      assert.match(tolak, /rusak/);
      assert.match(await b.evaluate(async () => { try { await ambilLampiran(['../x'], 1e9); return 'diterima'; } catch (e) { return e.message; } }), /tidak sah/);
    } finally { await b.close(); }
  },
  'lampiran: Blob belum aktif → model sendiri ditinggal dengan arahan, tautan tetap jadi': async (page) => {
    await page.route('**/api/tautan**', r => r.fulfill({ status: 501, headers: CORS, json: { galat: 'blob-belum-diatur' } }));
    await page.evaluate(async () => {
      const glb = await new Promise(ok => new THREE.GLTFExporter().parse(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)), ok, { binary: true }));
      await importModelFiles([new File([glb], 'mejaku.glb')]);
      const id = Object.keys(PROJECT.assets).pop();
      PROJECT.levels[0].walls = [{ id: 'w1', x1: 0, z1: 0, x2: 4, z2: 0, thickness: 0.15, openings: [] }];
      PROJECT.levels[0].objects = [{ id: 'om', kind: 'model', type: id, x: 1, y: 0, z: 1, rotY: 0, sx: 1, sy: 1, sz: 1, params: {} }];
      rebuildScene(); pilihTab('file');
    });
    await page.evaluate(() => document.getElementById('bagikanBtn').click());
    await page.waitForFunction(() => document.getElementById('bagikanUrl').value.includes('#lihat='), undefined, { timeout: 30000 });
    const t = await page.textContent('#bagikanInfo');
    // halaman berbahasa Inggris: kalimat baru ikut diterjemahkan
    assert.match(t, /Your own uploaded models are not included: mejaku/);
    assert.match(t, /enable Vercel Blob/);
    assert.equal(await page.evaluate(() => document.getElementById('bagikanBtn').disabled), false);
  },
};
tes['lampiran: Blob belum aktif → model sendiri ditinggal dengan arahan, tautan tetap jadi'].opsi = { bahasa: 'en' };
