# Opening prelude art: St. Mercy at night in the rain, and the empty corridor to Ward 4.
#   py scripts/prelude-art.py [exterior|corridor]   -> assets/opening-prelude/*.png
# Painted at 3x and reduced, so edges and light fall-off come out soft like the Ward 4 plate; then a light grain.
# Palette = the approved Ward 4 sheet: near-black navy, slate blues, pale blue, one warm lamp orange, exit red.
# Rain is not painted in: it is a Phaser layer (src/scenes/prelude.js), so it moves.
import sys, math
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'opening-prelude'
OUT.mkdir(parents=True, exist_ok=True)
S = 3
rng = np.random.default_rng(333)

def hexc(h): return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32)

# ---------------------------------------------------------------- shared helpers
def fbm(h, w, scale, octaves=4, seed=0):
    r = np.random.default_rng(seed)
    out = np.zeros((h, w), np.float32); amp = 1.0; tot = 0
    for o in range(octaves):
        s = max(1, int(scale / 2 ** o))
        gh, gw = h // s + 2, w // s + 2
        g = r.random((gh, gw)).astype(np.float32)
        img = Image.fromarray((g * 255).astype(np.uint8)).resize((gw * s, gh * s), Image.BICUBIC)
        out += np.asarray(img, np.float32)[:h, :w] / 255 * amp
        tot += amp; amp *= 0.5
    return out / tot

def glow(buf, x, y, r, col, k=1.0):
    """additive soft light (gaussian-ish), coords in final px"""
    h, w = buf.shape[:2]
    X, Y = x * S, y * S; R = r * S
    x0, x1 = int(max(0, X - 3 * R)), int(min(w, X + 3 * R)); y0, y1 = int(max(0, Y - 3 * R)), int(min(h, Y + 3 * R))
    if x0 >= x1 or y0 >= y1: return
    yy, xx = np.mgrid[y0:y1, x0:x1]
    d2 = ((xx - X) ** 2 + (yy - Y) ** 2) / (R * R)
    buf[y0:y1, x0:x1] += np.exp(-d2)[..., None] * np.asarray(col, np.float32) * k

def finish(hi, grain=2.2, levels=None):
    img = Image.fromarray(np.clip(hi, 0, 255).astype(np.uint8)).reduce(S)
    a = np.asarray(img, np.float32)
    a += rng.normal(0, grain, a.shape[:2])[..., None]
    return Image.fromarray(np.clip(np.round(a), 0, 255).astype(np.uint8))

# tiny pixel font (5 rows) for carved / painted lettering
FONT = {
    'S': ['111', '100', '111', '001', '111'], 'T': ['111', '010', '010', '010', '010'], '.': ['0', '0', '0', '0', '1'],
    'M': ['10001', '11011', '10101', '10001', '10001'], 'E': ['111', '100', '110', '100', '111'],
    'R': ['110', '101', '110', '101', '101'], 'C': ['111', '100', '100', '100', '111'], 'Y': ['101', '101', '010', '010', '010'],
    'H': ['101', '101', '111', '101', '101'], 'O': ['111', '101', '101', '101', '111'], 'P': ['111', '101', '111', '100', '100'],
    'I': ['1', '1', '1', '1', '1'], 'A': ['010', '101', '111', '101', '101'], 'L': ['100', '100', '100', '100', '111'],
    'W': ['10001', '10001', '10101', '11011', '10001'], 'D': ['110', '101', '101', '101', '110'], '4': ['101', '101', '111', '001', '001'],
    ' ': ['00', '00', '00', '00', '00'], 'X': ['101', '101', '010', '101', '101'],
}
def text_w(s): return sum(len(FONT[c][0]) + 1 for c in s) - 1
def draw_text(arr, s, x, y, col, px=1):
    """write into a final-res RGB float array (after reduce)"""
    cx = x
    for c in s:
        g = FONT[c]
        for j, row in enumerate(g):
            for i, b in enumerate(row):
                if b == '1':
                    arr[y + j * px:y + (j + 1) * px, cx + i * px:cx + (i + 1) * px] = col
        cx += (len(g[0]) + 1) * px

