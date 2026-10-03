# Audit Kerentanan, Bug, dan Utang Teknis

| | |
|---|---|
| Lingkup | `index.html` (±12.100 baris, 696 KB, satu berkas), pustaka pihak ketiga, proses rilis |
| Tanggal | 2026-10-03 |
| Metode | Tinjauan manual seluruh *sink* HTML & jalur masukan tak tepercaya · ESLint 8 (aturan kebenaran + keamanan) · `npm audit` · uji mutasi pada tes guardrail · 27 skrip regresi + 9 tes e2e baru |
| Item JEV | JEV-040 (guardrail keamanan), JEV-041 (tes + CI) — keduanya kelas **wajib** |

## Model ancaman singkat

Aplikasi berjalan sepenuhnya di peramban, tanpa server dan tanpa akun. Jadi risiko terbesar **bukan** pencurian data di server, melainkan:

1. **Berkas proyek `.json` dari orang lain.** Arsitek menerima proyek dari rekan atau klien. Isinya (nama lantai, id aset, gambar denah, model glTF) adalah masukan tak tepercaya yang dieksekusi di origin aplikasi.
2. **Pustaka & API pihak ketiga.** three.js/model-viewer dari CDN, dan data dari Poly Haven. CDN yang disusupi berarti kode berbahaya berjalan dengan akses penuh ke proyek pengguna.
3. **Privasi.** Membuka proyek tidak boleh diam-diam menghubungi server pihak ketiga, karena itu membocorkan IP, waktu buka, dan fakta bahwa proyek dibuka.
4. **Keandalan data.** Gagal muat atau gagal render tidak boleh menghancurkan pekerjaan yang sedang terbuka.

## Temuan keamanan

| ID | Tingkat | Temuan | Dampak | Status |
|---|---|---|---|---|
| SEC-01 | **Tinggi** | XSS tersimpan: `lv.name` dari berkas proyek masuk `innerHTML` di 3 tempat (placeholder pratinjau, panel statistik, bar mode jalan) | Berkas proyek berisi `<img onerror=…>` menjalankan skrip saat dibuka: mencuri/mengubah proyek, menyamar sebagai UI | ✅ Diperbaiki — `esc()` (G1), tes e2e + uji mutasi, pemeriksa statis `G-SINK` |
| SEC-02 | **Tinggi** | Injeksi atribut lewat id aset di `data-thumb="${k}"` | Sama dengan SEC-01, lewat kunci `assets` | ✅ Diperbaiki — `esc()` + id aset wajib `^[A-Za-z0-9_-]{1,64}$` (G2) |
| SEC-03 | Sedang | Kategori dari API Poly Haven masuk `innerHTML` tanpa *escape* | XSS bila API/jalur jaringan disusupi | ✅ Diperbaiki — `esc()` + id disaring `ID_AMAN` |
| SEC-04 | Sedang | Pemuatan proyek tanpa validasi skema: `NaN`/angka ekstrem, larik raksasa, kunci `__proto__` | Peramban macet/crash (DoS di iPad), *prototype pollution* | ✅ Diperbaiki — `sanitasiProyek()` (G2): tipe, rentang, panjang, kedalaman, batas jumlah, pembuangan `__proto__` |
| SEC-05 | Sedang (privasi) | `plans[].img` boleh berupa URL apa pun | Membuka proyek memicu permintaan ke server penyerang (pelacakan IP/waktu) | ✅ Diperbaiki — hanya `data:image/(png|jpeg|webp|gif);base64` |
| SEC-06 | Sedang (privasi) | glTF/GLB boleh merujuk `buffers[].uri` / `images[].uri` eksternal | Sama dengan SEC-05, plus model bisa berubah diam-diam | ✅ Diperbaiki — `uriLuarGLTF()` menolak sebelum `GLTFLoader` berjalan (G3) |
| SEC-07 | Sedang (rantai pasok) | 6 skrip CDN tanpa Subresource Integrity; three.js dari cdnjs | CDN disusupi → kode arbitrer berjalan di aplikasi | ✅ Diperbaiki — semua dikunci versi + hash SHA-384 dari tarball npm (G5); three.js dipindah ke jsDelivr/npm agar byte-nya bisa diverifikasi |
| SEC-08 | Rendah | Tidak ada Content Security Policy | Tidak ada lapisan pertahanan kedua | ✅ Diperbaiki — CSP (G4): `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`, skrip hanya `self` + jsDelivr |
| SEC-09 | Rendah | Id Poly Haven tidak divalidasi saat disusun menjadi URL | *Path injection* ke host tepercaya | ✅ Diperbaiki — `ID_AMAN`, resolusi di-*whitelist* |
| SEC-10 | Residual | `import()` dinamis USDZExporter tidak bisa diberi SRI dan memuat `three.module.js` kedua (±1,2 MB) | Celah rantai pasok kecil (host tetap dibatasi CSP); unduhan ganda | ⏳ Terbuka — diselesaikan oleh JEV-042 (bundel lokal) |
| SEC-11 | Residual | CSP masih `'unsafe-inline'` (skrip utama inline) dan `connect-src https:` (unduhan Poly Haven bisa di-*redirect*) | XSS inline tidak diblokir CSP (sudah ditutup di sumbernya oleh G1/G2) | ⏳ Terbuka — JEV-042: skrip ke berkas terpisah + hash; persempit `connect-src` setelah host redirect terverifikasi di produksi |

