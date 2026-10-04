# PRD — Arsitek 3D (Floor Plan Generator by Wolfpup Labs)

| | |
|---|---|
| Versi dokumen | 1.0 · 2026-10-03 |
| Pemilik produk | Wolfpup Labs |
| Status | Produk berjalan (live di Vercel/GitHub Pages); dokumen ini menetapkan baseline + aturan keputusan ke depan |
| Keputusan | Setiap kemampuan di dokumen ini punya item **JEV** (`docs/jev/registry.json`). Verdict GO/DEFER/NO-GO dihitung dari ROI, bukan dari selera. Lihat `docs/jev/LAPORAN.md` |

---

## 1. Ringkasan

Arsitek 3D mengubah **gambar denah 2D** (foto, scan, PDF yang di-screenshot) menjadi **model 3D yang bisa diedit, dijelajahi, dan dipresentasikan** langsung di peramban. Aplikasi ini berjalan di iPad tanpa instalasi, tanpa akun, dan tanpa server.

**Kalimat nilai:** *"Dari denah ke presentasi 3D yang meyakinkan klien dalam hitungan menit, bukan jam."*

## 2. Masalah

| # | Masalah | Siapa yang merasakan | Bukti saat ini |
|---|---|---|---|
| P1 | Memodelkan denah ke 3D secara manual (SketchUp/Revit/Blender) memakan 2–4 jam per rumah | Arsitek, drafter, kontraktor kecil | Premis produk; permintaan pemilik produk |
| P2 | Klien awam tidak bisa membaca denah 2D, sehingga keputusan tertunda dan revisi berulang | Arsitek/desainer ↔ pemilik rumah | Anekdot lapangan |
| P3 | Alat 3D profesional mahal, berat, dan tidak nyaman di iPad yang dibawa ke rapat klien | Desainer lepas, kontraktor | Perangkat utama pengguna = iPad (Chrome) |
| P4 | Pertanyaan pertama klien selalu "berapa biayanya?", dan estimasi dari denah dikerjakan manual | Arsitek, kontraktor | Hipotesis — **belum divalidasi** (JEV-045) |

## 3. Pengguna & persona

| Persona | Tujuan | Konteks | Kriteria sukses mereka |
|---|---|---|---|
| **Rani — arsitek/desainer lepas** (primer) | Memenangkan klien, mempercepat revisi | iPad di rapat; laptop di kantor | Model 3D layak presentasi < 15 menit dari denah |
| **Pak Budi — kontraktor kecil** | Menunjukkan hasil akhir ke pemilik rumah, menghitung kebutuhan | Lapangan, sinyal seluler | Bisa dipakai tanpa pelatihan; cepat di jaringan lambat |
| **Sinta — pemilik rumah** (penerima) | Memahami ruang sebelum membangun | Menerima tautan/berkas | Bisa "berjalan" di rumahnya sendiri |

Di luar sasaran (sekarang): BIM penuh, gambar kerja struktur/MEP, kolaborasi waktu nyata.

## 4. Tujuan & metrik

| Tujuan | Metrik utama | Target 6 bulan | Cara ukur |
|---|---|---|---|
| T1 Kecepatan | Median waktu dari unggah denah → model 3D siap presentasi | ≤ 15 menit | Analitik lokal opt-in (TD-09) |
| T2 Akurasi | % unggahan dengan ≥ 4 dinding benar tanpa koreksi | ≥ 70% | Sama + set denah uji `tests/fixtures` |
| T3 Daya yakin | % sesi yang masuk mode jalan / AR | ≥ 40% | Sama |
| T4 Keandalan | Rilis yang perlu hotfix ≤ 48 jam | ≤ 1 per kuartal | Riwayat PR/CI |
| T5 Keamanan | Temuan High/Critical terbuka | 0 | `docs/AUDIT.md` |

