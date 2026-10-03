# Arsitek 3D — Floor Plan Generator by Wolfpup Labs

Ubah gambar denah 2D menjadi model 3D yang bisa diedit, dijelajahi, dan dipresentasikan langsung di peramban (dioptimalkan untuk iPad). Satu berkas statis (`index.html`), tanpa server, tanpa akun.

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
