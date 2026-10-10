import assert from 'node:assert/strict';

// JEV-081: pembuat kolam seperti void (persegi & L berukuran, atau bebas lewat tracing) dan
// titik yang menempel ke ujung dinding, railing, pagar & sudut kolam — di tracing dan alat dinding
const luas = page => page.evaluate(() => Math.abs(luasPoli(areaPoli(L().objects.at(-1)))));
const isi = (page, label, nilai) => page.evaluate(([l, v]) => {
  const r = [...document.querySelectorAll('#inspector .f-row')].find(x => x.querySelector('label') && x.querySelector('label').textContent.trim() === l);
  const i = r.querySelector('input'); i.value = String(v); i.dispatchEvent(new Event('change'));
}, [label, nilai]);
// titik dunia → koordinat layar kanvas (untuk alat yang membaca event pointer)
const layar = (page, x, z) => page.evaluate(([x, z]) => {
  camera.updateMatrixWorld(); const v = new THREE.Vector3(x, levelElevation(PROJECT.active), z).project(camera), r = renderer.domElement.getBoundingClientRect();
  return { clientX: r.left + (v.x + 1) / 2 * r.width, clientY: r.top + (1 - v.y) / 2 * r.height };
}, [x, z]);

export const tes = {
  'kolam: persegi & bentuk L berukuran di inspector (seperti void), bebas lewat tracing; gambar ulang jadi bebas': async (page) => {
    await page.evaluate(() => { PROJECT.levels[0].walls = []; PROJECT.levels[0].objects = []; rebuildScene(); });
    await page.click('.tabs button[data-tab="taman"]');
    assert.deepEqual(await page.$$eval('#cat-kolam .cat-item', bs => bs.map(b => b.textContent)),
      ['Kolam renang persegi', 'Kolam renang bentuk L', 'Kolam renang bebas (tracing)', 'Kolam ikan persegi', 'Kolam ikan bebas (tracing)']);
    // persegi 4 × 8 m, lebar diketik → 5 × 8 m
    await page.click('#cat-kolam .cat-item:has-text("Kolam renang persegi")');
    assert.deepEqual(await page.evaluate(() => { const o = L().objects.at(-1); return [o.kind, o.type, o.params.bentuk, o.params.w, o.params.d]; }), ['area', 'kolam_renang', 'persegi', 4, 8]);
    assert.equal(await luas(page), 32);
    await isi(page, 'Lebar (m)', 5);
    assert.equal(await luas(page), 40);
    // bentuk L 6 × 8 dipotong 3 × 3; potongan lebar 2 → 48 − 6
    await page.click('#cat-kolam .cat-item:has-text("Kolam renang bentuk L")');
    assert.deepEqual(await page.evaluate(() => [areaPoli(L().objects.at(-1)).length, L().objects.at(-1).params.bentuk]), [6, 'L']);
    assert.equal(await luas(page), 39);
    await isi(page, 'Potongan lebar (m)', 2);
    assert.equal(await luas(page), 42);
    // ukuran ikut tersimpan & disaring
    assert.deepEqual(await page.evaluate(() => { const o = sanitasiProyek(JSON.parse(JSON.stringify(PROJECT))).levels[0].objects.at(-1); return [o.params.bentuk, o.params.w, o.params.cw]; }), ['L', 6, 2]);
    // kolam bebas: tracing seperti void bebas
    await page.click('#cat-kolam .cat-item:has-text("Kolam renang bebas")');
    assert.deepEqual(await page.evaluate(() => [TOOL, VT.mode.kind, VT.mode.type]), ['voidTrace', 'area', 'kolam_renang']);
    await page.evaluate(() => { VT.pts = [{ x: 20, z: 0 }, { x: 24, z: 0 }, { x: 24, z: 3 }, { x: 21, z: 5 }]; selesaiTrace(); });
    assert.deepEqual(await page.evaluate(() => { const o = L().objects.at(-1); return [o.type, o.params.bentuk, areaPoli(o).length]; }), ['kolam_renang', undefined, 4]);
    // kolam persegi digambar ulang → jadi bebas, isian ukuran hilang dari inspector
    const id = await page.evaluate(() => L().objects.find(o => o.params.bentuk === 'persegi').id);
    await page.evaluate(id => { mulaiTrace({ kind: 'area', type: 'kolam_renang' }, id); VT.pts = [{ x: 0, z: 0 }, { x: 3, z: 0 }, { x: 3, z: 3 }]; selesaiTrace(); }, id);
    assert.equal(await page.evaluate(id => cariObjek(id).params.bentuk, id), undefined);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('#inspector .f-row label')].some(l => l.textContent === 'Lebar (m)')), false);
  },
  'tangkap ujung: dinding, railing, pagar & sudut kolam — di tracing dan saat menggambar dinding': async (page) => {
    await page.evaluate(() => {
      const lv = PROJECT.levels[0];
      lv.walls = [newWall(0, 0, 4, 0, 0.15, 0)];
      const r = newWall(4, 0, 4, 3, 0.06, 0); r.rail = 'kaca'; r.height = 1.1; lv.walls.push(r);           // railing
      lv.objects = [{ id: uid('ob'), kind: 'garis', type: 'pagar_kayu', x: 7, y: 0, z: 0, rotY: 0, sx: 1, sy: 1, sz: 1, params: Object.assign(paramsAwal('garis', 'pagar_kayu'), { pts: [[-1, 0], [1, 0]] }) }];
      tambahKolam('kolam_renang', 'persegi'); const k = L().objects.at(-1); k.x = 10; k.z = 5; rebuildScene(); setView('atas'); select(null);
    });
    await page.waitForTimeout(1500);
    // daftar ujung & penangkapan langsung
    assert.deepEqual(await page.evaluate(() => [ujungTerdekat(4.1, 0.05, 0.3), ujungTerdekat(4.05, 2.9, 0.3), ujungTerdekat(6.05, 0.1, 0.3), ujungTerdekat(8.1, 1.05, 0.3), ujungTerdekat(5, 5, 0.3)]),
      [{ x: 4, z: 0 }, { x: 4, z: 3 }, { x: 6, z: 0 }, { x: 8, z: 1 }, null]);
    // tracing: kursor di dekat ujung pagar menempel tepat & bertanda
    await page.evaluate(() => mulaiTrace({ kind: 'garis', type: 'pagar_kayu' }, null));
    await page.waitForTimeout(1500);                        // tampilan atas selesai beranimasi sebelum titik layar dihitung
    const t = await page.evaluate(e => titikTrace(e), await layar(page, 8.06, 0.07));
    assert.deepEqual(t, { x: 8, z: 0, ujung: true }, JSON.stringify(t));
    await page.evaluate(() => setTool('select'));
    // alat dinding: klik dekat ujung pagar → dinding baru berawal tepat di ujung itu
    await page.evaluate(() => setTool('wall'));
    for (const [x, z] of [[6.08, 0.09], [6.0, 2.5]]) { const p = await layar(page, x, z); await page.mouse.click(p.clientX, p.clientY); await page.waitForTimeout(150); }
    const w = await page.evaluate(() => { const w = L().walls.at(-1); return [w.x1, w.z1]; });
    assert.deepEqual(w, [6, 0], 'dinding baru menyambung tepat di ujung pagar');
    await page.keyboard.press('Escape');
  },
};