**Metrik pengaman (tidak boleh memburuk):** waktu muat pertama di iPad ≤ 4 s (Wi-Fi); FPS mode jalan ≥ 30 di mutu "Halus"; ukuran `index.html` ≤ 900 KB; tidak ada data proyek yang meninggalkan perangkat tanpa tindakan pengguna.

## 5. Lingkup fungsional

Prioritas: **P0** = inti (tanpa ini produk tidak ada), **P1** = pembeda, **P2** = pelengkap. Kolom JEV merujuk keputusan ROI.

### 5.1 Denah → 3D (P0)

| ID | Kebutuhan | Kriteria penerimaan | JEV |
|---|---|---|---|
| F-01 | Unggah gambar denah (PNG/JPG/WebP) per lantai | Gambar tampil di pratinjau; iPad bisa memilih dari Files tanpa penyaring ekstensi | JEV-001 |
| F-02 | Pra-proses otomatis: luruskan, bersihkan, normalisasi kontras/resolusi (bisa dimatikan) | Denah bersih tidak berubah; foto miring ≤ 15° diluruskan | JEV-006 |
| F-03 | Kalibrasi skala dari lebar bangunan (m/cm) atau manual | Panjang dinding hasil ±3% dari dimensi tertulis pada denah uji | JEV-001 |
| F-04 | Ekstraksi dinding vektor, pintu, jendela, dinding masif/poche | ≥ 4 dinding benar pada denah uji A–D | JEV-001 |
| F-05 | Deteksi simbol perabot → perabot 3D (bisa dimatikan; kepekaan ketat/normal/longgar) | Presisi ≥ 85% pada mode normal; tiap perabot bisa di-*flip* | JEV-005 |

### 5.2 Editor (P0)

