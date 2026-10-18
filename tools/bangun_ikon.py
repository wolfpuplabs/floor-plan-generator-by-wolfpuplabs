#!/usr/bin/env python3
"""Bangun modul/antarmuka.js (JEV-126) dari tools/antarmuka_templat.js.in + ikon Lucide.

Ikon diambil dari paket npm lucide-static (lisensi ISC). Cara memakai, dari akar repo:
    mkdir -p /tmp/lucide && (cd /tmp/lucide && npm pack lucide-static@1.59.0 && tar xzf lucide-static-*.tgz)
    python3 tools/bangun_ikon.py /tmp/lucide/package
PETA: emoji yang dipakai di teks UI -> nama ikon Lucide. AKSI: jenis aksi bidikan mode jalan -> ikon.
Hanya ikon yang dipakai yang ikut masuk ke modul.
"""
import json, os, re, sys

PETA = {
 '💞':'heart-handshake','🔥':'flame','⚠':'triangle-alert','🎲':'dices','🪑':'armchair','🍳':'cooking-pot','💡':'lightbulb','💕':'heart','🫶':'hand-heart',
 '🍽':'utensils','🪵':'flame-kindling','😊':'smile','✌':'hand-metal','🛏':'bed-double','🪨':'mountain','🛋':'sofa','🍢':'lollipop','🗄':'archive',
 '📺':'tv','🪞':'scan-face','🌳':'tree-deciduous','❤':'heart','👋':'hand','🤗':'heart-handshake','🤝':'handshake','😘':'heart','🚪':'door-open',
 '🪴':'sprout','🖼':'image','🌿':'leaf','🎸':'guitar','🪓':'axe','🍡':'candy','🐟':'fish','👤':'user','💃':'music','😴':'moon','💁':'user-round-check',
 '🟫':'square','🧱':'brick-wall','🚿':'shower-head','📚':'library','🌴':'tree-palm','🪟':'app-window','🥚':'egg','🎹':'piano','🎠':'ferris-wheel',
 '🌙':'moon','💛':'heart','🏊':'waves','💦':'droplets','🌟':'sparkles','🎣':'fish-symbol','📦':'package','💔':'heart-crack','🎁':'gift','🎯':'target',
 '💐':'flower','💗':'heart','😤':'angry','⭐':'star','🧘':'person-standing','💺':'armchair','🧊':'refrigerator','🚰':'droplet','🚽':'toilet','🪥':'brush',
 '🛁':'bath','💻':'laptop','🧸':'toy-brick','🗃':'archive','💄':'sparkles','🥤':'cup-soda','🧺':'shopping-basket','🗂':'folder-open','❄':'snowflake',
 '🚗':'car','🏍':'bike','🕰':'clock','🎚':'sliders-horizontal','🕯':'flame','🌱':'sprout','🌵':'leaf','🫧':'droplets','🟥':'square','👟':'footprints',
 '🥫':'package','💨':'wind','🟤':'circle','🌲':'tree-pine','🌷':'flower-2','🌼':'flower','🏮':'lamp','⛩':'landmark','🏗':'construction','🏖':'umbrella',
 '⛱':'umbrella','⛲':'droplets','🌾':'wheat','⚫':'circle','⚪':'circle','🔺':'triangle','🧥':'shirt','🏺':'amphora','💿':'disc-3','📼':'cassette-tape',
 '🎵':'music','📐':'ruler','🪜':'door-stairwell','🔃':'refresh-cw','🔄':'refresh-cw','🌀':'tornado','🏕':'tent','🔊':'volume-2','📷':'camera','🎞':'film',
 '🧵':'scissors','👜':'shopping-bag','🔩':'nut','🌅':'sunrise','☀':'sun','🌇':'sunset','📁':'folder','🏞':'mountain-snow','📍':'map-pin','🥾':'footprints',
 '🌽':'wheat','🌭':'utensils','🌤':'cloud-sun','⛈':'cloud-lightning','🌦':'cloud-sun-rain','🌧':'cloud-rain','💢':'angry','😒':'meh','🙂':'smile',
 '💖':'heart','💬':'message-circle','🗣':'megaphone','🔇':'volume-x','👍':'thumbs-up','❓':'circle-question-mark','🏠':'house','🚶':'footprints','🫂':'heart-handshake',
 '💤':'moon','🎈':'party-popper','⌨':'keyboard','📸':'camera','🩺':'stethoscope','👁':'eye','👆':'pointer',
}
AKSI = {'bukaan':'door-open','lampu':'lightbulb','api':'flame','tv':'tv','gorden':'blinds','audio':'music','detail':'info','sapa':'hand','ngobrol':'message-circle',
 'lepas':'hand-helping','baring':'bed-double','bunyi':'volume-2','anim':'play','musik':'music','piano':'piano','gitar':'guitar','pindah':'log-in','duduk':'armchair',
 'berdiri':'person-standing','mancing':'fish-symbol','panggang':'beef','masak':'cooking-pot','potong':'axe','angkat':'package','taruh':'package-open','renang':'waves',
 'ambilkayu':'flame-kindling','kayu':'flame-kindling','hangat':'flame','marshmallow':'lollipop','ciprat':'droplets','_':'pointer'}

def isi_svg(path):
    s = open(path, encoding='utf-8').read()
    s = re.sub(r'<!--.*?-->', '', s, flags=re.S)
    m = re.search(r'<svg[^>]*>(.*)</svg>', s, flags=re.S)
    return re.sub(r'\s+', ' ', m.group(1)).replace('> <', '><').replace(' />', '/>').strip()

def main():
    pkg = sys.argv[1] if len(sys.argv) > 1 else '/tmp/lucide/package'
    versi = json.load(open(os.path.join(pkg, 'package.json')))['version']
    akar = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    nama = sorted(set(PETA.values()) | set(AKSI.values()))
    ikon = {n: isi_svg(os.path.join(pkg, 'icons', n + '.svg')) for n in nama}
    peta = {k: v for k, v in PETA.items()}
    t = open(os.path.join(akar, 'tools', 'antarmuka_templat.js.in'), encoding='utf-8').read()
    t = t.replace('@@VERSI@@', versi)
    t = t.replace('@@LISENSI@@', open(os.path.join(pkg, 'LICENSE'), encoding='utf-8').read().strip().replace('*/', '* /'))
    t = t.replace('@@IKON@@', json.dumps(ikon, ensure_ascii=False, indent=1).replace('\n', '\n  '))
    t = t.replace('@@PETA@@', json.dumps(peta, ensure_ascii=False))
    t = t.replace('@@AKSI@@', json.dumps(AKSI, ensure_ascii=False))
    open(os.path.join(akar, 'modul', 'antarmuka.js'), 'w', encoding='utf-8').write(t)
    print('modul/antarmuka.js:', len(ikon), 'ikon,', len(peta), 'emoji,', len(t.encode()), 'B')

if __name__ == '__main__':
    main()
