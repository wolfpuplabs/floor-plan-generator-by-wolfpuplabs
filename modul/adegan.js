/* Plan23D — ADEGAN / AREA (JEV-105)
   Satu proyek bisa berisi beberapa area (mis. rumah, pantai, kafe). Area yang sedang dibuka adalah isi
   proyek biasa (lantai, situs, finishing, atap, musik latar, cuaca, langit); area lain disimpan sebagai
   potret di PROJECT.adegan[].isi. Aset, media, tekstur & gambar denah dipakai bersama semua area.
   Pindah area: potret area sekarang disimpan (beserta posisi terakhir di mode jalan), isi area tujuan
   dipasang, adegan dibangun ulang. Di mode jalan objek berinteraksi "Pindah ke adegan" membawa pengunjung
   ke area lain — muncul di depan objek yang mengarah balik, di posisi terakhirnya, atau di tengah denah. */
/* global PROJECT, KUNCI_ADEGAN, FPS, LIHAT, camera, enterFPS, exitFPS, toast, $, el, tombolIkon, rebuildScene, renderLevels,
   renderSitusUI, renderFinishUI, renderAtapUI, resetHistory, newLevel, hentikanBGM, ATAP_TUTUP:writable, SEL:writable, renderInspector,
   muatLangitFoto, matikanLangitFoto, renderLangitUI, FOTO, laporAdegan */
