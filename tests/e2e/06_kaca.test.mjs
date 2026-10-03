import assert from 'node:assert/strict';

// JEV-055: kaca realistis — bening dari depan, memantul kuat dari sudut miring (Fresnel),
// dan kaca di model unggahan/katalog (KHR_materials_transmission) memakai shader yang sama
export const tes = {
  'kaca: bening tegak lurus, memantul saat miring': async (page) => {
    const galatShader = [];
    page.on('console', m => { if (/shader error|WebGLProgram/i.test(m.text())) galatShader.push(m.text().slice(0, 200)); });
    const r = await page.evaluate(() => {
      const sc = new THREE.Scene(); sc.background = new THREE.Color(0.6, 0, 0);
      MAT.glass.envMap = studioEnv(); MAT.glass.needsUpdate = true;
      const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), MAT.glass); sc.add(q);
      const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50); cam.position.set(0, 0, 3); cam.lookAt(0, 0, 0);
      const rt = new THREE.WebGLRenderTarget(32, 32);
      const ukur = s => { q.rotation.y = s; q.updateMatrixWorld(); renderer.setRenderTarget(rt); renderer.render(sc, cam);
        const px = new Uint8Array(4); renderer.readRenderTargetPixels(rt, 16, 16, 1, 1, px); renderer.setRenderTarget(null); return [...px]; };
      q.visible = false; const latar = ukur(0); q.visible = true;
      const hasil = { latar, tegak: ukur(0), miring: ukur(1.45) };
      rt.dispose(); return hasil;
    });
    assert.deepEqual(galatShader, [], 'shader kaca gagal dikompilasi');
    // tegak lurus: ±96% latar lolos, nyaris tanpa warna tambahan
    assert.ok(r.tegak[0] >= r.latar[0] * 0.9 && r.tegak[1] < 30, 'kaca tidak bening dari depan: ' + JSON.stringify(r));
    // 83°: pantulan lingkungan mendominasi (kaca lama: hijau ±46 karena pantulannya dikali alfa)
    assert.ok(r.miring[1] > 100 && r.miring[2] > 100, 'kaca tidak memantul dari sudut miring: ' + JSON.stringify(r));
  },
  'kaca model glTF (transmission) memakai shader kaca': async (page) => {
    const r = await page.evaluate(() => {
      const kaca = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 1, roughness: 0 });
      const kayu = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.2), kaca));
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.3), kayu));
      prepareAssetObject(g);
      return { kaca: !!kaca.userData.kaca, transmisi: kaca.transmission, campur: kaca.blending === THREE.CustomBlending, kayu: !!kayu.userData.kaca };
    });
    assert.deepEqual(r, { kaca: true, transmisi: 0, campur: true, kayu: false });
  }
};
