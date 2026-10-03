import assert from 'node:assert/strict';
import { buatDenah } from './harness.mjs';

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
