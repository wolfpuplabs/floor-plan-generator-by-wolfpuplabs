/* Plan23D — INFO BERKAS 3D SEBELUM DIUNDUH (JEV-091)
   Dimuat saat kartu di galeri model diketuk. Panel menampilkan apa yang akan diunduh — ukuran
   berkas, jumlah segitiga, tekstur, lisensi, pembuat — lalu baru mengunduh setelah pengguna
   menekan "Unduh & pasang". Data dari API sumbernya (Poly Haven: daftar berkas & info; Sketchfab:
   arsip GLB di hasil pencarian; Khronos: katalog terkurasi; Google Scanned Objects: ukuran ZIP
   lewat HEAD). Semua teks dari sumber luar hanya lewat textContent. */
/* global $, el, fmt, GALERI, GSO, SKF, KHR_DASAR */
(function () {
  'use strict';
  const mb = b => (b > 0 ? fmt(b / 1048576, 1) + ' MB' : '—');
  const ribu = n => (n > 0 ? (n >= 1e6 ? fmt(n / 1e6, 1) + 'M' : n >= 1e3 ? fmt(n / 1e3, 0) + 'k' : String(n)) : '—');
  const SUMBER = { ph: 'Poly Haven — fotogrametri', khr: 'Produk nyata — Khronos glTF Sample Assets', skf: 'Sketchfab', gso: 'Google Scanned Objects (scan 3D)' };
  let panel = null, henti = null;

  function siapkan() {
    if (panel) return panel;
    const st = document.createElement('style');
    st.textContent = '.gl-detail{position:absolute;inset:0;z-index:2;background:var(--panel);display:flex;flex-direction:column;overflow:auto;padding:14px 16px;gap:10px}'
      + '.gl-detail .gd-atas{display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap}'
      + '.gl-detail img{width:min(220px,100%);aspect-ratio:1;object-fit:contain;background:#2a2a31;border-radius:8px}'
      + '.gl-detail h3{margin:0 0 4px;font-size:1rem;color:var(--txt)}.gl-detail .gd-isi{flex:1 1 240px;min-width:0}'
      + '.gl-detail dl{display:grid;grid-template-columns:max-content 1fr;gap:4px 12px;margin:8px 0 0;font-size:.78rem}'
      + '.gl-detail dt{color:var(--muted)}.gl-detail dd{margin:0;color:var(--txt);overflow-wrap:anywhere}'
      + '.gl-detail .gd-res{display:flex;gap:8px;flex-wrap:wrap}.gl-detail .gd-tombol{display:flex;gap:8px;flex-wrap:wrap;margin-top:auto}'
      + '.gl-detail .gd-catat{font-size:.74rem;color:var(--muted);margin:0}.gl-detail .gd-awas{color:var(--warn)}';
    document.head.appendChild(st);
    panel = el('div', 'gl-detail'); panel.id = 'galeriDetail'; panel.setAttribute('role', 'dialog'); panel.hidden = true;
    const box = $('#galeri .gl-box'); box.style.position = 'relative'; box.appendChild(panel);
    $('#galeriTutup').addEventListener('click', tutup);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) tutup(); });
    return panel;
  }
  function tutup() { if (henti) henti.abort(); henti = null; if (panel) panel.hidden = true; }

  // data tambahan dari API sumber (bisa gagal: panel tetap tampil dengan yang sudah diketahui)
  async function meta(sumber, m, signal) {
    if (sumber === 'ph') {
      const ambil = u => fetch(u, { mode: 'cors', signal }).then(r => (r.ok ? r.json() : null)).catch(e => { if (e.name === 'AbortError') throw e; return null; });
      const [f, i] = await Promise.all([ambil('https://api.polyhaven.com/files/' + encodeURIComponent(m.id)), ambil('https://api.polyhaven.com/info/' + encodeURIComponent(m.id))]);
      const uk = res => { const g = f && f.gltf && f.gltf[res] && f.gltf[res].gltf; return g ? Object.values(g.include || {}).reduce((s, v) => s + (+v.size || 0), +g.size || 0) : 0; };
      return { u2: uk('2k'), u1: uk('1k'), tri: (i && +i.polycount) || 0 };
    }
    if (sumber === 'gso') {
      try { const r = await fetch(GSO.dasar + '/' + encodeURIComponent(m.id) + '.zip', { method: 'HEAD', signal }); return { u: +r.headers.get('content-length') || 0 }; }
      catch (e) { if (e.name === 'AbortError') throw e; return {}; }
    }
    return {};
  }

  function baris(dl, k, v) { dl.append(el('dt', null, k), el('dd', null, v)); }
  function isi(sumber, m, x, pasang) {
    const p = panel; p.textContent = '';
    const atas = el('div', 'gd-atas'), im = document.createElement('img'); im.alt = '';
    const thumb = sumber === 'ph' ? `https://cdn.polyhaven.com/asset_img/thumbs/${m.id}.png?width=256&height=256`
      : sumber === 'khr' ? KHR_DASAR + m.id + '/screenshot/screenshot.jpg' : m.thumb;
    if (thumb && /^https:\/\//.test(thumb)) im.src = thumb; im.onerror = () => { im.style.visibility = 'hidden'; };
    const kanan = el('div', 'gd-isi'); kanan.append(el('h3', null, m.nama), el('p', 'gd-catat', SUMBER[sumber] || ''));
    const dl = document.createElement('dl');
    const lis = sumber === 'ph' ? 'CC0 (domain publik)' : sumber === 'gso' ? 'CC-BY 4.0 — Google Research' : sumber === 'khr' ? m.lisensi : m.lis;
    baris(dl, 'Lisensi', lis || '—');
    if (sumber === 'skf' && m.pembuat) baris(dl, 'Pembuat', m.pembuat);
    let ukuran = sumber === 'khr' ? m.b : sumber === 'skf' ? m.ukuran : sumber === 'gso' ? x.u : 0;
    if (sumber === 'ph') {
      const r = $('#galeriRes').value === '1k' ? '1k' : '2k'; ukuran = r === '1k' ? x.u1 : x.u2;
      baris(dl, 'Ukuran unduhan', x.u2 || x.u1 ? `2K: ${mb(x.u2)} · 1K: ${mb(x.u1)}` : 'dicek…');
    } else baris(dl, 'Ukuran unduhan', ukuran ? mb(ukuran) : sumber === 'gso' ? 'tidak diketahui' : '—');
    baris(dl, 'Segitiga', sumber === 'skf' || sumber === 'ph' ? ribu(m.tri || x.tri) : '—');
    if (sumber === 'skf') baris(dl, 'Tekstur', m.teks ? `${m.teks} gambar${m.teksRes ? ` · maks. ${m.teksRes} px` : ''}` : '—');
    baris(dl, 'Format', sumber === 'gso' ? 'ZIP (OBJ + tekstur) → GLB' : sumber === 'ph' ? 'glTF + tekstur foto → GLB' : 'GLB');
    if (sumber === 'khr') baris(dl, 'Keamanan', 'SHA-256 diverifikasi setelah diunduh');
    if (sumber === 'khr' && m.p && m.p.interaksi) baris(dl, 'Interaksi', m.p.interaksi === 'duduk' ? 'langsung bisa diduduki' : m.p.interaksi === 'lampu' ? 'lampu langsung menyala' : m.p.interaksi);
    kanan.appendChild(dl);
    if (sumber === 'ph') {
      const pilih = el('div', 'gd-res');
      for (const [v, t] of [['2k', 'Tekstur 2K — ultra'], ['1k', 'Tekstur 1K — ringan']]) {
        const b = el('button', 'btn sm' + ($('#galeriRes').value === v ? '' : ' ghost'), t); b.type = 'button';
        b.onclick = () => { $('#galeriRes').value = v; isi(sumber, m, x, pasang); }; pilih.appendChild(b);
      }
      kanan.appendChild(pilih);
    }
    atas.append(im, kanan); p.appendChild(atas);
    p.appendChild(el('p', 'gd-catat', 'Setelah diunduh, tekstur warna & normal disimpan maks. 2048 px (tajam), peta lain 1024 px, semuanya dikompres JPEG — ukuran proyek tetap ringan.'));
    if (ukuran > 25 * 1048576) p.appendChild(el('p', 'gd-catat gd-awas', '⚠ Berkas besar — unduhan bisa lama di data seluler.'));
    if (sumber === 'skf' && !SKF.token) p.appendChild(el('p', 'gd-catat gd-awas', '⚠ Sketchfab butuh token API untuk mengunduh — isi tokennya di atas galeri.'));
    const tb = el('div', 'gd-tombol'), unduh = el('button', 'btn', GALERI.tujuan ? 'Unduh & pakai' : 'Unduh & pasang'), batal = el('button', 'btn ghost', 'Batal');
    unduh.type = batal.type = 'button';
    unduh.onclick = () => { tutup(); pasang(); }; batal.onclick = tutup;
    tb.append(unduh, batal); p.appendChild(tb); unduh.focus();
  }

  async function tampil(sumber, m, pasang) {
    siapkan(); if (henti) henti.abort();
    henti = new AbortController(); const sinyal = henti.signal;
    panel.hidden = false; isi(sumber, m, {}, pasang);
    try { const x = await meta(sumber, m, sinyal); if (!sinyal.aborted && !panel.hidden) isi(sumber, m, x, pasang); }
    catch (e) { /* dibatalkan / gagal: info dasar tetap tampil */ }
  }

  window.INFOMODEL = { tampil, tutup };
})();
