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
| SEC-12 | Sedang (desain) | Tautan lihat-saja (JEV-058) membawa proyek di fragmen URL — siapa pun bisa membuat tautan berisi data jahat atau bom kompresi | Dibuka korban → DoS/XSS bila tidak disaring | ✅ Dicegah sejak awal — batas kode 6 MB & 20 MB sesudah dibuka, `sanitasiProyek()` (G2), model hanya lewat rujukan Poly Haven/Khronos ber-SHA-256; tes e2e bom kompresi, tautan rusak, nama berisi HTML |
| SEC-13 | Sedang (desain) | Impor ZIP/OBJ/FBX & Sketchfab (JEV-060): berkas arsip dari internet, token API pengguna, pustaka loader tambahan | Bom zip, glTF berURL luar, token bocor ke proyek/tautan, rantai pasok loader | ✅ Dicegah sejak awal — batas 200 MB sesudah dibuka, URL luar ditolak, token hanya di localStorage & hanya ke api.sketchfab.com, loader terkunci versi + SRI; tes e2e |
| SEC-14 | Rendah (desain) | Lapisan bahasa (JEV-061) menulis `innerHTML` untuk frasa bertag | Isi dinamis yang sudah di-escape aplikasi disusun ulang tanpa di-unescape; bila kamus memuat HTML jahat | ✅ Dicegah sejak awal — HTML hanya dari kamus statis milik repo (`lang/en.js`, lewat review), isi tangkapan pola hanya dipindah/diterjemahkan dengan kamus yang sama, pesan biasa tetap lewat `textContent`; tes memastikan `<b>` dalam nama pengguna tetap teks |
| SEC-15 | Rendah (desain) | Sumber Google Scanned Objects (JEV-063): host baru `fuel.gazebosim.org`, nama model dari API dipakai di URL & teks | Path injection lewat nama model; ZIP berbahaya | ✅ Dicegah sejak awal — nama model divalidasi `[A-Za-z0-9_.()-]` lalu di-encode; thumbnail hanya dari host Fuel; ZIP lewat jalur impor yang sama (batas 200 MB, bom zip, G3, dirampingkan); teks lewat `textContent` |
| SEC-16 | Rendah (desain) | Video/GIF untuk layar TV (JEV-065) tertanam di berkas proyek | Berkas menyamar (HTML/skrip) atau GIF raksasa (memori) | ✅ Dicegah sejak awal — jenis ditentukan dari isi (tanda tangan GIF/WebM/MP4/MOV), MIME disaring `video/(mp4|webm|quicktime)` & `image/gif`, maks. 15 MB × 12 berkas; GIF diurai sendiri dengan batas 1 megapiksel & 300 bingkai; diputar lewat `blob:` (CSP `media-src`), bisu |
| SEC-17 | Sedang (desain) | Tautan pendek (JEV-067): fungsi `api/tautan` menerima & menyimpan proyek dari siapa saja di Vercel Blob | Penyalahgunaan penyimpanan (berkas besar/bukan proyek), bom kompresi, penebakan ID, isi jahat untuk penerima | ✅ Dicegah sejak awal — badan maks. 1,5 MB, inflate dibatasi 20 MB, hanya JSON `{v:1, levels:[]}` yang diterima, ID acak 10 karakter (±57¹⁰) divalidasi regex sebelum dipakai sebagai path, metode lain 405, tanpa token → 501 (aplikasi kembali ke tautan panjang); penerima tetap menyaring lewat `sanitasiProyek()`; foto tekstur pribadi tidak ikut. Residual: tanpa rate-limit (andalkan batas Vercel) |
| SEC-18 | Sedang (desain) | Lampiran tautan (JEV-068): model, foto & video sendiri diunggah per potongan ke `api/tautan?bagian=` dan diunduh penerima | Potongan ditukar/ditimpa isi lain, berkas jahat untuk penerima, penyalahgunaan penyimpanan | ✅ Dicegah sejak awal — potongan ≤ 3 MB **beralamat isi** (nama = SHA-256, diperiksa server sebelum disimpan & penerima sesudah diunduh), tidak pernah ditimpa; penerima membatasi 80 MB per tautan, lalu menyaring lewat `sanitasiProyek()` (jenis gambar/video, ukuran) dan model lewat G3 + dirampingkan. Residual: siapa pun bisa menyimpan potongan ≤ 3 MB tanpa rate-limit (sama dengan SEC-17) |
| SEC-19 | Sedang (desain) | Interaksi Detail (JEV-076) menyimpan tautan luar & teks bebas di proyek/tautan lihat; media audio/gambar baru | Tautan `javascript:`/phishing, HTML di teks, berkas menyamar | ✅ Dicegah sejak awal — tautan diurai `new URL`, hanya http(s), dibuka hanya lewat ketukan pengunjung di tab baru `noopener,noreferrer` dengan nama host ditampilkan; judul/keterangan lewat `textContent`; jenis media ditentukan dari tanda tangan isi (audio MP3/M4A/OGG/WAV/AAC, gambar JPG/PNG/WebP/GIF), maks. 15 MB × 20, disaring `sanitasiProyek()` |
| SEC-20 | Sedang (desain) | Lobi main bareng (JEV-077): peserta lain mengirim pesan langsung ke peramban kita (obrolan, posisi, rumah); host meneruskannya | XSS lewat nama/obrolan, DoS (pesan raksasa/banjir), tamu "lihat saja" memaksa mengubah rumah, rumah jahat, penebakan ruang | ✅ Dicegah sejak awal — semua pesan disaring jenis & ukuran, teks dipotong (nama 24, obrolan 300) dan hanya lewat `textContent`, laju obrolan ±3/detik/peserta, posisi dijepit angka, rumah ≤ 3 MB lewat `sanitasiProyek()`, mode lihat ditegakkan di host, maks. 10 peserta, id ruang acak 12 karakter; aksi bersama (JEV-078) dikirim sebagai keadaan akhir — jenis daftar putih, id objek harus ada, kuota 12 aksi & 40 not/detik/peserta, not piano dijepit (21–108, ≤ 8 detik), suasana/langit hanya diterima dari host; PeerJS dikunci versi + SRI; `guard.mjs` kini juga memindai `modul/*.js` (host, CDN, sink, eval) dan lint `modul/` tanpa peringatan. Residual: peserta saling melihat alamat IP (sifat WebRTC); server sinyal publik pihak ketiga |

