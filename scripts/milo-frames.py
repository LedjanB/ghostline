# Milo animation prototype V1: builds the sprite frames from the approved concept.
# py scripts/milo-frames.py  ->  assets/milo/milo-living.png, milo-ghost.png, milo-keys.png, frames.json
# Steps: 1. cut the six key poses out of assets/reference/milo-approved-concept.png (flood fill + closing,
# no rectangles), 2. area-downscale to game size (96 px tall), 3. one shared 40-colour palette,
# 4. derive in-between frames at game resolution (moved layers + hand-painted faces), 5. pack.
import json, os, sys
from collections import deque
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets/reference/milo-approved-concept.png')
OUT = os.path.join(ROOT, 'assets/milo')
DBG = sys.argv[1] if len(sys.argv) > 1 else None  # optional folder for key pose dumps
KEYS = ['idle', 'hands', 'reach', 'touch', 'recoil', 'fear']
TARGET_H = 92  # body height of the idle pose in game px (concept: "~92 px on screen")

# ---------------- 1. cut out ----------------
src = np.asarray(Image.open(SRC).convert('RGB')).astype(float)
row = src[755:990, 280:1020]          # the "Key Poses" row of the sheet
H, W, _ = row.shape
BG = np.array([14, 19, 28.])
dist = np.sqrt(((row - BG) ** 2).sum(2))

def shift(m, dy, dx):
    o = np.zeros_like(m)
    o[max(dy, 0):H + min(dy, 0), max(dx, 0):W + min(dx, 0)] = m[max(-dy, 0):H + min(-dy, 0), max(-dx, 0):W + min(-dx, 0)]
    return o

def dil(m, r):
    o = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dy * dy + dx * dx <= r * r:
                o |= shift(m, dy, dx)
    return o

def ero(m, r):
    return ~dil(~m, r)

core = dist >= 18
closed = ero(dil(core, 4), 4)          # closes gaps in dark hair
isbg = np.zeros((H, W), bool)
q = deque([(0, x) for x in range(W)] + [(H - 1, x) for x in range(W)] + [(y, 0) for y in range(H)] + [(y, W - 1) for y in range(H)])
while q:
    y, x = q.popleft()
    if y < 0 or x < 0 or y >= H or x >= W or isbg[y, x] or closed[y, x]:
        continue
    isbg[y, x] = True
    q.extend(((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)))
fg = ~isbg
fg &= ~((dist < 10) & ~ero(fg, 2))      # trim background-coloured rim
fg[224:] &= core[224:]                  # no floor shadow
FOOT = 226
cols = fg.any(0)
spans, inside = [], False
for x in range(W):
    if cols[x] and not inside:
        s, inside = x, True
    if not cols[x] and inside:
        spans.append((s, x)); inside = False
if inside:
    spans.append((s, W))
spans = [sp for sp in spans if sp[1] - sp[0] > 20]
assert len(spans) == 6, spans

# ---------------- 2. downscale + 3. palette ----------------
f = TARGET_H / 218.0
raw = {}
for nm, (a, b) in zip(KEYS, spans):
    a2, b2 = max(0, a - 4), min(W, b + 4)
    rgb = row[:FOOT + 2, a2:b2]; m = fg[:FOOT + 2, a2:b2].astype(float)
    h, w = m.shape
    nw, nh = round(w * f), round(h * f)
    P = np.asarray(Image.fromarray((rgb * m[..., None]).clip(0, 255).astype(np.uint8)).resize((nw, nh), Image.BOX)).astype(float)
    A = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).resize((nw, nh), Image.BOX)).astype(float) / 255
    out = np.zeros((nh, nw, 4), np.uint8)
    out[..., :3] = (P / np.maximum(A, 1e-3)[..., None]).clip(0, 255)
    al = A >= 0.45
    # drop dark navy fringe and specks
    c = out[..., :3].astype(float); dd = np.sqrt(((c - BG) ** 2).sum(2))
    for _ in range(2):
        inner = np.pad(al, 1)
        inner = inner[2:, 1:-1] & inner[:-2, 1:-1] & inner[1:-1, 2:] & inner[1:-1, :-2]
        al &= ~((al & ~inner) & (dd < 34) & (c[..., 2] >= c[..., 0] + 4))
    lab = np.zeros(al.shape, int); n = 0
    for y in range(nh):
        for x in range(nw):
            if al[y, x] and not lab[y, x]:
                n += 1; st = [(y, x)]; lab[y, x] = n; pts = []
                while st:
                    cy, cx = st.pop(); pts.append((cy, cx))
                    for ny in (cy - 1, cy, cy + 1):
                        for nx in (cx - 1, cx, cx + 1):
                            if 0 <= ny < nh and 0 <= nx < nw and al[ny, nx] and not lab[ny, nx]:
                                lab[ny, nx] = n; st.append((ny, nx))
                if len(pts) < 12:
                    for p in pts:
                        al[p] = False
    out[..., 3] = al * 255
    raw[nm] = out
