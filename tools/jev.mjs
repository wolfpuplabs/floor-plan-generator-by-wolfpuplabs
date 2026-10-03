// JEV — lapisan keputusan berbasis ROI: Justifikasi → Expected value → Verdict.
//   node jev.mjs report          tabel + tulis docs/jev/LAPORAN.md
//   node jev.mjs check           validasi registry; JEV_GERBANG=1 (+PR_BODY/PR_TITLE): gerbang PR
//   node jev.mjs hitung JEV-045  rincian satu item (termasuk sensitivitas)
// Verdict selalu DIHITUNG dari docs/jev/model.json, tidak pernah ditulis tangan.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url)), DOCS = path.join(DIR, '../docs/jev');
const model = JSON.parse(fs.readFileSync(path.join(DOCS, 'model.json'), 'utf8'));
const reg = JSON.parse(fs.readFileSync(path.join(DOCS, 'registry.json'), 'utf8'));
const A = model.asumsi, T = model.ambang;
const rp = v => (v < 0 ? '−' : '') + 'Rp ' + Math.round(Math.abs(v)).toLocaleString('id-ID');
const jt = v => (v < 0 ? '−' : '') + (Math.abs(v) / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' jt';

export function hitung(it, ubah = {}) {
  const a = { ...A, ...(ubah.asumsi || {}) };
  const b = it.E.biaya, m = it.E.manfaat || {};
  const batas = model.batasPeluangMenurutBukti[it.J.bukti] ?? 0.25;
  const peluang = Math.min(it.E.peluang, batas) * (ubah.faktorPeluang ?? 1);
  const w = m.waktu ? a.penggunaAktifPerTahun * m.waktu.jangkauan * m.waktu.pakaiPerTahun * m.waktu.menitHemat / 60 * a.nilaiWaktuPenggunaPerJam : 0;
  const k = m.konversi ? a.penggunaAktifPerTahun * m.konversi.jangkauan * a.presentasiKlienPerPenggunaPerTahun * m.konversi.upliftMenang * a.nilaiFeeDesainRp * a.marginFee : 0;
  const r = m.risiko ? m.risiko.pInsidenPerTahun * m.risiko.dampakRp * m.risiko.reduksi : 0;
  const manfaatTahun = w + k + r + (m.lainRpPerTahun || 0);
  const evTahun = peluang * manfaatTahun;
  const awal = (b.bangunJam + b.ujiJam) * a.tarifDevPerJam + (b.lainRp || 0);
  const pelTahun = b.pemeliharaanJamPerTahun * a.tarifDevPerJam;
  const biaya = awal + pelTahun * a.horizonTahun;
  const roi = (evTahun * a.horizonTahun - biaya) / biaya;
  const bersihBulan = (evTahun - pelTahun) / 12;
  const payback = bersihBulan > 0 ? awal / bersihBulan : Infinity;
  // pengguna minimum agar ROI mencapai ambang GO (manfaat waktu/konversi ∝ pengguna)
  const perPengguna = a.penggunaAktifPerTahun ? peluang * (w + k) / a.penggunaAktifPerTahun : 0;
  const tetap = peluang * (r + (m.lainRpPerTahun || 0));
  const butuh = (T.roiGo + 1) * biaya / a.horizonTahun;
  const penggunaImpas = perPengguna > 0 ? Math.max(0, Math.ceil((butuh - tetap) / perPengguna)) : (tetap >= butuh ? 0 : Infinity);

  const g = it.guardrail || {};
  const gagal = model.guardrailKeras.filter(x => g[x] && g[x].status === 'gagal');
  const belum = model.guardrailKeras.filter(x => !g[x] || g[x].status === 'belum');
  let verdict, alasan;
  if (gagal.length) { verdict = 'NO-GO'; alasan = 'guardrail keras gagal: ' + gagal.join(', '); }
  else if (it.kelas === 'wajib') { verdict = 'GO'; alasan = 'kelas wajib (keamanan/hukum/keandalan) — ROI tetap dihitung untuk transparansi'; }
  else if (roi >= T.roiGo && payback <= T.paybackMaksBulan && peluang >= T.pMin) {
    const taruhanButa = (T.buktiLemah || []).includes(it.J.bukti) && biaya > (T.biayaButuhBuktiKuatRp ?? Infinity);
    verdict = belum.length || taruhanButa ? 'DEFER' : 'GO';
    alasan = belum.length ? 'ROI lolos, tetapi guardrail belum dinilai: ' + belum.join(', ')
      : taruhanButa ? `ROI ${roi.toFixed(1)}× menjanjikan, tetapi biaya ${jt(biaya)} > ${jt(T.biayaButuhBuktiKuatRp)} dengan bukti "${it.J.bukti}" — validasi murah dulu (wawancara/prototipe) hingga bukti ≥ uji-pengguna`
      : `ROI ${roi.toFixed(1)}× ≥ ${T.roiGo}, payback ${payback.toFixed(1)} bln`;
  } else if (roi >= T.roiTunda) {
    verdict = 'DEFER';
    alasan = [roi < T.roiGo && `ROI ${roi.toFixed(2)} < ${T.roiGo}`, payback > T.paybackMaksBulan && `payback ${isFinite(payback) ? payback.toFixed(0) : '∞'} bln`, peluang < T.pMin && `peluang ${peluang.toFixed(2)} < ${T.pMin} (perkuat bukti)`].filter(Boolean).join('; ');
  } else { verdict = 'NO-GO'; alasan = `ROI ${roi.toFixed(2)} < ${T.roiTunda} — nilai harapan lebih kecil dari biaya`; }
  if (it.override) { alasan = `OVERRIDE oleh ${it.override.oleh} (${it.override.tanggal}): ${it.override.alasan} — verdict model: ${verdict}`; verdict = it.override.verdict; }
  return { peluang, w, k, r, manfaatTahun, evTahun, awal, pelTahun, biaya, roi, payback, penggunaImpas, verdict, alasan, belum };
}

function sensitivitas(it) {
  const pes = hitung(it, { faktorPeluang: 0.5 }), opt = hitung(it, { faktorPeluang: 1.25 });
  const u = hitung(it, { asumsi: { penggunaAktifPerTahun: A.penggunaAktifPerTahun / 2 } });
  return { pesimis: pes.roi, optimis: opt.roi, setengahPengguna: u.roi, rapuh: it.kelas !== 'wajib' && pes.roi < T.roiTunda };
}

function validasi() {
  const galat = [], ids = new Set();
  for (const it of reg.item) {
    const p = `${it.id || '?'}:`;
    if (!/^JEV-\d{3}$/.test(it.id || '')) galat.push(p + ' id harus JEV-###');
    if (ids.has(it.id)) galat.push(p + ' id ganda'); ids.add(it.id);
    if (!['usulan', 'disetujui', 'dibangun', 'terkirim', 'ditolak', 'ditunda', 'dihentikan'].includes(it.status)) galat.push(p + ' status tidak dikenal');
    if (!['fitur', 'wajib'].includes(it.kelas)) galat.push(p + ' kelas harus fitur|wajib');
    if (!it.J || !it.J.masalah || !(it.J.bukti in model.batasPeluangMenurutBukti)) galat.push(p + ' J.masalah & J.bukti wajib');
    const b = it.E && it.E.biaya;
    if (!b || !(b.bangunJam >= 0) || !(b.ujiJam >= 0) || !(b.pemeliharaanJamPerTahun >= 0)) galat.push(p + ' E.biaya tidak lengkap');
    if (!(it.E && it.E.peluang > 0 && it.E.peluang <= 1)) galat.push(p + ' E.peluang harus (0,1]');
    if (it.kelas === 'wajib' && !(it.E.manfaat && it.E.manfaat.risiko)) galat.push(p + ' kelas wajib harus menyebut risiko yang dikurangi');
    if (['terkirim'].includes(it.status) && it.metrik && !it.metrik.tinjau) galat.push(p + ' metrik tanpa tanggal tinjau');
    if (it.override && !(it.override.alasan && it.override.oleh && it.override.tanggal && it.override.verdict)) galat.push(p + ' override wajib {verdict, alasan, oleh, tanggal}');
  }
  return galat;
}

const cmd = process.argv[2] || 'report';
if (cmd === 'hitung') {
  const it = reg.item.find(x => x.id === process.argv[3]); if (!it) { console.error('id tidak ada'); process.exit(1); }
  const h = hitung(it), s = sensitivitas(it);
  console.log(JSON.stringify({ id: it.id, judul: it.judul, ...h, sensitivitas: s }, (k, v) => typeof v === 'number' ? +v.toFixed(3) : v, 1));
} else if (cmd === 'report') {
  const rows = reg.item.map(it => ({ it, h: hitung(it), s: sensitivitas(it) }));
  const urut = [...rows].sort((a, b) => b.h.roi - a.h.roi);
  let md = `# Laporan JEV — keputusan Go/No-Go berbasis ROI\n\n> Dihasilkan otomatis oleh \`tools/jev.mjs report\` dari \`docs/jev/model.json\` + \`docs/jev/registry.json\`. **Jangan diedit tangan.**\n> Semua angka manfaat memakai **asumsi awal** di model.json (pengguna aktif ${A.penggunaAktifPerTahun}/tahun, tarif dev ${rp(A.tarifDevPerJam)}/jam, horizon ${A.horizonTahun} tahun) — kalibrasi dengan data nyata, lalu jalankan ulang.\n\nAmbang: **GO** bila ROI ≥ ${T.roiGo} (manfaat ≥ ${T.roiGo + 1}× biaya), payback ≤ ${T.paybackMaksBulan} bulan, peluang ≥ ${T.pMin}, dan semua guardrail keras dinilai lolos. **DEFER** bila ROI ≥ ${T.roiTunda}. Selain itu **NO-GO**. Guardrail keras yang gagal = NO-GO apa pun ROI-nya.\n\n`;
  const ring = { GO: 0, DEFER: 0, 'NO-GO': 0 }; for (const r of rows) ring[r.h.verdict]++;
  md += `**Ringkasan:** ${ring.GO} GO · ${ring.DEFER} DEFER · ${ring['NO-GO']} NO-GO dari ${rows.length} item.\n\n`;
  md += `| ID | Item | Status | Peluang | EV/tahun | Biaya ${A.horizonTahun} th | ROI | ROI pesimis | Payback | Pengguna impas | Verdict |\n|---|---|---|---|---|---|---|---|---|---|---|\n`;
  for (const { it, h, s } of urut) md += `| ${it.id} | ${it.judul} | ${it.status} | ${h.peluang.toFixed(2)} | ${jt(h.evTahun)} | ${jt(h.biaya)} | ${h.roi.toFixed(1)}× | ${s.pesimis.toFixed(1)}×${s.rapuh ? ' ⚠' : ''} | ${isFinite(h.payback) ? h.payback.toFixed(1) + ' bln' : '∞'} | ${isFinite(h.penggunaImpas) ? h.penggunaImpas.toLocaleString('id-ID') : '∞'} | **${h.verdict}** |\n`;
  md += `\n⚠ = verdict rapuh: dengan peluang setengahnya ROI jatuh di bawah ambang tunda.\n\n## Alasan per item\n\n`;
  for (const { it, h } of urut) md += `- **${it.id} ${it.judul} — ${h.verdict}.** ${h.alasan}.${it.catatan ? ' _' + it.catatan + '_' : ''}\n`;
  const retro = rows.filter(r => r.it.status === 'terkirim' && r.h.verdict !== 'GO');
  md += `\n## Pelajaran retrospektif\n\nFitur yang **sudah dibangun** tetapi tidak lolos gerbang ROI bila dinilai sejak awal (${retro.length}):\n\n`;
  for (const { it, h } of retro) md += `- ${it.id} ${it.judul} — ${h.verdict}; biaya ${jt(h.biaya)} vs EV ${jt(h.evTahun)}/tahun.\n`;
  const biayaRetro = retro.reduce((s, r) => s + r.h.biaya, 0);
  md += `\nTotal biaya ${A.horizonTahun} tahun pada item itu: **${jt(biayaRetro)}** — kapasitas yang semestinya bisa dialihkan ke item GO di backlog.\n`;
  const lewat = rows.filter(r => r.it.metrik && r.it.metrik.tinjau && new Date(r.it.metrik.tinjau) < new Date());
  if (lewat.length) md += `\n## Tinjauan pasca-rilis yang lewat tanggal\n\n${lewat.map(r => `- ${r.it.id}: ${r.it.metrik.nama} (target ${r.it.metrik.target}, tinjau ${r.it.metrik.tinjau})`).join('\n')}\n`;
  fs.writeFileSync(path.join(DOCS, 'LAPORAN.md'), md);
  for (const { it, h } of urut) console.log(`${it.id}  ${h.verdict.padEnd(6)} ROI ${h.roi.toFixed(1).padStart(6)}×  EV ${jt(h.evTahun).padStart(9)}/th  biaya ${jt(h.biaya).padStart(8)}  ${it.judul}`);
  console.log(`\n${ring.GO} GO · ${ring.DEFER} DEFER · ${ring['NO-GO']} NO-GO → docs/jev/LAPORAN.md`);
} else if (cmd === 'check') {
  const galat = validasi();
  // gerbang PR: badan PR wajib menyebut ≥1 JEV-### dan semuanya ber-verdict GO
  const body = process.env.PR_BODY || '';
  if (process.env.JEV_GERBANG === '1' || process.argv.includes('--pr')) {
    const ids = [...new Set((body + ' ' + (process.env.PR_TITLE || '')).match(/JEV-\d{3}/g) || [])];
    if (!ids.length) galat.push('PR tidak merujuk item JEV (tulis mis. "JEV-045" di deskripsi PR). Tambahkan item ke docs/jev/registry.json bila belum ada.');
    for (const id of ids) {
      const it = reg.item.find(x => x.id === id);
      if (!it) { galat.push(`${id} tidak ada di registry`); continue; }
      const h = hitung(it);
      if (h.verdict !== 'GO') galat.push(`${id} "${it.judul}" ber-verdict ${h.verdict} (${h.alasan}). Kumpulkan bukti / perkecil lingkup, atau catat override yang disetujui.`);
      else console.log(`✓ ${id} GO — ${h.alasan}`);
    }
  }
  if (galat.length) { console.log('✗ JEV:\n  ' + galat.join('\n  ')); process.exit(1); }
  console.log(`✓ registry JEV sah (${reg.item.length} item)`);
}
