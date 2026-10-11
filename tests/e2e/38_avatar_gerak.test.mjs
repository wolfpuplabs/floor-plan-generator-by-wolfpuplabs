import assert from 'node:assert/strict';

// JEV-089: avatar 3D lobi bergerak — tanpa klip animasi, kerangka humanoid digerakkan prosedural
// (kaki & lengan berayun saat berjalan, napas saat diam). Tulang dikenali dari pemetaan VRM atau dari
// nama (Mixamo / Avaturn / VRoid mentah); arah ayunan dihitung terhadap sumbu samping avatar.
export const tes = {
  'avatar 3D: tebakan kerangka dari nama tulang & ayunan kaki/lengan saat berjalan, diam saat berhenti': async (page) => {
    const r = await page.evaluate(async () => {
      await muatModul('lobi');
      // kerangka gaya Mixamo: Hips → LeftUpLeg → LeftLeg → LeftFoot, Spine → LeftArm → LeftForeArm (± kanan)
      const tulang = n => { const b = new THREE.Bone(); b.name = n; return b; };
      const hips = tulang('mixamorig:Hips'); hips.position.y = 1;
      const kaki = s => { const up = tulang(`mixamorig:${s}UpLeg`), low = tulang(`mixamorig:${s}Leg`), foot = tulang(`mixamorig:${s}Foot`);
        up.position.x = s === 'Left' ? 0.1 : -0.1; low.position.y = -0.45; foot.position.y = -0.45; up.add(low); low.add(foot); hips.add(up); return foot; };
      const spine = tulang('mixamorig:Spine'); spine.position.y = 0.3; hips.add(spine);
      const lengan = s => { const up = tulang(`mixamorig:${s}Arm`), low = tulang(`mixamorig:${s}ForeArm`), hand = tulang(`mixamorig:${s}Hand`);
        up.position.set(s === 'Left' ? 0.2 : -0.2, 0.2, 0); low.position.y = -0.28; hand.position.y = -0.25; up.add(low); low.add(hand); spine.add(up); return hand; };
      const kakiKiri = kaki('Left'), kakiKanan = kaki('Right'), tanganKiri = lengan('Left'); lengan('Right');
      const m = new THREE.Group(); m.add(hips);
      const rig = {}; LOBI.gerak.tebakRig(m, rig);
      const urut = []; m.traverse(n => urut.push(n)); m.userData.rigIdx = Object.fromEntries(Object.entries(rig).map(([k, n]) => [k, urut.indexOf(n)]));
      const g = new THREE.Group(); g.rotation.y = 0.7; scene.add(g); g.add(m);       // avatar menghadap arah sembarang
      const a = { g }; LOBI.gerak.siapkanGerak(a, m);
      // posisi dalam ruang avatar (+Z = depan)
      const lokal = o => { g.updateMatrixWorld(true); return g.worldToLocal(o.getWorldPosition(new THREE.Vector3())); };
      const z0 = lokal(kakiKiri).z;
      a.w = 1; a.fase = Math.PI / 2 - 0.0001; LOBI.gerak.gerakAvatar(a, 0.0001, 1.3);   // puncak ayunan: kaki kiri di depan
      const langkah = { kiri: lokal(kakiKiri).z, kanan: lokal(kakiKanan).z, tangan: lokal(tanganKiri).z };
      for (let i = 0; i < 120; i++) LOBI.gerak.gerakAvatar(a, 1 / 30, 0);                // berhenti → kembali diam
      const diam = { w: a.w, kiri: lokal(kakiKiri).z };
      scene.remove(g);
      return { kunci: Object.keys(rig).sort(), z0, langkah, diam };
    });
    assert.deepEqual(r.kunci, ['hips', 'leftLowerArm', 'leftLowerLeg', 'leftUpperArm', 'leftUpperLeg', 'rightLowerArm', 'rightLowerLeg', 'rightUpperArm', 'rightUpperLeg', 'spine']);
    assert.ok(r.langkah.kiri > r.z0 + 0.2, 'kaki kiri maju: ' + JSON.stringify(r));
    assert.ok(r.langkah.kanan < r.z0 - 0.2, 'kaki kanan mundur');
    assert.ok(r.langkah.tangan < -0.05, 'tangan kiri berayun ke belakang (berlawanan dengan kaki kiri)');
    assert.ok(r.diam.w < 0.01 && Math.abs(r.diam.kiri - r.z0) < 0.03, 'diam: kaki kembali lurus ' + JSON.stringify(r.diam));
  },
};
