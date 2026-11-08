# BOO (Tobias Boone), raster sprite frames for the opening's rescue. py scripts/boo-frames.py [debugDir]
# -> assets/boo/boo-cold.png (moonlight, lantern dark), boo-lit.png (same frames lit by his own lantern), frames.json
# No concept art exists for Boo, so he is painted here, at Milo's game size (96x100 frame, feet on row 97, hips on
# column 40, like the Milo sheets):
#  - body (coat, arms, legs, boots): a posed rig of shaded volumes rendered at 4x and area-downscaled, then grain,
#    fold lines and a dark outer edge so it sits next to Milo's downscaled concept pixels;
#  - head + cap and the lantern: hand-painted 1 px stamps (letters below), expressions as small edits;
#  - lit sheet: the same frames lit by the lantern's flame (warm, falls off with distance, toward the flame).
# Look: an old night janitor, stooped, knee-length grey-green work coat, navy work cap, white hair and moustache, a big
# key ring on his hip, a brass hurricane lantern. Ghost hints: a cold rim on his back edge, boots that fade, no shadow.
import json, os, sys, math
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets/boo')
DBG = sys.argv[1] if len(sys.argv) > 1 else None
FW, FH, S = 96, 100, 4
os.makedirs(OUT, exist_ok=True)

def hexc(s):
    return np.array([int(s[i:i + 2], 16) for i in (1, 3, 5)], float)

RAMP = {
    'coat': ['#1d211b', '#2e352b', '#434c3d', '#5b6551', '#737e66'],
    'coatd': ['#171a15', '#252b22', '#353d30', '#465040', '#59634f'],
    'trou': ['#141519', '#202229', '#2e313b', '#3e4250', '#4f5464'],
    'skin': ['#4a3a36', '#73594f', '#9b7e6e', '#bea08c', '#d8bfaa'],
    'boot': ['#0e0c0e', '#191617', '#262120', '#352e2c', '#463c38'],
}
RAMP = {k: [hexc(c) for c in v] for k, v in RAMP.items()}
KEYL = np.array([-0.5, -0.55, 0.67]); KEYL /= np.linalg.norm(KEYL)  # cold light from up-left-front
WARM = np.array([255, 170, 80], float)

ys, xs = np.mgrid[0:FH * S, 0:FW * S]
PX = (xs + 0.5) / S
PY = (ys + 0.5) / S

def ramp(name, I):
    r = RAMP[name]
    k = np.clip(I, 0, 0.999) * (len(r) - 1)
    i = np.floor(k).astype(int)
    f = (k - i > 0.5).astype(float)
    a = np.stack(r)
    return a[i] * (1 - f[..., None]) + a[np.minimum(i + 1, len(r) - 1)] * f[..., None]

def capsule(p0, r0, p1, r1):
    x0, y0 = p0; x1, y1 = p1
    dx, dy = x1 - x0, y1 - y0
    L2 = dx * dx + dy * dy or 1e-6
    t = np.clip(((PX - x0) * dx + (PY - y0) * dy) / L2, 0, 1)
    cx, cy = x0 + t * dx, y0 + t * dy
    r = r0 + (r1 - r0) * t
    vx, vy = PX - cx, PY - cy
    d = np.sqrt(vx * vx + vy * vy)
    rr = np.maximum(r, 1e-3)
    nz = np.sqrt(np.clip(1 - (d / rr) ** 2, 0, 1))
    return d < r, np.stack([np.clip(vx / rr, -1, 1), np.clip(vy / rr, -1, 1), nz], -1)

def ellipsoid(c, rx, ry):
    u, v = (PX - c[0]) / rx, (PY - c[1]) / ry
    q = u * u + v * v
    return q < 1, np.stack([u, v, np.sqrt(np.clip(1 - q, 0, 1))], -1)

def polymask(pts):
    im = Image.new('L', (FW * S, FH * S), 0)
    ImageDraw.Draw(im).polygon([(x * S, y * S) for x, y in pts], fill=255)
    return np.asarray(im) > 127

def smooth(pts, n=6):
    """closed Catmull-Rom through the points"""
    out = []
    L = len(pts)
    for i in range(L):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[(i + 1) % L], pts[(i + 2) % L]
        for k in range(n):
            t = k / n
            out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t
                                    + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t ** 3) for j in (0, 1)))
    return out

