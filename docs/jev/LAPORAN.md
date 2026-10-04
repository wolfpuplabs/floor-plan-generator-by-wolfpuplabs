# Laporan JEV — keputusan Go/No-Go berbasis ROI

> Dihasilkan otomatis oleh `tools/jev.mjs report` dari `docs/jev/model.json` + `docs/jev/registry.json`. **Jangan diedit tangan.**
> Semua angka manfaat memakai **asumsi awal** di model.json (pengguna aktif 500/tahun, tarif dev Rp 150.000/jam, horizon 2 tahun) — kalibrasi dengan data nyata, lalu jalankan ulang.

Ambang: **GO** bila ROI ≥ 1 (manfaat ≥ 2× biaya), payback ≤ 12 bulan, peluang ≥ 0.3, dan semua guardrail keras dinilai lolos. **DEFER** bila ROI ≥ 0. Selain itu **NO-GO**. Guardrail keras yang gagal = NO-GO apa pun ROI-nya.

**Ringkasan:** 42 GO · 3 DEFER · 5 NO-GO dari 50 item.

| ID | Item | Status | Peluang | EV/tahun | Biaya 2 th | ROI | ROI pesimis | Payback | Pengguna impas | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| JEV-064 | Atap menaungi semua lantai yang terbuka + galeri model semua kategori dengan Muat lebih banyak | terkirim | 0.80 | 83 jt | 1 jt | 169.3× | 84.1× | 0.1 bln | 6 | **GO** |
| JEV-062 | Rampingkan model unduhan (tekstur → 1024 px) + pulih dari hilangnya konteks WebGL | terkirim | 0.80 | 113,1 jt | 1,4 jt | 166.6× | 82.8× | 0.1 bln | 6 | **GO** |
| JEV-058 | Tautan lihat-saja: proyek di fragmen URL, penerima bisa jalan-jalan tanpa bisa mengedit | terkirim | 0.65 | 92,1 jt | 1,5 jt | 121.8× | 60.4× | 0.2 bln | 9 | **GO** |
| JEV-065 | Lantai hantu tanpa kaca putih + material lantai per tingkat + layar TV hidup (saluran bawaan, video, GIF) | terkirim | 0.75 | 103,8 jt | 1,8 jt | 114.3× | 56.7× | 0.1 bln | 9 | **GO** |
| JEV-066 | Garis tepi lembut untuk lampu padam saat malam (mode jalan) | terkirim | 0.80 | 30 jt | 0,6 jt | 99.0× | 49.0× | 0.2 bln | 10 | **GO** |
| JEV-067 | Tautan lihat yang terbuka di HP (tautan pendek), kebocoran cahaya antar-lantai, menu jalan bisa diciutkan + kualitas, ikon SVG | terkirim | 0.80 | 78 jt | 1,8 jt | 85.7× | 42.3× | 0.2 bln | 12 | **GO** |
| JEV-052 | Lampu menerangi ruangannya dari kejauhan & dari luar (GI per ruang untuk semua lampu, semua lantai) | terkirim | 0.65 | 61,4 jt | 1,7 jt | 73.5× | 36.2× | 0.3 bln | 14 | **GO** |
| JEV-061 | Bahasa Inggris sebagai bahasa bawaan, Bahasa Indonesia tetap bisa dipilih | terkirim | 0.65 | 71,2 jt | 2,1 jt | 66.8× | 32.9× | 0.2 bln | 15 | **GO** |
| JEV-056 | Furnitur bawaan realistis: kasur, sofa, sanitair, dapur (prosedural) + pintasan ruangan di galeri model | terkirim | 0.65 | 65,5 jt | 2 jt | 66.2× | 32.6× | 0.3 bln | 15 | **GO** |
| JEV-063 | Model hasil scan 3D: tag fotogrametri Sketchfab + sumber Google Scanned Objects | terkirim | 0.60 | 49,8 jt | 1,5 jt | 65.4× | 32.2× | 0.2 bln | 16 | **GO** |
| JEV-055 | Kaca realistis: Fresnel, serapan Beer–Lambert, pantulan aditif — jendela, pintu kaca, shower, dan kaca model | terkirim | 0.60 | 28,4 jt | 0,9 jt | 62.0× | 30.5× | 0.3 bln | 16 | **GO** |
| JEV-057 | Redesign UI/UX: kartu Mulai + rumah contoh, tab berikon (Tampilan terpisah), toolbar berlabel + menu Lainnya, pencarian furnitur, target sentuh ≥ 44 px | terkirim | 0.60 | 44,6 jt | 1,5 jt | 58.4× | 28.7× | 0.3 bln | 17 | **GO** |
| JEV-059 | Tekstur foto untuk objek (foto sendiri / pustaka Poly Haven) + pola tekstur tidak berulang | terkirim | 0.60 | 47,3 jt | 1,7 jt | 56.3× | 27.6× | 0.3 bln | 18 | **GO** |
| JEV-053 | Lampu luar (dinding luar, teras, taman) menyala dari jauh tanpa bocor ke dalam rumah | terkirim | 0.65 | 30,7 jt | 1,2 jt | 50.2× | 24.6× | 0.4 bln | 20 | **GO** |
| JEV-045 | RAB/BOQ otomatis dari denah (volume, luas, bukaan × harga satuan) | usulan | 0.45 | 309,8 jt | 12,8 jt | 47.6× | 23.3× | 0.4 bln | 21 | **DEFER** |
| JEV-060 | Sumber model dari Sketchfab, CGTrader & situs 3D gratis: pencarian Sketchfab + impor ZIP/OBJ/FBX | terkirim | 0.60 | 49,1 jt | 2,1 jt | 45.7× | 22.4× | 0.4 bln | 22 | **GO** |
| JEV-044 | Tekstur PBR foto untuk dinding & lantai (CC0) | usulan | 0.55 | 60,6 jt | 3 jt | 39.4× | 19.2× | 0.5 bln | 25 | **GO** |
| JEV-054 | Sumber aset realistis kedua: furnitur produk nyata (Wayfair, DGG) via Khronos glTF Sample Assets | terkirim | 0.60 | 30,2 jt | 1,5 jt | 39.3× | 19.2× | 0.5 bln | 25 | **GO** |
| JEV-007 | Mode jalan orang-pertama (+ joystick iPad) | terkirim | 0.60 | 170,1 jt | 10,7 jt | 30.9× | 15.0× | 0.6 bln | 32 | **GO** |
| JEV-030 | Langit foto 360° acak per lanskap (HDRI CC0) | terkirim | 0.55 | 43,3 jt | 3 jt | 27.9× | 13.4× | 0.7 bln | 35 | **GO** |
| JEV-008 | Render realistis (PBR, AO, HDR, GI, bayangan halus) | terkirim | 0.60 | 302,4 jt | 22,5 jt | 25.9× | 12.4× | 0.7 bln | 38 | **GO** |
| JEV-004 | Katalog furnitur & interior + thumbnail | terkirim | 0.65 | 188,8 jt | 14,3 jt | 25.5× | 12.3× | 0.7 bln | 38 | **GO** |
| JEV-031 | Galeri model fotogrametri (Poly Haven CC0) | terkirim | 0.55 | 34,7 jt | 2,7 jt | 24.7× | 11.8× | 0.7 bln | 39 | **GO** |
| JEV-050 | Model unggahan kategori Lampu: cahaya dibangkitkan + nyala/padam | terkirim | 0.60 | 14,3 jt | 1,4 jt | 20.2× | 9.6× | 0.9 bln | 48 | **GO** |
| JEV-049 | Duduk di kursi/sofa di mode jalan (katalog + model unggahan) | terkirim | 0.60 | 15,1 jt | 1,5 jt | 19.2× | 9.1× | 1.0 bln | 50 | **GO** |
| JEV-001 | Generator denah gambar → model 3D | terkirim | 0.65 | 351 jt | 36 jt | 18.5× | 8.8× | 0.8 bln | 52 | **GO** |
| JEV-048 | Pemilih panorama 360° manual (◀ ▶, galeri thumbnail, toggle acak) + pratinjau 1K | terkirim | 0.65 | 12,1 jt | 1,4 jt | 17.0× | 8.0× | 1.1 bln | 56 | **GO** |
| JEV-010 | Atap dak beton | terkirim | 0.60 | 23,6 jt | 3 jt | 14.8× | 6.9× | 1.2 bln | 64 | **GO** |
| JEV-009 | Ekspor GLB/OBJ/USDZ + AR maket | terkirim | 0.55 | 64,4 jt | 9,9 jt | 12.0× | 5.5× | 1.4 bln | 77 | **GO** |
| JEV-002 | Editor dinding, bukaan, multi-lantai, undo | terkirim | 0.65 | 131,6 jt | 21 jt | 11.5× | 5.3× | 1.4 bln | 80 | **GO** |
| JEV-020 | Pantulan probe untuk kaca, logam, air | terkirim | 0.50 | 19,7 jt | 4,2 jt | 8.4× | 3.7× | 2.1 bln | 107 | **GO** |
| JEV-012 | Builder situs & taman | terkirim | 0.50 | 31,5 jt | 7,2 jt | 7.7× | 3.4× | 2.2 bln | 115 | **GO** |
| JEV-011 | Tampak ortogonal atas/depan/iso | terkirim | 0.65 | 11,4 jt | 2,7 jt | 7.4× | 3.2× | 2.3 bln | 119 | **GO** |
| JEV-016 | Pustaka model .glb sendiri + collider otomatis | terkirim | 0.60 | 23,2 jt | 6,2 jt | 6.5× | 2.8× | 2.6 bln | 133 | **GO** |
| JEV-006 | Rapikan denah otomatis (pra-proses) | terkirim | 0.60 | 15 jt | 4,2 jt | 6.1× | 2.6× | 2.7 bln | 140 | **GO** |
| JEV-003 | Tangga 6 varian + void pelat | terkirim | 0.60 | 18 jt | 7,5 jt | 3.8× | 1.4× | 4.2 bln | 209 | **GO** |
| JEV-014 | Interaksi mode jalan (pintu, lampu, gorden, TV) | terkirim | 0.45 | 14,2 jt | 6,2 jt | 3.6× | 1.3× | 4.4 bln | 217 | **GO** |
| JEV-041 | Tes e2e + CI + lint ratchet di repo | terkirim | 0.85 | 6,1 jt | 2,9 jt | 3.3× | 1.1× | 3.6 bln | 0 | **GO** |
| JEV-040 | Guardrail keamanan G1–G6 (CSP, SRI, sanitasi proyek, esc, URI luar, galat global) | terkirim | 0.90 | 5,7 jt | 2,9 jt | 3.0× | 1.0× | 5.0 bln | 0 | **GO** |
| JEV-051 | Model unggahan kategori Audio: putar musik / piano | terkirim | 0.50 | 1,3 jt | 0,8 jt | 2.4× | 0.7× | 4.9 bln | 298 | **GO** |
| JEV-047 | Kolaborasi & berbagi tautan proyek (cloud) | usulan | 0.45 | 70,9 jt | 48 jt | 2.0× | 0.5× | 6.7 bln | 339 | **DEFER** |
| JEV-019 | SFX langkah kaki & interaksi | terkirim | 0.35 | 3,3 jt | 2,7 jt | 1.4× | 0.2× | 8.4 bln | 409 | **GO** |
| JEV-013 | Tracing void & area bentuk bebas | terkirim | 0.60 | 4,5 jt | 3,8 jt | 1.4× | 0.2× | 8.4 bln | 417 | **GO** |
| JEV-005 | Deteksi perabot dari simbol denah | terkirim | 0.45 | 20,3 jt | 19,5 jt | 1.1× | 0.0× | 10.0 bln | 482 | **GO** |
| JEV-042 | Modularisasi index.html (12k baris → modul + build) | usulan | 0.45 | 4,1 jt | 7,8 jt | 0.0× | -0.5× ⚠ | 23.1 bln | ∞ | **DEFER** |
| JEV-043 | Impor Gaussian splat (.splat/.ply) | usulan | 0.30 | 4,7 jt | 10,7 jt | -0.1× | -0.6× ⚠ | 28.1 bln | 1.127 | **NO-GO** |
| JEV-017 | Animasi api perapian | terkirim | 0.30 | 0,5 jt | 2 jt | -0.5× | -0.8× ⚠ | 61.4 bln | 2.064 | **NO-GO** |
| JEV-046 | Kompresi aset (meshopt + KTX2) untuk ukuran proyek | usulan | 0.45 | 0,9 jt | 4,8 jt | -0.6× | -0.8× ⚠ | 94.5 bln | ∞ | **NO-GO** |
| JEV-015 | Audio: CD, kaset, piringan hitam | terkirim | 0.30 | 0,5 jt | 4,8 jt | -0.8× | -0.9× ⚠ | 2080.0 bln | 5.080 | **NO-GO** |
| JEV-018 | Piano yang bisa dimainkan | terkirim | 0.25 | 0,1 jt | 3,9 jt | -1.0× | -1.0× ⚠ | ∞ | 24.762 | **NO-GO** |

