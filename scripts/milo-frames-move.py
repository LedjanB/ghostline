# Movement frames for scripts/milo-frames.py (exec'd there after the acting frames: uses pal, FR, KEYFRAMES, AX, I).
# Source: the approved concept's SIDE view (turnaround, top right) and its 3/4 view for the turn.
# The side drawing is cut out at concept resolution and split along its own seams into parts:
# head+torso, near arm (sleeve + upper arm, forearm + hand), near leg (thigh, shin, slipper).
# The far arm and far leg are the same drawing in shadow (they are hidden behind the body in a side view).
# Each pose rotates the parts around their joints AT CONCEPT RESOLUTION (about 3x game size), composes them,
# then shrinks the result to game size exactly like the key poses (area downscale, alpha 0.45, shared palette).
# So every pixel comes from the approved drawing; nothing is drawn with shapes.
from PIL import Image as _I

MV_SRC = np.asarray(Image.open(SRC).convert('RGB')).astype(float)

def _cut(x0, y0, x1, y1):
    r = MV_SRC[y0:y1, x0:x1]; h, w, _ = r.shape
    d = np.sqrt(((r - np.array([13, 18, 27.])) ** 2).sum(2))
    def sh(m, dy, dx):
        o = np.zeros_like(m)
        o[max(dy, 0):h + min(dy, 0), max(dx, 0):w + min(dx, 0)] = m[max(-dy, 0):h + min(-dy, 0), max(-dx, 0):w + min(-dx, 0)]
        return o
    def dl(m, k):
        o = m.copy()
        for dy in range(-k, k + 1):
            for dx in range(-k, k + 1):
                if dy * dy + dx * dx <= k * k:
                    o |= sh(m, dy, dx)
        return o
    er = lambda m, k: ~dl(~m, k)
    closed = er(dl(d >= 16, 3), 3)
    bg = np.zeros((h, w), bool)
    q = deque([(0, x) for x in range(w)] + [(h - 1, x) for x in range(w)] + [(y, 0) for y in range(h)] + [(y, w - 1) for y in range(h)])
    while q:
        y, x = q.popleft()
        if y < 0 or x < 0 or y >= h or x >= w or bg[y, x] or closed[y, x]:
            continue
        bg[y, x] = True
        q.extend(((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)))
    fg = ~bg; fg &= ~((d < 10) & ~er(fg, 2))
    out = np.zeros((h, w, 4)); out[..., :3] = r; out[..., 3] = fg
    return out

SIDE = _cut(785, 48, 875, 342)       # 90 x 294, feet on row ~288
SH_, SW_ = SIDE.shape[:2]
MV_F = TARGET_H / 282.0              # the side figure is 282 px tall in the concept

def _skin(rgb):
    return (rgb[..., 0] > rgb[..., 2] + 10) & (rgb[..., 0] > 70)

yy, xx = np.mgrid[0:SH_, 0:SW_]
def _poly(pts):
    """inside test for a polygon (crossing number), concept px"""
    inside = np.zeros((SH_, SW_), bool); n = len(pts)
    for i in range(n):
        (xa, ya), (xb, yb) = pts[i], pts[(i + 1) % n]
        cond = ((ya > yy) != (yb > yy))
        xc = xa + (yy - ya) * (xb - xa) / np.where(yb - ya == 0, 1, yb - ya)
        inside ^= cond & (xx < xc)
    return inside

alpha = SIDE[..., 3] > 0
skin = _skin(SIDE) & alpha
# joints (concept px inside SIDE)
HIP, KNEE, ANKLE = (44, 176), (45, 224), (44, 268)
SHOULDER, ELBOW = (38, 84), (41, 146)
HEM = 172
# near arm: the sleeve (seam to cuff) + the skin of the arm and hand
sleeve = _poly([(23, 86), (30, 77), (42, 74), (50, 80), (53, 96), (53, 127), (22, 127), (21, 104)]) & alpha
armskin = skin & (yy >= 116) & (yy < 196) & (xx >= 28) & (xx < 60)
def _grow(m, k=1):
    o = m.copy()
    for _ in range(k):
        p = np.pad(o, 1); o = o | p[2:, 1:-1] | p[:-2, 1:-1] | p[1:-1, 2:] | p[1:-1, :-2]
    return o
