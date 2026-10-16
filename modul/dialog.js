/* Plan23D — DIALOG NPC (JEV-108)
   Port JavaScript dari inti npc-dialogue-system (Morgan Page, MIT): kartu karakter (modul/kartunpc.js), memori percakapan
   & skor relasi −100…100 per NPC (benci → pujaan) yang disimpan di perangkat pengunjung. Tingkat relasi mengubah salam,
   nada balasan, dan seberapa sering NPC menyapa duluan.
   Tanpa server (bawaan, juga GitHub Pages): balasan dari kartu — niat sederhana (salam, tentang rumah, siapa kamu, pujian,
   terima kasih, hinaan, pamit) + konteks rumah (jumlah lantai & perabot). Bila pemilik situs mengisi GROQ_API_KEY di
   Vercel, /api/npc menjawab dengan AI dalam karakter; gagal / lambat → kembali ke balasan kartu.
   Panel: nama & tingkat relasi, riwayat, tombol cepat, hadiah (disukai / biasa / dibenci kartu), kolom ketik. */
/* global $, el, FPS, camera, PROJECT, BAHASA */
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
  const ubahSkor = (m, d) => { m.s = clamp(Math.round((m.s + d) * 10) / 10, -100, 100); };

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
  let P = null, KINI = null;
  function gaya() {
    if (document.getElementById('npcObrolGaya')) return;
    const s = document.createElement('style'); s.id = 'npcObrolGaya';
    s.textContent = `#npcObrol{left:50%;transform:translateX(-50%);bottom:calc(max(14px,env(safe-area-inset-bottom)) + 88px);z-index:39;width:min(420px,calc(100% - 24px));max-height:min(60%,520px);display:flex;flex-direction:column;gap:8px;padding:12px 14px;font-size:.84rem}
@media (min-width:900px){#npcObrol{left:16px;transform:none;bottom:calc(max(14px,env(safe-area-inset-bottom)) + 16px);width:380px}}
#npcObrol[hidden]{display:none}.no-kepala{display:flex;align-items:center;gap:8px}.no-kepala b{color:var(--txt);font-size:.95rem}.no-kepala .tag{font-size:.7rem}
.no-relasi{margin-left:auto;font-size:.74rem;color:var(--muted);white-space:nowrap}.no-ai{font-size:.66rem;color:var(--accent);border:1px solid var(--accent);border-radius:999px;padding:1px 6px}
.no-log{overflow:auto;display:flex;flex-direction:column;gap:6px;min-height:60px;max-height:200px}.no-m{padding:7px 10px;border-radius:12px;max-width:88%;line-height:1.35;white-space:pre-wrap;word-wrap:break-word}
.no-n{background:var(--panel2);color:var(--txt);align-self:flex-start;border-bottom-left-radius:4px}.no-u{background:rgba(78,201,176,.18);color:var(--txt);align-self:flex-end;border-bottom-right-radius:4px}
.no-m i{color:var(--muted)}.no-ketik{color:var(--muted);font-style:italic}.no-chip{display:flex;flex-wrap:wrap;gap:6px}.no-chip button{flex:1 1 auto;min-height:36px}
.no-form{display:flex;gap:6px}.no-form input{flex:1;min-height:40px;background:var(--panel2);color:var(--txt);border:1px solid var(--line);border-radius:8px;padding:0 10px;font:inherit}
body.jalan.ngobrol #fpsLembar{display:none}`;
    document.head.appendChild(s);
  }
  // teks *aksi* (gaya SillyTavern) tampil miring; selebihnya teks biasa (tanpa innerHTML)
  function isiPesan(d, t) { t.split(/(\*[^*]{1,200}\*)/).forEach(b => { if (!b) return; if (/^\*.*\*$/.test(b)) d.appendChild(el('i', null, b.slice(1, -1))); else d.appendChild(document.createTextNode(b)); }); }
  function tulis(d, t) { const x = el('div', 'no-m ' + (d === 'u' ? 'no-u' : 'no-n')); isiPesan(x, t); P.log.appendChild(x); P.log.scrollTop = P.log.scrollHeight; return x; }
  function segarRelasi() { const m = ingatan(KINI.id), lv = K.tingkat(m.s); P.relasi.textContent = IKON_TINGKAT[lv] + ' ' + NAMA_TINGKAT[lv]; P.relasi.title = 'Relasi ' + Math.round(m.s) + ' / 100'; }
  function bangunPanel() {
    gaya();
    const d = el('div', 'float'); d.id = 'npcObrol'; d.hidden = true; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Obrolan NPC');
    const kepala = el('div', 'no-kepala'), nama = el('b'), peran = el('span', 'tag'), ai = el('span', 'no-ai', 'AI'), relasi = el('span', 'no-relasi'), tutup = el('button', 'btn ghost sm', '×');
    ai.hidden = true; tutup.setAttribute('aria-label', 'Tutup obrolan'); tutup.title = 'Tutup obrolan'; tutup.onclick = () => tutupObrol();
    kepala.append(nama, peran, ai, relasi, tutup);
    const log = el('div', 'no-log'); log.setAttribute('aria-live', 'polite');
    const chip = el('div', 'no-chip'), hadiah = el('div', 'no-chip'); hadiah.hidden = true;
    for (const [k, l] of [['salam', '👋 Sapa'], ['rumah', '🏠 Tentang rumah'], ['siapa', '❓ Siapa kamu?'], ['puji', '👍 Puji'], ['hadiah', '🎁 Beri hadiah'], ['pamit', '🚪 Pamit']]) {
      const b = el('button', 'btn sm ghost', l); b.dataset.cepat = k; b.onclick = () => cepat(k); chip.appendChild(b); }
    // interaksi berpasangan (JEV-109): butuh relasi cukup dekat; tidak untuk kartu anak
    const aksi = el('div', 'no-chip no-aksi');
    for (const [k, l] of [['peluk', '🤗 Peluk'], ['gandeng', '🤝 Gandeng'], ['dansa', '💞 Dansa'], ['duduk', '🛋️ Duduk bareng']]) {
      const b = el('button', 'btn sm ghost', l); b.dataset.aksi = k; b.onclick = () => aksiPasangan(k); aksi.appendChild(b); }
    const form = el('form', 'no-form'), inp = document.createElement('input'), kirimB = el('button', 'btn sm', 'Kirim');
    inp.type = 'text'; inp.maxLength = 300; inp.placeholder = 'Ketik pesan…'; inp.setAttribute('aria-label', 'Pesan untuk NPC'); inp.autocomplete = 'off'; kirimB.type = 'submit';
    // ketikan tidak menggerakkan pemain (WASD / E) — Esc menutup obrolan saja
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); tutupObrol(); } });
    inp.addEventListener('keyup', e => e.stopPropagation());
    form.onsubmit = e => { e.preventDefault(); const t = inp.value.trim(); if (!t) return; inp.value = ''; kirim(t); };
    form.append(inp, kirimB);
    d.append(kepala, log, chip, aksi, hadiah, form);
    ($('#viewport') || document.body).appendChild(d);
    P = { d, nama, peran, ai, relasi, log, chip, aksi, hadiah, inp };
  }
  function ucap(teks, n) {                                                 // NPC berbicara: tulis + gerak kecil
    tulis('n', teks);
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
  }
  const TEKS_CEPAT = { salam: ['Halo!', 'Hello!'], rumah: ['Ceritakan soal rumah ini, dong.', 'Tell me about this house.'], siapa: ['Kamu siapa?', 'Who are you?'],
    puji: ['Kamu baik sekali!', 'You\'re really nice!'], pamit: ['Aku pamit dulu, ya.', 'I\'ll be going now.'] };
  function cepat(k) {
    if (k === 'hadiah') return tampilHadiah();
    const t = TEKS_CEPAT[k][L() === 'id' ? 0 : 1];
    kirim(t, k === 'puji' ? null : k);
  }
  function tampilHadiah() {
    const h = P.hadiah; if (!h.hidden) { h.hidden = true; return; }
    h.textContent = ''; const k = KINI.c.k, suka = tx(k.hadiah.suka), benci = tx(k.hadiah.benci), biasa = L() === 'id' ? ['bunga', 'air mineral'] : ['flowers', 'a bottle of water'];
    const pilihan = [[acak(suka), 'suka'], [acak(biasa), 'biasa'], [acak(benci), 'benci']].sort(() => Math.random() - 0.5);
    for (const [nm, j] of pilihan) { const b = el('button', 'btn sm ghost', '🎁 ' + nm); b.onclick = () => beriHadiah(nm, j); h.appendChild(b); }
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
  const SYARAT = { peluk: 20, gandeng: 20, dansa: 20, duduk: -20 };
  function aksiPasangan(k) {
    if (!KINI) return;
    const c = KINI.c, m = ingatan(KINI.id), id = L() === 'id';
    if (c.id === 'anak') { ucap(id ? 'Hehe, aku main bola aja yuk, Kak!' : 'Hehe, let\'s just play football!', 'salam'); return; }
    if (m.s < SYARAT[k]) { ubahSkor(m, -1); ucap(id ? 'Eh… kita belum seakrab itu, ya.' : 'Uh… we\'re not that close yet.', 'hina'); return; }
    const npcId = KINI.id;
    if (!(window.NPC && window.NPC.aksiPasangan(npcId, k))) { ucap(id ? 'Hmm, di sini tidak ada tempat duduk di sebelahmu.' : 'Hmm, there\'s no seat next to you here.', 'diam'); return; }
    ubahSkor(m, 2);
    const kata = { peluk: ['Sini, peluk dulu!', 'Come here, a hug!'], gandeng: ['Ayo, jalan bareng!', 'Let\'s walk together!'], dansa: ['Pelan-pelan, ya…', 'Nice and slow…'], duduk: ['Boleh duduk di sebelahmu?', 'Mind if I sit next to you?'] }[k];
    tulis('n', kata[id ? 0 : 1]); m.r.push({ d: 'n', t: kata[id ? 0 : 1] }); m.r = m.r.slice(-20); simpan();
    if (k !== 'duduk' && typeof FPS !== 'undefined') FPS.gaya = { k, x: camera.position.x, z: camera.position.z, t: performance.now() };   // avatar sendiri ikut berpose (terlihat di Main bareng)
    tutupObrol(true);
  }
  function buka(id) {
    if (!FPS.on) return false;
    const o = PROJECT.levels.flatMap(l => l.objects).find(x => x.id === id && x.kind === 'npc'); if (!o) return false;
    if (!P) bangunPanel();
    const c = kartuNpc(o), m = ingatan(id);
    KINI = { id, c, o };
    P.nama.textContent = c.nama; P.peran.textContent = tx(c.k.peran); P.log.textContent = ''; P.hadiah.hidden = true;
    for (const x of m.r.slice(-6)) tulis(x.d, x.t);                       // ingatan percakapan sebelumnya
    segarRelasi(); P.d.hidden = false; document.body.classList.add('ngobrol');
    P.aksi.hidden = c.id === 'anak'; P.aksi.querySelector('[data-aksi="duduk"]').hidden = !(FPS.duduk && FPS.duduk.id && !FPS.duduk.lantai && !FPS.duduk.baring);
    if (window.NPC) window.NPC.ngobrol(id, 'mulai');
    ucap(m.k || m.r.length ? tx(c.k.relasi[K.tingkat(m.s)]) : tx(c.k.salam), 'salam');
    cekAI().then(a => { if (P) P.ai.hidden = !a; });
    if (!('ontouchstart' in window)) setTimeout(() => P && !P.d.hidden && P.inp.focus(), 50);
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
  window.DIALOG = { buka, tutup: tutupObrol, terbuka: () => !!KINI, kartuNpc, skor: id => ingatan(id).s, niat, balasKartu: (o, s, n) => { const c = kartuNpc(o); return balasKartu(c, { s, r: [] }, n); }, _ai: v => { AI = v; } };
})();