class Canvas:
    def __init__(self, light=None):
        self.rgb = np.zeros((FH * S, FW * S, 3)); self.a = np.zeros((FH * S, FW * S)); self.light = light
    def put(self, mask, n, mat, amb=0.2, gain=1.0):
        I = (amb + 0.85 * np.clip((n * KEYL).sum(-1), 0, 1)) * gain
        col = ramp(mat, I)
        if self.light is not None:
            col = warm(col, n, *self.light)
        self.rgb[mask] = col[mask]; self.a[mask] = 1

def warm(col, n, lx, ly, power):
    vx, vy, vz = lx - PX[..., None][..., 0], ly - PY, np.full(PX.shape, 6.0)
    d = np.sqrt(vx * vx + vy * vy + vz * vz)
    ndl = np.clip((n[..., 0] * vx + n[..., 1] * vy + n[..., 2] * vz) / d, 0, 1)
    w = ndl * power / (1 + (d / 24.0) ** 2)
    w = np.floor(np.clip(w, 0, 1) * 4) / 4
    return col * (1 - 0.2 * w[..., None]) + WARM * (0.55 * w[..., None])

def lerp(a, b, k):
    return (a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k)

# ---------------- hand-painted stamps ----------------
PAL = {
    'o': '#0d0c13', 'K': '#1a1f2c', 'C': '#2b3347', 'c': '#3e4862', 'B': '#121520', 'Y': '#d0a84a', 'y': '#8a6a30',
    'h': '#e6e7ea', 'H': '#a9acb4', 'S': '#cdb19c', 's': '#a5887a', 'd': '#77605a', 'D': '#56443f',
    'e': '#141018', 'w': '#ecece8', 'W': '#b9bab6', 'm': '#5a3c3a', 'M': '#1e1216', 'n': '#ddc4b0',
}
# head + cap, facing right (3/4 profile). (13, 15) is where the neck meets the collar; HEAD_AT = that point.
HEAD = [
    '......oooooooo.....',
    '.....oCccccccCo....',
    '....oCcccccccCCo...',
    '....oCCCCCCCCCYCo..',
    '...oKKKKKKKKKKKKBBo',
    '...ohKKKKKKKKKKoBBo',
    '...ohhDDDDDDDDDoo..',
    '...ohHsdDDwwwDSo...',
    '...oHsdddsseeSSSo..',
    '...oHsdsdssSdSSSno.',
    '...oHssdssSSSSSSSno',
    '....oHsssSSSSSSdSo.',
    '....oHssssSSSwwwwo.',
    '.....ossssSSwwwwWo.',
    '.....odsssSSSmmmo..',
    '......odssSSSSSo...',
    '.......odsssSSo....',
    '........odddoo.....',
    '........odDo.......',
]
HEAD_AT = (9, 19)

def head_rows(eyes, mouth):
    r = [list(x.ljust(19, '.')) for x in HEAD]
    if eyes == 'closed':
        r[8][11] = 'd'; r[8][12] = 'D'
    elif eyes == 'down':
        r[8][11] = 'D'; r[8][12] = 'D'; r[9][11] = 'e'; r[9][12] = 'e'
    if mouth == 'open':
        r[14][13] = 'M'; r[14][14] = 'M'; r[14][15] = 'm'; r[15][13] = 'M'; r[15][14] = 'm'
    return r

LANT = [
    '..ooooo..',
    '.o.....o.',
    '.o.....o.',
    '..ottto..',
    '.oTTTTTo.',
    '.obBBBbo.',
    '.ogGGGgo.',
    '.ogGFGgo.',
    '.obFfFbo.',
    '.ogFfFgo.',
    '.ogGFGgo.',
    '.ogGGGgo.',
    '.obBBBbo.',
    'obTTTTTbo',
    'obBBBBBbo',
    '.ooooooo.',
]
LPAL_ON = {'o': '#2a1e0e', 't': '#b48e45', 'T': '#dcb867', 'b': '#6b5426', 'B': '#a07f3c', 'g': '#e0802c', 'G': '#ffc560', 'F': '#fff0b8', 'f': '#ffffff'}
LPAL_OFF = {'o': '#140f08', 't': '#7a6030', 'T': '#9a7c40', 'b': '#3e2e16', 'B': '#5a4520', 'g': '#181c20', 'G': '#262c32', 'F': '#3a3430', 'f': '#2a2420'}

