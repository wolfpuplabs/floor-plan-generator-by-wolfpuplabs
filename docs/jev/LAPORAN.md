# Laporan JEV — keputusan Go/No-Go berbasis ROI

> Dihasilkan otomatis oleh `tools/jev.mjs report` dari `docs/jev/model.json` + `docs/jev/registry.json`. **Jangan diedit tangan.**
> Semua angka manfaat memakai **asumsi awal** di model.json (pengguna aktif 500/tahun, tarif dev Rp 150.000/jam, horizon 2 tahun) — kalibrasi dengan data nyata, lalu jalankan ulang.

Ambang: **GO** bila ROI ≥ 1 (manfaat ≥ 2× biaya), payback ≤ 12 bulan, peluang ≥ 0.3, dan semua guardrail keras dinilai lolos. **DEFER** bila ROI ≥ 0. Selain itu **NO-GO**. Guardrail keras yang gagal = NO-GO apa pun ROI-nya.

**Ringkasan:** 104 GO · 3 DEFER · 5 NO-GO dari 112 item.

| ID | Item | Status | Peluang | EV/tahun | Biaya 2 th | ROI | ROI pesimis | Payback | Pengguna impas | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| JEV-095 | Pemilih berkas di iPad: input sementara di atas tombol yang diketuk | terkirim | 0.65 | 96,5 jt | 0,2 jt | 1071.5× | 535.3× | 0.0 bln | 1 | **GO** |
| JEV-107 | Menu mode jalan jadi dok ikon di sekitar tombol foto (Waktu & cuaca · Gaya & NPC · Langit · Pengaturan) + NPC dari mode jalan | terkirim | 0.65 | 190,1 jt | 0,4 jt | 1055.3× | 527.1× | 0.0 bln | 1 | **GO** |
| JEV-104 | Lihat di AR per objek / model pustaka dalam ukuran asli | terkirim | 0.65 | 130,7 jt | 0,3 jt | 828.5× | 413.8× | 0.0 bln | 2 | **GO** |
| JEV-092 | Tanah situs realistis: warna sRGB + foto Poly Haven (rumput, tanah, kerikil, paving, batu) | terkirim | 0.65 | 125,8 jt | 0,4 jt | 644.0× | 321.5× | 0.0 bln | 2 | **GO** |
| JEV-101 | Cuaca Acak (hujan turun tiba-tiba lalu reda) + sakelar ikon Siklus waktu; bilah mode jalan lebih jelas | terkirim | 0.65 | 107,3 jt | 0,4 jt | 594.8× | 296.9× | 0.0 bln | 2 | **GO** |
| JEV-102 | Karakter bawaan F & M (VRM karya wolfpuplabs) bisa dipilih sebelum Main bareng | terkirim | 0.65 | 114,6 jt | 0,4 jt | 586.5× | 292.8× | 0.0 bln | 2 | **GO** |
| JEV-094 | Kayu perabot, pintu & kusen katalog dari foto Poly Haven | terkirim | 0.65 | 107,3 jt | 0,4 jt | 549.0× | 274.0× | 0.0 bln | 2 | **GO** |
| JEV-098 | Sumber suara otomatis di objek (suara 3D berjangkauan) | terkirim | 0.65 | 85,6 jt | 0,4 jt | 474.3× | 236.7× | 0.0 bln | 3 | **GO** |
| JEV-093 | Mode jalan lancar dengan model berat: raycast BVH, resolusi adaptif, batas tekstur per model | terkirim | 0.65 | 107,3 jt | 0,5 jt | 460.3× | 229.6× | 0.0 bln | 3 | **GO** |
| JEV-100 | Waktu yang berganti halus (siang → senja → malam), siklus waktu & cuaca hujan / badai | terkirim | 0.65 | 160,9 jt | 0,8 jt | 428.0× | 213.5× | 0.0 bln | 3 | **GO** |
| JEV-087 | Kartu pratinjau tautan bagikan (judul, pesan & gambar dari tampilan 3D pilihan pengirim) lewat …/l/<id>, juga untuk undangan main bareng; ikon layar utama & manifest web app | terkirim | 0.65 | 124,9 jt | 0,6 jt | 415.3× | 207.1× | 0.0 bln | 3 | **GO** |
| JEV-105 | Adegan / area dalam satu proyek + interaksi 'Pindah ke adegan' di mode jalan | terkirim | 0.65 | 134,6 jt | 0,7 jt | 389.0× | 194.0× | 0.1 bln | 3 | **GO** |
| JEV-096 | Beberapa track sekaligus: daftar putar musik latar & media objek (acak), suara objek acak | terkirim | 0.65 | 91,7 jt | 0,5 jt | 338.4× | 168.7× | 0.1 bln | 3 | **GO** |
| JEV-112 | Avatar Main bareng: karakter F / M / 🎲 Acak dengan warna acak seperti NPC (benih terkirim ke peserta) | terkirim | 0.65 | 64,4 jt | 0,4 jt | 329.0× | 164.0× | 0.1 bln | 4 | **GO** |
| JEV-091 | Info berkas 3D sebelum diunduh, batalkan unduhan, tekstur galeri 2K tajam tapi dikompres | terkirim | 0.65 | 87,8 jt | 0,5 jt | 324.0× | 161.5× | 0.1 bln | 4 | **GO** |
| JEV-097 | Jelajahi musik & suara (Openverse, Creative Commons) untuk musik latar & objek | terkirim | 0.65 | 96,5 jt | 0,6 jt | 320.8× | 159.9× | 0.1 bln | 4 | **GO** |
| JEV-103 | Gerak avatar lebih alami: duduk di kursi / lantai, joget kecil, mengantuk, lambai, varian diam otomatis + menu Gaya di mode jalan | terkirim | 0.65 | 109,7 jt | 0,7 jt | 316.9× | 158.0× | 0.1 bln | 4 | **GO** |
| JEV-109 | Interaksi berpasangan: peluk, gandeng tangan, duduk bersandar, berbaring di ranjang, dansa berdua (pemain, NPC & Main bareng) | terkirim | 0.65 | 128,7 jt | 0,8 jt | 311.0× | 155.0× | 0.1 bln | 4 | **GO** |
| JEV-073 | Editor di HP: panel bisa ditutup (X & ketuk di luar), toolbar satu baris, petunjuk tidak menimpa, panel lega di HP miring | terkirim | 0.80 | 72 jt | 0,5 jt | 308.7× | 153.8× | 0.1 bln | 4 | **GO** |
| JEV-108 | Dialog NPC: kartu karakter, memori & relasi (port npc-dialogue-system, MIT) — tanpa server, AI opsional lewat /api/npc (Groq) | terkirim | 0.65 | 171,6 jt | 1,1 jt | 304.1× | 151.5× | 0.1 bln | 4 | **GO** |
| JEV-099 | Gitar yang bisa dimainkan (seperti piano) | terkirim | 0.65 | 83,9 jt | 0,6 jt | 271.9× | 135.5× | 0.1 bln | 4 | **GO** |
| JEV-106 | NPC karakter F / M dengan penampilan acak (kulit, rambut, pakaian) & perilaku diam → jalan-jalan / aktivitas → diam | terkirim | 0.65 | 132,6 jt | 1 jt | 271.0× | 135.0× | 0.1 bln | 4 | **GO** |
| JEV-090 | Pagar & lantai dari model unggahan lewat tracing, dan duduk di perabot pustaka | terkirim | 0.65 | 96,1 jt | 0,8 jt | 255.3× | 127.2× | 0.1 bln | 4 | **GO** |
| JEV-089 | Avatar 3D sendiri di lobi main bareng (.glb / .vrm dari VRoid Studio, Avaturn, dll.) sebagai pengganti Ready Player Me | terkirim | 0.65 | 83,9 jt | 0,7 jt | 247.4× | 123.2× | 0.1 bln | 5 | **GO** |
| JEV-069 | Tautan lihat di HP: UI tidak menumpuk, atap tertutup ikut tautan & mode jalan beratap, sebab tautan pendek gagal ditampilkan | terkirim | 0.80 | 72 jt | 0,6 jt | 239.0× | 119.0× | 0.1 bln | 5 | **GO** |
| JEV-088 | Obrolan suara di lobi main bareng & tombol foto di mode jalan (simpan ke galeri / unduh) | terkirim | 0.65 | 107,3 jt | 1 jt | 219.0× | 109.0× | 0.1 bln | 5 | **GO** |
| JEV-074 | Perbaikan cepat: salin tautan andal, atap tidak ditutup otomatis saat jalan, ketukan ganda tidak memperbesar, gizmo ikut rotasi, langit 360 unggahan & AR di tautan lihat | terkirim | 0.80 | 73,8 jt | 0,8 jt | 195.8× | 97.4× | 0.1 bln | 6 | **GO** |
| JEV-085 | Material dinding pindah ke inspector dinding: material per sisi tiap dinding, bawaan proyek di inspector, material lantai bawaan di tab Lantai | terkirim | 0.65 | 57,3 jt | 0,6 jt | 189.9× | 94.5× | 0.1 bln | 6 | **GO** |
| JEV-116 | Kustom tampilan karakter (warna per bagian & pakaian) untuk NPC & avatar Main bareng; suara NPC sintetis: gumaman, sorakan, huft | terkirim | 0.65 | 64,4 jt | 0,7 jt | 177.8× | 88.4× | 0.1 bln | 6 | **GO** |
| JEV-110 | Aktivitas & bonding: mini game mancing, panggang/masak, potong kayu, angkat-taruh barang, afeksi NPC harian, NPC ikut/menemani, suara NPC | terkirim | 0.65 | 130,7 jt | 1,5 jt | 173.2× | 86.1× | 0.1 bln | 6 | **GO** |
| JEV-064 | Atap menaungi semua lantai yang terbuka + galeri model semua kategori dengan Muat lebih banyak | terkirim | 0.80 | 83 jt | 1 jt | 169.3× | 84.1× | 0.1 bln | 6 | **GO** |
| JEV-062 | Rampingkan model unduhan (tekstur → 1024 px) + pulih dari hilangnya konteks WebGL | terkirim | 0.80 | 113,1 jt | 1,4 jt | 166.6× | 82.8× | 0.1 bln | 6 | **GO** |
| JEV-076 | Interaksi tambahan per objek: Detail (panel + buka tautan), Musik sendiri, Hadap kamera; beberapa aksi pada satu objek | terkirim | 0.65 | 109,7 jt | 1,4 jt | 161.5× | 80.3× | 0.1 bln | 7 | **GO** |
| JEV-111 | Date sim: obrolan pilihan A–D, suasana hati NPC, kencan dengan cutscene, nyatakan perasaan & status pacaran | terkirim | 0.60 | 120,6 jt | 1,5 jt | 159.8× | 79.4× | 0.1 bln | 7 | **GO** |
| JEV-071 | Merek "Plan23D" dengan logo ikon denah; bilah jalan tidak tertutup tombol X layar penuh | terkirim | 0.65 | 16,8 jt | 0,2 jt | 153.7× | 76.3× | 0.1 bln | 7 | **GO** |
| JEV-086 | Musik latar (BGM) proyek; satu pilihan "Saat diketuk" (suara klik/swoosh/sendiri atau media audio/video) agar tidak bertabrakan; media diputar di pemutar bawah yang bisa disembunyikan; musik objek tidak sunyi di iOS | terkirim | 0.65 | 44,9 jt | 0,6 jt | 148.5× | 73.8× | 0.1 bln | 7 | **GO** |
| JEV-115 | Ilustrasi adegan kencan bergerak (latar + NPC asli), peluk berbaring & bersandar di dada, bantal tidur rebah | terkirim | 0.65 | 53,6 jt | 0,7 jt | 148.0× | 73.5× | 0.1 bln | 7 | **GO** |
| JEV-078 | Main bareng: pengaturan suasana & langit host diikuti semua peserta; interaksi (lampu, pintu, TV, gorden, musik, piano) terasa oleh semua | terkirim | 0.65 | 86,9 jt | 1,2 jt | 143.9× | 71.4× | 0.1 bln | 7 | **GO** |
| JEV-070 | Ruang dobel tinggi (void) bercahaya menyatu antar-lantai; atap lantai bawah tidak menumpuk balkon, tepi atap halus & tritisan rata | terkirim | 0.80 | 57,6 jt | 0,8 jt | 138.6× | 68.8× | 0.1 bln | 8 | **GO** |
| JEV-118 | Main air (ciprat) saat berenang, kayu bakar & api unggun (tambah kayu, hangatkan diri, bakar marshmallow), NPC berpose saat difoto & pose foto sendiri, pose bersandar di dada diperbaiki | terkirim | 0.65 | 64,4 jt | 1 jt | 131.0× | 65.0× | 0.2 bln | 8 | **GO** |
| JEV-080 | Tab Taman terpisah (rumput 6 × 6 m bawaan, bisa disembunyikan), objek lingkungan (pohon, semak, batu, jalan), bentuk dasar berwarna, suara interaksi (klik / swoosh / audio sendiri), perbaikan unggah audio & gambar | terkirim | 0.65 | 89 jt | 1,4 jt | 130.8× | 64.9× | 0.1 bln | 8 | **GO** |
| JEV-058 | Tautan lihat-saja: proyek di fragmen URL, penerima bisa jalan-jalan tanpa bisa mengedit | terkirim | 0.65 | 92,1 jt | 1,5 jt | 121.8× | 60.4× | 0.2 bln | 9 | **GO** |
| JEV-079 | Lobi tanpa host: undangan tetap berlaku saat pembuat offline; pengunjung pertama jadi pusat koneksi, perannya pindah saat ia keluar; pemilik dikenali lewat tanda tangan | terkirim | 0.65 | 117,6 jt | 2 jt | 119.6× | 59.3× | 0.1 bln | 9 | **GO** |
| JEV-114 | Baju renang tampil rapi & ringan (kain warna asli, pewarnaan 1024 px, berkas 10 MB → 3,4 MB) + pose berbaring & gaya bebas tidak terbalik | terkirim | 0.65 | 21,3 jt | 0,4 jt | 117.3× | 58.1× | 0.2 bln | 9 | **GO** |
| JEV-077 | Lobi main bareng: host membuat ruang dari tautan lihat, tamu masuk dengan nama sebagai avatar, jalan-jalan & mengobrol bersama, pilihan lihat saja / bangun bareng, maks. orang per ruang | terkirim | 0.65 | 173,9 jt | 3 jt | 114.9× | 57.0× | 0.1 bln | 9 | **GO** |
| JEV-065 | Lantai hantu tanpa kaca putih + material lantai per tingkat + layar TV hidup (saluran bawaan, video, GIF) | terkirim | 0.75 | 103,8 jt | 1,8 jt | 114.3× | 56.7× | 0.1 bln | 9 | **GO** |
| JEV-113 | Berenang di kolam renang: gerak di air, menyelam, pose mengapung / gaya bebas, NPC ikut berenang, ganti baju renang | terkirim | 0.65 | 42,6 jt | 0,8 jt | 112.5× | 55.8× | 0.2 bln | 9 | **GO** |
| JEV-072 | Pagar tangga putar/lengkung: pegangan heliks, rel tengah, baluster rapat, menahan badan di mode jalan | terkirim | 0.80 | 20,7 jt | 0,4 jt | 103.2× | 51.1× | 0.2 bln | 10 | **GO** |
| JEV-068 | Model unggahan, foto tekstur & video TV ikut tautan lihat (lampiran beralamat isi) | terkirim | 0.65 | 60,5 jt | 1,2 jt | 99.8× | 49.4× | 0.2 bln | 10 | **GO** |
| JEV-066 | Garis tepi lembut untuk lampu padam saat malam (mode jalan) | terkirim | 0.80 | 30 jt | 0,6 jt | 99.0× | 49.0× | 0.2 bln | 10 | **GO** |
| JEV-081 | Pembuat kolam seperti void (persegi & L berukuran, bebas lewat tracing) dan titik yang menempel ke ujung dinding, railing, pagar & sudut kolam | terkirim | 0.65 | 35,6 jt | 0,8 jt | 93.9× | 46.5× | 0.2 bln | 11 | **GO** |
| JEV-075 | Tanah situs selalu di bawah lantai + terrain builder (kuas naik/turun/ratakan/haluskan) yang bisa dijalani | terkirim | 0.65 | 55,6 jt | 1,2 jt | 91.6× | 45.3× | 0.2 bln | 11 | **GO** |
| JEV-083 | AR dari tautan yang dibagikan: Scene Viewer Android dengan model di server, arahan Safari untuk browser di dalam aplikasi iOS | terkirim | 0.65 | 34,4 jt | 0,8 jt | 90.7× | 44.8× | 0.2 bln | 11 | **GO** |
| JEV-067 | Tautan lihat yang terbuka di HP (tautan pendek), kebocoran cahaya antar-lantai, menu jalan bisa diciutkan + kualitas, ikon SVG | terkirim | 0.80 | 78 jt | 1,8 jt | 85.7× | 42.3× | 0.2 bln | 12 | **GO** |
| JEV-052 | Lampu menerangi ruangannya dari kejauhan & dari luar (GI per ruang untuk semua lampu, semua lantai) | terkirim | 0.65 | 61,4 jt | 1,7 jt | 73.5× | 36.2× | 0.3 bln | 14 | **GO** |
| JEV-084 | Jalan di tanah bawaan tanpa dinding, kuas cat tanah & batu yang membaur, animasi model unggahan dan pemutar media video/audio | terkirim | 0.65 | 62,3 jt | 1,8 jt | 68.2× | 33.6× | 0.2 bln | 15 | **GO** |
| JEV-061 | Bahasa Inggris sebagai bahasa bawaan, Bahasa Indonesia tetap bisa dipilih | terkirim | 0.65 | 71,2 jt | 2,1 jt | 66.8× | 32.9× | 0.2 bln | 15 | **GO** |
| JEV-056 | Furnitur bawaan realistis: kasur, sofa, sanitair, dapur (prosedural) + pintasan ruangan di galeri model | terkirim | 0.65 | 65,5 jt | 2 jt | 66.2× | 32.6× | 0.3 bln | 15 | **GO** |
| JEV-063 | Model hasil scan 3D: tag fotogrametri Sketchfab + sumber Google Scanned Objects | terkirim | 0.60 | 49,8 jt | 1,5 jt | 65.4× | 32.2× | 0.2 bln | 16 | **GO** |
| JEV-055 | Kaca realistis: Fresnel, serapan Beer–Lambert, pantulan aditif — jendela, pintu kaca, shower, dan kaca model | terkirim | 0.60 | 28,4 jt | 0,9 jt | 62.0× | 30.5× | 0.3 bln | 16 | **GO** |
| JEV-057 | Redesign UI/UX: kartu Mulai + rumah contoh, tab berikon (Tampilan terpisah), toolbar berlabel + menu Lainnya, pencarian furnitur, target sentuh ≥ 44 px | terkirim | 0.60 | 44,6 jt | 1,5 jt | 58.4× | 28.7× | 0.3 bln | 17 | **GO** |
| JEV-059 | Tekstur foto untuk objek (foto sendiri / pustaka Poly Haven) + pola tekstur tidak berulang | terkirim | 0.60 | 47,3 jt | 1,7 jt | 56.3× | 27.6× | 0.3 bln | 18 | **GO** |
| JEV-082 | Bentuk dasar padat (collider & bisa dipijak), prisma bebas & potongan bentuk lewat tracing, lantai bebas lewat tracing, tanah selalu di bawah lantai | terkirim | 0.65 | 38 jt | 1,4 jt | 55.3× | 27.2× | 0.3 bln | 18 | **GO** |
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
| JEV-121 | Memori grafis iPad: piksel render dibatasi, panorama 2K, kualitas turun otomatis setelah konteks WebGL hilang | terkirim | 0.65 | 2,3 jt | 0,3 jt | 15.4× | 7.2× | 1.2 bln | 0 | **GO** |
| JEV-010 | Atap dak beton | terkirim | 0.60 | 23,6 jt | 3 jt | 14.8× | 6.9× | 1.2 bln | 64 | **GO** |
| JEV-117 | NPC rusak (badan meledak jadi segitiga) lalu hilang di iPad: jalur tulang cadangan yang salah terpasang dibuang | terkirim | 0.65 | 2,6 jt | 0,4 jt | 13.6× | 6.3× | 1.4 bln | 0 | **GO** |
| JEV-119 | Memori grafis iPad habis saat mengganti warna NPC; NPC jadi warna polos setelah tampilan dipulihkan | terkirim | 0.65 | 2,5 jt | 0,4 jt | 12.8× | 5.9× | 1.5 bln | 0 | **GO** |
| JEV-120 | NPC hilang di iPad karena batas memori kanvas iOS: tekstur pewarnaan jadi tekstur data, tekstur karakter jadi ImageBitmap | terkirim | 0.65 | 2,5 jt | 0,4 jt | 12.8× | 5.9× | 1.5 bln | 0 | **GO** |
| JEV-009 | Ekspor GLB/OBJ/USDZ + AR maket | terkirim | 0.55 | 64,4 jt | 9,9 jt | 12.0× | 5.5× | 1.4 bln | 77 | **GO** |
| JEV-002 | Editor dinding, bukaan, multi-lantai, undo | terkirim | 0.65 | 131,6 jt | 21 jt | 11.5× | 5.3× | 1.4 bln | 80 | **GO** |
| JEV-125 | iPad: tekstur model unggahan diperkecil saat dimuat ke GPU; NPC berbaring di model unggahan | terkirim | 0.65 | 1,6 jt | 0,3 jt | 8.9× | 4.0× | 2.0 bln | 0 | **GO** |
| JEV-020 | Pantulan probe untuk kaca, logam, air | terkirim | 0.50 | 19,7 jt | 4,2 jt | 8.4× | 3.7× | 2.1 bln | 107 | **GO** |
| JEV-012 | Builder situs & taman | terkirim | 0.50 | 31,5 jt | 7,2 jt | 7.7× | 3.4× | 2.2 bln | 115 | **GO** |
| JEV-011 | Tampak ortogonal atas/depan/iso | terkirim | 0.65 | 11,4 jt | 2,7 jt | 7.4× | 3.2× | 2.3 bln | 119 | **GO** |
| JEV-016 | Pustaka model .glb sendiri + collider otomatis | terkirim | 0.60 | 23,2 jt | 6,2 jt | 6.5× | 2.8× | 2.6 bln | 133 | **GO** |
| JEV-127 | Berbaring bersama NPC: masing-masing satu sisi kasur, tidak menumpuk | terkirim | 0.65 | 0,7 jt | 0,2 jt | 6.4× | 2.7× | 2.8 bln | 0 | **GO** |
| JEV-006 | Rapikan denah otomatis (pra-proses) | terkirim | 0.60 | 15 jt | 4,2 jt | 6.1× | 2.6× | 2.7 bln | 140 | **GO** |
| JEV-124 | Efek real-time hanya di kualitas Tinggi; baju renang tetap saat main air (orang ketiga & lobi) | terkirim | 0.65 | 1,2 jt | 0,3 jt | 6.1× | 2.5× | 2.8 bln | 0 | **GO** |
| JEV-003 | Tangga 6 varian + void pelat | terkirim | 0.60 | 18 jt | 7,5 jt | 3.8× | 1.4× | 4.2 bln | 209 | **GO** |
| JEV-014 | Interaksi mode jalan (pintu, lampu, gorden, TV) | terkirim | 0.45 | 14,2 jt | 6,2 jt | 3.6× | 1.3× | 4.4 bln | 217 | **GO** |
| JEV-129 | Eksposur otomatis ringan untuk kualitas Halus & Cepat — siang tidak lagi gelap | terkirim | 0.65 | 0,7 jt | 0,3 jt | 3.5× | 1.3× | 4.5 bln | 0 | **GO** |
| JEV-041 | Tes e2e + CI + lint ratchet di repo | terkirim | 0.85 | 6,1 jt | 2,9 jt | 3.3× | 1.1× | 3.6 bln | 0 | **GO** |
| JEV-040 | Guardrail keamanan G1–G6 (CSP, SRI, sanitasi proyek, esc, URI luar, galat global) | terkirim | 0.90 | 5,7 jt | 2,9 jt | 3.0× | 1.0× | 5.0 bln | 0 | **GO** |
| JEV-128 | Saat berinteraksi, menggeser layar hanya memutar kamera — badan & NPC tetap | terkirim | 0.65 | 0,3 jt | 0,2 jt | 2.5× | 0.7× | 6.1 bln | 0 | **GO** |
| JEV-051 | Model unggahan kategori Audio: putar musik / piano | terkirim | 0.50 | 1,3 jt | 0,8 jt | 2.4× | 0.7× | 4.9 bln | 298 | **GO** |
| JEV-047 | Kolaborasi & berbagi tautan proyek (cloud) | usulan | 0.45 | 70,9 jt | 48 jt | 2.0× | 0.5× | 6.7 bln | 339 | **DEFER** |
| JEV-122 | Kamera orang ketiga di mode jalan, siklus waktu menyala bawaan, api unggun berbentuk kerucut | terkirim | 0.65 | 0,5 jt | 0,4 jt | 1.8× | 0.4× | 7.2 bln | 0 | **GO** |
| JEV-126 | Gandengan tangan diperbaiki; HUD mode jalan tidak menghalangi; emoji UI diganti ikon Lucide | terkirim | 0.65 | 1 jt | 0,8 jt | 1.5× | 0.3× | 8.2 bln | 0 | **GO** |
| JEV-019 | SFX langkah kaki & interaksi | terkirim | 0.35 | 3,3 jt | 2,7 jt | 1.4× | 0.2× | 8.4 bln | 409 | **GO** |
| JEV-013 | Tracing void & area bentuk bebas | terkirim | 0.60 | 4,5 jt | 3,8 jt | 1.4× | 0.2× | 8.4 bln | 417 | **GO** |
| JEV-123 | Model unggahan: berbaring, perapian & api unggun; kartu NPC Dimas dihapus; NPC jarang berjoget | terkirim | 0.65 | 0,5 jt | 0,5 jt | 1.2× | 0.1× | 9.7 bln | 0 | **GO** |
| JEV-005 | Deteksi perabot dari simbol denah | terkirim | 0.45 | 20,3 jt | 19,5 jt | 1.1× | 0.0× | 10.0 bln | 482 | **GO** |
| JEV-042 | Modularisasi index.html (12k baris → modul + build) | usulan | 0.45 | 4,1 jt | 7,8 jt | 0.0× | -0.5× ⚠ | 23.1 bln | ∞ | **DEFER** |
| JEV-043 | Impor Gaussian splat (.splat/.ply) | usulan | 0.30 | 4,7 jt | 10,7 jt | -0.1× | -0.6× ⚠ | 28.1 bln | 1.127 | **NO-GO** |
| JEV-017 | Animasi api perapian | terkirim | 0.30 | 0,5 jt | 2 jt | -0.5× | -0.8× ⚠ | 61.4 bln | 2.064 | **NO-GO** |
| JEV-046 | Kompresi aset (meshopt + KTX2) untuk ukuran proyek | usulan | 0.45 | 0,9 jt | 4,8 jt | -0.6× | -0.8× ⚠ | 94.5 bln | ∞ | **NO-GO** |
| JEV-015 | Audio: CD, kaset, piringan hitam | terkirim | 0.30 | 0,5 jt | 4,8 jt | -0.8× | -0.9× ⚠ | 2080.0 bln | 5.080 | **NO-GO** |
| JEV-018 | Piano yang bisa dimainkan | terkirim | 0.25 | 0,1 jt | 3,9 jt | -1.0× | -1.0× ⚠ | ∞ | 24.762 | **NO-GO** |

