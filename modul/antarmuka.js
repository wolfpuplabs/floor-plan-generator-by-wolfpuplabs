/* Plan23D — ANTARMUKA: IKON & HUD MODE JALAN (JEV-126)
   BERKAS HASIL BANGUN — sunting tools/antarmuka_templat.js.in lalu jalankan tools/bangun_ikon.py (lihat petunjuk di sana).
   1. Ikon: emoji di teks UI (tombol, chip, toast, inspector, obrolan NPC, lembar mode jalan) diganti ikon garis Lucide
      (lucide.dev, lucide-static 1.59.0, lisensi ISC © Lucide Contributors) sehingga tampil seragam di semua perangkat.
      Teks dalam <option>, atribut (title / aria-label / placeholder) dan judul halaman cukup dibuang emojinya — elemen
      itu tidak bisa memuat SVG. Kamus terjemahan (lang/en.js) ikut dinormalisasi tanpa emoji supaya kalimatnya tetap
      cocok sesudah emojinya menjadi ikon. Teks yang diketik orang (obrolan) ditandai data-emoji & dibiarkan apa adanya.
   2. HUD mode jalan di layar sentuh: tombol Berinteraksi + aksi lain pindah ke kanan bawah (dekat jempol kanan, tidak
      menutupi tengah layar / avatar), ikon tombol mengikuti aksinya; keterangan bilah atas meredup jadi ringkas
      setelah beberapa detik (ketuk bilah untuk membacanya lagi).
   Dimuat langsung sesudah lang/en.js — sebelum lapisan bahasa dipasang. */
