/* Plan23D — PAGAR & LANTAI DARI MODEL UNGGAHAN (JEV-090)
   Dimuat hanya saat dipakai (proyek berisi jalur 'pagar_model' / area 'lantai_model').
   Model sendiri (o.params.model = id aset) dipakai sebagai satu potong pagar yang diulang
   sepanjang jalur tracing, atau sebagai ubin yang disusun berpetak mengisi keliling tracing.
   Potongannya digambar sebagai InstancedMesh per bagian model — ratusan ubin tetap satu
   panggilan gambar per bagian. Sisi panjang potongan pagar = sumbu X model (atau Z bila
   "putar 90°"); tiap segmen dibagi jadi potongan utuh yang direntang sedikit supaya pas dari
   titik ke titik. Ubin yang titik tengahnya di luar keliling tidak dipasang. */
/* global PROJECT, clamp, pointInPoly, tplAset, fRow, numInput, selInput, el, fmt, HIST,
   rebuildScene, renderInspector, findGroup */
(function () {
  'use strict';
  const MAKS = 2500, BAGIAN = new WeakMap();

  // bagian model (mesh tak berkulit) beserta matriksnya relatif terhadap akar model; disimpan per templat
  function bagianModel(tpl) {
    let r = BAGIAN.get(tpl); if (r) return r;
    tpl.updateMatrixWorld(true); const inv = tpl.matrixWorld.clone().invert(); r = [];
    tpl.traverse(m => {
      if (m.isMesh && !m.isSkinnedMesh && m.geometry) r.push({ geo: m.geometry, mat: m.material, rel: inv.clone().multiply(m.matrixWorld), bayang: m.castShadow !== false });
    });
    BAGIAN.set(tpl, r); return r;
  }
  function instansModel(tpl, daftar) {
    const g = new THREE.Group(), n = Math.min(daftar.length, MAKS); if (!n) return g;
    const M = new THREE.Matrix4();
    for (const b of bagianModel(tpl)) {
      const im = new THREE.InstancedMesh(b.geo, b.mat, n);
      for (let i = 0; i < n; i++) im.setMatrixAt(i, M.multiplyMatrices(daftar[i], b.rel));
      im.instanceMatrix.needsUpdate = true; im.castShadow = b.bayang; im.receiveShadow = true;
      im.frustumCulled = false;                 // r128: bola batas InstancedMesh = satu potong, bukan seluruh susunan
      g.add(im);
    }
    g.userData.instans = n; return g;
  }
  // ukuran potong: [panjang (mengikuti jalur / lebar ubin), tinggi, dalam] menurut pilihan putar 90°
  function ukuranPotong(o) {
    const a = PROJECT.assets[o.params.model], d = (a && a.dims) || [1, 1, 1], p = +o.params.putar === 90;
    return [Math.max(0.02, p ? d[2] : d[0]), Math.max(0.01, d[1]), Math.max(0.02, p ? d[0] : d[2])];
  }
  const adaModel = o => !!(o.params && o.params.model && tplAset(o.params.model) && PROJECT.assets[o.params.model]);

  function pagar(o, P) {
    if (!adaModel(o)) return null;
    const [pj, ti] = ukuranPotong(o), putar = +o.params.putar === 90, regang = o.params.regang !== false;
    const sy = +o.params.tinggi > 0 ? clamp(+o.params.tinggi, 0.1, 10) / ti : 1, daftar = [];
    const q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz); if (len < 1e-3) continue;
      const ux = dx / len, uz = dz / len;
      const n = regang ? Math.max(1, Math.round(len / pj)) : Math.max(1, Math.floor(len / pj + 0.02)), lp = regang ? len / n : pj;
      // sumbu panjang model (X, atau Z bila diputar) diarahkan sepanjang segmen
      q.setFromAxisAngle(Y, putar ? Math.atan2(ux, uz) : -Math.atan2(uz, ux));
      const sk = new THREE.Vector3(putar ? 1 : lp / pj, sy, putar ? lp / pj : 1);
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) * lp; if (t > len + 1e-3) break;
        daftar.push(new THREE.Matrix4().compose(new THREE.Vector3(a[0] + ux * t, 0, a[1] + uz * t), q, sk));
      }
    }
    return instansModel(tplAset(o.params.model), daftar);
  }
  function lantai(o, P) {
    if (!adaModel(o)) return null;
    const [lw, , ld] = ukuranPotong(o), putar = +o.params.putar === 90;
    // ukuran ubin bisa diketik (m); model direntang ke ukuran itu
    const tw = +o.params.ubinW > 0 ? clamp(+o.params.ubinW, 0.05, 20) : lw, td = +o.params.ubinD > 0 ? clamp(+o.params.ubinD, 0.05, 20) : ld;
    const xs = P.map(p => p[0]), zs = P.map(p => p[1]), x0 = Math.min(...xs), z0 = Math.min(...zs);
    const nx = Math.ceil((Math.max(...xs) - x0) / tw - 1e-6), nz = Math.ceil((Math.max(...zs) - z0) / td - 1e-6);
    if (nx * nz > MAKS * 4) return null;        // kisi kebesaran: ubin terlalu kecil untuk area ini
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), putar ? Math.PI / 2 : 0);
    const sk = new THREE.Vector3(putar ? td / ld : tw / lw, 1, putar ? tw / lw : td / ld), daftar = [];
    for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
      const x = x0 + (i + 0.5) * tw, z = z0 + (k + 0.5) * td;
      if (pointInPoly(x, z, P)) daftar.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), q, sk));
    }
    const g = instansModel(tplAset(o.params.model), daftar); g.userData.lebihUbin = daftar.length > MAKS; return g;
  }

  // inspector: model, arah sisi panjang, tinggi pagar, ukuran ubin
  function inspektor(ins, d, j) {
    const ubah = (lbl, fn) => v => { fn(v); HIST.label = lbl; rebuildScene(); renderInspector(); };
    const ids = Object.keys(PROJECT.assets || {}), a = PROJECT.assets[d.params.model];
    fRow(ins, 'Model', selInput(ids.map(id => [id, PROJECT.assets[id].name]), d.params.model || '',
      ubah('Ganti model', v => { d.params.model = v; delete d.params.tinggi; delete d.params.ubinW; delete d.params.ubinD; })));
    if (!a || !tplAset(d.params.model)) { ins.appendChild(el('div', 'badge warn', '⚠ Modelnya tidak ada di pustaka — unggah lagi lalu pilih di atas.')); return; }
    const pg = j === 'pagar_model';
    fRow(ins, pg ? 'Sisi panjang potongan' : 'Arah ubin',
      selInput([['0', pg ? 'Sumbu X model' : 'Seperti model'], ['90', pg ? 'Sumbu Z model' : 'Diputar 90°']], String(+d.params.putar || 0),
        ubah('Arah potongan', v => { if (+v) d.params.putar = 90; else delete d.params.putar; delete d.params.ubinW; delete d.params.ubinD; })));
    const [pj, ti, dl] = ukuranPotong(d);
    if (pg) {
      fRow(ins, 'Tinggi (m)', numInput(+d.params.tinggi > 0 ? +d.params.tinggi : ti, 0.05, ubah('Tinggi pagar', v => { d.params.tinggi = clamp(v, 0.1, 10); }), 0.1, 10));
      const c = document.createElement('label'); c.className = 'chk';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = d.params.regang !== false;
      cb.onchange = () => ubah('Rentang pagar', v => { if (v) delete d.params.regang; else d.params.regang = false; })(cb.checked);
      c.append(cb, el('span', null, 'Rentang pas dari titik ke titik')); ins.appendChild(c);
      ins.appendChild(el('p', 'hint', `Satu potong ${fmt(pj, 2)} m (tebal ${fmt(dl, 2)} m) diulang sepanjang jalur. Kalau potongannya melintang jalur, ganti Sisi panjang.`));
    } else {
      fRow(ins, 'Lebar ubin (m)', numInput(+d.params.ubinW > 0 ? +d.params.ubinW : pj, 0.01, ubah('Ukuran ubin', v => { d.params.ubinW = clamp(v, 0.05, 20); }), 0.05, 20));
      fRow(ins, 'Panjang ubin (m)', numInput(+d.params.ubinD > 0 ? +d.params.ubinD : dl, 0.01, ubah('Ukuran ubin', v => { d.params.ubinD = clamp(v, 0.05, 20); }), 0.05, 20));
      const g = findGroup('obj', d.id);
      ins.appendChild(el('p', 'hint', 'Ubin disusun berpetak mengisi keliling; yang titik tengahnya di luar keliling tidak dipasang.'
        + (g && g.userData.lebihUbin ? ` Lebih dari ${MAKS} ubin — perbesar ukuran ubin.` : '')));
    }
  }

  window.POTONG = { pagar, lantai, inspektor, ukuranPotong, adaModel };
})();
