import assert from 'node:assert/strict';
import { muatProyekJSON } from './harness.mjs';

// JEV-107: menu mode jalan jadi dok ikon di kiri-kanan tombol foto; tiap ikon membuka satu lembar kecil
const rumah = { v: 1, levels: [{ name: 'L1', height: 3, walls: [[0, 0, 8, 0], [8, 0, 8, 6], [8, 6, 0, 6], [0, 6, 0, 0]].map(([x1, z1, x2, z2], i) => ({ id: 'w' + i, x1, z1, x2, z2, thickness: 0.15, openings: [] })), objects: [] }] };

export const tes = {
  'dok mode jalan: bilah atas ringkas; ikon mengapit tombol foto; satu lembar sekali buka; ketuk lagi / layar = tutup; NPC muncul di depan': async (page) => {
    await page.setViewportSize({ width: 820, height: 640 });
    await muatProyekJSON(page, rumah);
    await page.evaluate(() => { localStorage.removeItem('fps_ciut'); enterFPS(); camera.position.set(2, 1.6, 3); FPS.yaw = 0; });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const kotak = e => e.getBoundingClientRect(), f = kotak($('#fpsFoto')), ik = [...document.querySelectorAll('#fpsDok .fps-ik')].map(kotak);
      const bilah = [...$('#fpsbar').children].filter(e => e.offsetParent).map(e => e.id || e.className);
      const kiri = ik.filter(b => b.right <= f.left), kanan = ik.filter(b => b.left >= f.right);
      const sejajar = ik.every(b => Math.abs((b.top + b.bottom) / 2 - (f.top + f.bottom) / 2) < 3);
      return { bilah, kiri: kiri.length, kanan: kanan.length, sejajar, lembar: $('#fpsLembar').hidden };
    });
    // kiri: kamera orang ketiga (JEV-135) + 2 ikon lembar
    assert.deepEqual(r, { bilah: ['fpsExit', 'fpsinfo', 'fpsCiut'], kiri: 3, kanan: 2, sejajar: true, lembar: true });
    // buka lembar: satu sekali waktu, isi sesuai ikon
    const buka = k => page.evaluate(k => { $('#fpsDok [data-lembar="' + k + '"]').click();
      return { tampak: !$('#fpsLembar').hidden, isi: [...document.querySelectorAll('#fpsLembar .fl')].filter(f => !f.hidden).map(f => f.dataset.lembar),
        aktif: [...document.querySelectorAll('#fpsDok .fps-ik')].filter(b => b.getAttribute('aria-expanded') === 'true').map(b => b.dataset.lembar) }; }, k);
    const w = await buka('waktu');
    assert.deepEqual(w, { tampak: true, isi: ['waktu'], aktif: ['waktu'] });
    assert.deepEqual(await page.evaluate(() => ['#fpsOto', '#fpsMood', '#fpsCuaca'].map(s => !!$(s).closest('.fl[data-lembar="waktu"]'))), [true, true, true]);
    assert.deepEqual(await buka('atur'), { tampak: true, isi: ['atur'], aktif: ['atur'] });
    assert.deepEqual(await page.evaluate(() => ['#fpsFov', '#fpsRq', '#fpsSfx', '#fpsWall', '#fpsRoof', '#fpsFull'].map(s => !!$(s).closest('.fl[data-lembar="atur"]'))), [true, true, true, true, true, true]);
    assert.deepEqual(await buka('atur'), { tampak: false, isi: ['atur'], aktif: [] }, 'ketuk ikon yang sama = tutup');
    await buka('langit');
    // lembar tidak menutupi tombol foto & muat di layar
    const l = await page.evaluate(() => { const a = $('#fpsLembar').getBoundingClientRect(), f = $('#fpsFoto').getBoundingClientRect(); return [a.bottom <= f.top, a.left >= 0, a.right <= innerWidth, a.top >= 0]; });
    assert.deepEqual(l, [true, true, true, true]);
    await page.evaluate(() => renderer.domElement.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 600, clientY: 200, pointerType: 'mouse' })));
    assert.equal(await page.evaluate(() => $('#fpsLembar').hidden), true, 'ketuk layar = tutup');
    // NPC dari lembar Gaya: muncul ±1,6 m di depan, menghadap pengunjung
    const g = await buka('gaya');
    assert.deepEqual(g.isi, ['gaya']);
    const n = await page.evaluate(() => { document.querySelector('[data-npc-jalan="M"]').click(); const o = L().objects.find(x => x.kind === 'npc');
      return o && { type: o.type, x: o.x, z: o.z, hadap: +Math.cos(o.rotY).toFixed(2), tutup: $('#fpsLembar').hidden }; });
    assert.deepEqual(n, { type: 'M', x: 2, z: 4.6, hadap: -1, tutup: true });
    // selama karakter dimuat tampil siluet; setelah siap siluet hilang & model terpasang
    const sil = await page.evaluate(async () => { const id = L().objects.find(x => x.kind === 'npc').id; let ada = false;
      for (let i = 0; i < 600; i++) { const n = window.NPC && window.NPC._uji.NPC.get(id); if (n && n.badan.children.some(c => c.userData.siluet)) ada = true; if (n && n.a) return [ada || i === 0, n.badan.children.some(c => c.userData.siluet)]; await new Promise(r => setTimeout(r, 100)); }
      return null; });
    assert.deepEqual(sil, [true, false], 'siluet saat memuat, lalu model');
    // sembunyikan menu: dok & info hilang, tombol foto & keluar tetap
    await page.evaluate(() => $('#fpsCiut').click());
    assert.deepEqual(await page.evaluate(() => [getComputedStyle($('#fpsDok')).display, getComputedStyle($('#fpsFoto')).display, !!$('#fpsExit').offsetParent]), ['none', 'grid', true]);
    await page.evaluate(() => { $('#fpsCiut').click(); exitFPS(); });
    assert.equal(await page.evaluate(() => getComputedStyle($('#fpsDok')).display), 'none', 'dok hanya di mode jalan');
  },

  'HP 390 px: dok muat tanpa geser samping; tautan lihat tanpa bagian NPC': async (page) => {
    await page.setViewportSize({ width: 390, height: 760 });
    await muatProyekJSON(page, rumah);
    const r = await page.evaluate(() => { enterFPS(); $('#fpsDok [data-lembar="gaya"]').click();
      const d = $('#fpsDok').getBoundingClientRect(), a = $('#fpsLembar').getBoundingClientRect();
      const out = { dok: d.left >= 0 && d.right <= innerWidth, lembar: a.left >= 0 && a.right <= innerWidth, npc: !$('.fl-npc').hidden, geser: document.documentElement.scrollWidth <= innerWidth };
      tutupLembar(); LIHAT.on = true; $('#fpsDok [data-lembar="gaya"]').click(); out.npcLihat = !$('.fl-npc').hidden; tutupLembar(); LIHAT.on = false; exitFPS(); return out; });
    assert.deepEqual(r, { dok: true, lembar: true, npc: true, geser: true, npcLihat: false });
  },
};