| ID | Kebutuhan | Kriteria penerimaan | JEV |
|---|---|---|---|
| E-01 | Gambar/ubah dinding (posisi, panjang, tebal), bukaan (pintu, jendela, garasi) | Snap, label dimensi, inspector numerik | JEV-002 |
| E-02 | Multi-lantai: tambah kosong / salin lantai, elevasi otomatis, lantai lain transparan | Ganti lantai membersihkan alat aktif (tracing) | JEV-002 |
| E-03 | Urung/ulang 60 langkah (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y) | Satu perubahan = satu catatan | JEV-002 |
| E-04 | Tangga 6 varian (lurus, bordes, L, U, putar, lengkung) + cek kaidah 2R+A, void pelat | Peringatan bila optrede/antrede di luar kaidah | JEV-003 |
| E-05 | Void & area bentuk bebas dengan *tracing* titik | Tutup di titik pertama/ketuk-ganda/Enter; gambar denah tampil di bawahnya | JEV-013 |
| E-06 | Atap dak mengikuti tapak, tritisan & tebal bisa diatur; saat tertutup, **setiap lantai** beratap pada bagian yang tidak tertutup lantai di atasnya | Dari dalam lantai bawah yang lebih luas tidak terlihat langit (tes) | JEV-010, JEV-064 |
| E-07 | Tampak cepat: 3D, atas, depan, iso (ortogonal), mata | Atas/depan tanpa perspektif | JEV-011 |
| E-08 | **UI ramah pengguna**: kartu *Mulai* pada proyek kosong (unggah denah · gambar dinding · rumah contoh · buka proyek); 5 tab berikon (pengaturan render/material/tampilan di tab **Tampilan**); toolbar ikon + label dengan alat jarang dipakai di menu **⋯ Lainnya**; langkah bernomor & tombol *Buat dinding 3D* menempel; pencarian furnitur; target sentuh ≥ 44 px, `aria-label` & cincin fokus | Toolbar satu baris berlabel di iPad landscape dengan panel terbuka; rumah contoh dimuat & bisa langsung dijelajahi | JEV-057 |
| E-09 | **Tautan lihat-saja**: proyek dipadatkan ke fragmen URL (`#lihat=…`, tidak pernah dikirim ke server); penerima melihat & jalan-jalan (pintu, lampu, duduk) tanpa alat edit; model katalog Poly Haven/produk nyata ikut sebagai rujukan dan diunduh ulang; model unggahan sendiri tidak ikut (disebutkan saat membuat tautan) | Rumah contoh ±1,3 KB; tautan rusak, bom kompresi & isi jahat ditolak/disaring tanpa merusak aplikasi | JEV-058 |
| E-10 | **Bahasa Inggris bawaan**, Bahasa Indonesia pilihan (pemilih bahasa di kepala panel & bar lihat-saja; pilihan diingat per perangkat). Lapisan terjemahan DOM dari `lang/en.js`: kalimat utuh, frasa bertag (`<b>`/`<kbd>`), pola untuk pesan berisi angka/nama; teks yang muncul belakangan (toast, inspector, galeri) ikut lewat MutationObserver | Tanpa pilihan tersimpan → Inggris; semua tab, kartu Mulai, toolbar & inspector tanpa sisa teks Indonesia (tes); nama buatan pengguna tidak disentuh | JEV-061 |
| E-11 | **Material lantai per tingkat** (mis. bawah keramik, atas parket) di panel Lantai; kosong = ikut finishing proyek. Lantai lain bermode tembus pandang tidak lagi menampilkan kaca sebagai balok putih | Pelat lantai 1 & 2 berbahan berbeda; nilai tak dikenal dibuang saat dimuat (tes) | JEV-065 |
| E-12 | **Layar TV hidup**: TV yang dinyalakan (mode jalan atau tombol inspector) memutar tayangan bergerak — saluran bawaan Senja di pantai, Akuarium, Kota malam berhujan, Aurora (digambar di kanvas, tanpa berkas) — atau video MP4/MOV/WebM / GIF milik pengguna per TV (bisu, berulang, tersimpan di proyek, maks. 15 MB) | Kanvas berubah antarbingkai, GIF bergantian bingkai, video lewat VideoTexture bisu & berulang, berkas palsu ditolak (tes) | JEV-065 |
| E-13 | **Garis lampu dalam gelap**: di mode jalan saat suasana malam/gelap, lampu yang padam diberi garis tepi lembut (rim, memudar masuk/keluar) agar mudah ditemukan; lampu yang dibidik garisnya lebih terang; lampu menyala, siang, dan editor tanpa garis | Garis tampil hanya pada kondisi itu, tidak bisa dibidik/ditabrak, tidak ikut ekspor (tes) | JEV-066 |
| E-14 | **Tautan lihat pendek & UI jalan ringkas**: tautan lihat disimpan lewat `api/tautan` (Vercel Blob) menjadi `#l=<10 karakter>`; tanpa Blob kembali ke tautan panjang dengan catatan; foto tekstur pribadi tidak ikut tautan & angka dibulatkan. Tautan gagal dibuka → pesan tetap tampil di bar lihat. Bilah mode jalan bisa diciutkan (bawaan ciut di layar < 700 px) dan memuat pilihan kualitas. Emoji UI diganti ikon SVG garis seragam | Tautan pendek dibuat & dibuka penerima; 501 → tautan panjang + catatan; tanpa emoji di chrome & semua ikon terpasang (tes) | JEV-067 |

### 5.3 Isi ruang & lingkungan (P1)