stack = np.concatenate([raw[n][..., :3][raw[n][..., 3] > 0] for n in KEYS])
pal = Image.fromarray(stack.reshape(-1, 1, 3).astype(np.uint8)).quantize(colors=40, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
K = {}
for nm in KEYS:
    a = raw[nm]
    qd = np.asarray(Image.fromarray(a[..., :3]).quantize(palette=pal, dither=Image.Dither.NONE).convert('RGB'))
    K[nm] = np.dstack([qd, a[..., 3]]).astype(np.uint8)
    if DBG:
        Image.fromarray(K[nm]).save(os.path.join(DBG, f'key_{nm}.png'))

# ---------------- 4. frames ----------------
C = {'S': (186, 143, 121), 's': (144, 114, 107), 'h': (115, 84, 80), 'd': (81, 62, 65), 'e': (26, 25, 36),
     'w': (173, 180, 192), 'b': (52, 44, 53), 'r': (95, 77, 79), 't': (128, 174, 209), 'W': (214, 218, 226), 'H': (39, 35, 46), 'g': (64, 58, 71)}

def cp(a):
    return a.copy()

def paint(a, x0, y0, rows):
    """hand-painted pixels: '.' keeps the source, '_' clears, letters = colours in C"""
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch == '.':
                continue
            if ch == '_':
                a[y0 + j, x0 + i, 3] = 0; continue
            a[y0 + j, x0 + i, :3] = C[ch]; a[y0 + j, x0 + i, 3] = 255
    return a

def layer(a, box, dx, dy, clip=None, pick=None):
    """move the opaque pixels of a box by dx,dy (vacated = transparent); clip(x,y) hides pixels behind the body"""
    x0, y0, x1, y1 = box
    x1 = min(x1, a.shape[1]); y1 = min(y1, a.shape[0])
    part = a[y0:y1, x0:x1].copy()
    if pick:  # only move pixels the predicate picks (e.g. skin of a hand over the trousers)
        sel = np.array([[bool(part[y, x, 3]) and pick(part[y, x]) for x in range(part.shape[1])] for y in range(part.shape[0])])
        part[..., 3] = part[..., 3] * sel
        a[y0:y1, x0:x1, 3] = a[y0:y1, x0:x1, 3] * ~sel
    else:
        a[y0:y1, x0:x1, 3] = 0
    for y in range(part.shape[0]):
        for x in range(part.shape[1]):
            if part[y, x, 3]:
                tx, ty = x0 + x + dx, y0 + y + dy
                if clip and clip(tx, ty):
                    continue
                if 0 <= ty < a.shape[0] and 0 <= tx < a.shape[1]:
                    a[ty, tx] = part[y, x]
    return a

def band(a, y0, y1, dx, dy):
    return layer(a, (0, y0, a.shape[1], y1), dx, dy)

def head_swap(dst, src_, sbox, dpos, clear):
    cx0, cy0, cx1, cy1 = clear; dst[cy0:cy1, cx0:cx1, 3] = 0
    x0, y0, x1, y1 = sbox
    for y in range(y0, y1):
        for x in range(x0, x1):
            if src_[y, x, 3]:
                dst[dpos[1] + y - y0, dpos[0] + x - x0] = src_[y, x]
    return dst

exec(open(os.path.join(ROOT, 'scripts/milo-frames-acting.py')).read())
exec(open(os.path.join(ROOT, 'scripts/milo-frames-move.py')).read())

# ---------------- 5. pack ----------------
CW, CH, FOOTY, cols_n = 96, 100, 97, 8
names = list(FR.keys()); rows_n = (len(names) + cols_n - 1) // cols_n
sheet = np.zeros((rows_n * CH, cols_n * CW, 4), np.uint8)
def despeck(a):
    al = a[..., 3] > 0; p = np.pad(al, 1).astype(int)
    nb = sum(p[1 + dy:p.shape[0] - 1 + dy, 1 + dx:p.shape[1] - 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1)) - al
    a[..., 3] = a[..., 3] * ~(al & (nb <= 1))
    return a

for i, n in enumerate(names):
    a, ox = FR[n]; a = despeck(despeck(a)); h, w = a.shape[:2]; cx, cy = (i % cols_n) * CW, (i // cols_n) * CH
    oy = FOOTY - h + 1
    for y in range(h):
        for x in range(w):
            if a[y, x, 3]:
                tx, ty = ox + x, oy + y
                assert 0 <= tx < CW and 0 <= ty < CH, (n, tx, ty)
                sheet[cy + ty, cx + tx] = a[y, x]
os.makedirs(OUT, exist_ok=True)
Image.fromarray(sheet).save(os.path.join(OUT, 'milo-living.png'))
# ghost: the same drawing in the spectral palette (luminance ramp to pale cyan)
L = (sheet[..., :3].astype(float) @ [0.3, 0.55, 0.15]) / 255
lo, hi = np.array([30, 58, 102.]), np.array([214, 244, 255.])
g = lo + (hi - lo) * np.clip(L * 1.55, 0, 1)[..., None] ** 0.85
gh = np.zeros_like(sheet); gh[..., :3] = g.clip(0, 255); gh[..., 3] = (sheet[..., 3] > 0) * 255
Image.fromarray(gh).save(os.path.join(OUT, 'milo-ghost.png'))
hand = {}
for i, n in enumerate(names):  # reach point per frame: right-most opaque pixel between shoulder and hip
    cx, cy = (i % cols_n) * CW, (i // cols_n) * CH
    al = sheet[cy + 30:cy + 60, cx:cx + CW, 3] > 0
    ys, xs = np.where(al)
    j = int(xs.argmax()); hand[n] = [int(xs[j]), int(ys[j]) + 30]
# wristband centre per frame (the Ghostline hangs from it): the biggest cluster of wristband-coloured pixels
# above the slippers, preferring the painted band colour. Frames where the band is hidden were read by eye.
WB_COLS = {(214, 218, 226), (173, 181, 192), (173, 180, 192)}
WRIST_BY_EYE = {'reach0': [54, 31], 'pull1': [50, 42], 'jump_fall0': [52, 6], 'jump_fall1': [54, 9]}
wrist = {}
for i, n in enumerate(names):
    if n in WRIST_BY_EYE:
        wrist[n] = WRIST_BY_EYE[n]; continue
    cx, cy = (i % cols_n) * CW, (i // cols_n) * CH
    f = sheet[cy:cy + CH, cx:cx + CW]
    m = np.zeros((CH, CW), bool)
    for y in range(4, 77):
        for x in range(CW):
            if f[y, x, 3] and tuple(int(v) for v in f[y, x, :3]) in WB_COLS:
                m[y, x] = True
    seen = np.zeros_like(m); best = None
    for y, x in zip(*np.where(m)):
        if seen[y, x]:
            continue
        st = [(y, x)]; seen[y, x] = True; pts = []
        while st:
            p = st.pop(); pts.append(p)
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    q = (p[0] + dy, p[1] + dx)
                    if 0 <= q[0] < CH and 0 <= q[1] < CW and m[q] and not seen[q]:
                        seen[q] = True; st.append(q)
        sc = len(pts) + (10 if any(tuple(int(v) for v in f[p][:3]) == (214, 218, 226) for p in pts) else 0)
        if len(pts) >= 3 and (best is None or sc > best[0]):
            best = (sc, pts)
    assert best, ('no wristband found', n)
    wrist[n] = [round(float(np.mean([p[1] for p in best[1]])), 1), round(float(np.mean([p[0] for p in best[1]])), 1)]
META = {'frameWidth': CW, 'hand': hand, 'wrist': wrist, 'frameHeight': CH, 'foot': FOOTY, 'anchorX': AX, 'frames': names,
        'key': [n for n in names if n in KEYFRAMES]}
exec(open(os.path.join(ROOT, 'scripts/milo-frames-sleep.py')).read())
json.dump(META, open(os.path.join(OUT, 'frames.json'), 'w'), indent=1)
print(len(names), 'frames, sheet', sheet.shape[1], 'x', sheet.shape[0])