⚠ = verdict rapuh: dengan peluang setengahnya ROI jatuh di bawah ambang tunda.

## Alasan per item

- **JEV-095 Pemilih berkas di iPad: input sementara di atas tombol yang diketuk — GO.** ROI 1071.5× ≥ 1, payback 0.0 bln.
- **JEV-107 Menu mode jalan jadi dok ikon di sekitar tombol foto (Waktu & cuaca · Gaya & NPC · Langit · Pengaturan) + NPC dari mode jalan — GO.** ROI 1055.3× ≥ 1, payback 0.0 bln.
- **JEV-104 Lihat di AR per objek / model pustaka dalam ukuran asli — GO.** ROI 828.5× ≥ 1, payback 0.0 bln.
- **JEV-092 Tanah situs realistis: warna sRGB + foto Poly Haven (rumput, tanah, kerikil, paving, batu) — GO.** ROI 644.0× ≥ 1, payback 0.0 bln.
- **JEV-101 Cuaca Acak (hujan turun tiba-tiba lalu reda) + sakelar ikon Siklus waktu; bilah mode jalan lebih jelas — GO.** ROI 594.8× ≥ 1, payback 0.0 bln.
- **JEV-102 Karakter bawaan F & M (VRM karya wolfpuplabs) bisa dipilih sebelum Main bareng — GO.** ROI 586.5× ≥ 1, payback 0.0 bln.
- **JEV-094 Kayu perabot, pintu & kusen katalog dari foto Poly Haven — GO.** ROI 549.0× ≥ 1, payback 0.0 bln.
- **JEV-098 Sumber suara otomatis di objek (suara 3D berjangkauan) — GO.** ROI 474.3× ≥ 1, payback 0.0 bln.
- **JEV-093 Mode jalan lancar dengan model berat: raycast BVH, resolusi adaptif, batas tekstur per model — GO.** ROI 460.3× ≥ 1, payback 0.0 bln.
- **JEV-100 Waktu yang berganti halus (siang → senja → malam), siklus waktu & cuaca hujan / badai — GO.** ROI 428.0× ≥ 1, payback 0.0 bln.
- **JEV-087 Kartu pratinjau tautan bagikan (judul, pesan & gambar dari tampilan 3D pilihan pengirim) lewat …/l/<id>, juga untuk undangan main bareng; ikon layar utama & manifest web app — GO.** ROI 415.3× ≥ 1, payback 0.0 bln.
- **JEV-105 Adegan / area dalam satu proyek + interaksi 'Pindah ke adegan' di mode jalan — GO.** ROI 389.0× ≥ 1, payback 0.1 bln.
- **JEV-096 Beberapa track sekaligus: daftar putar musik latar & media objek (acak), suara objek acak — GO.** ROI 338.4× ≥ 1, payback 0.1 bln.
- **JEV-112 Avatar Main bareng: karakter F / M / 🎲 Acak dengan warna acak seperti NPC (benih terkirim ke peserta) — GO.** ROI 329.0× ≥ 1, payback 0.1 bln.
- **JEV-091 Info berkas 3D sebelum diunduh, batalkan unduhan, tekstur galeri 2K tajam tapi dikompres — GO.** ROI 324.0× ≥ 1, payback 0.1 bln.
- **JEV-097 Jelajahi musik & suara (Openverse, Creative Commons) untuk musik latar & objek — GO.** ROI 320.8× ≥ 1, payback 0.1 bln.
- **JEV-103 Gerak avatar lebih alami: duduk di kursi / lantai, joget kecil, mengantuk, lambai, varian diam otomatis + menu Gaya di mode jalan — GO.** ROI 316.9× ≥ 1, payback 0.1 bln.
- **JEV-109 Interaksi berpasangan: peluk, gandeng tangan, duduk bersandar, berbaring di ranjang, dansa berdua (pemain, NPC & Main bareng) — GO.** ROI 311.0× ≥ 1, payback 0.1 bln.
- **JEV-073 Editor di HP: panel bisa ditutup (X & ketuk di luar), toolbar satu baris, petunjuk tidak menimpa, panel lega di HP miring — GO.** ROI 308.7× ≥ 1, payback 0.1 bln.
- **JEV-108 Dialog NPC: kartu karakter, memori & relasi (port npc-dialogue-system, MIT) — tanpa server, AI opsional lewat /api/npc (Groq) — GO.** ROI 304.1× ≥ 1, payback 0.1 bln.
- **JEV-099 Gitar yang bisa dimainkan (seperti piano) — GO.** ROI 271.9× ≥ 1, payback 0.1 bln.
- **JEV-106 NPC karakter F / M dengan penampilan acak (kulit, rambut, pakaian) & perilaku diam → jalan-jalan / aktivitas → diam — GO.** ROI 271.0× ≥ 1, payback 0.1 bln.
- **JEV-090 Pagar & lantai dari model unggahan lewat tracing, dan duduk di perabot pustaka — GO.** ROI 255.3× ≥ 1, payback 0.1 bln.
- **JEV-089 Avatar 3D sendiri di lobi main bareng (.glb / .vrm dari VRoid Studio, Avaturn, dll.) sebagai pengganti Ready Player Me — GO.** ROI 247.4× ≥ 1, payback 0.1 bln.
- **JEV-069 Tautan lihat di HP: UI tidak menumpuk, atap tertutup ikut tautan & mode jalan beratap, sebab tautan pendek gagal ditampilkan — GO.** ROI 239.0× ≥ 1, payback 0.1 bln.
- **JEV-088 Obrolan suara di lobi main bareng & tombol foto di mode jalan (simpan ke galeri / unduh) — GO.** ROI 219.0× ≥ 1, payback 0.1 bln.
- **JEV-074 Perbaikan cepat: salin tautan andal, atap tidak ditutup otomatis saat jalan, ketukan ganda tidak memperbesar, gizmo ikut rotasi, langit 360 unggahan & AR di tautan lihat — GO.** ROI 195.8× ≥ 1, payback 0.1 bln.
- **JEV-085 Material dinding pindah ke inspector dinding: material per sisi tiap dinding, bawaan proyek di inspector, material lantai bawaan di tab Lantai — GO.** ROI 189.9× ≥ 1, payback 0.1 bln.
- **JEV-116 Kustom tampilan karakter (warna per bagian & pakaian) untuk NPC & avatar Main bareng; suara NPC sintetis: gumaman, sorakan, huft — GO.** ROI 177.8× ≥ 1, payback 0.1 bln.
- **JEV-110 Aktivitas & bonding: mini game mancing, panggang/masak, potong kayu, angkat-taruh barang, afeksi NPC harian, NPC ikut/menemani, suara NPC — GO.** ROI 173.2× ≥ 1, payback 0.1 bln.
- **JEV-064 Atap menaungi semua lantai yang terbuka + galeri model semua kategori dengan Muat lebih banyak — GO.** ROI 169.3× ≥ 1, payback 0.1 bln.
- **JEV-062 Rampingkan model unduhan (tekstur → 1024 px) + pulih dari hilangnya konteks WebGL — GO.** ROI 166.6× ≥ 1, payback 0.1 bln.
- **JEV-076 Interaksi tambahan per objek: Detail (panel + buka tautan), Musik sendiri, Hadap kamera; beberapa aksi pada satu objek — GO.** ROI 161.5× ≥ 1, payback 0.1 bln.
- **JEV-111 Date sim: obrolan pilihan A–D, suasana hati NPC, kencan dengan cutscene, nyatakan perasaan & status pacaran — GO.** ROI 159.8× ≥ 1, payback 0.1 bln.
- **JEV-071 Merek "Plan23D" dengan logo ikon denah; bilah jalan tidak tertutup tombol X layar penuh — GO.** ROI 153.7× ≥ 1, payback 0.1 bln.
- **JEV-086 Musik latar (BGM) proyek; satu pilihan "Saat diketuk" (suara klik/swoosh/sendiri atau media audio/video) agar tidak bertabrakan; media diputar di pemutar bawah yang bisa disembunyikan; musik objek tidak sunyi di iOS — GO.** ROI 148.5× ≥ 1, payback 0.1 bln.
- **JEV-115 Ilustrasi adegan kencan bergerak (latar + NPC asli), peluk berbaring & bersandar di dada, bantal tidur rebah — GO.** ROI 148.0× ≥ 1, payback 0.1 bln.
- **JEV-078 Main bareng: pengaturan suasana & langit host diikuti semua peserta; interaksi (lampu, pintu, TV, gorden, musik, piano) terasa oleh semua — GO.** ROI 143.9× ≥ 1, payback 0.1 bln.
- **JEV-070 Ruang dobel tinggi (void) bercahaya menyatu antar-lantai; atap lantai bawah tidak menumpuk balkon, tepi atap halus & tritisan rata — GO.** ROI 138.6× ≥ 1, payback 0.1 bln.
- **JEV-118 Main air (ciprat) saat berenang, kayu bakar & api unggun (tambah kayu, hangatkan diri, bakar marshmallow), NPC berpose saat difoto & pose foto sendiri, pose bersandar di dada diperbaiki — GO.** ROI 131.0× ≥ 1, payback 0.2 bln.
- **JEV-080 Tab Taman terpisah (rumput 6 × 6 m bawaan, bisa disembunyikan), objek lingkungan (pohon, semak, batu, jalan), bentuk dasar berwarna, suara interaksi (klik / swoosh / audio sendiri), perbaikan unggah audio & gambar — GO.** ROI 130.8× ≥ 1, payback 0.1 bln.
- **JEV-058 Tautan lihat-saja: proyek di fragmen URL, penerima bisa jalan-jalan tanpa bisa mengedit — GO.** ROI 121.8× ≥ 1, payback 0.2 bln.
- **JEV-079 Lobi tanpa host: undangan tetap berlaku saat pembuat offline; pengunjung pertama jadi pusat koneksi, perannya pindah saat ia keluar; pemilik dikenali lewat tanda tangan — GO.** ROI 119.6× ≥ 1, payback 0.1 bln.
- **JEV-114 Baju renang tampil rapi & ringan (kain warna asli, pewarnaan 1024 px, berkas 10 MB → 3,4 MB) + pose berbaring & gaya bebas tidak terbalik — GO.** ROI 117.3× ≥ 1, payback 0.2 bln.
- **JEV-077 Lobi main bareng: host membuat ruang dari tautan lihat, tamu masuk dengan nama sebagai avatar, jalan-jalan & mengobrol bersama, pilihan lihat saja / bangun bareng, maks. orang per ruang — GO.** ROI 114.9× ≥ 1, payback 0.1 bln.
- **JEV-065 Lantai hantu tanpa kaca putih + material lantai per tingkat + layar TV hidup (saluran bawaan, video, GIF) — GO.** ROI 114.3× ≥ 1, payback 0.1 bln.
- **JEV-113 Berenang di kolam renang: gerak di air, menyelam, pose mengapung / gaya bebas, NPC ikut berenang, ganti baju renang — GO.** ROI 112.5× ≥ 1, payback 0.2 bln.
- **JEV-072 Pagar tangga putar/lengkung: pegangan heliks, rel tengah, baluster rapat, menahan badan di mode jalan — GO.** ROI 103.2× ≥ 1, payback 0.2 bln.
- **JEV-068 Model unggahan, foto tekstur & video TV ikut tautan lihat (lampiran beralamat isi) — GO.** ROI 99.8× ≥ 1, payback 0.2 bln.
- **JEV-066 Garis tepi lembut untuk lampu padam saat malam (mode jalan) — GO.** ROI 99.0× ≥ 1, payback 0.2 bln.
- **JEV-081 Pembuat kolam seperti void (persegi & L berukuran, bebas lewat tracing) dan titik yang menempel ke ujung dinding, railing, pagar & sudut kolam — GO.** ROI 93.9× ≥ 1, payback 0.2 bln.
- **JEV-075 Tanah situs selalu di bawah lantai + terrain builder (kuas naik/turun/ratakan/haluskan) yang bisa dijalani — GO.** ROI 91.6× ≥ 1, payback 0.2 bln.
- **JEV-083 AR dari tautan yang dibagikan: Scene Viewer Android dengan model di server, arahan Safari untuk browser di dalam aplikasi iOS — GO.** ROI 90.7× ≥ 1, payback 0.2 bln.
- **JEV-067 Tautan lihat yang terbuka di HP (tautan pendek), kebocoran cahaya antar-lantai, menu jalan bisa diciutkan + kualitas, ikon SVG — GO.** ROI 85.7× ≥ 1, payback 0.2 bln.
- **JEV-052 Lampu menerangi ruangannya dari kejauhan & dari luar (GI per ruang untuk semua lampu, semua lantai) — GO.** ROI 73.5× ≥ 1, payback 0.3 bln.
- **JEV-084 Jalan di tanah bawaan tanpa dinding, kuas cat tanah & batu yang membaur, animasi model unggahan dan pemutar media video/audio — GO.** ROI 68.2× ≥ 1, payback 0.2 bln.
- **JEV-061 Bahasa Inggris sebagai bahasa bawaan, Bahasa Indonesia tetap bisa dipilih — GO.** ROI 66.8× ≥ 1, payback 0.2 bln.
- **JEV-056 Furnitur bawaan realistis: kasur, sofa, sanitair, dapur (prosedural) + pintasan ruangan di galeri model — GO.** ROI 66.2× ≥ 1, payback 0.3 bln.
- **JEV-063 Model hasil scan 3D: tag fotogrametri Sketchfab + sumber Google Scanned Objects — GO.** ROI 65.4× ≥ 1, payback 0.2 bln.
- **JEV-055 Kaca realistis: Fresnel, serapan Beer–Lambert, pantulan aditif — jendela, pintu kaca, shower, dan kaca model — GO.** ROI 62.0× ≥ 1, payback 0.3 bln.
- **JEV-057 Redesign UI/UX: kartu Mulai + rumah contoh, tab berikon (Tampilan terpisah), toolbar berlabel + menu Lainnya, pencarian furnitur, target sentuh ≥ 44 px — GO.** ROI 58.4× ≥ 1, payback 0.3 bln.
- **JEV-059 Tekstur foto untuk objek (foto sendiri / pustaka Poly Haven) + pola tekstur tidak berulang — GO.** ROI 56.3× ≥ 1, payback 0.3 bln.
- **JEV-082 Bentuk dasar padat (collider & bisa dipijak), prisma bebas & potongan bentuk lewat tracing, lantai bebas lewat tracing, tanah selalu di bawah lantai — GO.** ROI 55.3× ≥ 1, payback 0.3 bln.
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
- **JEV-121 Memori grafis iPad: piksel render dibatasi, panorama 2K, kualitas turun otomatis setelah konteks WebGL hilang — GO.** kelas wajib (keamanan/hukum/keandalan) — ROI tetap dihitung untuk transparansi.
- **JEV-010 Atap dak beton — GO.** ROI 14.8× ≥ 1, payback 1.2 bln.
- **JEV-117 NPC rusak (badan meledak jadi segitiga) lalu hilang di iPad: jalur tulang cadangan yang salah terpasang dibuang — GO.** kelas wajib (keamanan/hukum/keandalan) — ROI tetap dihitung untuk transparansi.
- **JEV-119 Memori grafis iPad habis saat mengganti warna NPC; NPC jadi warna polos setelah tampilan dipulihkan — GO.** kelas wajib (keamanan/hukum/keandalan) — ROI tetap dihitung untuk transparansi.
- **JEV-120 NPC hilang di iPad karena batas memori kanvas iOS: tekstur pewarnaan jadi tekstur data, tekstur karakter jadi ImageBitmap — GO.** kelas wajib (keamanan/hukum/keandalan) — ROI tetap dihitung untuk transparansi.
- **JEV-009 Ekspor GLB/OBJ/USDZ + AR maket — GO.** ROI 12.0× ≥ 1, payback 1.4 bln.
- **JEV-002 Editor dinding, bukaan, multi-lantai, undo — GO.** ROI 11.5× ≥ 1, payback 1.4 bln.
- **JEV-125 iPad: tekstur model unggahan diperkecil saat dimuat ke GPU; NPC berbaring di model unggahan — GO.** kelas wajib (keamanan/hukum/keandalan) — ROI tetap dihitung untuk transparansi.
- **JEV-020 Pantulan probe untuk kaca, logam, air — GO.** ROI 8.4× ≥ 1, payback 2.1 bln.
- **JEV-012 Builder situs & taman — GO.** ROI 7.7× ≥ 1, payback 2.2 bln.
- **JEV-011 Tampak ortogonal atas/depan/iso — GO.** ROI 7.4× ≥ 1, payback 2.3 bln.
- **JEV-016 Pustaka model .glb sendiri + collider otomatis — GO.** ROI 6.5× ≥ 1, payback 2.6 bln.
- **JEV-127 Berbaring bersama NPC: masing-masing satu sisi kasur, tidak menumpuk — GO.** kelas wajib (keamanan/hukum/keandalan) — ROI tetap dihitung untuk transparansi.
- **JEV-006 Rapikan denah otomatis (pra-proses) — GO.** ROI 6.1× ≥ 1, payback 2.7 bln.
- **JEV-124 Efek real-time hanya di kualitas Tinggi; baju renang tetap saat main air (orang ketiga & lobi) — GO.** kelas wajib (keamanan/hukum/keandalan) — ROI tetap dihitung untuk transparansi.
- **JEV-003 Tangga 6 varian + void pelat — GO.** ROI 3.8× ≥ 1, payback 4.2 bln.
- **JEV-014 Interaksi mode jalan (pintu, lampu, gorden, TV) — GO.** ROI 3.6× ≥ 1, payback 4.4 bln.
- **JEV-129 Eksposur otomatis ringan untuk kualitas Halus & Cepat — siang tidak lagi gelap — GO.** ROI 3.5× ≥ 1, payback 4.5 bln.
- **JEV-041 Tes e2e + CI + lint ratchet di repo — GO.** kelas wajib (keamanan/hukum/keandalan) — ROI tetap dihitung untuk transparansi.
- **JEV-040 Guardrail keamanan G1–G6 (CSP, SRI, sanitasi proyek, esc, URI luar, galat global) — GO.** kelas wajib (keamanan/hukum/keandalan) — ROI tetap dihitung untuk transparansi.
- **JEV-128 Saat berinteraksi, menggeser layar hanya memutar kamera — badan & NPC tetap — GO.** ROI 2.5× ≥ 1, payback 6.1 bln.
- **JEV-051 Model unggahan kategori Audio: putar musik / piano — GO.** ROI 2.4× ≥ 1, payback 4.9 bln. _Kategori audio/piano sendiri ber-verdict NO-GO (JEV-015/018). Item ini hanya MEMAKAI ULANG mesin yang sudah ada — biayanya kecil._
- **JEV-047 Kolaborasi & berbagi tautan proyek (cloud) — DEFER.** ROI lolos, tetapi guardrail belum dinilai: keamanan, privasi.
- **JEV-122 Kamera orang ketiga di mode jalan, siklus waktu menyala bawaan, api unggun berbentuk kerucut — GO.** ROI 1.8× ≥ 1, payback 7.2 bln.
- **JEV-126 Gandengan tangan diperbaiki; HUD mode jalan tidak menghalangi; emoji UI diganti ikon Lucide — GO.** ROI 1.5× ≥ 1, payback 8.2 bln.
- **JEV-019 SFX langkah kaki & interaksi — GO.** ROI 1.4× ≥ 1, payback 8.4 bln.
- **JEV-013 Tracing void & area bentuk bebas — GO.** ROI 1.4× ≥ 1, payback 8.4 bln.
- **JEV-123 Model unggahan: berbaring, perapian & api unggun; kartu NPC Dimas dihapus; NPC jarang berjoget — GO.** ROI 1.2× ≥ 1, payback 9.7 bln.
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
