import assert from 'node:assert/strict';

// JEV-082: bentuk dasar padat (collider & bisa dipijak), prisma bebas & potongan lewat tracing
// (seperti void), lantai bebas lewat tracing, dan tanah selalu di bawah lantai
const kosongkan = page => page.evaluate(() => { PROJECT.levels[0].walls = []; PROJECT.levels[0].objects = []; delete PROJECT.site.relief; rebuildScene(); });
const taruh = (page, t, x, z, ex = {}) => page.evaluate(([t, x, z, ex]) => { addObject('furn', t); const o = L().objects.at(-1); Object.assign(o, { x, z }, ex); rebuildScene(); return o.id; }, [t, x, z, ex]);
// berjalan lurus ke arah −z dari (x, z0) selama n langkah; hasil: z akhir
const jalan = (page, x, z0, n = 40) => page.evaluate(([x, z0, n]) => {
  enterFPS(); FPS.feet = 0; camera.position.set(x, FPS.eye, z0); FPS.yaw = Math.PI; FPS.pitch = 0;
  FPS.keys.add('w'); for (let i = 0; i < n; i++) fpsStep(0.05); FPS.keys.clear();
  const r = [+camera.position.z.toFixed(2), +FPS.feet.toFixed(2)]; exitFPS(); return r;
}, [x, z0, n]);