`npm audit` pada dependensi tooling: **0 kerentanan**. Aplikasi sendiri tidak punya dependensi npm saat runtime.

## Bug

| ID | Tingkat | Temuan | Status |
|---|---|---|---|
| BUG-01 | **Tinggi** | Pemuatan proyek **tidak atomik**: galat di tengah (mis. `rebuildScene` gagal pada data aneh) meninggalkan proyek setengah tertimpa, sehingga pekerjaan yang terbuka hilang | ✅ Cadangan dan pemulihan penuh; tes e2e memaksa `rebuildScene` gagal |
| BUG-02 | Sedang | Alas denah tracing tertinggal saat tracing dimulai ulang atau lantai ditambah/dihapus (dilaporkan pengguna) | ✅ `akhiriTrace()` di awal tracing + `lepasTraceLantai()`; tes e2e |
| BUG-03 | Sedang | CSP versi pertama memblokir WebAssembly model-viewer, sehingga **AR rusak**. Tertangkap tes e2e baru *sebelum* rilis | ✅ `'wasm-unsafe-eval'` (hanya kompilasi WASM, bukan `eval` JS) |
| BUG-04 | Rendah | `#loadInput` tidak dikosongkan, sehingga memilih berkas yang sama dua kali tidak memuat ulang | ✅ |
| BUG-05 | Rendah | Tidak ada penangkap galat global; crash terjadi diam-diam dan pengguna tidak sempat menyimpan | ✅ G6: dicatat lokal (`window.__galat`, tanpa telemetri) + peringatan sekali |
| BUG-06 | Rendah (tes) | `tracetest` lama *flaky*: mengetuk sebelum animasi kamera selesai | ✅ Tes menunggu `VIEW.anim` |
| BUG-07 | Info (tes) | `undotest` melaporkan "pintasan bekerja? false". Diverifikasi manual: Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y **berfungsi**; perbandingan di tes keliru karena debounce riwayat 150 ms tertunda oleh pembuatan thumbnail pertama | 📝 Bukan bug produk; tes perlu diperbaiki saat dipindah ke `tests/e2e` |
| BUG-08 | Sedang (riwayat) | Dua bug piano (tidak bisa berhenti, bisu di iPad), sudah diperbaiki di PR #42 | ✅ Catatan: fitur ber-verdict **NO-GO** di JEV menyumbang bug |

## Utang teknis

Diurutkan menurut ROI perbaikan (dampak ÷ biaya), dengan item JEV-nya.

