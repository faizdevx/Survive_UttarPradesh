# Draws one share picture per assembly seat and per district, and shrinks the MLA photos.
# Run after build-reportcards.mjs: python scripts/build-cards.py
import json
import os
import re
from PIL import Image, ImageDraw, ImageFont, ImageOps

W, H = 1200, 630
WINE, GOLD, CREAM, DARK = (124, 17, 19), (246, 196, 0), (248, 236, 208), (61, 7, 8)
PARTY = {
    'BJP': ('BJP', '#F08A1D'), 'SP': ('Samajwadi Party', '#D3201F'), 'INC': ('Congress', '#1C8FD6'), 'RLD': ('RLD', '#1E7F3A'),
    'ADS': ('Apna Dal (S)', '#8C5AC8'), 'BSP': ('BSP', '#3E6FE0'), 'SBSP': ('SBSP', '#E8C91E'), 'NISHAD': ('NISHAD Party', '#12A5A0'),
    'JDL': ('Jansatta Dal (L)', '#B5651D'), 'Vacant': ('Vacant', '#777777'),
}
LONG = {'Apna Dal (Soneylal)': 'ADS', 'Suheldev Bharatiya Samaj Party': 'SBSP', 'Nirbal Indian Shoshit Hamara Aam Dal': 'NISHAD', 'Jansatta Dal Loktantrik': 'JDL'}
FONTS = 'C:/Windows/Fonts/'
impact = lambda n: ImageFont.truetype(FONTS + 'impact.ttf', n)
body = lambda n: ImageFont.truetype(FONTS + 'segoeuib.ttf', n)

seats = json.load(open('public/data/seats.json', encoding='utf8'))
party = lambda p: PARTY.get(LONG.get(p, p), (p, '#777777'))
slug = lambda s: re.sub(r'[^a-z0-9]+', '-', str(s).lower())


def money(n):
    # The display font has no rupee sign
    return f'Rs {n / 1e7:.1f} cr' if n >= 1e7 else f'Rs {n / 1e5:.1f} lakh'


def fit(draw, text, font, size, width):
    while draw.textlength(text, font=font(size)) > width and size > 24:
        size -= 2
    return font(size)


def frame():
    img = Image.new('RGB', (W, H), WINE)
    d = ImageDraw.Draw(img)
    d.rectangle([12, 12, W - 13, H - 13], outline=GOLD, width=5)
    return img, d


def tiles(d, items, x, y, width):
    w = (width - 16 * (len(items) - 1)) / len(items)
    for i, (label, value) in enumerate(items):
        left = x + i * (w + 16)
        d.rounded_rectangle([left, y, left + w, y + 132], 14, fill=DARK)
        d.text((left + 16, y + 14), label, font=body(21), fill=CREAM)
        d.text((left + 16, y + 52), value, font=fit(d, value, impact, 58, w - 30), fill=GOLD)


def save(img, name):
    # Drawn large for sharp text, stored smaller: 478 pictures ship with the site
    img.resize((900, 473), Image.LANCZOS).save(f'public/img/card/{name}.jpg', quality=62, optimize=True)


def footer(d, note, x=40):
    d.text((x, H - 76), note, font=body(19), fill=CREAM)
    d.text((x, H - 48), 'Survive Uttar Pradesh', font=impact(26), fill=GOLD)


os.makedirs('public/img/mla', exist_ok=True)
os.makedirs('public/img/card', exist_ok=True)
photos = 0
for name in os.listdir('data/mla-raw') if os.path.isdir('data/mla-raw') else []:
    try:
        # Affidavit photos come in every shape. The face sits high, so the crop favours the top.
        raw = Image.open(f'data/mla-raw/{name}').convert('RGB')
        ImageOps.fit(raw, (240, 300), centering=(0.5, 0.25)).save(f'public/img/mla/{name}', quality=80)
        photos += 1
    except Exception as err:  # a broken download must not stop the run
        print('skipped photo', name, err)