_lum = SIDE[..., :3] @ np.array([0.3, 0.55, 0.15])
# the arm's dark outline goes with the arm (else it stays on the shirt as a stripe)
armskin = armskin | (_grow(armskin, 3) & alpha & (_lum < 75) & (yy >= 118) & (yy < 198))
sleeve = sleeve | (_grow(sleeve, 2) & alpha & (_lum < 70) & (yy >= 100) & (yy < 132) & (xx > 18) & (xx < 56))
arm = sleeve | armskin
upper = arm & (yy < ELBOW[1] + 2)
fore = arm & (yy >= ELBOW[1] - 2)
leg = alpha & (yy >= HEM - 4) & ~armskin & (xx < 76)
leg &= ~((yy < HEM + 2) & (xx < 26))           # no shirt-tail corner on the thigh
thigh = leg & (yy < KNEE[1] + 6)
shin = leg & (yy >= KNEE[1] - 6) & (yy < ANKLE[1] + 4)
foot = leg & (yy >= ANKLE[1] - 2)
body = alpha & (yy < HEM + 2) & ~arm

def _fill(img, hole, ref):
    """paint the hole the arm leaves in the shirt: each row copies the shirt pattern from just behind the arm"""
    out = img.copy()
    for y in range(SH_):
        xs = np.where(hole[y])[0]
        if not len(xs):
            continue
        a, b = xs.min(), xs.max()
        src = [x for x in range(a - 1, -1, -1) if ref[y, x]]   # shirt to the left (the back)
        src2 = [x for x in range(b + 1, SW_) if ref[y, x]]     # and to the right (the chest)
        for x in xs:
            t = (x - a) / max(1, b - a)
            c = None
            if src and src2:
                l = out[y, src[:5], :3].mean(0); r_ = out[y, src2[:5], :3].mean(0)
                c = l * (1 - t) + r_ * t
            elif src or src2:
                c = out[y, (src or src2)[:5], :3].mean(0)
            if c is not None:
                out[y, x, :3] = c; out[y, x, 3] = 1
    # soften the row-by-row fill (no bands): 5x5 average over filled + shirt pixels, applied to the hole only
    ok = (out[..., 3] > 0).astype(float); acc = np.zeros_like(out[..., :3]); n = np.zeros_like(ok)
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            acc += np.roll(np.roll(out[..., :3] * ok[..., None], dy, 0), dx, 1); n += np.roll(np.roll(ok, dy, 0), dx, 1)
    sm = acc / np.maximum(n, 1)[..., None]
    out[hole & (out[..., 3] > 0), :3] = sm[hole & (out[..., 3] > 0)]
    return out

shirt_hole = _grow(arm, 1) & alpha & (yy < HEM) & (yy >= 116) & (xx > 20) & (xx < 62)
shirt_hole |= arm & (yy < HEM) & (xx > 20) & (xx < 62)
body &= ~shirt_hole
body_img = SIDE.copy(); body_img[..., 3] = body
body_img = _fill(body_img, shirt_hole & ~body, body)
body_img[..., 3] = np.where(shirt_hole | body, body_img[..., 3], 0)
# trousers behind the hand
leg_img = SIDE.copy(); leg_img[..., 3] = leg
hand_hole = _grow(armskin, 1) & alpha & (yy >= HEM) & (xx > 26) & (xx < 62)
leg_img[..., 3] = leg & ~hand_hole
leg_img = _fill(leg_img, hand_hole, leg)
leg = leg | hand_hole
thigh = leg & (yy < KNEE[1] + 6); shin = leg & (yy >= KNEE[1] - 6) & (yy < ANKLE[1] + 4)

def _part(img, m):
    o = img.copy(); o[..., 3] = img[..., 3] * m; return o

def _shade(p, k=0.62):
    o = p.copy(); o[..., :3] = o[..., :3] * k + np.array([4, 7, 16.]) * (1 - k) * 0.5; return o

P = {
    'body': _part(body_img, body_img[..., 3] > 0),
    'upper': _part(SIDE, upper), 'fore': _part(SIDE, fore),
    'thigh': _part(leg_img, thigh), 'shin': _part(leg_img, shin), 'foot': _part(SIDE, foot),
}
for k in ['upper', 'fore', 'thigh', 'shin', 'foot']:
    P['far_' + k] = _shade(P[k])
# the wristband (always the same wrist; the concept's side view forgot it): pale band at the near wrist
for y in range(170, 175):
    for x in range(34, 54):
        if fore[y, x] and skin[y, x]:
            P['fore'][y, x, :3] = (222, 226, 234) if y < 174 else (176, 182, 196)

CAN = 3  # canvas = 3x the source box, hip in the middle
CW_, CH_ = SW_ * CAN, SH_ * 2
def _rot(v, deg):
    t = np.radians(deg); x, y = v
    return (x * np.cos(t) + y * np.sin(t), -x * np.sin(t) + y * np.cos(t))  # counter-clockwise on screen (y down)

