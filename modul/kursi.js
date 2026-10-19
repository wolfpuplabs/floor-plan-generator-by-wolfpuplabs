/* Plan23D — JOK OTOMATIS untuk model unggahan yang bisa diduduki (JEV-130)
   Dulu titik duduk model = tengah kotak batasnya, menghadap +Z model (atau Arah hadap yang diatur sendiri). Model berisi
   dua kursi kemah membuat pemain duduk di celah antara keduanya; mobil membuat pemain duduk di antara jok depan; kursi
   yang depannya bukan +Z membuat pemain menghadap sandaran.
   Di sini model dipindai sekali (disimpan di userData): kisi sinar tegak dari atas, dalam sumbu model sendiri. Permukaan
   menghadap atas setinggi 0,2–1,5 m (jok mobil tinggi ±1,1 m, JEV-136) dengan ruang kepala ≥ 0,75 m = calon dudukan; sel bertetangga yang setinggi
   dikelompokkan menjadi satu jok. Arah hadap jok = menjauhi sandaran: dari empat sisi jok (sumbu model), sisi yang
   memiliki bidang 0,2–0,7 m di atas dudukan adalah sandaran; sisi seberangnya harus lega (lantai kaki lebih rendah).
   Dudukan tanpa sandaran (bangku, pouf) dipakai bila model tidak punya jok bersandaran; bila ada jok beratap (kabin mobil),
   permukaan tanpa atap (pijakan samping, bemper) diabaikan; dudukan harus 28–80 cm dalamnya dengan ruang kaki lebih rendah
   di depannya — lantai kabin & bak kargo bukan jok (JEV-132). Jok dipilih yang terdekat dengan
   titik bidik (pemain) atau posisi NPC. Arah hadap yang diatur sendiri di panel tetap dihormati; model tanpa jok bersandaran
   yang Tinggi dudukannya diisi sendiri memakai isian itu. */