| ID | Utang | Bukti | Dampak | Rencana |
|---|---|---|---|---|
| TD-01 | **Tes regresi tidak ada di repo.** 27 skrip hanya ada di mesin pengembang | Bug piano & alas tracing lolos ke pengguna | Tinggi | ✅ Dibayar sebagian: `tests/e2e` (9 tes) + CI (JEV-041). Sisa: porting 27 skrip lama secara bertahap |
| TD-02 | Satu berkas 12.100 baris / 696 KB, tanpa modul | Waktu baca/ubah tinggi; konflik merge; `'unsafe-inline'` wajib | Sedang | JEV-042 (DEFER: ROI 0× dengan asumsi sekarang; naik bila tim > 1 orang) |
| TD-03 | 66 *use-before-define* (ESLint): urutan inisialisasi implisit, banyak penjaga `typeof X!=='undefined'` | Pernah menyebabkan galat TDZ (`p is not defined`) | Sedang | **Ratchet** di `tools/baseline.json` (80). Angkanya hanya boleh turun |
| TD-04 | 14 variabel/fungsi mati (`pantulKotor`, `langitTex`, `semuaKunciThumb`, …) | ESLint | Rendah | Hapus bertahap; ikut ratchet |
| TD-05 | three.js r128 (2021), 55 rilis tertinggal; model-viewer membawa three sendiri, jadi ada dua salinan di memori saat AR | `npm` peer conflict | Sedang | Migrasi ke r16x dikaji bersama JEV-042 (API `encoding` → `colorSpace` berubah) |
| TD-06 | Riwayat urung menyimpan **seluruh** `levels` sebagai JSON per langkah (60 langkah) | Proyek besar = puluhan MB di memori iPad | Sedang | Simpan diff (JSON Patch) bila proyek > 2 MB |
| TD-07 | Proyek menyimpan aset GLB sebagai base64 (+33%) tanpa batas total | 10 model fotogrametri ≈ 100+ MB `.json` | Sedang | JEV-046 (NO-GO saat ini); murah: batas total + peringatan |
| TD-08 | Aksesibilitas: banyak tombol ikon tanpa `aria-label`; belum ada mode gerak-tereduksi di mode jalan | Tinjauan manual | Rendah–Sedang | Masuk Definition of Done (SDLC) untuk UI baru |
| TD-09 | Tidak ada observabilitas: tidak ada metrik pemakaian, sehingga semua asumsi JEV belum terkalibrasi | `docs/jev/model.json` | **Tinggi untuk keputusan** | Analitik lokal opt-in, tanpa PII (usulan JEV berikutnya) |

## Guardrail yang dipasang

| Kode | Di mana | Apa yang dijaga | Diuji oleh |
|---|---|---|---|
| G1 | `esc()` di `index.html` | Data tak tepercaya tidak menjadi HTML | e2e `02_guardrail` + `guard.mjs G-SINK` (memindai pernyataan multi-baris) |
| G2 | `sanitasiProyek()` + muat atomik | Skema, rentang, ukuran (250 MB), pemulihan bila gagal | e2e `02_guardrail` (2 tes) |
| G3 | `uriLuarGLTF()` | Model tidak boleh menarik berkas dari luar | e2e `02_guardrail` |
| G4 | CSP `<meta>` | Sumber skrip, objek, base, form | e2e (pelanggaran CSP = tes gagal) + `G-CSP` |
| G5 | SRI + versi terkunci | Integritas pustaka CDN | e2e (hash diverifikasi peramban) + `G-SRI`, `G-PIN` |
| G6 | `error`/`unhandledrejection` | Galat tidak senyap | e2e `02_guardrail` |
| — | `guard.mjs` | Host luar hanya dari daftar izin, tanpa rahasia di repo, tanpa `eval`, anggaran ukuran 900 KB, pertahanan G1–G6 tidak boleh hilang | CI job `guardrail` |
| — | `lint.mjs` | Galat ESLint = gagal; peringatan tidak boleh naik | CI |
| — | `jev.mjs check` | PR wajib merujuk item JEV ber-verdict GO | CI |

Uji mutasi: mencabut `esc()` dari satu sink membuat **tes e2e XSS gagal** dan **`G-SINK` gagal**. Kedua lapisan terbukti mendeteksi regresi.
