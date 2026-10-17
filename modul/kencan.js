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
  // hari dalam game 'H12' (atau tanggal lama 'YYYY-MM-DD' dari versi sebelumnya)
  const selisihHari = (a, b) => (/^H\d+$/.test(a) && /^H\d+$/.test(b) ? +a.slice(1) - +b.slice(1) : (Date.parse(a) - Date.parse(b)) / 864e5);

  /* ---------- tampilan di panel obrolan ---------- */
  function gaya() {
    if (document.getElementById('kencanGaya')) return;
    const s = document.createElement('style'); s.id = 'kencanGaya';
    s.textContent = `.no-mood{display:flex;gap:10px;flex-wrap:wrap;font-size:.74rem;color:var(--muted);margin-top:-4px}.no-mood b{color:var(--txt);font-weight:600}
.no-status{font-size:.68rem;color:#e86a8a;border:1px solid #e86a8a;border-radius:999px;padding:1px 6px;white-space:nowrap}
.no-pilih{display:flex;flex-direction:column;gap:6px}.no-pilih button{text-align:left;justify-content:flex-start;white-space:normal;min-height:38px;line-height:1.3}
#kencanLayar{position:fixed;inset:0;z-index:300;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;opacity:0;transition:opacity .6s;color:#f1f1f1;text-align:center;padding:24px}
#kencanLayar.masuk{opacity:1}#kencanLayar.keluar{opacity:0}#kencanLayar .kl-ikon{font-size:2.4rem}
#kencanLayar .kl-gambar{width:min(92vw,880px,calc((100vh - 200px) * 16 / 9));aspect-ratio:16/9;border-radius:14px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.6)}
#kencanLayar .kl-gambar canvas{width:100%;height:100%;display:block;animation:klZoom 14s ease-out forwards}
@keyframes klZoom{from{transform:scale(1.08)}to{transform:scale(1)}}
@media (prefers-reduced-motion:reduce){#kencanLayar .kl-gambar canvas{animation:none}}
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
      P.pilih = el('div', 'no-pilih'); P.pilih.hidden = true; P.kuis.after(P.pilih);
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
    if (akhir && m.ksebut !== kc.length && selisihHari(h, akhir.h) <= 3 && JENIS[akhir.j]) {
      m.ksebut = kc.length; setTimeout(() => { if (kini()) D.ucap(tx2(JENIS[akhir.j].sesudah), 'salam'); }, 700);
    }
    D.simpan(); segar(m);
    // obrolan pilihan = obrolan utama: pilihan A–D langsung tersedia setelah salam
    setTimeout(() => { if (kini() && !PIL && !D.sibuk() && suasana(m).kesal < 3) tampil(opsiBawaan(m)); }, 400);
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
    const P = siapkanUI(); PIL = opsi; P.pilih.textContent = ''; P.pilih.hidden = false;
    opsi.forEach((o, i) => { const b = el('button', 'btn sm ghost', 'ABCDE'[i] + '. ' + o.t); b.dataset.pilih = String(i);
      b.dataset.efek = o.aksi || (o.akhir ? 'akhir' : Object.keys(o.efek || {}).map(k => k + (o.efek[k] > 0 ? '+' : '-')).join(',')); b.onclick = () => pilih(o); P.pilih.appendChild(b); });
    if (P.isi) P.isi.scrollTop = P.isi.scrollHeight;
  }
  function sembunyikan() { const P = D.panel(); if (P && P.pilih) { P.pilih.hidden = true; P.pilih.textContent = ''; } PIL = null; }
  async function giliran(teks, efek, akhir) {
    const K = kini(); if (!K || D.sibuk()) return;
    const m = D.ingatan(K.id);
    if (teks) { D.tulis('u', teks); m.r.push({ d: 'u', t: teks.slice(0, 300) }); m.r = m.r.slice(-20); m.k = (m.k || 0) + 1; terapkan(m, efek); }
    sembunyikan();
    const s = suasana(m);
    if (s.kesal >= 3) return marah(m);
    if (akhir) { D.ucap(tx2(BALAS.pamit[0]), 'salam'); setTimeout(() => { if (kini() && kini().id === K.id) D.tutup(); }, 1300); return; }
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
      cutscene(J.ikon, baris, tx2(J.akhir), () => { if (typeof setSuasana === 'function') setSuasana(J.langit); }, ilustrasi(j, K.id)).then(() => {
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
  /* ---------- ILUSTRASI ADEGAN (bergerak) ----------
     Latar dilukis di kanvas per jenis kencan (restoran malam berlilin, nonton di sofa, taman senja, BBQ malam berlampu),
     tokohnya NPC itu sendiri — model 3D berwarna & berbaju sama (NPC.potret) — diputar sebagai satu putaran animasi
     (napas, gerak pose memasak) di antara latar belakang & benda latar depan (meja, sofa, bunga, panggangan). Bagian yang
     hidup dilukis ulang tiap bingkai: lilin & cahayanya berkedip, bokeh melayang, layar TV berganti warna & cahayanya
     menyinari ruangan, awan & kelopak bunga di taman, lampu untai berkelip, asap & percikan bara. Latar & latar depan yang
     diam dilukis sekali ke kanvas sendiri. Tanpa model (belum dimuat) latar tetap tampil; prefers-reduced-motion = diam. */
  const IW = 960, IH = 540, BINGKAI = 20;
  const ADEGAN = {
    makan: { po: 1, periode: 3.7, cahaya: { kunci: 0xffc890, isi: 0xffe0c0, tepi: 0xff9a60 }, arah: 0.3, turun: 0.36 },
    nonton: { po: 1, periode: 3.7, cahaya: { kunci: 0x9cc0ff, isi: 0xc8d4ff, tepi: 0xffb070 }, arah: -0.35, turun: 0.36 },
    taman: { po: 0, periode: 3.7, cahaya: { kunci: 0xffc08a, isi: 0xffe4c4, tepi: 0xffd090 }, arah: 0.32, turun: 0.42 },
    bbq: { po: 14, periode: 2 * Math.PI / 3.2, cahaya: { kunci: 0xffa060, isi: 0x9fb0e0, tepi: 0x7f9cff }, arah: 0.5, turun: 0.4 },
  };
  function acakTetap(benih) { let s = benih >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function gradien(x, x0, y0, x1, y1, stop) { const g = x.createLinearGradient(x0, y0, x1, y1); stop.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
  function cahaya(x, cx, cy, r, warna, a = 1) { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, warna); g.addColorStop(1, 'rgba(0,0,0,0)'); x.globalAlpha = a; x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); x.globalAlpha = 1; }
  function bulat(x, cx, cy, r, warna) { x.fillStyle = warna; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); }
  function kotakBulat(x, X, Y, W, H, r, warna) { x.fillStyle = warna; x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.fill(); }
  const goyang = (t, f, fase = 0) => Math.sin(t * f + fase);
  // tiap jenis: latar (diam), belakang(t) (hidup, di belakang tokoh), depan (diam, menutup badan bawah), atas(t) (hidup, paling depan)
  const LATAR = {
    makan: {
      latar(x, R) {
        x.fillStyle = gradien(x, 0, 0, 0, IH, [[0, '#24150f'], [1, '#4a2b1b']]); x.fillRect(0, 0, IW, IH);
        x.fillStyle = '#0d1630'; x.fillRect(60, 50, 330, 260);                               // jendela: kota malam
        x.fillStyle = gradien(x, 0, 50, 0, 310, [[0, '#101a3c'], [1, '#2a2350']]); x.fillRect(66, 56, 318, 248);
        for (let i = 0; i < 9; i++) { const bx = 70 + i * 36, bh = 60 + R() * 150; x.fillStyle = '#151a2e'; x.fillRect(bx, 304 - bh, 30, bh);
          for (let j = 0; j < bh / 18; j++) for (let k = 0; k < 3; k++) if (R() < 0.45) { x.fillStyle = R() < 0.7 ? '#ffd27a' : '#9fd0ff'; x.fillRect(bx + 4 + k * 9, 308 - bh + j * 18, 5, 7); } }
        bulat(x, 330, 95, 18, '#f4ecd0'); x.strokeStyle = '#3a2416'; x.lineWidth = 8; x.strokeRect(62, 52, 326, 256); x.fillRect(222, 52, 6, 256);
        x.strokeStyle = '#2a1a10'; x.lineWidth = 3; x.beginPath(); x.moveTo(470, 0); x.lineTo(470, 40); x.stroke();      // lampu gantung di atas meja
        kotakBulat(x, 436, 36, 68, 28, 12, '#c98a3c');
      },
      belakang(x, t, R) {
        cahaya(x, 480, 120, 380, 'rgba(255,190,110,0.5)', 0.9 + 0.1 * goyang(t, 2.3));
        for (let i = 0; i < 16; i++) { const px = (R.b[i * 3] * IW + t * (6 + R.b[i * 3 + 1] * 10)) % IW, py = 60 + R.b[i * 3 + 2] * 260 + 8 * goyang(t, 0.7, i);
          cahaya(x, px, py, 10 + R.b[i * 3 + 1] * 26, 'rgba(255,200,130,0.5)', 0.4 + 0.3 * (0.5 + 0.5 * goyang(t, 1.3, i))); }
      },
      depan(x) {
        x.fillStyle = gradien(x, 0, 380, 0, IH, [[0, '#f3ede4'], [1, '#cfc4b4']]); x.beginPath(); x.ellipse(IW / 2, 470, 560, 120, 0, Math.PI, 0); x.lineTo(IW, IH); x.lineTo(0, IH); x.fill();
        for (const [px, s] of [[330, 1], [640, 0.9]]) { x.fillStyle = '#ffffff'; x.beginPath(); x.ellipse(px, 448, 92 * s, 26 * s, 0, 0, Math.PI * 2); x.fill();
          x.fillStyle = '#e9e2d6'; x.beginPath(); x.ellipse(px, 448, 62 * s, 16 * s, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = '#c0702e'; x.beginPath(); x.ellipse(px - 8, 444, 30 * s, 9 * s, 0, 0, Math.PI * 2); x.fill(); }
        for (const gx of [450, 540]) { x.fillStyle = 'rgba(220,235,255,0.55)'; x.fillRect(gx - 12, 362, 24, 52); x.fillStyle = 'rgba(160,30,60,0.75)'; x.fillRect(gx - 11, 384, 22, 26); x.fillStyle = 'rgba(220,235,255,0.7)'; x.fillRect(gx - 2, 414, 4, 26); x.fillRect(gx - 16, 438, 32, 4); }
        x.fillStyle = '#f5efe0'; x.fillRect(486, 372, 14, 62);
      },
      atas(x, t) {                                                                                          // lilin berkedip
        const k = 0.85 + 0.1 * goyang(t, 11) + 0.05 * goyang(t, 23, 1), c = 3 * goyang(t, 5);
        cahaya(x, 493 + c * 0.5, 360, 130 * k, 'rgba(255,190,90,0.85)', k); x.fillStyle = '#ffd36a'; x.beginPath(); x.ellipse(493 + c * 0.3, 360 - (k - 0.85) * 20, 6, 13 * k, c * 0.03, 0, Math.PI * 2); x.fill();
        bulat(x, 493 + c * 0.3, 364, 3, '#fff6d0');
      },
    },
    nonton: {
      latar(x, R) {
        x.fillStyle = gradien(x, 0, 0, IW, 0, [[0, '#0a0e1c'], [1, '#141a2c']]); x.fillRect(0, 0, IW, IH);
        for (let i = 0; i < 40; i++) bulat(x, R() * IW, R() * 60, 1, 'rgba(255,255,255,0.15)');
        kotakBulat(x, 40, 70, 360, 214, 8, '#05060a'); x.fillStyle = '#20263a'; x.fillRect(120, 284, 200, 10); x.fillRect(60, 294, 320, 18);
        kotakBulat(x, 360, 250, 600, 230, 40, '#2c4a52'); kotakBulat(x, 380, 270, 560, 60, 30, '#35585f');   // sandaran sofa
      },
      belakang(x, t) {                                                                                     // film di layar TV: warna & bukit bergeser
        const h = (t * 18) % 360;
        x.fillStyle = gradien(x, 48, 78, 392, 276, [[0, `hsl(${(220 + h) % 360},55%,38%)`], [0.5, `hsl(${(270 + h) % 360},50%,55%)`], [1, `hsl(${(20 + h) % 360},65%,62%)`]]); x.fillRect(48, 78, 344, 198);
        const g = 30 * goyang(t, 0.6);
        x.fillStyle = 'rgba(20,30,70,0.85)'; x.beginPath(); x.moveTo(48, 276); x.quadraticCurveTo(160 + g, 190, 260, 240 - g * 0.3); x.quadraticCurveTo(330 - g, 210, 392, 250); x.lineTo(392, 276); x.fill();
        bulat(x, 300 + 40 * goyang(t, 0.25), 130, 22, '#ffe2a8');
        cahaya(x, 220, 180, 430, `hsla(${(220 + h) % 360},90%,65%,0.32)`, 0.7 + 0.3 * (0.5 + 0.5 * goyang(t, 3.1)));
      },
      depan(x, R) {
        kotakBulat(x, 330, 430, 680, 140, 40, '#3a6068'); kotakBulat(x, 300, 380, 110, 200, 40, '#2f5158');   // dudukan & lengan sofa
        x.fillStyle = '#c8302c'; x.beginPath(); x.moveTo(170, 400); x.lineTo(270, 400); x.lineTo(255, 530); x.lineTo(185, 530); x.fill();   // popcorn
        for (let i = 0; i < 4; i++) { x.fillStyle = '#f4f0e8'; x.beginPath(); x.moveTo(184 + i * 25, 400); x.lineTo(196 + i * 25, 400); x.lineTo(192 + i * 21, 530); x.lineTo(184 + i * 21, 530); x.fill(); }
        for (let i = 0; i < 22; i++) bulat(x, 175 + R() * 90, 392 - R() * 26, 9 + R() * 5, R() < 0.5 ? '#fff6dc' : '#ffe9a8');
      },
      atas(x, t) {                                                                                         // cahaya TV menyinari ruangan
        x.globalAlpha = 0.07 + 0.06 * (0.5 + 0.5 * goyang(t, 2.7)) + 0.03 * goyang(t, 9.1); x.fillStyle = `hsl(${(240 + t * 18) % 360},70%,60%)`; x.fillRect(0, 0, IW, IH); x.globalAlpha = 1;
      },
    },
    taman: {
      latar(x, R) {
        x.fillStyle = gradien(x, 0, 0, 0, IH, [[0, '#6f8fd0'], [0.45, '#ffb47a'], [0.7, '#ffd9a0'], [1, '#ffe7c0']]); x.fillRect(0, 0, IW, IH);
        bulat(x, 240, 300, 46, '#fff1c8');
        x.fillStyle = '#9c86b8'; x.beginPath(); x.moveTo(0, 330); for (let i = 0; i <= 12; i++) x.lineTo(i * 80, 300 + Math.sin(i * 1.3) * 26); x.lineTo(IW, IH); x.lineTo(0, IH); x.fill();
        x.fillStyle = '#6f9c5c'; x.beginPath(); x.moveTo(0, 360); for (let i = 0; i <= 12; i++) x.lineTo(i * 80, 350 + Math.sin(i * 0.9 + 1) * 18); x.lineTo(IW, IH); x.lineTo(0, IH); x.fill();
        for (const [tx, s] of [[90, 1.1], [720, 1.3], [860, 0.9], [420, 0.8]]) { x.fillStyle = '#4a3423'; x.fillRect(tx - 7 * s, 300 - 60 * s, 14 * s, 120 * s);
          for (let k = 0; k < 6; k++) bulat(x, tx + (R() - 0.5) * 80 * s, 230 - 70 * s + R() * 60 * s, (34 + R() * 22) * s, R() < 0.5 ? '#3f7a3f' : '#4f8e47'); }
        x.fillStyle = '#e9d2a8'; x.beginPath(); x.moveTo(400, IH); x.quadraticCurveTo(520, 420, 600, 360); x.lineTo(640, 360); x.quadraticCurveTo(600, 440, 640, IH); x.fill();   // jalan setapak
      },
      belakang(x, t) {
        cahaya(x, 240, 300, 260, 'rgba(255,230,170,0.9)', 0.85 + 0.15 * goyang(t, 0.8));
        for (const [y, s, v, o] of [[70, 1, 9, 0], [120, 0.7, 6, 400], [40, 0.8, 7, 700]]) { const cx = (o + t * v) % (IW + 300) - 150;   // awan melintas
          x.globalAlpha = 0.55; for (const [dx, dy, r] of [[0, 0, 34], [36, -10, 28], [68, 2, 30], [30, 12, 26]]) bulat(x, cx + dx * s, y + dy * s, r * s, '#fff3e6'); x.globalAlpha = 1; }
        for (let i = 0; i < 3; i++) { const bx = (i * 230 + t * 40) % (IW + 100) - 50, by = 90 + i * 30 + 6 * goyang(t, 2, i), sy = 6 * goyang(t, 9, i);   // burung
          x.strokeStyle = 'rgba(60,40,70,0.7)'; x.lineWidth = 2; x.beginPath(); x.moveTo(bx - 9, by - sy); x.quadraticCurveTo(bx - 4, by - 3, bx, by); x.quadraticCurveTo(bx + 4, by - 3, bx + 9, by - sy); x.stroke(); }
      },
      depan(x, R) {
        x.fillStyle = gradien(x, 0, 440, 0, IH, [[0, 'rgba(80,130,70,0)'], [1, '#3f6e3a']]); x.fillRect(0, 420, IW, 120);
      },
      atas(x, t, R) {
        for (let i = 0; i < 70; i++) { const fx = R.b[i * 3] * IW, fy = 470 + R.b[i * 3 + 1] * 70, a = 0.12 * goyang(t, 1.6, i * 0.7);   // bunga bergoyang
          const ux = fx + Math.sin(a) * 20, uy = fy + 20 - Math.cos(a) * 20; x.strokeStyle = '#3d6a35'; x.lineWidth = 2; x.beginPath(); x.moveTo(fx, fy + 20); x.lineTo(ux, uy); x.stroke();
          const w = ['#ff8fb1', '#ffd45c', '#ffffff', '#c79bff', '#ff6f6f'][Math.floor(R.b[i * 3 + 2] * 5)]; for (let k = 0; k < 5; k++) bulat(x, ux + Math.cos(k * 1.26) * 5, uy + Math.sin(k * 1.26) * 5, 4, w); bulat(x, ux, uy, 3, '#ffb000'); }
        for (let i = 0; i < 14; i++) { const d = (t * (18 + R.b[i] * 14) + R.b[i + 20] * IH) % (IH + 40) - 20;   // kelopak berguguran
          const px = (R.b[i + 40] * IW + d * 0.6 + 20 * goyang(t, 1.2, i)) % IW, r = goyang(t, 3, i);
          x.fillStyle = 'rgba(255,170,200,0.85)'; x.beginPath(); x.ellipse(px, d, 5, 3 * Math.abs(r) + 1, t + i, 0, Math.PI * 2); x.fill(); }
      },
    },
    bbq: {
      latar(x, R) {
        x.fillStyle = gradien(x, 0, 0, 0, IH, [[0, '#070b22'], [0.6, '#1b2148'], [1, '#2a2440']]); x.fillRect(0, 0, IW, IH);
        bulat(x, 800, 80, 30, '#f2efe0'); cahaya(x, 800, 80, 120, 'rgba(220,230,255,0.35)');
        x.strokeStyle = '#1a1a1a'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 60); x.quadraticCurveTo(480, 190, IW, 70); x.stroke();
        x.fillStyle = '#141420'; for (let i = 0; i < 24; i++) x.fillRect(i * 42, 330, 34, 120); x.fillRect(0, 350, IW, 8); x.fillRect(0, 410, IW, 8);   // pagar
        x.fillStyle = '#20301f'; x.fillRect(0, 450, IW, 90);
      },
      belakang(x, t, R) {
        for (let i = 0; i < 90; i++) bulat(x, R.b[i * 2] * IW, R.b[i * 2 + 1] * 300, 0.4 + R.b[i] * 1.2, 'rgba(255,255,255,' + (0.35 + 0.55 * (0.5 + 0.5 * goyang(t, 1 + R.b[i + 9] * 3, i))).toFixed(2) + ')');
        for (let i = 1; i < 16; i++) { const u = i / 16, bx = u * IW, by = (1 - u) * (1 - u) * 60 + 2 * (1 - u) * u * 190 + u * u * 70 + 8, w = ['#ffd36a', '#ff7f6a', '#8fd0ff', '#b6ff8a'][i % 4];   // lampu untai berkelip
          const k = 0.55 + 0.45 * (0.5 + 0.5 * goyang(t, 2.2, i * 1.7)); cahaya(x, bx, by, 30, w, 0.7 * k); bulat(x, bx, by, 5, w); }
      },
      depan(x, R) {
        x.fillStyle = '#121212'; x.beginPath(); x.ellipse(250, 420, 170, 46, 0, 0, Math.PI * 2); x.fill();                // panggangan
        x.fillStyle = '#1e1e1e'; x.beginPath(); x.moveTo(80, 420); x.quadraticCurveTo(250, 560, 420, 420); x.fill(); x.fillRect(150, 470, 10, 70); x.fillRect(340, 470, 10, 70);
      },
      atas(x, t, R) {
        cahaya(x, 250, 420, 190, 'rgba(255,120,40,0.9)', 0.8 + 0.2 * goyang(t, 4.3));                       // bara berdenyut
        for (let i = 0; i < 26; i++) bulat(x, 120 + R.b[i] * 260, 410 + R.b[i + 30] * 22, 6 + R.b[i + 60] * 6, (0.5 + 0.5 * goyang(t, 3 + R.b[i] * 4, i)) > 0.5 ? '#ff7a2a' : '#ffb347');
        for (let i = 0; i < 6; i++) { x.strokeStyle = '#8a6a44'; x.lineWidth = 3; x.beginPath(); x.moveTo(140 + i * 40, 432); x.lineTo(200 + i * 40, 396); x.stroke(); for (let k = 0; k < 3; k++) bulat(x, 155 + i * 40 + k * 14, 424 - k * 8, 6, '#9a4a22'); }
        x.lineCap = 'round'; x.strokeStyle = '#e8e8f0';                                                   // asap naik & berkelok
        for (let i = 0; i < 5; i++) { const f = ((t * 0.35 + i / 5) % 1); x.globalAlpha = 0.28 * Math.sin(f * Math.PI); x.lineWidth = 16 + f * 30;
          const by = 380 - f * 300, bx = 230 + i * 12 + 40 * Math.sin(f * 5 + i); x.beginPath(); x.moveTo(bx, by + 40); x.quadraticCurveTo(bx + 25 * Math.sin(t + i), by + 10, bx - 10, by - 30); x.stroke(); }
        x.globalAlpha = 1;
        for (let i = 0; i < 18; i++) { const f = (t * (0.4 + R.b[i] * 0.5) + R.b[i + 18]) % 1;            // percikan bara
          bulat(x, 160 + R.b[i + 36] * 200 + 20 * Math.sin(f * 6 + i), 410 - f * 220, 1.8 * (1 - f) + 0.4, `rgba(255,${180 + Math.floor(60 * (1 - f))},90,${(1 - f).toFixed(2)})`); }
      },
    },
  };
  function kanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  // ilustrasi satu adegan kencan → kanvas 960 × 540 yang hidup selama tampil (null bila kanvas tidak tersedia)
  function ilustrasi(j, idNpc) {
    try {
      const L = LATAR[j], A = ADEGAN[j]; if (!L) return null;
      const c = kanvas(IW, IH), x = c.getContext('2d'); if (!x) return null;
      const R = acakTetap([...j].reduce((s, ch) => s * 31 + ch.charCodeAt(0), 7)); R.b = Array.from({ length: 240 }, () => R());
      const bg = kanvas(IW, IH), fg = kanvas(IW, IH), vin = kanvas(IW, IH);
      L.latar(bg.getContext('2d'), R); L.depan(fg.getContext('2d'), R);
      const xv = vin.getContext('2d'), v = xv.createRadialGradient(IW / 2, IH / 2, IH * 0.35, IW / 2, IH / 2, IW * 0.65); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)'); xv.fillStyle = v; xv.fillRect(0, 0, IW, IH);
      const diam = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      const fr = window.NPC && window.NPC.potret ? window.NPC.potret(idNpc, A.po, { w: 480, h: 560, cahaya: A.cahaya, arah: A.arah, turun: A.turun, bingkai: diam ? 1 : BINGKAI, periode: A.periode }) : null;
      const tokoh = Array.isArray(fr) && fr.length ? fr : null, px = j === 'nonton' ? 430 : 400;
      const lukis = t => {
        x.clearRect(0, 0, IW, IH); x.drawImage(bg, 0, 0); L.belakang(x, t, R);
        if (tokoh) { const k = tokoh[Math.floor(((t % A.periode) / A.periode) * tokoh.length) % tokoh.length]; x.save(); x.shadowColor = 'rgba(0,0,0,0.45)'; x.shadowBlur = 24; x.drawImage(k, px, 24, 480 * 0.92, 560 * 0.92); x.restore(); }
        x.drawImage(fg, 0, 0); L.atas(x, t, R); x.drawImage(vin, 0, 0);
      };
      lukis(0); c.dataset.tokoh = tokoh ? '1' : '0'; c.dataset.bingkai = tokoh ? String(tokoh.length) : '0';
      if (!diam) {
        const t0 = performance.now(); let tampil = false;
        const putar = () => { if (c.isConnected) tampil = true; else if (tampil || performance.now() - t0 > 5000) return;   // berhenti setelah layar ditutup
          const t = (performance.now() - t0) / 1000; c.dataset.t = t.toFixed(2); lukis(t); requestAnimationFrame(putar); };
        requestAnimationFrame(putar);
      }
      return c;
    } catch (e) { console.warn('ilustrasi kencan', e); return null; }
  }
  // layar gelap ala cutscene: ilustrasi adegan + baris muncul bergantian; ketuk = baris berikutnya, Lewati = selesai
  function cutscene(ikon, baris, akhir, saatGelap, gambar) {
    return new Promise(selesai => {
      gaya(); FPS.keys.clear(); if (FPS.move) { FPS.move.f = 0; FPS.move.s = 0; }
      const L = el('div'); L.id = 'kencanLayar'; L.setAttribute('role', 'dialog'); L.setAttribute('aria-label', T('Adegan kencan', 'Date scene'));
      const ik = gambar ? el('div', 'kl-gambar') : el('div', 'kl-ikon', ikon), p = el('p'), lewat = el('button', 'btn sm ghost', T('Lewati', 'Skip'));
      if (gambar) { gambar.setAttribute('role', 'img'); gambar.setAttribute('aria-label', baris[0] || ''); ik.appendChild(gambar); }
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
    _uji: { ilustrasi, laju: v => { LAJU = v; }, pilih: i => PIL && PIL[i] && pilih(PIL[i]), opsi: () => PIL, terapkan } };
})();
