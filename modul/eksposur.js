/* Plan23D — EKSPOSUR OTOMATIS RINGAN untuk kualitas Halus & Cepat (JEV-129)
   Tanpa jalur efek (AO/bloom/HDR hanya di Tinggi, JEV-124), eksposur dulu dikali faktor tetap per suasana yang
   dikalibrasi di dalam ruangan terang — adegan yang lebih redup (luar rumah, langit foto saat matahari terbit,
   mendung/hujan, tampilan editor dari atas) jadi jauh lebih gelap daripada Tinggi, yang menyesuaikan diri.
   Kini tiap ±0,4 dtk adegan digambar ke target mungil 48×32 (kedalaman bayangan tidak diperbarui ulang), kurva ACES-nya
   dibalik untuk mendapat luminans linear, rata-rata log-luminansnya dihitung (dibatasi & berbobot, JEV-138), lalu faktornya memakai rumus HDR Tinggi
   yang sama: (kunci/rata)^0,7 dibatasi 0,35–2. Faktor bergeser halus antarbingkai (adaptasi mata) — terang Halus
   mengikuti Tinggi di dalam maupun di luar rumah.
   Pemetaan nada renderer sengaja TIDAK diganti untuk pengukuran: three r128 tidak mengompilasi ulang shader saat
   toneMapping berubah, jadi material yang pertama kali digambar di pengukuran akan terkunci tanpa pemetaan nada. */
/* global renderer, scene, camera, FX, FPS, MOOD, KUNCI_EKSPOSUR, fxBisaHDR */
(function () {
  'use strict';
  const W = 48, H = 32, JEDA = 400, EP = 0.4;          // EP: eksposur pengukuran — rendah agar sorotan tidak jenuh
  // JEV-138 (sama dengan jalur HDR Tinggi di index.html): luminans di atas BATAS× kunci dihitung BATAS× kunci — langit senja
  // / matahari di depan tidak lagi menarik rata-rata ke atas sehingga avatar & lantai jadi siluet; sepertiga atas layar
  // (langit) berbobot hingga 0,4
  const BATAS = 2.5, bobot = v => { const t = Math.min(1, Math.max(0, (v - 0.55) / 0.45)); return 1 - 0.6 * t * t * (3 - 2 * t); };
  // ACESFilmicToneMapping three.js: y = clamp(MO · rrt(MI · x·e/0,6)); dibalik: x = MI⁻¹ · rrt⁻¹(MO⁻¹ · y) · 0,6/e
  const balik = m => { const [a, b, c, d, e, f, g, h, i] = m, A = e * i - f * h, B = f * g - d * i, C = d * h - e * g, t = 1 / (a * A + b * B + c * C);
    return [A * t, (c * h - b * i) * t, (b * f - c * e) * t, B * t, (a * i - c * g) * t, (c * d - a * f) * t, C * t, (b * g - a * h) * t, (a * e - b * d) * t]; };
  const MI1 = balik([0.59719, 0.35458, 0.04823, 0.07600, 0.90834, 0.01566, 0.02840, 0.13383, 0.83777]);
  const MO1 = balik([1.60475, -0.53108, -0.07367, -0.10208, 1.10813, -0.00605, -0.00327, -0.07276, 1.07602]);
  const kali = (m, x, y, z) => [m[0] * x + m[1] * y + m[2] * z, m[3] * x + m[4] * y + m[5] * z, m[6] * x + m[7] * y + m[8] * z];
  const rrt1 = w => { w = Math.min(Math.max(w, 0), 1.01); const A = 0.983729 * w - 1, B = 0.432951 * w - 0.0245786, C = 0.238081 * w + 0.000090537;
    return Math.max(0, (-B - Math.sqrt(Math.max(0, B * B - 4 * A * C))) / (2 * A)); };
  const E = { rt: null, buf: null, skala: 1, t: -1e9, k: 0, sasaran: 0, pakai: 0, mood: '' };

  function siapkan() {
    const f = fxBisaHDR();     // target float terbaca di WebGL2 + EXT_color_buffer_float; selain itu 8-bit (terang > 1 terpotong)
    E.rt = new THREE.WebGLRenderTarget(W, H, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, stencilBuffer: false,
      type: f ? THREE.FloatType : THREE.UnsignedByteType });
    E.buf = f ? new Float32Array(W * H * 4) : new Uint8Array(W * H * 4); E.skala = f ? 1 : 1 / 255;
  }

  function ukur() {
    if (!E.rt) siapkan();
    const ex = renderer.toneMappingExposure, perlu = renderer.shadowMap.needsUpdate, lama = renderer.getRenderTarget();
    renderer.toneMappingExposure = EP; renderer.shadowMap.needsUpdate = false;
    renderer.setRenderTarget(E.rt); renderer.clear(); renderer.render(scene, camera);
    renderer.setRenderTarget(lama); renderer.toneMappingExposure = ex; renderer.shadowMap.needsUpdate = perlu;
    renderer.readRenderTargetPixels(E.rt, 0, 0, W, H, E.buf);
    const b = E.buf, s0 = E.skala, kunci = KUNCI_EKSPOSUR[MOOD] ?? 0.25, batas = Math.log2(kunci * BATAS);
    let s = 0, sb = 0;
    for (let i = 0; i < b.length; i += 4) {
      const w = kali(MO1, b[i] * s0, b[i + 1] * s0, b[i + 2] * s0), x = kali(MI1, rrt1(w[0]), rrt1(w[1]), rrt1(w[2]));
      const bb = bobot((Math.floor(i / 4 / W) + 0.5) / H);          // baris 0 = bawah layar
      s += bb * Math.min(batas, Math.log2(Math.max((0.2126 * x[0] + 0.7152 * x[1] + 0.0722 * x[2]) * 0.6 / EP, 1e-4))); sb += bb;
    }
    const rata = Math.pow(2, s / sb);
    if (!isFinite(rata)) return 0;
    return Math.min(2, Math.max(0.35, Math.pow(kunci / rata, 0.7)));
  }

  // dipanggil renderFrame tiap bingkai di jalur tanpa efek, sebelum adegan digambar
  function langkah() {
    // bingkai pertama / sesudah jeda panjang (tab tersembunyi, kembali dari Tinggi): langsung ke sasaran, bukan memudar
    const kini = performance.now(), lompat = !E.k || kini - E.k > 1000, dt = lompat ? 0 : Math.min(0.25, (kini - E.k) / 1000); E.k = kini;
    // setSuasana menyetel ulang FX.ke ke nilai tetapnya — pertahankan nilai adaptasi, cukup ukur ulang segera
    if (E.pakai && FX.ke !== E.pakai) { FX.ke = E.pakai; E.t = -1e9; }
    if (renderer.toneMapping !== THREE.ACESFilmicToneMapping) return;      // Cepat: tanpa pemetaan nada, eksposur tak berpengaruh
    if (lompat || kini - E.t > JEDA) {
      E.t = kini;
      let v = 0; try { v = ukur(); } catch (e) { v = 0; }
      if (v) { if (lompat || !E.sasaran) FX.ke = v; E.sasaran = v; }
    }
    if (E.sasaran) FX.ke *= Math.pow(E.sasaran / FX.ke, 1 - Math.exp(-dt * (FPS.on ? 1.6 : 3.0)));
    E.pakai = FX.ke;
  }
  window.EKSPOSUR = { langkah, keadaan: () => ({ ke: FX.ke, sasaran: E.sasaran }) };
})();
