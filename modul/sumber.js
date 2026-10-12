/* Plan23D — SUMBER SUARA OTOMATIS DI OBJEK (JEV-098)
   Objek dengan "Putar otomatis dari objek" memutar track audionya sendiri begitu mode jalan / tautan
   lihat dimulai — suara 3D yang datang dari objeknya (HRTF) dan mengecil linear sampai senyap di batas
   jangkauannya, jadi radio di teras, air mancur, atau speaker kafe terdengar saat didekati. Daftar
   track diputar bergiliran (berurutan / acak, terus berulang). Mengetuk objeknya mematikan /
   menyalakan lagi sumber itu. Video dilewati (hanya audio). Dimuat hanya bila ada objek seperti ini. */
/* global aksiObjek, grupObjek, titikGrup, audioSiap, AUDIO, PROJECT, bufFromB64, urutanTrek */
(function () {
  'use strict';
  const BUF = new Map(), JALAN = new Map(), MATI = new Set();   // MATI: dimatikan pengunjung sampai keluar mode

  function buffer(ctx, mid) {
    if (!BUF.has(mid)) BUF.set(mid, ctx.decodeAudioData(bufFromB64(PROJECT.media[mid].data)).catch(e => { BUF.delete(mid); throw e; }));
    return BUF.get(mid);
  }
  const audioSaja = ak => (ak.mediaDaftar || []).filter(m => PROJECT.media[m] && /^audio\//.test(PROJECT.media[m].mime));
  const tanda = ak => audioSaja(ak).join() + '|' + ak.mediaJarak + '|' + !!ak.mediaAcak;

  function posisi(S) {
    const g = grupObjek(S.id)[0]; if (!g) return;
    const p = titikGrup(g), y = p.y + 0.3;
    if (S.pan.positionX) { S.pan.positionX.value = p.x; S.pan.positionY.value = y; S.pan.positionZ.value = p.z; } else S.pan.setPosition(p.x, y, p.z);
  }
  function mulai(id, ak) {
    const ctx = audioSiap(), daf = audioSaja(ak); if (!ctx || !daf.length) return;
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    const pan = ctx.createPanner(); pan.panningModel = 'HRTF'; pan.distanceModel = 'linear'; pan.refDistance = 1; pan.maxDistance = ak.mediaJarak; pan.rolloffFactor = 1;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, ctx.currentTime); g.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.2);   // masuk pelan
    g.connect(pan); pan.connect(AUDIO.master);
    const S = { id, pan, g, daf, acak: !!ak.mediaAcak, urutan: urutanTrek(daf, ak.mediaAcak, null), k: 0, src: null, tanda: tanda(ak) };
    JALAN.set(id, S); posisi(S); putar(S);
  }
  async function putar(S) {
    const ctx = AUDIO.ctx, mid = S.urutan[S.k];
    let b; try { b = await buffer(ctx, mid); } catch (e) { console.warn('sumber suara', mid, e); return; }
    if (JALAN.get(S.id) !== S) return;
    const src = S.src = ctx.createBufferSource(); src.buffer = b; src.loop = S.daf.length < 2; src.connect(S.g);
    src.onended = () => {
      if (JALAN.get(S.id) !== S || S.src !== src) return;
      if (++S.k >= S.urutan.length) { S.urutan = urutanTrek(S.daf, S.acak, mid); S.k = 0; }
      putar(S);
    };
    src.start();
  }
  function henti1(id) {
    const S = JALAN.get(id); if (!S) return; JALAN.delete(id);
    const src = S.src; S.src = null;
    try { S.g.gain.cancelScheduledValues(AUDIO.ctx.currentTime); S.g.gain.setTargetAtTime(0, AUDIO.ctx.currentTime, 0.12); } catch (e) { /* abaikan */ }
    setTimeout(() => { try { if (src) src.stop(); } catch (e) { /* sudah berhenti */ } try { S.pan.disconnect(); } catch (e) { /* abaikan */ } }, 600);
  }
  // dipanggil tiap adegan dibangun di mode jalan / lihat: mulai yang baru, geser yang ada, hentikan yang hilang
  function segarkan() {
    const ada = new Set();
    for (const lv of PROJECT.levels) for (const o of lv.objects) {
      const ak = aksiObjek(o); if (!ak || !ak.mediaOto || MATI.has(o.id) || !audioSaja(ak).length) continue;
      ada.add(o.id);
      const S = JALAN.get(o.id);
      if (S && S.tanda !== tanda(ak)) { henti1(o.id); mulai(o.id, ak); } else if (S) posisi(S); else mulai(o.id, ak);
    }
    for (const id of [...JALAN.keys()]) if (!ada.has(id)) henti1(id);
  }
  function henti() { for (const id of [...JALAN.keys()]) henti1(id); MATI.clear(); }
  function togel(id) { if (JALAN.has(id)) { henti1(id); MATI.add(id); } else { MATI.delete(id); segarkan(); } }
  window.SUMBER = { segarkan, henti, togel, aktif: id => JALAN.has(id), _jalan: JALAN };
})();
