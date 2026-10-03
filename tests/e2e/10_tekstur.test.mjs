import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { FIX, CORS, muatProyekJSON } from './harness.mjs';

// JEV-059: tekstur foto untuk objek (foto sendiri / Poly Haven) + pola tidak berulang
const RUANG = { name: 'Tekstur', levels: [{ name: 'L1', height: 3, walls: [
  { x1: -3, z1: -3, x2: 3, z2: -3 }, { x1: 3, z1: -3, x2: 3, z2: 3 }, { x1: 3, z1: 3, x2: -3, z2: 3 }, { x1: -3, z1: 3, x2: -3, z2: -3 }],
  objects: [{ id: 'sofa', kind: 'furn', type: 'sofa3', x: 0, y: 0, z: -2.4, rotY: 0, params: {} },
            { id: 'meja', kind: 'furn', type: 'coffee_table', x: 0, y: 0, z: -1, rotY: 0, params: {} }] }] };
const jpg = () => fs.readFileSync(path.join(FIX, 'kursi_diff_1k.jpg'));

export const tes = {
  'tanpa pola berulang: ubin yang sama tidak lagi identik': async (page) => {
    const galatShader = [];
    page.on('console', m => { if (/shader error|WebGLProgram/i.test(m.text())) galatShader.push(m.text().slice(0, 200)); });
    const r = await page.evaluate(() => {
      // tekstur 64 px berisi noise acak — bila diulang tanpa acak, piksel di posisi yang sama tiap ubin identik
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), im = x.createImageData(64, 64);
      let s = 7; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < im.data.length; i += 4) { im.data[i] = R() * 255; im.data[i + 1] = R() * 255; im.data[i + 2] = R() * 255; im.data[i + 3] = 255; }
      x.putImageData(im, 0, 0);
      const ukur = (acak) => {
        const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.repeat.set(8, 8);
        const m = new THREE.MeshBasicMaterial({ map: t });
        if (acak) { m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + ACAK_GLSL)
          .replace('#include <map_fragment>', THREE.ShaderChunk.map_fragment.replace('texture2D( map, vUv )', 'acakUlang( map, vUv )')); }; m.customProgramCacheKey = () => 'uji-acak'; }
        const sc = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10); cam.position.z = 1;
        sc.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m));
        const rt = new THREE.WebGLRenderTarget(256, 256); renderer.setRenderTarget(rt); renderer.render(sc, cam);
        const px = new Uint8Array(256 * 256 * 4); renderer.readRenderTargetPixels(rt, 0, 0, 256, 256, px); renderer.setRenderTarget(null); rt.dispose();
        // 8×8 ubin @ 32 px: bandingkan piksel (10,10) tiap ubin dengan ubin pertama
        let beda = 0; const a = (10 * 256 + 10) * 4;
        for (let ty = 0; ty < 8; ty++) for (let tx = 0; tx < 8; tx++) { const o = ((ty * 32 + 10) * 256 + tx * 32 + 10) * 4;
          if (Math.abs(px[o] - px[a]) + Math.abs(px[o + 1] - px[a + 1]) + Math.abs(px[o + 2] - px[a + 2]) > 30) beda++; }
        return beda;
      };
      return { biasa: ukur(false), acak: ukur(true), kain: !!MAT.kainSofa.userData.acakUlang, marmer: !!MAT.marmer.userData.acakUlang, kasur: !!MAT.kasur.userData.acakUlang };
    });
    assert.equal(r.biasa, 0, 'tanpa acak, semua ubin identik');
    assert.ok(r.acak >= 40, 'dengan acak, sebagian besar ubin harus berbeda: ' + r.acak + '/63');
    assert.deepEqual([r.kain, r.marmer, r.kasur], [true, true, false]);
    assert.deepEqual(galatShader, []);
  },
  'foto sendiri: dipilih lewat inspector, dibuat mulus, tersimpan & disaring': async (page) => {
    await muatProyekJSON(page, RUANG);
    await page.evaluate(() => { select('obj', 'sofa'); renderInspector(); });
    await page.locator('#inspector button', { hasText: 'Pilih tekstur foto' }).click();
    assert.equal(await page.isVisible('#teksturModal'), true);
    await page.setInputFiles('#teksturFoto', path.join(FIX, 'kursi_diff_1k.jpg'));
    await page.waitForFunction(() => L().objects.find(o => o.id === 'sofa').params.tekstur && TEKSTUR.get(L().objects.find(o => o.id === 'sofa').params.tekstur)?.peta, undefined, { timeout: 20000 });
    const r = await page.evaluate(() => {
      const o = L().objects.find(x => x.id === 'sofa'), t = PROJECT.tekstur[o.params.tekstur];
      let foto = 0, metrik = 0; findGroup('obj', 'sofa').traverse(m => { if (m.isMesh && m.material.map && m.material.map.image && m.material.map.image.tagName === 'IMG') { foto++; if (m.geometry.userData.metrik) metrik++; } });
      const B = sanitasiProyek(JSON.parse(JSON.stringify(PROJECT)));
      return { sumber: t.sumber, jpeg: /^data:image\/jpeg;base64,/.test(t.data), foto, metrik, tersimpan: !!B.tekstur[o.params.tekstur], modal: document.getElementById('teksturModal').hidden };
    });
    assert.deepEqual(r, { sumber: 'foto', jpeg: true, foto: r.foto, metrik: r.foto, tersimpan: true, modal: true });
    assert.ok(r.foto >= 3, 'badan sofa harus memakai foto');
    // tepi dibuat mulus: gradien kiri-hitam → kanan-putih punya sambungan tajam sebelum diproses
    const tepi = await page.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 200; c.height = 100; const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 200, 0); g.addColorStop(0, '#000'); g.addColorStop(1, '#fff'); x.fillStyle = g; x.fillRect(0, 0, 200, 100);
      const b = await new Promise(ok => c.toBlob(ok, 'image/png'));
      const r = await fotoJadiTekstur(new File([b], 'g.png', { type: 'image/png' }));
      const im = await muatGambar(r.data), c2 = document.createElement('canvas'); c2.width = im.width; c2.height = im.height;
      const x2 = c2.getContext('2d'); x2.drawImage(im, 0, 0); const d = x2.getImageData(0, 50, im.width, 1).data;
      return { kiri: d[0], kanan: d[(im.width - 1) * 4], aspek: r.aspek };
    });
    assert.ok(Math.abs(tepi.kiri - tepi.kanan) < 40, 'sambungan kiri–kanan harus mulus: ' + JSON.stringify(tepi));
    assert.equal(tepi.aspek, 0.5);
    // sanitasi: hanya data:image; URL luar, javascript:, dan rujukan Poly Haven aneh dibuang
    const s = await page.evaluate(() => Object.keys(sanitasiProyek({ levels: [{ walls: [], objects: [] }], tekstur: {
      a: { sumber: 'foto', data: 'javascript:alert(1)' }, b: { sumber: 'foto', data: 'https://evil.example/x.jpg' },
      c: { sumber: 'ph', ph: '../../etc' }, d: { sumber: 'ph', ph: 'oak_veneer_01', res: '8k' }, e: { sumber: 'foto', data: 'data:image/jpeg;base64,AAAA' } } }).tekstur));
    assert.deepEqual(s.sort(), ['d', 'e']);
  },
  'pustaka Poly Haven: saring per bahan, warna + normal + kekasaran terpasang': async (page) => {
    await muatProyekJSON(page, RUANG);
    await page.evaluate(() => { select('obj', 'meja'); renderInspector(); bukaTekstur('meja'); });
    await page.waitForFunction(() => document.querySelectorAll('#teksturGrid .gl-card').length > 0);
    const id = () => page.evaluate(() => [...document.querySelectorAll('#teksturGrid .gl-card')].map(k => k.dataset.id).sort());
    assert.deepEqual(await id(), ['denim_fabric', 'velvet_red'], 'kategori awal: kain');
    await page.locator('#teksturKat button[data-kat="kayu"]').click();
    assert.deepEqual(await id(), ['oak_veneer_01'], '"woodland" bukan kayu — dicocokkan per kata');
    await page.locator('#teksturGrid .gl-card[data-id="oak_veneer_01"]').click();
    await page.waitForFunction(() => { const o = L().objects.find(x => x.id === 'meja'); const t = o.params.tekstur && TEKSTUR.get(o.params.tekstur); return t && t.peta && t.normal && t.kasar; }, undefined, { timeout: 20000 });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => { const o = L().objects.find(x => x.id === 'meja'); let m = null;
      findGroup('obj', 'meja').traverse(x => { if (x.isMesh && x.material.normalMap && x.material.roughnessMap && x.material.userData.acakUlang) m = x.material; });
      return { ent: PROJECT.tekstur[o.params.tekstur], bahan: !!m };
    });
    assert.deepEqual(r, { ent: { nama: 'Oak Veneer 01', sumber: 'ph', ph: 'oak_veneer_01', res: '1k' }, bahan: true });
  }
};
tes['pustaka Poly Haven: saring per bahan, warna + normal + kekasaran terpasang'].opsi = { rute: async (page) => {
  const daftar = { oak_veneer_01: { name: 'Oak Veneer 01', categories: ['wood'], tags: ['veneer'], download_count: 9 },
    denim_fabric: { name: 'Denim Fabric', categories: ['fabric'], tags: ['cloth'], download_count: 8 },
    velvet_red: { name: 'Red Velvet', categories: ['fabric'], tags: ['velvet'], download_count: 7 },
    forest_ground: { name: 'Woodland Ground', categories: ['terrain'], tags: ['woodland', 'forest'], download_count: 6 } };
  const f = n => ({ '1k': { jpg: { url: `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/x/${n}.jpg` } } });
  await page.route('https://api.polyhaven.com/**', r => {
    if (r.request().url().includes('/assets')) return r.fulfill({ json: daftar, headers: CORS });
    return r.fulfill({ json: { Diffuse: f('diff'), nor_gl: f('nor'), Rough: f('rough') }, headers: CORS });
  });
  await page.route('https://dl.polyhaven.org/**', r => r.fulfill({ body: jpg(), headers: { ...CORS, 'content-type': 'image/jpeg' } }));
  await page.route('https://cdn.polyhaven.com/**', r => r.fulfill({ body: jpg(), headers: { 'content-type': 'image/jpeg' } }));
} };
