import assert from 'node:assert/strict';
import { muatProyekJSON } from './harness.mjs';

// JEV-085: material dinding pindah dari tab Tampilan ke inspector dinding — tiap dinding bisa
// memilih material per sisi (dalam/luar, atau sisi A/B untuk dinding sekat); bawaan proyek tetap
// bisa diubah dari inspector, material lantai bawaan pindah ke tab Lantai.
const kotak = [['w1', 0, 0, 6, 0], ['w2', 6, 0, 6, 5], ['w3', 6, 5, 0, 5], ['w4', 0, 5, 0, 0], ['ws', 3, 0, 3, 5]];
const proyek = { v: 1, levels: [{ name: 'L1', height: 3, walls: kotak.map(([id, x1, z1, x2, z2]) => ({ id, x1, z1, x2, z2, thickness: 0.15, openings: [] })), objects: [] }] };

const labelInspector = page => page.$$eval('#inspector .f-row label', ls => ls.map(l => l.textContent));
async function pilihDi(page, label, nilai) {
  await page.evaluate(([label, nilai]) => {
    const r = [...document.querySelectorAll('#inspector .f-row')].find(x => x.querySelector('label').textContent === label);
    const s = r.querySelector('select'); s.value = nilai; s.dispatchEvent(new Event('change'));
  }, [label, nilai]);
}

export const tes = {
  'tab Tampilan tanpa material dinding; lantai bawaan di tab Lantai': async (page) => {
    assert.match(await muatProyekJSON(page, proyek), /Proyek dimuat/);
    const r = await page.evaluate(() => ({ finIn: !!document.getElementById('finIn'), finOut: !!document.getElementById('finOut'),
      lantai: document.getElementById('finFloor').closest('.tab-body').dataset.panel, tekstur: document.getElementById('finTex').closest('.tab-body').dataset.panel }));
    assert.deepEqual(r, { finIn: false, finOut: false, lantai: 'levels', tekstur: 'tampilan' });
    await page.evaluate(() => { const s = document.getElementById('finFloor'); s.value = 'parket'; s.dispatchEvent(new Event('change')); });
    assert.equal(await page.evaluate(() => PROJECT.finish.floor), 'parket');
    assert.match(await page.textContent('#lvl-props'), /Sama dengan proyek \(Parket kayu\)/);
  },
  'inspector dinding: material per sisi, warna sendiri, bawaan & samakan': async (page) => {
    await muatProyekJSON(page, proyek);
    // dinding keliling: sisi dalam / luar
    await page.evaluate(() => { select('wall', 'w1'); renderInspector(); });
    const l1 = await labelInspector(page);
    assert.ok(l1.includes('Sisi dalam') && l1.includes('Sisi luar'), JSON.stringify(l1));
    await pilihDi(page, 'Sisi luar', 'bata');
    const r1 = await page.evaluate(() => { const w = L().walls.find(w => w.id === 'w1'), dA = sisiDalamA(w, L()), m = wallFinishMats(w, L());
      return { dA, kunci: dA ? w.finB : w.finA, luarBata: m[dA ? 5 : 4] === finMat(FINISH, 'bata'), dalamBawaan: m[dA ? 4 : 5] === matDalam() }; });
    assert.deepEqual(r1, { dA: r1.dA, kunci: 'bata', luarBata: true, dalamBawaan: true });
    // dinding lain tidak ikut berubah
    assert.equal(await page.evaluate(() => { const w = L().walls.find(w => w.id === 'w2'), m = wallFinishMats(w, L()); return m.includes(finMat(FINISH, 'bata')); }), false);
    // dinding sekat: sisi A / B, warna sendiri hanya #rrggbb
    await page.evaluate(() => { select('wall', 'ws'); renderInspector(); });
    const l2 = await labelInspector(page);
    const sisiB = l2.find(t => /^Sisi B \(hadap (kiri|kanan|atas|bawah)\)$/.test(t));
    assert.ok(l2.some(t => /^Sisi A \(hadap /.test(t)) && sisiB, JSON.stringify(l2));
    await pilihDi(page, sisiB, 'warna');
    assert.ok((await labelInspector(page)).includes('Warna s' + sisiB.slice(1)));
    await page.evaluate(() => { const c = document.querySelector('#inspector input[type=color]'); c.value = '#336699'; c.dispatchEvent(new Event('change')); });
    const r2 = await page.evaluate(() => { const w = L().walls.find(w => w.id === 'ws'), m = wallFinishMats(w, L());
      return { w: w.finBWarna, warna: '#' + m[5].color.getHexString(), a: m[4] === matDalam() }; });
    assert.deepEqual(r2, { w: '#336699', warna: '#336699', a: true });
    // bawaan proyek dari inspector, lalu samakan semua dinding ke bawaan
    await page.evaluate(() => { document.querySelector('#inspector details.bawaan-fin').open = true; });
    await page.evaluate(() => { const d = document.querySelector('#inspector details.bawaan-fin'), s = [...d.querySelectorAll('.f-row')].find(r => r.querySelector('label').textContent === 'Muka dalam').querySelector('select');
      s.value = 'kayu'; s.dispatchEvent(new Event('change')); });
    assert.equal(await page.evaluate(() => PROJECT.finish.in), 'kayu');
    await page.evaluate(() => [...document.querySelectorAll('#inspector button')].find(b => /Samakan semua dinding/.test(b.textContent)).click());
    const r3 = await page.evaluate(() => L().walls.filter(w => w.finA || w.finB || w.finAWarna || w.finBWarna).length);
    assert.equal(r3, 0);
  },
  'berkas proyek: material dinding tersimpan; kunci & warna tak sah diabaikan': async (page) => {
    const p = JSON.parse(JSON.stringify(proyek));
    Object.assign(p.levels[0].walls[4], { finA: 'batu', finB: 'warna', finBWarna: 'red;background:url(x)' });
    Object.assign(p.levels[0].walls[0], { finA: '__proto__', finB: 'tidakada' });
    assert.match(await muatProyekJSON(page, p), /Proyek dimuat/);
    const r = await page.evaluate(() => { const s = L().walls.find(w => w.id === 'ws'), m = wallFinishMats(s, L()), w = L().walls.find(w => w.id === 'w1'), mw = wallFinishMats(w, L());
      return { a: m[4] === finMat(FINISH, 'batu'), b: '#' + m[5].color.getHexString(), w1: mw[4] === matDalam() || mw[4] === matLuar(), simpan: JSON.parse(JSON.stringify(PROJECT)).levels[0].walls[4].finA }; });
    assert.deepEqual(r, { a: true, b: '#efece5', w1: true, simpan: 'batu' });
  },
};
