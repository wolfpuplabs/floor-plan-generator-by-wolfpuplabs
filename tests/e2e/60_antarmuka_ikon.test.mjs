import assert from 'node:assert/strict';
import { muatProyekJSON } from './harness.mjs';

// JEV-126: emoji di teks UI menjadi ikon Lucide (terjemahan tetap utuh, <option> & atribut cukup tanpa emoji, ketikan orang
// dibiarkan); HUD sentuh: tombol aksi di kanan bawah dengan ikon aksinya; titik bidik orang ketiga di benda yang dibidik;
// gandengan: kedua tangan bertemu di tengah setinggi pinggul
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/155.0 Mobile/15E148 Safari/604.1';
const obj = (id, kind, type, x, z, params = {}, rotY = 0) => ({ id, kind, type, x, y: 0, z, rotY, sx: 1, sy: 1, sz: 1, params });
const rumah = { v: 1, levels: [{ name: 'L1', height: 3, walls: [], objects: [obj('nA', 'npc', 'F', 5, 7, { benih: 11, jelajah: 0, kartu: 'tetangga' }, Math.PI)] }] };

export const tes = {
  'ikon: emoji di toast / tombol jadi ikon Lucide, kalimat Inggris tetap diterjemahkan; <option> & title tanpa emoji; ketikan obrolan tidak diubah': Object.assign(async (page) => {
    const r = await page.evaluate(async () => {
      const tunggu = () => new Promise(ok => setTimeout(ok, 30)), out = {};
      toast('👤 Kamera orang ketiga'); await tunggu();
      const t = $('#toast'); out.toast = [t.textContent.trim(), !!t.querySelector('svg.ik-user use[href="#l-user"]'), !!document.getElementById('l-user')];
      const b = document.createElement('button'); b.textContent = 'Zzuji kayu 🔥'; b.title = '🔥 Zzuji'; document.body.appendChild(b); await tunggu();
      out.akhir = [b.textContent.trim(), !!b.lastElementChild && b.lastElementChild.classList.contains('ik-flame'), b.title];
      const s = document.createElement('select'); s.innerHTML = '<option>🪑 Zzuji opsi</option>'; document.body.appendChild(s); await tunggu();
      out.opsi = s.options[0].textContent;
      const c = document.createElement('div'); c.setAttribute('data-emoji', ''); c.textContent = 'halo 😊'; document.body.appendChild(c); await tunggu();
      out.ketik = [c.textContent, !c.querySelector('svg')];
      const m = document.createElement('div'); m.textContent = 'Zzuji: 🎲 tengah'; document.body.appendChild(m); await tunggu();
      out.tengah = [m.textContent, !m.querySelector('svg')];
      for (const x of [b, s, c, m]) x.remove();
      return out; });
    assert.deepEqual(r.toast, ['Third-person camera', true, true], 'ikon + terjemahan: ' + JSON.stringify(r.toast));
    assert.deepEqual(r.akhir, ['Zzuji kayu', true, 'Zzuji']);
    assert.equal(r.opsi, 'Zzuji opsi');
    assert.deepEqual(r.ketik, ['halo 😊', true], 'ketikan orang tidak diubah');
    assert.deepEqual(r.tengah, ['Zzuji: tengah', true], 'emoji di tengah kalimat dibuang (kalimat utuh untuk kamus)');
  }, { opsi: { bahasa: 'en' } }),

  'HUD sentuh: Berinteraksi & aksi lain di kanan bawah dengan ikon aksinya; orang ketiga: titik bidik di NPC yang dibidik, bukan di tengah layar': Object.assign(async (page) => {
    await muatProyekJSON(page, rumah);
    await page.waitForFunction(() => window.NPC && window.NPC.keadaan('nA') && window.NPC.keadaan('nA').siap, undefined, { timeout: 120000 });
    const r = await page.evaluate(async () => {
      enterFPS(); camera.position.set(5, 1.6, 4.4); FPS.yaw = 0; FPS.pitch = -0.05; fpsStep(0); window.NPC.langkah(0.05); AIM_T = 0; stepBidik(0.2);
      await new Promise(ok => setTimeout(ok, 50));
      const dok = $('#fpsAksiDok'), act = $('#fpsAct'), rc = act.getBoundingClientRect(), W = innerWidth, H = innerHeight, out = {};
      out.dok = [!!dok, act.parentElement === dok, !dok.hidden, AIM && AIM.jenis];
      out.letak = rc.left > W * 0.6 && rc.top > H * 0.6;
      out.ikon = [act.dataset.j, act.querySelector('svg use') && act.querySelector('svg use').getAttribute('href'), [...$('#fpsAksiLain').children].map(b => b.dataset.j + ':' + !!b.querySelector('svg.ik-e')).join(',')];
      // orang ketiga: titik bidik diproyeksikan ke NPC
      await muatModul('orangtiga'); window.ORANG3.togel(); for (let i = 0; i < 300 && !window.ORANG3._uji.S.a; i++) await new Promise(ok => setTimeout(ok, 100));
      for (let i = 0; i < 6; i++) window.ORANG3.render(() => {});
      const aim = $('#fpsAim'); out.o3 = [aim.style.left !== '', aim.style.top !== ''];
      const p = window.NPC.keadaan('nA').p.clone().setY(window.NPC.keadaan('nA').p.y + 1.25);
      // jarak titik bidik ke proyeksi kepala NPC di kamera orang ketiga (diproyeksikan ulang dengan kamera yang sama)
      out.diTengah = Math.abs(parseFloat(aim.style.left) - W / 2) < 2 && Math.abs(parseFloat(aim.style.top) - H / 2) < 2;
      out.npc = p.toArray().map(v => +v.toFixed(2));
      window.ORANG3.togel(); window.ORANG3.render(() => {}); out.lepas = [aim.style.left, aim.style.top]; localStorage.removeItem('kamera3'); exitFPS(); await new Promise(ok => setTimeout(ok, 30));
      out.dokSembunyi = dok.hidden;
      return out; });
    assert.deepEqual(r.dok, [true, true, true, 'ngobrol'], JSON.stringify(r));
    assert.ok(r.letak, 'tombol di kanan bawah');
    assert.deepEqual(r.ikon.slice(0, 2), ['ngobrol', '#l-message-circle']);
    assert.match(r.ikon[2], /sapa:true/);
    assert.deepEqual(r.o3, [true, true]); assert.equal(r.diTengah, false, 'titik bidik pindah dari tengah layar');
    assert.deepEqual(r.lepas, ['', '']); assert.equal(r.dokSembunyi, true);
  }, { opsi: { ua: IPAD, viewport: { width: 1194, height: 834 }, konteks: { hasTouch: true } } }),

  'gandeng: tangan kanan pemain & tangan kiri NPC bertemu di tengah setinggi pinggul (tidak menyilang ke badan pasangan)': async (page) => {
    await muatProyekJSON(page, { v: 1, levels: [{ name: 'L1', height: 3, walls: [], objects: [] }] });
    const r = await page.evaluate(async () => {
      await muatModul('lobi'); await muatModul('npc'); const G = window.LOBI.gerak;
      const buat = async (k, x, sisi) => { const tpl = await window.LOBI.muatAvatar3D({ bawaan: k }), m = klonModel(tpl); m.userData.rigIdx = tpl.userData.rigIdx; m.userData.kedipIdx = []; m.userData.klip = [];
        const g = new THREE.Group(); g.add(m); g.position.set(x, 0, 0); scene.add(g); const a = { g, tuju: { po: 7 } }; G.siapkanGerak(a, m); a.sisi = sisi; a.tm = a.lt = 1e9; return a; };
      const P = await buat('M', 0, 1), N = await buat('F', -0.55, -1);
      for (let k = 0; k < 60; k++) { G.gerakAvatar(P, 0.05, 1.2); G.gerakAvatar(N, 0.05, 1.2); }
      scene.updateMatrixWorld(true);
      const ujung = r => r.b.children.find(x => x.isBone).getWorldPosition(new THREE.Vector3());
      const a = ujung(P.rig.rightLowerArm), b = ujung(N.rig.leftLowerArm);
      return { a: a.toArray().map(v => +v.toFixed(2)), b: b.toArray().map(v => +v.toFixed(2)), jarak: +a.distanceTo(b).toFixed(2) }; });
    assert.ok(r.jarak < 0.22, 'tangan berdekatan: ' + JSON.stringify(r));
    assert.ok(r.a[0] < -0.15 && r.a[0] > -0.45 && r.b[0] < -0.15 && r.b[0] > -0.45, 'kedua tangan di celah antara badan: ' + JSON.stringify(r));
    assert.ok(r.a[1] < 1.15 && r.b[1] < 1.1, 'setinggi pinggul, bukan terentang di bahu: ' + JSON.stringify(r));
  },
};