def _place(canvas, part, pivot, deg, at):
    """rotate a part around its pivot (concept px) and put the pivot at `at` on the canvas (premultiplied over)"""
    a = part[..., 3:4]
    pm = np.dstack([part[..., :3] * a, a]).astype(np.float32)
    big = np.zeros((CH_, CW_, 4), np.float32)
    ox, oy = int(at[0] - pivot[0]), int(at[1] - pivot[1])
    big[oy:oy + SH_, ox:ox + SW_] = pm
    fx, fy = at[0] - pivot[0] - ox, at[1] - pivot[1] - oy
    chans = []
    for c in range(4):
        im = _I.fromarray(big[..., c], 'F')
        chans.append(np.asarray(im.rotate(deg, resample=_I.BICUBIC, center=(at[0] - fx, at[1] - fy), translate=(fx, fy))))
    r = np.dstack(chans).clip(0, None); r[..., 3] = r[..., 3].clip(0, 1)
    canvas[...] = r + canvas * (1 - r[..., 3:4])

def _add(p, q):
    return (p[0] + q[0], p[1] + q[1])

def _sub(p, q):
    return (p[0] - q[0], p[1] - q[1])

def _leg(canvas, far, hip, a1, a2, fg):
    """thigh a1 (+ = forward), knee a2 (<= 0 bends), slipper at fg degrees to the ground (+ = toes up)"""
    pre = 'far_' if far else ''
    knee = _add(hip, _rot(_sub(KNEE, HIP), a1))
    ank = _add(knee, _rot(_sub(ANKLE, KNEE), a1 + a2))
    _place(canvas, P[pre + 'foot'], ANKLE, fg, ank)
    _place(canvas, P[pre + 'shin'], KNEE, a1 + a2, knee)
    _place(canvas, P[pre + 'thigh'], HIP, a1, hip)
    return ank

def _arm(canvas, far, sh, s, e):
    """arm swing s (+ = forward), elbow e (+ = forearm forward/up)"""
    pre = 'far_' if far else ''
    el = _add(sh, _rot(_sub(ELBOW, SHOULDER), s))
    _place(canvas, P[pre + 'fore'], ELBOW, s + e, el)
    _place(canvas, P[pre + 'upper'], SHOULDER, s, sh)

def mv_pose(near, far, arms, lean=0, ground=True, lift=0):
    """near/far = (thigh, knee, foot), arms = (near s, near e, far s, far e); returns the game-size frame (98 x 96)"""
    cv = np.zeros((CH_, CW_, 4), np.float32)
    hip = (CW_ / 2, CH_ / 2)
    sh = _add(hip, _rot(_sub(SHOULDER, HIP), -lean))
    _arm(cv, True, sh, arms[2], arms[3])
    _leg(cv, True, hip, *far)
    _leg(cv, False, hip, *near)
    _place(cv, P['body'], HIP, -lean, hip)
    _arm(cv, False, sh, arms[0], arms[1])
    # shrink like the key poses: area average of premultiplied colour, alpha >= 0.45, shared palette
    nw, nh = round(CW_ * MV_F), round(CH_ * MV_F)
    A = np.asarray(_I.fromarray(cv[..., 3], 'F').resize((nw, nh), _I.BOX))
    Pm = np.dstack([np.asarray(_I.fromarray(cv[..., c], 'F').resize((nw, nh), _I.BOX)) for c in range(3)])
    rgb = (Pm / np.maximum(A, 1e-3)[..., None]).clip(0, 255).astype(np.uint8)
    al = A >= 0.45
    qd = np.asarray(_I.fromarray(rgb).quantize(palette=pal, dither=_I.Dither.NONE).convert('RGB'))
    hx, hy = hip[0] * MV_F, hip[1] * MV_F
    out = np.zeros((98, 96, 4), np.uint8)
    rows = np.where(al.any(1))[0]
    # ground poses: the lowest pixel stands on the floor (so the body bobs by itself); air poses: hip at standing height
    base = (rows.max() - 97) if ground else (hy - STAND_HIP)
    base = int(round(base)) + lift
    dx = int(round(hx)) - AX
    for y in rows:
        ty = y - base
        if 0 <= ty < 98:
            xs = np.where(al[y])[0]
            for x in xs:
                tx = x - dx
                if 0 <= tx < 96:
                    out[ty, tx, :3] = qd[y, x]; out[ty, tx, 3] = 255
    return out