/* Lisensi ikon (disertakan sesuai syarat lisensinya):
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

---

The following Lucide icons are derived from the Feather project:

airplay, alert-circle, alert-octagon, alert-triangle, aperture, arrow-down-circle, arrow-down-left, arrow-down-right, arrow-down, arrow-left-circle, arrow-left, arrow-right-circle, arrow-right, arrow-up-circle, arrow-up-left, arrow-up-right, arrow-up, at-sign, calendar, cast, check, chevron-down, chevron-left, chevron-right, chevron-up, chevrons-down, chevrons-left, chevrons-right, chevrons-up, circle, clipboard, clock, code, columns, command, compass, corner-down-left, corner-down-right, corner-left-down, corner-left-up, corner-right-down, corner-right-up, corner-up-left, corner-up-right, crosshair, database, divide-circle, divide-square, dollar-sign, download, external-link, feather, frown, hash, headphones, help-circle, info, italic, key, layout, life-buoy, link-2, link, loader, lock, log-in, log-out, maximize, meh, minimize, minimize-2, minus-circle, minus-square, minus, monitor, moon, more-horizontal, more-vertical, move, music, navigation-2, navigation, octagon, pause-circle, percent, plus-circle, plus-square, plus, power, radio, rss, search, server, share, shopping-bag, sidebar, smartphone, smile, square, table-2, tablet, target, terminal, trash-2, trash, triangle, tv, type, upload, x-circle, x-octagon, x-square, x, zoom-in, zoom-out

The MIT License (MIT) (for the icons listed above)

Copyright (c) 2013-present Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE. */
(function () {
  'use strict';
  const IKON = {
   "amphora": "<path d=\"M10 2v5.632c0 .424-.272.795-.653.982A6 6 0 0 0 6 14c.006 4 3 7 5 8\"/><path d=\"M10 5H8a2 2 0 0 0 0 4h.68\"/><path d=\"M14 2v5.632c0 .424.272.795.652.982A6 6 0 0 1 18 14c0 4-3 7-5 8\"/><path d=\"M14 5h2a2 2 0 0 1 0 4h-.68\"/><path d=\"M18 22H6\"/><path d=\"M9 2h6\"/>",
   "angry": "<path d=\"M15 12v-1.584\"/><path d=\"M17 10a5 5 0 00-3 1\"/><path d=\"M7 10a5 5 0 013 1\"/><path d=\"M9 12v-1.584\"/><path d=\"M9 17a5 5 0 016.001 0\"/><circle cx=\"12\" cy=\"12\" r=\"10\"/>",
   "app-window": "<rect x=\"2\" y=\"4\" width=\"20\" height=\"16\" rx=\"2\"/><path d=\"M10 4v4\"/><path d=\"M2 8h20\"/><path d=\"M6 4v4\"/>",
   "archive": "<rect width=\"20\" height=\"5\" x=\"2\" y=\"3\" rx=\"1\"/><path d=\"M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8\"/><path d=\"M10 12h4\"/>",
   "armchair": "<path d=\"M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3\"/><path d=\"M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z\"/><path d=\"M5 18v2\"/><path d=\"M19 18v2\"/>",
   "axe": "<path d=\"m14 12-8.381 8.38a1 1 0 0 1-3.001-3L11 9\"/><path d=\"M15 15.5a.5.5 0 0 0 .5.5A6.5 6.5 0 0 0 22 9.5a.5.5 0 0 0-.5-.5h-1.672a2 2 0 0 1-1.414-.586l-5.062-5.062a1.205 1.205 0 0 0-1.704 0L9.352 5.648a1.205 1.205 0 0 0 0 1.704l5.062 5.062A2 2 0 0 1 15 13.828z\"/>",
   "bath": "<path d=\"M10 4 8 6\"/><path d=\"M17 19v2\"/><path d=\"M2 12h20\"/><path d=\"M7 19v2\"/><path d=\"M9 5 7.621 3.621A2.121 2.121 0 0 0 4 5v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5\"/>",
   "bed-double": "<path d=\"M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8\"/><path d=\"M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4\"/><path d=\"M12 4v6\"/><path d=\"M2 18h20\"/>",
   "beef": "<path d=\"M16.4 13.7A6.5 6.5 0 1 0 6.28 6.6c-1.1 3.13-.78 3.9-3.18 6.08A3 3 0 0 0 5 18c4 0 8.4-1.8 11.4-4.3\"/><path d=\"m18.5 6 1.754 3.5a6.48 6.48 0 0 1-1.854 8.2C15.4 20.2 11 22 7 22a3 3 0 0 1-2.68-1.66L2.4 16.5\"/><circle cx=\"12.5\" cy=\"8.5\" r=\"2.5\"/>",
   "bike": "<circle cx=\"18.5\" cy=\"17.5\" r=\"3.5\"/><circle cx=\"5.5\" cy=\"17.5\" r=\"3.5\"/><circle cx=\"15\" cy=\"5\" r=\"1\"/><path d=\"M12 17.5V14l-3-3 4-3 2 3h2\"/>",
   "blinds": "<path d=\"M3 3h18\"/><path d=\"M20 7H8\"/><path d=\"M20 11H8\"/><path d=\"M10 19h10\"/><path d=\"M8 15h12\"/><path d=\"M4 3v14\"/><circle cx=\"4\" cy=\"19\" r=\"2\"/>",
   "brick-wall": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"/><path d=\"M12 9v6\"/><path d=\"M16 15v6\"/><path d=\"M16 3v6\"/><path d=\"M3 15h18\"/><path d=\"M3 9h18\"/><path d=\"M8 15v6\"/><path d=\"M8 3v6\"/>",
   "brush": "<path d=\"m11 10 3 3\"/><path d=\"M6.5 21A3.5 3.5 0 1 0 3 17.5a2.62 2.62 0 0 1-.708 1.792A1 1 0 0 0 3 21z\"/><path d=\"M9.969 17.031 21.378 5.624a1 1 0 0 0-3.002-3.002L6.967 14.031\"/>",
   "camera": "<path d=\"M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z\"/><circle cx=\"12\" cy=\"13\" r=\"3\"/>",
   "candy": "<path d=\"M10 7v10.9\"/><path d=\"M14 6.1V17\"/><path d=\"M16 7V3a1 1 0 0 1 1.707-.707 2.5 2.5 0 0 0 2.152.717 1 1 0 0 1 1.131 1.131 2.5 2.5 0 0 0 .717 2.152A1 1 0 0 1 21 8h-4\"/><path d=\"M16.536 7.465a5 5 0 0 0-7.072 0l-2 2a5 5 0 0 0 0 7.07 5 5 0 0 0 7.072 0l2-2a5 5 0 0 0 0-7.07\"/><path d=\"M8 17v4a1 1 0 0 1-1.707.707 2.5 2.5 0 0 0-2.152-.717 1 1 0 0 1-1.131-1.131 2.5 2.5 0 0 0-.717-2.152A1 1 0 0 1 3 16h4\"/>",
   "car": "<path d=\"M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2\"/><circle cx=\"7\" cy=\"17\" r=\"2\"/><path d=\"M9 17h6\"/><circle cx=\"17\" cy=\"17\" r=\"2\"/>",
   "cassette-tape": "<rect width=\"20\" height=\"16\" x=\"2\" y=\"4\" rx=\"2\"/><circle cx=\"8\" cy=\"10\" r=\"2\"/><path d=\"M8 12h8\"/><circle cx=\"16\" cy=\"10\" r=\"2\"/><path d=\"m6 20 .7-2.9A1.4 1.4 0 0 1 8.1 16h7.8a1.4 1.4 0 0 1 1.4 1l.7 3\"/>",
   "circle": "<circle cx=\"12\" cy=\"12\" r=\"10\"/>",
   "circle-question-mark": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3\"/><path d=\"M12 17h.01\"/>",
   "clock": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 6v6l4 2\"/>",
   "cloud-lightning": "<path d=\"M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973\"/><path d=\"m13 12-3 5h4l-3 5\"/>",
   "cloud-rain": "<path d=\"M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242\"/><path d=\"M16 14v6\"/><path d=\"M8 14v6\"/><path d=\"M12 16v6\"/>",
   "cloud-sun": "<path d=\"M12 2v2\"/><path d=\"m4.93 4.93 1.41 1.41\"/><path d=\"M20 12h2\"/><path d=\"m19.07 4.93-1.41 1.41\"/><path d=\"M15.947 12.65a4 4 0 0 0-5.925-4.128\"/><path d=\"M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z\"/>",
   "cloud-sun-rain": "<path d=\"M12 2v2\"/><path d=\"m4.93 4.93 1.41 1.41\"/><path d=\"M20 12h2\"/><path d=\"m19.07 4.93-1.41 1.41\"/><path d=\"M15.947 12.65a4 4 0 0 0-5.925-4.128\"/><path d=\"M3 20a5 5 0 1 1 8.9-4H13a3 3 0 0 1 2 5.24\"/><path d=\"M11 20v2\"/><path d=\"M7 19v2\"/>",
   "construction": "<rect x=\"2\" y=\"6\" width=\"20\" height=\"8\" rx=\"1\"/><path d=\"M17 14v7\"/><path d=\"M7 14v7\"/><path d=\"M17 3v3\"/><path d=\"M7 3v3\"/><path d=\"M10 14 2.3 6.3\"/><path d=\"m14 6 7.7 7.7\"/><path d=\"m8 6 8 8\"/>",
   "cooking-pot": "<path d=\"M2 12h20\"/><path d=\"M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8\"/><path d=\"m4 8 16-4\"/><path d=\"m8.86 6.78-.45-1.81a2 2 0 0 1 1.45-2.43l1.94-.48a2 2 0 0 1 2.43 1.46l.45 1.8\"/>",
   "cup-soda": "<path d=\"m6 8 1.75 12.28a2 2 0 0 0 2 1.72h4.54a2 2 0 0 0 2-1.72L18 8\"/><path d=\"M5 8h14\"/><path d=\"M7 15a6.47 6.47 0 0 1 5 0 6.47 6.47 0 0 0 5 0\"/><path d=\"m12 8 1-6h2\"/>",
   "dices": "<rect width=\"12\" height=\"12\" x=\"2\" y=\"10\" rx=\"2\" ry=\"2\"/><path d=\"m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6\"/><path d=\"M6 18h.01\"/><path d=\"M10 14h.01\"/><path d=\"M15 6h.01\"/><path d=\"M18 9h.01\"/>",
   "disc-3": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M6 12c0-1.7.7-3.2 1.8-4.2\"/><circle cx=\"12\" cy=\"12\" r=\"2\"/><path d=\"M18 12c0 1.7-.7 3.2-1.8 4.2\"/>",
   "door-open": "<path d=\"M10 21H2\"/><path d=\"M10 3H7a2 2 0 00-2 2v16\"/><path d=\"M14 12h.01\"/><path d=\"M19 21V5a2 2 0 00-1.675-1.974l-6.163-1.013A1 1 0 0010 3v18a1 1 0 001.124.992z\"/><path d=\"M22 21h-3\"/>",
   "door-stairwell": "<path d=\"M12 17v-3a1 1 0 011-1h6\"/><path d=\"M19 17h-9a1 1 0 00-1 1v3\"/><path d=\"M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16\"/><path d=\"M19 9h-3a1 1 0 00-1 1v3\"/><path d=\"M22 21H2\"/>",
   "droplet": "<path d=\"M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z\"/>",
   "droplets": "<path d=\"M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z\"/><path d=\"M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97\"/>",
   "egg": "<path d=\"M12 2C8 2 4 8 4 14a8 8 0 0 0 16 0c0-6-4-12-8-12\"/>",
   "eye": "<path d=\"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>",
   "ferris-wheel": "<circle cx=\"12\" cy=\"12\" r=\"2\"/><path d=\"M12 2v4\"/><path d=\"m6.8 15-3.5 2\"/><path d=\"m20.7 7-3.5 2\"/><path d=\"M6.8 9 3.3 7\"/><path d=\"m20.7 17-3.5-2\"/><path d=\"m9 22 3-8 3 8\"/><path d=\"M8 22h8\"/><path d=\"M18 18.7a9 9 0 1 0-12 0\"/>",
   "film": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"/><path d=\"M7 3v18\"/><path d=\"M3 7.5h4\"/><path d=\"M3 12h18\"/><path d=\"M3 16.5h4\"/><path d=\"M17 3v18\"/><path d=\"M17 7.5h4\"/><path d=\"M17 16.5h4\"/>",
   "fish": "<path d=\"M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z\"/><path d=\"M18 12v.5\"/><path d=\"M16 17.93a9.77 9.77 0 0 1 0-11.86\"/><path d=\"M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33\"/><path d=\"M10.46 7.26C10.2 5.88 9.17 4.24 8 3h5.8a2 2 0 0 1 1.98 1.67l.23 1.4\"/><path d=\"m16.01 17.93-.23 1.4A2 2 0 0 1 13.8 21H9.5a5.96 5.96 0 0 0 1.49-3.98\"/>",
   "fish-symbol": "<path d=\"M2 16s9-15 20-4C11 23 2 8 2 8\"/>",
   "flame": "<path d=\"M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4\"/>",
   "flame-kindling": "<path d=\"M12 2c1 3 2.5 3.5 3.5 4.5A5 5 0 0 1 17 10a5 5 0 1 1-10 0c0-.3 0-.6.1-.9a2 2 0 1 0 3.3-2C8 4.5 11 2 12 2Z\"/><path d=\"m5 22 14-4\"/><path d=\"m5 18 14 4\"/>",
   "flower": "<circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M12 16.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 1 1 4.5 4.5 4.5 4.5 0 1 1-4.5 4.5\"/><path d=\"M12 7.5V9\"/><path d=\"M7.5 12H9\"/><path d=\"M16.5 12H15\"/><path d=\"M12 16.5V15\"/><path d=\"m8 8 1.88 1.88\"/><path d=\"M14.12 9.88 16 8\"/><path d=\"m8 16 1.88-1.88\"/><path d=\"M14.12 14.12 16 16\"/>",
   "flower-2": "<path d=\"M12 5a3 3 0 1 1 3 3m-3-3a3 3 0 1 0-3 3m3-3v1M9 8a3 3 0 1 0 3 3M9 8h1m5 0a3 3 0 1 1-3 3m3-3h-1m-2 3v-1\"/><circle cx=\"12\" cy=\"8\" r=\"2\"/><path d=\"M12 10v12\"/><path d=\"M12 22c4.2 0 7-1.667 7-5-4.2 0-7 1.667-7 5Z\"/><path d=\"M12 22c-4.2 0-7-1.667-7-5 4.2 0 7 1.667 7 5Z\"/>",
   "folder": "<path d=\"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z\"/>",
   "folder-open": "<path d=\"m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2\"/>",
   "footprints": "<path d=\"M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z\"/><path d=\"M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z\"/><path d=\"M16 17h4\"/><path d=\"M4 13h4\"/>",
   "gift": "<path d=\"M12 7v14\"/><path d=\"M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8\"/><path d=\"M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5\"/><rect x=\"3\" y=\"7\" width=\"18\" height=\"4\" rx=\"1\"/>",
   "guitar": "<path d=\"m11.9 12.1 4.514-4.514\"/><path d=\"M20.1 2.3a1 1 0 0 0-1.4 0l-1.114 1.114A2 2 0 0 0 17 4.828v1.344a2 2 0 0 1-.586 1.414A2 2 0 0 1 17.828 7h1.344a2 2 0 0 0 1.414-.586L21.7 5.3a1 1 0 0 0 0-1.4z\"/><path d=\"m6 16 2 2\"/><path d=\"M8.23 9.85A3 3 0 0 1 11 8a5 5 0 0 1 5 5 3 3 0 0 1-1.85 2.77l-.92.38A2 2 0 0 0 12 18a4 4 0 0 1-4 4 6 6 0 0 1-6-6 4 4 0 0 1 4-4 2 2 0 0 0 1.85-1.23z\"/>",
   "hand": "<path d=\"M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2\"/><path d=\"M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2\"/><path d=\"M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8\"/><path d=\"M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15\"/>",
   "hand-heart": "<path d=\"M11 14h2a2 2 0 0 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16\"/><path d=\"m14.45 13.39 5.05-4.694C20.196 8 21 6.85 21 5.75a2.75 2.75 0 0 0-4.797-1.837.276.276 0 0 1-.406 0A2.75 2.75 0 0 0 11 5.75c0 1.2.802 2.248 1.5 2.946L16 11.95\"/><path d=\"m2 15 6 6\"/><path d=\"m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a1 1 0 0 0-2.75-2.91\"/>",
   "hand-helping": "<path d=\"M11 12h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 14\"/><path d=\"m7 18 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9\"/><path d=\"m2 13 6 6\"/>",
   "hand-metal": "<path d=\"M18 12.5V10a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1.4\"/><path d=\"M14 11V9a2 2 0 1 0-4 0v2\"/><path d=\"M10 10.5V5a2 2 0 1 0-4 0v9\"/><path d=\"m7 15-1.76-1.76a2 2 0 0 0-2.83 2.82l3.6 3.6C7.5 21.14 9.2 22 12 22h2a8 8 0 0 0 8-8V7a2 2 0 1 0-4 0v5\"/>",
   "handshake": "<path d=\"m11 17 2 2a1 1 0 1 0 3-3\"/><path d=\"m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4\"/><path d=\"m21 3 1 11h-2\"/><path d=\"M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3\"/><path d=\"M3 4h8\"/>",
   "heart": "<path d=\"M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5\"/>",
   "heart-crack": "<path d=\"M12.409 5.824c-.702.792-1.15 1.496-1.415 2.166l2.153 2.156a.5.5 0 0 1 0 .707l-2.293 2.293a.5.5 0 0 0 0 .707L12 15\"/><path d=\"M13.508 20.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5a5.5 5.5 0 0 1 9.591-3.677.6.6 0 0 0 .818.001A5.5 5.5 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5z\"/>",
   "heart-handshake": "<path d=\"M19.414 14.414C21 12.828 22 11.5 22 9.5a5.5 5.5 0 0 0-9.591-3.676.6.6 0 0 1-.818.001A5.5 5.5 0 0 0 2 9.5c0 2.3 1.5 4 3 5.5l5.535 5.362a2 2 0 0 0 2.879.052 2.12 2.12 0 0 0-.004-3 2.124 2.124 0 1 0 3-3 2.124 2.124 0 0 0 3.004 0 2 2 0 0 0 0-2.828l-1.881-1.882a2.41 2.41 0 0 0-3.409 0l-1.71 1.71a2 2 0 0 1-2.828 0 2 2 0 0 1 0-2.828l2.823-2.762\"/>",
   "house": "<path d=\"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8\"/><path d=\"M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/>",
   "image": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" ry=\"2\"/><circle cx=\"9\" cy=\"9\" r=\"2\"/><path d=\"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21\"/>",
   "info": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16v-4\"/><path d=\"M12 8h.01\"/>",
   "keyboard": "<path d=\"M10 8h.01\"/><path d=\"M12 12h.01\"/><path d=\"M14 8h.01\"/><path d=\"M16 12h.01\"/><path d=\"M18 8h.01\"/><path d=\"M6 8h.01\"/><path d=\"M7 16h10\"/><path d=\"M8 12h.01\"/><rect width=\"20\" height=\"16\" x=\"2\" y=\"4\" rx=\"2\"/>",
   "lamp": "<path d=\"M12 12v6\"/><path d=\"M4.077 10.615A1 1 0 0 0 5 12h14a1 1 0 0 0 .923-1.385l-3.077-7.384A2 2 0 0 0 15 2H9a2 2 0 0 0-1.846 1.23Z\"/><path d=\"M8 20a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z\"/>",
   "landmark": "<path d=\"M10 18v-7\"/><path d=\"M11.119 2.205a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7h-17a.5.5 0 0 1-.22-.949z\"/><path d=\"M14 18v-7\"/><path d=\"M18 18v-7\"/><path d=\"M3 22h18\"/><path d=\"M6 18v-7\"/>",
   "laptop": "<path d=\"M18 5a2 2 0 0 1 2 2v8.526a2 2 0 0 0 .212.897l1.068 2.127a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45l1.068-2.127A2 2 0 0 0 4 15.526V7a2 2 0 0 1 2-2z\"/><path d=\"M20.054 15.987H3.946\"/>",
   "leaf": "<path d=\"M11 20a10 10 0 0010-10 25.9 25.9 0 00-1.04-7.281 1 1 0 00-1.755-.325C15.833 5.5 13 5.5 9.8 6.1A7 7 0 0011 20\"/><path d=\"M2 21a5 5 0 012.911-4.544C7.613 15.212 8.351 15.24 11 13\"/>",
   "library": "<path d=\"m16 6 4 14\"/><path d=\"M12 6v14\"/><path d=\"M8 8v12\"/><path d=\"M4 4v16\"/>",
   "lightbulb": "<path d=\"M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5\"/><path d=\"M9 18h6\"/><path d=\"M10 22h4\"/>",
   "log-in": "<path d=\"m10 17 5-5-5-5\"/><path d=\"M15 12H3\"/><path d=\"M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4\"/>",
   "lollipop": "<circle cx=\"11\" cy=\"11\" r=\"8\"/><path d=\"m21 21-4.3-4.3\"/><path d=\"M11 11a2 2 0 0 0 4 0 4 4 0 0 0-8 0 6 6 0 0 0 12 0\"/>",
   "map-pin": "<path d=\"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0\"/><circle cx=\"12\" cy=\"10\" r=\"3\"/>",
   "megaphone": "<path d=\"M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z\"/><path d=\"M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14\"/><path d=\"M8 6v8\"/>",
   "meh": "<path d=\"M15 10V9\"/><path d=\"M8 16h8\"/><path d=\"M9 10V9\"/><circle cx=\"12\" cy=\"12\" r=\"10\"/>",
   "message-circle": "<path d=\"M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719\"/>",
   "moon": "<path d=\"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401\"/>",
   "mountain": "<path d=\"m8 3 4 8 5-5 5 15H2L8 3z\"/>",
   "mountain-snow": "<path d=\"m8 3 4 8 5-5 5 15H2L8 3z\"/><path d=\"M4.14 15.08c2.62-1.57 5.24-1.43 7.86.42 2.74 1.94 5.49 2 8.23.19\"/>",
   "music": "<path d=\"M21 16V3a1 1 0 0 0-1.28-.96l-10 2.917a1 1 0 0 0-.72.96V19\"/><circle cx=\"18\" cy=\"16\" r=\"3\"/><circle cx=\"6\" cy=\"19\" r=\"3\"/>",
   "nut": "<path d=\"M16.847 5.847 20 9a7.23 7.23 0 011.551 7.516C21.241 17.352 21 17.932 21 19v1a1 1 0 01-1 1h-1c-1.069 0-1.648.242-2.485.552A7.2 7.2 0 019.002 20l-3.155-3.153\"/><path d=\"M18.21 5.43c-1.71.69-5.07 1.07-6.71 1.07.46 1.38.91 2.74.61 4.88a.88.88 0 01-.73.74c-1.78.28-3.54-.17-4.88-.62 0 1.64-.38 5-1.07 6.71-.21.52-.82.55-1.17.12A10 10 0 0118.33 4.26c.43.35.4.97-.12 1.17\"/><path d=\"M4.93 4.93 3 3a.7.7 0 010-1\"/>",
   "package": "<path d=\"M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z\"/><path d=\"M12 22V12\"/><polyline points=\"3.29 7 12 12 20.71 7\"/><path d=\"m7.5 4.27 9 5.15\"/>",
   "package-open": "<path d=\"M12 22v-9\"/><path d=\"M15.17 2.21a1.67 1.67 0 0 1 1.63 0L21 4.57a1.93 1.93 0 0 1 0 3.36L8.82 14.79a1.655 1.655 0 0 1-1.64 0L3 12.43a1.93 1.93 0 0 1 0-3.36z\"/><path d=\"M20 13v3.87a2.06 2.06 0 0 1-1.11 1.83l-6 3.08a1.93 1.93 0 0 1-1.78 0l-6-3.08A2.06 2.06 0 0 1 4 16.87V13\"/><path d=\"M21 12.43a1.93 1.93 0 0 0 0-3.36L8.83 2.2a1.64 1.64 0 0 0-1.63 0L3 4.57a1.93 1.93 0 0 0 0 3.36l12.18 6.86a1.636 1.636 0 0 0 1.63 0z\"/>",
   "party-popper": "<path d=\"M5.8 11.3 2 22l10.7-3.79\"/><path d=\"M4 3h.01\"/><path d=\"M22 8h.01\"/><path d=\"M15 2h.01\"/><path d=\"M22 20h.01\"/><path d=\"m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10\"/><path d=\"m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17\"/><path d=\"m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7\"/><path d=\"M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z\"/>",
   "person-standing": "<circle cx=\"12\" cy=\"5\" r=\"1\"/><path d=\"m9 20 3-6 3 6\"/><path d=\"m6 8 6 2 6-2\"/><path d=\"M12 10v4\"/>",
   "piano": "<path d=\"M10 13v4\"/><path d=\"M14 13v4\"/><path d=\"M18 13v4\"/><path d=\"M2 13h20\"/><path d=\"M22 11.5A3.5 3.5 0 0018.5 8a3.52 3.52 0 01-3.173-2A7 7 0 002 9v10a2 2 0 002 2h16a2 2 0 002-2z\"/><path d=\"M6 13v4\"/>",
   "play": "<path d=\"M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z\"/>",
   "pointer": "<path d=\"M22 14a8 8 0 0 1-8 8\"/><path d=\"M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2\"/><path d=\"M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1\"/><path d=\"M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10\"/><path d=\"M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15\"/>",
   "refresh-cw": "<path d=\"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8\"/><path d=\"M21 3v5h-5\"/><path d=\"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16\"/><path d=\"M8 16H3v5\"/>",
   "refrigerator": "<path d=\"M5 6a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6Z\"/><path d=\"M5 10h14\"/><path d=\"M15 7v6\"/>",
   "ruler": "<path d=\"M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z\"/><path d=\"m14.5 12.5 2-2\"/><path d=\"m11.5 9.5 2-2\"/><path d=\"m8.5 6.5 2-2\"/><path d=\"m17.5 15.5 2-2\"/>",
   "scan-face": "<path d=\"M3 7V5a2 2 0 0 1 2-2h2\"/><path d=\"M17 3h2a2 2 0 0 1 2 2v2\"/><path d=\"M21 17v2a2 2 0 0 1-2 2h-2\"/><path d=\"M7 21H5a2 2 0 0 1-2-2v-2\"/><path d=\"M8 14s1.5 2 4 2 4-2 4-2\"/><path d=\"M9 9h.01\"/><path d=\"M15 9h.01\"/>",
   "scissors": "<circle cx=\"6\" cy=\"6\" r=\"3\"/><path d=\"M8.12 8.12 12 12\"/><path d=\"M20 4 8.12 15.88\"/><circle cx=\"6\" cy=\"18\" r=\"3\"/><path d=\"M14.8 14.8 20 20\"/>",
   "shirt": "<path d=\"M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z\"/>",
   "shopping-bag": "<path d=\"M16 10a4 4 0 0 1-8 0\"/><path d=\"M3.103 6.034h17.794\"/><path d=\"M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z\"/>",
   "shopping-basket": "<path d=\"m15 11-1 9\"/><path d=\"m19 11-4-7\"/><path d=\"M2 11h20\"/><path d=\"m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4\"/><path d=\"M4.5 15.5h15\"/><path d=\"m5 11 4-7\"/><path d=\"m9 11 1 9\"/>",
   "shower-head": "<path d=\"m4 4 2.5 2.5\"/><path d=\"M13.5 6.5a4.95 4.95 0 0 0-7 7\"/><path d=\"M15 5 5 15\"/><path d=\"M14 17v.01\"/><path d=\"M10 16v.01\"/><path d=\"M13 13v.01\"/><path d=\"M16 10v.01\"/><path d=\"M11 20v.01\"/><path d=\"M17 14v.01\"/><path d=\"M20 11v.01\"/>",
   "sliders-horizontal": "<path d=\"M10 5H3\"/><path d=\"M12 19H3\"/><path d=\"M14 3v4\"/><path d=\"M16 17v4\"/><path d=\"M21 12h-9\"/><path d=\"M21 19h-5\"/><path d=\"M21 5h-7\"/><path d=\"M8 10v4\"/><path d=\"M8 12H3\"/>",
   "smile": "<path d=\"M15 10V9\"/><path d=\"M16.472 15a6 6 0 01-8.943 0\"/><path d=\"M9 10V9\"/><circle cx=\"12\" cy=\"12\" r=\"10\"/>",
   "snowflake": "<path d=\"m10 20-1.25-2.5L6 18\"/><path d=\"M10 4 8.75 6.5 6 6\"/><path d=\"m14 20 1.25-2.5L18 18\"/><path d=\"m14 4 1.25 2.5L18 6\"/><path d=\"m17 21-3-6h-4\"/><path d=\"m17 3-3 6 1.5 3\"/><path d=\"M2 12h6.5L10 9\"/><path d=\"m20 10-1.5 2 1.5 2\"/><path d=\"M22 12h-6.5L14 15\"/><path d=\"m4 10 1.5 2L4 14\"/><path d=\"m7 21 3-6-1.5-3\"/><path d=\"m7 3 3 6h4\"/>",
   "sofa": "<path d=\"M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3\"/><path d=\"M2 16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z\"/><path d=\"M4 18v2\"/><path d=\"M20 18v2\"/><path d=\"M12 4v9\"/>",
   "sparkles": "<path d=\"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z\"/><path d=\"M20 2v4\"/><path d=\"M22 4h-4\"/><circle cx=\"4\" cy=\"20\" r=\"2\"/>",
   "sprout": "<path d=\"M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3\"/><path d=\"M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4\"/><path d=\"M5 21h14\"/>",
   "square": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"/>",
   "star": "<path d=\"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z\"/>",
   "stethoscope": "<path d=\"M11 2v2\"/><path d=\"M5 2v2\"/><path d=\"M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1\"/><path d=\"M8 15a6 6 0 0 0 12 0v-3\"/><circle cx=\"20\" cy=\"10\" r=\"2\"/>",
   "sun": "<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2\"/><path d=\"M12 20v2\"/><path d=\"m4.93 4.93 1.41 1.41\"/><path d=\"m17.66 17.66 1.41 1.41\"/><path d=\"M2 12h2\"/><path d=\"M20 12h2\"/><path d=\"m6.34 17.66-1.41 1.41\"/><path d=\"m19.07 4.93-1.41 1.41\"/>",
   "sunrise": "<path d=\"M12 2v8\"/><path d=\"m4.93 10.93 1.41 1.41\"/><path d=\"M2 18h2\"/><path d=\"M20 18h2\"/><path d=\"m19.07 10.93-1.41 1.41\"/><path d=\"M22 22H2\"/><path d=\"m8 6 4-4 4 4\"/><path d=\"M16 18a4 4 0 0 0-8 0\"/>",
   "sunset": "<path d=\"M12 10V2\"/><path d=\"m4.93 10.93 1.41 1.41\"/><path d=\"M2 18h2\"/><path d=\"M20 18h2\"/><path d=\"m19.07 10.93-1.41 1.41\"/><path d=\"M22 22H2\"/><path d=\"m16 6-4 4-4-4\"/><path d=\"M16 18a4 4 0 0 0-8 0\"/>",
   "target": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><circle cx=\"12\" cy=\"12\" r=\"6\"/><circle cx=\"12\" cy=\"12\" r=\"2\"/>",
   "tent": "<path d=\"M3.5 21 14 3\"/><path d=\"M20.5 21 10 3\"/><path d=\"M15.5 21 12 15l-3.5 6\"/><path d=\"M2 21h20\"/>",
   "thumbs-up": "<path d=\"M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z\"/><path d=\"M7 10v12\"/>",
   "toilet": "<path d=\"M7 12h13a1 1 0 0 1 1 1 5 5 0 0 1-5 5h-.598a.5.5 0 0 0-.424.765l1.544 2.47a.5.5 0 0 1-.424.765H5.402a.5.5 0 0 1-.424-.765L7 18\"/><path d=\"M8 18a5 5 0 0 1-5-5V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8\"/>",
   "tornado": "<path d=\"M21 4H3\"/><path d=\"M18 8H6\"/><path d=\"M19 12H9\"/><path d=\"M16 16h-6\"/><path d=\"M11 20H9\"/>",
   "toy-brick": "<rect width=\"18\" height=\"12\" x=\"3\" y=\"8\" rx=\"1\"/><path d=\"M10 8V5c0-.6-.4-1-1-1H6a1 1 0 0 0-1 1v3\"/><path d=\"M19 8V5c0-.6-.4-1-1-1h-3a1 1 0 0 0-1 1v3\"/>",
   "tree-deciduous": "<path d=\"M8 19a4 4 0 0 1-2.24-7.32A3.5 3.5 0 0 1 9 6.03V6a3 3 0 1 1 6 0v.04a3.5 3.5 0 0 1 3.24 5.65A4 4 0 0 1 16 19Z\"/><path d=\"M12 19v3\"/>",
   "tree-palm": "<path d=\"M13 8c0-2.76-2.46-5-5.5-5S2 5.24 2 8h2l1-1 1 1h4\"/><path d=\"M13 7.14A5.82 5.82 0 0 1 16.5 6c3.04 0 5.5 2.24 5.5 5h-3l-1-1-1 1h-3\"/><path d=\"M5.89 9.71c-2.15 2.15-2.3 5.47-.35 7.43l4.24-4.25.7-.7.71-.71 2.12-2.12c-1.95-1.96-5.27-1.8-7.42.35\"/><path d=\"M11 15.5c.5 2.5-.17 4.5-1 6.5h4c2-5.5-.5-12-1-14\"/>",
   "tree-pine": "<path d=\"m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17Z\"/><path d=\"M12 22v-3\"/>",
   "triangle": "<path d=\"M13.73 4a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\"/>",
   "triangle-alert": "<path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/>",
   "tv": "<path d=\"m17 2-5 5-5-5\"/><rect width=\"20\" height=\"15\" x=\"2\" y=\"7\" rx=\"2\"/>",
   "umbrella": "<path d=\"M12 13v7a2 2 0 0 0 4 0\"/><path d=\"M12 2v2\"/><path d=\"M20.992 13a1 1 0 0 0 .97-1.274 10.284 10.284 0 0 0-19.923 0A1 1 0 0 0 3 13z\"/>",
   "user": "<path d=\"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2\"/><circle cx=\"12\" cy=\"7\" r=\"4\"/>",
   "user-round-check": "<path d=\"M2 21a8 8 0 0 1 13.292-6\"/><circle cx=\"10\" cy=\"8\" r=\"5\"/><path d=\"m16 19 2 2 4-4\"/>",
   "utensils": "<path d=\"M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2\"/><path d=\"M7 2v20\"/><path d=\"M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7\"/>",
   "volume-2": "<path d=\"M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z\"/><path d=\"M16 9a5 5 0 0 1 0 6\"/><path d=\"M19.364 18.364a9 9 0 0 0 0-12.728\"/>",
   "volume-x": "<path d=\"M11 4.702a.7.7 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.7.7 0 0 0 11 19.298z\"/><path d=\"m16.5 14.5 5-5\"/><path d=\"m16.5 9.5 5 5\"/>",
   "waves": "<path d=\"M2 12q2.5 2 5 0t5 0 5 0 5 0\"/><path d=\"M2 19q2.5 2 5 0t5 0 5 0 5 0\"/><path d=\"M2 5q2.5 2 5 0t5 0 5 0 5 0\"/>",
   "wheat": "<path d=\"M2 22 16 8\"/><path d=\"M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z\"/><path d=\"M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z\"/><path d=\"M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z\"/><path d=\"M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z\"/><path d=\"M11.47 17.47 13 19l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L5 19l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z\"/><path d=\"M15.47 13.47 17 15l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L9 15l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z\"/><path d=\"M19.47 9.47 21 11l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L13 11l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z\"/>",
   "wind": "<path d=\"M12.8 19.6A2 2 0 1 0 14 16H2\"/><path d=\"M17.5 8a2.5 2.5 0 1 1 2 4H2\"/><path d=\"M9.8 4.4A2 2 0 1 1 11 8H2\"/>"
  };
  const PETA = {"💞": "heart-handshake", "🔥": "flame", "⚠": "triangle-alert", "🎲": "dices", "🪑": "armchair", "🍳": "cooking-pot", "💡": "lightbulb", "💕": "heart", "🫶": "hand-heart", "🍽": "utensils", "🪵": "flame-kindling", "😊": "smile", "✌": "hand-metal", "🛏": "bed-double", "🪨": "mountain", "🛋": "sofa", "🍢": "lollipop", "🗄": "archive", "📺": "tv", "🪞": "scan-face", "🌳": "tree-deciduous", "❤": "heart", "👋": "hand", "🤗": "heart-handshake", "🤝": "handshake", "😘": "heart", "🚪": "door-open", "🪴": "sprout", "🖼": "image", "🌿": "leaf", "🎸": "guitar", "🪓": "axe", "🍡": "candy", "🐟": "fish", "👤": "user", "💃": "music", "😴": "moon", "💁": "user-round-check", "🟫": "square", "🧱": "brick-wall", "🚿": "shower-head", "📚": "library", "🌴": "tree-palm", "🪟": "app-window", "🥚": "egg", "🎹": "piano", "🎠": "ferris-wheel", "🌙": "moon", "💛": "heart", "🏊": "waves", "💦": "droplets", "🌟": "sparkles", "🎣": "fish-symbol", "📦": "package", "💔": "heart-crack", "🎁": "gift", "🎯": "target", "💐": "flower", "💗": "heart", "😤": "angry", "⭐": "star", "🧘": "person-standing", "💺": "armchair", "🧊": "refrigerator", "🚰": "droplet", "🚽": "toilet", "🪥": "brush", "🛁": "bath", "💻": "laptop", "🧸": "toy-brick", "🗃": "archive", "💄": "sparkles", "🥤": "cup-soda", "🧺": "shopping-basket", "🗂": "folder-open", "❄": "snowflake", "🚗": "car", "🏍": "bike", "🕰": "clock", "🎚": "sliders-horizontal", "🕯": "flame", "🌱": "sprout", "🌵": "leaf", "🫧": "droplets", "🟥": "square", "👟": "footprints", "🥫": "package", "💨": "wind", "🟤": "circle", "🌲": "tree-pine", "🌷": "flower-2", "🌼": "flower", "🏮": "lamp", "⛩": "landmark", "🏗": "construction", "🏖": "umbrella", "⛱": "umbrella", "⛲": "droplets", "🌾": "wheat", "⚫": "circle", "⚪": "circle", "🔺": "triangle", "🧥": "shirt", "🏺": "amphora", "💿": "disc-3", "📼": "cassette-tape", "🎵": "music", "📐": "ruler", "🪜": "door-stairwell", "🔃": "refresh-cw", "🔄": "refresh-cw", "🌀": "tornado", "🏕": "tent", "🔊": "volume-2", "📷": "camera", "🎞": "film", "🧵": "scissors", "👜": "shopping-bag", "🔩": "nut", "🌅": "sunrise", "☀": "sun", "🌇": "sunset", "📁": "folder", "🏞": "mountain-snow", "📍": "map-pin", "🥾": "footprints", "🌽": "wheat", "🌭": "utensils", "🌤": "cloud-sun", "⛈": "cloud-lightning", "🌦": "cloud-sun-rain", "🌧": "cloud-rain", "💢": "angry", "😒": "meh", "🙂": "smile", "💖": "heart", "💬": "message-circle", "🗣": "megaphone", "🔇": "volume-x", "👍": "thumbs-up", "❓": "circle-question-mark", "🏠": "house", "🚶": "footprints", "🫂": "heart-handshake", "💤": "moon", "🎈": "party-popper", "⌨": "keyboard", "📸": "camera", "🩺": "stethoscope", "👁": "eye", "👆": "pointer"};
  const AKSI = {"bukaan": "door-open", "lampu": "lightbulb", "api": "flame", "tv": "tv", "gorden": "blinds", "audio": "music", "detail": "info", "sapa": "hand", "ngobrol": "message-circle", "lepas": "hand-helping", "baring": "bed-double", "bunyi": "volume-2", "anim": "play", "musik": "music", "piano": "piano", "gitar": "guitar", "pindah": "log-in", "duduk": "armchair", "berdiri": "person-standing", "mancing": "fish-symbol", "panggang": "beef", "masak": "cooking-pot", "potong": "axe", "angkat": "package", "taruh": "package-open", "renang": "waves", "ambilkayu": "flame-kindling", "kayu": "flame-kindling", "hangat": "flame", "marshmallow": "lollipop", "ciprat": "droplets", "_": "pointer"};
  const NS = 'http://www.w3.org/2000/svg';
  const RE = new RegExp('(' + Object.keys(PETA).sort((a, b) => b.length - a.length).join('|') + ')\\uFE0F?', 'gu');
  const ada = t => { RE.lastIndex = 0; return typeof t === 'string' && RE.test(t); };
  const polos = t => t.replace(RE, '').replace(/[ \t]{2,}/g, ' ').trim();
  const sentuh = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  document.documentElement.classList.toggle('sentuh', sentuh);

  /* ---------- sprite & ikon ---------- */
  const defs = document.querySelector('svg > defs');
  if (defs) defs.insertAdjacentHTML('beforeend', Object.entries(IKON).map(([k, v]) => '<symbol id="l-' + k + '" viewBox="0 0 24 24">' + v + '</symbol>').join(''));
  function ikon(n, tambahan) {
    const s = document.createElementNS(NS, 'svg'); s.setAttribute('class', 'ik ik-e ik-' + n + (tambahan ? ' ' + tambahan : '')); s.setAttribute('aria-hidden', 'true');
    const u = document.createElementNS(NS, 'use'); u.setAttribute('href', '#l-' + n); s.appendChild(u); return s;
  }

  /* ---------- emoji → ikon di DOM ---------- */
  const LEWATI = /^(SCRIPT|STYLE|TEXTAREA|CANVAS|INPUT|SVG|USE|SYMBOL|DEFS|MODEL-VIEWER)$/i, POLOS = /^(OPTION|OPTGROUP|TITLE)$/, ATR = ['title', 'aria-label', 'placeholder', 'alt'];
  const lewati = e => { for (let x = e; x && x !== document.body; x = x.parentElement) if (LEWATI.test(x.tagName) || x.hasAttribute('data-emoji')) return true; return false; };
  function teks(n) {
    const v = n.nodeValue; if (!ada(v)) return;
    const p = n.parentElement; if (!p || lewati(p)) return;
    if (POLOS.test(p.tagName)) { n.nodeValue = polos(v); return; }
    // emoji di awal / akhir teks → ikon; di tengah kalimat dibuang saja (kalimatnya tetap utuh untuk kamus terjemahan)
    const f = document.createDocumentFragment(), sisa = t => !t.replace(RE, '').trim();
    let i = 0, m, buf = '';
    const lepas = () => { if (buf) f.appendChild(document.createTextNode(buf.replace(/[ \t]{2,}/g, ' '))); buf = ''; };
    RE.lastIndex = 0; const hasil = [...v.matchAll(RE)];          // matchAll menyalin lastIndex sisa ada() — harus dari awal
    for (m of hasil) {
      buf += v.slice(i, m.index); i = m.index + m[0].length;
      if (sisa(v.slice(0, m.index)) || sisa(v.slice(i))) { lepas(); f.appendChild(ikon(PETA[m[1]])); }
    }
    buf += v.slice(i); lepas();
    p.replaceChild(f, n);
  }
  const atribut = e => { for (const a of ATR) { const v = e.getAttribute(a); if (ada(v)) e.setAttribute(a, polos(v)); } };
  function proses(r) {
    if (r.nodeType === 3) return teks(r);
    if (r.nodeType !== 1 || LEWATI.test(r.tagName) || r.hasAttribute('data-emoji')) return;
    atribut(r); for (const c of [...r.childNodes]) proses(c);
  }
  proses(document.body);
  if (ada(document.title)) document.title = polos(document.title);
  new MutationObserver(ms => { for (const m of ms) {
    if (m.type === 'characterData') teks(m.target);
    else if (m.type === 'attributes') { if (m.target.nodeType === 1) atribut(m.target); }
    else for (const n of m.addedNodes) proses(n);
  } }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATR });
  // dialog bawaan peramban tidak bisa memuat ikon
  for (const f of ['confirm', 'alert', 'prompt']) { const asli = window[f].bind(window); window[f] = (m, ...x) => asli(typeof m === 'string' ? polos(m) : m, ...x); }

  /* ---------- kamus terjemahan tanpa emoji ---------- */
  const K = window.KAMUS_EN;
  if (K) {
    const objek = o => { const r = {}; for (const [k, v] of Object.entries(o || {})) if (!ada(k)) r[k] = ada(v) ? polos(v) : v;
      for (const [k, v] of Object.entries(o || {})) { const p = polos(k); if (ada(k) && p && !(p in r)) r[p] = ada(v) ? polos(v) : v; } return r; };
    K.teks = objek(K.teks); K.frasa = objek(K.frasa);
    // pola regex: grup yang hanya berisi emoji ("(💢|😒) Netral") dibuang & nomor $n sesudahnya digeser; aturan yang tidak
    // menyisakan kata (mis. "⚠ (.+)" → "(.+)", cocok dengan apa saja & memanggil dirinya sendiri) dibuang; regex rusak dibuang
    const grupEmoji = new RegExp('\\((?:(?:' + Object.keys(PETA).join('|') + ')\\uFE0F?\\|?)+\\)\\s?', 'gu');
    const aturan = ([r, t]) => {
      if (!ada(r) && !ada(t)) return [r, t];
      const buang = [];
      const r2 = polos(r.replace(grupEmoji, (m, o, all) => { buang.push((all.slice(0, o).replace(/\\./g, '').match(/\((?!\?)/g) || []).length + 1); return ''; }));
      const t2 = polos(t.replace(/\$(\d+)\s?/g, (m, i) => buang.includes(+i) ? '' : m).replace(/\$(\d+)/g, (m, i) => '$' + (+i - buang.filter(b => b < +i).length)));
      if (!r2.replace(/\([^)]*\)/g, '').replace(/[\s^$]/g, '')) return null;           // tinggal grup saja: cocok dengan apa pun
      try { new RegExp(r2); } catch (e) { return null; }
      return [r2, t2];
    };
    for (const d of ['pola', 'frasaPola', 'ganti']) if (Array.isArray(K[d])) K[d] = K[d].map(aturan).filter(Boolean);
  }

  /* ---------- HUD mode jalan ---------- */
  const css = document.createElement('style');
  css.textContent = [
    '.ik-e{width:1.15em;height:1.15em;vertical-align:-.2em}',
    '.ik-heart,.ik-heart-handshake,.ik-hand-heart,.ik-heart-crack{color:#ff7a99}.ik-triangle-alert{color:#f3b544}.ik-flame,.ik-flame-kindling{color:#ff9a4a}.ik-star,.ik-sparkles{color:#f5c84c}',
    '#fpsAksiDok{position:absolute;z-index:36;display:flex;flex-direction:column-reverse;align-items:flex-end;gap:10px;pointer-events:none;' +
      'right:calc(max(16px,env(safe-area-inset-right)) + 6px);bottom:calc(max(14px,env(safe-area-inset-bottom)) + 92px)}',
    '#fpsAksiDok[hidden]{display:none}',
    '#fpsAksiDok #fpsAct{margin:0;pointer-events:auto;min-height:56px;padding:0 20px 0 15px;display:flex;align-items:center;gap:10px;font:650 .92rem/1 inherit;' +
      'border-radius:999px;border:0;color:#08201b;background:rgba(78,201,176,.95);box-shadow:0 6px 20px rgba(0,0,0,.35);backdrop-filter:none}',
    '#fpsAksiDok #fpsAct[hidden]{display:none}#fpsAksiDok #fpsAct .ik{width:24px;height:24px;stroke-width:2.1}',
    '#fpsAksiDok #fpsAksiLain{flex-direction:column;align-items:flex-end;margin:0;gap:8px}',
    '#fpsAksiDok .fps-aksi{min-height:46px;padding:0 16px 0 13px;display:flex;align-items:center;gap:8px;font:600 .84rem/1 inherit;background:rgba(18,20,24,.74);box-shadow:0 3px 12px rgba(0,0,0,.3)}',
    '#fpsAksiDok .fps-aksi .ik{width:20px;height:20px}',
    '#fpsAim .fps-aksi .ik,#fpsAim #fpsAct .ik{width:18px;height:18px;margin-right:6px;vertical-align:-.25em}',
    '#fpsbar.redup #fpsinfo{display:none}#fpsbar.redup{padding:6px;gap:6px}',
    '#fpsbar.redup{cursor:pointer}'
  ].join('\n');
  document.head.appendChild(css);

  const aim = document.getElementById('fpsAim'), act = document.getElementById('fpsAct'), lain = document.getElementById('fpsAksiLain');
  // ikon tombol mengikuti aksinya (data-j dari stepBidik): Berinteraksi tetap tertulis, gambarnya pintu / lampu / kursi …
  function hiasAksi() {
    if (act && act.dataset.j) { const n = AKSI[act.dataset.j] || AKSI._, u = act.querySelector('svg use');
      if (u && u.getAttribute('href') !== '#l-' + n) u.setAttribute('href', '#l-' + n); else if (!u && sentuh) act.prepend(ikon(n)); }
    if (lain) for (const b of lain.children) if (b.dataset.j && !b.querySelector('svg')) { const k = b.querySelector('kbd'); b.insertBefore(ikon(AKSI[b.dataset.j] || AKSI._), k ? k.nextSibling : b.firstChild); }
  }
  if (act && lain) {
    new MutationObserver(hiasAksi).observe(act, { childList: true, attributes: true, attributeFilter: ['data-j'] });
    new MutationObserver(hiasAksi).observe(lain, { childList: true });
    if (sentuh && aim) {
      const dok = document.createElement('div'); dok.id = 'fpsAksiDok'; dok.hidden = aim.hidden; dok.append(act, lain); aim.after(dok);
      new MutationObserver(() => { dok.hidden = aim.hidden; }).observe(aim, { attributes: true, attributeFilter: ['hidden'] });
    }
  }
  // bilah atas: keterangan cara bergerak meredup jadi ringkas (hanya lantai / keadaan) 6 dtk sesudah berubah; ketuk = tampil lagi
  const bar = document.getElementById('fpsbar'), info = document.getElementById('fpsinfo');
  if (bar && info) {
    let t = 0; const segar = () => { bar.classList.remove('redup'); clearTimeout(t); t = setTimeout(() => bar.classList.add('redup'), 6000); };
    new MutationObserver(segar).observe(info, { childList: true, characterData: true, subtree: true });
    bar.addEventListener('pointerdown', e => { if (bar.classList.contains('redup') && !e.target.closest('button,select')) segar(); });
    segar();
  }
  window.ANTARMUKA = { ikon, polos, ada, PETA, AKSI };
})();
