/* Plan23D — REFERENSI SIMBOL DENAH: apa yang dibaca dan jadi apa di 3D
   Dipindah dari index.html (JEV-096, anggaran ukuran): gambar simbol hanya dibangun saat panel
   "Apa saja yang dibaca?" dibuka. Teksnya ikut diterjemahkan oleh pengamat bahasa di index.html. */
/* global $, el */
(function () {
  'use strict';
  const SYMREF=[
    ['Dinding & struktur',[
      ['Dinding masif','tebal dibaca dari gambar','<rect x="6" y="18" width="52" height="10" fill="#7f7f7f"/>'],
      ['Dinding garis ganda','rongga diisi jadi dinding','<path d="M6 18H58M6 28H58" stroke="#222" stroke-width="1.6"/>'],
      ['Sekat tipis','dinding sekat ±10 cm','<path d="M6 23H58" stroke="#7f7f7f" stroke-width="4"/><path d="M32 23V44" stroke="#7f7f7f" stroke-width="4"/>'],
      ['Dinding lengkung','jadi rangkaian tali busur','<path d="M10 10A22 22 0 0 0 54 10" fill="none" stroke="#7f7f7f" stroke-width="7"/>'],
      ['Dinding kaca','kaca penuh + mullion tegak','<path d="M4 21H60M4 25H60" stroke="#444" stroke-width="1"/><g fill="#fff" stroke="#444">'+[6,19,32,45,58].map(x=>`<rect x="${x-3}" y="20" width="6" height="6"/>`).join('')+'</g>'],
      ['Kaca antar kolom','garis kaca tipis di antara dua kolom / ujung dinding','<rect x="4" y="17" width="10" height="10" fill="#1a1a1a"/><rect x="50" y="17" width="10" height="10" fill="#1a1a1a"/><path d="M14 20H50M14 24H50" stroke="#888" stroke-width="1"/>'],
      ['Kolom persegi','kolom setinggi lantai','<rect x="24" y="14" width="16" height="16" fill="#7f7f7f"/>'],
      ['Kolom bulat','kolom bulat setinggi lantai','<circle cx="32" cy="22" r="9" fill="#7f7f7f"/>'],
      ['Pilaster','ikut menjadi dinding','<rect x="6" y="14" width="52" height="8" fill="#7f7f7f"/><rect x="26" y="22" width="12" height="7" fill="#7f7f7f"/>']
    ]],
    ['Bukaan',[
      ['Pintu ayun','engsel & arah ayun dari busur','<rect x="4" y="30" width="16" height="7" fill="#222"/><rect x="44" y="30" width="16" height="7" fill="#222"/><path d="M20 30V6A24 24 0 0 1 44 30" fill="none" stroke="#333" stroke-width="1.3"/>'],
      ['Jendela','garis kaca di celah dinding','<rect x="4" y="18" width="16" height="9" fill="#222"/><rect x="44" y="18" width="16" height="9" fill="#222"/><path d="M20 20H44M20 25H44" stroke="#333" stroke-width="1.2"/>'],
      ['Pintu / jendela lipat','daun zig-zag di samping kaca','<rect x="4" y="30" width="8" height="8" fill="#1a1a1a"/><rect x="52" y="30" width="8" height="8" fill="#1a1a1a"/><path d="M12 32H52M12 35H52" stroke="#888" stroke-width="1"/><path d="M12 32L20 16L28 32L36 16L44 32L52 16" fill="none" stroke="#444" stroke-width="1.1"/>'],
      ['Pintu geser','dua daun bergeser sejajar','<rect x="4" y="18" width="14" height="9" fill="#222"/><rect x="46" y="18" width="14" height="9" fill="#222"/><path d="M18 20H36M28 25H46" stroke="#333" stroke-width="2"/>']
    ]],
    ['Tangga (panah = arah naik)',[
      ['Lurus','satu lengan','<g fill="none" stroke="#2b4a6f" stroke-width="1.2"><rect x="24" y="4" width="16" height="38"/>'+[9,14,19,24,29,34,39].map(y=>`<path d="M24 ${y}H40"/>`).join('')+'<path d="M32 38V9"/></g><path d="M29 11L32 5L35 11Z" fill="#2b4a6f"/>'],
      ['Bentuk L','bordes di sudut','<g fill="none" stroke="#2b4a6f" stroke-width="1.2"><rect x="8" y="4" width="12" height="28"/>'+[9,14,19,24,29].map(y=>`<path d="M8 ${y}H20"/>`).join('')+'<rect x="8" y="32" width="12" height="12"/><rect x="20" y="32" width="36" height="12"/>'+[26,32,38,44,50].map(x=>`<path d="M${x} 32V44"/>`).join('')+'</g>'],
      ['Bentuk U','dua lengan + bordes','<g fill="none" stroke="#2b4a6f" stroke-width="1.2"><rect x="14" y="4" width="36" height="12"/><rect x="14" y="16" width="16" height="28"/><rect x="34" y="16" width="16" height="28"/>'+[21,26,31,36,41].map(y=>`<path d="M14 ${y}H30M34 ${y}H50"/>`).join('')+'</g>'],
      ['Berputar','bordes berisi antrede miring','<g fill="none" stroke="#2b4a6f" stroke-width="1.2"><rect x="14" y="4" width="36" height="14"/><path d="M32 18L16 5M32 18V4M32 18L48 5"/><rect x="14" y="18" width="16" height="26"/><rect x="34" y="18" width="16" height="26"/>'+[24,30,36].map(y=>`<path d="M14 ${y}H30M34 ${y}H50"/>`).join('')+'</g>'],
      ['Lengkung','antrede menjari, berlubang tengah','<g fill="none" stroke="#2b4a6f" stroke-width="1.2"><path d="M8 42A24 24 0 0 1 56 42M20 42A12 12 0 0 1 44 42"/>'+[200,220,240,260,280,300,320,340].map(a=>{const r=a*Math.PI/180;return `<path d="M${(32+Math.cos(r)*12).toFixed(1)} ${(42+Math.sin(r)*12).toFixed(1)}L${(32+Math.cos(r)*24).toFixed(1)} ${(42+Math.sin(r)*24).toFixed(1)}"/>`;}).join('')+'</g>'],
      ['Putar (spiral)','mengelilingi tiang','<g fill="none" stroke="#2b4a6f" stroke-width="1.2"><circle cx="32" cy="24" r="19"/><circle cx="32" cy="24" r="2"/>'+[0,30,60,90,120,150,180,210,240,270,300,330].map(a=>{const r=a*Math.PI/180;return `<path d="M${(32+Math.cos(r)*2).toFixed(1)} ${(24+Math.sin(r)*2).toFixed(1)}L${(32+Math.cos(r)*19).toFixed(1)} ${(24+Math.sin(r)*19).toFixed(1)}"/>`;}).join('')+'</g>']
    ]],
    ['Perabot kamar & ruang tamu (garis tipis, tampak atas)',[
      ['Ranjang','bantal = sisi kepala; lebar → single/double/king','<g fill="none" stroke="#5a4632" stroke-width="1.2"><rect x="16" y="4" width="32" height="40"/><rect x="19" y="7" width="12" height="7"/><rect x="33" y="7" width="12" height="7"/><path d="M16 18H48"/></g>'],
      ['Nakas','kotak kecil di samping kepala ranjang','<g fill="none" stroke="#5a4632" stroke-width="1.2"><rect x="6" y="6" width="12" height="12"/><circle cx="12" cy="12" r="3"/><rect x="22" y="6" width="36" height="38"/></g>'],
      ['Lemari','strip ±60 cm menempel dinding, di ruang yang ada ranjang','<g fill="none" stroke="#5a4632" stroke-width="1.2"><rect x="4" y="6" width="56" height="13"/><path d="M32 6V19M10 12.5H26M38 12.5H54"/></g>'],
      ['Sofa & kursi santai','sandaran = garis dalam di satu sisi','<g fill="none" stroke="#5a4632" stroke-width="1.2"><rect x="6" y="12" width="52" height="22"/><path d="M6 18H58M12 18V34M52 18V34M25 18V34M39 18V34"/></g>'],
      ['Sofa L','tinta di dua sisi yang bersebelahan','<g fill="none" stroke="#5a4632" stroke-width="1.2"><path d="M6 6H58V18H18V44H6Z"/><path d="M6 12H52V18M12 12V44"/></g>'],
      ['Meja tamu','kotak / oval di depan sofa','<g fill="none" stroke="#5a4632" stroke-width="1.2"><rect x="8" y="4" width="48" height="10"/><ellipse cx="32" cy="32" rx="16" ry="8"/></g>'],
      ['Meja samping','kotak / bulat kecil di sisi sofa','<g fill="none" stroke="#5a4632" stroke-width="1.2"><rect x="4" y="14" width="38" height="20"/><path d="M4 20H42"/><rect x="47" y="17" width="12" height="12"/></g>'],
      ['Konsol / set TV','strip ramping menempel dinding, seruang dengan sofa','<g fill="none" stroke="#5a4632" stroke-width="1.2"><rect x="8" y="34" width="48" height="9"/><rect x="18" y="31" width="28" height="3"/><rect x="16" y="6" width="32" height="12"/><path d="M16 12H48"/></g>']
    ]],
    ['Makan & dapur',[
      ['Meja makan','meja + ≥2 kursi terpisah di sekelilingnya','<g fill="none" stroke="#5a4632" stroke-width="1.2"><rect x="18" y="14" width="28" height="20"/><rect x="21" y="5" width="8" height="7"/><rect x="35" y="5" width="8" height="7"/><rect x="21" y="36" width="8" height="7"/><rect x="35" y="36" width="8" height="7"/></g>'],
      ['Meja + kursi menyatu','daun meja di tengah, dudukan menempel; bulat → meja bulat','<g fill="none" stroke="#5a4632" stroke-width="1.2"><rect x="6" y="16" width="26" height="16"/><path d="M9 16V10H15V16M23 16V10H29V16M9 32V38H15V32M23 32V38H29V32"/><circle cx="48" cy="24" r="9"/><path d="M39 15L42 12L45 15M57 15L54 12L51 15M39 33L42 36L45 33M57 33L54 36L51 33"/></g>'],
      ['Kompor','kotak berisi ≥2 lingkaran tungku','<g fill="none" stroke="#5a4632" stroke-width="1.2"><rect x="16" y="8" width="32" height="32"/><circle cx="25" cy="17" r="4"/><circle cx="39" cy="17" r="4"/><circle cx="25" cy="31" r="4"/><circle cx="39" cy="31" r="4"/></g>'],
      ['Sink dapur','1–2 bak cekung di deret dapur','<g fill="none" stroke="#5a4632" stroke-width="1.2"><rect x="6" y="12" width="52" height="24"/><rect x="10" y="16" width="18" height="16" rx="3"/><rect x="31" y="16" width="18" height="16" rx="3"/><path d="M52 16V32"/></g>'],
      ['Kulkas & kabinet','kotak polos sederet kompor/sink','<g fill="none" stroke="#5a4632" stroke-width="1.2"><rect x="4" y="14" width="18" height="20"/><path d="M4 30H22"/><rect x="24" y="14" width="18" height="20"/><circle cx="29" cy="20" r="2.5"/><circle cx="37" cy="20" r="2.5"/><circle cx="29" cy="28" r="2.5"/><circle cx="37" cy="28" r="2.5"/><rect x="44" y="14" width="16" height="20"/><path d="M44 18H60"/></g>'],
      ['Deret dapur','strip ±60 cm bersekat / berisi bak & tungku','<g fill="none" stroke="#5a4632" stroke-width="1.2"><rect x="4" y="30" width="56" height="12"/><path d="M18 30V42M32 30V42M46 30V42"/><circle cx="25" cy="36" r="3"/><circle cx="39" cy="36" r="3"/></g>'],
      ['Island + kursi bar','meja lepas dinding berisi kompor/bak, atau dekat deret dapur','<g fill="none" stroke="#5a4632" stroke-width="1.2"><rect x="10" y="6" width="44" height="22"/><circle cx="28" cy="17" r="3"/><circle cx="36" cy="17" r="3"/><circle cx="22" cy="38" r="4"/><circle cx="32" cy="38" r="4"/><circle cx="42" cy="38" r="4"/></g>'],
      ['Mesin cuci & pengering','dua kotak ±60 cm berdampingan','<g fill="none" stroke="#5a4632" stroke-width="1.2"><rect x="10" y="14" width="22" height="22"/><rect x="32" y="14" width="22" height="22"/></g>']
    ]],
    ['Kamar mandi',[
      ['Kloset','dinding di sisi PENDEK (tangki di belakang)','<g fill="none" stroke="#2b6f6a" stroke-width="1.2"><rect x="6" y="16" width="8" height="16"/><path d="M14 18H22M14 30H22"/><ellipse cx="32" cy="24" rx="12" ry="8"/></g>'],
      ['Wastafel','dinding di sisi PANJANG, ada cekungan','<g fill="none" stroke="#2b6f6a" stroke-width="1.2"><path d="M14 8H50"/><path d="M16 8V14A16 14 0 0 0 48 14V8"/><ellipse cx="32" cy="17" rx="10" ry="7"/></g>'],
      ['Meja wastafel','strip menempel dinding berisi 1–2 bak','<g fill="none" stroke="#2b6f6a" stroke-width="1.2"><rect x="4" y="8" width="56" height="18"/><ellipse cx="18" cy="17" rx="8" ry="5"/><ellipse cx="46" cy="17" rx="8" ry="5"/></g>'],
      ['Bathtub','garis ganda, bagian dalam bersudut bulat & kosong','<g fill="none" stroke="#2b6f6a" stroke-width="1.2"><rect x="4" y="10" width="56" height="28"/><rect x="9" y="14" width="46" height="20" rx="9"/></g>'],
      ['Shower','kotak ±0,9 m dengan diagonal / silang','<g fill="none" stroke="#2b6f6a" stroke-width="1.2"><rect x="16" y="6" width="34" height="34"/><path d="M16 6L50 40M50 6L16 40"/><circle cx="33" cy="23" r="2"/></g>']
    ]],
    ['Diabaikan — bukan dinding',[
      ['Arsiran','garis sejajar berulang','<rect x="10" y="6" width="44" height="36" fill="none" stroke="#999" stroke-width=".8"/>'+[11,16,21,26,31,36].map(y=>`<path d="M10 ${y}H54" stroke="#aaa" stroke-width=".8"/>`).join('')],
      ['As / grid','garis titik-garis + bulatan','<circle cx="32" cy="8" r="5" fill="none" stroke="#777"/><path d="M32 13V44M6 30H58" stroke="#777" stroke-dasharray="7 2 1 2"/>'],
      ['Balok','garis putus-putus','<rect x="8" y="18" width="48" height="8" fill="none" stroke="#666" stroke-dasharray="4 3"/>']
    ]]
  ];
  (function renderSymref(){
    const body=$('#symref-body'); if(!body||body.childElementCount) return;
    for(const [head,items] of SYMREF){
      body.appendChild(el('div','sr-h',head));
      const g=el('div','sr-grid');
      for(const [nm,desc,svg] of items){
        const it=el('div','sr');
        it.innerHTML=`<svg viewBox="0 0 64 48" aria-hidden="true">${svg}</svg><b></b><span></span>`;
        it.querySelector('b').textContent=nm; it.querySelector('span').textContent=desc;
        g.appendChild(it);
      }
      body.appendChild(g);
    }
  })();
})();
