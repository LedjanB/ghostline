# Ward 4 room shell V1: the approved room plate with Bed 7's bedside cabinet (and the mug on it) removed.
#   py scripts/ward4-room-shell.py            -> assets/ward4-bed7/room-shell-v1.png (1065x360, same as the plate)
#   py scripts/ward4-room-shell.py --check    -> also writes shots/ward4-cabinet/shell-zoom.png (before / after, 4x)
# room-plate.png is only read, never written. Only pixels inside the cabinet sprite's footprint (cabinet.png at
# world 121,227) change, plus two thin rects of cabinet paint that cabinet.png missed (MUG_CORNER, FEET below),
# which wardlab.js restores from the plate whenever the cabinet is shown. The lamp (base, pole, shade) is kept.
# How the gap is filled, all from the painting itself (no generated art):
#   wall:  smooth lamp light/shade solved from the surrounding wall (harmonic fill) + the plate's own tile, grout,
#          rail and baseboard detail, copied row by row from the clean wall strip left of the IV pole (x 104-121).
#   bed:   Bed 7's head post continued down to the floor (its own painted profile, fading out of the lamp light),
#          the shaded mattress end, frame rail and under-bed dark continued from the columns right of the cabinet,
#          and a dim copy of the bed's own front caster under the post.
import sys
from pathlib import Path
import numpy as np
import cv2
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'assets' / 'ward4-bed7'
CAB_AT = (121, 227)
# cabinet paint outside cabinet.png, as x, y, w, h (kept in sync with CABINET_EXTRA in wardlab.js, which draws
# these rects from the plate together with the cabinet): the mug's top-left corner and the feet's last 2 rows
MUG_CORNER = (164, 229, 9, 11)
FEET = (124, 327, 83, 2)
STRIP = (104, 121)               # clean wall columns between the wall pipe and the IV pole

plate = np.asarray(Image.open(ART / 'room-plate.png').convert('RGB')).astype(np.float32)
H, W = plate.shape[:2]
cab = np.asarray(Image.open(ART / 'cabinet.png'))[..., 3] > 0
M = np.zeros((H, W), bool)
M[CAB_AT[1]:CAB_AT[1] + cab.shape[0], CAB_AT[0]:CAB_AT[0] + cab.shape[1]] = cab
yy, xx = np.mgrid[0:H, 0:W]

lamp = (xx >= 137) & (xx <= 158) & (yy <= 246)                    # lamp base + pole: stays in the room
mx, my, mw, mh = MUG_CORNER
mug = (xx >= mx) & (xx <= 185) & (yy >= my) & (yy <= 246)          # the mug and its handle
counter_down = ((yy >= 245) & (xx <= 191)) | ((yy >= 247) & (xx >= 192))
fx, fy, fw, fh = FEET
feet = (xx >= fx) & (xx < fx + fw) & (yy >= fy) & (yy < fy + fh)  # leg bottoms + contact shade on the seam
R = (M & counter_down & ~lamp) | mug                                # repainted by the wall / bed fill
outside = (R & ~M) | feet
ys, xs = np.nonzero(R & ~M)
assert (xs.min(), ys.min(), xs.max() - xs.min() + 1, ys.max() - ys.min() + 1) == MUG_CORNER, 'MUG_CORNER out of sync'
RW = R & (xx <= 191)  # wall
RB = R & (xx >= 192)  # Bed 7's hidden head end

out = plate.copy()

# ---- wall: low-frequency light (harmonic fill) ----
iv_base = (xx >= 86) & (xx <= 124) & (yy >= 314) & (yy <= 327)  # IV stand base + wheel: not wall
valid = ~R & ~lamp & ~(xx >= 192) & ~iv_base & ~((xx >= 122) & (xx <= 124))  # IV pole column too
sig = 1.5
num = cv2.GaussianBlur(plate * valid[..., None], (0, 0), sig)
den = cv2.GaussianBlur(valid.astype(np.float32), (0, 0), sig)[..., None]
smooth = num / np.maximum(den, 1e-4)
x0, x1, y0, y1 = 100, 215, 215, 340  # work crop
L = smooth[y0:y1, x0:x1].copy()
reg = RW[y0:y1, x0:x1]
tube = (xx >= 122) & (xx <= 124) & ~R & ~iv_base  # the IV tube: no value of its own, but it passes the light on
known = (valid | tube)[y0:y1, x0:x1]
L[reg] = smooth[y0:y1, x0:x1][known].mean(0)
use = (reg | known).astype(np.float32)
for _ in range(6000):  # Jacobi; unknown neighbours that aren't wall (lamp, bed, IV) are skipped (Neumann)
    acc = np.zeros_like(L); cnt = np.zeros(L.shape[:2], np.float32)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        acc += np.roll(L * use[..., None], (dy, dx), (0, 1)); cnt += np.roll(use, (dy, dx), (0, 1))
    new = acc / np.maximum(cnt, 1)[..., None]
    L[reg] = new[reg]

