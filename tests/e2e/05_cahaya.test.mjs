import assert from 'node:assert/strict';
import { buatDenah, muatProyekJSON } from './harness.mjs';

// JEV-052: lampu di luar 4 slot berbayang tetap menerangi ruangannya (GI per ruang),
// di semua lantai yang tampak — termasuk saat dilihat dari luar rumah
export const tes = {
  'semua lampu menyala menerangi ruangannya, di dua lantai, dari luar rumah': async (page) => {
    await buatDenah(page);
    const r = await page.evaluate(async () => {
      addLevel(true);
      for (const [i, lv] of PROJECT.levels.entries()) {
        const P = petaRuang(lv), pusat = {};
        for (let j = 0; j < P.nz; j++) for (let k = 0; k < P.nx; k++) { const id = P.lab[j * P.nx + k];
          if (id > 0 && !P.bocor[id]) { const s = pusat[id] || (pusat[id] = { x: 0, z: 0, n: 0 }); s.x += P.x0 + (k + 0.5) * P.C; s.z += P.z0 + (j + 0.5) * P.C; s.n++; } }
        for (const [id, s] of Object.entries(pusat)) if (s.n > 40) lv.objects.push({ id: 'lmp' + i + '_' + id, kind: 'furn', type: 'pendant', x: s.x / s.n, y: 0, z: s.z / s.n, rotY: 0, sx: 1, sy: 1, sz: 1, params: {} });
      }
      setActiveLevel(0); setSuasana('malam'); rebuildScene();
      const bb = bboxOf(L().walls);
      enterFPS(); camera.position.set((bb.x0 + bb.x1) / 2, 1.6, bb.z1 + 9); FPS.feet = 0; FPS.yaw = Math.PI;
      await new Promise(r => setTimeout(r, 2500));
      const lvs = lantaiGI(), D = GI_U.giWarna.value.image.data;
      const terang = L => { const k = lvs.indexOf(L.idx), id = 1 + ((L.ruang - 1) % 254), o = (2 * k * 256 + id) * 4; return k >= 0 ? D[o] + D[o + 1] + D[o + 2] : -1; };
      const tanpaSlot = LAMPU_PASANG.filter(L => !KOLAM.some(l => l.userData.L && l.userData.L.id === L.id));
      const hasil = { lampu: LAMPU_PASANG.length, slot: KOLAM.filter(l => l.userData.L).length, lantai: lvs.length, skala: GI_U.giSkala.value,
        gelap: LAMPU_PASANG.filter(L => terang(L) <= 0).map(L => L.id), tanpaSlot: tanpaSlot.length, lantai2: LAMPU_PASANG.filter(L => L.idx === 1 && terang(L) > 0).length };
      // padamkan satu lampu tanpa slot → ruangannya kembali gelap
      const mati = tanpaSlot[0]; MATI.add(mati.id); await new Promise(r => setTimeout(r, 600));
      hasil.padam = terang(LAMPU_PASANG.find(L => L.id === mati.id));
      MATI.delete(mati.id); exitFPS();
      return hasil;
    });
    assert.ok(r.lampu > 4, 'perlu lebih banyak lampu daripada slot berbayang: ' + r.lampu);
    assert.equal(r.slot, 4);
    assert.equal(r.lantai, 2, 'GI harus mencakup kedua lantai');
    assert.ok(r.skala > 0);
    assert.ok(r.tanpaSlot > 0);
    assert.deepEqual(r.gelap, [], 'ruangan berlampu menyala yang tetap gelap: ' + r.gelap.join(', '));
    assert.ok(r.lantai2 > 0, 'lampu lantai 2 tidak menerangi ruangannya');
    assert.equal(r.padam, 0, 'lampu yang dipadamkan masih menerangi ruangannya');
  }
};

