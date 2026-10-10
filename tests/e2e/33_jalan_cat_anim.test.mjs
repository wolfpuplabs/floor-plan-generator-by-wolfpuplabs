import assert from 'node:assert/strict';
import { muatProyekJSON } from './harness.mjs';

// JEV-084: jalan di tanah bawaan tanpa dinding, kuas cat tanah/batu yang membaur, animasi model
// unggahan (diketuk / otomatis, ikut lobi) dan media audio/video yang diputar saat objek diketuk.

// kesalahan shader three.js muncul sebagai console.error, bukan pageerror
const catatGalat = page => { const g = []; page.on('console', m => { if (m.type() === 'error' && /shader|WebGL|THREE/i.test(m.text())) g.push(m.text().slice(0, 300)); }); return g; };

// GLB beranimasi: kotak bernama "kotak" naik 1 m lalu turun dalam 2 detik
async function modelBeranimasi(page) {
  return page.evaluate(async () => {
    const root = new THREE.Group(), m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: 0x3366cc }));
    m.name = 'kotak'; root.add(m);
    const klip = new THREE.AnimationClip('naik', 2, [new THREE.VectorKeyframeTrack('kotak.position', [0, 1, 2], [0, 0, 0, 0, 1, 0, 0, 0, 0])]);
    const glb = await new Promise((ok, no) => { try { new THREE.GLTFExporter().parse(root, ok, { binary: true, animations: [klip] }); } catch (e) { no(e); } });
    await importModelFiles([new File([glb], 'robot.glb', { type: 'model/gltf-binary' })]);
    return Object.keys(PROJECT.assets).pop();
  });
}

