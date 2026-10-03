# SDLC — Siklus Pengembangan Arsitek 3D

Prinsip: **tidak ada baris kode tanpa keputusan ROI, dan tidak ada rilis tanpa bukti.** Setiap perubahan melewati empat gerbang (G0–G3). Gerbang yang bisa diotomasi dijalankan oleh mesin (CI). Sisanya dicatat di registry JEV supaya bisa diaudit.

```
 Temukan ─► [G0 JEV: GO?] ─► Definisikan ─► Rancang ─► [G1 Siap bangun] ─► Bangun ─► [G2 Verifikasi CI] ─► Rilis ─► Ukur ─► [G3 Tinjau pasca-rilis]
     ▲            │ DEFER: kumpulkan bukti murah                                                                            │
     └────────────┴──────────────── NO-GO: arsipkan dengan alasan ◄──────────── hentikan / perbaiki / lanjutkan ◄────────────┘
```

## Peran

Tim saat ini kecil (pemilik produk + agen AI pengembang). Peran tetap dipisahkan supaya keputusan tidak menyatu dengan pelaksanaan:

| Peran | Siapa | Tanggung jawab |
|---|---|---|
| Pemilik produk (PO) | Wolfpup Labs | Masalah & bukti (J), menyetujui override, menetapkan asumsi `model.json` |
| Pengembang | Manusia / agen AI | Estimasi biaya (E), desain, kode, tes, menjaga guardrail |
| Penjaga gerbang | **CI** (`.github/workflows/ci.yml`) | G2 otomatis; menolak PR tanpa JEV GO |
| Peninjau | PO atau pengembang kedua | Review kode untuk perubahan keamanan/arsitektur |

## Fase & gerbang

### 1. Temukan → **G0: Keputusan ROI (JEV)**

**Masukan:** permintaan pengguna, laporan bug, temuan audit, ide.

**Langkah:**
1. Tulis item di `docs/jev/registry.json`: masalah, **kekuatan bukti**, alternatif, estimasi jam (bangun/uji/pemeliharaan), pendorong manfaat (waktu / konversi / risiko), guardrail keras.
2. Jalankan `cd tools && node jev.mjs hitung JEV-0xx`. Verdict **dihitung, bukan dipilih**.
3. Keputusan:
   - **GO** → lanjut.
   - **DEFER** → jangan bangun. Lakukan langkah validasi termurah yang menaikkan bukti (wawancara, prototipe kertas, tes A/B kecil), atau perkecil lingkup hingga biaya < Rp 10 jt.
   - **NO-GO** → arsipkan dengan alasan. Fitur NO-GO yang sudah terlanjur ada **dibekukan**: hanya perbaikan bug, tanpa pengembangan baru.

**Pengecualian:** kelas `wajib` (perbaikan keamanan High/Critical, kewajiban hukum/lisensi, kehilangan data) selalu GO, tetapi ROI tetap dihitung dan dicatat.

**Override:** hanya PO, tercatat di item (`override: {verdict, alasan, oleh, tanggal}`). Override tampil di laporan dan akan ditinjau di G3.

> Aturan "sejak awal": item yang tidak ada di registry tidak boleh punya PR. CI menolak PR yang tidak menyebut `JEV-###` ber-verdict GO.

### 2. Definisikan

- Tambahkan/ubah baris kebutuhan di `docs/PRD.md` (ID F-/E-/I-/R-/X-) beserta **kriteria penerimaan yang bisa diuji**.
- Tetapkan **metrik keberhasilan + tanggal tinjau** di item JEV (wajib untuk status `terkirim`).

### 3. Rancang → **G1: Siap dibangun (Definition of Ready)**

Checklist yang harus terpenuhi sebelum menulis kode:

- [ ] Item JEV ber-verdict GO, tanpa guardrail berstatus `belum`
- [ ] Kriteria penerimaan tertulis di PRD
- [ ] **Model ancaman ringkas**: masukan baru apa yang tak tepercaya (berkas, URL, API)? Ke mana alirannya (DOM, jaringan, penyimpanan)?
- [ ] Dampak anggaran: ukuran halaman (+KB), memori GPU, FPS iPad, host luar baru?
- [ ] Rencana tes: tes e2e mana yang ditambah/diubah
- [ ] Bila menambah host/pustaka luar: entri di `tools/guard-config.json` + kajian lisensi & privasi

### 4. Bangun

- Kerjakan di cabang fitur. Satu PR = satu (atau sedikit) item JEV.
- **Aturan kode (dijaga mesin):**
  - Data dari berkas proyek / unggahan / API luar → `esc()` atau `textContent`/`el()`, **tidak pernah** langsung `innerHTML` (G1, `G-SINK`)
  - Berkas proyek hanya masuk lewat `sanitasiProyek()` (G2); model hanya lewat `parseAsset()` yang memanggil `uriLuarGLTF()` (G3)
  - Pustaka CDN: versi `x.y.z` + `integrity` SHA-384 + `crossorigin` (G5). Hitung hash dari tarball npm: `openssl dgst -sha384 -binary <berkas> | base64`
  - Tanpa `eval`/`new Function`/string ke `setTimeout`
  - Peringatan ESLint tidak boleh bertambah (ratchet `tools/baseline.json`)
