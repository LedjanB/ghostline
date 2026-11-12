# Opening V2 room props (wall clock, soft glow). The exterior and corridor are no longer painted here: they are
# the approved concepts (assets/reference/Ghostline_*_Concept_01.png), copied 1:1 into assets/opening-prelude/.
#   py scripts/prelude-art.py   -> assets/opening-prelude/room-clock.png, soft-glow.png
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

# ================================================================ ROOM PROPS (opening V2, over the Ward 4 plate)
# room-clock.png: a small wall clock, 3 frames of 40x17: 3:32, 3:33, dead (power cut). soft-glow.png: a white
# radial light, tinted in Phaser for the lamp, window, monitor and Milo's spirit.
SEG = {'3': 'abcdg', '2': 'abged'}
def clock_props():
    FW, FH = 40, 17
    sheet = np.zeros((FH, FW * 3, 4), np.float32)
    def seg_px(ch, ox, oy):
        on = SEG[ch]; px = []
        if 'a' in on: px += [(ox + i, oy) for i in range(1, 5)]
        if 'g' in on: px += [(ox + i, oy + 5) for i in range(1, 5)]
        if 'd' in on: px += [(ox + i, oy + 10) for i in range(1, 5)]
        if 'b' in on: px += [(ox + 5, oy + j) for j in range(1, 5)]
        if 'c' in on: px += [(ox + 5, oy + j) for j in range(6, 10)]
        if 'f' in on: px += [(ox, oy + j) for j in range(1, 5)]
        if 'e' in on: px += [(ox, oy + j) for j in range(6, 10)]
        return px
    for fi, digits in enumerate(('332', '333', None)):
        o = fi * FW
        sheet[:, o:o + FW, :3] = hexc('#1b1e26'); sheet[:, o:o + FW, 3] = 255
        sheet[0, o:o + FW, :3] = hexc('#4c5466'); sheet[-1, o:o + FW, :3] = hexc('#0b0d12')
        sheet[:, o, :3] = hexc('#2e3442'); sheet[:, o + FW - 1, :3] = hexc('#0b0d12')
        sheet[2:15, o + 2:o + FW - 2, :3] = hexc('#0d0708')
        ghost_on = hexc('#2a1012')
        cells = (o + 6, o + 17, o + 25)
        for cx in cells:   # unlit segments, barely there
            for (x, y) in seg_px_all(cx, 3): sheet[y, x, :3] = ghost_on
        if digits:
            col = hexc('#ff3b2e')
            for ch, cx in zip(digits, cells):
                for (x, y) in seg_px(ch, cx, 3): sheet[y, x, :3] = col
            for y in (6, 10): sheet[y, o + 14, :3] = col
    Image.fromarray(sheet.astype(np.uint8), 'RGBA').save(OUT / 'room-clock.png', optimize=True)
    g = np.linspace(-1, 1, 128); d2 = g[None, :] ** 2 + g[:, None] ** 2
    a = np.exp(-d2 * 4.5) * (d2 < 1)
    glow_ = np.zeros((128, 128, 4), np.float32); glow_[..., :3] = 255; glow_[..., 3] = a * 255
    Image.fromarray(glow_.astype(np.uint8), 'RGBA').save(OUT / 'soft-glow.png', optimize=True)
    print('clock + glow')
def seg_px_all(ox, oy):
    px = [(ox + i, oy + j) for j in (0, 5, 10) for i in range(1, 5)]
    px += [(ox + x, oy + j) for x in (0, 5) for j in list(range(1, 5)) + list(range(6, 10))]
    return px

if __name__ == '__main__':
    clock_props()
