# Opening V4 action layers, cut from the approved art itself (no new backgrounds, no redraws):
#   py scripts/opening-v4-layers.py   -> assets/opening-v4/*.png
# Behind back-lit frosted glass a person is a soft shadow, so the "someone is here" moments are made by darkening
# the concepts' own lit glass pixels with a soft figure-shaped shadow, frame by frame, in small strips that sit
# exactly over the art in Phaser (outside the glass every pixel equals the concept, so the edges are invisible).
#   ext-entrance.png   a person crossing behind St. Mercy's lit entrance doors       (strip of frames)
#   ext-ward.png       a shadow passing in the brightest ward window, upper right      (strip)
#   corr-door.png      someone crossing behind the amber door glass, then that room's light goes out (strip)
#   milo-lie-v4.png    the approved sleeping Milo ("lie" frame of milo-sleep.png): rest, inhale (chest + arm up
#                      1 px), finger twitch (hand flexes 1 px). Pixels moved, nothing redrawn.
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
REF = ROOT / 'assets' / 'reference'
OUT = ROOT / 'assets' / 'opening-v4'
OUT.mkdir(parents=True, exist_ok=True)
EXT = np.asarray(Image.open(REF / 'Ghostline_St_Mercy_Exterior_Concept_01.png').convert('RGB'), np.float32)
CORR = np.asarray(Image.open(REF / 'Ghostline_Ward4_Corridor_Concept_01.png').convert('RGB'), np.float32)
META = {}

def figure(w, h, cx, base, height, blur):
    """soft standing-person shadow: head, shoulders, body (k = 4x supersampled)"""
    k = 4
    im = Image.new('L', (w * k, h * k), 0); d = ImageDraw.Draw(im)
    s = height * k
    hx, top = cx * k, (base - height) * k
    d.ellipse([hx - 0.11 * s, top, hx + 0.11 * s, top + 0.22 * s], fill=255)                         # head
    d.ellipse([hx - 0.2 * s, top + 0.2 * s, hx + 0.2 * s, top + 0.42 * s], fill=255)                 # shoulders
    d.rectangle([hx - 0.18 * s, top + 0.3 * s, hx + 0.16 * s, base * k], fill=255)                     # body
    im = im.filter(ImageFilter.GaussianBlur(blur * k)).resize((w, h), Image.LANCZOS)
    return np.asarray(im, np.float32) / 255

def glass_mask(region):
    r, g, b = region[..., 0], region[..., 1], region[..., 2]
    m = np.clip(((r - b) - 35) / 50, 0, 1) * np.clip((r - 120) / 60, 0, 1)   # warm and bright = lit glass
    return np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6)), np.float32) / 255

def strip(name, src, rect, path, height, blur, strength, dark_end=0.0, glass_h=None, gain=1.0):
    """frames of a shadow travelling along path [(x, base), ...] (rect-local), optional last 'light out' frames"""
    x, y, w, h = rect
    region = src[y:y + h, x:x + w]
    m = np.clip(glass_mask(region) * gain, 0, 1)
    if glass_h: m[glass_h:] = 0   # only the glass, not the lit steps below it
    frames = []
    for (cx, base) in path:
        sh = figure(w, h, cx, base, height, blur) * m * strength
        frames.append(region * (1 - sh[..., None]))
    if dark_end:
        for k in (0.35, 0.7, 1.0):  # the light behind the glass goes out
            frames.append(region * (1 - m[..., None] * dark_end * k))
    sheet = np.concatenate(frames, axis=1)
    Image.fromarray(np.clip(np.round(sheet), 0, 255).astype(np.uint8)).save(OUT / f'{name}.png', optimize=True)
    META[name] = {'x': x, 'y': y, 'w': w, 'h': h, 'frames': len(frames)}

def lerp_path(a, b, n, base):
    return [(a + (b - a) * i / (n - 1), base) for i in range(n)]

# St. Mercy entrance: double glass doors (x 433-460, y 252-292); a person walks past inside, left to right
strip('ext-entrance', EXT, (428, 246, 38, 50), lerp_path(-6, 44, 20, 44), 36, 1.3, 0.85, glass_h=37, gain=1.7)
# the brightest ward window (x 591-610, y 117-142): someone passes close to the glass, right to left
strip('ext-ward', EXT, (588, 113, 26, 33), lerp_path(32, -8, 14, 36), 30, 1.8, 0.7)
# the corridor's amber door (panes x 585-622, y 85-202): a shadow crosses right to left, then the light goes out
strip('corr-door', CORR, (578, 80, 50, 128), lerp_path(56, -10, 18, 124), 104, 3.0, 0.75, dark_end=0.82)

# Milo asleep: the approved "lie" frame, breathing and a finger twitch by moving existing pixels
sheet = np.asarray(Image.open(ROOT / 'assets' / 'milo' / 'milo-sleep.png').convert('RGBA'))
lie = sheet[0:84, 3 * 128:4 * 128].copy()
inhale = lie.copy()
inhale[49:66, 26:57] = lie[50:67, 26:57]          # chest and the arm on it rise 1 px
twitch = lie.copy()
blk = lie[48:56, 53:62].copy()                      # the hand on his chest (and the wristband)
twitch[48:56, 53:62] = 0
twitch[49:57, 53:62] = np.where(blk[..., 3:4] > 0, blk, lie[49:57, 53:62])   # fingers flex down 1 px
Image.fromarray(np.concatenate([lie, inhale, twitch], axis=1), 'RGBA').save(OUT / 'milo-lie-v4.png', optimize=True)
META['milo-lie-v4'] = {'frameWidth': 128, 'frameHeight': 84, 'frames': ['rest', 'inhale', 'twitch']}
(OUT / 'layers.json').write_text(json.dumps(META, indent=1))
print(json.dumps(META))