export const tes = {
  'bentuk dasar padat: menghalangi di mode jalan, bisa dipijak; potongan tracing membuka jalan tembus': async (page) => {
    await kosongkan(page);
    const id = await taruh(page, 'bentuk_kotak', 0, 0, { sx: 2, sy: 1.2, sz: 1 });
    const [z] = await jalan(page, 0, 3);
    assert.ok(z > 0.5 + 0.2, 'kotak menghalangi: berhenti di depannya, bukan menembus (z=' + z + ')');
    // potong lubang tegak 1,4 m (selebar pintu lebar; badan ±0,52 m + sel collider 8 cm) → bisa lewat
    await page.evaluate(id => { mulaiPotong(id); VT.pts = [{ x: -0.7, z: -0.8 }, { x: 0.7, z: -0.8 }, { x: 0.7, z: 0.8 }, { x: -0.7, z: 0.8 }]; selesaiTrace(); }, id);
    assert.equal(await page.evaluate(id => cariObjek(id).params.potong.length, id), 1);
    const [z2] = await jalan(page, 0, 3, 80);
    assert.ok(z2 < -0.6, 'lewat lubang potongan (z=' + z2 + ')');
    // bentuk yang terpotong: geometri berlubang, potongan tersimpan & disaring
    const P = await page.evaluate(id => { const B = sanitasiProyek(JSON.parse(JSON.stringify(PROJECT))); return B.levels[0].objects.find(o => o.id === id).params.potong; }, id);
    assert.equal(P.length, 1);
    // bola & kerucut: padat, tanpa tombol potong; kotak punya tombol potong
    await page.evaluate(id => { select('obj', id); renderInspector(); }, id);
    assert.ok(await page.evaluate(() => [...document.querySelectorAll('#inspector button')].some(b => /Potong \(tracing\)/.test(b.textContent))));
    const bola = await taruh(page, 'bentuk_bola', 5, 0);
    await page.evaluate(id => { select('obj', id); renderInspector(); }, bola);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('#inspector button')].some(b => /Potong \(tracing\)/.test(b.textContent))), false);
    const [zb] = await jalan(page, 5, 3);
    assert.ok(zb > 0.5, 'bola menghalangi (z=' + zb + ')');
    // bentuk rendah bisa dipijak (naik di atasnya)
    await taruh(page, 'bentuk_kotak', 10, 0, { sx: 3, sy: 0.15, sz: 3 });
    const [z3, kaki] = await jalan(page, 10, 3, 24);                   // ±2,8 m: berhenti di atas kotak (z −1,5…1,5)
    assert.ok(z3 < 1.4 && z3 > -1.4 && kaki > 0.1, 'naik ke atas kotak rendah: ' + JSON.stringify([z3, kaki]));
  },
  'prisma bebas lewat tracing (seperti void bebas), gambar ulang alas; data alas & potongan disaring': async (page) => {
    await kosongkan(page);
    await page.click('.tabs button[data-tab="objects"]');
    assert.ok((await page.$$eval('#cat-bentuk .cat-item', bs => bs.map(b => b.textContent))).includes('Prisma bebas (tracing)'));
    await page.click('#cat-bentuk .cat-item:has-text("Prisma bebas")');
    assert.deepEqual(await page.evaluate(() => [TOOL, VT.mode.kind]), ['voidTrace', 'bentuk']);
    await page.evaluate(() => { VT.pts = [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 2 }, { x: 2, z: 3 }, { x: 0, z: 2 }]; selesaiTrace(); });
    const o = await page.evaluate(() => { const o = L().objects.at(-1); return [o.type, o.x, o.z, +o.sx.toFixed(2), +o.sz.toFixed(2), o.params.pts.length]; });
    assert.deepEqual(o, ['bentuk_prisma', 2, 1.5, 4, 3, 5]);
    // permukaan atas prisma = alas yang digambar (luas 4×2 + segitiga 4×1/2 = 10 m²)
    const luas = await page.evaluate(() => { const o = L().objects.at(-1); return Math.abs(luasPoli(o.params.pts.map(([x, z]) => [x * o.sx, z * o.sz]))); });
    assert.equal(+luas.toFixed(2), 10);
    // data jahat dari berkas: titik bukan angka / larik raksasa diabaikan, tidak galat
    await page.evaluate(() => { const o = L().objects.at(-1); o.params.pts = [['x', 'y'], [1e9, 0]]; o.params.potong = [[[0, 0], ['a']], 'z']; rebuildScene(); });
    assert.equal(await page.evaluate(() => potonganAman(L().objects.at(-1).params.potong).length), 0);
  },
  'lantai bebas lewat tracing: pelat di lantai aktif, bisa dipijak; tanah (juga bukit) selalu di bawah lantai': async (page) => {
    await kosongkan(page);
    await page.click('.tabs button[data-tab="objects"]');
    await page.click('#cat-void .cat-item:has-text("Lantai bebas")');
    assert.deepEqual(await page.evaluate(() => [TOOL, VT.mode.kind, VT.mode.type]), ['voidTrace', 'area', 'lantai']);
    await page.evaluate(() => { VT.pts = [{ x: -2, z: -2 }, { x: 2, z: -2 }, { x: 2, z: 2 }, { x: -2, z: 2 }]; selesaiTrace(); });
    const lantai = await page.evaluate(() => { const o = L().objects.at(-1); let m = null; for (const g of grupObjek(o.id)) g.traverse(x => { if (x.userData.lantaiBebas) m = x; });
      const b = new THREE.Box3().setFromObject(m); return [o.params.jenis, +b.max.y.toFixed(3), +b.min.y.toFixed(3)]; });
    assert.deepEqual(lantai, ['lantai', 0, -0.15]);
    // bukit dinaikkan tepat di bawah pelat & di luar: di bawah pelat tanah ditekan, di luar tetap bukit
    const h = await page.evaluate(() => { reliefSiap(); const R = PROJECT.site.relief; R.h.fill(150); rebuildScene(); return [tinggiTanah(0, 0), tinggiTanah(6, 6)]; });
    assert.ok(h[0] <= -0.12 && h[1] > 1, 'tanah di bawah lantai ditekan, di luar tetap bukit: ' + JSON.stringify(h));
    // di mode jalan berdiri di atas pelat
    const kaki = await page.evaluate(() => { enterFPS(); camera.position.set(0, 2, 0); FPS.feet = 1; for (let i = 0; i < 30; i++) fpsStep(0.05); const f = FPS.feet; exitFPS(); return +f.toFixed(2); });
    assert.equal(kaki, 0);
    // lantai bebas di lantai 2 ada di elevasi lantai itu
    const y2 = await page.evaluate(() => { addLevel(); PROJECT.active = 1; mulaiTrace({ kind: 'area', type: 'lantai' }, null);
      VT.pts = [{ x: 0, z: 0 }, { x: 3, z: 0 }, { x: 3, z: 3 }]; selesaiTrace(); const o = L().objects.at(-1); let m = null; for (const g of grupObjek(o.id)) g.traverse(x => { if (x.userData.lantaiBebas) m = x; });
      return [+new THREE.Box3().setFromObject(m).max.y.toFixed(2), +levelElevation(1).toFixed(2)]; });
    assert.equal(y2[0], y2[1]);
  },
};