# ================================================================ EXTERIOR
def exterior():
    W, H = 720, 400
    w, h = W * S, H * S
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    fy = yy / S; fx = xx / S
    # ---- sky: navy, heavier at the top, a pale moon hidden in cloud upper right, town glow low
    top, hor = hexc('#060b17'), hexc('#1a2740')
    t = np.clip(fy / 300, 0, 1)[..., None]
    sky = top * (1 - t ** 1.4) + hor * t ** 1.4
    cl = fbm(h, w, 220 * S / 3, 5, 1)
    cl2 = fbm(h, w, 90 * S / 3, 4, 2)
    band = np.clip((cl * 0.75 + cl2 * 0.25 - 0.42) * 2.4, 0, 1)
    moon = np.exp(-(((fx - 590) / 120) ** 2 + ((fy - 52) / 70) ** 2))
    sky = sky + (band * (0.35 + 1.4 * moon))[..., None] * hexc('#2c3d5c') * 0.55
    sky += moon[..., None] * hexc('#3a4f74') * 0.55
    sky += np.exp(-(((fy - 300) / 60) ** 2))[..., None] * hexc('#1c2a36') * 0.5  # sodium-free town haze
    img = sky.astype(np.float32)

    def poly(pts, col, buf=None, alpha=1.0):
        m = Image.new('L', (w, h), 0)
        ImageDraw.Draw(m).polygon([(px * S, py * S) for px, py in pts], fill=255)
        a = np.asarray(m, np.float32)[..., None] / 255 * alpha
        b = img if buf is None else buf
        b[:] = b * (1 - a) + np.asarray(col, np.float32) * a
        return a[..., 0] > 0
    def rect(x0, y0, x1, y1, col, alpha=1.0):
        return poly([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], col, alpha=alpha)

    # ---- far hill with bare trees and two tiny house lights (Vigil asleep)
    hill = [(0, 262)] + [(x, 250 + 14 * math.sin(x / 70) + 6 * math.sin(x / 23 + 1)) for x in range(0, 721, 8)] + [(720, 340), (0, 340)]
    poly(hill, hexc('#0f1829'))
    trees = Image.new('L', (w, h), 0); td = ImageDraw.Draw(trees)
    r2 = np.random.default_rng(5)
    def branch(x, y, ang, ln, wd, d):
        if d == 0 or ln < 2: return
        x2, y2 = x + math.cos(ang) * ln, y - math.sin(ang) * ln
        td.line([(x * S, y * S), (x2 * S, y2 * S)], fill=255, width=max(1, int(wd * S)))
        for k in range(2 if d > 1 else 1):
            branch(x2, y2, ang + r2.uniform(-0.6, 0.6), ln * r2.uniform(0.6, 0.78), wd * 0.7, d - 1)
    for x in range(4, 720, 11):
        base = 252 + 14 * math.sin(x / 70) + 6 * math.sin(x / 23 + 1)
        if 290 < x < 690 and r2.random() < 0.7: continue  # mostly hidden behind the hospital anyway
        branch(x + r2.uniform(-4, 4), base + 2, math.pi / 2 + r2.uniform(-0.2, 0.2), r2.uniform(10, 22), 1.4, 5)
    ta = np.asarray(trees.filter(ImageFilter.GaussianBlur(0.6 * S / 3)), np.float32)[..., None] / 255
    img = img * (1 - ta * 0.85) + hexc('#0d1424') * ta * 0.85
    for (hx, hy) in ((58, 262), (214, 254)):
        rect(hx, hy, hx + 1.4, hy + 1.2, hexc('#d89a52'))
        glow(img, hx + 0.7, hy + 0.6, 3, hexc('#d89a52'), 0.18)

    # ---- the hospital ----
    STONE = hexc('#1f2738')
    stains = fbm(h, w, 6, 2, 77)
    stains = np.asarray(Image.fromarray((stains * 255).astype(np.uint8)).resize((w // 8, h), Image.BILINEAR).resize((w, h), Image.BILINEAR), np.float32) / 255
    def facade(x0, y0, x1, y1):
        """old brick/stone, courses every 3 px, lit faintly from the hidden moon (upper right)"""
        y0s, y1s, x0s, x1s = int(y0 * S), int(y1 * S), int(x0 * S), int(x1 * S)
        sub_y = fy[y0s:y1s, x0s:x1s]; sub_x = fx[y0s:y1s, x0s:x1s]
        n = fbm(y1s - y0s, x1s - x0s, 30, 3, int(x0 + y0))
        course = ((sub_y % 3) < 0.4).astype(np.float32)
        brick = ((sub_x + (np.floor(sub_y / 3) % 2) * 3.5) % 7 < 0.35).astype(np.float32)
        v = 0.86 + 0.22 * n - 0.16 * course - 0.1 * brick
        v *= 1.0 + 0.18 * np.clip((sub_x - x0) / max(1, x1 - x0), 0, 1)        # moonward side brighter
        v *= 1.1 - 0.35 * np.clip((sub_y - y0) / max(1, y1 - y0), 0, 1)        # wet, darker toward the street
        v *= 0.82 + 0.3 * stains[y0s:y1s, x0s:x1s]                              # rain run-off streaks
        img[y0s:y1s, x0s:x1s] = STONE * v[..., None]

    def cornice(x0, x1, y, depth=3):
        rect(x0 - 2, y, x1 + 2, y + depth, hexc('#323d55'))
        rect(x0 - 2, y, x1 + 2, y + 0.7, hexc('#55688c'))           # wet top edge catching sky light
        rect(x0 - 2, y + depth, x1 + 2, y + depth + 1.2, hexc('#121827'))  # shadow under it

    lit_windows = []
    def window(x, y, ww=12, wh=22, state='dark', arch=True):
        # stone surround
        rect(x - 2, y - 2, x + ww + 2, y + wh + 3, hexc('#3a465e'))
        rect(x - 2, y + wh + 1, x + ww + 2, y + wh + 3, hexc('#56678a'))    # sill
        rect(x - 2, y + wh + 3, x + ww + 2, y + wh + 4, hexc('#10151f'))    # sill shadow
        if arch:
            poly([(x - 2, y + 2), (x + ww / 2, y - 5), (x + ww + 2, y + 2)], hexc('#3a465e'))
            poly([(x, y + 1), (x + ww / 2, y - 3), (x + ww, y + 1)], hexc('#0b1220'))
        gx0, gy0 = int(x * S), int(y * S); gx1, gy1 = int((x + ww) * S), int((y + wh) * S)
        gy = (fy[gy0:gy1, gx0:gx1] - y) / wh
        gxv = (fx[gy0:gy1, gx0:gx1] - x) / ww
        if state == 'dark':
            glass = hexc('#0c1424') * (1 - gy[..., None]) + hexc('#1b2a45') * gy[..., None]   # sky reflected low
            refl = np.clip(1 - np.abs(gxv - 0.7 + gy * 0.4) * 6, 0, 1)
            glass = glass + refl[..., None] * hexc('#2b3e60') * 0.6
            blind = rng.random()
            if blind < 0.35:  # a blind half down, catching a little sky
                bl = (gy < 0.2 + blind).astype(np.float32)[..., None]
                glass = glass * (1 - bl) + hexc('#273349') * bl * (0.9 + 0.1 * np.sin(gy * 90)[..., None])
        elif state == 'cool':
            glass = hexc('#3f5a80') * (0.75 + 0.35 * (1 - gy[..., None])) + hexc('#8fa6c6') * np.exp(-((gxv - 0.5) ** 2) / 0.05)[..., None] * 0.25
            lit_windows.append((x + ww / 2, y + wh / 2, 'cool'))
        else:  # warm: Ward 4, Bed 7's lamp, curtain half drawn
            curtain = (gxv < 0.38).astype(np.float32)[..., None]
            glass = hexc('#f0a24a') * (0.55 + 0.6 * np.exp(-(((gxv - 0.62) ** 2) + ((gy - 0.62) ** 2)) / 0.08))[..., None]
            glass = glass * (1 - curtain) + hexc('#8a4e2a') * curtain * (0.8 + 0.2 * np.sin(gxv * 60)[..., None])
            lit_windows.append((x + ww / 2, y + wh / 2, 'warm'))
        img[gy0:gy1, gx0:gx1] = glass
        # mullions
        rect(x + ww / 2 - 0.6, y, x + ww / 2 + 0.6, y + wh, hexc('#0a0f19'))
        rect(x, y + wh * 0.42, x + ww, y + wh * 0.42 + 1.1, hexc('#0a0f19'))

    def mansard(x0, x1, ytop, ybase, dormers):
        poly([(x0 - 3, ybase), (x0 + 9, ytop), (x1 - 9, ytop), (x1 + 3, ybase)], hexc('#1a2132'))
        # slate courses
        y0s, y1s = int(ytop * S), int(ybase * S)
        sl = img[y0s:y1s, int((x0 - 3) * S):int((x1 + 3) * S)]
        rows = ((fy[y0s:y1s, int((x0 - 3) * S):int((x1 + 3) * S)] % 2.6) < 0.45)
        sl[rows] *= 0.78
        rect(x0 + 8, ytop - 1, x1 - 8, ytop, hexc('#5a6d92'))               # ridge catches the moon
        rect(x0 - 4, ybase, x1 + 4, ybase + 2, hexc('#2e3850'))
        for dx in dormers:
            poly([(dx - 7, ybase - 2), (dx - 7, ytop + 12), (dx, ytop + 4), (dx + 7, ytop + 12), (dx + 7, ybase - 2)], hexc('#252e42'))
            poly([(dx, ytop + 4), (dx + 7, ytop + 12), (dx + 8, ytop + 12), (dx, ytop + 3)], hexc('#5a6d92'))
            rect(dx - 4, ytop + 13, dx + 4, ybase - 4, hexc('#0c1322'))
            rect(dx - 0.5, ytop + 13, dx + 0.5, ybase - 4, hexc('#06090f'))

    # wings
    WL, WR = (64, 300), (480, 708)
    for (x0, x1) in (WL, WR):
        facade(x0, 170, x1, 322)
    facade(300, 126, 480, 322)
    # chimneys behind the roofs
    for cx in (110, 250, 520, 670):
        rect(cx, 118, cx + 9, 150, hexc('#1c2333')); rect(cx - 1, 116, cx + 10, 119, hexc('#2e3850'))
    mansard(*WL, 140, 170, [100, 160, 220, 270])
    mansard(*WR, 140, 170, [512, 566, 620, 676])
    # centre block: pediment roof + clock tower
    poly([(296, 126), (390, 96), (484, 126)], hexc('#1d2537'))
    poly([(300, 125), (390, 97.5), (390, 99.5), (302, 126)], hexc('#56698e'))
    facade(358, 52, 422, 126)
    cornice(358, 422, 50, 3); cornice(358, 422, 98, 2)
    # tower roof: steep slate spire with a little lantern and finial
    poly([(354, 50), (390, 12), (426, 50)], hexc('#171e2e'))
    poly([(390, 12), (426, 50), (423, 50), (390, 15)], hexc('#4f6288'))
    rect(388.6, 2, 391.4, 13, hexc('#2a3348')); rect(389.4, -2, 390.6, 3, hexc('#6c80a6'))
    # tower louvers
    for lx in (366, 404):
        rect(lx, 104, lx + 10, 121, hexc('#0b111d'))
        for ly in range(105, 121, 3): rect(lx, ly, lx + 10, ly + 1, hexc('#2a3448'))
    # the clock: dim, backlit face, stopped at 3:33 (it always has been)
    ccx, ccy, cr = 390, 76, 15
    m = Image.new('L', (w, h), 0); ImageDraw.Draw(m).ellipse([(ccx - cr - 3) * S, (ccy - cr - 3) * S, (ccx + cr + 3) * S, (ccy + cr + 3) * S], fill=255)
    a = np.asarray(m, np.float32)[..., None] / 255; img = img * (1 - a) + hexc('#3a465e') * a
    m = Image.new('L', (w, h), 0); ImageDraw.Draw(m).ellipse([(ccx - cr) * S, (ccy - cr) * S, (ccx + cr) * S, (ccy + cr) * S], fill=255)
    a = np.asarray(m, np.float32)[..., None] / 255
    d = np.sqrt((fx - ccx) ** 2 + (fy - ccy) ** 2)[..., None] / cr
    face = hexc('#a9b6c9') * (0.95 - 0.35 * d) + hexc('#6d7c95') * 0.1
    img = img * (1 - a) + face * a
    glow(img, ccx, ccy, 18, hexc('#7d93b8'), 0.12)
    cd = ImageDraw.Draw(m := Image.new('L', (w, h), 0))
    for k in range(12):
        an = k * math.pi / 6
        r0 = cr - (3 if k % 3 == 0 else 1.8)
        cd.line([((ccx + math.sin(an) * r0) * S, (ccy - math.cos(an) * r0) * S), ((ccx + math.sin(an) * (cr - 0.6)) * S, (ccy - math.cos(an) * (cr - 0.6)) * S)], fill=255, width=S if k % 3 else int(S * 1.4))
    hour = (3 + 33 / 60) * math.pi / 6; minute = 33 * math.pi / 30
    cd.line([(ccx * S, ccy * S), ((ccx + math.sin(hour) * 8) * S, (ccy - math.cos(hour) * 8) * S)], fill=255, width=int(S * 1.7))
    cd.line([(ccx * S, ccy * S), ((ccx + math.sin(minute) * 12.5) * S, (ccy - math.cos(minute) * 12.5) * S)], fill=255, width=int(S * 1.1))
    a = np.asarray(m, np.float32)[..., None] / 255; img = img * (1 - a * 0.9) + hexc('#141a26') * a * 0.9

    # floors: string courses + windows
    for (x0, x1) in (WL, WR):
        for yc in (204, 240, 276): cornice(x0, x1, yc, 2.5)
    for yc in (166, 204, 240, 276): cornice(300, 480, yc, 2.5)
    cornice(64, 300, 170, 2); cornice(480, 708, 170, 2)
    rows_w = (178, 213, 249, 284)
    warm_at, cool_at = ((WR, 1, 2),), {((WL, 2, 1)), ((WR, 3, 5)), ((WL, 0, 4))}
    for side in (WL, WR):
        xs = list(range(side[0] + 14, side[1] - 14, 30))
        for ri, yv in enumerate(rows_w):
            for ci, xv in enumerate(xs):
                st = 'warm' if (side, ri, ci) in [(WR, 1, 2)] else 'cool' if (side, ri, ci) in cool_at else 'dark'
                window(xv, yv, 12, 20 if ri < 3 else 18, st)
    for ri, yv in enumerate((136, 178, 213)):
        for ci, xv in enumerate((316, 346, 422, 452)):
            window(xv, yv, 12, 20, 'cool' if (ri, ci) == (1, 0) else 'dark')
    for (sx0, sx1) in ((288, 300), (480, 492)):
        sh = np.clip(1 - np.abs(fx - (300 if sx0 < 300 else 480)) / 12, 0, 1) * (fy > 166) * (fy < 322)
        img *= (1 - 0.35 * sh)[..., None]
    for dx in (66, 296, 484, 704):
        rect(dx, 168, dx + 1.6, 322, hexc('#0d121c')); rect(dx + 0.4, 168, dx + 0.9, 322, hexc('#3a4864'))
    # name band over the entrance
    rect(330, 236, 450, 250, hexc('#2f394e'))
    rect(330, 236, 450, 237, hexc('#5a6d92'))
    # entrance: arched doorway, glass doors lit low and cool, portico, steps
    poly([(362, 322), (362, 270), (390, 254), (418, 270), (418, 322)], hexc('#3a465e'))
    poly([(366, 320), (366, 272), (390, 259), (414, 272), (414, 320)], hexc('#33466a'))
    ex0, ey0 = int(366 * S), int(259 * S)
    sub = img[ey0:int(320 * S), ex0:int(414 * S)]
    gyv = (fy[ey0:int(320 * S), ex0:int(414 * S)] - 259) / 61
    sub *= (0.45 + 0.5 * gyv)[..., None]
    rect(389.4, 272, 390.6, 320, hexc('#0d1320'))
    for xv in (370, 400): rect(xv, 280, xv + 10, 281, hexc('#0d1320'))
    lit_windows.append((390, 300, 'door'))
    rect(352, 262, 428, 266, hexc('#2d3850')); rect(352, 262, 428, 263, hexc('#6a7fa6'))   # portico slab
    rect(354, 266, 357, 322, hexc('#323d55')); rect(423, 266, 426, 322, hexc('#323d55'))
    for k, sy in enumerate((316, 319, 322)):
        rect(356 - 3 * k, sy, 424 + 3 * k, sy + 3, hexc('#2c3548') * (1 + 0.15 * k))
        rect(356 - 3 * k, sy, 424 + 3 * k, sy + 0.6, hexc('#5c6f94'))
    # base plinth
    for (x0, x1) in ((64, 352), (428, 708)):
        rect(x0, 306, x1, 322, hexc('#1a2030')); rect(x0, 306, x1, 307, hexc('#3d4b66'))

    # ---- light: window glow on the wet stone, the warm one strongest
    for (lx, ly, kind) in lit_windows:
        if kind == 'warm':
            glow(img, lx, ly, 22, hexc('#f0a24a'), 0.32); glow(img, lx, ly, 8, hexc('#ffc27a'), 0.35)
        elif kind == 'door':
            glow(img, lx, ly, 26, hexc('#6f8fb8'), 0.16)
        else:
            glow(img, lx, ly, 14, hexc('#6f8fb8'), 0.16)

    # ---- ground: pavement and the wet street
    rect(0, 322, 720, 334, hexc('#1b2232'))
    rect(0, 322, 720, 323, hexc('#3e4c68'))
    rect(0, 334, 720, 400, hexc('#0a101c'))
    rect(0, 334, 720, 335.2, hexc('#252f44'))
    ys0 = int(334 * S)
    n = fbm(h - ys0, w, 40, 4, 9)
    img[ys0:] *= (0.85 + 0.35 * n)[..., None]
    # reflections: the facade mirrored into the wet street, broken by ripples
    src = np.asarray(Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).filter(ImageFilter.BoxBlur(S * 1.2)), np.float32)
    rows = h - ys0
    rr = np.clip((322 - np.arange(rows) / S * 2.0) * S, 0, h - 1).astype(int)   # y 334..400 sees y 322..190
    ref = src[rr].copy()
    shift = (np.sin(np.arange(rows) / (1.3 * S)) * 0.8 * S + np.sin(np.arange(rows) / (0.45 * S) + 1) * 0.6 * S).astype(int)
    for i in range(rows): ref[i] = np.roll(ref[i], shift[i], axis=0)
    import cv2  # wet asphalt smears a reflection downwards
    ref = cv2.GaussianBlur(ref, (0, 0), sigmaX=0.6 * S, sigmaY=5 * S)
    fall = np.exp(-np.arange(rows) / (45 * S))[:, None, None]
    bright = np.clip(ref - 45, 0, 255)
    img[ys0:] += bright * 0.8 * fall + ref * 0.1 * fall
    # puddles: the sky's pale patches
    pud = np.clip((fbm(rows, w, 70, 3, 13) - 0.55) * 5, 0, 1)
    img[ys0:] += pud[..., None] * hexc('#1c2944') * 0.3
    rect(0, 333, 720, 334, hexc('#06090f'))   # kerb shadow
    # street lamp, right: cold light, no warmth (the one warm light is Bed 7's)
    lx = 646
    rect(lx - 1.2, 236, lx + 1.2, 334, hexc('#0a0e17'))
    rect(lx - 4, 333, lx + 4, 336, hexc('#0a0e17'))
    poly([(lx - 1, 236), (lx + 10, 230), (lx + 11, 232), (lx + 1, 238)], hexc('#0a0e17'))
    poly([(lx + 6, 231), (lx + 16, 231), (lx + 14, 236), (lx + 8, 236)], hexc('#0d121c'))
    rect(lx + 8.5, 235.5, lx + 13.5, 237, hexc('#cfe0f5'))
    glow(img, lx + 11, 238, 12, hexc('#7fa0cc'), 0.4); glow(img, lx + 11, 238, 40, hexc('#3d5578'), 0.35)
    glow(img, lx + 11, 345, 18, hexc('#5a78a2'), 0.25)
    # iron railings along the front, a gap for the steps
    rail = Image.new('L', (w, h), 0); rd = ImageDraw.Draw(rail)
    for x0, x1 in ((0, 340), (440, 720)):
        rd.rectangle([x0 * S, 300 * S, x1 * S, 301.2 * S], fill=255)
        rd.rectangle([x0 * S, 318 * S, x1 * S, 319.2 * S], fill=255)
        for x in range(x0 + 2, x1, 6):
            rd.rectangle([x * S, 296 * S, (x + 1) * S, 334 * S], fill=255)
            rd.polygon([(x * S - S * 0.8, 296.5 * S), ((x + 0.5) * S, 292 * S), ((x + 1.8) * S, 296.5 * S)], fill=255)
    for px_ in (334, 440):
        rd.rectangle([px_ * S, 284 * S, (px_ + 8) * S, 334 * S], fill=255)
    ra = np.asarray(rail, np.float32)[..., None] / 255
    img = img * (1 - ra) + hexc('#070a12') * ra
    for px_ in (334, 440):
        rect(px_ - 1, 282, px_ + 9, 284.5, hexc('#2f3a52')); rect(px_ - 1, 282, px_ + 9, 282.8, hexc('#5c6f94'))
    # foreground tree, left: silhouette framing the shot
    tree = Image.new('L', (w, h), 0); td = ImageDraw.Draw(tree)
    r3 = np.random.default_rng(11)
    def br(x, y, ang, ln, wd, d):
        if d == 0: return
        x2, y2 = x + math.cos(ang) * ln, y - math.sin(ang) * ln
        td.line([(x * S, y * S), (x2 * S, y2 * S)], fill=255, width=max(1, int(wd * S)))
        td.ellipse([(x2 - wd / 2) * S, (y2 - wd / 2) * S, (x2 + wd / 2) * S, (y2 + wd / 2) * S], fill=255)
        n = 2 if d > 2 else r3.integers(1, 3)
        for _ in range(n):
            br(x2, y2, ang + r3.uniform(-0.75, 0.75), ln * r3.uniform(0.62, 0.8), wd * 0.66, d - 1)
    br(26, 402, math.pi / 2 - 0.05, 120, 13, 8)
    br(30, 300, math.pi / 2 - 0.9, 70, 6, 6)
    ta = np.asarray(tree.filter(ImageFilter.GaussianBlur(0.35 * S)), np.float32)[..., None] / 255
    img = img * (1 - ta) + hexc('#04070d') * ta
    # mist hugging the ground, and a vignette
    mist = fbm(h, w, 120 * S / 3, 4, 21)
    mz = np.exp(-(((fy - 316) / 26) ** 2)) * (0.4 + 0.8 * mist)
    img = img * (1 - mz[..., None] * 0.35) + hexc('#2a3a54') * mz[..., None] * 0.35
    vig = 1 - 0.45 * np.clip(((fx - 380) / 420) ** 2 + ((fy - 190) / 260) ** 2, 0, 1)
    img *= vig[..., None]
    out = finish(img)
    a = np.asarray(out, np.float32).copy()
    # carved name over the door, at 1 px so it stays crisp
    name = 'ST. MERCY HOSPITAL'
    draw_text(a, name, 390 - text_w(name) // 2, 241, hexc('#8792aa') * 0.78)
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(OUT / 'st-mercy-exterior.png', optimize=True)
    # drifting ground mist, tileable horizontally, for a slow Phaser layer
    MW, MH = 720, 90
    n = fbm(MH * S, MW * S, 60 * S / 3, 4, 31)
    n = (n + n[:, ::-1]) / 2                               # cheap horizontal tiling
    yv = np.linspace(-1, 1, MH * S)[:, None]
    al = np.clip((n - 0.38) * 2.2, 0, 1) * np.exp(-(yv / 0.55) ** 2) * 0.55
    rgba = np.zeros((MH * S, MW * S, 4), np.float32)
    rgba[..., :3] = hexc('#4a5f80'); rgba[..., 3] = al * 255
    Image.fromarray(rgba.astype(np.uint8), 'RGBA').reduce(S).save(OUT / 'st-mercy-mist.png', optimize=True)
    print('exterior', W, H)

# ================================================================ CORRIDOR
# A real one-point perspective: every pixel is a ray into a box corridor (walls, floor, ceiling, far wall),
# textured in its own surface coordinates and lit by point lights; the wet floor reflects the corridor (a ray
# into the mirrored box). Looking down to Ward 4's doors, warm light through the portholes (Bed 7's lamp).
def corridor():
    import cv2
    W, H = 680, 380
    w, h = W * S, H * S
    F, VX, VY = 230 * S, 340 * S, 166 * S
    HW, HF, HC, ZF = 1.6, 1.55, 1.45, 9.0      # half width, eye->floor, eye->ceiling, far wall depth
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32) + 0.5
    DX, DY = (xs - VX) / F, (ys - VY) / F
    INF = np.float32(1e9)

    def trace(dx, dy, mirror=False):
        zl = np.where(dx < 0, HW / np.maximum(-dx, 1e-9), INF)
        zr = np.where(dx > 0, HW / np.maximum(dx, 1e-9), INF)
        if not mirror:
            zf = np.where(dy > 0, HF / np.maximum(dy, 1e-9), INF)
            zc = np.where(dy < 0, HC / np.maximum(-dy, 1e-9), INF)
        else:  # the box mirrored in the floor: its ceiling lies 2HF+HC below the eye
            zf = np.full_like(dx, INF)
            zc = np.where(dy > 0, (2 * HF + HC) / np.maximum(dy, 1e-9), INF)
        st = np.stack([zl, zr, zf, zc, np.full_like(dx, ZF)])
        sid = np.argmin(st, 0); z = np.min(st, 0)
        X, Y = dx * z, dy * z
        if mirror: Y = 2 * HF - Y
        return sid, z, X, Y

    def noise2(u, v, sc, seed):
        r = np.random.default_rng(seed); g = r.random((64, 64)).astype(np.float32)
        g = cv2.GaussianBlur(g, (0, 0), 1.2)
        iu = (np.floor(u * sc).astype(int)) % 64; iv = (np.floor(v * sc).astype(int)) % 64
        return g[iv, iu]

    DOORS_R = [(2.0, 2.85), (4.4, 5.1), (6.6, 7.15)]
    WINS_L = [(2.4, 3.4), (5.0, 5.8)]
    FIXT = [(1.9, 'off'), (3.6, 'flicker'), (5.3, 'off'), (7.0, 'dim')]

    def shade(sid, X, Y, z, tube_on=True):
        n = sid.shape
        alb = np.zeros(n + (3,), np.float32); emi = np.zeros(n + (3,), np.float32)
        nrm = np.zeros(n + (3,), np.float32)
        hgt = HF - Y
        def put(m, col, target=alb):
            target[m] = col if np.ndim(col) == 1 else col[m]
        # ---- walls (0 left, 1 right)
        wall = (sid == 0) | (sid == 1)
        nrm[sid == 0] = (1, 0, 0); nrm[sid == 1] = (-1, 0, 0)
        plaster = hexc('#35404f') * (0.85 + 0.3 * noise2(z, hgt, 3, 1))[..., None] * (0.92 + 0.08 * noise2(z, hgt, 11, 2))[..., None]
        put(wall, plaster)
        tile = wall & (hgt < 1.25)
        tu, tv = (z / 0.22) % 1, (hgt / 0.22) % 1
        tcol = hexc('#24434f') * (0.9 + 0.2 * noise2(np.floor(z / 0.22), np.floor(hgt / 0.22), 1, 3))[..., None]
        grout = (tu < 0.06) | (tv < 0.06)
        put(tile, tcol); put(tile & grout, hexc('#15252d'))
        put(wall & (hgt >= 1.22) & (hgt < 1.28), hexc('#4a5f6c'))           # tile cap
        put(wall & (hgt < 0.12), hexc('#121820'))                           # skirting
        rail = wall & (hgt > 0.86) & (hgt < 0.95)
        # left wall windows: rainy night glass
        for (a, b) in WINS_L:
            m = (sid == 0) & (z > a) & (z < b) & (hgt > 0.95) & (hgt < 2.3)
            frame = m & ((z < a + 0.07) | (z > b - 0.07) | (hgt < 1.02) | (hgt > 2.23) | (np.abs(z - (a + b) / 2) < 0.025) | (np.abs(hgt - 1.75) < 0.03))
            glass = m & ~frame
            streak = noise2(z * 9, hgt * 0.7, 6, 4)
            g = (hexc('#16284a') * (0.6 + 0.6 * (hgt - 0.95)[..., None] / 1.35) + hexc('#3b5c8c') * np.clip(streak - 0.55, 0, 1)[..., None] * 1.6)
            put(glass, np.zeros(3), alb); put(glass, g, emi)
            put(frame, hexc('#1a2230'))
            rail &= ~m
        # right wall doors
        for (a, b) in DOORS_R:
            m = (sid == 1) & (z > a) & (z < b) & (hgt < 2.1)
            frame = m & ((z < a + 0.06) | (z > b - 0.06) | (hgt > 2.04))
            leaf = m & ~frame
            put(leaf, hexc('#2c3647') * (0.9 + 0.15 * noise2(z, hgt, 7, 5))[..., None])
            put(frame, hexc('#171d29'))
            c = (a + b) / 2
            win = leaf & (np.abs(z - c) < 0.12) & (hgt > 1.3) & (hgt < 1.75)
            put(win, hexc('#0b111c'))
            put(leaf & (np.abs(z - (b - 0.14)) < 0.03) & (np.abs(hgt - 1.0) < 0.03), hexc('#7d8ca3'))  # handle
            put(leaf & (np.abs(z - c) < 0.09) & (np.abs(hgt - 1.92) < 0.04), hexc('#5d6a80'))      # number plate
            rail &= ~m
        put(rail, hexc('#55657a')); put(rail & (hgt > 0.935), hexc('#7b8ca3'))
        # exit sign over the first door (right wall)
        ex = (sid == 1) & (z > 2.22) & (z < 2.63) & (hgt > 2.18) & (hgt < 2.36)
        # EXIT in the pixel font, laid out along the wall: 13 columns x 5 rows
        bits = np.array([[int(b) for c in 'EXIT' for b in FONT[c][r] + '0'][:-1] for r in range(5)], bool)
        col = ((2.59 - z) / (0.33 / bits.shape[1])).astype(int)  # right wall: z runs right to left
        row = ((2.33 - hgt) / (0.11 / 5)).astype(int)
        inside = (col >= 0) & (col < bits.shape[1]) & (row >= 0) & (row < 5)
        letters = np.zeros_like(inside); letters[inside] = bits[row[inside], col[inside]]
        put(ex, np.zeros(3)); put(ex, hexc('#c2392e') * 0.85, emi); put(ex & letters, hexc('#ffb0a0'), emi)
        # ---- floor
        fl = sid == 2
        nrm[fl] = (0, -1, 0)
        fu, fv = X / 0.5, z / 0.5
        chk = ((np.floor(fu) + np.floor(fv)) % 2 == 0)
        fcol = np.where(chk[..., None], hexc('#28303d'), hexc('#2f3847')) * (0.9 + 0.2 * noise2(X, z, 4, 6))[..., None]
        put(fl, fcol)
        put(fl & (((fu % 1) < 0.03) | ((fv % 1) < 0.03)), hexc('#171c25'))
        # ---- ceiling
        ce = sid == 3
        nrm[ce] = (0, 1, 0)
        cu, cv = (X / 0.6) % 1, (z / 0.6) % 1
        put(ce, hexc('#1f252e') * (0.9 + 0.2 * noise2(X, z, 5, 7))[..., None])
        put(ce & ((cu < 0.04) | (cv < 0.04)), hexc('#14181f'))
        for (zc, st) in FIXT:
            m = ce & (np.abs(X) < 0.3) & (np.abs(z - zc) < 0.42)
            put(m, hexc('#3b4352'))
            tube = m & (np.abs(X) < 0.22) & (np.abs(z - zc) < 0.36)
            on = st == 'dim' or (st == 'flicker' and tube_on)
            put(tube, hexc('#596173') if not on else np.zeros(3))
            if on: put(tube, hexc('#dbe8ff') * (0.55 if st == 'dim' else 1.0), emi)
        # ---- far wall: Ward 4's double doors, warm light through the portholes
        fw = sid == 4
        nrm[fw] = (0, 0, -1)
        put(fw, plaster)
        put(fw & (hgt < 1.25), hexc('#24434f')); put(fw & (hgt >= 1.22) & (hgt < 1.28), hexc('#4a5f6c'))
        dm = fw & (np.abs(X) < 0.78) & (hgt < 2.15)
        put(dm, hexc('#323e52') * (0.9 + 0.12 * noise2(X, hgt, 6, 8))[..., None])
        put(dm & ((np.abs(X) > 0.72) | (hgt > 2.09) | (np.abs(X) < 0.012)), hexc('#151b26'))
        put(dm & (np.abs(np.abs(X) - 0.38) < 0.13) & (np.abs(hgt - 1.0) < 0.05), hexc('#6d7a90'))  # push plates
        for sx in (-0.38, 0.38):
            r = np.sqrt((X - sx) ** 2 + (hgt - 1.5) ** 2)
            ring = dm & (r < 0.19); glassm = dm & (r < 0.15)
            put(ring, hexc('#1a202c'))
            put(glassm, np.zeros(3)); put(glassm, (hexc('#f0a24a') * (1.0 - 1.2 * r[..., None]) + hexc('#ffd59a') * np.exp(-(r / 0.06) ** 2)[..., None] * 0.6) * 0.9, emi)
        put(fw & (np.abs(X) < 0.7) & (hgt < 0.03), hexc('#d98a3c') * 0.8, emi)   # light under the doors
        return alb, emi, nrm

    LIGHTS = [  # x, y (down +), z, colour, intensity, range
        ((0, -HC + 0.08, 3.6), hexc('#a9c4ea'), 1.15, 1.7, 'tube'),
        ((0, -HC + 0.08, 7.0), hexc('#a9c4ea'), 0.55, 1.6, None),
        ((HW - 0.12, HF - 2.27, 2.42), hexc('#ff4a3a'), 0.55, 0.55, None),
        ((0, HF - 1.4, ZF - 0.35), hexc('#f0a24a'), 0.85, 1.25, None),
        ((-HW + 0.25, HF - 1.6, 2.9), hexc('#4a6a9a'), 0.45, 1.1, None),
        ((-HW + 0.25, HF - 1.6, 5.4), hexc('#4a6a9a'), 0.4, 1.1, None),
    ]
    AMB = hexc('#0e1522') / 255 * 2.8

    def lit(sid, X, Y, z, tube_on):
        alb, emi, nrm = shade(sid, X, Y, z, tube_on)
        P = np.stack([X, Y, z], -1)
        acc = np.zeros_like(alb) + AMB
        for (pos, col, I, R, tag) in LIGHTS:
            if tag == 'tube' and not tube_on: continue
            L = np.asarray(pos, np.float32) - P
            d = np.linalg.norm(L, axis=-1) + 1e-6
            lam = np.clip((L * nrm).sum(-1) / d, 0, 1) * 0.8 + 0.2
            acc += (col / 255)[None, None] * (I / (1 + (d / R) ** 2) * lam)[..., None]
        return alb * acc + emi

    def render(tube_on):
        sid, z, X, Y = trace(DX, DY)
        img = lit(sid, X, Y, z, tube_on)
        fl = sid == 2
        msid, mz, mX, mY = trace(DX, DY, mirror=True)
        refl = lit(msid, mX, mY, mz, tube_on)
        refl = cv2.GaussianBlur(refl, (0, 0), sigmaX=0.8 * S, sigmaY=3.5 * S)
        k = (0.22 + 0.4 * (1 - np.exp(-(z - 1.6) / 2.5)))[..., None]
        img = np.where(fl[..., None], img * (1 - k * 0.5) + refl * k, img)
        return img

    base = render(False)
    full = render(True)
    def post(img):
        bright = np.clip(img - 150, 0, None)
        img = img + cv2.GaussianBlur(bright, (0, 0), 6 * S) * 0.7 + cv2.GaussianBlur(bright, (0, 0), 2 * S) * 0.5
        yy2, xx2 = ys / S, xs / S
        vig = 1 - 0.5 * np.clip(((xx2 - 340) / 380) ** 2 + ((yy2 - 180) / 240) ** 2, 0, 1)
        return img * vig[..., None]
    pb, pf = post(base), post(full)
    out = np.asarray(finish(pb, grain=1.8), np.float32).copy()
    # hanging sign, flat to the camera: WARD 4
    zs = 4.5; f1 = F / S
    sx0, sx1 = 340 + f1 * -0.5 / zs, 340 + f1 * 0.5 / zs
    sy0, sy1 = 166 + f1 * (-HC + 0.3) / zs, 166 + f1 * (-HC + 0.55) / zs
    cy_top = 166 + f1 * -HC / zs
    for rx in (sx0 + 6, sx1 - 6):
        out[int(cy_top):int(sy0), int(rx):int(rx) + 1] = hexc('#3a4252')
    out[int(sy0):int(sy1), int(sx0):int(sx1)] = hexc('#1d2533')
    out[int(sy0), int(sx0):int(sx1)] = hexc('#56647c')
    out[int(sy1) - 1, int(sx0):int(sx1)] = hexc('#10141c')
    label = 'WARD 4'
    draw_text(out, label, int((sx0 + sx1) / 2 - text_w(label) / 2), int((sy0 + sy1) / 2 - 2), hexc('#b8c6dc') * 0.85)
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(OUT / 'ward4-corridor.png', optimize=True)
    # the middle tube's own light, for an additive flicker layer in Phaser
    diff = np.clip(pf - pb, 0, 255)
    Image.fromarray(diff.astype(np.uint8)).reduce(S).save(OUT / 'ward4-corridor-tube.png', optimize=True)
    print('corridor', W, H)

if __name__ == '__main__':
    which = sys.argv[1:] or ['exterior', 'corridor']
    if 'exterior' in which: exterior()
    if 'corridor' in which and 'corridor' in globals(): corridor()