(function () {
  'use strict';
  const MAKS = 8;
  const salin = o => JSON.parse(JSON.stringify(o));
  const idBaru = () => 'a' + Math.random().toString(36).slice(2, 10);
  const cari = id => (PROJECT.adegan || []).find(a => a.id === id);
  function potret() { const o = {}; for (const k of KUNCI_ADEGAN) if (PROJECT[k] !== undefined) o[k] = salin(PROJECT[k]); return o; }
  // proyek tanpa daftar adegan = satu area; daftar dibuat saat area kedua ditambahkan
  function pastikan() {
    if (PROJECT.adegan && PROJECT.adegan.length && cari(PROJECT.adeganKini)) return;
    const id = idBaru(); PROJECT.adegan = [{ id, nama: 'Area 1' }]; PROJECT.adeganKini = id;
  }
  function pasangIsi(isi) {
    for (const k of KUNCI_ADEGAN) delete PROJECT[k];
    Object.assign(PROJECT, salin(isi));
    const tutup = !!(PROJECT.atap && PROJECT.atap.tutup); if (ATAP_TUTUP !== tutup) ATAP_TUTUP = tutup;
    hentikanBGM(); SEL = null;
    renderSitusUI(); renderFinishUI(); renderAtapUI(); renderLevels();
    if (PROJECT.langit && PROJECT.langit.mode === 'foto') muatLangitFoto({ id: PROJECT.langit.id, nama: PROJECT.langit.nama });
    else if (FOTO.tex) matikanLangitFoto(); else renderLangitUI();
  }
  // titik muncul: di depan objek yang mengarah balik ke area asal, posisi terakhir di area ini, atau bawaan enterFPS
  function titikMuncul(tuju, asal) {
    for (let li = 0; li < PROJECT.levels.length; li++) for (const o of PROJECT.levels[li].objects) {
      const a = o.params && o.params.aksi; if (!a || a.pindah !== asal) continue;
      const r = o.rotY || 0, dx = Math.sin(r), dz = Math.cos(r);
      return { x: o.x + dx * 1.4, z: o.z + dz * 1.4, yaw: Math.atan2(dx, dz), lantai: li };
    }
    return tuju.masuk || null;
  }
  function buka(id, opsi = {}) {
    const tuju = cari(id), asal = PROJECT.adeganKini;
    if (!tuju || id === asal || !tuju.isi) return false;
    const jalan = FPS.on || !!opsi.jalan, kini = cari(asal);
    if (kini) { kini.isi = potret(); if (FPS.on) kini.masuk = { x: camera.position.x, z: camera.position.z, yaw: FPS.yaw, lantai: PROJECT.active }; }
    if (FPS.on) exitFPS();
    pasangIsi(tuju.isi); delete tuju.isi; PROJECT.adeganKini = id;
    rebuildScene(); resetHistory('Adegan: ' + tuju.nama);
    if (jalan || LIHAT.on) {
      const m = titikMuncul(tuju, asal);
      if (m) PROJECT.active = Math.min(m.lantai | 0, PROJECT.levels.length - 1);
      enterFPS();
      if (m && FPS.on) { camera.position.x = m.x; camera.position.z = m.z; FPS.yaw = m.yaw; }
    }
    if (typeof laporAdegan === 'function') laporAdegan();
    toast('📍 ' + tuju.nama); render();
    return true;
  }
  function tambah(isi, nama) {
    pastikan();
    if (PROJECT.adegan.length >= MAKS) { toast(`Maksimal ${MAKS} adegan per proyek`); return null; }
    const id = idBaru(); PROJECT.adegan.push({ id, nama, isi }); return id;
  }
  // area baru: satu lantai kosong di atas rumput bawaan
  function baru() {
    const id = tambah({ levels: [newLevel('L1', 3)], active: 0, pxPerMeter: PROJECT.pxPerMeter, finish: salin(PROJECT.finish), atap: { tritisan: 0.6, tebal: 0.12 },
      site: { tanah: 'rumput', margin: 6 }, langit: salin(PROJECT.langit) }, 'Area ' + ((PROJECT.adegan || []).length + 1));
    if (id) buka(id);
  }
  function duplikat() {
    const kini = cari(PROJECT.adeganKini);
    const id = tambah(potret(), ((kini && kini.nama) || 'Area') + ' (salinan)');
    if (id) buka(id);
  }
  function hapus(id) {
    const a = cari(id); if (!a || id === PROJECT.adeganKini) return;
    if (!confirm('Hapus adegan "' + a.nama + '"? Isinya ikut terhapus.')) return;
    PROJECT.adegan = PROJECT.adegan.filter(x => x !== a);
    for (const lv of PROJECT.levels) for (const o of lv.objects) { const k = o.params && o.params.aksi; if (k && k.pindah === id) delete k.pindah; }
    if (PROJECT.adegan.length < 2) { delete PROJECT.adegan; delete PROJECT.adeganKini; }
    rebuildScene(); if (SEL) renderInspector(); render();
  }
  function render() {
    const w = $('#adeganDaftar'); if (!w) return;
    w.textContent = '';
    const daf = PROJECT.adegan || [];
    if (!daf.length) { w.appendChild(el('p', 'hint', 'Proyek ini satu area. Tambah area baru untuk tempat lain (pantai, kafe, taman…).')); return; }
    for (const a of daf) {
      const kini = a.id === PROJECT.adeganKini, r = el('div', 'row');
      const nm = document.createElement('input'); nm.type = 'text'; nm.value = a.nama; nm.maxLength = 40; nm.setAttribute('aria-label', 'Nama adegan'); nm.style.flex = '1';
      nm.onchange = () => { a.nama = nm.value.trim().slice(0, 40) || a.nama; nm.value = a.nama; rebuildScene(); };
      const b = tombolIkon('btn sm' + (kini ? '' : ' ghost'), kini ? 'cek' : 'buka', kini ? 'Dibuka' : 'Buka'); b.disabled = kini; b.onclick = () => buka(a.id);
      const h = el('button', 'btn sm danger', '×'); h.title = 'Hapus adegan'; h.setAttribute('aria-label', 'Hapus adegan ' + a.nama); h.disabled = kini; h.onclick = () => hapus(a.id);
      r.append(nm, b, h); w.appendChild(r);
    }
  }
  window.ADEGAN = { buka, baru, duplikat, hapus, render, daftar: () => (PROJECT.adegan || []).map(a => ({ id: a.id, nama: a.nama, kini: a.id === PROJECT.adeganKini })) };
})();
