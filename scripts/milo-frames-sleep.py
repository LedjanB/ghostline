# Bed 7 frames for scripts/milo-frames.py (exec'd at the end of its pack step: uses the move rig P, _place, _rot, pal...).
# The living boy asleep in bed 7 and his spirit lying in / sitting up out of him, for the opening (?opening=1).
# Same source as the movement frames: the concept's SIDE view, split into parts and posed AT CONCEPT RESOLUTION,
# then the whole figure is laid down (rotated a quarter turn at concept resolution, head on the pillow, face up)
# and shrunk exactly like every other frame (area average, alpha 0.45, the shared 40-colour palette).
# Eyes are closed at concept resolution (eye painted over with the cheek's skin, a lash line under it).
# The blanket is drawn at game resolution over his body's own silhouette (it is bedding, not Milo).
# Out: assets/milo/milo-sleep.png (living row, ghost row), META['sleep'] (frame names, hip anchor, wrist + hand).

_BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
bayer = lambda x, y: (_BAY[(y & 3) * 4 + (x & 3)] + 0.5) / 16
CW_ = SW_ * 5  # wider rig canvas: legs stretched out in bed (the movement frames are already made)
SL_W, SL_H = 128, 84          # frame size
SL_HIP = (58, 60)              # where the hip joint sits in every sleep frame (lie and sit share it)
SL_TILT = 88                   # a quarter turn, minus a little so the head rests higher on the pillow

def _closed_eyes(part):
    o = part.copy()
    sk = o[48:53, 56:63, :3][_skin(o[48:53, 56:63])].reshape(-1, 3)
    cheek = sk.mean(0) if len(sk) else np.array([196, 150, 122.])
    for y in range(38, 49):
        for x in range(51, 65):
            if o[y, x, 3] > 0 and ((x - 57.5) / 6.0) ** 2 + ((y - 43.5) / 4.2) ** 2 <= 1 and not _skin(o[y:y + 1, x:x + 1])[0, 0]:
                if y >= 41:  # below the fringe: the open eye becomes lid (the hair above stays)
                    o[y, x, :3] = cheek * (0.92 if y < 44 else 1.0)
    for x in range(52, 62):  # lashes: a soft downward curve
        y = 45 + (1 if 54 <= x <= 59 else 0)
        o[y, x, :3] = (58, 38, 36)
        if 54 <= x <= 59:
            o[y - 1, x, :3] = cheek * 0.8
    return o

SL_P = dict(P)
SL_P['body'] = _closed_eyes(P['body'])

def _sl_canvas(layer, legs, arms, lean=0):
    """compose a standing-rig pose like mv_pose, but only the parts of one layer ('under' or 'arm')"""
    cv_ = np.zeros((CH_, CW_, 4), np.float32)
    hip = (CW_ / 2, CH_ / 2)
    sh = _add(hip, _rot(_sub(SHOULDER, HIP), -lean))
    near, far = legs
    global P
    keep = P; P = SL_P
    try:
        if layer == 'under':
            _arm(cv_, True, sh, arms[2], arms[3])
            _leg(cv_, True, hip, *far)
            _leg(cv_, False, hip, *near)
            _place(cv_, P['body'], HIP, -lean, hip)
        else:
            _arm(cv_, False, sh, arms[0], arms[1])
    finally:
        P = keep
    return cv_, hip, sh

def _sl_turn(cv_, deg):
    """rotate a whole canvas (premultiplied) a quarter turn; returns it and the point mapping"""
    if not deg:
        return cv_, (lambda p: p)
    h, w = cv_.shape[:2]
    chans = [np.asarray(_I.fromarray(cv_[..., c], 'F').rotate(deg, resample=_I.BICUBIC, expand=True)) for c in range(4)]
    out = np.dstack(chans).clip(0, None); out[..., 3] = out[..., 3].clip(0, 1)
    H2, W2 = out.shape[:2]
    c0, c1 = (w / 2, h / 2), (W2 / 2, H2 / 2)
    return out, (lambda p: _add(c1, _rot(_sub(p, c0), deg)))

