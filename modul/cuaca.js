/* Plan23D — WAKTU & CUACA (JEV-100)
   1. TRANSISI WAKTU: siang → senja → malam berganti halus (bukan meloncat) — matahari, cahaya langit,
      eksposur, warna langit & kabut digeser bertahap. Tombol "Waktu ▸" di mode jalan memajukan waktu;
      "Siklus waktu" memutarnya sendiri (siang → senja → malam → fajar → siang) dalam 2 / 6 / 12 menit.
   2. HUJAN: garis tetes dihitung di GPU (tanpa pembaruan per tetes di CPU), tertambat di dunia (tidak
      ikut bergeser saat berjalan), tidak turun di dalam tapak bangunan (masker dari tapakAtap). Langit
      mendung, matahari meredup, kabut menebal, tanah situs basah mengkilap, suara hujan sintesis yang
      teredam saat di dalam rumah. Badai: kilat (kilasan cahaya) + guruh tertunda.
   3. OTOMATIS (JEV-101): satu sakelar — waktu berjalan sendiri DAN cuaca berganti sendiri: mulai cerah,
      sesekali hujan turun tiba-tiba (gerimis / hujan / badai), bertahan ½–1½ fase waktu, lalu reda.
      Memilih waktu / cuaca saat otomatis menyala: langsung ke sana, lalu otomatis berlanjut dari situ.
   Hanya aktif di mode jalan & tautan lihat; editor tetap bersih. */
/* global scene, camera, sun, hemiL, renderer, SUASANA, setSuasana, kubahLangit, fotoAktif, FPS, LIHAT, orbit, MOOD, PBR_ON,
   PROJECT, tapakAtap, worldRoot, audioSiap, AUDIO, pasBayangMatahari, bayangKotor, terapkanLangit, toast */
