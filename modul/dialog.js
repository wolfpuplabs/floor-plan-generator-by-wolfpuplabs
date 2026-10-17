/* Plan23D — DIALOG NPC (JEV-108)
   Port JavaScript dari inti npc-dialogue-system (Morgan Page, MIT): kartu karakter (modul/kartunpc.js), memori percakapan
   & skor relasi −100…100 per NPC (benci → pujaan) yang disimpan di perangkat pengunjung. Tingkat relasi mengubah salam,
   nada balasan, dan seberapa sering NPC menyapa duluan.
   Tanpa server (bawaan, juga GitHub Pages): balasan dari kartu — niat sederhana (salam, tentang rumah, siapa kamu, pujian,
   terima kasih, hinaan, pamit) + konteks rumah (jumlah lantai & perabot). Bila pemilik situs mengisi GROQ_API_KEY di
   Vercel, /api/npc menjawab dengan AI dalam karakter; gagal / lambat → kembali ke balasan kartu.
   Panel: nama & tingkat relasi, riwayat, tombol cepat, hadiah (disukai / biasa / dibenci kartu), kolom ketik. */
/* global $, el, FPS, camera, PROJECT, BAHASA, toast, muatModul, HARI_GAME */
(function () {
  'use strict';
  const K = window.KARTU_NPC;
  const L = () => (BAHASA && BAHASA.kode === 'id' ? 'id' : 'en');
  const tx = v => (v && typeof v === 'object' && !Array.isArray(v) ? v[L()] : v);
  const acak = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const IKON_TINGKAT = { benci: '💢', tidakSuka: '😒', netral: '🙂', suka: '😊', sayang: '💛', pujaan: '💖' };
  const NAMA_TINGKAT = { benci: 'Benci', tidakSuka: 'Kurang suka', netral: 'Netral', suka: 'Suka', sayang: 'Sayang', pujaan: 'Sangat dekat' };

  /* ---------- memori per perangkat ---------- */
  const KUNCI = 'npcIngat';
  let INGAT = {};
  try { const v = JSON.parse(localStorage.getItem(KUNCI) || '{}'); if (v && typeof v === 'object') INGAT = v; } catch (e) { INGAT = {}; }
  const simpan = () => { try { const k = Object.keys(INGAT); if (k.length > 60) for (const x of k.slice(0, k.length - 60)) delete INGAT[x]; localStorage.setItem(KUNCI, JSON.stringify(INGAT)); } catch (e) { /* mode privat */ } };
  const ingatan = id => { const m = INGAT[id]; if (m && typeof m === 'object' && Array.isArray(m.r)) { m.s = clamp(+m.s || 0, -100, 100); return m; } return (INGAT[id] = { s: 0, r: [], k: 0 }); };
  /* BONDING (JEV-110): kenaikan relasi per NPC dibatasi ±30 poin / hari — kedekatan tumbuh dari interaksi yang sering,
     bukan satu sesi panjang; naik tingkat (netral → suka → sayang → sangat dekat) diumumkan */
  const hariIni = () => (typeof HARI_GAME !== 'undefined' ? 'H' + HARI_GAME.n : new Date().toISOString().slice(0, 10));   // hari dalam game (siklus siang–malam)
  let saatSkor = null;                                                     // panel obrolan: tampilkan +/− di dekat bilah relasi
  function ubahSkor(m, d) {
    const minta = d;
    if (d > 0) { const h = hariIni(); if (m.h !== h) { m.h = h; m.hg = 0; } d = Math.min(d, Math.max(0, 30 - (m.hg || 0))); m.hg = (m.hg || 0) + d; }
    const lv0 = K.tingkat(m.s); m.s = clamp(Math.round((m.s + d) * 10) / 10, -100, 100); const lv1 = K.tingkat(m.s);
    if (saatSkor) saatSkor(m, d, minta);
    if (lv1 !== lv0 && m.n && typeof toast === 'function') toast((m.s > 0 && K.TINGKAT.findIndex(x => x[0] === lv1) > K.TINGKAT.findIndex(x => x[0] === lv0) ? '❤️ ' : '💔 ') + m.n + ' · ' + NAMA_TINGKAT[lv1]);
    return d;
  }

  /* ---------- kartu untuk satu NPC ---------- */
  function kartuNpc(o) {
    const p = (o && o.params) || {}, ada = id => typeof id === 'string' && Object.prototype.hasOwnProperty.call(K.KARTU, id);
    const id = ada(p.kartu) ? p.kartu : K.URUT[((p.benih >>> 0) % 5)];                // otomatis: salah satu kartu bertema rumah
    const k = K.KARTU[id], nama = typeof p.nama === 'string' && p.nama.trim() ? p.nama.trim().slice(0, 30) : k.nama;
    return { id, k, nama };
  }
  const rumah = () => ({ lantai: PROJECT.levels.length, ruang: PROJECT.levels.reduce((s, l) => s + l.walls.length, 0),
    objek: PROJECT.levels.reduce((s, l) => s + l.objects.filter(o => o.kind === 'furn' || o.kind === 'model').length, 0), judul: String(PROJECT.name || '').slice(0, 60) });

  /* ---------- balasan dari kartu (tanpa server) ---------- */
  const NIAT = [
    ['hina', /\b(jelek|bodoh|benci|payah|norak|ugly|stupid|hate|idiot|dumb|awful)\b/i, -8],
    ['pamit', /\b(dah|dadah|bye|sampai jumpa|pamit|permisi dulu|see you|goodbye)\b/i, 0],
    ['terimakasih', /\b(makasih|terima ?kasih|thanks?|thank you|thx)\b/i, 3],
    ['puji', /\b(cantik|bagus|keren|hebat|ganteng|baik|mantap|indah|nice|great|beautiful|awesome|cool|lovely|amazing)\b/i, 5],
    ['salam', /\b(halo|hai|hi|hello|hey|pagi|siang|sore|malam|assalamualaikum|permisi)\b/i, 1],
    ['siapa', /\b(siapa|kamu siapa|namamu|nama kamu|who are you|your name|about you)\b/i, 1],
    ['rumah', /\b(rumah|kamar|lantai|ruang|dapur|taman|desain|house|home|room|floor|kitchen|garden|design|layout)\b/i, 1],
  ];
  function niat(t) { for (const [n, re, d] of NIAT) if (re.test(t)) return [n, d]; return ['lain', 1]; }
  function infoRumah() {
    const r = rumah(), id = L() === 'id';
    return id ? `Rumah ini punya ${r.lantai} lantai${r.objek ? ` dan ${r.objek} perabot yang sudah ditata` : ''}. ` : `This house has ${r.lantai} floor${r.lantai === 1 ? '' : 's'}${r.objek ? ` and ${r.objek} pieces of furniture` : ''}. `;
  }
  function balasKartu(c, m, n) {
    const k = c.k, lv = K.tingkat(m.s), id = L() === 'id';
    switch (n) {
      case 'hina': return lv === 'benci' || lv === 'tidakSuka' ? tx(k.relasi.benci) : (id ? 'Wah… kok begitu ngomongnya.' : 'Well… that wasn\'t very nice.');
      case 'pamit': return lv === 'suka' || lv === 'sayang' || lv === 'pujaan' ? (id ? 'Sampai ketemu lagi, ya! Hati-hati.' : 'See you again soon! Take care.') : (id ? 'Ya, sampai nanti.' : 'Right, see you.');
      case 'terimakasih': return id ? 'Sama-sama!' + (lv === 'netral' ? '' : ' Senang bisa membantu.') : 'You\'re welcome!' + (lv === 'netral' ? '' : ' Happy to help.');
      case 'puji': return (id ? 'Ah, terima kasih! ' : 'Oh, thank you! ') + tx(k.relasi[lv]);
      case 'salam': return tx(k.relasi[lv]);
      case 'siapa': return (id ? `Saya ${c.nama}, ${tx(k.peran).toLowerCase()}. ` : `I'm ${c.nama}, the ${tx(k.peran).toLowerCase()}. `) + tx(k.deskripsi);
      case 'rumah': return infoRumah() + acak(tx(k.topik));
      default: return Math.random() < 0.5 ? acak(tx(k.topik)) : tx(k.relasi[lv]);
    }
  }

  /* ---------- AI opsional (/api/npc) ---------- */
  let AI = null;                                                       // null = belum dicek
  function cekAI() {
    if (AI !== null) return Promise.resolve(AI);
    return fetch('api/npc', { cache: 'no-store' }).then(r => (r.ok ? r.json() : { ai: false })).then(j => (AI = !!(j && j.ai))).catch(() => (AI = false));
  }
  function tanyaAI(c, m, pesan) {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), 14000);
    return fetch('api/npc', { method: 'POST', signal: ac.signal, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kartu: c.id, nama: c.nama, bahasa: L(), skor: m.s, riwayat: m.r.slice(-10), pesan, rumah: rumah() }) })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(j => { if (!j || !j.ai || typeof j.balas !== 'string') throw new Error('tanpa AI'); return { balas: j.balas.slice(0, 600), rasa: clamp(+j.rasa || 0, -1, 1) }; })
      .finally(() => clearTimeout(t));
  }

  /* ---------- panel ---------- */
  let SUARA = false; try { SUARA = localStorage.getItem('npcSuara') === '1'; } catch (e) { SUARA = false; }
  let P = null, KINI = null, KUIS = null;
  function gaya() {
    if (document.getElementById('npcObrolGaya')) return;
    const s = document.createElement('style'); s.id = 'npcObrolGaya';
    s.textContent = `#npcObrol{left:50%;transform:translateX(-50%);bottom:calc(max(14px,env(safe-area-inset-bottom)) + 88px);z-index:39;width:min(420px,calc(100% - 24px));max-height:min(64%,560px);display:flex;flex-direction:column;gap:8px;padding:12px 14px;font-size:.84rem;overflow:hidden}
@media (min-width:900px){#npcObrol{left:16px;transform:none;bottom:calc(max(14px,env(safe-area-inset-bottom)) + 16px);width:380px}}
#npcObrol[hidden]{display:none}.no-kepala{display:flex;align-items:center;gap:8px}.no-kepala b{color:var(--txt);font-size:.95rem}.no-kepala .tag{font-size:.7rem}
.no-batang{height:4px;border-radius:2px;background:var(--panel2);overflow:hidden}.no-batang i{display:block;height:100%;background:linear-gradient(90deg,#e86a8a,#f3b24a);transition:width .4s}
.no-suara[aria-pressed="true"]{color:var(--accent)}
.no-info{display:flex;align-items:center;gap:8px;font-size:.72rem;color:var(--muted);margin-top:-4px;position:relative}.no-info b{color:var(--txt);font-weight:600}
.no-delta{position:absolute;right:0;top:-2px;font-weight:700;font-size:.8rem;pointer-events:none;animation:noDelta 1.6s ease-out forwards}.no-delta.naik{color:#e86a8a}.no-delta.turun{color:#8aa0b8}.no-delta.batas{color:var(--muted);font-weight:500}
@keyframes noDelta{0%{opacity:0;transform:translateY(6px)}15%{opacity:1;transform:none}75%{opacity:1}100%{opacity:0;transform:translateY(-14px)}}
.no-kuis{display:flex;flex-wrap:wrap;gap:6px}.no-kuis button{flex:1 1 30%;min-height:36px}
.no-relasi{margin-left:auto;font-size:.74rem;color:var(--muted);white-space:nowrap}.no-ai{font-size:.66rem;color:var(--accent);border:1px solid var(--accent);border-radius:999px;padding:1px 6px}
.no-isi{flex:1 1 auto;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:8px;overscroll-behavior:contain}.no-isi>*{flex-shrink:0}
.no-log{display:flex;flex-direction:column;gap:6px;min-height:40px}.no-m{padding:7px 10px;border-radius:12px;max-width:88%;line-height:1.35;white-space:pre-wrap;word-wrap:break-word}
.no-n{background:var(--panel2);color:var(--txt);align-self:flex-start;border-bottom-left-radius:4px}.no-u{background:rgba(78,201,176,.18);color:var(--txt);align-self:flex-end;border-bottom-right-radius:4px}
.no-m i{color:var(--muted)}.no-ketik{color:var(--muted);font-style:italic}.no-chip{display:flex;flex-wrap:wrap;gap:6px}.no-chip button{flex:1 1 auto;min-height:36px}
.no-laci{display:flex;flex-direction:column;gap:6px;border-top:1px solid var(--line);padding-top:8px}.no-laci[hidden],.no-form[hidden]{display:none}.no-laci h4{margin:0;font-size:.7rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
.no-tab{display:flex;gap:6px}.no-tab button{flex:1 1 0;min-height:38px}.no-tab button[aria-pressed="true"]{background:var(--accent);color:#06261f;border-color:var(--accent)}
.no-form{display:flex;gap:6px}.no-form input{flex:1;min-height:40px;background:var(--panel2);color:var(--txt);border:1px solid var(--line);border-radius:8px;padding:0 10px;font:inherit}
body.jalan.ngobrol #fpsLembar{display:none}`;
    document.head.appendChild(s);
  }
  // teks *aksi* (gaya SillyTavern) tampil miring; selebihnya teks biasa (tanpa innerHTML)
  function isiPesan(d, t) { t.split(/(\*[^*]{1,200}\*)/).forEach(b => { if (!b) return; if (/^\*.*\*$/.test(b)) d.appendChild(el('i', null, b.slice(1, -1))); else d.appendChild(document.createTextNode(b)); }); }
  function tulis(d, t) { const x = el('div', 'no-m ' + (d === 'u' ? 'no-u' : 'no-n')); isiPesan(x, t); P.log.appendChild(x); P.isi.scrollTop = P.isi.scrollHeight; return x; }
  function segarRelasi() { const m = ingatan(KINI.id), lv = K.tingkat(m.s), i = K.TINGKAT.findIndex(x => x[0] === lv), r = K.TINGKAT[i], nx = K.TINGKAT[i + 1], id = L() === 'id';
    P.relasi.textContent = IKON_TINGKAT[lv] + ' ' + NAMA_TINGKAT[lv]; P.relasi.title = 'Relasi ' + Math.round(m.s) + ' / 100';
    P.batang.style.width = Math.round(clamp((m.s - r[1]) / (Math.min(100, r[2]) - r[1]), 0, 1) * 100) + '%';
    // skor & progres ke tingkat berikutnya, plus sisa jatah kenaikan hari ini
    const sisaHari = m.h === hariIni() ? Math.max(0, 30 - (m.hg || 0)) : 30;
    P.skor.textContent = Math.round(m.s) + ' / 100';
    P.lagi.textContent = nx ? (id ? `${Math.ceil(nx[1] - m.s)} lagi ke ${IKON_TINGKAT[nx[0]]} ${NAMA_TINGKAT[nx[0]]}` : `${Math.ceil(nx[1] - m.s)} more to ${IKON_TINGKAT[nx[0]]} ${NAMA_TINGKAT[nx[0]]}`) : (id ? 'Tingkat tertinggi' : 'Highest level');
    const ke = typeof HARI_GAME !== 'undefined' ? HARI_GAME.n : 0;
    P.jatah.textContent = id ? `hari ke-${ke} · jatah +${Math.round(sisaHari)}` : `day ${ke} · +${Math.round(sisaHari)} left`;
    if (window.KENCAN) window.KENCAN.segar(m); }
  function tandaSkor(m, d, minta) {
    if (!P || !KINI || INGAT[KINI.id] !== m || !minta) return;
    const id = L() === 'id', b = Math.round(Math.abs(d) * 10) / 10;
    const x = el('span', 'no-delta ' + (d > 0 ? 'naik' : d < 0 ? 'turun' : 'batas'), d > 0 ? '+' + b + ' ❤' : d < 0 ? '−' + b + ' 💔' : (id ? 'jatah ❤ hari ini habis' : 'daily ❤ limit reached'));
    P.info.appendChild(x); setTimeout(() => x.remove(), 1700);
  }
  function bangunPanel() {
    gaya();
    const d = el('div', 'float'); d.id = 'npcObrol'; d.hidden = true; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Obrolan NPC');
    const kepala = el('div', 'no-kepala'), nama = el('b'), peran = el('span', 'tag'), ai = el('span', 'no-ai', 'AI'), relasi = el('span', 'no-relasi'), tutup = el('button', 'btn ghost sm', '×');
    ai.hidden = true; tutup.setAttribute('aria-label', 'Tutup obrolan'); tutup.title = 'Tutup obrolan'; tutup.onclick = () => tutupObrol();
    const suara = el('button', 'btn ghost sm no-suara', '🔊'); suara.title = 'Suara NPC'; suara.setAttribute('aria-label', 'Suara NPC'); suara.setAttribute('aria-pressed', String(SUARA)); suara.onclick = () => { SUARA = !SUARA; suara.setAttribute('aria-pressed', String(SUARA)); try { localStorage.setItem('npcSuara', SUARA ? '1' : '0'); } catch (e) { /* mode privat */ } if (!SUARA && window.speechSynthesis) speechSynthesis.cancel(); };
    kepala.append(nama, peran, ai, relasi, suara, tutup);
    const batangL = el('div', 'no-batang'), batang = el('i'); batangL.appendChild(batang);
    const info = el('div', 'no-info'), skor = el('b'), lagi = el('span'), jatah = el('span'); jatah.style.marginLeft = 'auto'; info.append(skor, lagi, jatah);
    const kuis = el('div', 'no-kuis'); kuis.hidden = true;
    const log = el('div', 'no-log'); log.setAttribute('aria-live', 'polite');
    const hadiah = el('div', 'no-chip'); hadiah.hidden = true;
    /* obrolan pilihan A–D (modul/kencan.js) tampil langsung sebagai obrolan utama; aksi lain di dua laci bawah:
       Sosial (ucapan & interaksi berpasangan) dan Aktivitas (hadiah, ajak, permainan, kencan, duduk / berbaring) */
    const chipDari = (daftar, kelas, f, kunci) => { const c = el('div', kelas); for (const [k, l] of daftar) { const b = el('button', 'btn sm ghost', l); b.dataset[kunci] = k; b.onclick = () => f(k); c.appendChild(b); } return c; };
    const laciSosial = el('div', 'no-laci'), laciAktivitas = el('div', 'no-laci'); laciSosial.hidden = laciAktivitas.hidden = true;
    const chip = chipDari([['salam', '👋 Sapa'], ['puji', '👍 Puji'], ['siapa', '❓ Siapa kamu?'], ['rumah', '🏠 Tentang rumah'], ['pamit', '🚪 Pamit']], 'no-chip', cepat, 'cepat');
    // interaksi berpasangan (JEV-109): butuh relasi cukup dekat; tidak untuk kartu anak
    const aksi = chipDari([['peluk', '🤗 Peluk'], ['gandeng', '🤝 Gandeng'], ['dansa', '💞 Dansa'], ['cium', '😘 Cium pipi'], ['pangku', '🫶 Pangku']], 'no-chip no-aksi', k => aksiPasangan(k), 'aksi');
    laciSosial.append(el('h4', null, 'Sosial'), chip, aksi);
    const chip2 = chipDari([['hadiah', '🎁 Beri hadiah'], ['ikut', '🚶 Ajak ikut'], ['kuis', '🎯 Tebak-tebakan'], ['kencan', '💐 Ajak kencan']], 'no-chip', cepat, 'cepat');
    const aksi2 = chipDari([['duduk', '🛋️ Duduk bareng'], ['baring', '🛏️ Berbaring']], 'no-chip no-aksi2', k => aksiPasangan(k), 'aksi');
    laciAktivitas.append(el('h4', null, 'Aktivitas'), chip2, aksi2);
    const form = el('form', 'no-form'), inp = document.createElement('input'), kirimB = el('button', 'btn sm', 'Kirim');
    inp.type = 'text'; inp.maxLength = 300; inp.placeholder = 'Ketik pesan…'; inp.setAttribute('aria-label', 'Pesan untuk NPC'); inp.autocomplete = 'off'; kirimB.type = 'submit';
    // ketikan tidak menggerakkan pemain (WASD / E) — Esc menutup obrolan saja
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); tutupObrol(); } });
    inp.addEventListener('keyup', e => e.stopPropagation());
    form.onsubmit = e => { e.preventDefault(); const t = inp.value.trim(); if (!t) return; inp.value = ''; kirim(t); };
    form.append(inp, kirimB); form.hidden = true;
    // bilah bawah: buka / tutup laci & kolom ketik bebas (satu terbuka sekali waktu)
    const tab = el('div', 'no-tab'), tombolTab = {}, isi = el('div', 'no-isi');
    const bukaTab = k => { for (const [x, b] of Object.entries(tombolTab)) { const on = x === k && b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on));
        ({ sosial: laciSosial, aktivitas: laciAktivitas, ketik: form })[x].hidden = !on; if (on && x === 'ketik') setTimeout(() => inp.focus(), 30); }
      isi.scrollTop = isi.scrollHeight; };
    for (const [k, l] of [['sosial', '💞 Sosial'], ['aktivitas', '🎈 Aktivitas'], ['ketik', '⌨️ Ketik']]) { const b = el('button', 'btn sm ghost', l); b.dataset.tab = k; b.setAttribute('aria-pressed', 'false'); b.onclick = () => bukaTab(k); tombolTab[k] = b; tab.appendChild(b); }
    isi.append(log, kuis, hadiah, laciSosial, laciAktivitas);
    d.append(kepala, batangL, info, isi, form, tab);
    ($('#viewport') || document.body).appendChild(d);
    P = { d, nama, peran, ai, relasi, batang, info, skor, lagi, jatah, kuis, log, isi, chip, aksi, aksi2, hadiah, inp, tutupLaci: () => bukaTab(null) };
    saatSkor = tandaSkor;
  }
  function bicara(teks) {
    if (!SUARA || !window.speechSynthesis || !KINI) return;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(teks.replace(/\*[^*]*\*/g, ' ').trim()); if (!u.text) return;
      u.lang = L() === 'id' ? 'id-ID' : 'en-US'; u.pitch = KINI.o.type === 'M' ? 0.9 : 1.25; u.rate = KINI.c.id === 'anak' ? 1.15 : 1; speechSynthesis.speak(u); } catch (e) { /* tanpa suara */ }
  }
  function ucap(teks, n) {                                                 // NPC berbicara: tulis + gerak kecil
    tulis('n', teks); bicara(teks);
    const m = ingatan(KINI.id); m.r.push({ d: 'n', t: teks.slice(0, 300) }); m.r = m.r.slice(-20); simpan(); segarRelasi();
    if (window.NPC && n !== 'diam') window.NPC.ngobrol(KINI.id, n);
  }
  let SIBUK = false;
  async function kirim(t, nPaksa) {
    if (!KINI || SIBUK) return;
    const c = KINI.c, m = ingatan(KINI.id), [n, d] = nPaksa ? [nPaksa, 0] : niat(t);
    tulis('u', t); m.r.push({ d: 'u', t: t.slice(0, 300) }); m.r = m.r.slice(-20); m.k = (m.k || 0) + 1;
    SIBUK = true; const ketik = tulis('n', '…'); ketik.classList.add('no-ketik');
    let balas = null, rasa = d / 8;
    if (await cekAI()) { try { const j = await tanyaAI(c, m, t); balas = j.balas; rasa = j.rasa; } catch (e) { /* kembali ke kartu */ } }
    if (!KINI) { SIBUK = false; return; }
    ketik.remove(); SIBUK = false;
    ubahSkor(m, balas ? rasa * 6 + 0.5 : d);
    ucap(balas || balasKartu(c, m, n), n);
    if (n === 'pamit') setTimeout(() => { if (KINI && KINI.c === c) tutupObrol(); }, 1200);
    else if (window.DIALOG._kuisOtomatis && !KUIS && m.k >= 3 && m.k - (m.kq || 0) >= 4 && Math.random() < 0.35) setTimeout(() => { if (KINI && KINI.c === c && !KUIS) tanyaKuis(); }, 900);   // sesekali NPC balik bertanya
  }
  const TEKS_CEPAT = { salam: ['Halo!', 'Hello!'], rumah: ['Ceritakan soal rumah ini, dong.', 'Tell me about this house.'], siapa: ['Kamu siapa?', 'Who are you?'],
    puji: ['Kamu baik sekali!', 'You\'re really nice!'], pamit: ['Aku pamit dulu, ya.', 'I\'ll be going now.'] };
  function cepat(k) {
    if (k === 'hadiah') return tampilHadiah();
    if (k === 'ikut') return ajakIkut();
    if (k === 'kuis') return tanyaKuis();
    if (k === 'pilih' || k === 'kencan') return muatModul('kencan').then(() => (k === 'pilih' ? window.KENCAN.pilihan() : window.KENCAN.ajak()), e => toast(e.message));
    const t = TEKS_CEPAT[k][L() === 'id' ? 0 : 1];
    kirim(t, k === 'puji' ? null : k);
  }
  /* TEBAK-TEBAKAN: NPC bertanya soal dirinya (pekerjaan, hadiah favorit, barang yang tak disukai) — jawabannya bisa
     dipelajari dari obrolan & reaksi hadiah. Benar +6, salah −3 (pengurangan tidak dibatasi jatah harian). */
  const acakDari = a => a[Math.floor(Math.random() * a.length)];
  function tanyaKuis() {
    if (!KINI || KUIS) return;
    const k = KINI.c.k, id = L() === 'id', lain = K.URUT.filter(x => x !== KINI.c.id).map(x => K.KARTU[x]), suka = tx(k.hadiah.suka), benci = tx(k.hadiah.benci);
    const sukaLain = lain.flatMap(x => tx(x.hadiah.suka)).filter(x => !suka.includes(x));
    const jenis = acakDari(['peran', 'suka', 'benci']);
    let tanya, benar, salah;
    if (jenis === 'peran') { tanya = id ? 'Coba tebak, apa pekerjaanku?' : 'Guess what I do for a living?'; benar = tx(k.peran); salah = [...new Set(lain.map(x => tx(x.peran)))].filter(x => x !== benar); }
    else if (jenis === 'suka') { tanya = id ? 'Kira-kira hadiah apa yang paling kusuka?' : 'What gift do you think I like most?'; benar = acakDari(suka); salah = [...benci, ...sukaLain]; }
    else { tanya = id ? 'Nah, barang apa yang paling tidak kusuka?' : 'So, what\'s the one thing I don\'t like?'; benar = acakDari(benci); salah = [...suka, ...sukaLain]; }
    const opsi = [benar]; for (const x of salah.sort(() => Math.random() - 0.5)) { if (opsi.length >= 3) break; if (!opsi.includes(x)) opsi.push(x); }
    opsi.sort(() => Math.random() - 0.5);
    KUIS = { benar }; const m = ingatan(KINI.id); m.kq = m.k || 0;
    ucap('🎯 ' + tanya, 'salam');
    P.kuis.textContent = ''; P.kuis.hidden = false;
    for (const o of opsi) { const b = el('button', 'btn sm ghost', o); b.dataset.jawab = o === benar ? '1' : '0'; b.onclick = () => jawabKuis(o); P.kuis.appendChild(b); }
  }
  function jawabKuis(o) {
    if (!KINI || !KUIS) return;
    const m = ingatan(KINI.id), id = L() === 'id', ok = o === KUIS.benar; KUIS = null; P.kuis.hidden = true; P.kuis.textContent = '';
    tulis('u', o); m.r.push({ d: 'u', t: o }); m.r = m.r.slice(-20);
    ubahSkor(m, ok ? 6 : -3);
    ucap(ok ? (id ? 'Betul! Ternyata kamu memperhatikan, ya. 😊' : 'Right! You really pay attention. 😊') : (id ? 'Salah… kamu belum benar-benar kenal aku, ya.' : 'Wrong… you don\'t really know me yet, huh.'), ok ? 'puji' : 'hina');
  }
  function tampilHadiah() {
    const h = P.hadiah; if (!h.hidden) { h.hidden = true; return; }
    h.textContent = ''; const k = KINI.c.k, suka = tx(k.hadiah.suka), benci = tx(k.hadiah.benci), biasa = L() === 'id' ? ['bunga', 'air mineral'] : ['flowers', 'a bottle of water'];
    const pilihan = [[acak(suka), 'suka'], [acak(biasa), 'biasa'], [acak(benci), 'benci']].sort(() => Math.random() - 0.5);
    for (const [nm, j] of pilihan) { const b = el('button', 'btn sm ghost', '🎁 ' + nm); b.onclick = () => beriHadiah(nm, j); h.appendChild(b); }
    const T = tasAkt();
    for (const [jenis, ikon, daftar] of [['masakan', '🍽️', T.masakan || []], ['ikan', '🐟', T.ikan || []]]) daftar.slice(-3).forEach((x, k) => { const i = daftar.length - Math.min(3, daftar.length) + k, b = el('button', 'btn sm ghost', ikon + ' ' + x.nama); b.dataset.barang = jenis; b.onclick = () => beriBarang(jenis, i); h.appendChild(b); });
    if ((T.kayu | 0) > 0) { const b = el('button', 'btn sm ghost', '🪵 ' + (L() === 'id' ? 'Kayu bakar' : 'Firewood')); b.dataset.barang = 'kayu'; b.onclick = () => beriBarang('kayu', 0); h.appendChild(b); }
    h.hidden = false;
  }
  function beriHadiah(nm, j) {
    P.hadiah.hidden = true;
    const m = ingatan(KINI.id), id = L() === 'id';
    tulis('u', (id ? '*Memberi ' : '*Gives ') + nm + '*'); m.r.push({ d: 'u', t: (id ? 'memberi hadiah: ' : 'gives a gift: ') + nm }); m.r = m.r.slice(-20);
    ubahSkor(m, j === 'suka' ? 12 : j === 'biasa' ? 3 : -8);
    ucap(j === 'suka' ? (id ? `Wah, ${nm}! Ini kesukaan saya. Terima kasih banyak!` : `Oh, ${nm}! I love these. Thank you so much!`)
      : j === 'biasa' ? (id ? `Oh, ${nm}. Terima kasih, ya.` : `Oh, ${nm}. Thanks.`) : (id ? `Hmm… ${nm}? Saya kurang suka yang begini.` : `Hmm… ${nm}? I'm not fond of that.`), j === 'benci' ? 'hina' : 'puji');
  }
  // ikut: NPC berjalan mengikuti & menemani aktivitas (mancing, memasak, potong kayu) — bonus kedekatan saat beraktivitas bersama
  function ajakIkut() {
    const m = ingatan(KINI.id), id = L() === 'id';
    if (m.s < -20) { ucap(id ? 'Hmm, lain kali saja.' : 'Hmm, maybe another time.', 'hina'); return; }
    if (!(window.NPC && window.NPC.aksiPasangan(KINI.id, 'ikut'))) return;
    ucap(id ? 'Ayo! Mau ke mana kita?' : 'Sure! Where are we going?', 'salam'); tutupObrol(true);
  }
  // barang dari tas aktivitas (modul/aktivitas.js): ikan, masakan, kayu bakar
  function tasAkt() { if (window.AKT) return window.AKT.tas(); try { return JSON.parse(localStorage.getItem('aktTas') || '{}'); } catch (e) { return {}; } }
  function beriBarang(jenis, i) {
    P.hadiah.hidden = true;
    const b = window.AKT ? window.AKT.ambil(jenis, i) : null; if (!b) return;
    const m = ingatan(KINI.id), id = L() === 'id', c = KINI.c, nm = b.nama;
    tulis('u', (id ? '*Memberi ' : '*Gives ') + nm + '*'); m.r.push({ d: 'u', t: (id ? 'memberi hadiah: ' : 'gives a gift: ') + nm }); m.r = m.r.slice(-20);
    let d = 1, t;
    if (jenis === 'masakan') { d = { sempurna: 18, enak: 12, mentah: 2, gosong: -5 }[b.mutu] || 6;
      t = d >= 12 ? (id ? `Hmm, ${nm}! Wangi sekali… kamu yang masak? Enak!` : `Mmm, ${nm}! Smells amazing… you made this? Delicious!`) : d > 0 ? (id ? `Terima kasih… agak kurang matang, tapi aku hargai.` : `Thanks… a little undercooked, but I appreciate it.`) : (id ? `Eh… ini gosong, ya? Hehe.` : `Uh… it's a bit burnt? Hehe.`); }
    else if (jenis === 'ikan') { d = 6; t = id ? `Wah, ${nm}! Hasil mancingmu? Hebat!` : `Wow, ${nm}! You caught this? Nice!`; }
    else { d = c.id === 'tukang' || c.id === 'pandai_besi' ? 8 : 1; t = d > 1 ? (id ? 'Kayu bakar kering, pas buat tungku. Makasih!' : 'Dry firewood, perfect for the forge. Thanks!') : (id ? 'Kayu bakar? Oh… terima kasih.' : 'Firewood? Oh… thanks.'); }
    ubahSkor(m, d); ucap(t, d > 0 ? 'puji' : 'hina');
  }
  const SYARAT = { peluk: 20, gandeng: 20, dansa: 20, duduk: -20, baring: -20, cium: 50, pangku: 50 };   // cium pipi & pangku: relasi Sayang ke atas
  function aksiPasangan(k) {
    if (!KINI) return;
    const c = KINI.c, m = ingatan(KINI.id), id = L() === 'id';
    if (c.id === 'anak') { ucap(id ? 'Hehe, aku main bola aja yuk, Kak!' : 'Hehe, let\'s just play football!', 'salam'); return; }
    const bareng = k === 'baring' && typeof FPS !== 'undefined' && FPS.duduk && FPS.duduk.baring;   // rebahan di kasur yang sama: relasi Sayang
    if (m.s < (bareng ? 50 : SYARAT[k])) { ubahSkor(m, -1); ucap(id ? 'Eh… kita belum seakrab itu, ya.' : 'Uh… we\'re not that close yet.', 'hina'); return; }
    const npcId = KINI.id;
    if (!(window.NPC && window.NPC.aksiPasangan(npcId, k))) {
      if (k === 'pangku') ucap(id ? 'Duduk dulu di kursi atau sofa, ya.' : 'Sit on a chair or sofa first.', 'diam');
      else if (k === 'baring') ucap(id ? 'Hmm, tidak ada kasur yang bisa dipakai di lantai ini.' : 'Hmm, there\'s no free bed on this floor.', 'diam');
      else ucap(id ? 'Hmm, di sini tidak ada tempat duduk di sebelahmu.' : 'Hmm, there\'s no seat next to you here.', 'diam');
      return; }
    ubahSkor(m, 2);
    const kata = { peluk: ['Sini, peluk dulu!', 'Come here, a hug!'], gandeng: ['Ayo, jalan bareng!', 'Let\'s walk together!'], dansa: ['Pelan-pelan, ya…', 'Nice and slow…'], duduk: ['Boleh duduk di sebelahmu?', 'Mind if I sit next to you?'], cium: ['Mwah! 💕', 'Mwah! 💕'], baring: bareng ? ['Geser sedikit, ya… 😊', 'Scoot over a little… 😊'] : ['Hoaam… aku rebahan sebentar, ya.', 'Yawn… I\'ll lie down for a bit.'], pangku: ['Hehe, aku duduk di sini ya…', 'Hehe, I\'ll sit right here…'] }[k];
    tulis('n', kata[id ? 0 : 1]); m.r.push({ d: 'n', t: kata[id ? 0 : 1] }); m.r = m.r.slice(-20); simpan();
    if (k !== 'duduk' && k !== 'pangku' && k !== 'baring' && typeof FPS !== 'undefined') FPS.gaya = { k, x: camera.position.x, z: camera.position.z, t: performance.now() };   // avatar sendiri ikut berpose (terlihat di Main bareng)
    tutupObrol(true);
  }
  function buka(id) {
    if (!FPS.on) return false;
    const o = PROJECT.levels.flatMap(l => l.objects).find(x => x.id === id && x.kind === 'npc'); if (!o) return false;
    if (!P) bangunPanel();
    const c = kartuNpc(o), m = ingatan(id);
    KINI = { id, c, o }; m.n = c.nama;
    KUIS = null; P.kuis.hidden = true; P.kuis.textContent = '';
    if (m.h !== hariIni() && (m.k || m.r.length)) ubahSkor(m, 3);                     // ketemu lagi hari ini: +3
    P.nama.textContent = c.nama; P.peran.textContent = tx(c.k.peran); P.log.textContent = ''; P.hadiah.hidden = true;
    for (const x of m.r.slice(-6)) tulis(x.d, x.t);                       // ingatan percakapan sebelumnya
    segarRelasi(); P.d.hidden = false; document.body.classList.add('ngobrol');
    P.aksi.hidden = P.aksi2.hidden = c.id === 'anak'; P.aksi2.querySelector('[data-aksi="duduk"]').hidden = !(FPS.duduk && FPS.duduk.id && !FPS.duduk.lantai && !FPS.duduk.baring);
    P.tutupLaci();
    if (window.NPC) window.NPC.ngobrol(id, 'mulai');
    ucap(m.k || m.r.length ? tx(c.k.relasi[K.tingkat(m.s)]) : tx(c.k.salam), 'salam');
    muatModul('kencan').then(() => { if (KINI && KINI.id === id) window.KENCAN.buka(m); }, () => {});   // date sim: suasana hati, status, kenangan kencan
    cekAI().then(a => { if (P) P.ai.hidden = !a; });
    return true;
  }
  function tutupObrol(berlanjut) {
    if (!P || P.d.hidden) return;
    P.d.hidden = true; document.body.classList.remove('ngobrol');
    if (KINI && window.NPC && berlanjut !== true) window.NPC.ngobrol(KINI.id, 'selesai');
    KINI = null; SIBUK = false;
  }
  // menjauh > 4 m / keluar mode jalan → obrolan selesai
  setInterval(() => {
    if (!KINI) return;
    const s = window.NPC && window.NPC.keadaan(KINI.id);
    if (!FPS.on || !s || !s.p || (s.mode !== 'ngobrol' && s.mode !== 'duduk' && s.mode !== 'masuk') || Math.hypot(camera.position.x - s.p.x, camera.position.z - s.p.z) > 4.2) tutupObrol();
  }, 400);
  // aktivitas bersama (modul/aktivitas.js) & interaksi lain di luar panel menambah kedekatan
  function tambahRelasi(id, d) {
    const o = PROJECT.levels.flatMap(l => l.objects).find(x => x.id === id && x.kind === 'npc'); if (!o) return 0;
    const m = ingatan(id); m.n = kartuNpc(o).nama; const n = ubahSkor(m, d); simpan(); if (KINI && KINI.id === id) segarRelasi(); return n;
  }
  // dipakai modul date sim (modul/kencan.js)
  const DALAM = { ingatan, ubahSkor, ucap, tulis, simpan, segarRelasi, hariIni, L, tx, rumah, cekAI, kini: () => KINI, panel: () => P, tutup: tutupObrol, sibuk: v => (v === undefined ? SIBUK : (SIBUK = v)) };
  window.DIALOG = { _dalam: DALAM, buka, tambahRelasi, kuis: tanyaKuis, _ingat: id => ingatan(id), _kuisOtomatis: true, nama: id => { const o = PROJECT.levels.flatMap(l => l.objects).find(x => x.id === id); return o ? kartuNpc(o).nama : ''; }, tutup: tutupObrol, terbuka: () => !!KINI, kartuNpc, skor: id => ingatan(id).s, niat, balasKartu: (o, s, n) => { const c = kartuNpc(o); return balasKartu(c, { s, r: [] }, n); }, _ai: v => { AI = v; } };
})();
