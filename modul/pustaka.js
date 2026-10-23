/* Plan23D — GALERI ADEGAN (JEV-137)
   Adegan yang sudah dibuat bisa diterbitkan sebagai contoh di kartu Mulai (halaman awal): siapa pun mengetuk
   kartunya, masuk ke adegan itu dalam mode lihat, jalan-jalan, lalu mengajak teman main bareng (ruang lobi
   "lihat saja" yang memakai tautan adegan yang sama — tidak diunggah ulang).
   Terbitkan = tautan pendek lihat-saja biasa (buatTautanLihat) + catatan galeri di api/galeri.js. Kiriman masuk
   antrean dan tayang setelah pemilik situs (pemegang GALERI_KUNCI) menyetujuinya; kiriman pemilik langsung tayang.
   Penerbit menyimpan token penarik di perangkatnya (localStorage) untuk menarik kirimannya kembali.
   Judul / nama dari server ditulis lewat textContent; gambar hanya URL https dari Blob (dipilih server). */
/* global $, el, toast, LIHAT, PROJECT, proyekKosong, buatTautanLihat, salinTeks, muatModul */
(function () {
  'use strict';
  const ID = /^[A-HJ-NP-Za-km-z2-9]{10}$/, NS = 'http://www.w3.org/2000/svg';
  const baca = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const simpan = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* mode privat */ } };
  const kunci = () => { const k = baca('pustakaKunci', ''); return typeof k === 'string' ? k : ''; };
  const milikSaya = () => { const s = baca('pustakaSaya', []); return Array.isArray(s) ? s.filter(x => x && ID.test(x.id) && typeof x.hapus === 'string') : []; };
  function ikon(n) {
    const s = document.createElementNS(NS, 'svg'), u = document.createElementNS(NS, 'use');
    s.setAttribute('class', 'ik'); s.setAttribute('aria-hidden', 'true'); u.setAttribute('href', '#i-' + n); s.appendChild(u); return s;
  }
  function tombol(cls, n, teks) { const b = el('button', cls); b.type = 'button'; if (n) b.appendChild(ikon(n)); b.appendChild(document.createTextNode((n ? ' ' : '') + teks)); return b; }
  async function api(metode, q = '', badan, kepala = {}) {
    const r = await fetch('api/galeri' + q, { method: metode, headers: { ...(badan ? { 'content-type': 'application/json' } : {}), ...kepala }, ...(badan ? { body: JSON.stringify(badan) } : {}) });
    let j = {}; try { j = await r.json(); } catch (e) { /* bukan JSON (hosting statis) */ }
    return { status: r.status, ok: r.ok, j: j && typeof j === 'object' ? j : {} };
  }
  const urlAdegan = id => location.origin + location.pathname + '#l=' + id;
  function masuk(id) { if (!ID.test(id)) return; location.hash = '#l=' + id; location.reload(); }

  function gaya() {
    if (document.getElementById('pustakaGaya')) return;
    const s = document.createElement('style'); s.id = 'pustakaGaya';
    s.textContent = `#mulaiKartu.ada-galeri{max-height:calc(100% - 24px);overflow-y:auto}
.pustaka-awal{margin-top:16px;border-top:1px solid var(--line);padding-top:12px}
.pustaka-awal h3{font-size:.95rem;margin-bottom:2px}
.pustaka-awal .hint{margin-bottom:8px}
.pustaka-daftar{display:flex;gap:10px;overflow-x:auto;padding-bottom:6px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch}
.pustaka-kartu{flex:0 0 168px;scroll-snap-align:start;display:flex;flex-direction:column;align-items:stretch;gap:4px;text-align:left;padding:6px;border-radius:10px;background:var(--panel2);border:1px solid var(--line);color:var(--txt);font:inherit;cursor:pointer}
.pustaka-kartu:hover{border-color:var(--accent);background:#1f2a29}
.pustaka-gambar{display:grid;place-items:center;aspect-ratio:1200/630;border-radius:7px;overflow:hidden;background:#0c0c10}
.pustaka-gambar img{width:100%;height:100%;object-fit:cover}
.pustaka-gambar .ik{width:28px;height:28px;opacity:.5}
.pustaka-kartu b{font-size:.82rem;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pustaka-kartu small{font-size:.72rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pustaka-baris{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:4px 0}
.pustaka-baris span{flex:1;min-width:120px;font-size:.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#pustakaAjak{left:50%;top:50%;transform:translate(-50%,-50%);z-index:40;width:min(380px,calc(100% - 32px));padding:16px;border-radius:14px;display:flex;flex-direction:column;gap:8px}
#pustakaAjak input{width:100%}
#pustakaKunci{background:#212128;color:var(--txt);border:1px solid var(--line);padding:7px 8px;border-radius:8px;min-height:38px;width:100%;font:inherit;font-size:.86rem;outline:none;margin:6px 0}
#pustakaPemilik summary{cursor:pointer;font-size:.82rem;margin:8px 0 4px}`;
    document.head.appendChild(s);
  }

  /* ---------- halaman awal: kartu adegan yang sudah tayang ---------- */
  function kartu(x) {
    const b = el('button', 'pustaka-kartu'); b.type = 'button';
    const g = el('span', 'pustaka-gambar');
    if (/^https:\/\//.test(x.gambar || '')) { const i = document.createElement('img'); i.alt = ''; i.loading = 'lazy'; i.referrerPolicy = 'no-referrer'; i.src = x.gambar; g.appendChild(i); }
    else g.appendChild(ikon('atap'));
    b.appendChild(g); b.appendChild(el('b', null, x.judul || 'Adegan'));
    if (x.oleh) b.appendChild(el('small', null, x.oleh));
    b.onclick = () => masuk(x.id);
    return b;
  }
  async function galeriAwal() {
    const k = $('#mulaiKartu');
    if (!k || LIHAT.on || /^#(lihat|l)=/.test(location.hash) || document.getElementById('pustakaAwal')) return;
    let r; try { r = await api('GET'); } catch (e) { return; }
    const item = (r.ok && Array.isArray(r.j.item) ? r.j.item : []).filter(x => x && ID.test(x.id));
    if (!item.length) return;
    gaya();
    const w = el('div', 'pustaka-awal'); w.id = 'pustakaAwal';
    w.appendChild(el('h3', null, 'Galeri adegan'));
    w.appendChild(el('p', 'hint', 'Ketuk untuk masuk & jalan-jalan — dari dalam bisa mengajak teman main bareng.'));
    const d = el('div', 'pustaka-daftar'); for (const x of item) d.appendChild(kartu(x));
    w.appendChild(d); k.appendChild(w); k.classList.add('ada-galeri');
  }

  /* ---------- tab File: terbitkan, kiriman saya, alat pemilik ---------- */
  function renderSaya() {
    const w = $('#pustakaSaya'); if (!w) return;
    w.textContent = '';
    const saya = milikSaya(); if (!saya.length) return;
    w.appendChild(el('p', 'hint', 'Kiriman dari perangkat ini:'));
    for (const x of saya) {
      const r = el('div', 'pustaka-baris'); r.appendChild(el('span', null, x.judul || x.id));
      const lihat = tombol('btn sm ghost', 'mata', 'Lihat'); lihat.onclick = () => window.open(urlAdegan(x.id), '_blank', 'noopener');
      const tarik = tombol('btn sm danger', null, 'Tarik');
      tarik.onclick = async () => {
        if (!confirm('Tarik adegan ini dari galeri?')) return;
        tarik.disabled = true;
        try {
          const h = await api('DELETE', '?id=' + x.id, null, { 'x-hapus': x.hapus });
          if (!h.ok && h.status !== 404) { toast('Gagal menarik adegan — coba lagi'); tarik.disabled = false; return; }
          simpan('pustakaSaya', milikSaya().filter(y => y.id !== x.id)); renderSaya(); toast('Adegan ditarik dari galeri');
        } catch (e) { toast('Gagal menarik adegan — coba lagi'); tarik.disabled = false; }
      };
      r.appendChild(lihat); r.appendChild(tarik); w.appendChild(r);
    }
  }
  async function terbitkan() {
    const btn = $('#pustakaTerbit'), inf = $('#pustakaInfo');
    if (typeof CompressionStream !== 'function') return toast('Peramban ini belum bisa membuat tautan — perbarui ke iOS 16.4 / Chrome 80 ke atas');
    if (proyekKosong()) return toast('Proyek masih kosong — buat dinding atau muat rumah contoh dulu');
    btn.disabled = true; inf.textContent = 'Menyiapkan adegan…';
    try {
      const judul = ($('#bagikanJudul') && $('#bagikanJudul').value.trim()) || PROJECT.name;
      const t = await buatTautanLihat(() => {}, { bagikan: { judul, pesan: $('#bagikanPesan') ? $('#bagikanPesan').value : '', foto: true } });
      const m = t.pendek && /#l=([A-HJ-NP-Za-km-z2-9]{10})$/.exec(t.url);
      if (!m) { inf.textContent = 'Galeri butuh tautan pendek — aktifkan Vercel Blob di proyek Vercel (Storage → Blob), lalu Redeploy.'; return; }
      const k = kunci();
      const r = await api('POST', '', { id: m[1], oleh: $('#pustakaOleh').value.trim().slice(0, 40) }, k ? { 'x-kunci-galeri': k } : {});
      if (r.status === 501) { inf.textContent = 'Galeri belum aktif — pemilik situs perlu menambah GALERI_KUNCI di Environment Variables Vercel, lalu Redeploy.'; return; }
      if (r.status === 429) { inf.textContent = 'Antrean galeri sedang penuh — coba lagi nanti.'; return; }
      if (!r.ok || typeof r.j.hapus !== 'string') { inf.textContent = 'Gagal menerbitkan — server menolak (' + r.status + ').'; return; }
      simpan('pustakaSaya', [{ id: m[1], judul: String(judul).slice(0, 80), hapus: r.j.hapus }, ...milikSaya()].slice(0, 30));
      inf.textContent = r.j.status === 'tayang' ? 'Terbit — adegan tampil di galeri halaman awal.' : 'Terkirim — adegan tampil di galeri setelah disetujui pemilik situs.';
      renderSaya();
    } catch (e) { inf.textContent = 'Gagal menerbitkan — periksa koneksi lalu coba lagi.'; }
    finally { btn.disabled = false; }
  }
  // pemilik situs: kunci GALERI_KUNCI disimpan di perangkat ini saja, dikirim di kepala permintaan
  async function muatAntrean() {
    const w = $('#pustakaAntrean'), k = kunci(); if (!w) return;
    w.textContent = '';
    if (!k) return;
    w.appendChild(el('p', 'hint', 'Memuat…'));
    let r; try { r = await api('GET', '?semua=1', null, { 'x-kunci-galeri': k }); } catch (e) { r = { ok: false, status: 0, j: {} }; }
    w.textContent = '';
    if (r.status === 403) { w.appendChild(el('p', 'hint', 'Kunci galeri salah.')); return; }
    if (!r.ok) { w.appendChild(el('p', 'hint', r.status === 501 ? 'Galeri belum aktif — tambahkan GALERI_KUNCI di Environment Variables Vercel, lalu Redeploy.' : 'Antrean tidak bisa dimuat — periksa koneksi.')); return; }
    const kel = (judul, item, tunda) => {
      w.appendChild(el('p', 'hint', judul));
      if (!item.length) { w.appendChild(el('p', 'hint', '—')); return; }
      for (const x of item) {
        if (!x || !ID.test(x.id)) continue;
        const b = el('div', 'pustaka-baris'); b.appendChild(el('span', null, (x.judul || 'Adegan') + (x.oleh ? ' · ' + x.oleh : '')));
        const lihat = tombol('btn sm ghost', 'mata', 'Lihat'); lihat.onclick = () => window.open(urlAdegan(x.id), '_blank', 'noopener'); b.appendChild(lihat);
        const aksi = async (metode, q, pesan) => {
          const h = await api(metode, q, null, { 'x-kunci-galeri': k }).catch(() => ({ ok: false }));
          toast(h.ok ? pesan : 'Gagal — coba lagi'); muatAntrean();
        };
        if (tunda) { const s = tombol('btn sm', 'cek', 'Setujui'); s.onclick = () => aksi('POST', '?setujui=1&id=' + x.id, 'Adegan tayang di galeri'); b.appendChild(s); }
        const h = tombol('btn sm danger', null, tunda ? 'Tolak' : 'Turunkan');
        h.onclick = () => { if (confirm(tunda ? 'Tolak kiriman ini?' : 'Turunkan adegan ini dari galeri?')) aksi('DELETE', '?id=' + x.id, 'Adegan dihapus dari galeri'); };
        b.appendChild(h); w.appendChild(b);
      }
    };
    kel('Menunggu persetujuan:', Array.isArray(r.j.tunda) ? r.j.tunda : [], true);
    kel('Tayang di galeri:', Array.isArray(r.j.item) ? r.j.item : [], false);
  }
  function panelFile() {
    const jangkar = $('#bagikanHasil'); if (!jangkar || document.getElementById('pustakaTerbit')) return;
    gaya();
    const judul = el('div', 'section-title', 'Galeri adegan'), w = el('div'); w.id = 'pustakaPanel';
    w.appendChild(el('p', 'hint', 'Terbitkan adegan ini sebagai contoh di halaman awal: siapa pun bisa masuk, jalan-jalan & mengajak teman main bareng. Judul & pesan diambil dari kolom Bagikan di atas. Kiriman tayang setelah disetujui pemilik situs.'));
    const g = el('div', 'group'), lb = el('label', null, 'Nama pembuat (opsional)'); lb.htmlFor = 'pustakaOleh';
    const oleh = document.createElement('input'); oleh.type = 'text'; oleh.id = 'pustakaOleh'; oleh.maxLength = 40; oleh.placeholder = 'Mis. Studio Rumahku';
    try { oleh.value = localStorage.getItem('lobiNama') || ''; } catch (e) { /* mode privat */ }
    g.appendChild(lb); g.appendChild(oleh); w.appendChild(g);
    const t = tombol('btn', 'dunia', 'Terbitkan ke galeri'); t.id = 'pustakaTerbit'; t.onclick = terbitkan; w.appendChild(t);
    const inf = el('p', 'hint'); inf.id = 'pustakaInfo'; inf.setAttribute('aria-live', 'polite'); w.appendChild(inf);
    const saya = el('div'); saya.id = 'pustakaSaya'; w.appendChild(saya);
    // alat pemilik situs
    const det = document.createElement('details'); det.id = 'pustakaPemilik';
    det.appendChild(el('summary', null, 'Pemilik situs: setujui kiriman'));
    det.appendChild(el('p', 'hint', 'Isi dengan nilai GALERI_KUNCI yang kamu pasang di Environment Variables Vercel. Kunci hanya disimpan di perangkat ini.'));
    const kk = document.createElement('input'); kk.type = 'password'; kk.id = 'pustakaKunci'; kk.autocomplete = 'off'; kk.setAttribute('aria-label', 'Kunci galeri'); kk.placeholder = 'Kunci galeri';
    kk.addEventListener('keydown', e => e.stopPropagation());
    const row = el('div', 'row'), sm = tombol('btn sm', null, 'Simpan & muat antrean'), lp = tombol('btn sm ghost', null, 'Lupakan kunci');
    sm.onclick = () => { const v = kk.value.trim(); if (v.length < 12) { toast('Kunci galeri minimal 12 karakter'); return; } simpan('pustakaKunci', v); kk.value = ''; muatAntrean(); };
    lp.onclick = () => { simpan('pustakaKunci', null); muatAntrean(); toast('Kunci galeri dilupakan di perangkat ini'); };
    row.appendChild(sm); row.appendChild(lp);
    const antre = el('div'); antre.id = 'pustakaAntrean';
    det.appendChild(kk); det.appendChild(row); det.appendChild(antre);
    det.addEventListener('toggle', () => { if (det.open) muatAntrean(); });
    w.appendChild(det);
    jangkar.after(judul, w);
    renderSaya();
  }

  /* ---------- mode lihat: ajak teman main bareng di adegan ini ---------- */
  function dialogAjak() {
    const lama = document.getElementById('pustakaAjak'); if (lama) { lama.remove(); return; }
    gaya();
    const k = el('div', 'float'); k.id = 'pustakaAjak'; k.setAttribute('role', 'dialog');
    k.appendChild(el('h3', null, 'Ajak teman main bareng'));
    const hint = el('p', 'hint', 'Tulis namamu, buat ruang, lalu kirim undangannya. Teman yang membuka undangan masuk ke adegan ini bersamamu — jalan-jalan & mengobrol.');
    const inp = document.createElement('input'); inp.type = 'text'; inp.maxLength = 24; inp.placeholder = 'Namamu'; inp.setAttribute('aria-label', 'Namamu');
    try { inp.value = localStorage.getItem('lobiNama') || ''; } catch (e) { /* mode privat */ }
    inp.addEventListener('keydown', e => e.stopPropagation());
    const url = document.createElement('input'); url.type = 'text'; url.readOnly = true; url.hidden = true; url.setAttribute('aria-label', 'Tautan undangan');
    const info = el('p', 'hint'); info.setAttribute('aria-live', 'polite');
    const row = el('div', 'row'), buat = tombol('btn', 'orang', 'Buat ruang & undangan'), salin = tombol('btn sm', 'duplikat', 'Salin undangan'), kirimB = tombol('btn sm ghost', 'kirim', 'Kirim…'), tutup = tombol('btn sm ghost', null, 'Tutup');
    salin.hidden = kirimB.hidden = true;
    row.appendChild(buat); row.appendChild(salin); row.appendChild(kirimB); row.appendChild(tutup);
    k.appendChild(hint); k.appendChild(inp); k.appendChild(url); k.appendChild(row); k.appendChild(info);
    document.getElementById('viewport').appendChild(k);
    const siap = u => {
      url.value = u; url.hidden = false; salin.hidden = kirimB.hidden = false; buat.hidden = true; inp.hidden = true;
      hint.textContent = 'Ruang terbuka. Kirim undangan ini ke teman — undangan tetap berlaku walau kamu keluar.';
    };
    tutup.onclick = () => k.remove();
    salin.onclick = async () => { if (await salinTeks(url.value)) toast('Undangan disalin'); else { url.focus(); url.setSelectionRange(0, url.value.length); toast('Peramban menolak menyalin otomatis — tekan lama tautan di atas lalu pilih Salin'); } };
    kirimB.onclick = async () => {
      if (navigator.share) { try { await navigator.share({ title: PROJECT.name, text: 'Ayo masuk ke ' + PROJECT.name + ' bareng', url: url.value }); } catch (e) { /* dibatalkan */ } }
      else salin.click();
    };
    buat.onclick = async () => {
      const nama = inp.value.trim(); if (!nama) { inp.focus(); info.textContent = 'Nama wajib diisi'; return; }
      if (typeof RTCPeerConnection !== 'function') { info.textContent = 'Peramban ini tidak mendukung koneksi langsung (WebRTC)'; return; }
      buat.disabled = true; info.textContent = 'Menghubungkan…';
      try {
        await muatModul('lobi'); const L = window.LOBI;
        // adegan dari galeri / tautan pendek: undangan memakai tautan yang sama, tidak diunggah ulang
        const m = /^#l=([A-HJ-NP-Za-km-z2-9]{10})/.exec(location.hash);
        const tautan = m ? { url: urlAdegan(m[1]), urlBagikan: location.origin + '/l/' + m[1], pendek: true } : null;
        await L.buka({ nama, mode: 'lihat', tautan, bagikan: { judul: PROJECT.name, pesan: '', foto: true } });
        if (L.aktif && L.undangan) { siap(L.undangan); info.textContent = ''; } else info.textContent = 'Ruang gagal dibuka — coba lagi';
      } catch (e) { info.textContent = 'Ruang gagal dibuka: ' + (e.message || e); }
      finally { buat.disabled = false; }
    };
    if (window.LOBI && window.LOBI.aktif && window.LOBI.undangan) siap(window.LOBI.undangan);
    else setTimeout(() => inp.focus(), 50);
  }
  function tombolLihat() {
    const bar = $('#lihatBar'); if (!bar || document.getElementById('lihatAjak')) return;
    const b = tombol('btn ghost', 'orang', 'Ajak teman'); b.id = 'lihatAjak'; b.title = 'Ajak teman main bareng di adegan ini';
    b.onclick = dialogAjak;
    const bahasa = $('#lihatBahasa'); if (bahasa) bar.insertBefore(b, bahasa); else bar.appendChild(b);
  }

  panelFile(); tombolLihat(); galeriAwal();
  window.PUSTAKA = { galeriAwal, terbitkan, muatAntrean, dialogAjak, renderSaya };
})();
