import assert from 'node:assert/strict';

// JEV-090: model unggahan sebagai potongan pagar / ubin lantai lewat tracing, duduk di perabot pustaka,
// ikon layar utama iOS sebagai data: URL.

// model uji: satu kotak w × h × d (alas di y = 0) → GLB → pustaka model
const modelKotak = (page, w, h, d, nama) => page.evaluate(async ([w, h, d, nama]) => {
  const g = new THREE.Group(), m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: 0x8a6a4a }));
  m.position.y = h / 2; g.add(m);
  const glb = await new Promise((ok, no) => { try { new THREE.GLTFExporter().parse(g, ok, { binary: true }); } catch (e) { no(e); } });
  const id = (await daftarkanAset(nama, glb)).id; renderCatalogs(); return id;
}, [w, h, d, nama]);
// potongan terpasang (koordinat dunia, x/z) dari InstancedMesh objek tracing
const potongan = (page, id) => page.evaluate(id => {
  const g = findGroup('obj', id); if (!g) return null; g.updateMatrixWorld(true);
  const im = g.children.find(c => c.isInstancedMesh); if (!im) return { n: 0 };
  const M = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), out = [];
  for (let i = 0; i < im.count; i++) {
    im.getMatrixAt(i, M); M.premultiply(im.matrixWorld).decompose(p, q, s);
    out.push({ x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3), sx: +s.x.toFixed(3), sy: +s.y.toFixed(3), yaw: +new THREE.Euler().setFromQuaternion(q).y.toFixed(3) });
  }
  return { n: im.count, p: out };
}, id);
const tunggu = (page, id) => page.waitForFunction(id => { const g = findGroup('obj', id); return !!(window.POTONG && g && g.children.some(c => c.isInstancedMesh)); }, id, { timeout: 20000 });

