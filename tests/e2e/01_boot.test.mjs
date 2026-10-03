import assert from 'node:assert/strict';
import { buatDenah } from './harness.mjs';

export const tes = {
  // pustaka terkunci SRI benar-benar termuat (hash cocok) dan CSP aktif
  'aplikasi menyala, pustaka SRI termuat, CSP terpasang': async (page) => {
    const r = await page.evaluate(() => ({
      rev: THREE.REVISION, gltf: typeof THREE.GLTFLoader, orbit: typeof THREE.OrbitControls,
      csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || '',
      srTanpaIntegrity: [...document.querySelectorAll('script[src^="http"]')].filter(s => !s.integrity).length
    }));
    assert.equal(r.rev, '128');
    assert.equal(r.gltf, 'function');
    assert.equal(r.orbit, 'function');
    assert.match(r.csp, /object-src 'none'/);
    assert.equal(r.srTanpaIntegrity, 0);
  },
  'denah contoh → dinding, simpan → muat bolak-balik utuh': async (page) => {
    await buatDenah(page);
    const r = await page.evaluate(() => {
      const a = JSON.parse(JSON.stringify(PROJECT)), b = sanitasiProyek(a);
      return { w0: L().walls.length, w1: b.levels[0].walls.length, o0: L().objects.length, o1: b.levels[0].objects.length };
    });
    assert.ok(r.w0 >= 4, 'dinding terlalu sedikit: ' + r.w0);
    assert.equal(r.w1, r.w0);
    assert.equal(r.o1, r.o0);
  }
};
