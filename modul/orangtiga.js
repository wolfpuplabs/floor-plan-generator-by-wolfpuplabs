/* Plan23D — TAMPILAN ORANG KETIGA (JEV-122)
   Mode jalan: kamera di belakang-atas pemain, avatar pemain sendiri terlihat (karakter pilihan di panel Main bareng — warna,
   pakaian, baju renang saat berenang — atau Karakter M bila belum memilih) dengan pose yang sama seperti yang dilihat teman
   (jalan, duduk, berbaring, berenang, gaya). Logika permainan tetap memakai kamera di kepala pemain: kamera hanya dipindah
   sesaat ketika digambar lalu dikembalikan, jadi bidikan, NPC, aktivitas & lobi tidak berubah. Kamera maju mendekat bila
   terhalang dinding / benda. Pilihan diingat di perangkat. */
/* global FPS, camera, scene, levelGroups, AVATAR_LOBI, muatModul, toast, klonModel, bayangKotor, $ */
(function () {
  'use strict';
  const JARAK = 2.8, TINGGI = 0.35;
  const S = { on: false, g: null, a: null, kunci: '', baju: '', memuat: false, d: JARAK, t: 0, lalu: null, ray: new THREE.Raycaster() };
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3(), qA = new THREE.Quaternion();
  try { S.on = localStorage.getItem('kamera3') === '1'; } catch (e) { S.on = false; }

  const dataAvatar = () => (typeof AVATAR_LOBI !== 'undefined' && AVATAR_LOBI.d) || { bawaan: 'M', benih: 7 };
  // pakaian: pilihan tetap, atau baju renang selama berpose berenang (17 / 18) — seperti avatar Main bareng
  function sufiks(d, po) {
    if (!d.bawaan) return '';
    if (d.baju) return '_' + d.baju;
    return (po === 17 || po === 18) && window.LOBI ? window.LOBI.sufiksRenang(d.bawaan, d.benih || 0) : '';
  }
  async function rakit(po) {
    const d = dataAvatar(), suf = sufiks(d, po), kunci = JSON.stringify(d) + suf;
    if (S.memuat || (S.a && S.kunci === kunci)) return;
    S.memuat = true;
    try {
      await muatModul('lobi');
      let tpl = null;
      if (suf) tpl = await window.LOBI.muatAvatar3D({ bawaan: d.bawaan + suf }).catch(() => null);
      const pakaiSuf = tpl ? suf : '';
      if (!tpl) tpl = await window.LOBI.muatAvatar3D(d);
      const m = klonModel(tpl); m.userData.rigIdx = tpl.userData.rigIdx; m.userData.kedipIdx = tpl.userData.kedipIdx; m.userData.klip = tpl.userData.klip;
      if (d.bawaan) { await muatModul('npc'); window.NPC.warnaiAvatar(m, tpl, d.bawaan, d.benih || 0, pakaiSuf, d.warna); }
      m.traverse(x => { if (x.isMesh) { x.raycast = () => {}; x.castShadow = true; x.frustumCulled = false; x.userData.noExport = true; } });
      const lama = S.a;
      if (!S.g) { S.g = new THREE.Group(); S.g.visible = false; S.g.userData.noExport = true; scene.add(S.g); }
      if (lama && lama.model) S.g.remove(lama.model);
      S.g.add(m);
      const a = { g: S.g, tuju: { po: 0 } }; window.LOBI.gerak.siapkanGerak(a, m);
      if (lama) for (const k of ['pw', 'w', 'v']) if (lama[k] != null) a[k] = Array.isArray(lama[k]) ? lama[k].slice() : lama[k];
      S.a = a; S.kunci = JSON.stringify(d) + pakaiSuf; S.baju = pakaiSuf;
      if (pakaiSuf !== suf) S.kunci = kunci;            // berkas baju tidak ada: jangan coba terus
    } catch (e) { console.warn('orang ketiga', e); toast('Avatar orang ketiga tidak bisa dimuat'); S.on = false; tombol(); }
    finally { S.memuat = false; }
  }
  function tombol() { const b = $('#fpsO3'); if (b) { b.setAttribute('aria-pressed', S.on ? 'true' : 'false'); b.classList.toggle('on', S.on); } }
  function togel() {
    S.on = !S.on; try { localStorage.setItem('kamera3', S.on ? '1' : '0'); } catch (e) { /* mode privat */ }
    tombol(); if (S.on) rakit(0);
    toast(S.on ? '👤 Kamera orang ketiga' : '👁 Kamera orang pertama');
  }
  // kamera dibatasi benda di antara kepala & kamera (dinding, perabot) — sprite / garis / tembus pandang diabaikan
  function jarakBebas(dari, arah, maks) {
    S.ray.set(dari, arah); S.ray.far = maks + 0.3; S.ray.camera = camera;
    const hits = S.ray.intersectObjects(levelGroups.filter(Boolean), true);
    for (const h of hits) { const o = h.object, m = o.material; if (!o.isMesh || !o.visible || o.userData.halo || (m && (m.transparent || m.visible === false))) continue; return Math.max(0.35, h.distance - 0.25); }
    return maks;
  }
  function render(gambar) {
    const kini = performance.now(), dt = S.lalu == null ? 0 : Math.min(0.1, (kini - S.lalu) / 1000); S.lalu = kini;
    if (!S.on || !FPS.on) { if (S.g) S.g.visible = false; return gambar(); }
    const pos = window.LOBI && window.LOBI.gerak ? window.LOBI.gerak.posSaya() : null;
    if (!S.a || S.memuat || !pos || !pos.jalan) { rakit(pos && pos.po); if (S.g) S.g.visible = false; return gambar(); }
    if (sufiks(dataAvatar(), pos.po) !== S.baju || JSON.stringify(dataAvatar()) + S.baju !== S.kunci) rakit(pos.po);
    // avatar di tempat pemain (titik kaki & arah hadap sama seperti yang dikirim ke teman Main bareng)
    const g = S.g, x0 = g.position.x, z0 = g.position.z;
    g.position.set(pos.x, pos.y, pos.z); g.rotation.y = pos.yaw;
    const laju = dt > 0 ? Math.hypot(g.position.x - x0, g.position.z - z0) / dt : 0;
    S.a.tuju.po = pos.po || 0; window.LOBI.gerak.gerakAvatar(S.a, dt, laju > 8 ? 0 : laju);
    if (laju > 0.02 || S.a.w > 0.02) bayangKotor();
    // kamera: di belakang arah pandang & sedikit di atas kepala, maju bila terhalang
    const kepala = vA.copy(camera.position).setY(camera.position.y + 0.1);
    const arah = vB.set(Math.sin(FPS.yaw) * Math.cos(FPS.pitch), Math.sin(FPS.pitch), Math.cos(FPS.yaw) * Math.cos(FPS.pitch));
    const mundur = vC.copy(arah).multiplyScalar(-1).add(new THREE.Vector3(0, TINGGI / JARAK, 0)).normalize();
    const bebas = jarakBebas(kepala, mundur, JARAK);
    S.d = bebas < S.d ? bebas : S.d + (bebas - S.d) * Math.min(1, dt * 4);
    const simpan = camera.position.clone(); qA.copy(camera.quaternion);
    camera.position.copy(kepala).addScaledVector(mundur, S.d);
    camera.lookAt(kepala.x + arah.x * 3, kepala.y + arah.y * 3, kepala.z + arah.z * 3); camera.updateMatrixWorld();
    g.visible = true;
    try { gambar(); }
    finally { g.visible = false; camera.position.copy(simpan); camera.quaternion.copy(qA); camera.updateMatrixWorld(); }
  }
  tombol();
  window.ORANG3 = { togel, render, aktif: () => S.on && FPS.on, _uji: { S } };
})();