def _sl_shrink(cv_):
    nw, nh = round(cv_.shape[1] * MV_F), round(cv_.shape[0] * MV_F)
    A = np.asarray(_I.fromarray(cv_[..., 3], 'F').resize((nw, nh), _I.BOX))
    Pm = np.dstack([np.asarray(_I.fromarray(cv_[..., c], 'F').resize((nw, nh), _I.BOX)) for c in range(3)])
    rgb = (Pm / np.maximum(A, 1e-3)[..., None]).clip(0, 255).astype(np.uint8)
    qd = np.asarray(_I.fromarray(rgb).quantize(palette=pal, dither=_I.Dither.NONE).convert('RGB'))
    return np.dstack([qd, (A >= 0.45) * 255]).astype(np.uint8)

def _sl_frame(img, hip_g):
    """paste a game-size image so its hip lands on SL_HIP"""
    out = np.zeros((SL_H, SL_W, 4), np.uint8)
    ox, oy = SL_HIP[0] - int(round(hip_g[0])), SL_HIP[1] - int(round(hip_g[1]))
    for y, x in zip(*np.where(img[..., 3] > 0)):
        tx, ty = x + ox, y + oy
        if 0 <= tx < SL_W and 0 <= ty < SL_H:
            out[ty, tx] = img[y, x]
    return out, (ox, oy)

# wristband and hand centres in SIDE px (the band is painted on the near forearm by the move script)
_bm = fore & skin & (yy >= 170) & (yy < 175)
SL_WRIST_SRC = (float(xx[_bm].mean()), float(yy[_bm].mean()))
_hm = armskin & (yy > 178)
SL_HAND_SRC = (float(xx[_hm].mean()), float(yy[_hm].mean()))

def _arm_point(src, sh, s, e):
    el = _add(sh, _rot(_sub(ELBOW, SHOULDER), s))
    return _add(el, _rot(_sub(src, ELBOW), s + e))

def sl_pose(legs, arms, lean=0, tilt=0):
    """-> (under frame, arm frame, wrist, hand) in sleep-frame px"""
    res = []
    for layer in ('under', 'arm'):
        cv_, hip, sh = _sl_canvas(layer, legs, arms, lean)
        cv_, mp = _sl_turn(cv_, tilt)
        g = _sl_shrink(cv_)
        hp = mp(hip)
        fr, off = _sl_frame(g, (hp[0] * MV_F, hp[1] * MV_F))
        res.append(fr)
    to = lambda p: [round(mp(p)[0] * MV_F + off[0], 1), round(mp(p)[1] * MV_F + off[1], 1)]
    return res[0], res[1], to(_arm_point(SL_WRIST_SRC, sh, arms[0], arms[1])), to(_arm_point(SL_HAND_SRC, sh, arms[0], arms[1]))

def _over(a, b):
    o = a.copy(); m = b[..., 3] > 0; o[m] = b[m]; return o

# ---- the blanket (bedding, drawn at game resolution over his silhouette) ----
BL = {'hi': (206, 199, 184), 'lt': (182, 175, 160), 'md': (160, 154, 142), 'dk': (112, 107, 100), 'dp': (74, 71, 70),
      'sh': (226, 226, 220), 'ss': (188, 190, 192), 'st': (120, 136, 168)}
SL_X0 = 34          # the turned-down sheet at mid chest
SL_MT = SL_HIP[1] + 9  # mattress top under him (his back sinks into it)

