/* Plan23D — DATE SIM (JEV-111)
   Gagasan obrolan pilihan diadaptasi dari open-ai-npc (Jack Le Hamster, lisensi MIT — github.com/jacklehamster/open-ai-npc):
   tiap giliran NPC berbicara lalu pemain memilih satu dari 4 ucapan (A–C menggeser satu perasaan NPC ±1, D mengakhiri);
   perasaan yang melewati ambang memicu kejadian. Di sini perasaannya: 😊 senang, 🫶 nyaman, 💗 tertarik, 😤 kesal (0–3).
   · Nyaman ≥ 2 (relasi ≥ 20) → mau diajak kencan: makan malam, nonton TV, jalan di taman, BBQ — dimainkan sebagai
     cutscene layar gelap ("Keesokan paginya…"), lalu NPC hadir di depan pemain dan mengingat kencannya.
   · Tertarik 3 + relasi ≥ 80 → nyatakan perasaan (NPC atau pemain) → terima = status 💞 Pacaran.
   · Kesal 3 → NPC pamit dengan ketus, relasi turun.
   Pilihan dibuat AI (/api/npc, pilihan:true) bila tersedia; tanpa AI dari kumpulan ucapan bawaan. Semua isi ramah semua
   umur: tanpa unsur seksual; kartu anak tanpa unsur romantis (tidak ada rayuan, kencan atau pacaran). */
