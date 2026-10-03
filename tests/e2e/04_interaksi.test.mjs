import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { FIX, muatProyekJSON } from './harness.mjs';

// ruang 8×8 m kosong + sofa katalog; model uji dari fixture glTF (materialnya "lampshade_glass")
const RUANG = { name: 'Uji interaksi', levels: [{ name: 'L1', height: 3, walls: [
  { x1: -4, z1: -4, x2: 4, z2: -4 }, { x1: 4, z1: -4, x2: 4, z2: 4 }, { x1: 4, z1: 4, x2: -4, z2: 4 }, { x1: -4, z1: 4, x2: -4, z2: -4 }],
  objects: [{ id: 'sofa', kind: 'furn', type: 'sofa3', x: 0, z: -2.5, rotY: 0, params: {} }] }] };

export async function siapkan(page) {
  await muatProyekJSON(page, RUANG);
  const gltf = JSON.parse(fs.readFileSync(path.join(FIX, 'kursi_1k.gltf'), 'utf8'));
  gltf.materials[0].name = 'lampshade_glass';
  const bin = fs.readFileSync(path.join(FIX, 'kursi.bin')).toString('base64');
  const jpg = fs.readFileSync(path.join(FIX, 'kursi_diff_1k.jpg')).toString('base64');
  await page.evaluate(async ([gltf, bin, jpg]) => {
    const isi = { 'kursi.bin': new Uint8Array(bufFromB64(bin)), 'textures/kursi_diff_1k.jpg': new Uint8Array(bufFromB64(jpg)) };
    const glb = gltfKeGLB(gltf, uri => /^data:/.test(uri) ? dataURIkeU8(uri) : isi[uri]);
    const r = await daftarkanAset('Model uji', glb);
    const m = (id, x, z, params) => ({ id, kind: 'model', type: r.id, x, y: 0, z, rotY: 0, sx: 1, sy: 1, sz: 1, params });
    L().objects.push(m('mLampu', 2, 2, { interaksi: 'lampu' }), m('mAudio', -2, 2, { interaksi: 'audio', audioJenis: 'cd_player' }),
      m('mDuduk', 2.5, -2.5, { interaksi: 'duduk', tinggiDuduk: 0.45, collider: false }), m('mPiano', -2.5, -2.5, { interaksi: 'piano' }), m('mBiasa', 0, 0, {}));
    rebuildScene();
  }, [gltf, bin, jpg]);
}
const grp = (page, id) => page.evaluate(id => { const g = findGroup('obj', id); return g ? { jenis: g.userData.nyalaJenis || null } : null; }, id);