def blanket(under, breath=0):
    al = under[..., 3] > 0
    top = {}
    for x in range(SL_X0, SL_W):
        ys = np.where(al[:, x])[0]
        if len(ys):
            top[x] = ys.min()
    xe = max(top) + 4  # past his toes
    prof = []
    for x in range(SL_X0, xe + 1):
        near = [top[k] for k in range(x - 2, x + 3) if k in top]
        t = (min(near) - 1) if near else SL_MT - 4
        prof.append(min(t, SL_MT - 4))
    prof = np.array(prof, float)
    prof = np.convolve(np.pad(prof, 2, mode='edge'), np.ones(5) / 5, mode='valid')  # soft cloth, no stairs
    if breath:
        for i in range(0, 16):
            prof[i] -= breath * (1 - i / 16)
    out = np.zeros_like(under)
    hem = SL_MT + 6
    for i, x in enumerate(range(SL_X0, xe + 1)):
        t = int(round(prof[i]))
        end = xe - i  # the far end rolls over the foot of the mattress
        for y in range(t, hem + 1):
            k = (y - t) / max(1, SL_MT - t)
            if y == t:
                col = BL['hi']
            elif y < SL_MT:
                col = BL['lt'] if bayer(x, y) > k * 1.4 else BL['md']
            elif y == SL_MT:
                col = BL['md']
            else:  # the side drop over the mattress edge, in shade
                col = BL['dk'] if bayer(x, y) > (y - SL_MT) / 6 * 0.7 else BL['dp']
            if y == hem:
                col = BL['dp']
            if end < 2 and y > t + 1:
                col = BL['dk'] if end == 1 else BL['dp']
            out[y, x, :3] = col; out[y, x, 3] = 255
        # cloth folds: shallow creases falling from the bumps (knees, toes) toward the hem
    for fx in (int(SL_X0 + 26), int(SL_X0 + 44), int(xe - 6)):
        for j in range(0, 10):
            x, y = fx + j // 3, SL_MT + 1 + j
            if 0 <= x < SL_W and y <= hem - 1 and out[y, x, 3]:
                out[y, x, :3] = BL['dp']
    for fx in (int(SL_X0 + 18), int(SL_X0 + 36)):
        i = fx - SL_X0
        if 0 <= i < len(prof):
            t = int(round(prof[i]))
            for j in range(2, max(3, SL_MT - t - 1)):
                if out[t + j, fx + j // 2, 3]:
                    out[t + j, fx + j // 2, :3] = BL['md']
    # the sheet turned down over the blanket at his chest, a faded blue stripe on it
    for y in range(int(round(prof[0])), hem + 1):
        for x in range(SL_X0 - 2, SL_X0 + 3):
            if y < SL_MT + 1 or x >= SL_X0:
                c = BL['sh'] if x < SL_X0 + 1 else BL['ss']
                if x == SL_X0 + 1:
                    c = BL['st']
                if y > SL_MT:
                    c = BL['ss'] if x < SL_X0 + 1 else BL['dk']
                out[y, x, :3] = c; out[y, x, 3] = 255
    return out

# ---- the poses ----
LIE_LEGS = ((0, 0, 0), (1, -1, 0))
LIE_ARMS = (7, 12, -2, 4)        # near arm out over the blanket, forearm across his belly; far arm by his side
TWITCH_ARMS = (7, 20, -2, 4)     # the fingers (the hand) lift a little
SIT_LEGS = ((90, 0, 90), (88, 0, 88))
SIT_ARMS = (14, 10, 8, 10)

under, arm, wr, hd = sl_pose(LIE_LEGS, LIE_ARMS, tilt=SL_TILT)
_, arm_t, wr_t, hd_t = sl_pose(LIE_LEGS, TWITCH_ARMS, tilt=SL_TILT)
s_under, s_arm, s_wr, s_hd = sl_pose(SIT_LEGS, SIT_ARMS, lean=10)
bl0, bl1 = blanket(under), blanket(under, breath=1)
SLEEP = {
    'bed': (_over(_over(under, bl0), arm), wr, hd),
    'bed_breath': (_over(_over(under, bl1), arm), wr, hd),
    'bed_twitch': (_over(_over(under, bl0), arm_t), wr_t, hd_t),
    'lie': (_over(under, arm), wr, hd),        # his spirit, the same body without the blanket
    'sit': (_over(s_under, s_arm), s_wr, s_hd),
}
sl_names = list(SLEEP)
sl_sheet = np.zeros((SL_H * 2, SL_W * len(sl_names), 4), np.uint8)
for i, n in enumerate(sl_names):
    sl_sheet[:SL_H, i * SL_W:(i + 1) * SL_W] = SLEEP[n][0]
# ghost row: the same spectral ramp as milo-ghost.png (bedding never shows on the spirit frames)
_L = (sl_sheet[:SL_H, ..., :3].astype(float) @ [0.3, 0.55, 0.15]) / 255
_g = lo + (hi - lo) * np.clip(_L * 1.55, 0, 1)[..., None] ** 0.85
sl_sheet[SL_H:, ..., :3] = _g.clip(0, 255); sl_sheet[SL_H:, ..., 3] = (sl_sheet[:SL_H, ..., 3] > 0) * 255
Image.fromarray(sl_sheet).save(os.path.join(OUT, 'milo-sleep.png'))
META['sleep'] = {'frameWidth': SL_W, 'frameHeight': SL_H, 'hip': list(SL_HIP), 'mattress': SL_MT, 'frames': sl_names,
                 'wrist': {n: SLEEP[n][1] for n in sl_names}, 'hand': {n: SLEEP[n][2] for n in sl_names}}
print('sleep frames', sl_names, 'wrist', wr, 'hand', hd)