(function () {
  'use strict';
  const KUAT = { cerah: 0, gerimis: 0.45, hujan: 0.8, badai: 1 };
  const TETES = { cerah: 0, gerimis: 0.3, hujan: 0.75, badai: 1 };
  const URUT = ['siang', 'senja', 'malam'], SIKLUS = ['siang', 'senja', 'malam', 'senja'];
  const HP = /iPhone|iPad|Android/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
  const MAKS = HP ? 5000 : 9000;
  const C = { jenis: 'cerah', siklus: 0, w: 0, tw: 0, tween: null, tSiklus: 0, fase: 0, kilat: 8, flash: 0, guruh: [], basah: new Map(), tapakTanda: '',
    acak: null, tAcak: 0, sisaAcak: 0, lalu: 'hujan' };
  const PELUANG_HUJAN = 0.45;                                          // tiap pemeriksaan acak saat siklus berjalan
  const efektif = () => (C.siklus ? C.acak || 'cerah' : C.jenis);    // otomatis: cuaca acak; manual: cuaca pilihan
  const kabari = () => { if (typeof window.cuacaBerubah === 'function') window.cuacaBerubah(); };
  const faseDetik = () => C.siklus * 60 / SIKLUS.length;

  // ---------- hujan ----------
  const U = { waktu: { value: 0 }, pusat: { value: new THREE.Vector3() }, ukuran: { value: new THREE.Vector3(36, 20, 36) }, laju: { value: 9 },
    panjang: { value: 0.42 }, angin: { value: new THREE.Vector2(0.9, 0.35) }, tutup: { value: null }, tMin: { value: new THREE.Vector2() },
    tUkur: { value: new THREE.Vector2(1, 1) }, adaTutup: { value: 0 }, warna: { value: new THREE.Color(0xc9d3dd) }, opasitas: { value: 0.35 }, jumlah: { value: 0 } };
  // per tetes: posisi acak (x, y, z), ambang kepadatan (w) & ujung garis (0 bawah, 1 atas) — tanpa gl_VertexID (WebGL1)
  const geo = new THREE.BufferGeometry(), acak = new Float32Array(MAKS * 2 * 4), ujung = new Float32Array(MAKS * 2), pos = new Float32Array(MAKS * 2 * 3);
  for (let i = 0; i < MAKS; i++) { const a = [Math.random(), Math.random(), Math.random(), Math.random()];
    acak.set(a, i * 8); acak.set(a, i * 8 + 4); ujung[i * 2 + 1] = 1; }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('acak', new THREE.BufferAttribute(acak, 4));
  geo.setAttribute('ujung', new THREE.BufferAttribute(ujung, 1));
  const matHujan = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, fog: false,
    vertexShader: `attribute vec4 acak; attribute float ujung; uniform float waktu, laju, panjang, adaTutup, jumlah; uniform vec3 pusat, ukuran; uniform vec2 angin, tMin, tUkur; uniform sampler2D tutup;
      varying float vA;
      void main(){
        vA = step(acak.w, jumlah);                                          // jumlah = bagian tetes yang tampil (0–1)
        vec3 p;
        p.x = pusat.x + mod(acak.x * ukuran.x - pusat.x, ukuran.x) - ukuran.x * 0.5;
        p.z = pusat.z + mod(acak.z * ukuran.z - pusat.z, ukuran.z) - ukuran.z * 0.5;
        p.y = pusat.y - ukuran.y * 0.3 + mod(acak.y * ukuran.y - waktu * laju * (0.85 + 0.3 * acak.x), ukuran.y);
        float t = (ukuran.y * 0.7 - (p.y - pusat.y)) / laju;               // tetes melayang miring searah angin
        p.xz += angin * t * 0.15;
        p.y += ujung * panjang; p.xz -= angin * ujung * panjang / laju;    // ujung atas garis
        if (adaTutup > 0.5) { vec2 uv = (p.xz - tMin) / tUkur;
          if (uv.x > 0.0 && uv.y > 0.0 && uv.x < 1.0 && uv.y < 1.0 && texture2D(tutup, uv).r > 0.5) vA = 0.0; }
        float jauh = length(p.xz - pusat.xz) / (ukuran.x * 0.5);
        vA *= (1.0 - smoothstep(0.6, 1.0, jauh)) * (0.35 + 0.65 * ujung);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `uniform vec3 warna; uniform float opasitas; varying float vA;
      void main(){ if (vA < 0.01) discard; gl_FragColor = vec4(warna, opasitas * vA); }`,
  });
  const hujan = new THREE.LineSegments(geo, matHujan);
  hujan.frustumCulled = false; hujan.visible = false; hujan.renderOrder = 5; hujan.raycast = () => {};
  scene.add(hujan);

  // masker "beratap": gabungan tapak semua lantai (5 cm → tekstur 1 bit per sel 10 cm)
  function segarkanTapak() {
    const tanda = PROJECT.levels.map(l => l.walls.map(w => [w.x1, w.z1, w.x2, w.z2].map(v => v.toFixed(2)).join()).join('|')).join('#');
    if (tanda === C.tapakTanda) return; C.tapakTanda = tanda;
    const tps = PROJECT.levels.map(l => tapakAtap(l, 0.15)).filter(Boolean);
    if (!tps.length) { U.adaTutup.value = 0; return; }
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (const t of tps) { x0 = Math.min(x0, t.x0); z0 = Math.min(z0, t.z0); x1 = Math.max(x1, t.x0 + t.nx * t.c); z1 = Math.max(z1, t.z0 + t.nz * t.c); }
    const s = 0.1, W = Math.min(1024, Math.ceil((x1 - x0) / s)), H = Math.min(1024, Math.ceil((z1 - z0) / s)), d = new Uint8Array(W * H * 4);
    for (const t of tps) for (let i = 0; i < t.nx; i++) for (let k = 0; k < t.nz; k++) if (t.T[i * t.nz + k]) {
      const u = Math.floor((t.x0 + (i + 0.5) * t.c - x0) / (x1 - x0) * W), v = Math.floor((t.z0 + (k + 0.5) * t.c - z0) / (z1 - z0) * H);
      if (u >= 0 && v >= 0 && u < W && v < H) d[(v * W + u) * 4] = 255; }
    if (U.tutup.value) U.tutup.value.dispose();
    const tx = new THREE.DataTexture(d, W, H, THREE.RGBAFormat); tx.needsUpdate = true;
    U.tutup.value = tx; U.tMin.value.set(x0, z0); U.tUkur.value.set(x1 - x0, z1 - z0); U.adaTutup.value = 1;
    C.masker = { d, W, H, x0, z0, x1, z1 };
  }
  function diDalam(x, z) {
    const M = C.masker; if (!M || x < M.x0 || z < M.z0 || x > M.x1 || z > M.z1) return false;
    const u = Math.floor((x - M.x0) / (M.x1 - M.x0) * M.W), v = Math.floor((z - M.z0) / (M.z1 - M.z0) * M.H);
    return M.d[(v * M.W + u) * 4] > 0;
  }

  // ---------- langit mendung, matahari redup, kabut tebal, tanah basah ----------
  const ABU = new THREE.Color(0.32, 0.34, 0.37);
  function mendungLampu() {
    const s = SUASANA[MOOD] || SUASANA.siang, w = C.w;
    sun.intensity = s.sun[1] * (1 - 0.78 * w);
    hemiL.userData.base = s.hemi[2] * (1 - 0.15 * w); hemiL.intensity = hemiL.userData.base * (PBR_ON ? 0.3 : 1);
  }
  function mendungLangit() {
    const w = C.w; if (!w || fotoAktif()) return;
    const L = kubahLangit.material.uniforms, terang = (L.zenit.value.r + L.zenit.value.g + L.zenit.value.b) / 3 + 0.05;
    const abu = ABU.clone().multiplyScalar(Math.min(1.2, terang * 2.2));
    L.zenit.value.lerp(abu, 0.75 * w); L.cakrawala.value.lerp(abu, 0.6 * w);
    L.cakram.value *= 1 - w; L.bintang.value *= 1 - w; L.warnaSurya.value.multiplyScalar(1 - 0.8 * w);
    if (scene.fog) { scene.fog.color.lerp(abu.clone().convertLinearToSRGB(), 0.6 * w); scene.fog.near *= 1 - 0.55 * w; scene.fog.far *= 1 - 0.45 * w; }
    if (scene.background && scene.background.isColor) scene.background.lerp(abu.clone().convertLinearToSRGB(), 0.6 * w);
  }
  function basah() {
    const w = C.w;
    worldRoot.traverse(m => {
      if (!m.isMesh || !m.userData.situs) return;
      for (const b of [].concat(m.material)) {
        if (!b || b.roughness === undefined) continue;
        if (!C.basah.has(b)) C.basah.set(b, { r: b.roughness, e: b.envMapIntensity ?? 1 });
        const o = C.basah.get(b); b.roughness = o.r * (1 - 0.55 * w); b.envMapIntensity = o.e * (1 + 0.8 * w);
      }
    });
  }

  // ---------- suara ----------
  let suara = null;
  function siapkanSuara() {
    const ctx = audioSiap(); if (!ctx) return null;
    if (suara) return suara;
    const n = ctx.sampleRate * 3, b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let l = 0;
      for (let i = 0; i < n; i++) { const r = Math.random() * 2 - 1; l = 0.92 * l + 0.08 * r; d[i] = r * 0.55 + l * 1.6 + (Math.random() < 0.0009 ? (Math.random() - 0.5) * 3 : 0); } }
    const src = ctx.createBufferSource(); src.buffer = b; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6000;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(lp); lp.connect(g); g.connect(AUDIO.master); src.start();
    suara = { ctx, lp, g }; return suara;
  }
  function guruh(tunda, kuat) {
    const S = siapkanSuara(); if (!S) return;
    const ctx = S.ctx, n = ctx.sampleRate * 4, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); let l = 0;
    for (let i = 0; i < n; i++) { l = 0.985 * l + 0.015 * (Math.random() * 2 - 1); d[i] = l * 9 * Math.exp(-i / n * 3.2) * (i < ctx.sampleRate * 0.05 ? i / (ctx.sampleRate * 0.05) : 1); }
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = b; f.type = 'lowpass'; f.frequency.value = 180; g.gain.value = 0.9 * kuat;
    s.connect(f); f.connect(g); g.connect(AUDIO.master); s.start(ctx.currentTime + tunda);
  }

  // ---------- transisi waktu ----------
  function potret() {
    const L = kubahLangit.material.uniforms;
    return { sc: sun.color.clone(), si: sun.intensity, sp: sun.position.clone(), hc: hemiL.color.clone(), hg: hemiL.groundColor.clone(), hb: hemiL.userData.base,
      ex: renderer.toneMappingExposure, z: L.zenit.value.clone(), c: L.cakrawala.value.clone(), t: L.tanah.value.clone(), ws: L.warnaSurya.value.clone(),
      as: L.arahSurya.value.clone(), ck: L.cakram.value, bt: L.bintang.value, tr: L.terang.value,
      bg: scene.background && scene.background.isColor ? scene.background.clone() : null, fc: scene.fog ? scene.fog.color.clone() : null, fn: scene.fog ? scene.fog.near : 0, ff: scene.fog ? scene.fog.far : 0 };
  }
  function campur(a, b, k) {
    const L = kubahLangit.material.uniforms, m = (x, y) => x + (y - x) * k;
    sun.color.copy(a.sc).lerp(b.sc, k); sun.intensity = m(a.si, b.si); sun.position.copy(a.sp).lerp(b.sp, k);
    hemiL.color.copy(a.hc).lerp(b.hc, k); hemiL.groundColor.copy(a.hg).lerp(b.hg, k); hemiL.userData.base = m(a.hb, b.hb);
    renderer.toneMappingExposure = m(a.ex, b.ex);
    L.zenit.value.copy(a.z).lerp(b.z, k); L.cakrawala.value.copy(a.c).lerp(b.c, k); L.tanah.value.copy(a.t).lerp(b.t, k); L.warnaSurya.value.copy(a.ws).lerp(b.ws, k);
    L.arahSurya.value.copy(a.as).lerp(b.as, k).normalize(); L.cakram.value = m(a.ck, b.ck); L.bintang.value = m(a.bt, b.bt); L.terang.value = m(a.tr, b.tr);
    if (a.bg && b.bg && scene.background && scene.background.isColor) scene.background.copy(a.bg).lerp(b.bg, k);
    if (a.fc && b.fc && scene.fog) { scene.fog.color.copy(a.fc).lerp(b.fc, k); scene.fog.near = m(a.fn, b.fn); scene.fog.far = m(a.ff, b.ff); }
  }
  function transisi(k, detik) {
    if (!SUASANA[k]) return;
    const a = potret(); setSuasana(k); const b = potret();
    C.tween = { a, b, t: 0, d: Math.max(0.1, detik || 4), bayang: 0 }; campur(a, b, 0);
  }
  function berikut() {
    const kini = MOOD, i = URUT.indexOf(kini === 'gelap' ? 'malam' : kini);
    transisi(URUT[(i + 1) % URUT.length], 4);
  }

  // ---------- pengaturan & langkah per frame ----------
  const aktif = () => (FPS.on || LIHAT.on) && !camera.isOrthographicCamera;
  function pasang(o) {
    o = o || {};
    const jenis = KUAT[o.jenis] != null ? o.jenis : 'cerah', siklus = [2, 6, 12].includes(+o.siklus) ? +o.siklus : 0;
    if (siklus !== C.siklus) { C.tSiklus = 0; const kini = MOOD; C.fase = Math.max(0, SIKLUS.indexOf(kini === 'gelap' ? 'malam' : kini)); }
    if (siklus !== C.siklus) { C.acak = null; C.tAcak = siklus * 60 / SIKLUS.length * (0.3 + Math.random() * 0.7); }
    C.jenis = jenis; C.siklus = siklus; C.tw = KUAT[efektif()];
    if (jenis !== 'cerah') segarkanTapak();
    if (C.w > 0) basah();                                             // bahan tanah baru setelah adegan dibangun ulang
  }
  function langkah(dt) {
    const on = aktif();
    // menuju kekuatan cuaca sasaran pelan-pelan (±3 detik); di editor langsung cerah
    const sasaran = on ? C.tw : 0, lama = C.w;
    C.w += Math.sign(sasaran - C.w) * Math.min(Math.abs(sasaran - C.w), dt / 3);
    if (C.tween) {
      const T = C.tween; T.t += dt; const k = Math.min(1, T.t / T.d), e = k * k * (3 - 2 * k);
      campur(T.a, T.b, e);
      if ((T.bayang -= dt) <= 0 || k >= 1) { T.bayang = 0.25; sun.userData.arah.copy(sun.position).normalize(); pasBayangMatahari(); bayangKotor(); }
      if (k >= 1) C.tween = null;
    } else if (Math.abs(C.w - lama) > 1e-4) { mendungLampu(); terapkanLangit(); }   // langit diisi ulang dari suasana, lalu dimendungkan sekali
    if (Math.abs(C.w - lama) > 1e-4) basah();
    // siklus waktu otomatis (hanya mode jalan / lihat)
    if (on && C.siklus && !C.tween) {
      C.tSiklus += dt; const fase = C.siklus * 60 / SIKLUS.length;
      if (C.tSiklus >= fase) { C.tSiklus = 0; C.fase = (C.fase + 1) % SIKLUS.length; transisi(SIKLUS[C.fase], fase * 0.35); kabari(); }
    }
    // hujan acak selama siklus waktu (cuaca Cerah)
    if (on && C.siklus) {
      if (C.acak) { if ((C.sisaAcak -= dt) <= 0) { C.acak = null; C.tw = 0; C.tAcak = faseDetik() * (0.6 + Math.random()); toast('🌤 Hujan reda'); kabari(); } }
      else if ((C.tAcak -= dt) <= 0) {
        C.tAcak = faseDetik() * (0.5 + Math.random());
        if (Math.random() < PELUANG_HUJAN) { const r = Math.random();
          C.acak = r < 0.4 ? 'gerimis' : r < 0.85 ? 'hujan' : 'badai'; C.sisaAcak = faseDetik() * (0.5 + Math.random()); C.tw = KUAT[C.acak];
          segarkanTapak(); toast(C.acak === 'badai' ? '⛈ Tiba-tiba badai petir' : C.acak === 'gerimis' ? '🌦 Gerimis mulai turun' : '🌧 Tiba-tiba hujan turun'); kabari(); }
      }
    }
    // hujan (jenis terakhir tetap dipakai selama mereda, supaya tetes berkurang pelan, tidak hilang seketika)
    const Je = efektif(); if (Je !== 'cerah') C.lalu = Je;
    const J = Je !== 'cerah' ? Je : C.lalu;
    const n = on ? TETES[J] * Math.min(1, C.w / KUAT[J]) : 0;
    hujan.visible = n > 0.005;
    if (hujan.visible) {
      U.jumlah.value = n; U.waktu.value += dt;
      const p = FPS.on ? camera.position : orbit.target, jauh = FPS.on ? 1 : Math.min(3, Math.max(1, camera.position.distanceTo(orbit.target) / 15));
      U.pusat.value.copy(p); U.ukuran.value.set(36 * jauh, 20 * jauh, 36 * jauh);
      U.laju.value = J === 'gerimis' ? 6 : J === 'badai' ? 12 : 9;
      U.angin.value.set(J === 'badai' ? 2.6 : 0.9, J === 'badai' ? 1.1 : 0.35);
      const malam = /malam|gelap/.test(MOOD);
      U.opasitas.value = (malam ? 0.18 : 0.32) * (J === 'gerimis' ? 0.7 : 1);
    }
    // suara hujan: teredam (bunyi di atap) saat kamera di dalam tapak bangunan
    const tingkat = on ? C.w * (J === 'gerimis' ? 0.35 : J === 'badai' ? 1 : 0.7) : 0;
    if (tingkat > 0.001 || suara) {
      const S = siapkanSuara();
      if (S) { const dalam = diDalam(camera.position.x, camera.position.z), t = S.ctx.currentTime;
        S.g.gain.setTargetAtTime(tingkat * (dalam ? 0.32 : 0.55), t, 0.4); S.lp.frequency.setTargetAtTime(dalam ? 700 : 6000, t, 0.3); }
    }
    // badai: kilat & guruh
    if (on && Je === 'badai' && C.w > 0.6) {
      if ((C.kilat -= dt) <= 0) { C.kilat = 6 + Math.random() * 12; C.flash = 0.35; guruh(0.6 + Math.random() * 2.5, 0.6 + Math.random() * 0.4); }
    }
    if (C.flash > 0) {
      C.flash -= dt; const k = C.flash > 0.25 || (C.flash > 0.08 && C.flash < 0.16) ? 1 : 0;
      hemiL.intensity = hemiL.userData.base * (PBR_ON ? 0.3 : 1) * (1 + 6 * k);
      if (C.flash <= 0) mendungLampu();
    }
  }
  // pilihan pengguna di bilah mode jalan: waktu → transisi halus (siklus berlanjut dari situ); cuaca → saat otomatis,
  // berlaku sampai pergantian acak berikutnya; saat manual, menjadi cuaca tetap (disimpan oleh index)
  function pilihWaktu(k) {
    transisi(k, 3);
    if (C.siklus) { C.fase = Math.max(0, SIKLUS.indexOf(k === 'gelap' ? 'malam' : k)); C.tSiklus = 0; }
  }
  function pilihCuaca(j) {
    if (!C.siklus || KUAT[j] == null) return false;
    C.acak = j === 'cerah' ? null : j; C.sisaAcak = faseDetik() * (0.5 + Math.random()); C.tAcak = faseDetik() * (0.6 + Math.random());
    C.tw = KUAT[efektif()]; if (C.acak) segarkanTapak(); kabari(); return true;
  }
  function setelahSuasana() { if (C.w > 0) mendungLampu(); }
  function setelahLangitDalam() { if (C.w > 0) mendungLangit(); }
  window.CUACA = { pasang, langkah, transisi, berikut, pilihWaktu, pilihCuaca, setelahSuasana, setelahLangit: setelahLangitDalam, segarkanTapak, diDalam,
    keadaan: () => ({ jenis: C.jenis, efektif: efektif(), acak: C.acak, siklus: C.siklus, w: C.w, tetes: hujan.visible ? Math.round(U.jumlah.value * MAKS) : 0, transisi: !!C.tween, fase: C.fase }) };
})();
