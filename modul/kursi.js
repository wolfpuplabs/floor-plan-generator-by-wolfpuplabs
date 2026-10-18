/* Plan23D — JOK OTOMATIS untuk model unggahan yang bisa diduduki (JEV-130)
   Dulu titik duduk model = tengah kotak batasnya, menghadap +Z model (atau Arah hadap yang diatur sendiri). Model berisi
   dua kursi kemah membuat pemain duduk di celah antara keduanya; mobil membuat pemain duduk di antara jok depan; kursi
   yang depannya bukan +Z membuat pemain menghadap sandaran.
   Di sini model dipindai sekali (disimpan di userData): kisi sinar tegak dari atas, dalam sumbu model sendiri. Permukaan
   menghadap atas setinggi 0,2–1,1 m dengan ruang kepala ≥ 0,75 m = calon dudukan; sel bertetangga yang setinggi
   dikelompokkan menjadi satu jok. Arah hadap jok = menjauhi sandaran: dari empat sisi jok (sumbu model), sisi yang
   memiliki bidang 0,2–0,7 m di atas dudukan adalah sandaran; sisi seberangnya harus lega (lantai kaki lebih rendah).
   Dudukan tanpa sandaran (bangku, pouf) dipakai bila model tidak punya jok bersandaran. Jok dipilih yang terdekat dengan
   titik bidik (pemain) atau posisi NPC. Arah hadap yang diatur sendiri di panel tetap dihormati; model tanpa jok bersandaran
   yang Tinggi dudukannya diisi sendiri memakai isian itu. */
