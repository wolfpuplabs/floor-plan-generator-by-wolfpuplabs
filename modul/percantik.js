/* Plan23D — PERCANTIK FOTO DENGAN AI (JEV-139)
   Di mode jalan, tombol ✨ di samping dok mengambil tampilan sekarang (≤ 1536 px, JPEG) dan mengirimnya ke api/foto.js,
   yang meneruskannya ke layanan AI gambar milik pemilik situs (Google Gemini / OpenAI / Cloudflare Workers AI gratis) dengan prompt tetap: foto fotoreal,
   sudut kamera & tata letak sama. Gaya cahaya dipilih dari daftar (asli, siang, senja, malam, mendung).
   Hasil tampil di panel: tekan lama / tombol "Sebelum" untuk membandingkan, lalu simpan / bagikan.
   Tombol hanya tampil bila server melapor ai:true (env belum diatur → tidak ada apa-apa). Bila pemilik memasang FOTO_KUNCI,
   panel meminta kunci itu sekali dan menyimpannya di perangkat ini saja. */
/* global $, el, toast, renderer, renderFrame, PROJECT, SENTUH, download, bufFromB64 */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg', MAKS = 1536;
  const GAYA = [['asli', 'Asli'], ['siang', 'Siang'], ['senja', 'Senja'], ['malam', 'Malam'], ['mendung', 'Mendung']];
  const S = { ai: false, kunci: false, gaya: 'asli', asal: '', hasil: '', sibuk: false };
  const baca = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const simpan = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { /* mode privat */ } };
  function ikon(n) {
    const s = document.createElementNS(NS, 'svg'), u = document.createElementNS(NS, 'use');
    s.setAttribute('class', 'ik'); s.setAttribute('aria-hidden', 'true'); u.setAttribute('href', '#i-' + n); s.appendChild(u); return s;
  }
  function tombol(cls, n, teks) { const b = el('button', cls); b.type = 'button'; if (n) b.appendChild(ikon(n)); if (teks) b.appendChild(document.createTextNode((n ? ' ' : '') + teks)); return b; }

  function gaya() {
    if (document.getElementById('percantikGaya')) return;
    // ikon kilau (Lucide "sparkles", ISC — lisensi sudah disertakan bersama ikon lain)
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true'); svg.style.position = 'absolute';
    const sym = document.createElementNS(NS, 'symbol'); sym.id = 'i-kilau'; sym.setAttribute('viewBox', '0 0 24 24');
    for (const d of ['M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0l1.58 6.14a2 2 0 0 0 1.44 1.44l6.14 1.58a.5.5 0 0 1 0 .96l-6.14 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z', 'M20 3v4', 'M22 5h-4', 'M4 17v2', 'M5 18H3']) {
      const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); sym.appendChild(p);
    }
    svg.appendChild(sym); document.body.appendChild(svg);
    const s = document.createElement('style'); s.id = 'percantikGaya';
    // layar sempit: dok + dua tombol samping tidak muat — ✨ naik ke atas ujung kanan dok (kamera orang ketiga di kiri)
    s.textContent = `#fpsDok #fpsAI{position:absolute;left:100%;margin-left:12px}
@media (max-width:480px){#fpsDok #fpsAI{left:auto;right:0;bottom:calc(100% + 10px);margin:0}}
#percantik{left:50%;top:50%;transform:translate(-50%,-50%);z-index:45;width:min(560px,calc(100% - 24px));max-height:calc(100% - 24px);overflow-y:auto;padding:14px;border-radius:14px;display:flex;flex-direction:column;gap:10px}
#percantik h3{font-size:1rem;display:flex;align-items:center;gap:6px}
#percantik .pc-gambar{position:relative;border-radius:10px;overflow:hidden;background:#0c0c10;aspect-ratio:var(--pc-rasio,16/10);display:grid;place-items:center;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
#percantik .pc-gambar img{width:100%;height:100%;object-fit:contain;pointer-events:none}
#percantik .pc-tag{position:absolute;left:8px;top:8px;background:rgba(16,18,22,.75);color:#fff;font-size:.72rem;padding:2px 8px;border-radius:999px}
#percantik .pc-proses{position:absolute;inset:0;display:grid;place-items:center;background:rgba(10,10,14,.55);color:#fff;font-size:.86rem}
#percantik .pc-gaya{display:flex;gap:6px;flex-wrap:wrap}
#percantik .pc-gaya .btn.active{border-color:var(--accent);color:var(--accent)}
#percantik .row{flex-wrap:wrap}
#percantik input{width:100%;background:#212128;color:var(--txt);border:1px solid var(--line);padding:7px 8px;border-radius:8px;min-height:38px;font:inherit;font-size:.86rem;outline:none}
#percantik .hint small{opacity:.75;word-break:break-word}`;
    document.head.appendChild(s);
  }

  // tampilan sekarang → JPEG ≤ 1536 px (sisi panjang)
  function tangkap() {
    try { renderFrame(); } catch (e) { /* bingkai terakhir dipakai */ }
    const s = renderer.domElement, k = Math.min(1, MAKS / Math.max(s.width, s.height));
    const c = document.createElement('canvas'); c.width = Math.round(s.width * k); c.height = Math.round(s.height * k);
    c.getContext('2d').drawImage(s, 0, 0, c.width, c.height);
    let d = ''; for (const q of [0.88, 0.75, 0.6]) { d = c.toDataURL('image/jpeg', q); if (d.length * 0.75 < 1.8 * 1048576) break; }
    return { d, w: c.width, h: c.height };
  }

  function panel() {
    const lama = document.getElementById('percantik'); if (lama) lama.remove();
    gaya();
    const t = tangkap(); S.asal = t.d; S.hasil = '';
    const k = el('div', 'float'); k.id = 'percantik'; k.setAttribute('role', 'dialog'); k.setAttribute('aria-label', 'Percantik foto dengan AI');
    const h = el('h3'); h.appendChild(ikon('kilau')); h.appendChild(document.createTextNode(' Percantik foto dengan AI')); k.appendChild(h);
    const box = el('div', 'pc-gambar'); box.style.setProperty('--pc-rasio', t.w + '/' + t.h);
    const img = document.createElement('img'); img.alt = 'Foto'; img.src = t.d;
    const tag = el('span', 'pc-tag', 'Asli'); box.appendChild(img); box.appendChild(tag); k.appendChild(box);
    const pilih = el('div', 'pc-gaya'); pilih.setAttribute('role', 'group'); pilih.setAttribute('aria-label', 'Cahaya');
    for (const [id, nama] of GAYA) {
      const b = tombol('btn sm ghost' + (id === S.gaya ? ' active' : ''), null, nama); b.dataset.gaya = id; b.setAttribute('aria-pressed', String(id === S.gaya));
      b.onclick = () => { S.gaya = id; for (const x of pilih.children) { const on = x === b; x.classList.toggle('active', on); x.setAttribute('aria-pressed', String(on)); } };
      pilih.appendChild(b);
    }
    k.appendChild(pilih);
    let kk = null;
    if (S.kunci) {
      kk = document.createElement('input'); kk.type = 'password'; kk.autocomplete = 'off'; kk.placeholder = 'Kunci foto AI'; kk.setAttribute('aria-label', 'Kunci foto AI'); kk.value = baca('fotoKunci');
      kk.className = 'pc-kunci'; kk.addEventListener('keydown', e => e.stopPropagation()); k.appendChild(kk);
    }
    const row = el('div', 'row');
    const jalan = tombol('btn', 'kilau', 'Percantik'), banding = tombol('btn sm ghost', null, 'Sebelum'), simpanB = tombol('btn sm', 'simpan', 'Simpan'), tutup = tombol('btn sm ghost', null, 'Tutup');
    banding.hidden = simpanB.hidden = true;
    row.appendChild(jalan); row.appendChild(banding); row.appendChild(simpanB); row.appendChild(tutup); k.appendChild(row);
    const info = el('p', 'hint', 'Foto dikirim ke layanan AI pemilik situs untuk diproses. Tata letak tetap; detail kecil bisa berubah.');
    info.setAttribute('aria-live', 'polite'); k.appendChild(info);
    document.getElementById('viewport').appendChild(k);
    k.addEventListener('pointerdown', e => e.stopPropagation());

    const lihat = asli => { img.src = asli || !S.hasil ? S.asal : S.hasil; tag.textContent = asli || !S.hasil ? 'Asli' : 'AI'; banding.classList.toggle('active', !!asli); };
    // bandingkan: tekan lama gambar / tombol Sebelum
    for (const [ev, v] of [['pointerdown', true], ['pointerup', false], ['pointerleave', false], ['pointercancel', false]]) box.addEventListener(ev, () => { if (S.hasil) lihat(v); });
    banding.onclick = () => lihat(img.src === S.hasil);
    tutup.onclick = () => k.remove();
    simpanB.onclick = () => simpanHasil();
    jalan.onclick = async () => {
      if (S.sibuk) return;
      if (kk) { const v = kk.value.trim(); if (v.length < 12) { info.textContent = 'Isi kunci foto AI dari pemilik situs'; kk.focus(); return; } simpan('fotoKunci', v); }
      S.sibuk = true; jalan.disabled = true;
      const proses = el('div', 'pc-proses', 'Memproses… biasanya 10–40 detik'); box.appendChild(proses); info.textContent = '';
      try {
        const kunci = baca('fotoKunci');
        const r = await fetch('api/foto', { method: 'POST', headers: { 'content-type': 'application/json', ...(S.kunci && kunci ? { 'x-kunci-foto': kunci } : {}) }, body: JSON.stringify({ gambar: S.asal, gaya: S.gaya }) });
        let j = {}; try { j = await r.json(); } catch (e) { /* bukan JSON */ }
        if (r.ok && typeof j.gambar === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(j.gambar)) {
          S.hasil = j.gambar; lihat(false); banding.hidden = simpanB.hidden = false; jalan.lastChild.textContent = ' Coba lagi';
          info.textContent = 'Selesai. Tekan lama gambar untuk melihat aslinya.';
          if (j.penyedia === 'cloudflare') { info.appendChild(document.createElement('br')); info.appendChild(el('small', null, 'Diproses dengan Cloudflare Workers AI (gratis) — mutunya lebih rendah daripada Gemini / OpenAI.')); }
        } else if (r.status === 403 && j.galat === 'kunci') { simpan('fotoKunci', ''); info.textContent = 'Kunci foto AI salah.'; }
        else if (r.status === 429) info.textContent = 'Terlalu sering — tunggu sebentar lalu coba lagi.';
        else if (r.status === 504) info.textContent = 'Layanan AI terlalu lama menjawab — coba lagi.';
        else if (r.status === 502 && j.galat === 'tanpa-gambar') info.textContent = 'Layanan AI tidak mengembalikan gambar (mungkin ditolak saringannya) — coba gaya lain.';
        else if (r.status === 502 && j.galat === 'penyedia') tampilGalat(info, j);
        else info.textContent = 'Gagal memproses foto (' + r.status + ').';
      } catch (e) { info.textContent = 'Gagal memproses foto — periksa koneksi lalu coba lagi.'; }
      finally { S.sibuk = false; jalan.disabled = false; proses.remove(); }
    };
  }

  // galat dari layanan AI: sebab yang bisa ditindaklanjuti pemilik situs + pesan asli penyedia (sudah dipotong server)
  function tampilGalat(info, j) {
    const k = +j.kode || 0;
    info.textContent = '';
    const sebab = k === 429 ? 'Kuota layanan AI habis atau belum aktif — aktifkan billing Gemini, atau pasang Cloudflare Workers AI (gratis) sebagai cadangan.'
      : k === 401 || k === 403 ? 'Kunci API ditolak atau belum punya izin — periksa GEMINI_API_KEY / OPENAI_API_KEY / CLOUDFLARE_API_TOKEN di Vercel.'
        : k === 404 ? 'Model AI gambar tidak ditemukan — isi GEMINI_IMAGE_MODEL di Vercel dengan model gambar yang tersedia.'
          : k === 400 ? 'Layanan AI menolak permintaan (kunci API tidak sah atau wilayah tidak didukung).'
            : 'Layanan AI sedang bermasalah — coba lagi nanti.';
    info.appendChild(el('span', null, sebab));
    // nama penyedia di depan pesan aslinya (pesan Cloudflare dulu tampil di bawah saran kunci Gemini / OpenAI)
    if (j.pesan) { info.appendChild(document.createElement('br')); info.appendChild(el('small', null, (/^(gemini|openai|cloudflare)$/.test(j.penyedia) ? j.penyedia + ': ' : '') + String(j.pesan).slice(0, 240))); }
  }

  function simpanHasil() {
    const m = /^data:(image\/(png|jpeg|webp));base64,(.+)$/.exec(S.hasil || ''); if (!m) return;
    const t = new Date(), dua = v => String(v).padStart(2, '0'), eks = m[2] === 'jpeg' ? 'jpg' : m[2];
    const nama = `Plan23D-AI-${t.getFullYear()}${dua(t.getMonth() + 1)}${dua(t.getDate())}-${dua(t.getHours())}${dua(t.getMinutes())}${dua(t.getSeconds())}.${eks}`;
    const file = new File([new Uint8Array(bufFromB64(m[3]))], nama, { type: m[1] });
    let janji = null;
    try { if (SENTUH && navigator.canShare && navigator.canShare({ files: [file] })) janji = navigator.share({ files: [file], title: PROJECT.name || 'Plan23D' }); } catch (e) { janji = null; }
    if (janji) janji.then(() => toast('Foto dibagikan / disimpan')).catch(e => { if (e && e.name === 'AbortError') return; download(file, nama); toast('Foto diunduh: ' + nama); });
    else { download(file, nama); toast('Foto diunduh: ' + nama); }
  }

  function pasangTombol() {
    const dok = $('#fpsDok'); if (!dok || document.getElementById('fpsAI')) return;
    gaya();
    const b = tombol('fps-ik', 'kilau'); b.id = 'fpsAI'; b.title = 'Percantik foto dengan AI'; b.setAttribute('aria-label', 'Percantik foto dengan AI');
    b.onclick = panel; dok.appendChild(b);
  }

  async function cek() {
    try {
      const r = await fetch('api/foto'); const j = r.ok ? await r.json() : {};
      S.ai = !!(j && j.ai); S.kunci = !!(j && j.kunci);
    } catch (e) { S.ai = false; }
    if (S.ai) pasangTombol();
  }
  cek();
  window.PERCANTIK = { panel, cek, keadaan: () => ({ ...S, asal: !!S.asal, hasil: !!S.hasil }) };
})();