/* global el, toast, FPS, MOOD, setSuasana */
(function () {
  'use strict';
  const D = window.DIALOG._dalam;
  const T = (id, en) => (D.L() === 'id' ? id : en);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), acakDari = a => a[Math.floor(Math.random() * a.length)];
  const RASA = ['senang', 'nyaman', 'tertarik', 'kesal'];
  const IKON = { senang: '😊', nyaman: '🫶', tertarik: '💗', kesal: '😤' };
  const NAMA = { senang: ['Senang', 'Happy'], nyaman: ['Nyaman', 'Comfortable'], tertarik: ['Tertarik', 'Attracted'], kesal: ['Kesal', 'Annoyed'] };
  // selera tiap kartu: jenis kencan & waktu favorit (waktu = suasana langit: siang / senja / malam)
  const SUKA_KENCAN = { tetangga: 'taman', arsitek: 'makan', agen: 'makan', tukang: 'bbq', pandai_besi: 'bbq', pedagang: 'taman', penyihir: 'nonton' };
  const SUKA_WAKTU = { tetangga: 'siang', arsitek: 'senja', agen: 'siang', tukang: 'siang', pandai_besi: 'malam', pedagang: 'senja', penyihir: 'malam' };
  const JENIS = {
    makan: { ikon: '🍽️', n: ['Makan malam', 'Dinner'], akhir: ['Keesokan paginya…', 'The next morning…'], langit: 'siang',
      baris: [['Malam itu kalian makan malam berdua.', 'That evening the two of you had dinner together.'], ['{n} bercerita banyak hal — {t}', '{n} talked about all sorts of things — {t}'], ['Kalian tertawa sampai lupa waktu.', 'You laughed until you lost track of time.']],
      sesudah: ['Makan malam semalam enak banget. Makasih, ya!', 'Last night\'s dinner was lovely. Thank you!'] },
    nonton: { ikon: '📺', n: ['Nonton TV bareng', 'Watch TV together'], akhir: ['Keesokan paginya…', 'The next morning…'], langit: 'siang',
      baris: [['Kalian duduk berdua di sofa menonton film.', 'You sat together on the sofa watching a film.'], ['{n} sesekali berkomentar soal adegannya.', '{n} kept commenting on the scenes.'], ['Filmnya selesai tanpa terasa.', 'The film was over before you knew it.']],
      sesudah: ['Filmnya semalam seru, ya! Kapan-kapan nonton lagi.', 'That film last night was fun! Let\'s watch another one sometime.'] },
    taman: { ikon: '🌳', n: ['Jalan-jalan di taman', 'A walk in the garden'], akhir: ['Sore itu…', 'That afternoon…'], langit: 'senja',
      baris: [['Kalian berjalan santai menyusuri taman.', 'You strolled slowly through the garden.'], ['{n} menunjuk bunga-bunga sambil bercerita — {t}', '{n} pointed at the flowers and chatted — {t}'], ['Angin sore terasa sejuk.', 'The afternoon breeze felt cool.']],
      sesudah: ['Jalan-jalan tadi menyenangkan. Udaranya segar, ya!', 'That walk was lovely. Such fresh air!'] },
    bbq: { ikon: '🍢', n: ['BBQ berdua', 'BBQ for two'], akhir: ['Malam pun tiba…', 'Night fell…'], langit: 'malam',
      baris: [['Asap arang mengepul, kalian memanggang berdua.', 'Charcoal smoke rose as you grilled together.'], ['{n} membalik sate sambil bercanda.', '{n} flipped the skewers and cracked jokes.'], ['Makanannya habis dalam sekejap.', 'The food was gone in no time.']],
      sesudah: ['BBQ tadi mantap! Kamu jago memanggang.', 'That BBQ was great! You\'re a natural at the grill.'] },
  };
  const POOL = [
    { t: ['Bagaimana harimu?', 'How\'s your day going?'], efek: { nyaman: 1 } },
    { t: ['Ceritakan soal pekerjaanmu, dong.', 'Tell me about your work.'], efek: { nyaman: 1 } },
    { t: ['Ada cerita menarik soal tempat ini?', 'Any interesting stories about this place?'], efek: { nyaman: 1 } },
    { t: ['Kamu orangnya menyenangkan, lho.', 'You\'re really fun to be around.'], efek: { senang: 1 } },
    { t: ['Mau dengar lelucon? Kenapa tembok tak pernah kesepian? Karena selalu ada sekatnya!', 'Want a joke? Why are walls never lonely? They always have a partition!'], efek: { senang: 1 } },
    { t: ['Terima kasih sudah mau ngobrol sama aku.', 'Thanks for taking the time to talk with me.'], efek: { senang: 1 } },
    { t: ['Senyummu manis juga, ya.', 'You have a lovely smile.'], efek: { tertarik: 1 }, romantis: true },
    { t: ['Aku senang ngobrol berdua sama kamu.', 'I really like talking with just you.'], efek: { tertarik: 1 }, romantis: true },
    { t: ['Kamu kelihatan membosankan.', 'You seem kind of boring.'], efek: { kesal: 1 }, buruk: true },
    { t: ['Cepat, aku tidak punya banyak waktu.', 'Hurry up, I don\'t have much time.'], efek: { kesal: 1 }, buruk: true },
    { t: ['Kenapa sih kamu begitu?', 'Why are you like that?'], efek: { kesal: 1 }, buruk: true },
  ];
  const BALAS = {
    senang: [['Hehe, kamu bisa saja!', 'Hehe, you\'re too kind!'], ['Aduh, aku jadi senyum-senyum sendiri.', 'Oh, now I can\'t stop smiling.']],
    tertarik: [['*tersipu* Eh… makasih, ya.', '*blushes* Oh… thank you.'], ['Kamu ini… bikin aku salah tingkah.', 'You… you\'re making me flustered.']],
    kesal: [['Hmm. Itu kurang sopan.', 'Hmm. That wasn\'t very polite.'], ['Kenapa ngomong begitu?', 'Why would you say that?']],
    pamit: [['Oke, sampai nanti, ya!', 'Okay, see you later!']],
  };

  let PIL = null, LAJU = 2300;                        // PIL: wadah pilihan aktif · LAJU: ms per baris cutscene
  const kini = () => D.kini();
  const anak = () => !!(kini() && kini().c.id === 'anak');
  function suasana(m) {
    const s = m.mood && typeof m.mood === 'object' ? m.mood : (m.mood = { senang: 1, nyaman: 0, tertarik: 0, kesal: 0 });
    for (const k of RASA) s[k] = clamp(Math.round(+s[k] || 0), 0, 3);
    return s;
  }
  const tx2 = p => p[D.L() === 'id' ? 0 : 1];

  /* ---------- tampilan di panel obrolan ---------- */
  function gaya() {
    if (document.getElementById('kencanGaya')) return;
    const s = document.createElement('style'); s.id = 'kencanGaya';
    s.textContent = `.no-mood{display:flex;gap:10px;flex-wrap:wrap;font-size:.74rem;color:var(--muted);margin-top:-4px}.no-mood b{color:var(--txt);font-weight:600}
.no-status{font-size:.68rem;color:#e86a8a;border:1px solid #e86a8a;border-radius:999px;padding:1px 6px;white-space:nowrap}
#npcObrol{overflow-y:auto}#npcObrol.memilih .no-chip:not(.no-kuis){display:none}
.no-pilih{display:flex;flex-direction:column;gap:6px}.no-pilih button{text-align:left;justify-content:flex-start;white-space:normal;min-height:38px;line-height:1.3}
#kencanLayar{position:fixed;inset:0;z-index:300;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;opacity:0;transition:opacity .6s;color:#f1f1f1;text-align:center;padding:24px}
#kencanLayar.masuk{opacity:1}#kencanLayar.keluar{opacity:0}#kencanLayar .kl-ikon{font-size:2.4rem}
#kencanLayar p{font-size:1.15rem;max-width:560px;margin:0;opacity:0;transition:opacity .45s;line-height:1.5}#kencanLayar p.on{opacity:1}
#kencanLayar button{position:absolute;right:16px;bottom:calc(16px + env(safe-area-inset-bottom))}`;
    document.head.appendChild(s);
  }
  function siapkanUI() {
    const P = D.panel(); if (!P) return null;
    if (!P.mood) {
      gaya();
      P.mood = el('div', 'no-mood'); P.info.after(P.mood);
      P.status = el('span', 'no-status', '💞 ' + T('Pacaran', 'Dating')); P.status.hidden = true; P.relasi.before(P.status);
      P.pilih = el('div', 'no-pilih'); P.pilih.hidden = true; P.chip.before(P.pilih);
    }
    return P;
  }
  function segar(m) {
    const P = siapkanUI(); if (!P || !m) return;
    const s = suasana(m); P.mood.textContent = '';
    for (const k of RASA) { if (k === 'tertarik' && anak()) continue;
      const x = el('span'); x.title = tx2(NAMA[k]); x.append(IKON[k] + ' ' + tx2(NAMA[k]) + ' '); x.appendChild(el('b', null, String(s[k]))); P.mood.appendChild(x); }
    P.status.hidden = m.status !== 'pacaran';
  }
  function buka(m) {
    const P = siapkanUI(); if (!P) return;
    sembunyikan();
    const s = suasana(m), h = D.hariIni();
    if (m.md && m.md !== h) { s.senang = Math.max(0, s.senang - 1); s.kesal = Math.max(0, s.kesal - 1); }   // hari baru: suasana mereda
    m.md = h;
    // kenangan kencan terakhir (≤ 3 hari) diungkit sekali
    const kc = Array.isArray(m.kencan) ? m.kencan : (m.kencan = []), akhir = kc[kc.length - 1];
    if (akhir && m.ksebut !== kc.length && (Date.parse(h) - Date.parse(akhir.h)) / 864e5 <= 3 && JENIS[akhir.j]) {
      m.ksebut = kc.length; setTimeout(() => { if (kini()) D.ucap(tx2(JENIS[akhir.j].sesudah), 'salam'); }, 700);
    }
    D.simpan(); segar(m);
  }

  /* ---------- obrolan pilihan ---------- */
  // perasaan ±1 → relasi: senang / nyaman / tertarik ±2, kesal ∓3
  function terapkan(m, efek) {
    const s = suasana(m); let d = 0;
    for (const k of Object.keys(efek || {})) { if (!RASA.includes(k) || (k === 'tertarik' && anak())) continue;
      const v = clamp(Math.round(efek[k]), -1, 1); s[k] = clamp(s[k] + v, 0, 3); d += k === 'kesal' ? -3 * v : 2 * v; }
    if (d) D.ubahSkor(m, d);
    D.simpan(); D.segarRelasi();
  }
  function opsiBawaan(m) {
    const s = suasana(m), rom = !anak() && m.s >= 20;
    const baik = POOL.filter(p => !p.buruk && (!p.romantis || rom)), buruk = POOL.filter(p => p.buruk);
    const pilih = [...baik].sort(() => Math.random() - 0.5).slice(0, 2).concat([acakDari(buruk)]).sort(() => Math.random() - 0.5);
    const o = pilih.map(p => ({ t: tx2(p.t), efek: { ...p.efek } }));
    // kejadian dari ambang: ajak kencan / nyatakan perasaan menggantikan salah satu ucapan
    if (bisaNyatakan(m, true)) o[2] = { t: T('Aku suka kamu. Mau jadi pacarku?', 'I like you. Will you be my partner?'), aksi: 'nyatakan' };
    else if (bisaKencan(m) && s.nyaman >= 2 && m.kh !== D.hariIni()) o[2] = { t: T('Mau kencan sama aku?', 'Would you like to go on a date with me?'), aksi: 'kencan' };
    o.push({ t: T('Sampai nanti, ya.', 'See you later.'), akhir: true });
    return o;
  }
  function balasBawaan(m, efek) {
    const c = kini().c, k = efek ? Object.keys(efek)[0] : null;
    if (k === 'nyaman' || !k) return acakDari(D.tx(c.k.topik));
    return tx2(acakDari(BALAS[k] || BALAS.senang));
  }
  function tanyaAI(m, pesan) {
    const c = kini().c, ac = new AbortController(), t = setTimeout(() => ac.abort(), 15000);
    return fetch('api/npc', { method: 'POST', signal: ac.signal, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kartu: c.id, nama: c.nama, bahasa: D.L(), skor: m.s, riwayat: m.r.slice(-10), pesan, rumah: D.rumah(), pilihan: true, suasana: suasana(m) }) })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(j => {
        if (!j || !j.ai || typeof j.balas !== 'string' || !Array.isArray(j.pilihan) || j.pilihan.length !== 4) throw new Error('tanpa AI');
        const o = j.pilihan.map((p, i) => { const efek = {};
          for (const k of RASA) if (p && p.efek && (p.efek[k] === 1 || p.efek[k] === -1)) efek[k] = p.efek[k];
          return { t: String(p && p.t || '').slice(0, 90), efek, akhir: i === 3 }; });
        if (o.some(x => !x.t)) throw new Error('pilihan kosong');
        return { balas: j.balas.slice(0, 600), opsi: o };
      }).finally(() => clearTimeout(t));
  }
  function tampil(opsi) {
    const P = siapkanUI(); PIL = opsi; P.pilih.textContent = ''; P.pilih.hidden = false; P.d.classList.add('memilih');   // tombol cepat & aksi disembunyikan selama memilih
    opsi.forEach((o, i) => { const b = el('button', 'btn sm ghost', 'ABCDE'[i] + '. ' + o.t); b.dataset.pilih = String(i);
      b.dataset.efek = o.aksi || (o.akhir ? 'akhir' : Object.keys(o.efek || {}).map(k => k + (o.efek[k] > 0 ? '+' : '-')).join(',')); b.onclick = () => pilih(o); P.pilih.appendChild(b); });
  }
  function sembunyikan() { const P = D.panel(); if (P && P.pilih) { P.pilih.hidden = true; P.pilih.textContent = ''; P.d.classList.remove('memilih'); } PIL = null; }
  async function giliran(teks, efek, akhir) {
    const K = kini(); if (!K || D.sibuk()) return;
    const m = D.ingatan(K.id);
    if (teks) { D.tulis('u', teks); m.r.push({ d: 'u', t: teks.slice(0, 300) }); m.r = m.r.slice(-20); m.k = (m.k || 0) + 1; terapkan(m, efek); }
    sembunyikan();
    const s = suasana(m);
    if (s.kesal >= 3) return marah(m);
    if (akhir) { D.ucap(tx2(BALAS.pamit[0]), 'salam'); return; }
    D.sibuk(true); const ketik = D.tulis('n', '…'); ketik.classList.add('no-ketik');
    let r = null;
    if (await D.cekAI()) { try { r = await tanyaAI(m, teks || T('(mengajak ngobrol)', '(starts a conversation)')); } catch (e) { r = null; } }
    ketik.remove(); D.sibuk(false);
    if (!kini() || kini().id !== K.id) return;
    D.ucap(r ? r.balas : (teks ? balasBawaan(m, efek) : D.tx(K.c.k.relasi[window.KARTU_NPC.tingkat(m.s)])), efek && efek.kesal > 0 ? 'hina' : efek && Object.keys(efek).length ? 'puji' : 'salam');
    // NPC yang sudah sangat tertarik menyatakan perasaannya sendiri (sekali sehari)
    if (bisaNyatakan(m, false) && m.nyh !== D.hariIni()) { m.nyh = D.hariIni(); D.simpan(); return setTimeout(nyatakanOlehNpc, 900); }
    const o = r ? r.opsi : opsiBawaan(m);
    if (r) { if (bisaNyatakan(m, true)) o[2] = { t: T('Aku suka kamu. Mau jadi pacarku?', 'I like you. Will you be my partner?'), aksi: 'nyatakan' };
      else if (bisaKencan(m) && s.nyaman >= 2 && m.kh !== D.hariIni()) o[2] = { t: T('Mau kencan sama aku?', 'Would you like to go on a date with me?'), aksi: 'kencan' }; }
    tampil(o);
  }
  function pilih(o) {
    if (!kini() || D.sibuk()) return;
    if (o.aksi === 'kencan') { sembunyikan(); D.tulis('u', o.t); return ajak(); }
    if (o.aksi === 'nyatakan') { sembunyikan(); D.tulis('u', o.t); return nyatakanOlehPemain(); }
    if (o.aksi === 'terima' || o.aksi === 'tolak') { sembunyikan(); D.tulis('u', o.t); return jawabNyatakan(o.aksi === 'terima'); }
    if (o.aksi && o.aksi.startsWith('jenis:')) { sembunyikan(); D.tulis('u', o.t); return mulaiKencan(o.aksi.slice(6)); }
    if (o.aksi === 'batal') { sembunyikan(); return; }
    giliran(o.t, o.efek, o.akhir);
  }
  function marah(m) {
    const s = suasana(m); s.kesal = 1;
    D.ucap(T('Sudah, ya. Aku tidak mau ngobrol lagi sekarang.', 'That\'s enough. I don\'t want to talk right now.'), 'hina');
    D.ubahSkor(m, -6); D.simpan(); D.segarRelasi();
    setTimeout(() => D.tutup(), 1400);
  }

  /* ---------- kencan ---------- */
  function bisaKencan(m) { return !anak() && (m.status === 'pacaran' || m.s >= 20); }
  function ajak() {
    const K = kini(); if (!K) return;
    const m = D.ingatan(K.id), s = suasana(m);
    if (anak()) return D.ucap(T('Hehe, aku main sama teman-teman dulu, ya!', 'Hehe, I\'m going to play with my friends!'), 'salam');
    if (m.s < 20) { D.ubahSkor(m, -1); return D.ucap(T('Eh… kita belum cukup dekat untuk kencan.', 'Uh… we\'re not close enough to go on a date.'), 'hina'); }
    if (m.status !== 'pacaran' && s.nyaman < 2) return D.ucap(T('Hmm, aku belum terlalu kenal kamu. Ngobrol dulu, yuk.', 'Hmm, I don\'t know you that well yet. Let\'s talk first.'), 'diam');
    if (m.kh === D.hariIni()) return D.ucap(T('Kita kan sudah kencan hari ini. Besok lagi, ya!', 'We already went on a date today. Tomorrow, okay?'), 'salam');
    D.ucap(T('Boleh! Mau ke mana kita?', 'Sure! Where shall we go?'), 'puji');
    const fav = SUKA_KENCAN[K.c.id];
    tampil(Object.keys(JENIS).map(j => ({ t: JENIS[j].ikon + ' ' + tx2(JENIS[j].n) + (j === fav ? ' ⭐' : ''), aksi: 'jenis:' + j }))   // ⭐ = kencan favoritnya
      .concat([{ t: T('Nanti saja.', 'Maybe later.'), aksi: 'batal' }]));
  }
  function mulaiKencan(j) {
    const K = kini(), J = JENIS[j]; if (!K || !J) return;
    const m = D.ingatan(K.id), s = suasana(m), c = K.c, nama = c.nama;
    const waktu = MOOD === 'gelap' ? 'malam' : MOOD, fav = SUKA_KENCAN[c.id] === j, pas = SUKA_WAKTU[c.id] === waktu;
    const topik = String(acakDari(D.tx(c.k.topik))).replace(/\.$/, '') + '.';
    const baris = J.baris.map(b => tx2(b).replace('{n}', nama).replace('{t}', topik));
    if (fav) baris.splice(2, 0, T(`“Ini kencan favoritku!” kata ${nama}.`, `"This is my favourite kind of date!" said ${nama}.`));
    if (pas) baris.splice(baris.length - 1, 0, T(`${nama} bilang jam segini memang waktu kesukaannya.`, `${nama} said this is their favourite time of day.`));
    D.ucap(T('Ayo!', 'Let\'s go!'), 'puji');
    setTimeout(() => {
      D.tutup(true);
      cutscene(J.ikon, baris, tx2(J.akhir), () => { if (typeof setSuasana === 'function') setSuasana(J.langit); }).then(() => {
        const bonus = 6 + (fav ? 4 : 0) + (pas ? 3 : 0) + (m.status === 'pacaran' ? 2 : 0);
        s.senang = Math.min(3, s.senang + 1); s.nyaman = Math.min(3, s.nyaman + 1); s.tertarik = Math.min(3, s.tertarik + 1);
        m.kh = D.hariIni(); m.kencan = (Array.isArray(m.kencan) ? m.kencan : []).concat([{ j, h: D.hariIni() }]).slice(-8); m.ksebut = m.kencan.length;
        const naik = D.ubahSkor(m, bonus); D.simpan();
        if (window.NPC) { window.NPC.hadirkan(K.id); window.NPC.hati(K.id); }
        if (typeof toast === 'function') toast('💐 ' + T('Kencan selesai', 'Date finished') + ' · +' + Math.round(naik) + ' ❤');
        if (window.DIALOG.buka(K.id)) setTimeout(() => { if (kini() && kini().id === K.id) D.ucap(tx2(J.sesudah), 'puji'); }, 600);
      });
    }, 500);
  }
  // layar gelap ala cutscene: baris muncul bergantian; ketuk = baris berikutnya, Lewati = selesai
  function cutscene(ikon, baris, akhir, saatGelap) {
    return new Promise(selesai => {
      gaya(); FPS.keys.clear(); if (FPS.move) { FPS.move.f = 0; FPS.move.s = 0; }
      const L = el('div'); L.id = 'kencanLayar'; L.setAttribute('role', 'dialog'); L.setAttribute('aria-label', T('Adegan kencan', 'Date scene'));
      const ik = el('div', 'kl-ikon', ikon), p = el('p'), lewat = el('button', 'btn sm ghost', T('Lewati', 'Skip'));
      L.append(ik, p, lewat); document.body.appendChild(L);
      const urut = baris.concat([akhir]); let i = 0, t = null, beres = false;
      const tutup = () => { if (beres) return; beres = true; clearTimeout(t); L.classList.remove('masuk'); L.classList.add('keluar'); setTimeout(() => { L.remove(); selesai(); }, Math.min(700, LAJU)); };
      const lanjut = () => { clearTimeout(t); if (beres) return; if (i >= urut.length) return tutup();
        p.classList.remove('on'); const isi = urut[i++]; setTimeout(() => { p.textContent = isi; p.classList.add('on'); }, Math.min(250, LAJU / 4)); t = setTimeout(lanjut, LAJU); };
      lewat.onclick = e => { e.stopPropagation(); i = urut.length; tutup(); };
      L.onclick = () => lanjut();
      requestAnimationFrame(() => L.classList.add('masuk'));
      setTimeout(() => { if (saatGelap) saatGelap(); }, Math.min(600, LAJU));
      t = setTimeout(lanjut, Math.min(700, LAJU));
    });
  }

  /* ---------- nyatakan perasaan & pacaran ---------- */
  function bisaNyatakan(m, olehPemain) {
    if (anak() || m.status === 'pacaran') return false;
    const s = suasana(m);
    return olehPemain ? m.s >= 60 && s.tertarik >= 2 : m.s >= 80 && s.tertarik >= 3;
  }
  function nyatakanOlehNpc() {
    if (!kini()) return;
    D.ucap(T('Aku… mau jujur. Aku suka sama kamu. Kamu mau jadi pacarku?', 'I… want to be honest. I like you. Will you be my partner?'), 'puji');
    tampil([{ t: T('Iya, aku juga suka kamu! 💞', 'Yes, I like you too! 💞'), aksi: 'terima' }, { t: T('Maaf, aku anggap kamu teman saja.', 'Sorry, I see you as a friend.'), aksi: 'tolak' }]);
  }
  function nyatakanOlehPemain() {
    const K = kini(); if (!K) return;
    const m = D.ingatan(K.id), s = suasana(m);
    if (m.s >= 80 && s.tertarik >= 2) return jawabNyatakan(true, T('Aku… juga suka kamu. Iya, aku mau! 💞', 'I… like you too. Yes! 💞'));
    s.tertarik = Math.max(0, s.tertarik - 1); D.ubahSkor(m, -2); D.simpan();
    D.ucap(T('Maaf… aku belum siap. Kita lebih kenal dulu, ya.', 'Sorry… I\'m not ready yet. Let\'s get to know each other more.'), 'diam');
  }
  function jawabNyatakan(terima, ucapan) {
    const K = kini(); if (!K) return;
    const m = D.ingatan(K.id), s = suasana(m);
    if (terima) {
      m.status = 'pacaran'; m.jadian = D.hariIni(); D.ubahSkor(m, 10); D.simpan();
      D.ucap(ucapan || T('Yay! Mulai hari ini kita pacaran, ya. 💞', 'Yay! From today we\'re together. 💞'), 'puji');
      if (window.NPC) window.NPC.hati(K.id);
      if (typeof toast === 'function') toast('💞 ' + T(`Kamu dan ${K.c.nama} sekarang berpacaran!`, `You and ${K.c.nama} are now dating!`));
    } else {
      s.tertarik = 1; D.ubahSkor(m, -4); D.simpan();
      D.ucap(T('Oh… begitu. Nggak apa-apa, kita tetap teman, ya.', 'Oh… I see. That\'s okay, we\'re still friends.'), 'diam');
    }
    D.segarRelasi();
  }

  window.KENCAN = { pilihan: () => giliran(null), ajak, buka, segar, suasana, cutscene,
    _uji: { laju: v => { LAJU = v; }, pilih: i => PIL && PIL[i] && pilih(PIL[i]), opsi: () => PIL, terapkan } };
})();