export const tes = {
  'model unggahan: kategori lampu / audio / piano / duduk terpasang': async (page) => {
    await siapkan(page);
    assert.equal((await grp(page, 'mLampu')).jenis, 'lampu');
    assert.equal((await grp(page, 'mAudio')).jenis, 'audio');
    assert.equal((await grp(page, 'mPiano')).jenis, 'piano');
    assert.equal((await grp(page, 'mDuduk')).jenis, 'duduk');
    assert.equal((await grp(page, 'mBiasa')).jenis, null, 'model tanpa kategori tidak boleh interaktif');
    assert.equal((await grp(page, 'sofa')).jenis, 'duduk', 'sofa katalog bisa diduduki');
    // lampu: cahaya dibangkitkan & ikut kolam lampu; bagian "glass/shade" menyala/padam
    const r = await page.evaluate(() => {
      const g = findGroup('obj', 'mLampu'); let kaca = null, halo = null;
      g.traverse(m => { if (m.userData.nyalaOff) kaca = m; if (m.userData.halo) halo = m; });
      const awal = { ada: LAMPU_PASANG.some(L => L.id === 'mLampu'), menyala: kaca.material === kaca.userData.nyala, halo: halo.visible };
      pakai({ jenis: 'lampu', id: 'mLampu', grp: g });
      const g2 = findGroup('obj', 'mLampu'); let k2 = null, h2 = null; g2.traverse(m => { if (m.userData.nyalaOff) k2 = m; if (m.userData.halo) h2 = m; });
      return { ...awal, mati: MATI.has('mLampu'), padam: k2.material === k2.userData.nyalaOff, haloMati: !h2.visible,
        emis: kaca.userData.nyala.emissive.getHex() !== 0 };
    });
    assert.deepEqual(r, { ada: true, menyala: true, halo: true, mati: true, padam: true, haloMati: true, emis: true });
    // audio: putar & hentikan
    const a = await page.evaluate(async () => { enterFPS(); await new Promise(r => setTimeout(r, 300));
      const g = findGroup('obj', 'mAudio'); pakai({ jenis: 'audio', id: 'mAudio', grp: g }); const main = AUDIO.main.has('mAudio');
      pakai({ jenis: 'audio', id: 'mAudio', grp: g }); return { main, jenis: AUDIO.grup.get('mAudio')?.jenis, berhenti: !AUDIO.main.has('mAudio') }; });
    assert.deepEqual(a, { main: true, jenis: 'cd_player', berhenti: true });
    // piano
    const p = await page.evaluate(() => { pakai({ jenis: 'piano', id: 'mPiano', grp: findGroup('obj', 'mPiano') }); const b = PIANO.buka; tutupPiano(); exitFPS(); return b; });
    assert.equal(p, true);
    // inspector: pilihan kategori tersedia dan mengubah params
    const ins = await page.evaluate(() => { select('obj', 'mBiasa'); renderInspector();
      const s = [...document.querySelectorAll('#inspector select')].find(x => [...x.options].some(o => o.value === 'lampu'));
      if (!s) return 'tanpa pilihan'; s.value = 'duduk'; s.dispatchEvent(new Event('change'));
      return L().objects.find(o => o.id === 'mBiasa').params.interaksi; });
    assert.equal(ins, 'duduk');
  },
  'duduk di sofa katalog (bidik + E) lalu berdiri dengan berjalan; duduk di model': async (page) => {
    // Bidikan & animasi duduk diperbarui per frame. WebGL software di CI butuh ±1,5–2,5 s
    // per frame saat sofa memenuhi layar, jadi batas 10 s hanya ±5 frame — terlalu mepet
    // (di main pun ±5 s lokal). Batas tunggu per frame dinaikkan; isi pemeriksaannya sama.
    const TUNGGU = { timeout: 30000 };
    await siapkan(page);
    await page.evaluate(() => { enterFPS(); camera.position.set(0, 1.6, -0.6); FPS.feet = 0; FPS.yaw = Math.PI; FPS.pitch = -0.55; });
    await page.waitForFunction(() => AIM && AIM.jenis === 'duduk', undefined, TUNGGU);
    assert.equal(await page.evaluate(() => labelAksi(AIM)), 'Duduk');
    await page.keyboard.press('e');
    await page.waitForFunction(() => FPS.duduk && FPS.duduk.t >= 1, undefined, TUNGGU);     // animasi turun selesai
    const d = await page.evaluate(() => ({ y: camera.position.y, z: camera.position.z, yaw: FPS.yaw, duduk: !!FPS.duduk }));
    assert.ok(d.duduk, 'tidak duduk');
    assert.ok(Math.abs(d.y - (0.42 + 0.72)) < 0.03, 'tinggi mata duduk ' + d.y);
    assert.ok(Math.abs(d.z - (-2.5 + 0.06)) < 0.05, 'posisi dudukan ' + d.z);
    assert.ok(Math.abs(d.yaw) < 0.01, 'harus menghadap depan sofa (+z), yaw ' + d.yaw);
    // dari sofa: tombol aksi menjadi "Berdiri" saat tidak membidik apa pun
    await page.evaluate(() => { FPS.pitch = 0.6; });
    await page.waitForFunction(() => labelAksi(AIM) === 'Berdiri', undefined, TUNGGU);
    await page.keyboard.down('w'); await page.waitForFunction(() => !FPS.duduk, undefined, TUNGGU); await page.keyboard.up('w');
    const b = await page.evaluate(() => ({ duduk: !!FPS.duduk, y: camera.position.y }));
    assert.equal(b.duduk, false);
    assert.ok(b.y > 1.5, 'kembali berdiri, y ' + b.y);
    // model kategori duduk
    await page.evaluate(() => { const g = findGroup('obj', 'mDuduk'); pakai({ jenis: 'duduk', id: 'mDuduk', grp: g, titik: g.position.clone() }); });
    await page.waitForFunction(() => FPS.duduk && FPS.duduk.t >= 1, undefined, TUNGGU);
    const m = await page.evaluate(() => ({ y: camera.position.y, x: camera.position.x, duduk: FPS.duduk && FPS.duduk.id }));
    assert.equal(m.duduk, 'mDuduk');
    assert.ok(Math.abs(m.y - (0.45 + 0.72)) < 0.03, 'mata di model ' + m.y);
    assert.ok(Math.abs(m.x - 2.5) < 0.1);
    await page.evaluate(() => { pakai(null); });
    assert.equal(await page.evaluate(() => !!FPS.duduk), false);
    await page.evaluate(() => exitFPS());
  }
};
