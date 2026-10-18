/* Plan23D — AKTIVITAS & MINI GAME (JEV-110)
   Mode jalan: bidik kolam ikan → Mancing, panggangan BBQ → Panggang, kitchen set → Masak, tunggul kayu → Potong kayu,
   barang kecil → Angkat (dibawa di depan badan) lalu Taruh di tempat yang dibidik.
   · Mancing: tahan tombol untuk mengisi kekuatan lempar → pelampung jatuh di kolam → tunggu umpan dimakan → Sambar tepat
     waktu → tarik: tahan = gulung (tegangan naik), lepas = kendur (ikan menjauh); tegangan terlalu tinggi = tali putus,
     terlalu kendur lama = ikan kabur. Jarak 0 = ikan didapat (jenis & berat acak; lele lebih sering malam hari).
   · Potong kayu: penanda bergerak bolak-balik — ayun kapak saat penanda di zona hijau; zona makin sempit tiap belahan.
   · Panggang / masak: pilih bahan (ikan hasil mancing, jagung, sate, sosis / telur), balik saat matang, angkat sebelum gosong.
     Panggangan arang butuh kayu bakar dari tunggul kayu.
   Hasil masuk tas (perangkat ini) dan bisa dihadiahkan ke NPC lewat obrolan. NPC yang ikut / berada dekat ikut menemani,
   bersorak saat berhasil, dan kedekatannya naik. Pose avatar (membawa, memancing, mengapak, memasak) terlihat di Main bareng.
   · Berenang (JEV-113): bidik kolam renang → Berenang; joystick / WASD di air, tahan Selam untuk menyelam, Selesai = naik ke tepi. */
/* global $, el, toast, FPS, camera, scene, PROJECT, levelGroups, cariObjek, areaDunia, pointInPoly, rebuildScene, HIST, worldRoot,
   levelElevation, BAHASA, MOOD, muatModul, berdiri, FURN, fpsPijakan, adaTanahSitus, tinggiTanah, tambahKayuApi, apiMenyala */