| ID | Kebutuhan | JEV |
|---|---|---|
| I-01 | Katalog 122 objek dalam 15 kategori (kamar, ruang, dapur, kamar mandi, lampu, dekor, taman, dll.) dengan thumbnail 3D | JEV-004 |
| I-01a | Kasur, sofa (2/3 dudukan, kursi santai, L), kloset, bathtub, wastafel, meja wastafel, shower, sink, kulkas, kompor & kitchen set **realistis**: tepi membulat, bantal menggembung, selimut menjuntai, kain ber-sheen dengan anyaman, porselen berglasir, keran krom, marmer, venir kayu, stainless disikat (semua prosedural, tanpa unduhan). Tetap di dalam tapak denah (±15 cm), ≤ 40 rb titik per objek | JEV-056 |
| I-01b | **Tekstur foto** per objek (katalog & model unggahan): pilih bagian (kain, kayu, marmer, …) lalu pakai **foto sendiri** (diperkecil ≤ 1024 px, tepinya dibuat mulus otomatis) atau **pustaka foto PBR Poly Haven** (CC0: warna + normal + kekasaran; saring Kain · Kulit · Kayu · Batu & marmer · Logam). Ukuran pola dalam meter. **Tanpa pola berulang**: tiap sampel tekstur digeser acak per area (shader), juga pada kain/kayu/marmer bawaan. Ikut tersimpan & ikut tautan lihat-saja (Poly Haven sebagai rujukan) | JEV-059 |
| I-02 | Model sendiri `.glb` (≤ 20 MB) + collider otomatis | JEV-016 |
| I-03 | Galeri model fotogrametri (Poly Haven, CC0), tekstur 1K/2K | JEV-031 |
| I-03a | Sumber kedua: 14 model **produk nyata** terkurasi (sofa, kursi, pouf, lampu, tanaman, dekor, kulkas, mobil — Wayfair, DGG; CC0/CC-BY 4.0) dari Khronos glTF Sample Assets. Tiap berkas dikunci ke commit + **SHA-256 diverifikasi**; kursi/sofa langsung bisa diduduki, lampu langsung menyala; atribusi CC-BY disimpan di aset; lampu bawaan model dibuang | JEV-054 |
| I-03b | **Pintasan ruangan** di galeri model realistis (Kamar tidur · Sofa & kursi · Kamar mandi · Dapur) untuk kedua sumber; dicocokkan per kata (bukan potongan huruf) | JEV-056 |
| I-03c | **Sketchfab** di galeri model realistis: cari (kata kunci atau ruangan), hanya lisensi bebas-komersial (CC0/CC-BY/CC-BY-SA), unduh dengan token API milik pengguna (disimpan di perangkat saja), atribusi tersimpan di aset. **Situs lain** (CGTrader, TurboSquid, Free3D, Poly Pizza, Smithsonian 3D, Fab) ditautkan dengan kata kunci yang sama; berkas unduhannya diunggah: **.glb, .gltf + .bin, ZIP, .obj + .mtl + tekstur, .fbx** → diubah ke .glb (satuan cm/mm dikenali) | JEV-060 |
| I-03d | **Rampingkan model** sebelum masuk pustaka (seperti gltf.report, di perangkat): gambar di GLB diperkecil ke sisi 1024 px & PNG tanpa alfa → JPEG; mesh, material & ekstensi disalin byte demi byte. Laporan model di inspector (berkas asal → sekarang, segitiga, tekstur, memori GPU) + tombol perkecil ke 512 px. Pulih otomatis bila konteks WebGL hilang | Tekstur 4096×2048 → 1024×512 JPEG, ekstensi utuh; proyek lama dirampingkan saat dibuka; setelah konteks hilang model tidak hitam (tes) | JEV-062 |
| I-03e | **Model hasil scan 3D**: pencarian Sketchfab ikut menyertakan model bertag *photogrammetry* / *3dscan* / *3d-scan* / *scan* (ditandai 📷 Scan, didahulukan, bisa disaring "Hanya scan"). Sumber baru **Google Scanned Objects** (1.000+ benda rumah tangga hasil scan Google Research, CC-BY 4.0, lewat API Gazebo Fuel tanpa token): ZIP OBJ+tekstur → GLB → dirampingkan; ikut tautan lihat-saja sebagai rujukan; bila unduhan ditolak peramban, halaman model dibuka untuk unduh manual | Tag scan diminta & digabung tanpa duplikat; nama model berbahaya ditolak; atribusi CC-BY tersimpan (tes, API ditiru) | JEV-063 |
| I-03f | **Galeri semua kategori**: pintasan Kamar tidur, Sofa & kursi, Kamar mandi, Dapur, Lampu, Meja, Lemari & rak, Dekor, Tanaman, Luar ruang, Elektronik, Kendaraan — berlaku di semua sumber; Sketchfab & Google Scanned Objects bisa dijelajah tanpa kata kunci (populer yang bisa diunduh); **Muat lebih banyak** di Sketchfab (halaman berikutnya API), Google Scanned Objects (per 40) & Poly Haven (per 160) | Tanpa kata kunci tetap mencari; halaman berikutnya digabung tanpa duplikat; tombol hilang saat habis (tes) | JEV-064 |
| I-04 | Situs: tanah, rumput, kerikil, paving, kolam, setapak, pagar | JEV-012 |

