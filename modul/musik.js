/* Plan23D — JELAJAHI MUSIK & SUARA (JEV-097)
   Pustaka audio berlisensi Creative Commons lewat Openverse (Jamendo, Freesound, Wikimedia,
   ccMixter — tanpa kunci API). Cari, saring genre & lisensi, coba dengar, lalu tambahkan ke musik
   latar atau ke daftar track objek. Berkas diunduh ke blob (CSP media-src tidak dilonggarkan) lalu
   lewat penyaring media yang sama dengan unggahan sendiri; pembuat, lisensi & halaman aslinya
   disimpan sebagai kredit. Semua teks dari luar hanya lewat textContent; tautan hanya https. */
/* global $, el, fmt, MEDIA_BATAS */
(function () {
  'use strict';
  const API = 'https://api.openverse.org/v1/audio/';
  const SARAN = {
    music: [['relaxing', 'Santai'], ['piano', 'Piano'], ['lofi', 'Lo-fi'], ['jazz', 'Jazz'], ['acoustic guitar', 'Akustik'], ['classical', 'Klasik'], ['ambient', 'Ambient'], ['cafe', 'Kafe']],
    sound_effect: [['door', 'Pintu'], ['doorbell', 'Bel'], ['click', 'Klik'], ['birds', 'Burung'], ['rain', 'Hujan'], ['water', 'Air'], ['fire crackling', 'Api'], ['wind chime', 'Lonceng angin']],
  };
  const JENIS_OK = /^(mp3|mp32|mp31|mpeg|ogg|oga|wav|m4a|aac|mp4)$/i;      // Jamendo menandai MP3-nya 'mp32' / 'mp31'
  const BERKAS = new Map();                         // id → Blob (coba dengar lalu tambah tanpa mengunduh dua kali)
  let dlg = null, opsi = null, henti = null, unduh = null, dengar = null;   // henti: pencarian; unduh: berkas (batal saat ditutup)

  function siapkan() {
    if (dlg) return dlg;
    const st = document.createElement('style');
    st.textContent = '#musikPustaka{position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px}'
      + '#musikPustaka[hidden]{display:none}#musikPustaka .mp-kotak{background:var(--panel);color:var(--txt);border-radius:12px;width:min(640px,100%);max-height:min(720px,100%);display:flex;flex-direction:column;gap:8px;padding:14px 16px;box-shadow:0 10px 40px rgba(0,0,0,.5)}'
      + '#musikPustaka .mp-kepala{display:flex;align-items:center;gap:8px}#musikPustaka h3{flex:1;margin:0;font-size:1rem}'
      + '#musikPustaka .mp-cari{display:flex;gap:6px;flex-wrap:wrap}#musikPustaka .mp-cari input{flex:1 1 200px;min-width:0}#musikPustaka .mp-cari select{flex:0 1 auto;width:auto;max-width:100%}'
      + '#musikPustaka .mp-saran{display:flex;gap:6px;flex-wrap:wrap}#musikPustaka .mp-hasil{overflow:auto;flex:1;min-height:120px;display:flex;flex-direction:column;gap:6px}'
      + '#musikPustaka .mp-trek{display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--line);border-radius:8px}'
      + '#musikPustaka .mp-isi{flex:1;min-width:0}#musikPustaka .mp-isi b{display:block;font-size:.84rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '#musikPustaka .mp-isi small{display:block;color:var(--muted);font-size:.72rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '#musikPustaka .mp-trek .btn{flex:none}#musikPustaka .mp-catat{font-size:.72rem;color:var(--muted);margin:0}#musikPustaka .mp-awas{color:var(--warn)}';
    document.head.appendChild(st);
    dlg = el('div'); dlg.id = 'musikPustaka'; dlg.hidden = true;
    const kotak = el('div', 'mp-kotak'); kotak.setAttribute('role', 'dialog'); kotak.setAttribute('aria-modal', 'true'); kotak.setAttribute('aria-labelledby', 'musikJudul');
    const kepala = el('div', 'mp-kepala'), h = el('h3', null, ''); h.id = 'musikJudul';
    const tutupB = el('button', 'btn ghost sm', '×'); tutupB.type = 'button'; tutupB.title = 'Tutup'; tutupB.setAttribute('aria-label', 'Tutup'); tutupB.onclick = tutup;
    kepala.append(h, tutupB);
    const cari = el('form', 'mp-cari'), q = document.createElement('input'); q.type = 'search'; q.id = 'musikQ'; q.placeholder = 'Cari judul, genre, suasana…'; q.setAttribute('aria-label', 'Cari musik');
    const lis = document.createElement('select'); lis.id = 'musikLisensi'; lis.title = 'Lisensi';
    for (const [v, t] of [['', 'Semua lisensi CC'], ['commercial', 'Boleh dipakai komersial']]) { const o = el('option', null, t); o.value = v; lis.appendChild(o); }
    const bc = el('button', 'btn sm', 'Cari'); bc.type = 'submit';
    cari.append(q, lis, bc); cari.onsubmit = e => { e.preventDefault(); muat(1); };
    lis.onchange = () => muat(1);
    const saran = el('div', 'mp-saran'); saran.id = 'musikSaran';
    const hasil = el('div', 'mp-hasil'); hasil.id = 'musikHasil'; hasil.setAttribute('aria-live', 'polite');
    const catat = el('p', 'mp-catat', 'Dari Openverse — musik & suara berlisensi Creative Commons (Jamendo, Freesound, Wikimedia, ccMixter). Pembuat & lisensi disimpan bersama track dan tampil sebagai kredit.');
    kotak.append(kepala, cari, saran, hasil, catat); dlg.appendChild(kotak);
    dlg.addEventListener('pointerdown', e => { if (e.target === dlg) tutup(); });
    // Escape menutup dialog saja — tidak diteruskan ke pintasan editor (yang membatalkan pilihan objek)
    addEventListener('keydown', e => { if (e.key === 'Escape' && dlg && !dlg.hidden) { e.stopImmediatePropagation(); e.preventDefault(); tutup(); } }, true);
    document.body.appendChild(dlg);
    return dlg;
  }
  function berhentiDengar() { if (!dengar) return; try { dengar.a.pause(); } catch (e) { /* abaikan */ } URL.revokeObjectURL(dengar.url); if (dengar.b) dengar.b.textContent = '▶'; dengar = null; }
  function tutup() { berhentiDengar(); for (const c of [henti, unduh]) if (c) c.abort(); henti = unduh = null; if (dlg) dlg.hidden = true; }

  const lisensi = r => { const l = String(r.license || '').toLowerCase(), v = String(r.license_version || '');
    return l === 'cc0' ? 'CC0' : l === 'pdm' ? 'Domain publik' : l ? ('CC ' + l.toUpperCase() + (v && v !== 'N/A' ? ' ' + v : '')) : ''; };
  const durasi = ms => { const s = Math.round((+ms || 0) / 1000); return s > 0 ? Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') : ''; };
  const https = u => { try { const x = new URL(String(u || '')); return x.protocol === 'https:' ? x.href : ''; } catch (e) { return ''; } };

  // satu halaman pencarian; kat=false → tanpa saringan kategori
  async function tanya(q, hal, kat, sinyal) {
    const p = new URLSearchParams({ q, page_size: '20', page: String(hal) });
    if (kat) p.set('category', opsi.jenis);
    if ($('#musikLisensi').value) p.set('license_type', $('#musikLisensi').value);
    const r = await fetch(API + '?' + p, { signal: sinyal, mode: 'cors' });
    if (!r.ok) throw new Error(r.status === 429 ? 'terlalu banyak pencarian — coba lagi sebentar lagi' : 'HTTP ' + r.status);
    const j = await r.json(), semua = Array.isArray(j.results) ? j.results : [];
    return { daf: semua.filter(x => x && https(x.url) && (!x.filetype || JENIS_OK.test(x.filetype))), buang: semua.length, lagi: +j.page_count > hal };
  }
  async function muat(hal, kat = true) {
    const hasil = $('#musikHasil'); if (henti) henti.abort();
    henti = new AbortController(); const sinyal = henti.signal;
    const q = $('#musikQ').value.trim() || SARAN[opsi.jenis][0][0];
    hasil.textContent = ''; hasil.appendChild(el('p', 'mp-catat', 'Mencari…'));
    try {
      let h = await tanya(q, hal, kat, sinyal);
      // banyak audio Openverse tanpa kategori (Freesound, Wikimedia, sebagian Jamendo): hasil sedikit → cari lagi tanpa saringan kategori
      if (kat && hal === 1 && h.daf.length < 6) {
        const h2 = await tanya(q, 1, false, sinyal);
        h = { daf: h.daf.concat(h2.daf.filter(x => !h.daf.some(y => y.id === x.id))), buang: h.buang + h2.buang, lagi: h2.lagi }; kat = false;
      }
      if (sinyal.aborted) return;
      hasil.textContent = '';
      if (!h.daf.length) {
        hasil.appendChild(el('p', 'mp-catat', h.buang ? 'Hasilnya berformat lain (FLAC / AIFF) yang tidak bisa diputar di semua perangkat — coba kata lain.' : 'Tidak ada hasil — coba kata lain.'));
        if ($('#musikLisensi').value) { const b = el('button', 'btn sm ghost', 'Tampilkan semua lisensi CC'); b.type = 'button';
          b.onclick = () => { $('#musikLisensi').value = ''; muat(1); }; hasil.appendChild(b); }
        return;
      }
      for (const x of h.daf) hasil.appendChild(baris(x));
      if (h.lagi) { const lagi = el('button', 'btn sm ghost', 'Muat lebih banyak'); lagi.type = 'button';
        lagi.onclick = async () => { lagi.remove(); await muatLagi(hal + 1, kat); }; hasil.appendChild(lagi); }
    } catch (e) {
      if (e.name === 'AbortError') return;
      hasil.textContent = ''; hasil.appendChild(el('p', 'mp-catat mp-awas', 'Pustaka musik tidak bisa dihubungi (' + (e.message || e) + '). Periksa koneksi, atau unggah berkas sendiri.'));
    }
  }
  async function muatLagi(hal, kat) {
    const hasil = $('#musikHasil'), tunggu = el('p', 'mp-catat', 'Memuat…'); hasil.appendChild(tunggu);
    const simpan = [...hasil.children].filter(c => c !== tunggu);
    await muat(hal, kat);
    hasil.prepend(...simpan);
  }

  function baris(x) {
    const r = el('div', 'mp-trek'), isi = el('div', 'mp-isi');
    const terlalu = +x.filesize > MEDIA_BATAS.mb * 1048576;
    isi.append(el('b', null, String(x.title || 'Tanpa judul').slice(0, 120)),
      el('small', null, [String(x.creator || '').slice(0, 80), durasi(x.duration), lisensi(x), String(x.source || x.provider || '').replace(/_/g, ' ')].filter(Boolean).join(' · ')));
    const coba = el('button', 'btn sm ghost', '▶'); coba.type = 'button'; coba.title = 'Coba dengar'; coba.setAttribute('aria-label', 'Coba dengar');
    const tambah = el('button', 'btn sm', terlalu ? 'Terlalu besar' : '+ Tambah'); tambah.type = 'button'; tambah.disabled = terlalu;
    coba.onclick = () => dengarkan(x, coba, isi);
    tambah.onclick = () => pakai(x, tambah, isi);
    r.append(isi, coba, tambah);
    return r;
  }
  async function ambil(x) {
    if (BERKAS.has(x.id)) return BERKAS.get(x.id);
    let r;
    try { r = await fetch(https(x.url), { mode: 'cors', signal: unduh && unduh.signal }); }
    catch (e) { if (e.name === 'AbortError') throw e; const g = new Error('sumber ini tidak mengizinkan unduhan langsung'); g.tolak = true; throw g; }
    if (!r.ok) throw new Error('berkas tidak tersedia (HTTP ' + r.status + ')');
    const b = await r.blob();
    if (b.size > MEDIA_BATAS.mb * 1048576) throw new Error(`berkas ${fmt(b.size / 1048576, 1)} MB melebihi batas ${MEDIA_BATAS.mb} MB`);
    BERKAS.set(x.id, b); return b;
  }
  // gagal karena CORS: tautan ke halaman aslinya supaya bisa diunduh lalu diunggah sendiri
  function gagal(isi, e, x) {
    isi.querySelectorAll('.mp-awas').forEach(n => n.remove());
    const p = el('small', 'mp-awas', '⚠ ' + (e.message || e));
    const asal = https(x.foreign_landing_url);
    if (e.tolak && asal) { const a = el('a', null, 'Buka halaman aslinya'); a.href = asal; a.target = '_blank'; a.rel = 'noopener noreferrer'; p.append(' ', a); }
    isi.appendChild(p);
  }
  async function dengarkan(x, b, isi) {
    if (dengar && dengar.id === x.id) { berhentiDengar(); return; }
    berhentiDengar(); b.textContent = '…';
    try {
      const blob = await ambil(x), url = URL.createObjectURL(blob), a = new Audio(url);
      dengar = { id: x.id, a, url, b }; b.textContent = '■'; a.onended = berhentiDengar;
      await a.play();
    } catch (e) { if (e.name === 'AbortError') return; b.textContent = '▶'; if (dengar && dengar.id === x.id) berhentiDengar(); gagal(isi, e, x); }
  }
  async function pakai(x, b, isi) {
    b.disabled = true; b.textContent = 'Mengunduh…';
    try {
      const blob = await ambil(x), ext = /^mp3/i.test(x.filetype || 'mp3') ? 'mp3' : (String(x.filetype).match(/^[a-z0-9]{2,4}$/i) || ['mp3'])[0];
      const f = new File([blob], String(x.title || 'musik').slice(0, 100) + '.' + ext, { type: blob.type || 'audio/mpeg' });
      await opsi.pakai(f, { oleh: x.creator ? String(x.creator) : '', lisensi: lisensi(x), url: https(x.foreign_landing_url) });
      b.textContent = '✓ Ditambahkan';
    } catch (e) { if (e.name === 'AbortError') return; b.disabled = false; b.textContent = '+ Tambah'; gagal(isi, e, x); }
  }

  function buka(o) {
    opsi = o; siapkan(); unduh = new AbortController();
    $('#musikJudul').textContent = (o.jenis === 'sound_effect' ? 'Jelajahi suara' : 'Jelajahi musik') + ' — ' + o.judul;
    const s = $('#musikSaran'); s.textContent = '';
    for (const [kata, label] of SARAN[o.jenis]) { const c = el('button', 'btn sm ghost', label); c.type = 'button'; c.onclick = () => { $('#musikQ').value = kata; muat(1); }; s.appendChild(c); }
    $('#musikQ').value = ''; dlg.hidden = false; $('#musikQ').focus();
    muat(1);
  }
  window.MUSIK = { buka, tutup };
})();
