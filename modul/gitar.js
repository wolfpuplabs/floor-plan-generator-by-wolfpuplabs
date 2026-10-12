/* Plan23D — GITAR YANG BISA DIMAINKAN (JEV-099)
   Seperti piano: panel di bawah layar dengan akor (C, G, Am, F, D, Em, E, A, Dm), enam senar yang
   bisa dipetik satu-satu atau digenjreng dengan menyapu jari melintasinya, tombol genjreng ↓ / ↑,
   dan iringan otomatis (pola pop / balada / waltz, akor sendiri atau progresi C–G–Am–F). Bunyinya
   sintesis senar petik Karplus–Strong + resonansi badan gitar, datang dari posisi gitarnya di mode
   jalan. Satu senar hanya membunyikan satu not — petikan baru meredam not sebelumnya di senar itu.
   Keyboard: 1–9 akor · Spasi genjreng turun · B genjreng naik · Q W E R T Y petik senar · Esc tutup. */
/* global $, el, audioSiap, AUDIO, FPS, camera, titikGrup, isiIkon, toast, renderer */
(function () {
  'use strict';
  const TALA = [40, 45, 50, 55, 59, 64];                         // E2 A2 D3 G3 B3 E4 (stem standar)
  const NAMA_SENAR = ['E', 'A', 'D', 'G', 'B', 'e'];
  const AKOR = { C: [-1, 3, 2, 0, 1, 0], G: [3, 2, 0, 0, 0, 3], Am: [-1, 0, 2, 2, 1, 0], F: [1, 3, 3, 2, 1, 1], D: [-1, -1, 0, 2, 3, 2],
    Em: [0, 2, 2, 0, 0, 0], E: [0, 2, 2, 1, 0, 0], A: [-1, 0, 2, 2, 2, 0], Dm: [-1, -1, 0, 2, 3, 1] };
  const POLA = { pop: { l: 'Pop  ↓ ↓↑ ↑↓↑', k: 'D.DU.UDU', bpm: 92 }, balada: { l: 'Balada  ↓ ↓ ↓↑', k: 'D.D.D.DU', bpm: 76 }, waltz: { l: 'Waltz  ↓ ↓↑ ↓↑', k: 'D.DUDU', bpm: 96 } };
  const PROGRESI = ['C', 'G', 'Am', 'F'];
  const G = { n: 0, buka: false, grp: null, akor: 'C', bus: null, pan: null, senar: [], buf: new Map(), iring: null, sapu: new Map() };

  function siapkanSuara() {
    const ctx = audioSiap(); if (!ctx) return null;
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    if (!G.bus) {
      // badan gitar: dengung udara ±100 Hz & papan ±220 Hz, petikan dilunakkan di atas 5 kHz
      G.pan = ctx.createPanner(); G.pan.panningModel = 'HRTF'; G.pan.distanceModel = 'inverse'; G.pan.refDistance = 1.5; G.pan.rolloffFactor = 0.8;
      const f1 = ctx.createBiquadFilter(); f1.type = 'peaking'; f1.frequency.value = 100; f1.Q.value = 1.2; f1.gain.value = 6;
      const f2 = ctx.createBiquadFilter(); f2.type = 'peaking'; f2.frequency.value = 220; f2.Q.value = 1.4; f2.gain.value = 3;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
      G.bus = ctx.createGain(); G.bus.gain.value = 0.9;
      G.bus.connect(f1); f1.connect(f2); f2.connect(lp); lp.connect(G.pan); G.pan.connect(AUDIO.master);
      if (AUDIO.gema) { const k = ctx.createGain(); k.gain.value = 0.25; lp.connect(k); k.connect(AUDIO.gema); }
    }
    // di mode jalan suara datang dari gitarnya; di editor langsung di telinga
    const p = (FPS.on && G.grp && titikGrup(G.grp)) || camera.position;
    if (G.pan.positionX) { G.pan.positionX.value = p.x; G.pan.positionY.value = p.y; G.pan.positionZ.value = p.z; } else G.pan.setPosition(p.x, p.y, p.z);
    return ctx;
  }
  // senar petik Karplus–Strong: semburan derau berulang lewat tundaan sepanjang satu periode, dirata-rata (meluruh)
  function bufferNot(ctx, m) {
    if (G.buf.has(m)) return G.buf.get(m);
    const sr = ctx.sampleRate, f = 440 * Math.pow(2, (m - 69) / 12), N = Math.max(2, Math.round(sr / f));
    const len = Math.floor(sr * (m < 50 ? 3.2 : 2.4)), b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
    const luruh = 0.9965 - Math.min(0.004, f / 120000);          // senar tinggi meluruh lebih cepat
    let lalu = 0;
    for (let i = 0; i < N; i++) { lalu = lalu * 0.45 + (Math.random() * 2 - 1) * 0.55; d[i] = lalu; }
    for (let i = N; i < len; i++) d[i] = (d[i - N] + d[i - N - 1 >= 0 ? i - N - 1 : i - N]) * 0.5 * luruh;
    let rata = 0; for (let i = 0; i < len; i++) rata += d[i]; rata /= len;
    let puncak = 1e-6; for (let i = 0; i < len; i++) { d[i] -= rata; puncak = Math.max(puncak, Math.abs(d[i])); }
    for (let i = 0; i < len; i++) d[i] *= 0.8 / puncak;
    G.buf.set(m, b); return b;
  }
  function petik(s, fret, t, v) {
    const ctx = siapkanSuara(); if (!ctx || fret < 0) return;
    t = t || ctx.currentTime;
    const lama = G.senar[s];                                       // redam not sebelumnya di senar ini
    if (lama) { try { lama.g.gain.setTargetAtTime(0, t, 0.015); lama.src.stop(t + 0.1); } catch (e) { /* sudah berhenti */ } }
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = bufferNot(ctx, TALA[s] + fret); g.gain.value = v || 0.5;
    src.connect(g); g.connect(G.bus); src.start(t);
    G.senar[s] = { src, g }; G.n++;
    const ms = Math.max(0, (t - ctx.currentTime) * 1000);
    setTimeout(() => getar(s), ms);
  }
  function getar(s) { const e = document.querySelector(`#gitarSenar [data-s="${s}"]`); if (!e) return; e.classList.remove('getar'); void e.offsetWidth; e.classList.add('getar'); }
  // genjreng: turun = senar bas → treble, naik sebaliknya, ±14 ms antarsenar
  function genjreng(arah, t, v) {
    const ctx = siapkanSuara(); if (!ctx) return;
    const f = AKOR[G.akor], urut = arah === 'U' ? [5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5];
    t = t || ctx.currentTime; let k = 0;
    for (const s of urut) if (f[s] >= 0) petik(s, f[s], t + 0.014 * k++, (v || 0.5) * (arah === 'U' ? 0.75 : 1) * (0.85 + Math.random() * 0.3));
  }
  function pilihAkor(a) {
    if (!AKOR[a]) return; G.akor = a;
    document.querySelectorAll('#gitarAkor button').forEach(b => b.classList.toggle('on', b.dataset.a === a));
    document.querySelectorAll('#gitarSenar [data-s]').forEach(e => { const f = AKOR[a][+e.dataset.s]; e.dataset.fret = f < 0 ? '×' : f === 0 ? '○' : String(f); });
  }

  // iringan otomatis: dijadwalkan sedikit di depan (±0,3 detik) seperti lagu piano
  function hentikanIringan() {
    const I = G.iring; G.iring = null; if (I) clearInterval(I.timer);
    const b = $('#gitarIring'); if (b) isiIkon(b, 'main', 'Iringan');
  }
  function mulaiIringan() {
    hentikanIringan();
    const ctx = siapkanSuara(); if (!ctx) return;
    const P = POLA[$('#gitarPola').value] || POLA.pop, prog = $('#gitarProg').checked, ketuk = 60 / P.bpm / 2;
    const I = { i: 0, t: ctx.currentTime + 0.1, timer: 0 }; G.iring = I; isiIkon($('#gitarIring'), 'henti', 'Berhenti');
    const jadwal = () => {
      if (G.iring !== I) return;
      while (I.t < ctx.currentTime + 0.3) {
        const pos = I.i % P.k.length, c = P.k[pos];
        if (prog && pos === 0) { const a = PROGRESI[Math.floor(I.i / P.k.length) % PROGRESI.length]; const dt = Math.max(0, (I.t - ctx.currentTime) * 1000); setTimeout(() => { if (G.iring === I) pilihAkor(a); }, dt); G.akor = a; }
        if (c === 'D' || c === 'U') genjreng(c, I.t, pos === 0 ? 0.55 : 0.42);
        I.t += ketuk; I.i++;
      }
    };
    I.timer = setInterval(jadwal, 40); jadwal();
  }

  function siapkanPanel() {
    if ($('#gitarPanel')) return;
    const st = document.createElement('style');
    st.textContent = '#gitarPanel{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);width:min(760px,calc(100% - 24px));padding:8px 10px 10px;z-index:40;touch-action:none;user-select:none;-webkit-user-select:none;display:flex;flex-direction:column;gap:8px}'
      + '#gitarPanel[hidden]{display:none}#gitarPanel .gp-kepala{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:.78rem}#gitarPanel .gp-kepala b{margin-right:auto}'
      + '#gitarAkor{display:flex;gap:4px;flex-wrap:wrap}#gitarAkor button{min-width:44px}#gitarAkor button.on{background:var(--accent);color:#06221c;border-color:var(--accent)}'
      + '#gitarSenar{position:relative;height:150px;border-radius:10px;background:linear-gradient(90deg,#3b2414,#5a3a20 40%,#3b2414);overflow:hidden;cursor:pointer}'
      + '#gitarSenar .sn{position:absolute;left:44px;right:10px;height:24px;transform:translateY(-50%)}#gitarSenar .sn::after{content:"";position:absolute;left:0;right:0;top:50%;background:linear-gradient(#f4e2b8,#a88a52);border-radius:2px}'
      + '#gitarSenar .sn::before{content:attr(data-n) " " attr(data-fret);position:absolute;left:-38px;top:50%;transform:translateY(-50%);font:600 .7rem system-ui;color:#f4e2b8;white-space:nowrap}'
      + '#gitarSenar .sn.getar::after{animation:gtGetar .45s ease-out}@keyframes gtGetar{0%,100%{transform:translateY(-50%)}20%{transform:translateY(calc(-50% + 2px))}40%{transform:translateY(calc(-50% - 2px))}60%{transform:translateY(calc(-50% + 1px))}}'
      + '#gitarSenar .sn:nth-child(1)::after{height:4px}#gitarSenar .sn:nth-child(2)::after{height:3.5px}#gitarSenar .sn:nth-child(3)::after{height:3px}#gitarSenar .sn:nth-child(4)::after{height:2.5px}#gitarSenar .sn:nth-child(5)::after{height:2px}#gitarSenar .sn:nth-child(6)::after{height:1.6px}'
      + '#gitarPanel .gp-bawah{display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:.76rem}#gitarPanel .gp-bawah select{max-width:180px}';
    document.head.appendChild(st);
    const p = el('div', 'float'); p.id = 'gitarPanel'; p.hidden = true; p.setAttribute('role', 'region'); p.setAttribute('aria-label', 'Gitar');
    const kepala = el('div', 'gp-kepala'); kepala.appendChild(el('b', null, '🎸 Gitar'));
    const akor = el('div'); akor.id = 'gitarAkor';
    Object.keys(AKOR).forEach((a, i) => { const b = el('button', 'btn sm ghost', a); b.type = 'button'; b.dataset.a = a; b.title = 'Akor ' + a + ' (' + (i + 1) + ')'; b.onclick = () => pilihAkor(a); akor.appendChild(b); });
    const tutupB = el('button', 'btn sm ghost'); tutupB.type = 'button'; isiIkon(tutupB, 'tutup', 'Tutup'); tutupB.onclick = tutup;
    kepala.append(akor, tutupB);
    const senar = el('div'); senar.id = 'gitarSenar'; senar.setAttribute('aria-label', 'Senar — ketuk untuk memetik, sapu untuk menggenjreng');
    for (let s = 0; s < 6; s++) { const e = el('div', 'sn'); e.dataset.s = s; e.dataset.n = NAMA_SENAR[s]; e.style.top = (14 + s * 24.4) + 'px'; senar.appendChild(e); }
    const bawah = el('div', 'gp-bawah');
    const bD = el('button', 'btn sm', 'Genjreng ↓'), bU = el('button', 'btn sm', 'Genjreng ↑'); bD.type = bU.type = 'button';
    bD.onclick = () => genjreng('D'); bU.onclick = () => genjreng('U');
    const pola = document.createElement('select'); pola.id = 'gitarPola'; pola.title = 'Pola genjreng';
    for (const [k, v] of Object.entries(POLA)) { const o = el('option', null, v.l); o.value = k; pola.appendChild(o); }
    const prog = el('label', 'cek'), cb = document.createElement('input'); cb.type = 'checkbox'; cb.id = 'gitarProg'; prog.append(cb, document.createTextNode(' Progresi C–G–Am–F'));
    const iring = el('button', 'btn sm ghost'); iring.type = 'button'; iring.id = 'gitarIring'; isiIkon(iring, 'main', 'Iringan');
    iring.onclick = () => { if (G.iring) hentikanIringan(); else mulaiIringan(); };
    pola.onchange = cb.onchange = () => { if (G.iring) mulaiIringan(); };
    bawah.append(bD, bU, pola, prog, iring);
    p.append(kepala, senar, bawah);
    document.body.appendChild(p);
    // sentuh / tetikus: ketuk = petik satu senar, sapu melintasi senar = genjreng
    const senarDi = y => { const r = senar.getBoundingClientRect(); return Math.max(0, Math.min(5, Math.round((y - r.top - 14) / 24.4))); };
    senar.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); senar.setPointerCapture && senar.setPointerCapture(e.pointerId);
      const s = senarDi(e.clientY); G.sapu.set(e.pointerId, s); petik(s, Math.max(0, AKOR[G.akor][s])); });
    senar.addEventListener('pointermove', e => {
      if (!G.sapu.has(e.pointerId)) return;
      const lalu = G.sapu.get(e.pointerId), s = senarDi(e.clientY); if (s === lalu) return;
      const arah = s > lalu ? 1 : -1, ctx = AUDIO.ctx;
      for (let k = lalu + arah, j = 0; arah > 0 ? k <= s : k >= s; k += arah, j++) { const f = AKOR[G.akor][k]; if (f >= 0) petik(k, f, ctx && ctx.currentTime + j * 0.012, 0.5); }
      G.sapu.set(e.pointerId, s);
    });
    for (const ev of ['pointerup', 'pointercancel']) senar.addEventListener(ev, e => G.sapu.delete(e.pointerId));
    p.addEventListener('pointerdown', e => e.stopPropagation());
    // keyboard selama panel terbuka (ditangkap sebelum pintasan editor / mode jalan)
    addEventListener('keydown', e => {
      if (!G.buka || /input|select|textarea/i.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') tutup();
      else if (!e.repeat) {
        const n = parseInt(k, 10), s = 'qwerty'.indexOf(k);
        if (n >= 1 && n <= 9) pilihAkor(Object.keys(AKOR)[n - 1]);
        else if (k === ' ') genjreng('D');
        else if (k === 'b') genjreng('U');
        else if (s >= 0) petik(s, Math.max(0, AKOR[G.akor][s]));
        else return;
      }
      e.preventDefault(); e.stopImmediatePropagation();
    }, true);
  }

  function buka(grp) {
    siapkanPanel(); G.grp = grp || null; G.buka = true;
    $('#gitarPanel').hidden = false; pilihAkor(G.akor); siapkanSuara();
    if (FPS.on) { FPS.keys.clear(); FPS.move = null; if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock(); }
    toast('Pilih akor lalu sapu senarnya — keyboard: 1–9 akor · Spasi genjreng ↓ · B ↑ · Q W E R T Y petik senar');
  }
  function tutup() {
    G.buka = false; hentikanIringan(); const p = $('#gitarPanel'); if (p) p.hidden = true;
    if (FPS.on && !('ontouchstart' in window) && renderer.domElement.requestPointerLock) renderer.domElement.requestPointerLock();
  }
  window.GITAR = { buka, tutup, terbuka: () => G.buka, genjreng, petik, pilihAkor, akor: () => G.akor, iring: () => !!G.iring, petikan: () => G.n, _bufferNot: bufferNot };
})();