### 5.4 Presentasi & realisme (P1)

| ID | Kebutuhan | JEV |
|---|---|---|
| R-01 | Mutu render Cepat/Halus/Tinggi; PBR, AO, bloom, HDR + eksposur otomatis, GI per ruang, bayangan halus | JEV-008 |
| R-02 | Suasana siang/senja/malam/malam gelap; lampu dengan lumen | JEV-008 |
| R-03 | Pantulan probe kaca/logam/air | JEV-020 |
| R-03a | **Kaca realistis**: bening bila dilihat tegak lurus (±96% latar lolos), memantul kuat dari sudut miring (Fresnel, IOR 1,5), pantulan ditambahkan ke latar (bukan dikali alfa) sehingga malam hari kaca memantulkan ruangan, warna hijau-biru makin terasa pada lintasan miring (Beer–Lambert). Kaca model glTF (`KHR_materials_transmission`) memakai shader yang sama | JEV-055 |
| R-02a | Setiap lampu yang menyala menerangi ruangannya — juga dari kejauhan, dari luar rumah, dan di lantai lain (GI per ruang hingga 4 lantai; 4 lampu terdekat tetap mendapat cahaya langsung berbayang) | JEV-052 |
| R-02b | Lampu luar (dinding luar, teras, taman) tanpa slot berbayang tetap menerangi sekitarnya dari jauh — dihitung di shader hanya untuk permukaan di luar ruangan, jadi tidak bocor ke dalam rumah | JEV-053 |
| R-04 | Langit prosedural atau **foto 360° HDRI** per lanskap; unggah 360° sendiri | JEV-030 |
| R-04a | **Pilih sendiri** (bawaan): daftar urut, ◀ ▶, galeri bergambar dengan saringan lanskap/waktu/kata; pratinjau 1K lalu resolusi penuh; mode **Acak** hanya bila dinyalakan; pilihan terakhir diingat | JEV-048 |
| R-05 | Mode jalan orang-pertama: WASD/joystick sentuh, tangga, tabrakan, lensa | JEV-007 |
| R-06 | Interaksi: pintu, lampu, gorden, TV | JEV-014 |
| R-06a | **Duduk** di kursi/sofa/bangku katalog & model unggahan berkategori Duduk: mata turun ±72 cm di atas dudukan, menghadap depan kursi, dudukan sofa terdekat dengan titik bidik; berdiri dengan E/tombol/berjalan | JEV-049 |
| R-06b | Model unggahan punya **kategori interaksi**: Lampu (cahaya dibangkitkan di titik cahaya yang bisa diatur, bagian kaca/kap/emissive menyala, lumen + saran SNI), Audio (CD/kaset/piringan hitam/kotak musik), Piano, Duduk (tinggi dudukan & arah hadap) | JEV-050, JEV-051 |
| R-07 | SFX langkah/pintu (P2) · musik CD/kaset/piringan hitam, api perapian, piano (**NO-GO** di JEV, dibekukan: perbaikan bug saja) | JEV-015/017/018/019 |

### 5.5 Berkas & berbagi (P0/P1)

| ID | Kebutuhan | Kriteria penerimaan | JEV |
|---|---|---|---|
| X-01 | Simpan/muat proyek `.json` (termasuk gambar denah & model) | Muat **atomik**; berkas tak sah/berbahaya ditolak tanpa merusak proyek terbuka | JEV-002, JEV-040 |
| X-02 | Ekspor OBJ, GLB, PNG resolusi tinggi | — | JEV-009 |
| X-03 | AR maket skala (model-viewer; USDZ untuk iOS Quick Look) | — | JEV-009 |