`npm audit` pada dependensi tooling: **0 kerentanan**. Aplikasi di peramban tidak punya dependensi npm saat runtime (PeerJS untuk lobi dimuat dari CDN terkunci SRI, hanya saat dipakai); fungsi server `api/tautan` memakai satu dependensi terkunci versi (`@vercel/blob`).

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
| BUG-09 | Tinggi (iPad) | Model unduhan situs luar (mis. mobil Sketchfab, belasan tekstur 4K) menghabiskan memori grafis iPad → iOS mematikan konteks WebGL (layar hitam sesaat), lalu lingkungan pantulan PMREM yang hilang membuat cat mobil/logam/sofa menjadi hitam | ✅ Diperbaiki (JEV-062) — tekstur model dirampingkan ke 1024 px saat masuk pustaka & saat proyek lama dibuka; konteks yang pulih membuat ulang lingkungan, probe, bayangan & model. Tes 13_ramping mereproduksi (terang 29.8 → 0.0 tanpa perbaikan) |
| BUG-10 | Sedang | Plat atap "tertutup" hanya dibuat di lantai teratas: bagian lantai bawah yang tidak tertutup lantai atas (ruang tinggi berjendela lengkung, teras) tetap tembus langit saat dilihat dari dalam (laporan pengguna, iPad) | ✅ Diperbaiki (JEV-064) — atap dibuat di setiap lantai pada bagian yang tidak tertutup lantai di atasnya; tes raycast 15_atap_galeri (sebelumnya `null`) |
| BUG-11 | Sedang | Lantai lain bermode "tembus pandang" menampilkan kaca jendela sebagai balok putih menyala saat proyek dibuka: salinan bahan hantu mewarisi blending premultiplied kaca (One/OneMinusSrcAlpha) tanpa shader-nya (laporan pengguna, iPad) | ✅ Diperbaiki (JEV-065) — bahan hantu memakai blending normal, kaca hantu lebih tipis; tes 16_tv_lantai |
| BUG-12 | Sedang | Cahaya bocor antar-lantai: lampu sorot/plafon lantai 1 menerangi kamar lantai 2 karena pelat lantai tidak ikut memberi bayangan (laporan pengguna, iPad — irisan terang di kamar lantai 2) | ✅ Diperbaiki (JEV-067) — pelat lantai `castShadow`; terang kamar lantai 2 dengan lampu lantai 1 menyala 55,9 → 6,1 (sama dengan padam); tes 18_tautan_ui |
| BUG-13 | Sedang | Penerima tautan lihat melihat langit dari dalam lantai atas: status "atap tertutup" hanya variabel tampilan, tidak tersimpan di proyek/tautan, dan mode jalan tidak beratap bila atap dibuka (laporan pengguna, iPhone). Di HP bilah jalan menumpuk di atas bilah lihat | ✅ Diperbaiki (JEV-069) — `atap.tutup` tersimpan & disaring, mode jalan selalu beratap, bilah lihat disembunyikan saat jalan, bilah lantai diletakkan dari ukuran bilah lihat sebenarnya; tes 20_hp_atap |
| BUG-14 | Sedang | Rumah bertingkat: (a) di ruang dobel tinggi dinding lantai 1 & 2 menyala berbeda — pantulan cahaya dihitung per lantai, titik di dalam void lantai 2 membaca ruang lantai 2 dan lampu gantung di void dihitung untuk ruang lantai 2; (b) atap lantai 1 dibuat di bawah pelat/balkon lantai 2 (menumpuk 12 cm di atas lantai balkon); (c) tepi atap lengkung bergerigi & tritisan melebar ±40 % di arah diagonal (laporan pengguna, iPad & iPhone) | ✅ Diperbaiki (JEV-070) — sel void ditandai di peta GI dan shader turun ke lantai bawahnya, lampu di void dihitung untuk ruang bawah; atap dikurangi pelat lantai atas; atap dari kontur + tritisan miter; tes 21_void_atap (dinding bawah 81 → 110 di garis lantai) |
| BUG-15 | Rendah | Pagar tangga putar/lengkung hanya tiang tegak tanpa pegangan (jarak antar-tiang ±28 cm) dan tidak menahan badan di mode jalan — dari anak tangga rendah orang bisa melangkah keluar lewat sela tiang (laporan pengguna, iPhone) | ✅ Diperbaiki (JEV-072) — pegangan heliks + rel tengah, dua baluster per anak tangga, pagar menahan selama kaki di atas anak tangga; tes 23_tangga_putar |
| BUG-16 | Sedang | Editor di HP: panel samping mengambang menutupi tombol *Panel* di toolbar — tidak ada cara menutupnya; toolbar terlipat 3 baris; petunjuk menimpa tombol tampak; di HP miring isi panel terjepit ±70 px (laporan pengguna, iPhone) | ✅ Diperbaiki (JEV-073) — tombol X + tirai (ketuk di luar), toolbar satu baris bergeser, petunjuk di atas tombol tampak, kepala/tab ringkas & tombol utama tidak menempel di layar pendek; tes 24_hp_ui |
| BUG-17 | Sedang | (a) Salin tautan gagal di iPhone (Clipboard API ditolak/menggantung, cadangan memakai input readonly yang tidak bisa diseleksi iOS, toast tetap bilang berhasil); (b) ketukan ganda di piano memperbesar halaman dan tidak bisa diperkecil karena kanvas/piano menahan cubitan; (c) gizmo geser memakai sumbu dunia untuk objek yang diputar; (d) langit 360° unggahan tidak tersimpan sehingga penerima tautan mendapat panorama acak (laporan pengguna) | ✅ Diperbaiki (JEV-074) — salin bertahap + pesan jujur, ketukan kedua cepat di kanvas/piano ditahan, gizmo ruang lokal, berkas langit ikut lampiran tautan; tes 25_perbaikan_cepat |
| BUG-18 | Sedang | Tanah situs (rumput/tanah/kerikil/paving) tampil sebagai lantai di dalam rumah bila pelat lantai 1 dimatikan (laporan pengguna) | ✅ Diperbaiki (JEV-075) — lantai dasar selalu dibangun di tapak rumah bila pelat tidak tampil; tanah di tapak + 0,6 m selalu ditekan ≤ −12 cm; tes 26_tanah |

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
| TD-08 | Aksesibilitas: banyak tombol ikon tanpa `aria-label`; belum ada mode gerak-tereduksi di mode jalan | Tinjauan manual | Rendah–Sedang | ✅ Sebagian (JEV-057): toolbar, tab, menu & kartu Mulai berlabel + `role`, target sentuh ≥ 44 px, cincin fokus; tes e2e memeriksa tombol ikon tanpa nama. Sisa: mode gerak-tereduksi |
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
