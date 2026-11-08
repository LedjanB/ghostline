# Acting frames for scripts/milo-frames.py (exec'd there: uses K, paint, layer, band, head_swap, cp).
# Coordinates are game px inside each key pose image. Faces are repainted by hand at game size
# because the concept's eyes average away when downscaled.

# idle head, 3/4 right: rows y16..y20, cols x16..x24
IDLE = {
    'open':     ['..bbSSbb.', '..weSSwe.', '..heSShe.', '.........', '....rr...'],
    'closed':   ['..bbSSbb.', '..SSSSSS.', '..ddSSdd.', '.........', '....rr...'],
    'half':     ['..bbSSbb.', '..hhSShh.', '..weSSwe.', '.........', '....rr...'],
    'left':     ['..bbSSbb.', '..ewSSew.', '..ehSSeh.', '.........', '....rr...'],
    'confused': ['..SbSSbb.', '..weSbbe.', '..heSShe.', '.........', '.....r...'],
    'shock':    ['..SSSSSS.', '.wewSwew.', '..eSSSe..', '....ee...', '....ee...'],
}
# profile right (reach pose head): rows from (28,21)
PROF = {
    'open':  ['bb', 'we', '..'],
    'wide':  ['SS', 'we', 'we'],
    'worry': ['Sb', 'be', '..'],
}

def idle_face(a, k):
    return paint(a, 16, 16, IDLE[k])

def prof_face(a, k, x, y, mouth=None):
    paint(a, x, y, PROF[k])
    if mouth == 'open':
        paint(a, x + 3, y + 4, ['e', 'e'])
    return a

FR = {}
KEYFRAMES = set()
AX = 40

def hipx(a):
    xs = np.where(a[62:72, :, 3] > 0)[1]
    return int(round(xs.mean()))

OX = {n: AX - hipx(K[n]) for n in K}

def add(name, a, key, key_frame=False):
    FR[name] = (a, OX[key])
    if key_frame:
        KEYFRAMES.add(name)

I, Hd, R, T, RC, FE = K['idle'], K['hands'], K['reach'], K['touch'], K['recoil'], K['fear']
# the concept forgot the wristband on most key poses: paint it on the same (front) wrist everywhere
paint(R, 51, 29, ['Ww', 'Ww', 'Ww', 'ww'])
paint(T, 40, 39, ['Ww', 'Ww', 'ww'])
paint(Hd, 26, 37, ['W.', 'Ww', 'Ww'])
paint(RC, 10, 34, ['Ww', 'Ww', 'ww'])

# idle loop + awakening (idle body)
a = cp(I); idle_face(a, 'open'); add('idle0', a, 'idle', True)
a = cp(I); idle_face(a, 'open'); band(a, 0, 57, 0, 1); add('idle1', a, 'idle')          # breath out
a = cp(I); idle_face(a, 'closed'); add('blink', a, 'idle')
a = cp(I); idle_face(a, 'closed'); band(a, 25, 50, 0, 1); band(a, 0, 25, 1, 2); add('wake0', a, 'idle')
a = cp(I); idle_face(a, 'closed'); band(a, 25, 50, 0, 1); band(a, 0, 25, 1, 1); add('wake1', a, 'idle')
a = cp(I); idle_face(a, 'half'); band(a, 0, 25, 1, 1); add('wake2', a, 'idle')
a = cp(I); idle_face(a, 'half'); add('wake3', a, 'idle')
a = cp(I); idle_face(a, 'left'); add('look_l', a, 'idle')
a = cp(I); idle_face(a, 'left'); band(a, 0, 25, -1, 0); add('look_l2', a, 'idle')
a = cp(I); idle_face(a, 'confused'); band(a, 0, 25, 1, 0); add('confused', a, 'idle')