## 6. Kebutuhan non-fungsional

| Kategori | Kebutuhan |
|---|---|
| Platform | iPad (Chrome & Safari iPadOS ≥ 16) adalah target utama; Chrome/Edge/Safari desktop. Tanpa instalasi. |
| Kinerja | Muat pertama ≤ 4 s (Wi-Fi); `index.html` ≤ 900 KB; FPS mode jalan ≥ 30 (Halus, iPad M1); tekstur langit ≤ 32 MB GPU |
| Luring | Inti (denah→3D, edit, simpan) berjalan tanpa internet setelah termuat; fitur daring (HDRI, galeri) gagal dengan pesan jelas dan kembali ke cadangan |
| Privasi | Tidak ada akun, cookie pelacak, atau telemetri. Data proyek tidak keluar perangkat. Permintaan ke pihak ketiga hanya atas tindakan pengguna, ke host di daftar izin (`tools/guard-config.json`) |
| Keamanan | Lihat `docs/AUDIT.md`: berkas proyek = masukan tak tepercaya (G1–G3); CSP (G4); SRI (G5); galat tertangkap (G6) |
| Lisensi | Aset pihak ketiga hanya CC0/MIT/Apache; kredit ditautkan |
| Aksesibilitas | Teks UI kontras ≥ 4.5:1; kontrol bisa dipakai sentuh & papan tik; elemen baru wajib `aria-label` (TD-08) |
| Bahasa | UI Bahasa Indonesia |

## 7. Batasan & asumsi

- Arsitektur satu berkas statis (tanpa build) adalah keputusan sadar: deploy cukup salin berkas, bisa dibuka di iPad mana pun. Biayanya ada di TD-02/SEC-11.
- three.js r128 dikunci (TD-05).
- Angka pengguna, tarif, dan nilai di model ROI adalah **asumsi awal** (`docs/jev/model.json`) sampai ada data (TD-09).

## 8. Di luar lingkup (eksplisit)

Kolaborasi waktu nyata & penyimpanan cloud (JEV-047, DEFER: kajian privasi/UU PDP belum dilakukan) · BIM/IFC · gambar kerja struktur & MEP · render *path-traced* · impor Gaussian splat (JEV-043, NO-GO: kinerja iPad belum terbukti, ROI negatif).

## 9. Roadmap berbasis ROI

Urutan diambil dari `docs/jev/LAPORAN.md`, bukan dari daftar keinginan:

| Urutan | Item | Verdict | Langkah berikutnya |
|---|---|---|---|
| 1 | JEV-045 RAB/BOQ otomatis | DEFER → validasi | 5 wawancara arsitek/kontraktor + prototipe kertas (≤ 8 jam). Bila ≥ 3/5 mau memakai/membayar → bukti naik ke `uji-pengguna`, lalu GO |
| 2 | JEV-044 Tekstur PBR foto dinding/lantai | GO | Bangun (±16 jam) |
| 3 | TD-09 Analitik lokal opt-in | (usulkan) | Kalibrasi semua asumsi JEV |
| 4 | JEV-042 Modularisasi | DEFER | Tinjau ulang bila tim > 1 pengembang atau SEC-11 menjadi wajib |
| — | JEV-015/017/018 (audio, api, piano) | NO-GO | **Dibekukan**: tidak ada pengembangan baru, hanya perbaikan bug |

## 10. Kriteria rilis

Rilis boleh di-merge ke `main` bila: (1) PR merujuk item JEV ber-verdict GO, (2) CI hijau (lint, guardrail, gerbang JEV, e2e), (3) tidak ada temuan High/Critical baru, (4) perubahan UI sentuh/audio/mode jalan diuji di iPad. Rincian di `docs/SDLC.md`.
