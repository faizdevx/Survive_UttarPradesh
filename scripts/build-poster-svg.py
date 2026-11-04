# Draws the skyline, header silhouettes, mandala and border band for the map page.
import random

OUT = 'public/img/poster/'
random.seed(1857)


def building(x, w, h, base, wall, shade):
    top = base - h
    parts = [f'<rect x="{x}" y="{top}" width="{w}" height="{h}" fill="{wall}"/>',
             f'<rect x="{x - 2}" y="{top - 3}" width="{w + 4}" height="4" fill="{shade}"/>']
    cols = max(1, w // 15)
    for row in range(max(1, h // 26)):
        for c in range(cols):
            ax = x + (c + .5) * w / cols
            ay = top + 22 + row * 26
            parts.append(f'<path d="M{ax - 4:.1f} {ay}v-9a4 5 0 0 1 8 0v9z" fill="{shade}"/>')
    kind = random.choice(['dome', 'chhatri', 'flat', 'dome', 'shikhar'])
    mid = x + w / 2
    if kind == 'dome':
        r = w * .32
        parts.append(f'<path d="M{mid - r:.1f} {top}c0-{r * 1.2:.1f} {r * .8:.1f}-{r * 1.1:.1f} {r:.1f}-{r * 1.9:.1f}c{r * .2:.1f} {r * .8:.1f} {r:.1f} {r * .7:.1f} {r:.1f} {r * 1.9:.1f}z" fill="#f4dfae"/>')
    elif kind == 'chhatri':
        for cx in (x + w * .22, x + w * .78):
            parts.append(f'<path d="M{cx - 7:.1f} {top}v-8h14v8zM{cx - 10:.1f} {top - 8}q10-13 20 0z" fill="#f4dfae"/>')
    elif kind == 'shikhar':
        parts.append(f'<path d="M{mid - w * .24:.1f} {top}q{w * .12:.1f}-{h * .35:.1f} {w * .24:.1f}-{h * .55:.1f}q{w * .12:.1f} {h * .2:.1f} {w * .24:.1f} {h * .55:.1f}z" fill="#e6a34a"/>')
    return ''.join(parts)


walls = ['#e9c98d', '#d99c55', '#c9743c', '#f0d6a2', '#b9552f', '#e2b26a']
back, front, x = [], [], -10
while x < 1600:
    w = random.randint(38, 92)
    back.append(building(x, w, random.randint(44, 84), 130, '#a8552c', '#7d3419'))
    x += w - 4
x = -20
while x < 1600:
    w = random.randint(46, 110)
    front.append(building(x, w, random.randint(26, 58), 130, random.choice(walls), '#6e2a14'))
    x += w
steps = ''.join(f'<rect x="0" y="{112 + i * 6}" width="1600" height="6" fill="{c}"/>' for i, c in enumerate(['#f0d6a2', '#d9a860', '#b8783c']))
open(OUT + 'skyline.svg', 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 130" width="1600" height="130">{"".join(back)}{"".join(front)}{steps}</svg>')

CREAM = '#f6e2b5'


def minaret(x, h):
    return f'<path d="M{x - 3} 96v-{h}h6v{h}zM{x - 6} {96 - h}q6-14 12 0z"/>'


taj = (f'<g fill="{CREAM}">{minaret(16, 44)}{minaret(52, 50)}{minaret(190, 50)}{minaret(226, 44)}'
       '<path d="M64 96V58h114v38z"/><path d="M96 58c0-20 18-22 25-38 7 16 25 18 25 38z"/><path d="M119 20l2-12 2 12z"/>'
       '<path d="M70 58q7-14 14 0zM158 58q7-14 14 0z"/><path d="M0 96h242v8H0z"/></g>'
       '<g fill="#8e1414"><path d="M106 96V76q15-18 30 0v20z"/><path d="M76 96V80q6-8 12 0v16zM154 96V80q6-8 12 0v16z"/></g>')
open(OUT + 'taj.svg', 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 242 104">{taj}</svg>')

palace = [f'<g fill="{CREAM}"><path d="M0 96h340v8H0z"/>']
cuts = []
x = 4
for w, h in [(46, 28), (38, 44), (64, 58), (34, 36), (52, 48), (40, 30), (58, 40)]:
    palace.append(f'<path d="M{x} 96v-{h}h{w}v{h}z"/><path d="M{x + 4} {96 - h}q{w / 2 - 4} -{w * .62:.0f} {w - 8} 0z"/>')
    for i in range(w // 13):
        ax = x + 8 + i * 13
        cuts.append(f'<path d="M{ax} 92v-11q3-6 6 0v11z"/>')
    x += w + 2
svg = ''.join(palace) + '</g><g fill="#8e1414">' + ''.join(cuts) + '</g>'
open(OUT + 'palace.svg', 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 104">{svg}</svg>')


def ring(r, n, length, width):
    out = []
    for i in range(n):
        a = 360 * i / n
        out.append(f'<path transform="rotate({a:.2f} 130 130)" d="M130 {130 - r}q{width} -{length / 2} 0 -{length}q-{width} {length / 2} 0 {length}z"/>')
    return ''.join(out)


mandala = ''.join([ring(16, 8, 18, 7), ring(38, 12, 24, 9), ring(66, 16, 28, 9), ring(98, 24, 22, 6)])
circles = ''.join(f'<circle cx="130" cy="130" r="{r}"/>' for r in (14, 36, 64, 96, 124))
open(OUT + 'mandala.svg', 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 260" width="260" height="260"><g fill="none" stroke="#c23a2a" stroke-width="1.6" opacity=".55">{mandala}{circles}</g></svg>')

open(OUT + 'band.svg', 'w').write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 14" width="36" height="14"><rect width="36" height="14" fill="#6d0f10"/><rect width="36" height="2" fill="#e9b949"/><rect y="12" width="36" height="2" fill="#e9b949"/><path d="M9 3l4 4-4 4-4-4z" fill="#f6d27a"/><circle cx="27" cy="7" r="2.4" fill="#e9b949"/><circle cx="18" cy="7" r="1.1" fill="#f6d27a"/></svg>')