// JEV-053: lampu dinding luar tanpa slot berbayang tetap menerangi fasad,
// tetapi cahayanya tidak bocor ke ruangan di balik dinding
tes['lampu luar menyala semua dari jauh (tanpa slot berbayang)'] = async (page) => {
  await buatDenah(page);
  const r = await page.evaluate(async () => {
    const tidur = ms => new Promise(r => setTimeout(r, ms));
    const bb = bboxOf(L().walls), n = 6;
    for (let i = 0; i < n; i++) { orbit.target.set(bb.x0 + 0.8 + (bb.x1 - bb.x0 - 1.6) * i / (n - 1), 0, bb.z1 + 0.35); addObject('furn', 'wall_sconce'); }
    setSuasana('malam'); rebuildScene();
    enterFPS(); camera.position.set((bb.x0 + bb.x1) / 2, 1.6, bb.z1 + 7); FPS.feet = 0; FPS.yaw = Math.PI; FPS.pitch = 0.05;
    const luar = () => LAMPU_PASANG.filter(L => !MATI.has(L.id) && (!(L.ruang > 0) || petaRuang(PROJECT.levels[L.idx]).bocor[L.ruang]));
    const tanpaSlot = () => luar().filter(L => !KOLAM.some(l => l.userData.L && l.userData.L.id === L.id)).length;
    for (let i = 0; i < 300 && !(KOLAM.every(l => !l.userData.L || l.userData.f >= 1) && GI_U.luarN.value === tanpaSlot()); i++) await tidur(100);
    const h = { semuaLuar: luar().length, slot: KOLAM.filter(l => l.userData.L).length, luarN: GI_U.luarN.value };
    exitFPS(); return h;
  });
  assert.equal(r.semuaLuar, 6, 'keenam lampu tembok harus terdeteksi sebagai lampu luar');
  assert.equal(r.slot, 4);
  assert.equal(r.luarN, 2, 'dua lampu luar tanpa slot harus dihitung lewat shader');
};
tes['lampu luar tidak bocor ke dalam ruangan tertutup'] = async (page) => {
  // kotak 8×8 m tanpa bukaan; 4 downlight redup di dalam DIPAKSA memegang slot berbayang,
  // jadi keenam lampu tembok luar pasti lewat shader. Lantai dalam di dekat dinding itu
  // harus sama terangnya saat lampu luar nyala maupun padam.
  await muatProyekJSON(page, { name: 'Kotak', levels: [{ name: 'L1', height: 3, walls: [
    { x1: -4, z1: -4, x2: 4, z2: -4 }, { x1: 4, z1: -4, x2: 4, z2: 4 }, { x1: 4, z1: 4, x2: -4, z2: 4 }, { x1: -4, z1: 4, x2: -4, z2: -4 }], objects: [] }] });
  const r = await page.evaluate(async () => {
    const tidur = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 6; i++) { orbit.target.set(-3 + i * 1.2, 0, 4.35); addObject('furn', 'wall_sconce'); }
    for (const [x, z] of [[-1, -1], [1, -1], [-1, -2], [1, -2]]) L().objects.push({ id: 'dl' + x + z, kind: 'furn', type: 'downlight', x, y: 0, z, rotY: 0, sx: 1, sy: 1, sz: 1, params: { lumen: 100 } });
    setSuasana('malam'); rebuildScene();
    const asli = skorLampu; window.skorLampu = (L, ref) => (String(L.id).startsWith('dl') ? 0 : 1e9);   // slot = 4 downlight
    enterFPS(); camera.position.set(0, 1.6, 3.0); FPS.feet = 0; FPS.yaw = 0; FPS.pitch = -1.25;
    const terang = () => { const c = renderer.domElement, g = document.createElement('canvas'); g.width = 48; g.height = 36;
      const x = g.getContext('2d'); x.drawImage(c, 0, 0, 48, 36); const d = x.getImageData(0, 0, 48, 36).data; let s = 0;
      for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; return s / (d.length / 4); };
    const luar = LAMPU_PASANG.filter(L => !String(L.id).startsWith('dl'));
    const stabil = async (n) => { for (let i = 0; i < 300 && !(KOLAM.every(l => !l.userData.L || l.userData.f >= 1) && GI_U.luarN.value === n); i++) await tidur(100); await tidur(1500); };
    await stabil(6);
    const h = { luarN: GI_U.luarN.value, slot: KOLAM.map(l => l.userData.L && String(l.userData.L.id).slice(0, 2)).join(), ruang: RUANG_KAMERA.id };
    h.nyala = terang();
    for (const L of luar) MATI.add(L.id);
    await stabil(0);
    h.padam = terang();
    for (const L of luar) MATI.delete(L.id);
    window.skorLampu = asli; exitFPS();
    return h;
  });
  assert.equal(r.luarN, 6, 'semua lampu luar harus lewat shader');
  assert.equal(r.slot, 'dl,dl,dl,dl');
  assert.ok(r.ruang > 0);
  assert.ok(Math.abs(r.nyala - r.padam) < 1.5, `cahaya lampu luar bocor ke dalam: ${r.nyala.toFixed(1)} vs ${r.padam.toFixed(1)}`);
};
