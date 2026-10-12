import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { FIX, CORS } from './harness.mjs';

// JEV-092: tanah situs memakai foto Poly Haven (warna + normal + kekasaran), warnanya dibaca sRGB
// seperti tekstur model scan; luring → tekstur prosedural tetap (juga sRGB)

const jpg = () => fs.readFileSync(path.join(FIX, 'kursi_diff_1k.jpg'));
const daftar = {
  aerial_grass_rock: { name: 'Aerial Grass Rock', categories: ['terrain', 'aerial'], tags: ['grass', 'aerial'], download_count: 999 },
  grass_wall_01: { name: 'Grass Wall', categories: ['wall'], tags: ['grass'], download_count: 500 },
  lawn_grass_01: { name: 'Lawn Grass 01', categories: ['terrain', 'natural'], tags: ['grass', 'lawn'], download_count: 50, dimensions: [2000, 2000] },
  meadow_grass: { name: 'Meadow', categories: ['natural'], tags: ['grass'], download_count: 80 },
  brown_mud_02: { name: 'Brown Mud 02', categories: ['terrain'], tags: ['mud', 'soil'], download_count: 40 },
};
const f = n => ({ '1k': { jpg: { url: `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/x/${n}.jpg` } } });
const rutePH = async page => {
  await page.route('https://api.polyhaven.com/**', r => {
    if (r.request().url().includes('/assets')) return r.fulfill({ json: daftar, headers: CORS });
    return r.fulfill({ json: { Diffuse: f('diff'), nor_gl: f('nor'), Rough: f('rough') }, headers: CORS });
  });
  await page.route('https://dl.polyhaven.org/**', r => r.fulfill({ body: jpg(), headers: { ...CORS, 'content-type': 'image/jpeg' } }));
};

export const tes = {
  'tanah foto: rumput dari Poly Haven (bukan foto udara / dinding), warna + normal + kekasaran, sRGB': Object.assign(async (page) => {
    await page.waitForFunction(() => window.TANAHFOTO && TANAHFOTO.info('rumput'), undefined, { timeout: 30000 });
    const r = await page.evaluate(() => {
      const t = teksturSitus('rumput'), m = matSitus('rumput');
      return { id: TANAHFOTO.info('rumput').id, foto: t.image instanceof HTMLImageElement, srgb: t.encoding === THREE.sRGBEncoding,
        normal: !!m.normalMap, kasar: !!m.roughnessMap, acak: !!m.userData.acakUlang, ulang: t.repeat.x };
    });
    assert.deepEqual(r, { id: 'lawn_grass_01', foto: true, srgb: true, normal: true, kasar: true, acak: true, ulang: 1 });
    // cat tanah: bahan campuran juga mendapat normal foto
    const c = await page.evaluate(async () => { await TANAHFOTO.pasang('tanah'); const m = matSitusCat('rumput'); return { normal: !!m.normalMap, tanah: TANAHFOTO.info('tanah').id }; });
    assert.deepEqual(c, { normal: true, tanah: 'brown_mud_02' });
  }, { opsi: { rute: rutePH } }),

  'tanah luring: Poly Haven tidak terjangkau → tekstur prosedural tetap, warnanya sRGB, tanpa galat': async (page) => {
    await page.waitForFunction(() => window.TANAHFOTO, undefined, { timeout: 20000 });
    const ok = await page.evaluate(() => TANAHFOTO.pasang('rumput'));
    const r = await page.evaluate(() => { const t = teksturSitus('rumput'); return { kanvas: t.image instanceof HTMLCanvasElement, srgb: t.encoding === THREE.sRGBEncoding }; });
    assert.deepEqual({ ok, ...r }, { ok: false, kanvas: true, srgb: true });
  },
};