- Komentar kode menjelaskan **mengapa**, dalam Bahasa Indonesia, mengikuti gaya berkas.

### 5. Verifikasi → **G2: CI hijau (Definition of Done)**

Otomatis di setiap PR (`.github/workflows/ci.yml`). Jalankan lokal dengan `cd tools && npm ci && npm run ci` (di sandbox tanpa unduhan browser: `CHROMIUM_PATH=/path/chrome`).

| Pemeriksaan | Alat | Gagal bila |
|---|---|---|
| Audit dependensi | `npm audit --audit-level=high` | Kerentanan high+ |
| Lint | `tools/lint.mjs` | Ada galat; peringatan > baseline |
| Guardrail statis | `tools/guard.mjs` | SRI/pin/CSP hilang, host tak diizinkan, sink tanpa `esc()`, rahasia, `eval`, `index.html` > 900 KB, pertahanan G1–G6 hilang |
| Gerbang JEV | `tools/jev.mjs check` | PR tanpa `JEV-###` atau item tidak GO; registry tidak sah |
| Laporan JEV sinkron | `jev.mjs report` + `git diff` | `docs/jev/LAPORAN.md` usang |
| E2E | `tests/e2e/run.mjs` (Chromium) | Assert gagal, galat halaman, **pelanggaran CSP/SRI** |

Manual (dicentang di template PR): uji di iPad bila menyentuh sentuh/audio/mode jalan; tidak ada regresi visual pada denah uji.

**Definition of Done:** CI hijau · kriteria penerimaan terpenuhi · tes baru menutup perilaku baru (dan bug yang diperbaiki punya tes yang gagal sebelum perbaikan) · dokumen (PRD/AUDIT/registry) diperbarui · metrik & tanggal tinjau terisi.

### 6. Rilis

- Merge ke `main` **hanya setelah** semua job CI hijau. Automerge diizinkan bila syarat ini terpenuhi.
- Deploy otomatis: Vercel / GitHub Pages menyajikan `index.html` dari `main`. Folder `tools/`, `tests/`, `docs/` tidak memengaruhi halaman.
- **Rollback:** revert commit merge di `main`. Berkas statis tanpa migrasi data, jadi rollback aman dan instan. Proyek pengguna tersimpan lokal dan tetap kompatibel karena `sanitasiProyek()` mengabaikan field yang tidak dikenal.
- Perubahan format proyek: naikkan `v` di berkas simpanan dan pastikan versi lama tetap bisa dimuat (tes e2e bolak-balik).

### 7. Ukur → **G3: Tinjauan pasca-rilis**

- Pada tanggal `metrik.tinjau`, bandingkan metrik nyata dengan target. `jev.mjs report` menandai tinjauan yang lewat tanggal.
- Hasil:
  - **Lanjutkan** (target tercapai) → perbarui `J.bukti` ke `data-pemakaian` dan kalibrasi asumsi di `model.json`.
  - **Perbaiki** (meleset < 50%) → item JEV baru dengan bukti yang lebih kuat.
  - **Hentikan** (meleset ≥ 50% atau verdict ulang NO-GO) → status `dihentikan`, fitur dibekukan atau dihapus.
- Kalibrasi asumsi (pengguna aktif, tarif, nilai fee) **setiap kuartal**. Semua verdict dihitung ulang otomatis.

## Penanganan insiden & bug

| Tingkat | Contoh | Respon | Jalur |
|---|---|---|---|
| Kritis | XSS aktif, kehilangan data proyek, aplikasi tidak bisa dibuka | Hotfix ≤ 24 jam | Item JEV kelas `wajib` → PR → CI → rilis |
| Tinggi | Fitur P0 rusak (generate, simpan/muat) | ≤ 72 jam | Sama |
| Sedang/Rendah | Fitur P1/P2 rusak, kosmetik | Jadwal biasa | Item JEV biasa (bisa DEFER) |

Setiap bug yang diperbaiki **wajib** disertai tes yang gagal sebelum perbaikan. Postmortem singkat untuk Kritis/Tinggi dicatat di `docs/AUDIT.md`.

## Pengelolaan utang teknis

- Utang tercatat di `docs/AUDIT.md` (TD-xx). Utang yang ingin dibayar juga masuk registry JEV (biasanya pendorong `risiko` atau `lainRpPerTahun` = jam pemeliharaan yang dihemat).
- **Ratchet** mencegah utang bertambah: peringatan ESLint (`baseline.json`), jumlah interpolasi `innerHTML` (`guard-config.json`), anggaran ukuran halaman. Angkanya hanya boleh turun.

## Ringkasan perintah

```bash
cd tools && npm ci                 # sekali
npm run lint                       # ESLint + ratchet
npm run guard                      # guardrail statis
node jev.mjs hitung JEV-045        # rincian ROI satu item (+ sensitivitas)
node jev.mjs report                # perbarui docs/jev/LAPORAN.md
npm run test:e2e                   # tes peramban
npm run ci                         # semuanya
```
