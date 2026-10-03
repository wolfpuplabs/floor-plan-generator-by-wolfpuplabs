# JEV — Lapisan Keputusan Berbasis ROI

**J**ustifikasi → **E**xpected value → **V**erdict. Setiap pekerjaan (fitur, perbaikan, utang teknis) diputuskan dengan cara yang sama, **sebelum** dibangun, dan diputuskan oleh angka yang bisa diperiksa, bukan oleh selera.

| Berkas | Isi |
|---|---|
| `model.json` | Asumsi ekonomi (tarif, pengguna, nilai), ambang keputusan, batas peluang per kekuatan bukti, rumus |
| `registry.json` | Semua item: masalah, bukti, biaya, pendorong manfaat, guardrail, metrik |
| `LAPORAN.md` | **Dihasilkan** oleh `tools/jev.mjs report`. Peringkat ROI, verdict, alasan, pelajaran retrospektif |
| `../../tools/jev.mjs` | Kalkulator + validator + gerbang PR |

## J — Justifikasi

Setiap item wajib menjawab: *masalah apa, untuk siapa, apa buktinya, apa alternatifnya?*

Kekuatan bukti **membatasi peluang sukses** yang boleh diklaim, sehingga optimisme tanpa data tidak bisa menggelembungkan ROI:

| Bukti | Batas peluang | Contoh |
|---|---|---|
| `tidak-ada` | 0,25 | Ide internal |
| `anekdot` | 0,45 | "Klien pernah bilang…" |
| `permintaan-pengguna` | 0,65 | Pengguna nyata meminta fiturnya |
| `uji-pengguna` | 0,80 | Wawancara/prototipe: ≥ 3 dari 5 mau memakai |
| `data-pemakaian` | 0,90 | Analitik/insiden nyata |

## E — Expected value

Manfaat per tahun (Rupiah) dari tiga pendorong yang bisa dijumlahkan:

- **Waktu:** `pengguna × jangkauan × pakai/tahun × menit dihemat/60 × nilai waktu/jam`
- **Konversi:** `pengguna × jangkauan × presentasi klien/tahun × uplift peluang menang × fee desain × margin`
- **Risiko:** `P(insiden)/tahun × dampak Rp × reduksi` (keamanan, keandalan)

`EV/tahun = peluang × manfaat` · `Biaya = (bangun + uji) jam × tarif + pemeliharaan × horizon` · `ROI = (EV × horizon − biaya) / biaya` · `Payback = biaya awal / EV bersih bulanan`

Laporan juga menampilkan **ROI pesimis** (peluang ÷ 2) dan **pengguna impas** (jumlah pengguna minimum agar item lolos ambang GO). Pengguna impas adalah angka paling jujur selama data pemakaian belum ada.

## V — Verdict

Urutan aturan (yang pertama cocok menang):

1. Ada guardrail keras (`keamanan`, `privasi`, `lisensi`, `kinerja`, `aksesibilitas`) berstatus `gagal` → **NO-GO**
2. Kelas `wajib` (keamanan/hukum/kehilangan data) → **GO** (ROI tetap dicatat)
3. ROI ≥ 1,0 ∧ payback ≤ 12 bulan ∧ peluang ≥ 0,3:
   - ada guardrail `belum` dinilai → **DEFER**
   - bukti lemah (`tidak-ada`/`anekdot`) ∧ biaya > Rp 10 jt → **DEFER** *(validasi murah dulu)*
   - selain itu → **GO**
4. ROI ≥ 0 → **DEFER**
5. Selain itu → **NO-GO**

Override hanya oleh pemilik produk, tercatat (`override: {verdict, alasan, oleh, tanggal}`) dan terlihat di laporan.

## Gerbang otomatis

CI menjalankan `node tools/jev.mjs check` di setiap PR. PR **wajib** mengajukan ≥ 1 `JEV-###`, dan setiap item yang diajukan harus ber-verdict **GO**. Jadi go/no-go terjadi sejak awal, sebelum kode masuk.

Yang dihitung sebagai **diajukan**: id di judul PR, semua id pada baris `- Item: …`, dan id yang membuka butir daftar (`- **JEV-049** …`). Id yang disebut di tengah kalimat (mis. "audio katalog tetap NO-GO (JEV-015)") hanya konteks dan tidak digerbang. Bila PR tidak memakai format daftar sama sekali, semua id yang disebut ikut digerbang.

## Kalibrasi (penting)

Angka di `model.json` adalah **asumsi awal** (500 pengguna aktif/tahun, tarif Rp 150 rb/jam, fee desain Rp 15 jt, margin 35%). Verdict relatif antar-item (peringkat) jauh lebih andal daripada nilai Rupiah absolutnya. Kalibrasi tiap kuartal dengan data nyata; semua verdict ikut berubah otomatis.

## Menambah item

```jsonc
{
  "id": "JEV-048", "judul": "…", "status": "usulan", "kelas": "fitur",
  "J": { "masalah": "…", "bukti": "anekdot", "sumberBukti": "…", "alternatif": [] },
  "E": { "peluang": 0.5,
         "biaya": { "bangunJam": 12, "ujiJam": 4, "pemeliharaanJamPerTahun": 2, "lainRp": 0 },
         "manfaat": { "konversi": { "jangkauan": 0.5, "upliftMenang": 0.01 } } },
  "guardrail": { "keamanan": {"status":"lolos"}, "privasi": {"status":"lolos"}, "lisensi": {"status":"lolos"},
                 "kinerja": {"status":"belum","catatan":"ukur di iPad"}, "aksesibilitas": {"status":"lolos"} },
  "metrik": { "nama": "…", "target": "…", "tinjau": "2027-01-03" }
}
```

Lalu: `cd tools && node jev.mjs hitung JEV-048 && node jev.mjs report`.
