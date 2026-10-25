import assert from 'node:assert/strict';
import { muatProyekJSON } from './harness.mjs';

// JEV-129: kualitas Halus (tanpa HDR) tidak lagi memakai faktor eksposur tetap yang dikalibrasi di dalam ruangan —
// eksposur diukur dari adegan (rumus HDR Tinggi yang sama), jadi siang di luar rumah / tampilan editor dengan langit
// foto redup tidak jauh lebih gelap daripada Tinggi; langit foto ikut eksposur (shader tidak terkunci tanpa pemetaan nada)
const dinding = [[0, 0, 6, 0], [6, 0, 6, 5], [6, 5, 0, 5], [0, 5, 0, 0]].map(([x1, z1, x2, z2], i) => ({ id: 'w' + i, x1, z1, x2, z2, thickness: 0.15, openings: i === 0 ? [{ id: 'j', type: 'door', t: 0.5, w: 1, h: 2.1 }] : [] }));
const rumah = { v: 1, levels: [{ name: 'L1', height: 3, walls: dinding, objects: [] }] };

export const tes = {
  'Halus: siang dengan langit foto redup (matahari terbit) setara terang Tinggi di editor & di luar rumah; langit ikut eksposur': async (page) => {
    await muatProyekJSON(page, rumah);
    await page.waitForFunction(() => !!window.EKSPOSUR, undefined, { timeout: 30000 });
    const r = await page.evaluate(async () => {
      const raf = n => new Promise(async ok => { for (let i = 0; i < n; i++) await new Promise(o => requestAnimationFrame(o)); ok(); });
      const terang = () => { renderFrame(); const c = document.createElement('canvas'); c.width = 96; c.height = 64; const x = c.getContext('2d'); x.drawImage(renderer.domElement, 0, 0, 96, 64);
        const d = x.getImageData(0, 0, 96, 64).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; return s / (d.length / 4); };
      // panorama sintetis: langit jingga redup, bagian bawah gelap, titik matahari rendah
      const w = 256, h = 128, rgbe = new Uint8Array(w * h * 4);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const lat = 0.5 - (y + 0.5) / h, t = lat > 0 ? Math.exp(-lat * 6) : 0.15;
        let c = [1.6 * t, 0.9 * t, 0.6 * t + 0.1]; if (Math.abs(x - 64) < 3 && Math.abs(y - 60) < 3) c = [40, 30, 15];
        const m = Math.max(...c), e = Math.ceil(Math.log2(m)) || 1, f = Math.pow(2, e) / 256, i = (y * w + x) * 4; rgbe[i] = c[0] / f; rgbe[i + 1] = c[1] / f; rgbe[i + 2] = c[2] / f; rgbe[i + 3] = e + 128; }
      pasangPano({ w, h, rgbe }, { id: 'uji', nama: 'Uji terbit', waktu: 'siang' }); setSuasana('siang');
      const out = {};
      const banding = async (nama) => { setRenderQuality('tinggi'); await raf(50); const t = terang(); setRenderQuality('halus'); await raf(25); out[nama] = { tinggi: +t.toFixed(1), halus: +terang().toFixed(1), ke: +FX.ke.toFixed(2) }; };
      await banding('editor');
      // langit foto harus mengikuti eksposur di Halus (dulu shader-nya bisa terkunci tanpa pemetaan nada)
      const asli = window.EKSPOSUR.langkah; window.EKSPOSUR.langkah = () => {};
      const k0 = FX.ke; FX.ke = 0.5; const a = terang(); FX.ke = 2; const b = terang(); FX.ke = k0; window.EKSPOSUR.langkah = asli;
      out.ikut = [+a.toFixed(1), +b.toFixed(1)];
      enterFPS(); camera.position.set(3, 1.6, -4); FPS.yaw = Math.PI; FPS.pitch = -0.1; fpsStep(0); await banding('luar');
      // ganti suasana tidak mengembalikan faktor tetap lama — eksposur hasil adaptasi dipertahankan lalu diukur ulang
      const sebelum = FX.ke; setSuasana('siang'); renderFrame(); out.suasana = [+sebelum.toFixed(2), +FX.ke.toFixed(2)];
      exitFPS(); return out; });
    const rasio = x => x.halus / x.tinggi;
    assert.ok(rasio(r.editor) > 0.7 && rasio(r.editor) < 1.3, 'editor Halus ≈ Tinggi: ' + JSON.stringify(r));
    assert.ok(rasio(r.luar) > 0.8 && rasio(r.luar) < 1.25, 'luar rumah Halus ≈ Tinggi: ' + JSON.stringify(r));
    assert.ok(r.editor.ke > 0.6, 'adegan redup → faktor naik dari 0,4 tetap: ' + JSON.stringify(r));
    assert.ok(r.ikut[1] > r.ikut[0] + 20, 'langit & adegan ikut eksposur: ' + JSON.stringify(r.ikut));
    assert.ok(Math.abs(r.suasana[1] - r.suasana[0]) < 0.05, 'setSuasana tidak menyetel ulang ke 0,4: ' + JSON.stringify(r.suasana));
  },

  // JEV-138: menghadap matahari terbenam dulu membuat avatar & lantai jadi siluet gelap — langit yang jauh lebih terang
  // dari kunci menarik rata-rata log-luminans ke atas. Kini luminans di atas 2,5× kunci dihitung 2,5× kunci & sepertiga
  // atas layar berbobot lebih kecil, sama di Halus & Tinggi
  'menghadap langit senja yang terang tidak menggelapkan adegan: eksposur menghadap langit ≈ menunduk ke lantai; Halus ≈ Tinggi': async (page) => {
    await muatProyekJSON(page, { v: 1, levels: [{ name: 'L1', height: 3, walls: dinding.map(w => ({ ...w, x1: w.x1 + 20, x2: w.x2 + 20 })), objects: [] }] });
    await page.waitForFunction(() => !!window.EKSPOSUR, undefined, { timeout: 30000 });
    const r = await page.evaluate(async () => {
      const raf = n => new Promise(async ok => { for (let i = 0; i < n; i++) await new Promise(o => requestAnimationFrame(o)); ok(); });
      const terang = () => { renderFrame(); const c = document.createElement('canvas'); c.width = 96; c.height = 64; const x = c.getContext('2d'); x.drawImage(renderer.domElement, 0, 0, 96, 64);
        const d = x.getImageData(0, 0, 96, 64).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; return s / (d.length / 4); };
      setSuasana('senja');
      // langit senja di depan (kamera menghadap +Z): bidang bercahaya ±20× kunci menutup separuh atas pandangan; dermaga & sosok
      // (dulu: menghadap langit 0,36 — batas bawah — vs menunduk 0,89)
      const g = new THREE.Group(), kunci = KUNCI_EKSPOSUR.senja;
      const langit = new THREE.Mesh(new THREE.PlaneGeometry(400, 120), new THREE.MeshBasicMaterial({ fog: false }));
      langit.material.color.setRGB(20 * kunci * 1.4, 20 * kunci, 20 * kunci * 0.5); langit.position.set(3, 61.6, 60); langit.rotation.y = Math.PI; g.add(langit);
      const lantai = new THREE.Mesh(new THREE.BoxGeometry(8, 0.1, 120), new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.9 })); lantai.position.set(3, -0.05, 0); g.add(lantai);
      const sosok = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.7, 0.3), new THREE.MeshStandardMaterial({ color: 0x505050 })); sosok.position.set(3, 0.85, 3); g.add(sosok);
      scene.add(g);
      enterFPS(); camera.position.set(3, 1.6, 0); FPS.feet = 0;
      const lihat = async (pitch, n = 60) => { FPS.yaw = 0; FPS.pitch = pitch; fpsStep(0); await raf(n); };
      const out = {};
      setRenderQuality('halus');
      await lihat(0.05); out.langit = { ke: +FX.ke.toFixed(2), halus: +terang().toFixed(1) };
      await lihat(-1.2); out.lantai = { ke: +FX.ke.toFixed(2) };
      await lihat(0.05); setRenderQuality('tinggi'); await raf(60); out.langit.tinggi = +terang().toFixed(1);
      setRenderQuality('halus'); scene.remove(g); exitFPS(); return out; });
    assert.ok(r.lantai.ke / r.langit.ke < 1.4 && r.langit.ke > 0.6, 'menghadap langit tidak jauh lebih gelap dari menunduk: ' + JSON.stringify(r));
    assert.ok(r.langit.halus / r.langit.tinggi > 0.75 && r.langit.halus / r.langit.tinggi < 1.33, 'Halus ≈ Tinggi menghadap langit: ' + JSON.stringify(r));
  },
};