/* global cariObjek, fRow, selInput */
(function () {
  'use strict';
  const ray = new THREE.Raycaster(), _o = new THREE.Vector3(), _d = new THREE.Vector3(0, -1, 0), _n = new THREE.Vector3(), _m3 = new THREE.Matrix3();
  const SETIR = ['auto', 'kiri', 'kanan'];                              // params.setir model kendaraan (JEV-133)
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
        if (s.naik && r >= 0.2 && r <= 1.5 && s.atas >= 0.75) { kisi.set(i + ',' + j, { i, j, u, w, y: s.y, atap: s.atas < 3 }); break; }
      }
    }
    // kelompok sel bertetangga yang setinggi (±3,5 cm antartetangga: konsol tengah 7 cm lebih rendah tidak ikut jok)
    // disimpan dalam koordinat lokal model: tetap benar walau model digeser / diputar sesudahnya
    const jok = [], sudah = new Set(), inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
    for (const [k, s0] of kisi) {
      if (sudah.has(k)) continue;
      const grup = [], antre = [s0]; sudah.add(k);
      while (antre.length) { const s = antre.pop(); grup.push(s);
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const kk = (s.i + di) + ',' + (s.j + dj), t = kisi.get(kk);
          if (t && !sudah.has(kk) && Math.abs(t.y - s.y) < 0.035) { sudah.add(kk); antre.push(t); } } }
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
      const ruangKaki = ([du, dw, lebar]) => {
        for (const jauh of [0.12, 0.3]) { let n2 = 0;
          for (const t of [-0.25, 0, 0.25]) {
            const p = titik(u + du * (ru + jauh) + dw * t * lebar * 2, w + dw * (rw + jauh) + du * t * lebar * 2);
            _o.set(p.x, y + 0.25, p.z); ray.set(_o, _d); ray.far = y + 0.25 - y0 + 0.05;
            const h = ray.intersectObjects(mesh, false); if (!h.length || h[0].point.y < y - 0.12) n2++; }
          if (n2 >= 2) return true; }
        return false; };
      // sandaran = sisi dengan penghalang terdekat (menempel tepi jok); seberangnya harus jauh lebih lega (ruang kaki, dasbor jauh)
      let arah = null; const sb = sisi.indexOf(Math.min(...sisi));
      if (sisi[sb] <= 0.15 && sisi[sb ^ 1] >= sisi[sb] + 0.1) arah = sb ^ 1;                // depan = seberang sandaran
      // ciri jok sungguhan (JEV-132): dalam dudukan 28–80 cm (pijakan samping, bemper & lis tipis yang "bersandar" ke badan
      // mobil terlalu dangkal; lantai kabin / bak kargo terlalu dalam), dan di depannya ada ruang kaki ≥ 12 cm lebih rendah
      const dalam = arah === null ? 0 : 2 * (arah < 2 ? ru : rw);
      // JEV-136: dan cukup lebar (≥ 32 cm) — konsol / kotak di antara jok depan mobil bukan jok
      const lintang = arah === null ? 0 : 2 * (arah < 2 ? rw : ru);
      if (arah !== null && (dalam < 0.28 || dalam > 0.8 || lintang < 0.32 || !ruangKaki([[1, 0, rw], [-1, 0, rw], [0, 1, ru], [0, -1, ru]][arah]))) arah = null;
      const vek = arah === null ? null : [ex, ex.clone().negate(), ez, ez.clone().negate()][arah].clone();
      // ruang di depan jok setinggi dada (20–75 cm di atas dudukan): setir lebih dekat ke jok sopir daripada dasbor ke jok
      // penumpang — dipakai untuk menemukan jok sopir pada model kendaraan (JEV-133)
      let depan = 9;
      if (arah !== null) { const [du, dw, lebar] = [[1, 0, rw], [-1, 0, rw], [0, 1, ru], [0, -1, ru]][arah];
        cari: for (let jauh = 0.05; jauh <= 0.9; jauh += 0.05) for (const t of [-0.15, 0, 0.15]) {
          const p = titik(u + du * (ru + jauh) + dw * t * lebar * 2, w + dw * (rw + jauh) + du * t * lebar * 2);
          _o.set(p.x, y + 0.75, p.z); ray.set(_o, _d); ray.far = 0.55;
          if (ray.intersectObjects(mesh, false).length) { depan = jauh; break cari; } } }
      jok.push({ sel: grup.map(s => g.worldToLocal(titik(s.u, s.w).setY(s.y))), pos: g.worldToLocal(titik(u, w).setY(y)),
        arah: vek && vek.transformDirection(inv), sandar: arah !== null, lebar: Math.max(ru, rw) > 0.45, depan,
        atap: grup.filter(c => c.atap).length >= grup.length * 0.6 });
    }
    // jok bersandaran diutamakan; model yang punya jok beratap (kabin mobil, gazebo) hanya memakai jok beratap — permukaan
    // di luar kabin (pijakan, bemper, kap) tidak dipilih walau titik bidik lebih dekat ke sana
    const sandar = jok.filter(j => j.sandar), atap = sandar.filter(j => j.atap);
    return atap.length ? atap : sandar.length ? sandar : jok;
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
    // kendaraan (JEV-133): pemain selalu duduk di jok sopir, di belakang setir — NPC tetap memilih jok terdekat
    const setir = o && o.params && SETIR.includes(o.params.setir) ? o.params.setir : '', sopir = setir && t.id ? jokSopir(g, J, setir) : null;
    if (sopir) best = { j: sopir, q: dunia(sopir.pos) };
    const j = best.j;
    // posisi duduk: sel terdekat di jok lebar (sofa / bangku panjang), tengah jok untuk jok sempit
    const pos = j.lebar ? best.q : dunia(j.pos);
    let arah = j.arah && j.arah.clone().transformDirection(g.matrixWorld).setY(0).normalize();
    if (D && D.arah != null) { const a = D.arah * Math.PI / 180; arah = new THREE.Vector3(Math.sin(a), 0, Math.cos(a)).transformDirection(g.matrixWorld).setY(0).normalize(); }
    if (!arah) arah = new THREE.Vector3(0, 0, 1).transformDirection(g.matrixWorld).setY(0).normalize();
    pos.y += 0.02; pos.addScaledVector(arah, 0.04);
    return { pos, arah };
  }
  /* JOK SOPIR (JEV-133): baris depan = jok bersandaran yang paling jauh ke arah hadap (±30 cm); setir otomatis = jok baris
     depan yang ruang di depannya paling sempit (setir lebih dekat daripada dasbor), seimbang (< 8 cm) → setir kanan seperti
     mobil di Indonesia. Setir kiri / kanan = sisi kiri / kanan orang yang duduk menghadap depan. */
  function jokSopir(g, J, setir) {
    const A = J.filter(j => j.arah); if (!A.length) return null;
    const ke = j => j.arah.clone().transformDirection(g.matrixWorld).setY(0).normalize(), F = ke(A[0]);
    const S = A.filter(j => ke(j).dot(F) > 0.7), posW = j => j.pos.clone().applyMatrix4(g.matrixWorld);
    const maju = Math.max(...S.map(j => posW(j).dot(F))), depan = S.filter(j => posW(j).dot(F) > maju - 0.3);
    const kiri = new THREE.Vector3(F.z, 0, -F.x), sisi = j => posW(j).dot(kiri);       // menghadap +Z: kiri = +X
    const urut = depan.slice().sort((a, b) => sisi(b) - sisi(a));                       // [paling kiri … paling kanan]
    if (urut.length < 2) return urut[0] || null;
    if (setir === 'kiri') return urut[0];
    if (setir === 'kanan') return urut[urut.length - 1];
    const sempit = depan.slice().sort((a, b) => a.depan - b.depan);
    return sempit[1].depan - sempit[0].depan >= 0.08 ? sempit[0] : urut[urut.length - 1];
  }
  // panel Interaksi model (kategori Duduk): tandai sebagai kendaraan
  function panel(ins, d, ubah) {
    const v = SETIR.includes(d.params.setir) ? d.params.setir : '';
    fRow(ins, 'Kendaraan', selInput([['', 'Bukan kendaraan'], ['auto', 'Ya — setir otomatis'], ['kanan', 'Ya — setir kanan'], ['kiri', 'Ya — setir kiri']], v,
      x => ubah('Kendaraan', () => { if (x) d.params.setir = x; else delete d.params.setir; })));
  }

  /* KASUR MODEL (JEV-131): titik rebah dulu = tengah kotak batas model; ranjang dengan sandaran tebal / bangku di kaki membuat
     kepala jatuh di depan bantal. Di sini garis tengah kasur dipindai dari ujung kepala ke kaki: permukaan kasur = median
     tinggi di paruh kaki; tepi kepala = titik pertama yang tidak lebih dari 45 cm di atas kasur (bukan sandaran / bantal tegak).
     Kepala di tengah bantal rebah sesudahnya (atau 20 cm dari tepi), pinggul 42 cm ke arah kaki. B.cx / B.cz digeser, B.r = jarak mata. */
  const PINGGUL_KEPALA = 0.42, PINGGUL_MATA = 0.53;                  // diukur pada pose 9 F.vrm / M.vrm di ranjang pustaka
  function kasur(g, B) {
    if (!g || !B || B.diukur) return; B.diukur = true;
    try {
      g.updateMatrixWorld(true);
      const mesh = []; g.traverse(o => { if (o.isMesh && !o.isSkinnedMesh && TERLIHAT(o)) mesh.push(o); }); if (!mesh.length) return;
      const s = Math.sin(B.a), k = Math.cos(B.a), p0 = g.localToWorld(new THREE.Vector3(B.cx, 0, B.cz)), p1 = g.localToWorld(new THREE.Vector3(B.cx + s, 0, B.cz + k));
      const kaki = p1.clone().sub(p0).setY(0), satuan = kaki.length(); if (!(satuan > 1e-6)) return; kaki.divideScalar(satuan);
      const L = B.len * satuan, W = (B.wid || 1) * satuan, samping = new THREE.Vector3(-kaki.z, 0, kaki.x), bb = new THREE.Box3().setFromObject(g);
      const tinggi = t => { let m = -1e9;
        for (const x of [-W / 4, 0, W / 4]) { _o.copy(p0).addScaledVector(kaki, t).addScaledVector(samping, x).setY(bb.max.y + 0.1); ray.set(_o, _d); ray.far = bb.max.y - bb.min.y + 0.2;
          const h = ray.intersectObjects(mesh, false); if (h.length) m = Math.max(m, h[0].point.y); }
        return m; };
      const N = Math.max(8, Math.round(L / 0.03)), T = [], H = [];
      for (let i = 0; i <= N; i++) { const t = -L / 2 + L * i / N; T.push(t); H.push(tinggi(t)); }
      const kaki2 = H.filter((h, i) => h > -1e8 && T[i] > 0 && T[i] < L * 0.35).sort((a, b) => a - b); if (!kaki2.length) return;
      const hm = kaki2[kaki2.length >> 1];
      const i0 = H.findIndex(h => h > -1e8 && h <= hm + 0.45); if (i0 < 0) return;
      // bantal: daerah 5–45 cm di atas kasur, mulai ≤ 25 cm dari tepi kepala → kepala di tengahnya; tanpa bantal: 20 cm dari tepi
      let j = i0; while (j + 1 < H.length && H[j] <= hm + 0.05 && T[j] - T[i0] < 0.25) j++;
      let i1 = j; while (i1 + 1 < H.length && H[i1 + 1] > hm + 0.05 && T[i1 + 1] - T[j] < 0.7) i1++;
      const kepala = H[j] > hm + 0.05 && T[i1] - T[j] >= 0.15 ? (T[j] + T[i1]) / 2 : T[i0] + 0.2;
      let pinggul = kepala + PINGGUL_KEPALA;
      pinggul = Math.min(pinggul, L / 2 - 0.85);                        // kaki tidak melewati ujung kasur
      if (pinggul <= T[i0] + 0.3) return;                                // kasur terlalu pendek: biarkan di tengah
      const q = g.worldToLocal(p0.clone().addScaledVector(kaki, pinggul));
      B.cx = q.x; B.cz = q.z; B.r = PINGGUL_MATA / satuan;
    } catch (e) { /* biarkan titik tengah lama */ }
  }

  // model berubah (pindah / skala / ganti berkas): pindai ulang
  function lupakan(g) { if (g) delete g.userData.jokOtomatis; }

  window.KURSI = { titikDuduk, kasur, panel, lupakan, _pindai: pindai, _jokSopir: jokSopir };
})();