STAND_HIP = 97 - (ANKLE[1] + 20 - HIP[1]) * MV_F   # hip row of the standing side pose

def mv_add(name, a, key=False):
    FR[name] = (a, 0)
    if key:
        KEYFRAMES.add(name)

STAND = ((0, 0, 0), (2, -2, 0), (-2, 6, 0, 6))
mv_add('side', mv_pose(*STAND), True)
# the turn from the idle pose (3/4 to the viewer) to profile: the concept's own 3/4 view
_tq = _cut(682, 48, 772, 342)
_m = _tq[..., 3] > 0
_rows = np.where(_m.any(1))[0]; _hgt = _rows.max() - _rows.min() + 1
_tqF = TARGET_H / _hgt
_nw, _nh = round(_tq.shape[1] * _tqF), round(_tq.shape[0] * _tqF)
_A = np.asarray(_I.fromarray((_tq[..., 3]).astype(np.float32), 'F').resize((_nw, _nh), _I.BOX))
_Pm = np.dstack([np.asarray(_I.fromarray((_tq[..., c] * _tq[..., 3]).astype(np.float32), 'F').resize((_nw, _nh), _I.BOX)) for c in range(3)])
_rgb = (_Pm / np.maximum(_A, 1e-3)[..., None]).clip(0, 255).astype(np.uint8)
_qd = np.asarray(_I.fromarray(_rgb).quantize(palette=pal, dither=_I.Dither.NONE).convert('RGB'))
_tqa = np.dstack([_qd, (_A >= 0.45) * 255]).astype(np.uint8)
_tqa = _tqa[:np.where(_tqa[..., 3].any(1))[0].max() + 1]
FR['turn'] = (_tqa, AX - hipx(_tqa)); KEYFRAMES.add('turn')

# WALK: 8 frames, contact / down / passing / up, then the other leg (thighs, knee bends, slipper angle)
WALK = [
    ((24, -4, 14), (-20, -10, -22)),
    ((14, -14, 0), (-14, -38, -36)),
    ((2, -4, 0), (6, -56, -22)),
    ((-12, -2, -4), (22, -34, 2)),
]
for i, (n, f) in enumerate(WALK):
    mv_add(f'walk{i}', mv_pose(n, f, (-(n[0] - f[0]) * 0.45, 10, (n[0] - f[0]) * 0.45, 10)), i == 0)
    mv_add(f'walk{i + 4}', mv_pose(f, n, ((n[0] - f[0]) * 0.45, 10, -(n[0] - f[0]) * 0.45, 10)))
# idle -> walk: weight shift and the first step from a standstill
mv_add('start0', mv_pose((6, -8, 0), (-6, -16, -10), (-6, 10, 6, 10)))

# RUN: 6 frames, leaning in, arms bent and pumping, a short flight between steps
RUN = [
    ((34, -18, 10), (-34, -48, -34), 0),
    ((16, -40, 0), (-8, -100, -46), 0),
    ((-26, -14, -40), (44, -76, -6), 3),
]
for i, (n, f, lift) in enumerate(RUN):
    sw = (n[0] - f[0]) * 0.75
    mv_add(f'run{i}', mv_pose(n, f, (-sw, 80, sw, 80), lean=12, lift=lift), i == 0)
    mv_add(f'run{i + 3}', mv_pose(f, n, (sw, 80, -sw, 80), lean=12, lift=lift))

# JUMP: crouch (anticipation), push off, rise, apex, fall (2, loops), land (squash), recover
mv_add('jump_crouch', mv_pose((44, -84, 0), (36, -80, 0), (-46, 14, -38, 14), lean=16), True)
mv_add('jump_push', mv_pose((6, -6, -50), (-10, -14, -46), (54, 38, 40, 38), lean=6))
mv_add('jump_rise', mv_pose((58, -72, -10), (-14, -26, -36), (96, 30, 74, 30), lean=4, ground=False), True)
mv_add('jump_apex', mv_pose((62, -92, -8), (34, -96, -20), (62, 44, 50, 44), lean=0, ground=False))
mv_add('jump_fall0', mv_pose((16, -24, -14), (-14, -34, -30), (138, 18, 120, 18), lean=-2, ground=False), True)
mv_add('jump_fall1', mv_pose((18, -20, -10), (-12, -38, -34), (128, 26, 132, 14), lean=-2, ground=False))
mv_add('land0', mv_pose((48, -98, 0), (40, -94, 0), (34, 20, 26, 20), lean=20), True)
mv_add('land1', mv_pose((22, -42, 0), (16, -40, 0), (8, 12, 2, 12), lean=8))