⚠ = verdict rapuh: dengan peluang setengahnya ROI jatuh di bawah ambang tunda.

## Alasan per item

- **JEV-064 Atap menaungi semua lantai yang terbuka + galeri model semua kategori dengan Muat lebih banyak — GO.** ROI 169.3× ≥ 1, payback 0.1 bln.
- **JEV-062 Rampingkan model unduhan (tekstur → 1024 px) + pulih dari hilangnya konteks WebGL — GO.** ROI 166.6× ≥ 1, payback 0.1 bln.
- **JEV-058 Tautan lihat-saja: proyek di fragmen URL, penerima bisa jalan-jalan tanpa bisa mengedit — GO.** ROI 121.8× ≥ 1, payback 0.2 bln.
- **JEV-065 Lantai hantu tanpa kaca putih + material lantai per tingkat + layar TV hidup (saluran bawaan, video, GIF) — GO.** ROI 114.3× ≥ 1, payback 0.1 bln.
- **JEV-066 Garis tepi lembut untuk lampu padam saat malam (mode jalan) — GO.** ROI 99.0× ≥ 1, payback 0.2 bln.
- **JEV-067 Tautan lihat yang terbuka di HP (tautan pendek), kebocoran cahaya antar-lantai, menu jalan bisa diciutkan + kualitas, ikon SVG — GO.** ROI 85.7× ≥ 1, payback 0.2 bln.
- **JEV-052 Lampu menerangi ruangannya dari kejauhan & dari luar (GI per ruang untuk semua lampu, semua lantai) — GO.** ROI 73.5× ≥ 1, payback 0.3 bln.
- **JEV-061 Bahasa Inggris sebagai bahasa bawaan, Bahasa Indonesia tetap bisa dipilih — GO.** ROI 66.8× ≥ 1, payback 0.2 bln.
- **JEV-056 Furnitur bawaan realistis: kasur, sofa, sanitair, dapur (prosedural) + pintasan ruangan di galeri model — GO.** ROI 66.2× ≥ 1, payback 0.3 bln.
- **JEV-063 Model hasil scan 3D: tag fotogrametri Sketchfab + sumber Google Scanned Objects — GO.** ROI 65.4× ≥ 1, payback 0.2 bln.
- **JEV-055 Kaca realistis: Fresnel, serapan Beer–Lambert, pantulan aditif — jendela, pintu kaca, shower, dan kaca model — GO.** ROI 62.0× ≥ 1, payback 0.3 bln.
- **JEV-057 Redesign UI/UX: kartu Mulai + rumah contoh, tab berikon (Tampilan terpisah), toolbar berlabel + menu Lainnya, pencarian furnitur, target sentuh ≥ 44 px — GO.** ROI 58.4× ≥ 1, payback 0.3 bln.
- **JEV-059 Tekstur foto untuk objek (foto sendiri / pustaka Poly Haven) + pola tekstur tidak berulang — GO.** ROI 56.3× ≥ 1, payback 0.3 bln.
- **JEV-053 Lampu luar (dinding luar, teras, taman) menyala dari jauh tanpa bocor ke dalam rumah — GO.** ROI 50.2× ≥ 1, payback 0.4 bln.
- **JEV-045 RAB/BOQ otomatis dari denah (volume, luas, bukaan × harga satuan) — DEFER.** ROI 47.6× menjanjikan, tetapi biaya 12,8 jt > 10 jt dengan bukti "anekdot" — validasi murah dulu (wawancara/prototipe) hingga bukti ≥ uji-pengguna. _Hipotesis ROI tertinggi di backlog — validasi dengan 5 wawancara arsitek/kontraktor sebelum dibangun (naikkan bukti ke uji-pengguna)._
- **JEV-060 Sumber model dari Sketchfab, CGTrader & situs 3D gratis: pencarian Sketchfab + impor ZIP/OBJ/FBX — GO.** ROI 45.7× ≥ 1, payback 0.4 bln.
- **JEV-044 Tekstur PBR foto untuk dinding & lantai (CC0) — GO.** ROI 39.4× ≥ 1, payback 0.5 bln.
- **JEV-054 Sumber aset realistis kedua: furnitur produk nyata (Wayfair, DGG) via Khronos glTF Sample Assets — GO.** ROI 39.3× ≥ 1, payback 0.5 bln.
- **JEV-007 Mode jalan orang-pertama (+ joystick iPad) — GO.** ROI 30.9× ≥ 1, payback 0.6 bln.
- **JEV-030 Langit foto 360° acak per lanskap (HDRI CC0) — GO.** ROI 27.9× ≥ 1, payback 0.7 bln.
- **JEV-008 Render realistis (PBR, AO, HDR, GI, bayangan halus) — GO.** ROI 25.9× ≥ 1, payback 0.7 bln.
- **JEV-004 Katalog furnitur & interior + thumbnail — GO.** ROI 25.5× ≥ 1, payback 0.7 bln.
- **JEV-031 Galeri model fotogrametri (Poly Haven CC0) — GO.** ROI 24.7× ≥ 1, payback 0.7 bln.
- **JEV-050 Model unggahan kategori Lampu: cahaya dibangkitkan + nyala/padam — GO.** ROI 20.2× ≥ 1, payback 0.9 bln.
- **JEV-049 Duduk di kursi/sofa di mode jalan (katalog + model unggahan) — GO.** ROI 19.2× ≥ 1, payback 1.0 bln.
- **JEV-001 Generator denah gambar → model 3D — GO.** ROI 18.5× ≥ 1, payback 0.8 bln.
- **JEV-048 Pemilih panorama 360° manual (◀ ▶, galeri thumbnail, toggle acak) + pratinjau 1K — GO.** ROI 17.0× ≥ 1, payback 1.1 bln.
- **JEV-010 Atap dak beton — GO.** ROI 14.8× ≥ 1, payback 1.2 bln.
- **JEV-009 Ekspor GLB/OBJ/USDZ + AR maket — GO.** ROI 12.0× ≥ 1, payback 1.4 bln.
- **JEV-002 Editor dinding, bukaan, multi-lantai, undo — GO.** ROI 11.5× ≥ 1, payback 1.4 bln.
- **JEV-020 Pantulan probe untuk kaca, logam, air — GO.** ROI 8.4× ≥ 1, payback 2.1 bln.
- **JEV-012 Builder situs & taman — GO.** ROI 7.7× ≥ 1, payback 2.2 bln.
- **JEV-011 Tampak ortogonal atas/depan/iso — GO.** ROI 7.4× ≥ 1, payback 2.3 bln.
- **JEV-016 Pustaka model .glb sendiri + collider otomatis — GO.** ROI 6.5× ≥ 1, payback 2.6 bln.
- **JEV-006 Rapikan denah otomatis (pra-proses) — GO.** ROI 6.1× ≥ 1, payback 2.7 bln.
- **JEV-003 Tangga 6 varian + void pelat — GO.** ROI 3.8× ≥ 1, payback 4.2 bln.
- **JEV-014 Interaksi mode jalan (pintu, lampu, gorden, TV) — GO.** ROI 3.6× ≥ 1, payback 4.4 bln.
- **JEV-041 Tes e2e + CI + lint ratchet di repo — GO.** kelas wajib (keamanan/hukum/keandalan) — ROI tetap dihitung untuk transparansi.
- **JEV-040 Guardrail keamanan G1–G6 (CSP, SRI, sanitasi proyek, esc, URI luar, galat global) — GO.** kelas wajib (keamanan/hukum/keandalan) — ROI tetap dihitung untuk transparansi.
- **JEV-051 Model unggahan kategori Audio: putar musik / piano — GO.** ROI 2.4× ≥ 1, payback 4.9 bln. _Kategori audio/piano sendiri ber-verdict NO-GO (JEV-015/018). Item ini hanya MEMAKAI ULANG mesin yang sudah ada — biayanya kecil._
- **JEV-047 Kolaborasi & berbagi tautan proyek (cloud) — DEFER.** ROI lolos, tetapi guardrail belum dinilai: keamanan, privasi.
- **JEV-019 SFX langkah kaki & interaksi — GO.** ROI 1.4× ≥ 1, payback 8.4 bln.
- **JEV-013 Tracing void & area bentuk bebas — GO.** ROI 1.4× ≥ 1, payback 8.4 bln.
- **JEV-005 Deteksi perabot dari simbol denah — GO.** ROI 1.1× ≥ 1, payback 10.0 bln. _Pengguna beberapa kali melaporkan hasil "masih ngaco" → peluang diturunkan ke 0,45. Akurasi uji: 88/97 simbol benar pada 5 denah uji._
- **JEV-042 Modularisasi index.html (12k baris → modul + build) — DEFER.** ROI 0.04 < 1; payback 23 bln. _lainRpPerTahun = ±60 jam pemeliharaan/tahun yang dihemat × tarif._
- **JEV-043 Impor Gaussian splat (.splat/.ply) — NO-GO.** ROI -0.11 < 0 — nilai harapan lebih kecil dari biaya.
- **JEV-017 Animasi api perapian — NO-GO.** ROI -0.52 < 0 — nilai harapan lebih kecil dari biaya.
- **JEV-046 Kompresi aset (meshopt + KTX2) untuk ukuran proyek — NO-GO.** ROI -0.61 < 0 — nilai harapan lebih kecil dari biaya.
- **JEV-015 Audio: CD, kaset, piringan hitam — NO-GO.** ROI -0.80 < 0 — nilai harapan lebih kecil dari biaya.
- **JEV-018 Piano yang bisa dimainkan — NO-GO.** ROI -0.96 < 0 — nilai harapan lebih kecil dari biaya. _Menyumbang 2 bug yang dilaporkan pengguna (tidak bisa berhenti, bisu di iPad)._

## Pelajaran retrospektif

Fitur yang **sudah dibangun** tetapi tidak lolos gerbang ROI bila dinilai sejak awal (3):

- JEV-015 Audio: CD, kaset, piringan hitam — NO-GO; biaya 4,8 jt vs EV 0,5 jt/tahun.
- JEV-017 Animasi api perapian — NO-GO; biaya 2 jt vs EV 0,5 jt/tahun.
- JEV-018 Piano yang bisa dimainkan — NO-GO; biaya 3,9 jt vs EV 0,1 jt/tahun.

Total biaya 2 tahun pada item itu: **10,7 jt** — kapasitas yang semestinya bisa dialihkan ke item GO di backlog.