for s in seats.values():
    m = s['mla']
    pname, colour = party(m['party'])
    img, d = frame()
    d.rectangle([12, 12, 40, H - 13], fill=colour)
    d.text((70, 38), 'VIDHAYAK REPORT CARD', font=impact(40), fill=GOLD)
    place = f"Seat {s['no']}, {s['district']}"
    d.text((W - 40 - d.textlength(place, font=body(24)), 48), place, font=body(24), fill=CREAM)

    path = f"public/img/mla/{m.get('id')}.jpg"
    x = 70
    if m.get('id') and os.path.exists(path):
        d.rectangle([66, 106, 314, 414], fill=CREAM)
        img.paste(Image.open(path), (70, 110))
        x = 350
    d.text((x, 112), m['name'].upper(), font=fit(d, m['name'].upper(), impact, 84, W - x - 50), fill=CREAM)
    d.text((x, 214), f"{pname}. MLA for {s['name']}.", font=fit(d, f"{pname}. MLA for {s['name']}.", body, 32, W - x - 50), fill=CREAM)

    items = []
    if m.get('cases') is not None:
        items += [('Declared cases', str(m['cases']))]
        if m.get('assets'):
            items += [('Declared assets', money(m['assets']))]
    if not m.get('bye') and not m.get('vacant'):
        items += [('Won 2022 by, votes', f"{s['margin']:,}"), ('Share of votes', f"{s['pct']}%")]
    if items:
        tiles(d, items, x, 282, W - x - 50)
    else:
        d.text((x, 300), 'Won a bye-election after 2022.' if m.get('bye') else 'This seat is vacant.', font=body(34), fill=GOLD)
    d.text((70, 448), 'Apne vidhayak ka report card dekho', font=impact(46), fill=GOLD)
    footer(d, "From the MLA's own 2022 affidavit (ADR, MyNeta) and the Election Commission count. A declared case is not a conviction.", 70)
    save(img, f"seat-{s['no']}")

districts = {}
for s in seats.values():
    districts.setdefault(s['district'], []).append(s)
for name, group in districts.items():
    img, d = frame()
    d.text((40, 38), 'UTTAR PRADESH, DISTRICT BY DISTRICT', font=impact(34), fill=GOLD)
    d.text((40, 84), name.upper(), font=fit(d, name.upper(), impact, 150, W - 80), fill=CREAM)
    counts = {}
    for s in group:
        key = LONG.get(s['mla']['party'], s['mla']['party'])
        counts[key] = counts.get(key, 0) + 1
    x = 40
    for key, n in sorted(counts.items(), key=lambda kv: -kv[1]):
        w = (W - 80) * n / len(group)
        d.rectangle([x, 262, x + w, 300], fill=party(key)[1])
        x += w
    line = ', '.join(f'{party(k)[0]} {n}' for k, n in sorted(counts.items(), key=lambda kv: -kv[1]))
    d.text((40, 310), f'{len(group)} MLAs: {line}', font=fit(d, f'{len(group)} MLAs: {line}', body, 30, W - 80), fill=CREAM)
    known = [s['mla'] for s in group if s['mla'].get('cases') is not None]
    rich = max((m for m in known if m.get('assets')), key=lambda m: m['assets'], default=None)
    close = min(group, key=lambda s: s['margin'])
    items = [('MLAs with a declared case', f"{sum(1 for m in known if m['cases'])} of {len(known)}")]
    if rich:
        items.append(('Richest MLA, declared', money(rich['assets'])))
    items.append((f"Closest seat 2022: {close['name']}", f"{close['margin']:,} votes"))
    tiles(d, items, 40, 372, W - 80)
    footer(d, 'From 2022 affidavits (ADR, MyNeta) and the Election Commission count. A declared case is not a conviction.')
    save(img, f'city-{slug(name)}')

size = sum(os.path.getsize(f'public/img/card/{f}') for f in os.listdir('public/img/card'))
print({'photos': photos, 'seatCards': len(seats), 'districtCards': len(districts), 'cardsMB': round(size / 1e6, 1)})
