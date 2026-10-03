import assert from 'node:assert/strict';
import { buatDenah, muatProyekJSON } from './harness.mjs';

const XSS = '<img src=x onerror="window.__xss=(window.__xss||0)+1">';
function proyekJahat() {
  return {
    v: 3, name: 'Proyek ' + XSS, levels: [{
      id: 'lv1', name: XSS, height: 3,
      walls: [{ id: 'w1', x1: 0, z1: 0, x2: 5, z2: 0, thickness: 0.15, openings: [] },
              { id: 'w2', x1: 'NaN', z1: 0, x2: 0, z2: 4, thickness: 1e9, openings: [] },
              { id: 'w3', x1: 0, z1: 4, x2: 0, z2: 4, openings: [] }],
      objects: [{ id: 'o1', kind: 'model', type: 'as"><img src=x onerror=window.__xss=9>', x: 1, z: 1, params: { PROTO: { jahat: 1 } } }]
    }],
    assets: { 'as"><img src=x onerror=window.__xss=9>': { name: 'x', data: 'AAAA' } },
    plans: { lv1: { img: 'https://pelacak.example/p.png', w: 10, h: 10 } },
    finish: { inColor: 'red;background:url(https://pelacak.example)' },
    langit: { mode: 'prosedural', id: '../../etc' }
  };
}

export const tes = {
  'G1+G2: proyek berisi skrip tidak dieksekusi & disaring': async (page) => {
    let luar = 0;
    await page.route('https://pelacak.example/**', r => { luar++; r.abort(); });
    await muatProyekJSON(page, JSON.stringify(proyekJahat()).replace('"PROTO"', '"__proto__"'));
    await page.evaluate(() => { updateStatsBar && updateStatsBar(); renderCatalogs(); enterFPS(); });
    await page.waitForTimeout(800);
    await page.evaluate(() => exitFPS());
    const r = await page.evaluate(() => ({
      xss: window.__xss || 0, imgX: document.querySelectorAll('img[src="x"]').length,
      nama: L().name, dinding: L().walls.length, tebal: Math.max(...L().walls.map(w => w.thickness)),
      denah: Object.keys(PROJECT.plans).length, aset: Object.keys(PROJECT.assets).length,
      warna: PROJECT.finish.inColor, langitId: PROJECT.langit.id, proto: ({}).jahat
    }));
    assert.equal(r.xss, 0, 'skrip dari berkas proyek tereksekusi');
    assert.equal(r.imgX, 0);
    assert.equal(r.nama, proyekJahat().levels[0].name, 'nama tetap ada sebagai teks biasa');
    assert.equal(r.dinding, 2, 'dinding nol-panjang dibuang, NaN dinormalkan');
    assert.ok(r.tebal <= 2, 'tebal dijepit');
    assert.equal(r.denah, 0, 'gambar denah ber-URL luar ditolak');
    assert.equal(r.aset, 0, 'aset ber-id tidak aman ditolak');
    assert.equal(r.warna, '#efece5');
    assert.equal(r.langitId, null);
    assert.equal(r.proto, undefined, 'prototype pollution');
    assert.equal(luar, 0, 'ada permintaan ke host luar');
  },
  'G2: berkas rusak tidak merusak proyek yang terbuka (atomik)': async (page) => {
    await buatDenah(page);
    const awal = await page.evaluate(() => ({ n: L().walls.length, nama: PROJECT.name }));
    await muatProyekJSON(page, '{ ini bukan json');
    // rebuild yang gagal di tengah jalan → harus dipulihkan
    // gagal deterministik: hanya saat yang dirender adalah proyek baru ("Baru")
    await page.evaluate(() => { window.__rb = rebuildScene; rebuildScene = function () { if (PROJECT.levels[0] && PROJECT.levels[0].name === 'Baru') throw new Error('uji gagal'); return window.__rb.apply(this, arguments); }; });
    await muatProyekJSON(page, { name: 'Proyek Baru', levels: [{ name: 'Baru', walls: [{ x1: 0, z1: 0, x2: 3, z2: 0 }] }] });
    await page.evaluate(() => { rebuildScene = window.__rb; });
    const akhir = await page.evaluate(() => ({ n: L().walls.length, nama: PROJECT.name, lv: PROJECT.levels.length }));
    assert.equal(akhir.n, awal.n);
    assert.equal(akhir.nama, awal.nama);
    assert.equal(akhir.lv, 1);
  },
  'G3: model yang merujuk berkas luar ditolak tanpa permintaan jaringan': async (page) => {
    let luar = 0;
    await page.route('https://pelacak.example/**', r => { luar++; r.abort(); });
    const pesan = await page.evaluate(async () => {
      const j = { asset: { version: '2.0' }, buffers: [{ uri: 'https://pelacak.example/x.bin', byteLength: 4 }], scenes: [{ nodes: [] }] };
      try { await parseAsset('uji', new TextEncoder().encode(JSON.stringify(j)).buffer); return 'diterima'; } catch (e) { return e.message; }
    });
    assert.match(pesan, /berkas di luar dirinya/);
    assert.equal(luar, 0);
  },
  'G6: galat tak tertangkap dicatat': async (page) => {
    await page.evaluate(() => { setTimeout(() => { throw new Error('galat-uji'); }, 0); });
    await page.waitForTimeout(300);
    const n = await page.evaluate(() => window.__galat.filter(g => /galat-uji/.test(g.m)).length);
    assert.equal(n, 1);
  }
};
tes['G6: galat tak tertangkap dicatat'].izinGalat = true;
