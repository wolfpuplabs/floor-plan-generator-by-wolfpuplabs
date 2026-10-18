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
};
