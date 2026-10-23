# Plan23D — Floor Plan Generator by Wolfpup Labs

Ubah gambar denah 2D menjadi model 3D yang bisa diedit, dijelajahi, dan dipresentasikan langsung di peramban (dioptimalkan untuk iPad). Satu berkas statis (`index.html`) plus kamus bahasa Inggris (`lang/en.js`), tanpa akun. Satu-satunya bagian server bersifat opsional: fungsi Vercel `api/tautan.js` (dependensi di `package.json`) yang menyimpan tautan lihat pendek di Vercel Blob — tanpa Blob terhubung, aplikasi otomatis memakai tautan panjang. Galeri adegan di halaman awal (`api/galeri.js`, juga di Vercel Blob) aktif setelah variabel lingkungan `GALERI_KUNCI` (≥ 12 karakter, rahasia pemilik situs) dipasang; kiriman tayang setelah pemilik menyetujuinya di tab File. Antarmuka tampil dalam bahasa Inggris secara bawaan; Bahasa Indonesia bisa dipilih di kepala panel.

| Dokumen | Isi |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Masalah, persona, metrik, kebutuhan fungsional & non-fungsional, roadmap |
| [docs/SDLC.md](docs/SDLC.md) | Siklus pengembangan & gerbang G0–G3 |
| [docs/jev/](docs/jev/README.md) | Lapisan keputusan JEV (ROI go/no-go) + [laporan](docs/jev/LAPORAN.md) |
| [docs/AUDIT.md](docs/AUDIT.md) | Kerentanan, bug, utang teknis, guardrail |

```bash
cd tools && npm ci && npm run ci   # lint · guardrail · gerbang JEV · tes e2e
```

Setiap PR wajib menyebut item `JEV-###` ber-verdict GO (lihat template PR).
