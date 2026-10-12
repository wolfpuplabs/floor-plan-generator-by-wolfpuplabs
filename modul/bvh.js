/* Plan23D — RAYCAST CEPAT (BVH) untuk model & tanah besar (JEV-093)
   Mode jalan menembakkan sinar tiap frame: 5 sinar pijakan kaki, sinar bidikan, sinar peredam
   suara. Raycast bawaan three.js memeriksa SEMUA segitiga mesh yang kotak batasnya terkena —
   model scan / Sketchfab berisi ratusan ribu segitiga, jadi satu frame bisa ratusan milidetik
   (tersendat di iPad). Di sini tiap geometri besar diberi pohon kotak batas (BVH, belahan median
   di sumbu terpanjang, ≤ 8 segitiga per daun) sekali saat dimuat; raycast menelusuri pohon itu
   saja. Hasilnya sama dengan raycast bawaan (sisi depan/belakang/ganda per bahan, near/far,
   jarak dunia), jadi kode pemakai tidak berubah. Mesh berkulit & ber-morph tetap cara bawaan. */
(function () {
  'use strict';
  const DAUN = 8;
  const _inv = new THREE.Matrix4(), _ray = new THREE.Ray(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
  const _p = new THREE.Vector3(), _pw = new THREE.Vector3(), _n = new THREE.Vector3();

  function bangun(geo) {
    const pos = geo.attributes.position, idx = geo.index, n = Math.floor((idx ? idx.count : pos.count) / 3);
    const v = new Uint32Array(n * 3);
    for (let i = 0; i < n * 3; i++) v[i] = idx ? idx.getX(i) : i;
    const cen = new Float32Array(n * 3), lo = new Float32Array(n * 3), hi = new Float32Array(n * 3);
    for (let t = 0; t < n; t++) for (let k = 0; k < 3; k++) {
      const x = k === 0 ? 'getX' : k === 1 ? 'getY' : 'getZ';
      const p0 = pos[x](v[t * 3]), p1 = pos[x](v[t * 3 + 1]), p2 = pos[x](v[t * 3 + 2]);
      lo[t * 3 + k] = Math.min(p0, p1, p2); hi[t * 3 + k] = Math.max(p0, p1, p2); cen[t * 3 + k] = (p0 + p1 + p2) / 3;
    }
    // bahan per segitiga (mesh multi-bahan memakai groups)
    let bahan = null;
    if (geo.groups && geo.groups.length) {
      bahan = new Uint8Array(n);
      for (const g of geo.groups) for (let t = Math.floor(g.start / 3); t < Math.min(n, Math.floor((g.start + g.count) / 3)); t++) bahan[t] = g.materialIndex || 0;
    }
    const urut = new Uint32Array(n); for (let i = 0; i < n; i++) urut[i] = i;
    const maks = Math.max(1, 2 * Math.ceil(n / (DAUN / 2)) + 1);
    const kotak = new Float32Array(maks * 6), info = new Int32Array(maks * 3);   // info: [anakKiri | awal, anakKanan | jumlah, daun?]
    let jml = 0;
    const tumpuk = [[0, n, jml++]];
    while (tumpuk.length) {
      const [s, e, id] = tumpuk.pop();
      let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
      let cx0 = Infinity, cy0 = Infinity, cz0 = Infinity, cx1 = -Infinity, cy1 = -Infinity, cz1 = -Infinity;
      for (let i = s; i < e; i++) {
        const t = urut[i] * 3;
        x0 = Math.min(x0, lo[t]); y0 = Math.min(y0, lo[t + 1]); z0 = Math.min(z0, lo[t + 2]);
        x1 = Math.max(x1, hi[t]); y1 = Math.max(y1, hi[t + 1]); z1 = Math.max(z1, hi[t + 2]);
        cx0 = Math.min(cx0, cen[t]); cy0 = Math.min(cy0, cen[t + 1]); cz0 = Math.min(cz0, cen[t + 2]);
        cx1 = Math.max(cx1, cen[t]); cy1 = Math.max(cy1, cen[t + 1]); cz1 = Math.max(cz1, cen[t + 2]);
      }
      kotak.set([x0, y0, z0, x1, y1, z1], id * 6);
      const lx = cx1 - cx0, ly = cy1 - cy0, lz = cz1 - cz0;
      if (e - s <= DAUN || Math.max(lx, ly, lz) < 1e-9) { info[id * 3] = s; info[id * 3 + 1] = e - s; info[id * 3 + 2] = 1; continue; }
      const ax = lx >= ly && lx >= lz ? 0 : ly >= lz ? 1 : 2, mid = (s + e) >> 1;
      pilihKe(urut, cen, ax, s, e - 1, mid);
      const kiri = jml++, kanan = jml++;
      info[id * 3] = kiri; info[id * 3 + 1] = kanan; info[id * 3 + 2] = 0;
      tumpuk.push([s, mid, kiri], [mid, e, kanan]);
    }
    return { v, urut, kotak, info, bahan };
  }
  // quickselect: elemen ke-k (menurut titik tengah di sumbu ax) di posisinya, yang lebih kecil di kiri
  function pilihKe(u, cen, ax, l, r, k) {
    while (r > l) {
      const pv = cen[u[(l + r) >> 1] * 3 + ax];
      let i = l, j = r;
      while (i <= j) {
        while (cen[u[i] * 3 + ax] < pv) i++;
        while (cen[u[j] * 3 + ax] > pv) j--;
        if (i <= j) { const t = u[i]; u[i] = u[j]; u[j] = t; i++; j--; }
      }
      if (k <= j) r = j; else if (k >= i) l = i; else return;
    }
  }
  function kenaKotak(k, o, inv, far) {
    let t0 = 0, t1 = far;
    for (let a = 0; a < 3; a++) {
      const oa = a === 0 ? o.x : a === 1 ? o.y : o.z, ia = inv[a];
      let ta = (k[a] - oa) * ia, tb = (k[a + 3] - oa) * ia;
      if (ta > tb) { const s = ta; ta = tb; tb = s; }
      if (ta > t0) t0 = ta; if (tb < t1) t1 = tb;
      if (t0 > t1) return false;
    }
    return true;
  }
  function raycastBVH(mesh, B, rc, out) {
    const geo = mesh.geometry, pos = geo.attributes.position, mat = mesh.material;
    if (mat === undefined) return;
    _inv.copy(mesh.matrixWorld).invert(); _ray.copy(rc.ray).applyMatrix4(_inv);
    const o = _ray.origin, d = _ray.direction, inv = [1 / d.x, 1 / d.y, 1 / d.z];
    const tumpuk = [0], k = new Float32Array(6);
    while (tumpuk.length) {
      const id = tumpuk.pop();
      for (let i = 0; i < 6; i++) k[i] = B.kotak[id * 6 + i];
      if (!kenaKotak(k, o, inv, Infinity)) continue;
      if (!B.info[id * 3 + 2]) { tumpuk.push(B.info[id * 3], B.info[id * 3 + 1]); continue; }
      const s = B.info[id * 3], n = B.info[id * 3 + 1];
      for (let i = s; i < s + n; i++) {
        const t = B.urut[i], m = Array.isArray(mat) ? mat[B.bahan ? B.bahan[t] : 0] : mat; if (!m) continue;
        const ia = B.v[t * 3], ib = B.v[t * 3 + 1], ic = B.v[t * 3 + 2];
        _a.fromBufferAttribute(pos, ia); _b.fromBufferAttribute(pos, ib); _c.fromBufferAttribute(pos, ic);
        const hit = m.side === THREE.BackSide ? _ray.intersectTriangle(_c, _b, _a, true, _p) : _ray.intersectTriangle(_a, _b, _c, m.side !== THREE.DoubleSide, _p);
        if (!hit) continue;
        _pw.copy(_p).applyMatrix4(mesh.matrixWorld);
        const jarak = rc.ray.origin.distanceTo(_pw);
        if (jarak < rc.near || jarak > rc.far) continue;
        THREE.Triangle.getNormal(_a, _b, _c, _n);
        out.push({ distance: jarak, point: _pw.clone(), object: mesh, faceIndex: t,
          face: { a: ia, b: ib, c: ic, normal: _n.clone(), materialIndex: B.bahan ? B.bahan[t] : 0 } });
      }
    }
  }

  const asli = THREE.Mesh.prototype.raycast;
  THREE.Mesh.prototype.raycast = function (rc, out) {
    const B = this.geometry && this.geometry.bvhPohon;
    if (B && !this.isSkinnedMesh && !(this.morphTargetInfluences && this.morphTargetInfluences.length)) return raycastBVH(this, B, rc, out);
    return asli.call(this, rc, out);
  };

  // geometri dibangun satu per satu di sela frame supaya tidak membekukan tampilan
  const antrean = [];
  let jalan = false;
  function antre(geos) {
    for (const g of geos) if (!g.bvhPohon && !antrean.includes(g)) antrean.push(g);
    if (jalan) return; jalan = true;
    const lanjut = () => {
      const g = antrean.shift(); if (!g) { jalan = false; return; }
      try { if (g.attributes.position && !g.bvhPohon) g.bvhPohon = bangun(g); } catch (e) { console.warn('bvh', e); }
      setTimeout(lanjut, 0);
    };
    setTimeout(lanjut, 0);
  }
  window.BVH = { antre, bangun, sisa: () => antrean.length + (jalan ? 1 : 0) };
})();