export const tes = {
  'jalan-jalan di petak rumput bawaan tanpa dinding': async (page) => {
    const r = await page.evaluate(() => {
      document.getElementById('toast').textContent = '';
      enterFPS();
      const on = FPS.on, kaki = FPS.feet, y = camera.position.y, t = document.getElementById('toast').textContent;
      exitFPS();
      return { dinding: L().walls.length, on, kaki: +kaki.toFixed(2), mata: +(y - kaki).toFixed(2), t };
    });
    assert.equal(r.dinding, 0);
    assert.equal(r.on, true, 'mode jalan terbuka: ' + r.t);
    assert.doesNotMatch(r.t, /Belum ada ruangan/);
    assert.ok(Math.abs(r.kaki) < 0.1, 'berdiri di permukaan tanah: ' + r.kaki);
    // tanah disembunyikan & tanpa objek: tetap ditolak dengan pesan
    const t = await page.evaluate(() => { PROJECT.site.sembunyi = true; rebuildScene(); document.getElementById('toast').textContent = ''; enterFPS(); const on = FPS.on; if (on) exitFPS(); return { on, t: document.getElementById('toast').textContent }; });
    assert.deepEqual(t, { on: false, t: 'Belum ada ruangan untuk dijelajahi.' });
  },
  'kuas cat tanah & batu: bobot tersimpan, membaur di shader, sanitasi & hapus cat': async (page) => {
    const galat = catatGalat(page);
    const r = await page.evaluate(() => {
      PROJECT.site = { tanah: 'rumput', margin: 6 }; rebuildScene();
      TANAH.kuat = 1; TANAH.kuas = 2;
      TANAH.mode = 'cat_batu'; for (let i = 0; i < 6; i++) sapuTanah({ x: 1, z: 0 }, 0.1);
      TANAH.mode = 'cat_tanah'; for (let i = 0; i < 6; i++) sapuTanah({ x: -1.5, z: 0 }, 0.1);
      rebuildScene();
      const R = PROJECT.site.relief, q = (x, z) => Math.round((z - R.z0) / R.c) * R.nx + Math.round((x - R.x0) / R.c);
      const g = worldRoot.children.find(o => o.userData.situsGrup), m = g.children.find(o => o.userData.situs);
      renderer.render(scene, camera);
      return { batu: R.cat.b[q(1, 0)], tanahDiBatu: R.cat.t[q(1, 0)], tanah: R.cat.t[q(-1.5, 0)], jauh: R.cat.b[q(-2.9, -2.9)] + R.cat.t[q(-2.9, -2.9)],
        datar: R.h.every(v => v === 0), atribut: !!m.geometry.attributes.catBobot, kunci: m.material.customProgramCacheKey(), bayang: m.castShadow };
    });
    assert.equal(r.batu, 100); assert.equal(r.tanahDiBatu, 0); assert.equal(r.tanah, 100); assert.equal(r.jauh, 0);
    assert.equal(r.datar, true, 'mengecat tidak mengubah tinggi tanah');
    assert.deepEqual([r.atribut, r.kunci, r.bayang], [true, 'situsCat', false]);
    assert.deepEqual(galat, []);
    // hapus cat sebagian, datarkan tanah tetap menyimpan cat, Hapus semua cat membuangnya
    const h = await page.evaluate(() => {
      TANAH.mode = 'cat_hapus'; for (let i = 0; i < 6; i++) sapuTanah({ x: 1, z: 0 }, 0.1);
      const R = PROJECT.site.relief, q = Math.round((0 - R.z0) / R.c) * R.nx + Math.round((1 - R.x0) / R.c), b = R.cat.b[q];
      TANAH.mode = 'naik'; sapuTanah({ x: 2, z: 2 }, 0.2);
      document.getElementById('tanahReset').click();
      const tetap = !!(PROJECT.site.relief && PROJECT.site.relief.cat), datar = PROJECT.site.relief.h.every(v => v === 0);
      document.getElementById('tanahCatReset').click();
      const g = worldRoot.children.find(o => o.userData.situsGrup), m = g.children.find(o => o.userData.situs);
      return { b, tetap, datar, sisa: !!PROJECT.site.relief, atribut: !!m.geometry.attributes.catBobot };
    });
    assert.deepEqual(h, { b: 0, tetap: true, datar: true, sisa: false, atribut: false });
    // berkas proyek: bobot di luar 0..100 dijepit, larik yang panjangnya salah dibuang
    const proyek = { v: 1, levels: [{ name: 'L1', height: 3, walls: [], objects: [] }],
      site: { tanah: 'rumput', margin: 6, relief: { c: 1, x0: -3, z0: -3, nx: 7, nz: 7, h: new Array(49).fill(0), cat: { t: new Array(49).fill(250), b: new Array(49).fill(-9) } } } };
    assert.match(await muatProyekJSON(page, proyek), /Proyek dimuat/);
    const c = await page.evaluate(() => { const C = PROJECT.site.relief.cat; return [Math.max(...C.t), Math.min(...C.b)]; });
    assert.deepEqual(c, [100, 0]);
    proyek.site.relief.cat.t = [1, 2, 3];
    await muatProyekJSON(page, proyek);
    assert.equal(await page.evaluate(() => 'cat' in PROJECT.site.relief), false);
    assert.deepEqual(galat, []);
  },
  'animasi model unggahan: diketuk, berlanjut setelah bangun ulang, otomatis di mode jalan, ikut lobi': async (page) => {
    const id = await modelBeranimasi(page);
    const a = await page.evaluate(id => {
      L().objects.push({ id: 'oa', kind: 'model', type: id, x: 0, y: 0, z: 0, rotY: 0, sx: 1, sy: 1, sz: 1, params: { aksi: { anim: { ulang: true } } } });
      rebuildScene(); return { klip: ASSET_ANIM.get(id).map(c => c.name), ak: aksiObjek(cariObjek('oa')).anim, label: labelAksi({ jenis: 'anim', id: 'oa' }) };
    }, id);
    assert.deepEqual(a, { klip: ['naik'], ak: { klip: '', ulang: true, otomatis: false }, label: 'Putar animasi' });
    // putaran gambar ikut memajukan waktu animasi di antara evaluate → diukur dalam satu langkah sinkron
    const y = await page.evaluate(() => { const tinggi = () => +grupObjek('oa')[0].getObjectByName('kotak').position.y.toFixed(3);
      togelGerak('oa'); stepGerak(0.5); const awal = tinggi();
      // bangun ulang (mis. setelah mengubah objek lain): melanjutkan dari waktunya, tidak kembali ke awal
      const t0 = GERAK.main.get('oa').t; rebuildScene(); stepGerak(0.25); const u = (t0 + 0.25) % 2;
      return { awal, lanjut: tinggi(), harap: +(u <= 1 ? u : 2 - u).toFixed(3), t0 }; });
    assert.equal(y.awal, 0.5);
    assert.ok(Math.abs(y.lanjut - y.harap) < 0.002 && y.harap > 0.5, JSON.stringify(y));
    assert.equal(await page.evaluate(() => labelAksi({ jenis: 'anim', id: 'oa' })), 'Hentikan animasi');
    // lobi: keadaan dibagi & diterapkan dari peserta lain
    const l = await page.evaluate(() => { const k = keadaanAksi().anim; const lepas = terapkanAksiLuar('anim', 'oa', false); const lagi = terapkanAksiLuar('anim', 'oa', false);
      return { k, lepas, lagi, main: gerakJalan('oa') }; });
    assert.deepEqual(l, { k: ['oa'], lepas: true, lagi: false, main: false });
    // otomatis: diputar saat masuk mode jalan, berhenti saat keluar
    const o = await page.evaluate(() => { cariObjek('oa').params.aksi.anim.otomatis = true; rebuildScene(); const di = gerakJalan('oa');
      enterFPS(); const jalan = gerakJalan('oa'); exitFPS(); return { di, jalan, keluar: gerakJalan('oa') }; });
    assert.deepEqual(o, { di: false, jalan: true, keluar: false });
    // klip yang tidak ada di aset & model tanpa animasi: tidak ada aksi animasi
    const n = await page.evaluate(id => { cariObjek('oa').params.aksi.anim.klip = 'tidak-ada'; const k = aksiObjek(cariObjek('oa')).anim.klip;
      ASSET_ANIM.delete(id); return { k, tanpa: aksiObjek(cariObjek('oa')) }; }, id);
    assert.deepEqual(n, { k: '', tanpa: null });
  },
  'klon model berkulit: kerangka salinan menunjuk tulangnya sendiri': async (page) => {
    const r = await page.evaluate(() => {
      const geo = new THREE.BoxGeometry(0.2, 1, 0.2, 1, 4, 1), n = geo.attributes.position.count, si = [], sw = [];
      for (let i = 0; i < n; i++) { const y = geo.attributes.position.getY(i); si.push(y > 0 ? 1 : 0, 0, 0, 0); sw.push(1, 0, 0, 0); }
      geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
      const b0 = new THREE.Bone(), b1 = new THREE.Bone(); b1.position.y = 0.5; b0.add(b1);
      const sm = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial()); sm.add(b0); sm.bind(new THREE.Skeleton([b0, b1]));
      const tpl = new THREE.Group(); tpl.add(sm); tpl.userData.berkulit = true;
      const c = klonModel(tpl), cs = c.children[0];
      const milik = b => { for (let p = b; p; p = p.parent) if (p === c) return true; return false; };
      return { beda: cs.skeleton !== sm.skeleton, tulang: cs.skeleton.bones.every(milik), asli: sm.skeleton.bones.every(b => !milik(b)) };
    });
    assert.deepEqual(r, { beda: true, tulang: true, asli: true });
  },
  'media objek: diputar langsung saat diketuk seperti suara, ikut tautan, tidak dibuang selama dipakai': async (page) => {
    const r = await page.evaluate(async () => {
      // WAV 0,1 dtk sunyi & potongan MP4 (cukup kepala ftyp untuk dikenali)
      const wav = new Uint8Array(44 + 1600), dv = new DataView(wav.buffer), tulis = (o, s) => [...s].forEach((c, i) => { wav[o + i] = c.charCodeAt(0); });
      tulis(0, 'RIFF'); dv.setUint32(4, 36 + 1600, true); tulis(8, 'WAVE'); tulis(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
      dv.setUint32(24, 8000, true); dv.setUint32(28, 16000, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); tulis(36, 'data'); dv.setUint32(40, 1600, true);
      const mp4 = new Uint8Array(64); mp4.set([0, 0, 0, 24], 0); [...'ftypisom'].forEach((c, i) => { mp4[4 + i] = c.charCodeAt(0); });
      const ma = await unggahMediaObjek(new File([wav], 'bel.wav'), 'media'), mv = await unggahMediaObjek(new File([mp4], 'tur.mp4'), 'media');
      let tolak = ''; try { await unggahMediaObjek(new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])], 'x.txt'), 'media'); } catch (e) { tolak = e.message; }
      L().walls = [[0, 0, 4, 0], [4, 0, 4, 3], [4, 3, 0, 3], [0, 3, 0, 0]].map(([a, b, c, d]) => ({ id: uid('w'), x1: a, z1: b, x2: c, z2: d, thickness: 0.15, openings: [] }));
      L().objects.push({ id: 'ov', kind: 'furn', type: 'bentuk_kotak', x: 1, y: 0, z: 1, rotY: 0, sx: 1, sy: 1, sz: 1, params: { aksi: { media: mv } } },
                       { id: 'oau', kind: 'furn', type: 'bentuk_kotak', x: -1, y: 0, z: 1, rotY: 0, sx: 1, sy: 1, sz: 1, params: { aksi: { media: ma } } });
      rebuildScene();
      // jenis aksi yang dibidik untuk objek bermedia saja (tanpa aksi bawaan)
      const cariTargetUji = id => { const g = grupObjek(id)[0]; g.updateMatrixWorld(true); const c = new THREE.Box3().setFromObject(g).getCenter(new THREE.Vector3());
        const r = new THREE.Raycaster(c.clone().add(new THREE.Vector3(0, 0, 1.5)), new THREE.Vector3(0, 0, -1)); const t = cariTarget(r); return t && t.jenis; };
      // diketuk = langsung diputar seperti suara (tanpa panel pemutar); ketuk lagi = berhenti
      const t1 = { jenis: cariTargetUji('oau'), label: labelAksi({ jenis: 'bunyi', id: 'oau' }) };
      pakai({ jenis: 'bunyi', id: 'oau' }); const main = mediaObjekJalan('oau'), loop = MEDIA_OBJ.get('oau').a.loop, label2 = labelAksi({ jenis: 'bunyi', id: 'oau' });
      pakai({ jenis: 'bunyi', id: 'oau' }); const henti = !mediaObjekJalan('oau');
      pakai({ jenis: 'bunyi', id: 'ov' }); const video = mediaObjekJalan('ov') && MEDIA_OBJ.get('ov').a instanceof HTMLAudioElement; hentikanSemuaMediaObjek();
      buangMediaYatim(mv); const tetap = !!PROJECT.media[mv];
      return { mime: [PROJECT.media[ma].mime, PROJECT.media[mv].mime], tolak, t1, main, loop, label2, henti, video, tetap, panel: !!document.getElementById('mediaPanel') };
    });
    assert.deepEqual(r.mime, ['audio/wav', 'video/mp4']);
    assert.match(r.tolak, /perlu video/);
    assert.deepEqual(r.t1, { jenis: 'bunyi', label: 'Bunyikan' });
    assert.deepEqual([r.main, r.loop, r.label2, r.henti, r.video, r.panel], [true, false, 'Hentikan suara', true, true, false]);
    assert.equal(r.tetap, true);
    // tautan lihat: media yang dipakai pemutar ikut sebagai lampiran
    await page.route('**/api/tautan**', async rt => { const u = new URL(rt.request().url());
      if (u.searchParams.get('cek')) return rt.fulfill({ json: { ada: false } });
      if (u.searchParams.get('bagian')) return rt.fulfill({ json: { ok: true } });
      return rt.fulfill({ json: { id: 'Med1aP1ayr' } }); });
    const n = await page.evaluate(async () => (await buatTautanLihat()).nLampiran);
    assert.equal(n, 2);
  },
};
