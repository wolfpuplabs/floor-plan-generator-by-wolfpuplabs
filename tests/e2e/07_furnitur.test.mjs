import assert from 'node:assert/strict';
import { CORS } from './harness.mjs';

// JEV-056: furnitur bawaan realistis (kasur, sofa, sanitair, dapur) + pintasan ruangan di galeri model
const JENIS = ['bed_single', 'bed_double', 'bed_king', 'sofa2', 'sofa3', 'armchair', 'sofa_l', 'toilet', 'washbasin', 'bathtub',
  'shower', 'shower_box', 'vanity', 'sink', 'fridge', 'stove', 'kitchen', 'kitchen_line', 'kitchen_isl'];

export const tes = {
  'furnitur realistis: tepi bulat, bahan nyata, ukuran sesuai denah, ringan': async (page) => {
    const galatShader = [];
    page.on('console', m => { if (/shader error|WebGLProgram/i.test(m.text())) galatShader.push(m.text().slice(0, 200)); });
    const r = await page.evaluate((JENIS) => {
      const hasil = {};
      for (const k of JENIS) {
        const g = FURN[k].b(); let v = 0, bulat = 0, mesh = 0; const bahan = new Set();
        g.traverse(o => { if (!o.isMesh) return; mesh++; v += o.geometry.attributes.position.count;
          if ([...GEO_REAL.values()].includes(o.geometry)) bulat++;
          for (const [n, m] of Object.entries(MAT)) if (m === o.material) bahan.add(n); });
        const s = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
        hasil[k] = { v, bulat, mesh, bahan: [...bahan], lebih: Math.max(s.x - FURN[k].f[0], s.z - FURN[k].f[1]) };
      }
      return hasil;
    }, JENIS);
    for (const [k, h] of Object.entries(r)) {
      assert.ok(h.bulat >= 2, `${k}: belum memakai geometri bertepi bulat (${h.bulat}/${h.mesh})`);
      assert.ok(h.v < 40000, `${k}: terlalu berat (${h.v} titik)`);
      assert.ok(h.lebih < 0.15, `${k}: melewati tapak denah ${h.lebih.toFixed(2)} m`);
    }
    const ada = (k, ...b) => b.forEach(n => assert.ok(r[k].bahan.includes(n), `${k} tidak memakai MAT.${n}: ${r[k].bahan}`));
    ada('bed_double', 'kasur', 'selimut', 'sprei', 'kainRanjang');
    ada('sofa3', 'kainSofa', 'kainAksen');
    ada('toilet', 'porselen', 'krom');
    ada('bathtub', 'porselen', 'porselenDalam', 'krom');
    ada('vanity', 'porselen', 'marmer', 'kayuVenir', 'mirror');
    ada('sink', 'marmer', 'stainlessDalam');
    ada('fridge', 'stainless');
    ada('stove', 'stainless', 'kacaGelap');
    ada('kitchen_line', 'marmer', 'stainlessDalam');
    // kain ber-sheen, porselen berglasir, logam memantulkan probe
    const b = await page.evaluate(() => ({ sheen: !!MAT.kainSofa.sheen, glasir: MAT.porselen.clearcoat, pantul: ['krom', 'stainless', 'porselen', 'marmer'].every(n => bahanPantul().includes(MAT[n])),
      peta: !!(MAT.kainSofa.normalMap && MAT.marmer.map && MAT.kayuVenir.map) }));
    assert.deepEqual(b, { sheen: true, glasir: 1, pantul: true, peta: true });
    // semua terpasang di adegan & dirender tanpa galat shader
    await page.evaluate((JENIS) => {
      L().objects = JENIS.map((type, i) => ({ id: 'f' + i, kind: 'furn', type, x: (i % 5) * 3 - 6, y: 0, z: Math.floor(i / 5) * 3.5 - 6, rotY: 0, sx: 1, sy: 1, sz: 1, params: {} }));
      rebuildScene();
    }, JENIS);
    await page.waitForTimeout(1500);
    assert.deepEqual(galatShader, [], 'galat shader');
  },
  'galeri: pintasan ruangan menyaring per kata (Poly Haven & produk nyata)': async (page) => {
    await page.evaluate(() => bukaGaleri());
    await page.waitForFunction(() => document.querySelectorAll('#galeriGrid .gl-card').length === 5);
    const id = () => page.evaluate(() => [...document.querySelectorAll('#galeriGrid .gl-card')].map(k => k.dataset.id).sort());
    assert.equal(await page.locator('#galeriRuang button').count(), 13);
    await page.locator('#galeriRuang button[data-ruang="dapur"]').click();
    assert.deepEqual(await id(), ['cooking_pot_01'], '"pot" tidak boleh cocok dengan "potted"');
    await page.locator('#galeriRuang button[data-ruang="mandi"]').click();
    assert.deepEqual(await id(), ['bathtub_01']);
    await page.locator('#galeriRuang button[data-ruang="tidur"]').click();
    assert.deepEqual(await id(), ['GothicBed_01']);
    assert.equal(await page.getAttribute('#galeriRuang button[data-ruang="tidur"]', 'aria-pressed'), 'true');
    await page.locator('#galeriRuang button[data-ruang="duduk"]').click();
    assert.deepEqual(await id(), ['modern_arm_chair_01']);
    // sumber kedua: pilihan ruangan tetap berlaku
    await page.selectOption('#galeriSumber', 'khr');
    await page.locator('#galeriRuang button[data-ruang="dapur"]').click();
    const dapur = await id();
    assert.ok(dapur.includes('CommercialRefrigerator') && dapur.includes('DiffuseTransmissionTeacup') && !dapur.includes('GlamVelvetSofa'), String(dapur));
    await page.locator('#galeriRuang button[data-ruang="mandi"]').click();
    assert.equal((await id()).length, 0);
    assert.match(await page.textContent('#galeriInfo'), /coba sumber lain/);
  }
};
tes['galeri: pintasan ruangan menyaring per kata (Poly Haven & produk nyata)'].opsi = { rute: async (page) => {
  const daftar = {
    GothicBed_01: { name: 'Gothic Bed 01', categories: ['furniture'], tags: ['bed', 'wood'] },
    modern_arm_chair_01: { name: 'Modern Arm Chair 01', categories: ['furniture', 'seating'], tags: ['fabric'] },
    bathtub_01: { name: 'Bathtub', categories: ['furniture'], tags: ['bathroom', 'ceramic'] },
    cooking_pot_01: { name: 'Cooking Pot', categories: ['props'], tags: ['metal'] },
    potted_plant_01: { name: 'Potted Plant 01', categories: ['decorative'], tags: ['plant', 'green'] }
  };
  await page.route('https://api.polyhaven.com/**', r => r.fulfill({ json: daftar, headers: CORS }));
  await page.route('https://cdn.polyhaven.com/**', r => r.fulfill({ status: 404, body: '' }));
  await page.route('https://cdn.jsdelivr.net/gh/**', r => r.fulfill({ status: 404, body: '' }));
} };