/* global cariObjek */
(function () {
  'use strict';
  const ray = new THREE.Raycaster(), _o = new THREE.Vector3(), _d = new THREE.Vector3(0, -1, 0), _n = new THREE.Vector3(), _m3 = new THREE.Matrix3();
  const TERLIHAT = o => { for (let x = o; x; x = x.parent) if (!x.visible) return false; return true; };

  function pindai(g) {
    g.updateMatrixWorld(true);
    const mesh = []; g.traverse(o => { if (o.isMesh && !o.isSkinnedMesh && TERLIHAT(o)) mesh.push(o); });
    if (!mesh.length) return [];
    const bb = new THREE.Box3().setFromObject(g), y0 = bb.min.y, yAtas = bb.max.y + 0.2;
    // sumbu model di dunia (mendatar) & bentang tapak dalam sumbu itu
    const ex = new THREE.Vector3(1, 0, 0).transformDirection(g.matrixWorld).setY(0).normalize(), ez = new THREE.Vector3(-ex.z, 0, ex.x);
    if (ez.dot(new THREE.Vector3(0, 0, 1).transformDirection(g.matrixWorld)) < 0) ez.negate();
    const c = bb.getCenter(new THREE.Vector3()); let u0 = 1e9, u1 = -1e9, w0 = 1e9, w1 = -1e9;
    for (const x of [bb.min.x, bb.max.x]) for (const z of [bb.min.z, bb.max.z]) {
      const u = (x - c.x) * ex.x + (z - c.z) * ex.z, w = (x - c.x) * ez.x + (z - c.z) * ez.z;
      u0 = Math.min(u0, u); u1 = Math.max(u1, u); w0 = Math.min(w0, w); w1 = Math.max(w1, w); }
    const sel = Math.min(0.12, Math.max(0.04, Math.max(u1 - u0, w1 - w0) / 28));
    const NU = Math.max(1, Math.round((u1 - u0) / sel)), NW = Math.max(1, Math.round((w1 - w0) / sel));
    const titik = (u, w) => new THREE.Vector3(c.x + ex.x * u + ez.x * w, 0, c.z + ex.z * u + ez.z * w);
    // semua permukaan menghadap atas pada satu tiang: [{y, atas}] — atas = jarak ke permukaan apa pun di atasnya
    const tiang = (p) => {
      _o.set(p.x, yAtas, p.z); ray.set(_o, _d); ray.far = yAtas - y0 + 0.05;
      const h = ray.intersectObjects(mesh, false), out = [];
      for (let i = 0; i < h.length; i++) {
        const f = h[i].face; if (!f) continue;
        _n.copy(f.normal).applyMatrix3(_m3.getNormalMatrix(h[i].object.matrixWorld)).normalize();
        const y = h[i].point.y;                                  // h urut dari atas ke bawah: h[i-1] = permukaan di atasnya
        out.push({ y, atas: i ? h[i - 1].point.y - y : 99, naik: _n.y > 0.6 });
      }
      return out;
    };
    // kisi calon dudukan
    const kisi = new Map();
    for (let i = 0; i < NU; i++) for (let j = 0; j < NW; j++) {
      const u = u0 + (i + 0.5) * (u1 - u0) / NU, w = w0 + (j + 0.5) * (w1 - w0) / NW;
      for (const s of tiang(titik(u, w))) {
        const r = s.y - y0;
        if (s.naik && r >= 0.2 && r <= 1.1 && s.atas >= 0.75) { kisi.set(i + ',' + j, { i, j, u, w, y: s.y }); break; }
      }
    }
    // kelompok sel bertetangga yang setinggi (±7 cm)
    // disimpan dalam koordinat lokal model: tetap benar walau model digeser / diputar sesudahnya
    const jok = [], sudah = new Set(), inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
    for (const [k, s0] of kisi) {
      if (sudah.has(k)) continue;
      const grup = [], antre = [s0]; sudah.add(k);
      while (antre.length) { const s = antre.pop(); grup.push(s);
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const kk = (s.i + di) + ',' + (s.j + dj), t = kisi.get(kk);
          if (t && !sudah.has(kk) && Math.abs(t.y - s.y) < 0.07) { sudah.add(kk); antre.push(t); } } }
      if (grup.length * sel * sel < 0.05) continue;                                      // < ±22×22 cm: bukan dudukan
      const n = grup.length, u = grup.reduce((a, s) => a + s.u, 0) / n, w = grup.reduce((a, s) => a + s.w, 0) / n, y = grup.reduce((a, s) => a + s.y, 0) / n;
      const ru = Math.max(...grup.map(s => Math.abs(s.u - u))) + sel / 2, rw = Math.max(...grup.map(s => Math.abs(s.w - w))) + sel / 2;
      // jarak penghalang di tiap sisi: bidang 0,2–0,7 m di atas dudukan, diperiksa 2–35 cm di luar tepi jok (tiga titik sepanjang tepi)
      const jarak = (du, dw, lebar) => {
        for (const jauh of [0.02, 0.08, 0.15, 0.25, 0.35]) { let n2 = 0;
          for (const t of [-0.25, 0, 0.25]) {
            const p = titik(u + du * (ru + jauh) + dw * t * lebar * 2, w + dw * (rw + jauh) + du * t * lebar * 2);
            _o.set(p.x, y + 0.7, p.z); ray.set(_o, _d); ray.far = 0.5;
            if (ray.intersectObjects(mesh, false).length) n2++; }
          if (n2 >= 2) return jauh; }
        return 9; };
      const sisi = [[1, 0, rw], [-1, 0, rw], [0, 1, ru], [0, -1, ru]].map(([du, dw, l]) => jarak(du, dw, l));
      // sandaran = sisi dengan penghalang terdekat (menempel tepi jok); seberangnya harus jauh lebih lega (ruang kaki, dasbor jauh)
      let arah = null; const sb = sisi.indexOf(Math.min(...sisi));
      if (sisi[sb] <= 0.15 && sisi[sb ^ 1] >= sisi[sb] + 0.1) arah = sb ^ 1;                // depan = seberang sandaran
      const vek = arah === null ? null : [ex, ex.clone().negate(), ez, ez.clone().negate()][arah].clone();
      jok.push({ sel: grup.map(s => g.worldToLocal(titik(s.u, s.w).setY(s.y))), pos: g.worldToLocal(titik(u, w).setY(y)),
        arah: vek && vek.transformDirection(inv), sandar: arah !== null, lebar: Math.max(ru, rw) > 0.45 });
    }
    return jok.some(j => j.sandar) ? jok.filter(j => j.sandar) : jok;
  }

  // t: {grp, titik}; D: userData.duduk ({model, h, arah: derajat atau null = otomatis}). null = pakai cara lama (kotak batas).
  function titikDuduk(t, D) {
    const g = t.grp;
    if (!g.userData.jokOtomatis) { try { g.userData.jokOtomatis = pindai(g); } catch (e) { g.userData.jokOtomatis = []; } }
    const J = g.userData.jokOtomatis; if (!J.length) return null;
    // hanya dudukan tanpa sandaran (bangku, balok) & Tinggi dudukan diisi sendiri di panel: ikuti isian itu (cara lama)
    const o = typeof cariObjek === 'function' ? cariObjek(g.userData.id) : null;
    if (!J[0].sandar && o && o.params && o.params.tinggiDuduk != null) return null;
    g.updateMatrixWorld(true);
    const dunia = v => v.clone().applyMatrix4(g.matrixWorld), acuan = t.titik || dunia(J[0].pos);
    let best = null, bd = 1e9;
    for (const j of J) for (const p of j.sel) { const q = dunia(p), d = Math.hypot(q.x - acuan.x, q.z - acuan.z); if (d < bd) { bd = d; best = { j, q }; } }
    const j = best.j;
    // posisi duduk: sel terdekat di jok lebar (sofa / bangku panjang), tengah jok untuk jok sempit
    const pos = j.lebar ? best.q : dunia(j.pos);
    let arah = j.arah && j.arah.clone().transformDirection(g.matrixWorld).setY(0).normalize();
    if (D && D.arah != null) { const a = D.arah * Math.PI / 180; arah = new THREE.Vector3(Math.sin(a), 0, Math.cos(a)).transformDirection(g.matrixWorld).setY(0).normalize(); }
    if (!arah) arah = new THREE.Vector3(0, 0, 1).transformDirection(g.matrixWorld).setY(0).normalize();
    pos.y += 0.02; pos.addScaledVector(arah, 0.04);
    return { pos, arah };
  }
  // model berubah (pindah / skala / ganti berkas): pindai ulang
  function lupakan(g) { if (g) delete g.userData.jokOtomatis; }

  window.KURSI = { titikDuduk, lupakan, _pindai: pindai };
})();
