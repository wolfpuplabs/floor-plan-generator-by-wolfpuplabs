## Keputusan (JEV)
<!-- Wajib: rujuk ≥1 item di docs/jev/registry.json yang ber-verdict GO. CI menolak PR tanpa ini. -->
- Item: JEV-___
- Verdict & ROI (dari `node tools/jev.mjs hitung JEV-___`):
- Metrik keberhasilan & tanggal tinjau:

## Perubahan

## Guardrail
- [ ] Data dari berkas proyek / unggahan / API luar → `esc()` atau `textContent`, tidak langsung ke `innerHTML`
- [ ] Tidak ada host luar baru (atau sudah ditambahkan ke `tools/guard-config.json` + item JEV)
- [ ] Pustaka CDN baru/berubah → versi dikunci + hash SRI dihitung ulang
- [ ] Anggaran kinerja iPad dijaga (ukuran halaman, memori tekstur, FPS mode jalan)

## Verifikasi
- [ ] `cd tools && npm run ci` lolos lokal
- [ ] Diuji di iPad (Chrome/Safari) bila menyentuh UI sentuh, audio, atau mode jalan