def stamp(img, rows, pal, x0, y0, flip=False, light=None):
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch == '.':
                continue
            x, y = x0 + i, y0 + j
            if not (0 <= x < FW and 0 <= y < FH):
                continue
            col = hexc(pal[ch])
            if light is not None and ch not in 'oKBY':
                lx, ly, power = light
                d = math.hypot(lx - x, ly - y)
                w = math.floor(min(1, power / (1 + (d / 20.0) ** 2) * (1.0 if x >= lx - 14 else 0.6)) * 4) / 4
                col = col * (1 - 0.2 * w) + WARM * 0.5 * w
            img[y, x, :3] = np.clip(col, 0, 255); img[y, x, 3] = 255

def P(img, x, y, col):
    x, y = int(round(x)), int(round(y))
    if 0 <= x < FW and 0 <= y < FH:
        img[y, x, :3] = hexc(col); img[y, x, 3] = 255

# ---------------- the rig ----------------
BASE = dict(
    hip=(40, 62), chest=(45, 38), neck=(49, 32.5),
    fsh=(46.5, 38.5), fel=(48.5, 50), fwr=(54.5, 54), fhand=(56.5, 54.5),
    bsh=(41.5, 37), bel=(39.5, 49.5), bwr=(40.5, 59), bhand=(40.8, 62),
    fhj=(42, 66), fkn=(43.5, 80), fan=(43.5, 93), ftoe=(49, 94.8),
    bhj=(38, 66), bkn=(36.5, 80), ban=(36, 93), btoe=(41.5, 94.8),
    hemb=0, hemf=0, lantern=True, eyes='open', mouth='shut', point=False, keysw=0, headd=(0, 0),
)

def pose(**kw):
    p = dict(BASE); p.update(kw); return p

def lantern_top(p):
    h = p['fhand']
    return (round(h[0]) - 4, round(h[1]) - 1)

def coat_outline(p):
    hp, ch, nk = p['hip'], p['chest'], p['neck']
    hem = hp[1] + 18
    return smooth([
        (nk[0] - 3.5, nk[1] + 0.5), (ch[0] - 6.0, ch[1] - 0.5), (ch[0] - 8.6, ch[1] + 5),
        (hp[0] - 8.6, hp[1] - 4), (hp[0] - 9.6 + p['hemb'], hem), (hp[0] + 9.2 + p['hemf'], hem - 1),
        (hp[0] + 8.4, hp[1] - 3), (ch[0] + 6.6, ch[1] + 5), (ch[0] + 5.2, ch[1] - 0.5), (nk[0] + 2.6, nk[1] + 1.2),
    ], 5)

def render(p, lit):
    top = lantern_top(p)
    gc = (top[0] + 4, top[1] + 9)
    c = Canvas(light=(gc[0], gc[1], 2.2) if lit else None)
    hp, ch = p['hip'], p['chest']
    # far arm
    m, n = capsule(p['bsh'], 3.0, p['bel'], 2.6); c.put(m, n, 'coatd')
    m, n = capsule(p['bel'], 2.6, p['bwr'], 2.2); c.put(m, n, 'coatd')
    m, n = ellipsoid(p['bhand'], 2.0, 2.3); c.put(m, n, 'skin', gain=0.85)
    if p['point']:
        h = p['bhand']; m, n = capsule(h, 0.8, (h[0] + 4.0, h[1] - 0.5), 0.6); c.put(m, n, 'skin', gain=0.9)
    # legs (thin old legs, baggy trousers) and boots
    for side, g in (('b', 0.78), ('f', 1.0)):
        hj, kn, an, toe = p[side + 'hj'], p[side + 'kn'], p[side + 'an'], p[side + 'toe']
        m, n = capsule(hj, 4.2, kn, 3.6); c.put(m, n, 'trou', gain=g)
        m, n = capsule(kn, 3.6, an, 3.1); c.put(m, n, 'trou', gain=g)
        m, n = capsule((an[0] - 0.5, an[1] + 0.6), 2.5, toe, 2.0); c.put(m, n, 'boot', gain=g)
        m = polymask([(an[0] - 3, 95.4), (toe[0] + 2.2, 95.4), (toe[0] + 2.0, 97), (an[0] - 3, 97)])
        c.put(m, np.broadcast_to(np.array([0, 1.0, 0.2]), m.shape + (3,)), 'boot', gain=0.6)
    # the coat: outline polygon, shaded as a stooped cylinder
    m = polymask(coat_outline(p))
    _, n1 = capsule((hp[0] - 0.5, hp[1] + 12), 13.5, ch, 11.5)
    c.put(m, n1, 'coat')
    # collar
    nk = p['neck']
    m, n = capsule((nk[0] - 2.4, nk[1] + 1.4), 2.4, (nk[0] + 2.2, nk[1] + 2.0), 2.4); c.put(m, n, 'coat', gain=1.12)
    # near arm in front of the coat
    m, n = capsule(p['fsh'], 3.3, p['fel'], 2.9); c.put(m, n, 'coat')
    m, n = capsule(p['fel'], 2.9, p['fwr'], 2.5); c.put(m, n, 'coat', gain=1.05)
    return c, gc, top