(function () {
  'use strict';
  const T = (id, en) => (BAHASA && BAHASA.kode === 'id' ? id : en);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), acak = (a, b) => a + Math.random() * (b - a);

  /* ---------- TAS (inventaris per perangkat) ---------- */
  const MUTU = ['sempurna', 'enak', 'mentah', 'gosong'];
  let TAS = { ikan: [], kayu: 0, masakan: [] };
  try { const v = JSON.parse(localStorage.getItem('aktTas') || '{}');
    TAS = { ikan: (Array.isArray(v.ikan) ? v.ikan : []).slice(-30).filter(x => x && typeof x.nama === 'string').map(x => ({ nama: x.nama.slice(0, 40), berat: clamp(+x.berat || 0, 0, 50) })),
      kayu: clamp(Math.floor(+v.kayu || 0), 0, 999), masakan: (Array.isArray(v.masakan) ? v.masakan : []).slice(-30).filter(x => x && typeof x.nama === 'string').map(x => ({ nama: x.nama.slice(0, 40), mutu: MUTU.includes(x.mutu) ? x.mutu : 'enak' })) };
  } catch (e) { /* tas kosong */ }
  const simpanTas = () => { try { localStorage.setItem('aktTas', JSON.stringify(TAS)); } catch (e) { /* mode privat */ } };
  function ambil(jenis, i) {
    if (jenis === 'kayu') { if (TAS.kayu < 1) return null; TAS.kayu--; simpanTas(); return { nama: T('Kayu bakar', 'Firewood') }; }
    const d = TAS[jenis]; if (!Array.isArray(d) || !d[i]) return null;
    const [b] = d.splice(i, 1); simpanTas(); return b;
  }

  /* ---------- suara kecil (WebAudio, tanpa berkas) ---------- */
  let AC = null;
  const ac = () => { try { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) { AC = null; } return AC; };
  function derau(dur, f, q, vol, tipe = 'lowpass') {
    const c = ac(); if (!c) return; const n = c.createBufferSource(), b = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    const fl = c.createBiquadFilter(), g = c.createGain(); fl.type = tipe; fl.frequency.value = f; fl.Q.value = q; g.gain.value = vol;
    n.buffer = b; n.connect(fl).connect(g).connect(c.destination); n.start();
  }
  function nada(f, dur, vol, tipe = 'sine') { const c = ac(); if (!c) return; const o = c.createOscillator(), g = c.createGain(); o.type = tipe; o.frequency.value = f; g.gain.setValueAtTime(vol, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur); o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + dur); }
  const BUNYI = { cebur: () => derau(0.35, 900, 0.7, 0.5), klik: () => nada(2200, 0.02, 0.05, 'square'), kapak: () => { derau(0.12, 320, 1.2, 0.8, 'bandpass'); nada(90, 0.15, 0.4); },
    meleset: () => nada(520, 0.08, 0.06, 'triangle'), dapat: () => { nada(660, 0.12, 0.12); setTimeout(() => nada(990, 0.2, 0.12), 110); }, putus: () => nada(180, 0.25, 0.2, 'sawtooth') };
  let DESIS = null;
  function desis(v) {
    const c = ac(); if (!c) return;
    if (!DESIS && v > 0) { const n = c.createBufferSource(), b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const f = c.createBiquadFilter(), g = c.createGain(); f.type = 'highpass'; f.frequency.value = 2600; g.gain.value = 0; n.buffer = b; n.loop = true; n.connect(f).connect(g).connect(c.destination); n.start(); DESIS = { n, g }; }
    if (DESIS) DESIS.g.gain.value = clamp(v, 0, 1) * 0.06;
    if (DESIS && v <= 0) { try { DESIS.n.stop(); } catch (e) { /* sudah */ } DESIS = null; }
  }

  /* ---------- HUD ---------- */
  let H = null;
  function bangunHud() {
    const s = document.createElement('style');
    s.textContent = `#aktHud{position:absolute;inset:0;z-index:41;pointer-events:none;font-family:inherit;color:#fff}#aktHud[hidden]{display:none}
.ak-atas{position:absolute;top:calc(var(--bilah-atas,70px) + 10px);left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:10px;background:rgba(14,16,20,.72);border-radius:12px;padding:8px 12px;pointer-events:auto;backdrop-filter:blur(6px);max-width:calc(100% - 24px)}
.ak-atas b{font-size:.9rem}.ak-atas span{font-size:.76rem;color:#c9ced6}
.ak-teks{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);text-align:center;font:700 1.25rem/1.25 inherit;text-shadow:0 2px 8px rgba(0,0,0,.7);background:rgba(14,16,20,.45);border-radius:10px;padding:8px 16px;white-space:pre-line}
.ak-teks:empty{display:none}
.ak-meter{position:absolute;right:max(16px,env(safe-area-inset-right));bottom:calc(max(14px,env(safe-area-inset-bottom)) + 120px);width:190px;text-align:center}
.ak-meter canvas{width:190px;height:120px;display:block}.ak-meter div{margin-top:4px;font:700 1.35rem/1 inherit;background:rgba(14,16,20,.7);border:1px solid rgba(255,255,255,.35);border-radius:8px;padding:6px 10px;display:inline-block}
.ak-bar{position:absolute;left:50%;bottom:calc(max(14px,env(safe-area-inset-bottom)) + 140px);transform:translateX(-50%);width:min(420px,calc(100% - 48px));height:22px;border-radius:11px;background:rgba(14,16,20,.7);border:2px solid rgba(255,255,255,.6);overflow:hidden}
.ak-bar i{position:absolute;top:0;bottom:0}.ak-bar .ak-zona{background:rgba(78,201,120,.75)}.ak-bar .ak-zona2{background:rgba(78,201,120,.35)}.ak-bar .ak-panas{background:rgba(232,90,60,.6)}.ak-bar .ak-penanda{width:4px;margin-left:-2px;background:#fff;box-shadow:0 0 6px #fff}
.ak-tombol{position:absolute;right:max(16px,env(safe-area-inset-right));bottom:calc(max(14px,env(safe-area-inset-bottom)) + 20px);display:flex;gap:10px;pointer-events:auto}
.ak-tombol button{min-width:88px;height:88px;border-radius:50%;border:3px solid rgba(255,255,255,.9);background:rgba(14,16,20,.6);color:#fff;font:700 .9rem/1.1 inherit;backdrop-filter:blur(6px);touch-action:none;user-select:none;-webkit-user-select:none}
.ak-tombol button[hidden]{display:none}.ak-tombol button.on{background:rgba(78,201,176,.55)}
.ak-pilih{position:absolute;left:50%;bottom:calc(max(14px,env(safe-area-inset-bottom)) + 130px);transform:translateX(-50%);display:flex;flex-wrap:wrap;justify-content:center;gap:8px;pointer-events:auto;width:min(480px,calc(100% - 24px))}
.ak-pilih:empty{display:none}.ak-kartu{position:absolute;left:50%;top:24%;transform:translateX(-50%);background:rgba(14,16,20,.82);border:1px solid rgba(255,255,255,.3);border-radius:14px;padding:12px 18px;text-align:center;font:600 1rem/1.35 inherit}
.ak-kartu[hidden]{display:none}.ak-kartu big{display:block;font-size:1.6rem}
.ak-air{position:absolute;inset:0;opacity:0;pointer-events:none;background:radial-gradient(ellipse at 50% 28%,rgba(70,180,215,.32),rgba(6,48,88,.8));transition:opacity .12s}
.ak-tetes{position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 18% 32%,rgba(225,242,255,.6) 0 2.4%,transparent 3%),radial-gradient(circle at 74% 22%,rgba(225,242,255,.55) 0 3.2%,transparent 3.8%),radial-gradient(circle at 62% 70%,rgba(225,242,255,.5) 0 2%,transparent 2.6%),radial-gradient(circle at 34% 78%,rgba(225,242,255,.5) 0 2.8%,transparent 3.4%),radial-gradient(circle at 88% 58%,rgba(225,242,255,.45) 0 1.6%,transparent 2.1%),rgba(200,230,255,.12);animation:akTetes 1.6s ease-out forwards}
@keyframes akTetes{0%{opacity:1}100%{opacity:0;transform:translateY(22px)}}
@media (prefers-reduced-motion:reduce){.ak-tetes{animation:none;opacity:.6}}
body.aktivitas #fpsDok,body.aktivitas #fpsAim,body.aktivitas #fpsFoto,body.aktivitas #fpsLembar{display:none!important}`;
    document.head.appendChild(s);
    const d = el('div'); d.id = 'aktHud'; d.hidden = true;
    const atas = el('div', 'ak-atas'), judul = el('b'), info = el('span'), sel = el('button', 'btn sm', T('Selesai', 'Done'));
    sel.onclick = () => selesai(); atas.append(judul, info, sel);
    const teks = el('div', 'ak-teks'); teks.setAttribute('aria-live', 'polite');
    const meter = el('div', 'ak-meter'), kan = document.createElement('canvas'), jarak = el('div'); kan.width = 380; kan.height = 240; meter.append(kan, jarak);
    const bar = el('div', 'ak-bar'), tombol = el('div', 'ak-tombol'), pilihan = el('div', 'ak-pilih'), kartu = el('div', 'ak-kartu'); kartu.hidden = true;
    const b1 = el('button'), b2 = el('button'); b1.setAttribute('aria-label', 'Aksi'); b2.hidden = true;
    for (const [b, k] of [[b1, 1], [b2, 2]]) {
      b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); tekan(k, true); });
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, e => { e.stopPropagation(); tekan(k, false); });
    }
    tombol.append(b2, b1);
    d.append(atas, teks, meter, bar, tombol, pilihan, kartu);
    ($('#viewport') || document.body).appendChild(d);
    H = { d, judul, info, teks, meter, kan, jarak, bar, tombol, b1, b2, pilihan, kartu };
  }
  function hud(judul, info) {
    if (!H) bangunHud();
    H.d.hidden = false; H.judul.textContent = judul; H.info.textContent = info; H.teks.textContent = ''; H.meter.hidden = true; H.bar.hidden = true; H.pilihan.textContent = ''; H.kartu.hidden = true; H.b2.hidden = true;
    document.body.classList.add('aktivitas');
  }
  const teks = t => { if (H && H.teks.textContent !== t) H.teks.textContent = t; };
  function kartu(ikon, t, dur = 2600) { H.kartu.textContent = ''; H.kartu.append(el('big', null, ikon), document.createTextNode(t)); H.kartu.hidden = false; clearTimeout(kartu.t); kartu.t = setTimeout(() => { if (H) H.kartu.hidden = true; }, dur); }
  function tombol(l1, l2) { H.b1.textContent = l1; H.b2.hidden = !l2; if (l2) H.b2.textContent = l2; }
  function bar(zona, penanda, panas) {
    H.bar.hidden = false; H.bar.textContent = '';
    for (const [a, b, k] of zona) { const z = el('i', k); z.style.left = a * 100 + '%'; z.style.width = (b - a) * 100 + '%'; H.bar.appendChild(z); }
    if (panas != null) { const z = el('i', 'ak-panas'); z.style.left = panas * 100 + '%'; z.style.width = (1 - panas) * 100 + '%'; H.bar.appendChild(z); }
    const p = el('i', 'ak-penanda'); p.style.left = clamp(penanda, 0, 1) * 100 + '%'; H.bar.appendChild(p);
  }
  // pengukur tegangan setengah lingkaran: biru → kuning → merah, jarum = tegangan
  function meter(tegangan, label, jarakM) {
    H.meter.hidden = false; const c = H.kan.getContext('2d'), W = 380, cx = W / 2, cy = 210, r = 160;
    c.clearRect(0, 0, W, 240); c.lineWidth = 26; c.lineCap = 'butt';
    for (let i = 0; i < 40; i++) { const a0 = Math.PI + Math.PI * i / 40, a1 = Math.PI + Math.PI * (i + 1) / 40, k = i / 39;
      c.strokeStyle = k < 0.5 ? `rgb(${Math.round(70 + 340 * k)},${Math.round(150 + 140 * k)},${Math.round(230 - 300 * k)})` : `rgb(${Math.round(240)},${Math.round(220 - 360 * (k - 0.5))},${Math.round(80 - 120 * (k - 0.5))})`;
      c.beginPath(); c.arc(cx, cy, r, a0, a1 + 0.01); c.stroke(); }
    c.fillStyle = 'rgba(14,16,20,.75)'; c.beginPath(); c.arc(cx, cy, r - 16, Math.PI, 0); c.fill();
    const a = Math.PI + Math.PI * clamp(tegangan, 0, 1); c.strokeStyle = '#fff'; c.lineWidth = 8; c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * (r - 30), cy + Math.sin(a) * (r - 30)); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, cy, 12, 0, Math.PI * 2); c.fill();
    c.font = '600 26px system-ui,sans-serif'; c.textAlign = 'center'; c.fillText(label, cx, cy - 70);
    H.jarak.textContent = jarakM.toFixed(1) + ' m';
  }

  /* ---------- kamera & alat di tangan ---------- */
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3(), qA = new THREE.Quaternion();
  function lihatKe(p, dt, laju = 4) {
    const dx = p.x - camera.position.x, dy = p.y - camera.position.y, dz = p.z - camera.position.z;
    const yaw = Math.atan2(dx, dz), pitch = Math.atan2(dy, Math.hypot(dx, dz)), k = Math.min(1, dt * laju), d = Math.atan2(Math.sin(yaw - FPS.yaw), Math.cos(yaw - FPS.yaw));
    FPS.yaw += d * k; FPS.pitch += (pitch - FPS.pitch) * k;
  }
  // grup di depan kamera (ruang pandang): x kanan, y atas, z ke depan (negatif)
  function tempelKamera(g, x, y, z) { camera.updateMatrixWorld(); g.position.set(x, y, z).applyMatrix4(camera.matrixWorld); g.quaternion.copy(camera.getWorldQuaternion(qA)); }
  const bahan = (warna, kasar = 0.7, logam = 0) => new THREE.MeshStandardMaterial({ color: warna, roughness: kasar, metalness: logam });
  function silinder(rt, rb, h, m, seg = 10) { const x = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); x.userData.noExport = true; x.raycast = () => {}; return x; }
  function kotak(w, h, d, m) { const x = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); x.userData.noExport = true; x.raycast = () => {}; return x; }
  function bola(r, m) { const x = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m); x.userData.noExport = true; x.raycast = () => {}; return x; }
  function ikanMesh(warna) {
    const g = new THREE.Group(), m = bahan(warna, 0.45, 0.2), b = bola(0.5, m); b.scale.set(0.16, 0.34, 0.6); g.add(b);
    const ekor = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 4), m); ekor.rotation.x = -Math.PI / 2; ekor.position.z = -0.36; ekor.scale.set(0.3, 1, 1); g.add(ekor);
    const mata = bola(0.025, bahan(0x111111, 0.3)); mata.position.set(0.07, 0.04, 0.2); g.add(mata); return g;
  }
  function bersih(g) { if (!g) return; if (g.parent) g.parent.remove(g); g.traverse(x => { if (x.isMesh || x.isLine || x.isPoints) { x.geometry.dispose(); } }); }

  /* ---------- percikan ---------- */
  let PERCIK = null;
  function percik(p, n = 18, warna = 0xcfe8ff, laju = 1.6) {
    if (!PERCIK) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(240 * 3), 3));
      PERCIK = { obj: new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.05, color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false })), p: [] };
      PERCIK.obj.frustumCulled = false; PERCIK.obj.userData.noExport = true; PERCIK.obj.raycast = () => {}; scene.add(PERCIK.obj); }
    PERCIK.obj.material.color.set(warna);
    for (let i = 0; i < n && PERCIK.p.length < 240; i++) PERCIK.p.push({ x: p.x, y: p.y, z: p.z, vx: acak(-0.6, 0.6) * laju, vy: acak(0.8, 2) * laju, vz: acak(-0.6, 0.6) * laju, t: acak(0.5, 0.9) });
  }
  function langkahPercik(dt) {
    if (!PERCIK) return; const a = PERCIK.obj.geometry.attributes.position;
    PERCIK.p = PERCIK.p.filter(q => (q.t -= dt) > 0);
    PERCIK.p.forEach((q, i) => { q.vy -= 6 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; a.setXYZ(i, q.x, q.y, q.z); });
    PERCIK.obj.geometry.setDrawRange(0, PERCIK.p.length); a.needsUpdate = true;
  }

  /* ---------- kedekatan saat beraktivitas bersama ---------- */
  function bonus(dasar, alasan) {
    if (!window.NPC) return;
    const ids = window.NPC.dekat(7); if (!ids.length) return;
    window.NPC.sorak();
    muatModul('kartunpc').then(() => muatModul('dialog')).then(() => {
      const nama = [];
      for (const id of ids) { const n = window.DIALOG.tambahRelasi(id, dasar); if (n > 0) nama.push(window.DIALOG.nama(id)); }
      if (nama.length) toast('💛 ' + nama.join(', ') + ' · ' + alasan);
    }, () => {});
  }

  /* ---------- keadaan aktivitas ---------- */
  let A = null, B = null, TEKAN = [false, false, false];
  const KODE = { mancing: 'mancing', potong: 'kapak', panggang: 'masak', masak: 'masak', renang: 'renang', hangat: 'hangat', marshmallow: 'marshmallow' };
  function mulai(jenis, t) {
    if (A) selesai(); if (B) taruh(); if (!FPS.on) return null;
    if (FPS.duduk && typeof berdiri === 'function') berdiri();
    if (window.DIALOG) window.DIALOG.tutup(true);
    A = { jenis, t: 0, id: t.id, o: cariObjek(t.id), titik: t.titik ? t.titik.clone() : null, props: new THREE.Group() };
    A.props.userData.noExport = true; scene.add(A.props);
    FPS.keys.clear(); if (FPS.move) { FPS.move.f = 0; FPS.move.s = 0; }
    FPS.gaya = { k: KODE[jenis], x: camera.position.x, z: camera.position.z, t: performance.now() };
    TEKAN = [false, false, false];
    return A;
  }
  function selesai() {
    if (!A) return;
    if (A.akhir) try { A.akhir(); } catch (e) { /* abaikan */ }
    bersih(A.props); if (A.alat) bersih(A.alat);
    desis(0); A = null; FPS.gaya = null;
    if (H) { H.d.hidden = true; }
    document.body.classList.remove('aktivitas');
    if (window.NPC) window.NPC.selesaiTemani();
  }
  function tekan(k, on) { if (!A) return; const lalu = TEKAN[k]; TEKAN[k] = on; ac(); if (H) H['b' + k].classList.toggle('on', on); if (on && !lalu && A.tekan) A.tekan(k); if (!on && lalu && A.lepas) A.lepas(k); }
  // Spasi / E = tombol utama, Q = tombol kedua (tangkapan lebih dulu agar tidak memicu aksi mode jalan)
  addEventListener('keydown', e => { if (!A || e.repeat) return; const k = e.key.toLowerCase(); if (k === ' ' || k === 'e') { tekan(1, true); e.preventDefault(); e.stopImmediatePropagation(); } else if (k === 'q') { tekan(2, true); e.preventDefault(); e.stopImmediatePropagation(); } else if (k === 'escape') { selesai(); e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  addEventListener('keyup', e => { if (!A) return; const k = e.key.toLowerCase(); if (k === ' ' || k === 'e') tekan(1, false); else if (k === 'q') tekan(2, false); }, true);

  /* =================== BERENANG (JEV-113) ===================
     Kolam renang: masuk di titik air yang dibidik, berenang bebas di permukaan (joystick / WASD, Shift lebih cepat),
     tahan Selam untuk menyelam (layar membiru, suara teredam). Selesai = naik ke tepi terdekat. Pose terkirim:
     17 mengapung (diam), 18 gaya bebas (bergerak). NPC yang ikut ikut berenang; tiap 25 m bersama menambah kedekatan. */
  // titik terdekat pada keliling poligon + normal keluar
  function tepiKolam(poli, x, z) {
    let best = null;
    for (let i = 0; i < poli.length; i++) {
      const [ax, az] = poli[i], [bx, bz] = poli[(i + 1) % poli.length], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz; if (l2 < 1e-6) continue;
      const u = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1), px = ax + dx * u, pz = az + dz * u, d = Math.hypot(x - px, z - pz);
      if (!best || d < best.d) best = { x: px, z: pz, d, dx: dx / Math.sqrt(l2), dz: dz / Math.sqrt(l2) };
    }
    if (!best) return null;
    // normal yang menjauhi bagian dalam
    let nx = best.dz, nz = -best.dx; if (pointInPoly(best.x + nx * 0.05, best.z + nz * 0.05, poli)) { nx = -nx; nz = -nz; }
    best.nx = nx; best.nz = nz; return best;
  }
  const dalamKolam = (poli, x, z, sisa) => { if (!pointInPoly(x, z, poli)) return false; const t = tepiKolam(poli, x, z); return !t || t.d >= sisa; };
  function keDalam(poli, x, z, sisa) {
    if (dalamKolam(poli, x, z, sisa)) return { x, z };
    const t = tepiKolam(poli, x, z); if (!t) return null;
    for (let d = sisa; d < sisa + 3; d += 0.1) { const px = t.x - t.nx * d, pz = t.z - t.nz * d; if (dalamKolam(poli, px, pz, sisa)) return { x: px, z: pz }; }
    let cx = 0, cz = 0; for (const [a, b] of poli) { cx += a; cz += b; } cx /= poli.length; cz /= poli.length;
    return pointInPoly(cx, cz, poli) ? { x: cx, z: cz } : null;
  }
  function airKolam(o) {
    const g = grupObjek(o.id); if (!g) return null; g.updateMatrixWorld(true);
    return { poli: areaDunia(o), airY: g.localToWorld(vA.set(0, -0.12, 0)).y, dalam: clamp(+o.params.kedalaman || 1.4, 0.2, 3) };
  }
  function lapisanAir() {
    if (H.air) return H.air;
    const d = el('div', 'ak-air'); H.d.prepend(d); H.air = d; return d;
  }
  function mulaiRenang(t) {
    const o = cariObjek(t.id); if (!o || o.kind !== 'area' || (o.params || {}).jenis !== 'kolam_renang') return;
    const K = airKolam(o); if (!K) return;
    const p = keDalam(K.poli, t.titik ? t.titik.x : camera.position.x, t.titik ? t.titik.z : camera.position.z, 0.4); if (!p) return;
    const a = mulai('renang', t); if (!a) return;
    Object.assign(a, K, { x: p.x, z: p.z, vx: 0, vz: 0, selam: 0, fase: 0, jarak: 0, bonusM: 0, asal: { x: camera.position.x, z: camera.position.z, feet: FPS.feet } });
    hud(T('🏊 Berenang', '🏊 Swimming'), T('Joystick / WASD untuk berenang · tahan Selam untuk menyelam', 'Joystick / WASD to swim · hold Dive to go under'));
    tombol(T('Selam', 'Dive'), T('💦 Ciprat', '💦 Splash')); lapisanAir().style.opacity = 0;
    FPS.feet = a.airY; FPS.vy = 0; FPS.pitch = Math.max(FPS.pitch, -0.2);
    BUNYI.cebur(); percik(vB.set(a.x, a.airY, a.z), 40, 0xe8f6ff, 1.3);
    a.langkah = dt => langkahRenang(a, dt);
    a.tekan = k => { if (k === 1) { derau(0.5, 380, 0.8, 0.35); percik(vB.set(a.x, a.airY, a.z), 14, 0xe8f6ff, 0.9); } else if (k === 2) ciprat(a); };
    a.akhir = () => naikKolam(a);
    if (window.NPC && window.NPC.renang) window.NPC.renang(a.poli, a.airY);
  }
  function langkahRenang(a, dt) {
    let f = 0, s = 0;
    if (FPS.keys.has('w') || FPS.keys.has('arrowup')) f += 1;
    if (FPS.keys.has('s') || FPS.keys.has('arrowdown')) f -= 1;
    if (FPS.keys.has('a') || FPS.keys.has('arrowleft')) s -= 1;
    if (FPS.keys.has('d') || FPS.keys.has('arrowright')) s += 1;
    if (FPS.move) { f += FPS.move.f; s += FPS.move.s; }
    const mag = Math.hypot(f, s); if (mag > 1) { f /= mag; s /= mag; }
    const v = FPS.keys.has('shift') ? 1.8 : 1.1, fx = Math.sin(FPS.yaw), fz = Math.cos(FPS.yaw);
    const tx = (fx * f - fz * s) * v, tz = (fz * f + fx * s) * v, k = Math.min(1, dt * 2.5);
    a.vx += (tx - a.vx) * k; a.vz += (tz - a.vz) * k;                // air: percepatan & perlambatan lembut
    let px = a.x + a.vx * dt, pz = a.z + a.vz * dt;
    if (!dalamKolam(a.poli, px, pz, 0.3)) {                         // dinding kolam: menyusuri tepi
      if (dalamKolam(a.poli, px, a.z, 0.3)) { pz = a.z; a.vz *= 0.3; } else if (dalamKolam(a.poli, a.x, pz, 0.3)) { px = a.x; a.vx *= 0.3; } else { px = a.x; pz = a.z; a.vx = a.vz = 0; }
    }
    const laju = Math.hypot(px - a.x, pz - a.z) / Math.max(dt, 1e-4); a.jarak += laju * dt; a.x = px; a.z = pz;
    // kayuhan: percikan & suara tiap ayunan tangan
    const lalu = a.fase; a.fase += dt * (0.8 + laju * 1.1) * Math.PI;
    if (laju > 0.3 && a.selam < 0.3 && Math.floor(a.fase / Math.PI) !== Math.floor(lalu / Math.PI)) {
      derau(0.16, 1500, 0.6, 0.14); percik(vB.set(a.x + fx * 0.55 + (Math.floor(a.fase / Math.PI) % 2 ? 0.25 : -0.25) * fz, a.airY, a.z + fz * 0.55), 6, 0xe8f6ff, 0.7);
    }
    // menyelam: tahan tombol utama
    const dasar = Math.min(a.dalam - 0.3, 1.3);
    a.selam += ((TEKAN[1] ? 1 : 0) - a.selam) * Math.min(1, dt * 2.2);
    if (TEKAN[1] && Math.random() < dt * 1.5) nada(140 + Math.random() * 120, 0.12, 0.05);   // gelembung
    const ayun = 0.035 * Math.sin(a.t * 2.1) * (1 - a.selam);
    a.t += dt;
    camera.position.set(a.x, a.airY + 0.11 + ayun - a.selam * dasar, a.z);
    FPS.feet = a.airY;
    if (H.air) H.air.style.opacity = clamp((a.selam * dasar - 0.08) / 0.25, 0, 1).toFixed(2);
    if (a.cipT > 0) a.cipT -= dt; if (a.cipJeda > 0) a.cipJeda -= dt;
    FPS.gaya = { k: a.cipT > 0 ? 'ciprat' : laju > 0.25 ? 'bebas' : 'renang', x: a.x, z: a.z, t: performance.now() };
    H.info.textContent = T('Jarak ', 'Distance ') + a.jarak.toFixed(0) + ' m · ' + (a.selam > 0.5 ? T('menyelam', 'diving') : T('tahan Selam untuk menyelam', 'hold Dive to go under'));
    if (a.jarak - a.bonusM >= 25) { a.bonusM += 25; bonus(3, T('berenang bareng', 'swimming together')); }
  }
  function naikKolam(a) {
    const t = tepiKolam(a.poli, a.x, a.z);
    let x = a.asal.x, z = a.asal.z, feet = a.asal.feet;
    if (t) { x = t.x + t.nx * 0.55; z = t.z + t.nz * 0.55;
      const g = fpsPijakan(x, z, a.airY + 0.8), tanah = levelElevation(0) + (adaTanahSitus() ? tinggiTanah(x, z) : 0);
      feet = Math.max(g == null ? -1e9 : g, tanah); if (!Number.isFinite(feet) || Math.abs(feet - a.airY) > 1.5) { x = a.asal.x; z = a.asal.z; feet = a.asal.feet; } }
    FPS.feet = feet; FPS.vy = 0; camera.position.set(x, feet + FPS.eye, z);
    if (t) FPS.yaw = Math.atan2(t.nx, t.nz);
    if (H.air) H.air.style.opacity = 0;
    derau(0.3, 700, 0.7, 0.25);
    if (window.NPC && window.NPC.selesaiRenang) window.NPC.selesaiRenang();
  }

  /* ---------- main air (JEV-118): Ciprat = sapuan tangan ke depan, air memercik sepanjang ±2 m; NPC di depan tertawa, yang
     ikut berenang membalas (atau sesekali lebih dulu) — cipratan yang mengenai pengunjung membasahi layar sebentar ---------- */
  function ciprat(a) {
    if (a.cipJeda > 0) return; a.cipJeda = 0.7; a.cipT = 0.75;
    const fx = Math.sin(FPS.yaw), fz = Math.cos(FPS.yaw);
    derau(0.45, 1700, 0.5, 0.4, 'bandpass'); setTimeout(() => derau(0.3, 900, 0.7, 0.25), 120);
    for (let i = 0; i < 5; i++) setTimeout(() => { if (A === a) percik(vB.set(a.x + fx * (0.4 + i * 0.45), a.airY + 0.05, a.z + fz * (0.4 + i * 0.45)), 10, 0xe8f6ff, 1.1); }, i * 35);
    const kena = window.NPC && window.NPC.ciprat ? window.NPC.ciprat(a.x, a.z, fx, fz) : [];
    if (kena.length) { a.cipKena = (a.cipKena || 0) + 1; if (a.cipKena % 3 === 1) bonus(2, T('main air bareng', 'splashing around together')); }
    return kena;
  }
  function dicipratkan(x, z) {
    if (!A || A.jenis !== 'renang') return false;
    const a = A, dx = a.x - x, dz = a.z - z, d = Math.hypot(dx, dz) || 1;
    for (let i = 0; i < 4; i++) setTimeout(() => { if (A === a) percik(vB.set(x + dx / d * (0.4 + i * 0.45), a.airY + 0.05, z + dz / d * (0.4 + i * 0.45)), 10, 0xe8f6ff, 1.1); }, i * 40);
    setTimeout(() => { if (A !== a || !H) return; derau(0.5, 2000, 0.4, 0.35, 'bandpass'); const t = el('div', 'ak-tetes'); H.d.appendChild(t); setTimeout(() => t.remove(), 1700); }, 200);
    return true;
  }

  /* =================== API: KAYU BAKAR & API UNGGUN (JEV-118) ===================
     Tumpukan kayu bakar → Ambil kayu bakar (+3, sekali per menit per tumpukan). Api unggun / perapian / tungku → Tambah kayu
     bakar (api menyala bila padam & membesar beberapa menit), Hangatkan diri (duduk bersila menghadap api; NPC sekitar datang
     duduk melingkar), Bakar marshmallow (api unggun: tahan Panggang untuk mendekatkan tusukan ke api, angkat saat keemasan). */
  const AMBIL_T = new Map();
  function ambilKayu(t) {
    const kini = performance.now();
    if (kini - (AMBIL_T.get(t.id) ?? -1e9) < 60000) { toast(T('Tumpukan ini baru diambil — tunggu sebentar', 'You just took from this pile — wait a moment')); return; }
    AMBIL_T.set(t.id, kini); TAS.kayu = Math.min(999, TAS.kayu + 3); simpanTas();
    derau(0.15, 320, 1.2, 0.45, 'bandpass'); setTimeout(() => derau(0.15, 280, 1.2, 0.4, 'bandpass'), 160);
    toast(T(`🪵 +3 kayu bakar (tas: ${TAS.kayu})`, `🪵 +3 firewood (bag: ${TAS.kayu})`));
  }
  function titikApi(id) {
    const g = grupObjek(id), o = cariObjek(id); if (!g || !o) return null; g.updateMatrixWorld(true);
    const unggun = o.type === 'api_unggun' || (o.kind === 'model' && o.params && o.params.interaksi === 'unggun'), at = g.userData.apiTitik;
    if (at) {                                                          // model unggahan (JEV-123): titik api pilihan pemilik, jarak duduk dari ukuran model
      const pusat = g.localToWorld(at.clone()), s = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
      return { g, o, unggun, pusat, p: pusat.clone().add(new THREE.Vector3(0, 0.2, 0)), r: Math.max(unggun ? 1.15 : 1.35, Math.max(s.x, s.z) / 2 + 0.55) };
    }
    return { g, o, unggun, pusat: g.getWorldPosition(new THREE.Vector3()), p: g.localToWorld(new THREE.Vector3(0, unggun ? 0.2 : 0.42, unggun ? 0 : 0.3)) };
  }
  function tambahKayu(t) {
    const F = titikApi(t.id); if (!F) return;
    if (TAS.kayu < 1) { toast(T('Kayu bakar habis — ambil di tumpukan kayu bakar atau potong kayu di tunggul', 'No firewood — take some from a log pile or chop some at a stump')); return; }
    TAS.kayu--; simpanTas();
    if (typeof tambahKayuApi === 'function') tambahKayuApi(t.id); besarkanApi(t.id);
    derau(0.25, 260, 1.1, 0.5, 'bandpass'); setTimeout(() => derau(0.9, 2400, 0.4, 0.16, 'highpass'), 220);   // kayu jatuh, api menyambar
    percik(F.p.clone(), 26, 0xffb050, 1.1);
    toast(T(`🔥 Api membesar (kayu bakar tersisa: ${TAS.kayu})`, `🔥 The fire grows (firewood left: ${TAS.kayu})`));
    if (A && A.F && A.F.o.id === t.id) A.kayuT = 0;
  }
  // besar api sesudah ditambah kayu: ≤ 1,8×, susut ke 1× dalam ±3 menit — lidah api & kuat cahaya (index.html membaca apiKuat)
  const API_KUAT = new Map();
  function kuatkanApi(id, v) { const g = grupObjek(id); if (!g) return; g.userData.apiKuat = v; g.traverse(x => { if (x.name === 'lidahApi') x.scale.set(0.75 + 0.25 * v, 0.6 + 0.4 * v, 0.75 + 0.25 * v); }); }
  function besarkanApi(id) { const v = Math.min(1.8, (API_KUAT.get(id) || 1) + 0.4); API_KUAT.set(id, v); kuatkanApi(id, v); return v; }
  function langkahApi(dt) { for (const [id, v] of API_KUAT) { const b = Math.max(1, v - 0.8 / 180 * dt); if (b <= 1.001) { API_KUAT.delete(id); kuatkanApi(id, 1); } else { API_KUAT.set(id, b); kuatkanApi(id, b); } } }
  function mulaiHangat(t, marsh) {
    const F = titikApi(t.id); if (!F) return;
    if (typeof apiMenyala === 'function' && !apiMenyala(t.id)) { toast(T('Apinya padam — tambah kayu bakar dulu', 'The fire is out — add some firewood first')); return; }
    const a = mulai(marsh ? 'marshmallow' : 'hangat', t); if (!a) return;
    // duduk di sisi api yang terdekat (api unggun) atau di depan perapian, menghadap api
    let ux = camera.position.x - F.pusat.x, uz = camera.position.z - F.pusat.z;
    if (!F.unggun) { const d0 = F.g.localToWorld(new THREE.Vector3(0, 0, 1)).sub(F.g.getWorldPosition(new THREE.Vector3())); ux = d0.x; uz = d0.z; }
    const l = Math.hypot(ux, uz) || 1; ux /= l; uz /= l;
    const r = F.r || (F.unggun ? 1.15 : 1.35), x = F.pusat.x + ux * r, z = F.pusat.z + uz * r;
    const g0 = fpsPijakan(x, z, FPS.feet + 0.8), tanah = levelElevation(0) + (adaTanahSitus() ? tinggiTanah(x, z) : 0);
    let feet = Math.max(g0 == null ? -1e9 : g0, tanah); if (!Number.isFinite(feet) || Math.abs(feet - FPS.feet) > 0.6) feet = FPS.feet;
    Object.assign(a, { F, x, z, feet, bonusT: 0, marsh, kayuT: 0 });
    FPS.feet = feet; FPS.yaw = Math.atan2(-ux, -uz); FPS.pitch = marsh ? -0.42 : -0.25; camera.position.set(x, feet + 0.8, z);
    a.ids = window.NPC && window.NPC.kumpulApi ? window.NPC.kumpulApi({ x: F.pusat.x, z: F.pusat.z }, r, Math.atan2(ux, uz)) : [];
    if (marsh) {
      hud(T('🍡 Bakar marshmallow', '🍡 Toast marshmallows'), T('Tahan Panggang untuk mendekatkan ke api · Angkat saat keemasan', 'Hold Toast to bring it near the fire · Take it out when golden'));
      tombol(T('Panggang', 'Toast'), T('Angkat', 'Take out'));
      const tusuk = silinder(0.005, 0.005, 0.75, bahan(0xb8925a, 0.8), 6), mm = bahan(0xf6f2ea, 0.85), marshmallow = silinder(0.024, 0.024, 0.045, mm, 14);
      a.alat = new THREE.Group(); a.alat.add(tusuk, marshmallow); scene.add(a.alat); Object.assign(a, { tusuk, marshmallow, mm, tahap: 'bakar', mt: 0, ujung: 0 });
      a.tekan = k => { if (k === 2) angkatMarsh(a); };
    } else {
      hud(T('🔥 Menghangatkan diri', '🔥 Warming up'), T('Duduk di dekat api · Selesai untuk berdiri', 'Sitting by the fire · Done to stand up'));
      tombol(T('Gosok tangan', 'Rub hands'));
      a.tekan = k => { if (k === 1) derau(0.5, 900, 0.5, 0.12, 'bandpass'); };
    }
    a.langkah = dt => langkahHangat(a, dt);
    a.akhir = () => { FPS.feet = a.feet; camera.position.set(a.x, a.feet + FPS.eye, a.z); };
  }
  function langkahHangat(a, dt) {
    a.t += dt; camera.position.set(a.x, a.feet + 0.8 + 0.005 * Math.sin(a.t * 1.3), a.z);
    FPS.gaya = { k: a.marsh ? 'marshmallow' : 'hangat', x: a.x, z: a.z, t: performance.now() };
    if (typeof apiMenyala === 'function' && !apiMenyala(a.F.o.id)) { teks(T('Apinya padam', 'The fire went out')); setTimeout(() => { if (A === a) selesai(); }, 1200); a.langkah = () => {}; return; }
    a.bonusT += dt; if (a.bonusT >= 30) { a.bonusT = 0; bonus(2, T('duduk di depan api bersama', 'sitting by the fire together')); }
    if (a.marsh) langkahMarsh(a, dt);
  }
  // marshmallow: tahan Panggang = ujung tusukan turun ke lidah api (matang cepat), lepas = di atas api (matang pelan)
  const warnaMarsh = x => { const c = new THREE.Color(0xf6f2ea); if (x < 0.8) return c.lerp(new THREE.Color(0xd9a35a), clamp(x / 0.8, 0, 1)); return new THREE.Color(0xd9a35a).lerp(new THREE.Color(0x1d1612), clamp((x - 0.8) / 0.45, 0, 1)); };
  function langkahMarsh(a, dt) {
    if (a.tahap !== 'bakar') { desis(0); return; }
    a.ujung += ((TEKAN[1] ? 1 : 0) - a.ujung) * Math.min(1, dt * 4);
    a.mt += dt * (0.05 + 0.28 * a.ujung) * (0.85 + 0.3 * Math.sin(a.t * 0.9));
    camera.updateMatrixWorld();
    const tangan = vA.set(0.16, -0.3, -0.2).applyMatrix4(camera.matrixWorld), ujung = vC.copy(a.F.p).setY(a.F.p.y + 0.42 - 0.24 * a.ujung);
    const arah = vB.copy(ujung).sub(tangan), pj = arah.length(); arah.normalize();
    a.tusuk.position.copy(tangan).addScaledVector(arah, 0.375); a.tusuk.quaternion.setFromUnitVectors(vC.set(0, 1, 0), arah);
    a.marshmallow.position.copy(tangan).addScaledVector(arah, Math.min(pj, 0.72)); a.marshmallow.quaternion.copy(a.tusuk.quaternion);
    a.mm.color.copy(warnaMarsh(a.mt));
    bar([[0.55 / 1.25, 0.8 / 1.25, 'ak-zona'], [0.45 / 1.25, 0.55 / 1.25, 'ak-zona2'], [0.8 / 1.25, 0.95 / 1.25, 'ak-zona2']], a.mt / 1.25, 1 / 1.25);
    desis(0.15 + 0.5 * a.ujung);
    if (a.mt > 0.95 && Math.random() < dt * 12) percik(a.marshmallow.position.clone(), 2, 0xff9a3a, 0.35);
    teks(a.mt > 0.95 ? T('Terbakar! Angkat!', 'It caught fire! Take it out!') : a.mt >= 0.55 && a.mt <= 0.8 ? T('Keemasan — angkat sekarang!', 'Golden — take it out now!') : '');
    if (a.mt > 1.25) angkatMarsh(a);
  }
  function angkatMarsh(a) {
    if (a.tahap !== 'bakar') return;
    const x = a.mt, mutu = x > 0.95 ? 'gosong' : x < 0.45 ? 'mentah' : x >= 0.55 && x <= 0.8 ? 'sempurna' : 'enak';
    const nama = T('Marshmallow bakar', 'Toasted marshmallow');
    TAS.masakan.push({ nama, mutu }); TAS.masakan = TAS.masakan.slice(-30); simpanTas(); desis(0);
    kartu(mutu === 'sempurna' ? '🌟' : mutu === 'gosong' ? '🔥' : '🍡', nama + ' — ' + { sempurna: T('Keemasan sempurna!', 'Perfectly golden!'), enak: T('Enak', 'Tasty'), mentah: T('Masih putih…', 'Still pale…'), gosong: T('Gosong…', 'Burnt…') }[mutu]);
    BUNYI[mutu === 'sempurna' || mutu === 'enak' ? 'dapat' : 'meleset']();
    if (mutu === 'sempurna' || mutu === 'enak') bonus(mutu === 'sempurna' ? 5 : 3, T('bakar marshmallow bareng', 'toasting marshmallows together'));
    a.tahap = 'jeda'; a.marshmallow.visible = false;
    setTimeout(() => { if (A !== a) return; a.mt = 0; a.ujung = 0; a.marshmallow.visible = true; a.tahap = 'bakar'; teks(''); }, 2000);
  }

  /* =================== MANCING =================== */
  const IKAN = [
    { k: 'nila', n: ['Ikan Nila', 'Tilapia'], b: [0.2, 1.2], kuat: 0.45, p: 30, w: 0x8a9aa0 }, { k: 'lele', n: ['Ikan Lele', 'Catfish'], b: [0.3, 2.4], kuat: 0.7, p: 18, w: 0x4a4038, malam: 2.2 },
    { k: 'mas', n: ['Ikan Mas', 'Carp'], b: [0.4, 3], kuat: 0.6, p: 20, w: 0xd9a03c }, { k: 'gurame', n: ['Ikan Gurame', 'Gourami'], b: [0.5, 3.5], kuat: 0.66, p: 12, w: 0x9c8a6a },
    { k: 'patin', n: ['Ikan Patin', 'Pangasius'], b: [0.8, 5], kuat: 0.85, p: 8, w: 0xb8bcc4 }, { k: 'koi', n: ['Ikan Koi', 'Koi'], b: [0.5, 4], kuat: 0.55, p: 4, w: 0xf06a2a },
    { k: 'sepatu', n: ['Sepatu bekas', 'An old boot'], b: [0.6, 0.6], kuat: 0.25, p: 4, w: 0x3a2e24, sampah: true }];
  function pilihIkan() {
    const malam = typeof MOOD !== 'undefined' && (MOOD === 'malam' || MOOD === 'gelap'), daf = IKAN.map(f => [f, f.p * (malam && f.malam ? f.malam : 1)]);
    let x = Math.random() * daf.reduce((s, [, p]) => s + p, 0); for (const [f, p] of daf) { x -= p; if (x <= 0) return f; } return IKAN[0];
  }
  function joran() {
    const g = new THREE.Group(), gelap = bahan(0x1d1f22, 0.5, 0.3), gabus = bahan(0x9a7a52, 0.9), logam = bahan(0xb8bcc4, 0.3, 0.9);
    const pegangan = silinder(0.016, 0.02, 0.32, gabus); pegangan.position.y = -0.1; g.add(pegangan);
    const gulung = silinder(0.045, 0.045, 0.05, logam, 16); gulung.rotation.z = Math.PI / 2; gulung.position.set(0, 0.0, 0.05); g.add(gulung);
    const tuas = kotak(0.008, 0.07, 0.008, logam); tuas.position.set(0.035, 0.0, 0.05); g.add(tuas); g.userData.tuas = tuas;
    // batang lentur: 4 ruas berantai (tiap ruas anak ruas sebelumnya) sehingga bisa melengkung
    let induk = g, y0 = 0.06; const ruas = [];
    for (let i = 0; i < 4; i++) { const r = new THREE.Group(); r.position.y = y0; induk.add(r); const b = silinder(0.011 - i * 0.0022, 0.013 - i * 0.0022, 0.42, gelap, 6); b.position.y = 0.21; r.add(b); ruas.push(r); induk = r; y0 = 0.42; }
    const ujung = new THREE.Object3D(); ujung.position.y = 0.42; induk.add(ujung);
    g.userData.ruas = ruas; g.userData.ujung = ujung; return g;
  }
  function mulaiMancing(t) {
    const o = cariObjek(t.id); if (!o || o.kind !== 'area') return;
    const a = mulai('mancing', t); if (!a) return;
    hud(T('🎣 Mancing', '🎣 Fishing'), T('Tahan tombol untuk melempar · lepaskan', 'Hold the button to cast · release'));
    a.poli = areaDunia(o); a.airY = t.titik ? t.titik.y : camera.position.y - 1.5; a.tahap = 'siap'; a.kuat = 0; a.tangkap = 0;
    a.alat = joran(); a.alat.userData.noExport = true; scene.add(a.alat);
    a.pelampung = new THREE.Group(); const at = bola(0.035, bahan(0xe03a2a, 0.4)), bw = bola(0.033, bahan(0xf4f4f4, 0.4)); at.position.y = 0.012; bw.position.y = -0.012; a.pelampung.add(at, bw); a.pelampung.visible = false; a.props.add(a.pelampung);
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(16 * 3), 3));
    a.tali = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xe8e8e8, transparent: true, opacity: 0.8 })); a.tali.frustumCulled = false; a.tali.visible = false; a.props.add(a.tali);
    a.lihat = new THREE.Vector3(t.titik ? t.titik.x : camera.position.x, a.airY, t.titik ? t.titik.z : camera.position.z);
    tombol(T('Lempar', 'Cast'));
    if (window.NPC) { const f = new THREE.Vector3(Math.sin(FPS.yaw), 0, Math.cos(FPS.yaw)), k = new THREE.Vector3(-Math.cos(FPS.yaw), 0, Math.sin(FPS.yaw));
      window.NPC.temani({ x: camera.position.x + k.x * 1.1 - f.x * 0.3, z: camera.position.z + k.z * 1.1 - f.z * 0.3 }, a.lihat, 2); }
    a.tekan = k => { if (k !== 1) return;
      if (a.tahap === 'siap') { a.tahap = 'isi'; a.kuat = 0; a.naik = 1; }
      else if (a.tahap === 'gigit') { a.tahap = 'tarik'; a.T = 0.35; a.lambat = 0; a.lebih = 0; a.jarak = a.jarakAwal; a.ledak = 0; teks(T('Kena! Gulung!', 'Hooked! Reel in!')); BUNYI.klik(); tombol(T('Gulung', 'Reel')); try { navigator.vibrate && navigator.vibrate(60); } catch (e) { /* abaikan */ } }
      else if (a.tahap === 'tunggu') { a.salah = (a.salah || 0) + 1; teks(T('Sabar… tunggu pelampungnya tenggelam', 'Patience… wait for the float to dip')); } };
    a.lepas = k => { if (k === 1 && a.tahap === 'isi') lempar(a, a.kuat); };
    a.langkah = dt => langkahMancing(a, dt);
  }
  function titikLempar(a, kuat) {
    const f = { x: Math.sin(FPS.yaw), z: Math.cos(FPS.yaw) }, D = 1.5 + kuat * 9;
    for (let d = D; d > 0.6; d -= 0.15) { const x = camera.position.x + f.x * d, z = camera.position.z + f.z * d; if (pointInPoly(x, z, a.poli)) return new THREE.Vector3(x, a.airY, z); }
    return a.titik ? a.titik.clone().setY(a.airY) : null;
  }
  function lempar(a, kuat) {
    const p = titikLempar(a, kuat);
    if (!p) { teks(T('Arahkan ke air kolam', 'Aim at the pond water')); a.tahap = 'siap'; return; }
    a.tahap = 'terbang'; a.tt = 0; a.dari = a.alat.userData.ujung.getWorldPosition(new THREE.Vector3()); a.ke = p; a.pelampung.visible = true; a.tali.visible = true;
    a.jarakAwal = Math.hypot(p.x - camera.position.x, p.z - camera.position.z); a.lihat.copy(p);
    teks(''); BUNYI.klik();
  }
  function langkahMancing(a, dt) {
    lihatKe(a.lihat, dt, 3);
    // joran di tangan kanan, melengkung menurut tegangan
    const ten = a.tahap === 'tarik' ? a.T : a.tahap === 'isi' ? -a.kuat * 0.6 : 0;
    // orang ketiga (JEV-134): joran di tangan kanan avatar, condong ke depan-atas ke arah air (ditarik ke belakang saat mengisi)
    const O3 = window.ORANG3 && window.ORANG3.aktif() && window.ORANG3.tangan ? window.ORANG3.tangan() : null;
    if (O3) {
      const fy = Math.atan2(a.lihat.x - camera.position.x, a.lihat.z - camera.position.z), naik = 0.75 + (a.tahap === 'isi' ? a.kuat * 0.65 : 0);
      a.alat.position.copy(O3).setY(O3.y + 0.08);
      a.alat.quaternion.setFromUnitVectors(vB.set(0, 1, 0), vC.set(Math.sin(fy) * Math.cos(naik), Math.sin(naik), Math.cos(fy) * Math.cos(naik)));
    } else {
      tempelKamera(a.alat, 0.24, -0.3, -0.45);
      a.alat.quaternion.multiply(qA.setFromEuler(new THREE.Euler(-0.95 - (a.tahap === 'isi' ? a.kuat * 0.6 : 0), 0.12, -0.15)));
    }
    a.alat.userData.ruas.forEach((r, i) => { r.rotation.x = clamp(ten, -0.5, 1.2) * 0.18 * (i + 1); });
    a.alat.userData.tuas.rotation.x = TEKAN[1] && a.tahap === 'tarik' ? performance.now() / 60 : 0;
    const ujung = a.alat.userData.ujung.getWorldPosition(vA);
    if (a.tahap === 'isi') { a.kuat += a.naik * dt / 1.1; if (a.kuat >= 1) { a.kuat = 1; a.naik = -1; } if (a.kuat <= 0) { a.kuat = 0; a.naik = 1; }
      meter(a.kuat, T('kekuatan', 'power'), 1.5 + a.kuat * 9); teks(T('Lepaskan untuk melempar', 'Release to cast')); }
    else if (a.tahap === 'siap') H.meter.hidden = true;
    if (a.tahap === 'terbang') {
      a.tt += dt / 0.7; const k = Math.min(1, a.tt); a.pelampung.position.lerpVectors(a.dari, a.ke, k); a.pelampung.position.y += Math.sin(k * Math.PI) * 1.2;
      if (k >= 1) { a.tahap = 'tunggu'; a.tunggu = acak(2.2, 7) * (a.salah ? 1.2 : 1); a.t = 0; percik(a.ke, 10); BUNYI.cebur(); teks(T('Tunggu umpan dimakan…', 'Wait for a bite…')); H.meter.hidden = true; }
    } else if (a.tahap === 'tunggu' || a.tahap === 'gigit' || a.tahap === 'lepas') {
      a.t += dt; const p = a.pelampung.position; p.copy(a.ke); p.y = a.airY + 0.01 + Math.sin(a.t * 2.4) * 0.006;
      if (a.tahap === 'tunggu') { if (Math.random() < dt * 0.6) p.y -= 0.012;                    // sentuhan kecil
        if (a.t > a.tunggu) { a.tahap = 'gigit'; a.t = 0; a.ikan = pilihIkan(); percik(a.ke, 14); BUNYI.cebur(); teks(T('Sambar! (tekan)', 'Strike! (press)')); tombol(T('Sambar', 'Strike')); try { navigator.vibrate && navigator.vibrate([40, 40, 40]); } catch (e) { /* abaikan */ } } }
      else if (a.tahap === 'gigit') { p.y = a.airY - 0.05; if (a.t > 1.15) { a.tahap = 'lepas'; a.t = 0; teks(T('Umpannya dimakan, ikan lepas…', 'It stole the bait…')); } }
      else if (a.t > 1.6) { a.tahap = 'tunggu'; a.tunggu = acak(2.5, 7); a.t = 0; tombol(T('Tunggu', 'Wait')); teks(T('Tunggu umpan dimakan…', 'Wait for a bite…')); }
    } else if (a.tahap === 'tarik') langkahTarik(a, dt);
    else if (a.tahap === 'hasil') { a.t += dt; if (a.ikanMesh) { tempelKamera(a.ikanMesh, 0, -0.05, -0.65); a.ikanMesh.rotateY(a.t * 2); } if (a.t > 2.4) siapLagi(a); }
    // tali melengkung dari ujung joran ke pelampung (kendur bila tegangan rendah)
    if (a.tali.visible) { const pos = a.tali.geometry.attributes.position, q = a.pelampung.position, kendur = a.tahap === 'tarik' ? (1 - clamp(a.T, 0, 1)) * 0.4 : 0.35;
      for (let i = 0; i < 16; i++) { const k = i / 15; pos.setXYZ(i, ujung.x + (q.x - ujung.x) * k, ujung.y + (q.y - ujung.y) * k - Math.sin(k * Math.PI) * kendur * Math.min(1, a.jarakAwal / 4 || 1), ujung.z + (q.z - ujung.z) * k); }
      pos.needsUpdate = true; }
  }
  function langkahTarik(a, dt) {
    const f = a.ikan; a.t += dt;
    a.ledak -= dt; if (a.ledak < -acak(1.5, 3.5)) a.ledak = acak(0.6, 1.4);                       // ikan sesekali menyentak
    const tarik = f.kuat * (0.35 + 0.35 * (0.5 + 0.5 * Math.sin(a.t * 1.7)) + (a.ledak > 0 ? 0.55 : 0));
    if (TEKAN[1]) { a.T += (tarik * 1.15 + 0.22 - a.T) * dt * 2.4; a.jarak -= dt * 1.5 * (1 - clamp(a.T, 0, 1) * 0.45) * (f.sampah ? 1.4 : 1); if (Math.random() < dt * 14) BUNYI.klik(); }
    else { a.T += (tarik * 0.42 - a.T) * dt * 2.6; a.jarak += dt * tarik * 0.8; }
    a.T = clamp(a.T, 0, 1.2);
    a.lebih = a.T > 0.97 ? a.lebih + dt : Math.max(0, a.lebih - dt * 2); a.lambat = a.T < 0.1 ? a.lambat + dt : 0;
    // pelampung mendekat sepanjang garis ke pemain, bergoyang ke samping saat ikan melawan
    const k = clamp(a.jarak / a.jarakAwal, 0, 1.3), sx = Math.sin(a.t * 3.1) * 0.25 * f.kuat * k;
    const px = camera.position.x + (a.ke.x - camera.position.x) * k + Math.cos(FPS.yaw) * sx, pz = camera.position.z + (a.ke.z - camera.position.z) * k - Math.sin(FPS.yaw) * sx;
    a.pelampung.position.set(px, a.airY - 0.03, pz); a.lihat.set(px, a.airY, pz);
    if (Math.random() < dt * 3 * f.kuat) percik(a.pelampung.position, 5);
    meter(a.T, a.T > 0.8 ? T('tegangan tinggi', 'high tension') : TEKAN[1] ? T('gulung', 'reel-in') : T('kendur', 'slack'), Math.max(0, a.jarak));
    teks(a.T > 0.85 ? T('Kendurkan!', 'Ease off!') : a.T < 0.18 ? T('Gulung! Jaga tegangan!', 'Reel! Keep tension!') : '');
    if (a.lebih > 0.4) return gagal(a, T('Talinya putus!', 'The line snapped!'), 'putus');
    if (a.lambat > 2.2 || a.jarak > a.jarakAwal + 4) return gagal(a, T('Ikannya kabur…', 'It got away…'), 'kabur');
    if (a.jarak <= 0.6) dapat(a);
  }
  function gagal(a, t, b) { BUNYI[b === 'putus' ? 'putus' : 'meleset'](); a.tahap = 'hasil'; a.t = 0.6; teks(t); H.meter.hidden = true; a.pelampung.visible = b !== 'putus'; a.tali.visible = b !== 'putus'; }
  function dapat(a) {
    const f = a.ikan, berat = Math.round(acak(f.b[0], f.b[1]) * 10) / 10, nama = f.n[BAHASA.kode === 'id' ? 0 : 1];
    a.tahap = 'hasil'; a.t = 0; H.meter.hidden = true; teks(''); BUNYI.dapat(); percik(a.pelampung.position, 24);
    a.pelampung.visible = false; a.tali.visible = false; a.tangkap++;
    a.ikanMesh = ikanMesh(f.w); a.ikanMesh.scale.setScalar(f.sampah ? 0.5 : 0.35 + berat * 0.08); a.props.add(a.ikanMesh);
    if (f.sampah) { kartu('🥾', T('Yah… dapat sepatu bekas', 'Oh… an old boot')); return; }
    TAS.ikan.push({ nama: nama + ' ' + berat + ' kg', berat }); TAS.ikan = TAS.ikan.slice(-30); simpanTas();
    kartu('🐟', T(`Dapat ${nama} ${berat} kg!`, `Caught a ${nama}, ${berat} kg!`));
    bonus(f.k === 'koi' ? 7 : 4, T('mancing bareng', 'fishing together'));
  }
  function siapLagi(a) { if (a.ikanMesh) { bersih(a.ikanMesh); a.ikanMesh = null; } a.tahap = 'siap'; a.pelampung.visible = false; a.tali.visible = false; tombol(T('Lempar', 'Cast')); teks(''); a.lihat.copy(a.ke || a.lihat); }

  /* =================== POTONG KAYU =================== */
  function kapak() {
    const g = new THREE.Group(), p = new THREE.Group(); g.add(p);
    const gagang = silinder(0.018, 0.022, 0.7, bahan(0x8a6238, 0.8)); gagang.position.y = 0.35; p.add(gagang);
    const mata = kotak(0.025, 0.12, 0.17, bahan(0x9aa0a8, 0.35, 0.85)); mata.position.set(0, 0.66, 0.06); p.add(mata);
    g.userData.ayun = p; return g;
  }
  function grupObjek(id) { for (const lg of levelGroups) { const g = lg && lg.children.find(c => c.userData.kind === 'obj' && c.userData.id === id); if (g) return g; } return null; }
  function mulaiPotong(t) {
    const g = grupObjek(t.id); if (!g) return;
    const a = mulai('potong', t); if (!a) return;
    hud(T('🪓 Potong kayu', '🪓 Chop firewood'), T('Ayun saat penanda di zona hijau', 'Swing when the marker is in the green'));
    g.updateMatrixWorld(true); a.stump = g; a.atas = g.localToWorld(new THREE.Vector3(0, 0.45, 0));
    const asli = g.getObjectByName('kayu'); if (asli) { asli.visible = false; a.akhir = () => { asli.visible = true; }; }
    a.lihat = a.atas.clone().setY(a.atas.y + 0.15); a.alat = kapak(); a.alat.userData.noExport = true; scene.add(a.alat);
    a.n = 0; a.belah = 0; a.m = 0; a.v = 0.85; a.ayun = -1; zonaBaru(a); kayuBaru(a); tombol(T('Ayun', 'Swing'));
    if (window.NPC) window.NPC.temani({ x: a.atas.x + 1.4, z: a.atas.z + 0.6 }, a.atas, 0);
    a.tekan = k => { if (k === 1 && a.ayun < 0 && a.log) { a.ayun = 0; a.kena = false; } };
    a.langkah = dt => langkahPotong(a, dt);
  }
  function zonaBaru(a) { const w = Math.max(0.09, 0.24 - a.belah * 0.03); a.zona = [acak(0.18, 0.82 - w), 0]; a.zona[1] = a.zona[0] + w; }
  function kayuBaru(a) {
    const m = bahan(0xa4743e, 0.85), log = new THREE.Group(), k = silinder(0.12, 0.12, 0.38, m, 14); log.add(k);
    const ujung = silinder(0.115, 0.115, 0.005, bahan(0xd9b98a, 0.9), 14); ujung.position.y = 0.192; log.add(ujung);
    log.position.copy(a.atas).setY(a.atas.y + 0.19); a.props.add(log); a.log = log;
  }
  function belah(a) {
    const log = a.log; a.log = null; a.props.remove(log); bersih(log);
    const m = bahan(0xa4743e, 0.85);
    a.potong = [-1, 1].map(s => { const geo = new THREE.CylinderGeometry(0.12, 0.12, 0.38, 10, 1, false, s > 0 ? 0 : Math.PI, Math.PI), x = new THREE.Mesh(geo, m);
      x.userData.noExport = true; x.raycast = () => {}; x.position.copy(a.atas).setY(a.atas.y + 0.19); a.props.add(x);
      const kanan = new THREE.Vector3(-Math.cos(FPS.yaw), 0, Math.sin(FPS.yaw)).multiplyScalar(s); return { x, v: new THREE.Vector3(kanan.x * 1.6, 2.2, kanan.z * 1.6), r: s * 4 }; });
    a.potongT = 0;
  }
  function langkahPotong(a, dt) {
    lihatKe(a.lihat, dt, 4);
    // penanda bolak-balik
    a.m += a.v * dt * (a.arah || 1); if (a.m >= 1) { a.m = 1; a.arah = -1; } if (a.m <= 0) { a.m = 0; a.arah = 1; }
    bar([[a.zona[0], a.zona[1], 'ak-zona']], a.m);
    // kapak: siaga terangkat → ayun ke bawah 0,22 dtk → kembali
    tempelKamera(a.alat, 0.2, -0.42, -0.55);
    let sudut = 0.15;
    if (a.ayun >= 0) { a.ayun += dt; const k = a.ayun / 0.22; sudut = k < 1 ? 0.15 + 1.1 * k * k : k < 2.2 ? 1.25 - 1.1 * (k - 1) / 1.2 : 0.15;
      if (!a.kena && k >= 1) { a.kena = true; nilaiAyun(a); }
      if (k >= 2.2) a.ayun = -1; }
    a.alat.quaternion.multiply(qA.setFromEuler(new THREE.Euler(-0.2, 0.1, 0))); a.alat.userData.ayun.rotation.x = -sudut;
    if (a.potong) { a.potongT += dt; for (const p of a.potong) { p.v.y -= 9 * dt; p.x.position.addScaledVector(p.v, dt); p.x.rotation.z += p.r * dt; if (p.x.position.y < a.atas.y - 0.42) { p.x.position.y = a.atas.y - 0.42; p.v.set(0, 0, 0); p.r = 0; } }
      if (a.potongT > 1.2) { for (const p of a.potong) { a.props.remove(p.x); bersih(p.x); } a.potong = null; if (a.n < 6) kayuBaru(a); } }
  }
  function nilaiAyun(a) {
    const di = a.m >= a.zona[0] && a.m <= a.zona[1];
    if (!a.log) return;
    if (di) { a.n++; a.belah++; TAS.kayu += 2; simpanTas(); BUNYI.kapak(); percik(a.atas.clone().setY(a.atas.y + 0.3), 12, 0xd9b98a, 1.2); belah(a); teks(T('Belah! +2 kayu', 'Split! +2 logs')); a.v += 0.15; zonaBaru(a); }
    else { a.n++; BUNYI.meleset(); teks(T('Meleset!', 'Missed!')); a.v += 0.05; if (a.n >= 6) { a.props.remove(a.log); bersih(a.log); a.log = null; } }
    if (a.n >= 6) setTimeout(() => { if (A !== a) return; kartu('🪵', T(`${a.belah * 2} kayu bakar terkumpul (tas: ${TAS.kayu})`, `${a.belah * 2} firewood collected (bag: ${TAS.kayu})`)); if (a.belah >= 3) bonus(4, T('kerja bareng', 'working together')); setTimeout(() => { if (A === a) selesai(); }, 2200); }, 900);
  }

  /* =================== PANGGANG / MASAK =================== */
  const BAHAN = {
    ikan: { n: ['Ikan bakar', 'Grilled fish'], goreng: ['Ikan goreng', 'Fried fish'], w: 0xb8b0a0 }, jagung: { n: ['Jagung bakar', 'Grilled corn'], w: 0xf2cf4a },
    sate: { n: ['Sate', 'Satay'], w: 0xd99a8a }, sosis: { n: ['Sosis bakar', 'Grilled sausage'], w: 0xe08a7a }, telur: { n: ['Telur dadar', 'Omelette'], w: 0xf6e7a8 } };
  function makananMesh(k) {
    const g = new THREE.Group(), m = bahan(BAHAN[k].w, 0.6); g.userData.m = m;
    if (k === 'ikan') { const f = ikanMesh(BAHAN.ikan.w); f.rotation.z = Math.PI / 2; f.scale.setScalar(0.5); f.traverse(x => { if (x.isMesh && x.material.color.getHex() !== 0x111111) x.material = m; }); g.add(f); }
    else if (k === 'jagung') { const c = silinder(0.035, 0.035, 0.2, m, 12); c.rotation.z = Math.PI / 2; g.add(c); }
    else if (k === 'sate') { for (let i = 0; i < 3; i++) { const b = kotak(0.035, 0.035, 0.035, m); b.position.x = -0.05 + i * 0.05; g.add(b); } const tusuk = silinder(0.003, 0.003, 0.26, bahan(0xc9a36a), 4); tusuk.rotation.z = Math.PI / 2; g.add(tusuk); }
    else if (k === 'sosis') { const c = silinder(0.02, 0.02, 0.14, m, 10); c.rotation.z = Math.PI / 2; g.add(c); const u1 = bola(0.02, m), u2 = bola(0.02, m); u1.position.x = 0.07; u2.position.x = -0.07; g.add(u1, u2); }
    else { const c = silinder(0.08, 0.08, 0.012, m, 20); g.add(c); }
    return g;
  }
  function mulaiMasak(t, dapur) {
    const g = grupObjek(t.id); if (!g) return;
    if (!dapur && TAS.kayu < 1) { toast(T('Butuh kayu bakar — potong kayu di tunggul kayu dulu', 'You need firewood — chop some at a chopping stump first')); return; }
    const a = mulai(dapur ? 'masak' : 'panggang', t); if (!a) return;
    g.updateMatrixWorld(true);
    if (dapur) { const bb = new THREE.Box3().setFromObject(g), hit = t.titik || bb.getCenter(new THREE.Vector3()); a.atas = new THREE.Vector3(hit.x, bb.max.y > 1.2 ? Math.min(bb.max.y, 0.95 + g.getWorldPosition(vB).y) : bb.max.y, hit.z); }
    else a.atas = g.localToWorld(new THREE.Vector3(0, 0.95, 0));
    a.dapur = dapur; a.lihat = a.atas.clone();
    if (dapur) { const wajan = silinder(0.15, 0.12, 0.04, bahan(0x2a2a2c, 0.4, 0.6), 20); wajan.position.copy(a.atas).setY(a.atas.y + 0.02); a.props.add(wajan); a.dasar = a.atas.y + 0.05; }
    else { a.dasar = a.atas.y + 0.03; TAS.kayu--; simpanTas(); }
    hud(dapur ? T('🍳 Masak', '🍳 Cook') : T('🍢 Panggang', '🍢 Grill'), T('Balik saat sisi bawah matang · angkat sebelum gosong', 'Flip when the bottom is done · take it off before it burns'));
    if (window.NPC) window.NPC.temani({ x: a.atas.x + 1.2, z: a.atas.z + 0.5 }, a.atas, 0);
    pilihBahan(a);
    a.tekan = k => { if (a.tahap !== 'masak') return; if (k === 1) balik(a); else if (k === 2) angkatMakanan(a); };
    a.langkah = dt => langkahMasak(a, dt);
  }
  function pilihBahan(a) {
    a.tahap = 'pilih'; H.pilihan.textContent = ''; H.bar.hidden = true; tombol(T('Balik', 'Flip')); H.b1.hidden = true; H.b2.hidden = true;
    teks(T('Pilih bahan', 'Pick an ingredient'));
    const daf = [];
    TAS.ikan.slice(-3).forEach((x, i) => daf.push(['ikan', '🐟 ' + x.nama, TAS.ikan.length - Math.min(3, TAS.ikan.length) + i]));
    for (const k of a.dapur ? ['telur'] : ['jagung', 'sate', 'sosis']) daf.push([k, ({ jagung: '🌽 ', sate: '🍢 ', sosis: '🌭 ', telur: '🥚 ' })[k] + BAHAN[k].n[BAHASA.kode === 'id' ? 0 : 1].replace(/ bakar| dadar|Grilled |Omelette/g, '').trim() || k, -1]);
    for (const [k, l, i] of daf) { const b = el('button', 'btn sm', l); b.dataset.bahan = k; b.onclick = () => mulaiMasakan(a, k, i); H.pilihan.appendChild(b); }
  }
  function mulaiMasakan(a, k, i) {
    if (k === 'ikan' && i >= 0) { const f = TAS.ikan[i]; if (!f) return; TAS.ikan.splice(i, 1); simpanTas(); }
    H.pilihan.textContent = ''; teks(''); H.b1.hidden = false; tombol(T('Balik', 'Flip'), T('Angkat', 'Serve'));
    a.tahap = 'masak'; a.bahan = k; a.sisi = [0, 0]; a.bawah = 0; a.balikT = -1; a.panas = acak(0.1, 0.13) * (a.dapur ? 1.15 : 1);
    a.makan = makananMesh(k); a.makan.position.copy(a.atas).setY(a.dasar); a.props.add(a.makan);
  }
  function balik(a) { if (a.balikT >= 0) return; a.balikT = 0; a.bawah = 1 - a.bawah; BUNYI.klik(); }
  const warnaMatang = (dasar, x) => { const c = new THREE.Color(dasar); if (x < 1) return c.lerp(new THREE.Color(0x7a4a22), clamp((x - 0.25) / 0.75, 0, 1) * 0.75); return new THREE.Color(0x7a4a22).lerp(new THREE.Color(0x1a1410), clamp((x - 1) / 0.35, 0, 1)); };
  function langkahMasak(a, dt) {
    lihatKe(a.lihat, dt, 4);
    if (a.tahap !== 'masak') { desis(0); return; }
    const s = a.bawah; a.sisi[s] += a.panas * dt * (0.85 + 0.3 * Math.sin(a.t * 0.7)); a.t += dt;
    const x = a.sisi[s]; bar([[0.62 / 1.35, 0.8 / 1.35, 'ak-zona'], [0.55 / 1.35, 0.62 / 1.35, 'ak-zona2'], [0.8 / 1.35, 0.95 / 1.35, 'ak-zona2']], x / 1.35, 1 / 1.35);
    desis(0.4 + x * 0.6);
    // warna sisi atas yang terlihat; balik = putar 180°
    a.makan.userData.m.color.copy(warnaMatang(BAHAN[a.bahan].w, a.sisi[1 - a.bawah]));
    if (a.balikT >= 0) { a.balikT += dt / 0.4; const k = Math.min(1, a.balikT); a.makan.position.y = a.dasar + Math.sin(k * Math.PI) * 0.12; a.makan.rotation.x = (a.bawah ? 0 : Math.PI) + k * Math.PI; if (k >= 1) { a.balikT = -1; a.makan.rotation.x = a.bawah ? Math.PI : 0; } }
    if (Math.random() < dt * (2 + x * 8)) percik(a.makan.position.clone().setY(a.dasar + 0.04), 2, x > 1 ? 0x333333 : 0xdddddd, 0.4);
    teks(x > 1.05 ? T('Gosong! Angkat!', 'Burning! Take it off!') : x > 0.62 && x < 0.8 ? T('Pas — balik atau angkat', 'Just right — flip or serve') : '');
    if (x > 1.35) angkatMakanan(a);
  }
  function angkatMakanan(a) {
    if (a.tahap !== 'masak') return;
    const [p, q] = a.sisi, pas = v => v >= 0.62 && v <= 0.8, oke = v => v >= 0.55 && v <= 0.95;
    const mutu = p > 1 || q > 1 ? 'gosong' : p < 0.5 || q < 0.5 ? 'mentah' : pas(p) && pas(q) ? 'sempurna' : oke(p) && oke(q) ? 'enak' : 'enak';
    const B0 = BAHAN[a.bahan], nama = (a.dapur && B0.goreng ? B0.goreng : B0.n)[BAHASA.kode === 'id' ? 0 : 1];
    TAS.masakan.push({ nama, mutu }); TAS.masakan = TAS.masakan.slice(-30); simpanTas(); desis(0);
    const label = { sempurna: T('Sempurna!', 'Perfect!'), enak: T('Enak', 'Tasty'), mentah: T('Masih mentah…', 'Still raw…'), gosong: T('Gosong…', 'Burnt…') }[mutu];
    kartu(mutu === 'sempurna' ? '🌟' : mutu === 'gosong' ? '🔥' : '🍽️', nama + ' — ' + label);
    BUNYI[mutu === 'sempurna' || mutu === 'enak' ? 'dapat' : 'meleset']();
    if (mutu === 'sempurna' || mutu === 'enak') bonus(mutu === 'sempurna' ? 6 : 4, T('masak bareng', 'cooking together'));
    a.props.remove(a.makan); bersih(a.makan); a.makan = null; a.tahap = 'jeda';
    setTimeout(() => { if (A !== a) return; if (!a.dapur && TAS.kayu < 1) { teks(T('Kayu bakar habis', 'Out of firewood')); setTimeout(() => { if (A === a) selesai(); }, 1500); return; } if (!a.dapur) { TAS.kayu--; simpanTas(); } pilihBahan(a); }, 2400);
  }

  /* =================== ANGKAT & TARUH =================== */
  function angkat(t) {
    const o = cariObjek(t.id); if (!o || o.kind !== 'furn') return;
    if (A) selesai(); if (B) taruh();
    const li = PROJECT.levels.findIndex(l => l.objects.includes(o)); if (li < 0) return;
    B = { id: o.id, li, nama: (FURN[o.type] || {}).l || o.type };
    FPS.gaya = { k: 'bawa', x: camera.position.x, z: camera.position.z, t: performance.now() };
    toast(T('📦 Membawa ', '📦 Carrying ') + B.nama + T(' — bidik tempat lalu Taruh', ' — aim at a spot, then Place'));
  }
  const ray = new THREE.Raycaster();
  function titikTaruh(g) {
    ray.setFromCamera({ x: 0, y: 0 }, camera); ray.far = 3.5;
    for (const h of ray.intersectObject(worldRoot, true)) {
      let x = h.object, milik = false; while (x) { if (x === g) { milik = true; break; } x = x.parent; }
      if (milik || h.object.userData.noExport || !h.face) continue;
      const n = h.face.normal.clone().transformDirection(h.object.matrixWorld); if (n.y < 0.6) continue;
      return h.point;
    }
    return new THREE.Vector3(camera.position.x + Math.sin(FPS.yaw) * 1.1, FPS.feet, camera.position.z + Math.cos(FPS.yaw) * 1.1);
  }
  function langkahBawa() {
    const g = grupObjek(B.id); if (!g) { B = null; FPS.gaya = null; return; }
    vC.set(camera.position.x + Math.sin(FPS.yaw) * 0.75, FPS.feet + 0.5, camera.position.z + Math.cos(FPS.yaw) * 0.75);
    g.parent.updateMatrixWorld(true); g.position.copy(g.parent.worldToLocal(vC.clone())); g.rotation.y = FPS.yaw + Math.PI;
  }
  function taruh() {
    if (!B) return null;
    const o = cariObjek(B.id), g = grupObjek(B.id), b = B; B = null; FPS.gaya = null;
    if (!o) return null;
    const p = titikTaruh(g);
    o.x = Math.round(p.x * 100) / 100; o.z = Math.round(p.z * 100) / 100; o.y = Math.round(clamp(p.y - levelElevation(b.li), 0, 3) * 100) / 100; o.rotY = FPS.yaw + Math.PI;
    HIST.label = T('Pindah ', 'Move ') + b.nama; rebuildScene();
    toast(T('Ditaruh: ', 'Placed: ') + b.nama);
    return { x: o.x, y: o.y, z: o.z };
  }

  /* ---------- per frame ---------- */
  function langkah(dt) {
    dt = Math.min(dt, 0.1);
    langkahPercik(dt); langkahApi(dt);
    if (B) { if (!FPS.on) B = null; else langkahBawa(); }
    if (!A) return;
    if (!FPS.on) { selesai(); return; }
    A.langkah(dt);
  }
  function pakai(t) {
    if (!FPS.on) return;
    if (t.jenis === 'taruh') return taruh();
    if (t.jenis === 'angkat') return angkat(t);
    if (t.jenis === 'mancing') return mulaiMancing(t);
    if (t.jenis === 'renang') return mulaiRenang(t);
    if (t.jenis === 'potong') return mulaiPotong(t);
    if (t.jenis === 'panggang') return mulaiMasak(t, false);
    if (t.jenis === 'masak') return mulaiMasak(t, true);
    if (t.jenis === 'ambilkayu') return ambilKayu(t);
    if (t.jenis === 'kayu') return tambahKayu(t);
    if (t.jenis === 'hangat') return mulaiHangat(t, false);
    if (t.jenis === 'marshmallow') return mulaiHangat(t, true);
  }
  window.AKT = { pakai, langkah, selesai, kunci: () => !!A, membawa: () => !!B, tas: () => JSON.parse(JSON.stringify(TAS)), ambil,
    renang: () => !!A && A.jenis === 'renang', dicipratkan, besarkanApi,
    // geometri kolam untuk NPC (modul/npc.js): tepi terdekat, titik di dalam, permukaan air; cebur = suara + percikan
    kolam: { tepi: tepiKolam, keDalam, dalam: dalamKolam, air: airKolam, cebur: p => { BUNYI.cebur(); percik(p, 30, 0xe8f6ff, 1.2); } },
    _uji: { A: () => A, tekan, lempar: k => A && lempar(A, k), TAS: () => TAS, pilihIkan, dapat: () => A && dapat(A) } };
})();