export const tes = {
  'pagar dari model: tracing di tab Taman, potongan diulang & direntang pas sepanjang jalur, menahan badan': async (page) => {
    const id = await modelKotak(page, 1.0, 1.2, 0.08, 'Panel pagar');
    // daftar model di tab Taman ikut terisi; tombol tracing memakai model terpilih
    const ui = await page.evaluate(() => ({ pilih: [...document.querySelectorAll('#modelPotong option')].map(o => o.textContent), nonaktif: $('#pagarModelBtn').disabled }));
    assert.deepEqual(ui, { pilih: ['Panel pagar'], nonaktif: false });
    const oid = await page.evaluate(() => {
      $('#pagarModelBtn').click();
      VT.pts = [{ x: 0, z: 0 }, { x: 3.1, z: 0 }, { x: 3.1, z: 2 }]; selesaiTrace();
      return SEL.id;
    });
    await tunggu(page, oid);
    const o = await page.evaluate(id => { const o = cariObjek(id); return { kind: o.kind, jenis: o.params.jenis, model: o.params.model }; }, oid);
    assert.deepEqual(o, { kind: 'garis', jenis: 'pagar_model', model: id });
    const r = await potongan(page, oid);
    // 3,1 m → 3 potong direntang 1,033 m; 2 m → 2 potong utuh; sumbu panjang (X model) mengikuti jalur
    assert.equal(r.n, 5);
    assert.deepEqual(r.p.slice(0, 3).map(p => [p.x, p.z, p.sx]), [[0.517, 0, 1.033], [1.55, 0, 1.033], [2.583, 0, 1.033]]);
    assert.deepEqual(r.p.slice(3).map(p => [p.x, p.z, p.sx]), [[3.1, 0.5, 1], [3.1, 1.5, 1]]);
    assert.ok(Math.abs(Math.abs(r.p[3].yaw) - Math.PI / 2) < 1e-3, 'segmen kedua diputar 90°: ' + r.p[3].yaw);
    // tinggi diatur → potongan diskalakan tegak; badan di mode jalan tertahan pagar
    const t = await page.evaluate(id => {
      const o = cariObjek(id); o.params.tinggi = 2.4; rebuildScene();
      const d = dorongPagar(o, 1.0, 0.03), bebas = dorongPagar(o, 1.0, 1.2);
      return { d, bebas, r: FPS.r, pakai: assetInUse(o.params.model) };
    }, oid);
    assert.equal((await potongan(page, oid)).p[0].sy, 2);
    assert.ok(t.d && Math.abs(t.d[1] - (0.04 + t.r)) < 1e-6 && t.d[0] === 1, 'didorong keluar dari pagar: ' + JSON.stringify(t));
    assert.equal(t.bebas, null);
    assert.equal(t.pakai, 1, 'model dihitung terpakai oleh pagarnya (ikut tautan bagikan)');
  },

  'lantai dari model: ubin berpetak mengisi keliling tracing, bisa dipijak, ukuran ubin bisa diatur': async (page) => {
    const id = await modelKotak(page, 0.5, 0.04, 0.5, 'Ubin teraso');
    const oid = await page.evaluate(id => {
      traceModel('area', id);
      // bentuk L 2 × 2 m tanpa pojok kanan-bawah 1 × 1 m
      VT.pts = [{ x: 0, z: 0 }, { x: 2, z: 0 }, { x: 2, z: 1 }, { x: 1, z: 1 }, { x: 1, z: 2 }, { x: 0, z: 2 }]; selesaiTrace();
      return SEL.id;
    }, id);
    await tunggu(page, oid);
    let r = await potongan(page, oid);
    assert.equal(r.n, 12, '16 petak 0,5 m dikurangi 4 di pojok yang terpotong');
    assert.ok(r.p.every(p => !(p.x > 1 && p.z > 1)), 'tidak ada ubin di luar keliling');
    const pijak = await page.evaluate(() => ({ ubin: fpsGround(0.25, 0.25, 0), luar: fpsGround(1.75, 1.75, 0) }));
    assert.ok(Math.abs(pijak.ubin - 0.04) < 1e-3, 'berdiri di atas ubin: ' + JSON.stringify(pijak));
    assert.ok(pijak.luar == null || pijak.luar < 0.01, 'di luar keliling tidak ada ubin: ' + JSON.stringify(pijak));
    await page.evaluate(id => { const o = cariObjek(id); o.params.ubinW = 1; o.params.ubinD = 1; rebuildScene(); }, oid);
    r = await potongan(page, oid);
    assert.equal(r.n, 3);
    assert.equal(r.p[0].sx, 2, 'model direntang ke ukuran ubin 1 m');
    // inspector: pilihan model & ukuran ubin; hapus model → lantainya ikut hilang
    const ins = await page.evaluate(id => { select('obj', id); renderInspector(); return $('#inspector').textContent; }, oid);
    assert.match(ins, /Lebar ubin/);
    assert.match(ins, /Ubin teraso/);
    const sisa = await page.evaluate(id => { window.confirm = () => true; deleteAsset(id); return L().objects.filter(o => o.params && o.params.model === id).length; }, id);
    assert.equal(sisa, 0);
  },

  'duduk di perabot pustaka: meja bisa dijadikan tempat duduk, ranjang bawaan bisa, sofa bisa dimatikan': async (page) => {
    const r = await page.evaluate(() => {
      const f = (id, type, x, params = {}) => ({ id, kind: 'furn', type, x, y: 0, z: 0, rotY: 0, sx: 1, sy: 1, sz: 1, params });
      L().objects.push(f('meja', 'coffee_table', 0), f('meja2', 'coffee_table', 2, { interaksi: 'duduk', tinggiDuduk: 0.4 }),
        f('ranjang', 'bed_double', 5), f('sofa', 'sofa3', 9, { interaksi: 'tidak' }), f('lampu', 'floor_lamp', 12, { interaksi: 'duduk' }));
      rebuildScene();
      const j = id => findGroup('obj', id).userData.nyalaJenis || null;
      const g2 = findGroup('obj', 'meja2'), s = titikDuduk({ grp: g2, id: 'meja2' });
      select('obj', 'meja'); renderInspector(); const insMeja = $('#inspector').textContent;
      select('obj', 'lampu'); renderInspector(); const insLampu = $('#inspector').textContent;
      return { meja: j('meja'), meja2: j('meja2'), ranjang: j('ranjang'), sofa: j('sofa'), lampu: j('lampu'), y: +s.pos.y.toFixed(3),
        kursiRanjang: findGroup('obj', 'ranjang').userData.duduk.n, insMeja: /Bisa diduduki/.test(insMeja), insLampu: /Bisa diduduki/.test(insLampu) };
    });
    assert.deepEqual(r, { meja: null, meja2: 'duduk', ranjang: 'duduk', sofa: null, lampu: 'lampu', y: 0.4, kursiRanjang: 2, insMeja: true, insLampu: false });
  },

  'ikon layar utama di iPad: diambil sekali lalu dipasang sebagai data: URL': Object.assign(async (page) => {
    await page.waitForFunction(() => /^data:image\/png;base64,/.test(document.querySelector('link[rel="apple-touch-icon"]').href), undefined, { timeout: 10000 });
  }, { opsi: { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15' } }),

  // iPad dengan memori grafis penuh: konteks WebGL gagal dibuat → dulu viewport hitam + "Script error"
  'tanpa WebGL: pesan jelas + tombol muat ulang, bukan layar hitam': Object.assign(async (page) => {
    await page.waitForSelector('#tanpaGL', { timeout: 20000 });
    const r = await page.evaluate(() => ({ teks: $('#tanpaGL').textContent, tombol: !!$('#tanpaGL button'), toast: $('#toast').classList.contains('show') }));
    assert.match(r.teks, /The 3D view could not start/);
    assert.match(r.teks, /Close other tabs that use 3D or games/);
    assert.deepEqual([r.tombol, r.toast], [true, false]);
  }, { izinGalat: true, opsi: { tanpaSiap: true, bahasa: 'en',
    init: () => { const asli = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/.test(t) ? null : asli.call(this, t, ...a); }; } } }),
};