def down(c):
    a = c.a.reshape(FH, S, FW, S).mean((1, 3))
    w = c.a.reshape(FH, S, FW, S).sum((1, 3))
    rgb = (c.rgb * c.a[..., None]).reshape(FH, S, FW, S, 3).sum((1, 3)) / np.maximum(w, 1e-6)[..., None]
    img = np.zeros((FH, FW, 4), np.uint8)
    img[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    img[..., 3] = (a >= 0.45) * 255
    return img

RNG = np.random.default_rng(7)
GRAIN = RNG.integers(-7, 8, (160, 160))

def texture(img, p):
    """cloth grain keyed to his body (no shimmer between frames) + fold lines"""
    hp = p['hip']
    op = img[..., 3] > 0
    yy, xx = np.nonzero(op)
    g = GRAIN[(yy - int(hp[1]) + 80) % 160, (xx - int(hp[0]) + 80) % 160]
    img[yy, xx, :3] = np.clip(img[yy, xx, :3].astype(int) + g[:, None], 0, 255)
    ch = p['chest']
    fold = '#1f251c'
    for k in np.linspace(0, 1, 40):  # crease from under the arm down the side, and one at the back
        x, y = lerp((ch[0] - 1, ch[1] + 8), (hp[0] - 1.5, hp[1] + 12), k)
        if img[int(round(y)), int(round(x)), 3]:
            xi, yi = int(round(x)), int(round(y)); img[yi, xi, :3] = (img[yi, xi, :3] * 0.55 + hexc(fold) * 0.45).astype(np.uint8)
    for k in np.linspace(0, 1, 30):
        x, y = lerp((hp[0] - 5, hp[1] + 6), (hp[0] - 6.5 + p['hemb'] * 0.5, hp[1] + 16), k)
        if img[int(round(y)), int(round(x)), 3]:
            xi, yi = int(round(x)), int(round(y)); img[yi, xi, :3] = (img[yi, xi, :3] * 0.55 + hexc(fold) * 0.45).astype(np.uint8)

def finish(img, lit):
    op = img[..., 3] > 0
    edge = op & ~(np.roll(op, 1, 0) & np.roll(op, -1, 0) & np.roll(op, 1, 1) & np.roll(op, -1, 1))
    back = op & ~np.roll(op, 1, 1)
    out = img.astype(float)
    out[edge, :3] = out[edge, :3] * 0.45 + hexc('#0c0c14') * 0.55
    rim = back & (np.arange(FH)[:, None] < 90)
    out[rim, :3] = out[rim, :3] * 0.5 + hexc('#8fc8d4') * 0.5 * (0.6 if lit else 1)
    img[:] = np.clip(out, 0, 255).astype(np.uint8)
    for y in range(92, FH):  # the boots fade: he doesn't quite stand on anything
        img[y, :, 3] = (img[y, :, 3] * (1 - (y - 91) * 0.07)).astype(np.uint8)

def details(img, p, lit, gc, top):
    hp, ch = p['hip'], p['chest']
    light = (gc[0], gc[1], 2.0) if lit else None
    # coat: buttons, the name patch
    for k in (0.12, 0.4, 0.68):
        b = lerp((ch[0] + 6.2, ch[1] + 4), (hp[0] + 8.2, hp[1] + 6), k)
        P(img, b[0], b[1], '#11140f'); P(img, b[0], b[1] - 1, '#7c836c')
    nx, ny = round(ch[0] + 1), round(ch[1] + 4)
    for i in range(3):
        P(img, nx + i, ny, '#bdb9a4'); P(img, nx + i, ny + 1, '#99957f')
    # key ring on his hip
    kx, ky = round(hp[0] + 5), round(hp[1] + 1 + p['keysw'])
    ringc = '#d0d0d8' if lit else '#7e7e8a'
    for dx, dy in ((0, -2), (1, -2), (2, -1), (2, 0), (1, 1), (0, 1), (-1, 0), (-1, -1)):
        P(img, kx + dx, ky + dy, ringc)
    for i, (dx, col) in enumerate(((-1, '#b48e45'), (0, '#a4a4ae'), (1, '#dcb867' if lit else '#9a7c40'), (2, '#a4a4ae'))):
        L = 3 + (i % 2)
        for j in range(L):
            P(img, kx + dx, ky + 2 + j, col)
        P(img, kx + dx + 1, ky + 1 + L, col)
    # head
    hx = round(p['neck'][0]) - HEAD_AT[0] + p['headd'][0]
    hy = round(p['neck'][1]) - HEAD_AT[1] + p['headd'][1]
    stamp(img, head_rows(p['eyes'], p['mouth']), PAL, hx, hy, light=light)
    # lantern, then the hand that holds its bail
    if p['lantern']:
        stamp(img, LANT, LPAL_ON if lit else LPAL_OFF, top[0], top[1])
    h = p['fhand']
    for dx, dy, col in ((-1, 0, 's'), (0, 0, 'S'), (1, 0, 's'), (-1, 1, 'd'), (0, 1, 's'), (1, 1, 'd'), (0, -1, 's')):
        x, y = round(h[0]) - 4 + 4 + dx, round(h[1]) - 1 + dy
        P(img, x, y, PAL[col] if not lit else ('#e8b88c' if col == 'S' else '#c08a68' if col == 's' else '#8a5e48'))

# ---------------- the frames ----------------
def walk(ph):
    s = math.sin(ph * 2 * math.pi); c = math.cos(ph * 2 * math.pi)
    bob = round(-abs(c) * 1.0)
    def leg(side, a):
        kx = 40 + side * 2 + math.sin(a) * 7
        ax = 40 + side * 2 + math.sin(a) * 12
        lift = max(0, -math.cos(a + 0.6)) * 3.0 if math.sin(a) < 0.2 else 0
        return (kx, 80 + bob - lift * 0.5), (ax, 93 - lift)
    fkn, fan = leg(1, s * 0.7)
    bkn, ban = leg(-1, -s * 0.7)
    return pose(hip=(40, 62 + bob), chest=(47, 38.5 + bob), neck=(51, 33 + bob), headd=(1, 1),
                fsh=(48.5, 39 + bob), fel=(52, 50 + bob), fwr=(58, 52 + bob), fhand=(60 + s * 1.0, 52 + bob),
                bsh=(43, 37.5 + bob), bel=(41 - s * 4, 49 + bob), bwr=(42 - s * 7, 58 + bob), bhand=(42.5 - s * 8, 61 + bob),
                fhj=(42, 66 + bob), fkn=fkn, fan=fan, ftoe=(fan[0] + 5.5, fan[1] + 1.8),
                bhj=(38, 66 + bob), bkn=bkn, ban=ban, btoe=(ban[0] + 5.5, ban[1] + 1.8),
                hemb=-s * 1.5, hemf=s * 1.5, keysw=round(abs(s)))

FRAMES = {
    # in the dark: the lantern hangs cold at his side, head down
    'dark0': pose(fel=(47.5, 51), fwr=(48.5, 60.5), fhand=(49, 63), eyes='down', headd=(0, 1)),
    'dark1': pose(fel=(47.5, 51.5), fwr=(48.5, 61), fhand=(49, 63.5), chest=(45, 38.6), neck=(49, 33), eyes='down', headd=(0, 1)),
    # lighting it: the lantern up at his chest, the other hand at the wick
    'ignite0': pose(fel=(48, 49), fwr=(53.5, 45.5), fhand=(55, 43.5), bel=(43.5, 49.5), bwr=(49.5, 53), bhand=(52, 53.5), eyes='down', headd=(0, 1)),
    'ignite1': pose(fel=(48, 48.5), fwr=(54, 43.5), fhand=(55.5, 41.5), bel=(43.5, 49.5), bwr=(48.5, 54), bhand=(50.5, 55)),
    # between Milo and the dark: lantern out at arm's length, the other arm back to shield him, a wide stance
    'guard0': pose(hip=(39, 62), chest=(47, 39), neck=(51.5, 34), headd=(1, 1),
                   fsh=(48.5, 39.5), fel=(57, 33.5), fwr=(64, 26.5), fhand=(66, 24.5),
                   bsh=(42, 38), bel=(34.5, 45.5), bwr=(28, 50), bhand=(25.5, 51),
                   fhj=(41.5, 66), fkn=(49, 79), fan=(52.5, 93), ftoe=(58, 94.8),
                   bhj=(36.5, 66), bkn=(31, 79.5), ban=(26, 93), btoe=(31.5, 94.8), hemb=-2, hemf=2),
    'guard1': pose(hip=(39.5, 62.5), chest=(48, 39.5), neck=(52.5, 34.5), headd=(1, 1),
                   fsh=(49.5, 40), fel=(58.5, 33), fwr=(66, 25.5), fhand=(68, 23.5),
                   bsh=(42.5, 38.5), bel=(35, 46), bwr=(28.5, 50.5), bhand=(26, 51.5),
                   fhj=(42, 66), fkn=(49.5, 79), fan=(52.5, 93), ftoe=(58, 94.8),
                   bhj=(37, 66), bkn=(31, 79.5), ban=(26, 93), btoe=(31.5, 94.8), hemb=-2, hemf=2.5),
    # standing with Milo: lantern in front at the waist
    'idle0': pose(),
    'idle1': pose(chest=(45, 38.6), neck=(49, 33), fhand=(56.5, 55), fwr=(54.5, 54.5)),
    'talk0': pose(mouth='open'),
    'blink': pose(eyes='closed'),
    # that way: the free hand points at the exit
    'point': pose(bsh=(43, 36.5), bel=(51, 38.5), bwr=(59, 37), bhand=(61.5, 36.5), point=True, mouth='open'),
}
for i in range(6):
    FRAMES[f'walk{i}'] = walk(i / 6)

names = list(FRAMES)
cold, lit, meta = {}, {}, {'frames': names, 'frameWidth': FW, 'frameHeight': FH, 'foot': 97, 'anchorX': 40, 'lantern': {}, 'hand': {}}
for nm in names:
    p = FRAMES[nm]
    for L, store in ((False, cold), (True, lit)):
        cv, gc, top = render(p, L)
        img = down(cv)
        texture(img, p)
        finish(img, L)
        details(img, p, L, gc, top)
        store[nm] = img
    meta['lantern'][nm] = [gc[0] + 0.5, gc[1] + 0.5]
    meta['hand'][nm] = [round(p['bhand'][0] + (4 if p['point'] else 0), 1), round(p['bhand'][1], 1)]

stack = np.concatenate([d[nm][..., :3][d[nm][..., 3] > 0] for d in (cold, lit) for nm in names])
pal = Image.fromarray(stack.reshape(-1, 1, 3).astype(np.uint8)).quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
COLS = 8
for d, fn in ((cold, 'boo-cold.png'), (lit, 'boo-lit.png')):
    sheet = np.zeros((FH * math.ceil(len(names) / COLS), FW * COLS, 4), np.uint8)
    for i, nm in enumerate(names):
        a = d[nm]
        q = np.asarray(Image.fromarray(a[..., :3]).quantize(palette=pal, dither=Image.Dither.NONE).convert('RGB'))
        y0, x0 = (i // COLS) * FH, (i % COLS) * FW
        sheet[y0:y0 + FH, x0:x0 + FW, :3] = q
        sheet[y0:y0 + FH, x0:x0 + FW, 3] = a[..., 3]
    Image.fromarray(sheet).save(os.path.join(OUT, fn))
json.dump(meta, open(os.path.join(OUT, 'frames.json'), 'w'))
print('frames:', len(names))