a = cp(I); idle_face(a, 'half'); band(a, 0, 25, 1, 1)
a = cp(Hd); add('hands0', a, 'hands', True)
a = cp(Hd); layer(a, (26, 34, 36, 42), 1, 0); add('hands1', a, 'hands')
a = cp(Hd); layer(a, (26, 34, 36, 42), 0, 1); band(a, 0, 24, 0, 1); add('hands2', a, 'hands')

def hand(px):
    r, g, b = int(px[0]), int(px[1]), int(px[2])
    return r > b + 8 or (r > 150 and g > 150 and b > 150)  # skin or the white wristband

def lift(a, y, n):
    """shoulders rise: everything above row y moves up n, the gap is filled by stretching row y (no holes)"""
    a[0:y - n] = a[n:y].copy()
    for k in range(n):
        a[y - n + k] = a[y]
    return a

# he lowers his hands and turns to the body (the idle head already faces right, toward the bed)
a = cp(I); idle_face(a, 'open'); band(a, 0, 25, 1, 1)
layer(a, (4, 46, 17, 64), 1, -5, pick=hand); layer(a, (23, 46, 32, 64), -1, -4, pick=hand); add('raise', a, 'idle')
a = cp(I); idle_face(a, 'open'); add('turn1', a, 'idle')
a = cp(I); idle_face(a, 'shock'); add('shock0', a, 'idle')
a = cp(I); idle_face(a, 'shock'); lift(a, 46, 1); add('shock1', a, 'idle')

# the impossible touch: hesitate, reach, pass through
IDLE['worry'] = ['..SbSbS..', '..weSwe..', '..heShe..', '.........', '....r....']
a = cp(I); idle_face(a, 'worry'); add('hes0', a, 'idle')
a = cp(I); idle_face(a, 'worry'); lift(a, 46, 1); band(a, 0, 25, -1, 0); add('hes1', a, 'idle')
SH = 34

def reach_arm(ext, face='worry', mouth=None):
    a = cp(R)
    if ext:
        layer(a, (SH, 24, a.shape[1], 40), -ext, 0, clip=lambda x, y: x < SH)
    return prof_face(a, face, 28, 21, mouth)

for i, e in enumerate([20, 13, 6]):
    add(f'reach{i}', reach_arm(e), 'reach')
add('reach3', reach_arm(0), 'reach', True)
add('reach4', reach_arm(0, 'open'), 'reach')
TS = 31

def touch_f(face, mouth=None, ext=0):
    a = cp(T)
    if ext:
        layer(a, (TS, 35, a.shape[1], 50), -ext, 0, clip=lambda x, y: x < TS)
    return prof_face(a, face, 29, 23, mouth)

add('touch0', touch_f('open', None, 3), 'touch')
add('touch1', touch_f('open'), 'touch', True)
add('touch2', touch_f('wide', 'open'), 'touch')

# fear: pull back, recoil, stumble, hands to mouth, shoulders up
add('pull0', touch_f('wide', 'open', 8), 'touch')
add('pull1', touch_f('wide', 'open', 15), 'touch')

def rec_face(a, up=0):
    return paint(a, 24, 21 - up, ['SSSSSSS', 'wewSwew', 'SeSSSeS'])

a = cp(RC); rec_face(a); add('recoil0', a, 'recoil', True)
a = cp(RC); rec_face(a); lift(a, 48, 1); add('recoil1', a, 'recoil')

def fear_f(up=0, shake=0, sweat=False):
    a = cp(FE)
    paint(a, 29, 26, ['SSSSSS', 'weSSwe'])
    if sweat:
        paint(a, 37, 24, ['t', 't'])
    if up:
        lift(a, 50, up)
    if shake:
        band(a, 0, 44, shake, 0)
    return a

add('fear0', fear_f(), 'fear', True)
add('fear1', fear_f(1), 'fear')
add('fear2', fear_f(1, 1, True), 'fear')
add('fear3', fear_f(2, 0, True), 'fear')
add('fear4', fear_f(1, -1, True), 'fear')