# ---- wall: tile / grout / rail / baseboard detail, from the clean strip ----
# rows (grout, rail, baseboard, floor seam): the strip's row profile continues straight across.
# vertical grout: the plate's own grout profile above the bed (x 211-214, 226-229, 241-245; one tile = 15.5 px)
# continued left at the same pitch. grain: the strip's own 1 px texture, one random strip offset per tile.
hp = plate - cv2.GaussianBlur(plate, (0, 0), 2.0)
rng = np.random.default_rng(7)
VGROUT = (135, 151, 166, 182)
vk = np.array([-3.0, 1.5, 6.0, -1.0], np.float32)  # columns peak-2 .. peak+1, in plate levels at ~100 brightness
def src_row(y):
    if 314 <= y <= 321: return y - 8   # the IV base bar crosses the strip there: use the baseboard rows above
    return y
detail = np.zeros((y1 - y0, x1 - x0, 3), np.float32)
offs = {}
for y in range(y0, y1):
    sy = src_row(y)
    a, b = STRIP[0], (117 if y >= 314 else STRIP[1])  # IV wheel on the strip's right below 314
    row = hp[sy, a:b + 1]
    rmean = row.mean(0)
    for x in range(x0, x1):
        if not reg[y - y0, x - x0]: continue
        tile = ((x - 124) // 15, (y - 205) // 22)
        if tile not in offs: offs[tile] = (int(rng.integers(0, 4)), int(rng.integers(-1, 2)))
        ox, oy = offs[tile]
        sx = a + ((x - 124) % 15 + ox) % (b - a + 1)
        gy = sy + 22 * oy if 205 <= sy + 22 * oy <= 297 and sy <= 297 else sy
        grain = hp[gy, sx] - hp[gy, a:b + 1].mean(0)
        v = 0.0
        for c in VGROUT:
            k = x - (c - 2)
            if 0 <= k < 4 and y <= 299: v = vk[k]
        lum = L[y - y0, x - x0].mean() / 100.0
        detail[y - y0, x - x0] = rmean + 0.45 * grain + v * lum
wall = np.clip(L + detail, 0, 255)
out[y0:y1, x0:x1][reg] = wall[reg]

# ---- bed: head post continued to the floor ----
post = plate[236:245, 192:199].mean(0)  # 7 columns of the painted tube
NAVY = np.array([12, 13, 24], np.float32)  # Bed 7's under-bed dark
for y in range(247, 327):
    t = (y - 247) / 79
    f = 1.0 - 0.72 * t                          # out of the lamp light, toward the floor
    m = np.clip((y - 286) / 40, 0, 1) * 0.55    # into the bed's shade near the floor
    col = post * f * (1 - m) + NAVY * m
    for i, x in enumerate(range(192, 199)):
        if RB[y, x]: out[y, x] = col[i] + rng.normal(0, 1.2, 3)
# mattress end, frame rail and under-bed dark: each row continued from the columns just right of the cabinet
for y in range(247, 327):
    band = plate[y, 207:210].mean(0)
    for x in range(199, 207):
        if not RB[y, x]: continue
        shade = 0.62 + 0.3 * (x - 199) / 7      # darker into the corner by the post
        out[y, x] = band * shade + rng.normal(0, 1.2, 3)
# the post's caster: a dim copy of Bed 7's own front caster (x 213-224, y 311-325), only its lit pixels
src = plate[311:326, 213:225]
lit = src.mean(2) > 22
for (j, i) in zip(*np.nonzero(lit)):
    y, x = 311 + j, 189 + i
    if R[y, x]: out[y, x] = src[j, i] * 0.8

# the floor seam under the feet: between the repainted row above and the floor's own reflections below
for y in range(fy, fy + fh):
    w = (y - fy + 1) / (fh + 1)
    for x in range(fx, fx + fw):
        out[y, x] = out[fy - 1, x] * (1 - w) + plate[fy + fh, x] * w + rng.normal(0, 1.0, 3)
R = R | feet

shell = np.clip(np.round(out), 0, 255).astype(np.uint8)
assert (shell[~R] == plate[~R].astype(np.uint8)).all()
Image.fromarray(shell, 'RGB').save(ART / 'room-shell-v1.png', optimize=True)
print('room-shell-v1.png', shell.shape[1], 'x', shell.shape[0], '| repainted px:', int(R.sum()),
      '| outside cabinet.png:', int(outside.sum()), MUG_CORNER, FEET)

if '--check' in sys.argv:
    dst = ROOT / 'shots' / 'ward4-cabinet'; dst.mkdir(parents=True, exist_ok=True)
    cx0, cy0, cx1, cy1 = 84, 160, 244, 345
    s = 4
    a = Image.fromarray(plate.astype(np.uint8)[cy0:cy1, cx0:cx1]).resize(((cx1 - cx0) * s, (cy1 - cy0) * s), Image.NEAREST)
    b = Image.fromarray(shell[cy0:cy1, cx0:cx1]).resize(((cx1 - cx0) * s, (cy1 - cy0) * s), Image.NEAREST)
    sheet = Image.new('RGB', (a.width * 2 + 8, a.height), (0, 0, 0))
    sheet.paste(a, (0, 0)); sheet.paste(b, (a.width + 8, 0))
    sheet.save(dst / 'shell-zoom.png')
    print('wrote', dst / 'shell-zoom.png')
