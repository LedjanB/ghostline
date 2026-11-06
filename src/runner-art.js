// v6 runner art, drawn in code like src/art.js (same rules: text rows, 1 char = 1 px,
// '.' = transparent, 1px #0b0918 outline on actors, max 16 colors per sprite).
// THE STRETCH: tall, thin, too many joints, long arms, white porcelain face with a wide grin.
// Spooky fun, never gory.

const OUTLINE = '#0b0918';
function px(scene, key, rows, pal) {
  const h = rows.length;
  const w = rows[0].length;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w + 2, h + 2);
  const ctx = tex.context;
  const solid = (x, y) => y >= 0 && y < h && x >= 0 && x < w && rows[y][x] !== '.' && pal[rows[y][x]];
  ctx.fillStyle = OUTLINE;
  for (let y = -1; y <= h; y++) {
    for (let x = -1; x <= w; x++) {
      if (solid(x, y)) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) ctx.fillRect(x + 1, y + 1, 1, 1);
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y)) continue;
      ctx.fillStyle = pal[rows[y][x]];
      ctx.fillRect(x + 1, y + 1, 1, 1);
    }
  }
  tex.refresh();
}

const STRETCH_PAL = { B: '#2c2540', S: '#463c63', F: '#ece8f2', G: '#b9b2c8', E: '#0b0918', T: '#ffffff', R: '#ff3a4a', C: '#8a8298' };

// phase 4: it changes as it gets closer. 'm' (middle): pin-prick red pupils. 'n' (near): red pupils,
// a crack down the porcelain and the grin opened all the way (every tooth). Same rows, swapped pixels,
// so every frame (walk, crawl) gets the same face.
function hungry(rows, stage) {
  let eye = 0;
  return rows.map((r) => {
    if (r.includes('FEEFFEEF')) { // the two eye rows: red in the inner bottom corner of each eye
      eye++;
      if (eye === 2) r = r.replace('FEEFFEEF', 'FERFFREF');
      if (eye === 1 && stage === 'n') r = r.replace('FEEFFEEF', 'FEEFCEEF');
      return r;
    }
    if (stage !== 'n') return r;
    if (r.includes('FFFFFFFF') && eye === 0) return r.replace('FFFFFFFF', 'FFFCFFFF'); // the crack
    if (r.includes('FETETETETF')) return r.replace('FETETETETF', 'FTTTTTTTTF'); // the grin, wide open
    if (r.includes('FEEEEEEF')) return r.replace('FEEEEEEF', 'FETETETF'); // and a lower row of teeth
    return r;
  });
}

// head: porcelain mask with hollow eyes and a too-wide grin
const HEAD = [
  '...FFFFFF...',
  '..FFFFFFFF..',
  '..FEEFFEEF..',
  '..FEEFFEEF..',
  '..FFFFFFFF..',
  '.FEEEEEEEEF.',
  '.FETETETETF.',
  '..FEEEEEEF..',
  '...GFFFFG...',
  '.....BB.....',
];
// torso with arms hanging down to the knees, long pale fingers
const TORSO = [
  '...BBBBBB...',
  '..BSBBBBSB..',
  '.BS.BBBB.SB.',
  '.BS.BBBB.SB.',
  '.BS.BSSB.SB.',
  '.BS.BBBB.SB.',
  'BS..BBBB..SB',
  'BS..BSSB..SB',
  'BS..BBBB..SB',
  'BS..BBBB..SB',
  'B...BBBB...B',
  'G...B..B...G',
  'FF..B..B..FF',
  'F.F.B..B.F.F',
  'F...B..B...F',
];
const LEGS0 = [
  '....B..B....',
  '....B...B...',
  '...B....B...',
  '...B....B...',
  '...S.....S..',
  '..B......B..',
  '..B......B..',
  '..B.......B.',
  '..B.......B.',
  '.BB.......BB',
];
const LEGS1 = [
  '....B..B....',
  '....B.B.....',
  '....B.B.....',
  '....B.B.....',
  '....S.S.....',
  '...B..B.....',
  '...B...B....',
  '...B...B....',
  '...B...B....',
  '..BB...BB...',
];
// v6 phase 2: a 4-step lurch. The head drifts a pixel ahead on the off steps and the hands swing.
const HEAD_LEAN = HEAD.map((r) => '.' + r.slice(0, 11));
const TORSO_B = [
  ...TORSO.slice(0, 11),
  '.G..B..B..G.',
  '.FF.B..B.FF.',
  '.F.FB..BF.F.',
  '.F..B..B..F.',
];
const LEGS2 = [
  '....B..B....',
  '...B...B....',
  '...B....B...',
  '..B.....B...',
  '..S......S..',
  '..B.......B.',
  '.B........B.',
  '.B.........B',
  '.B.........B',
  'BB........BB',
];
const LEGS3 = [
  '....B..B....',
  '.....BB.....',
  '.....BB.....',
  '.....B.B....',
  '.....S.S....',
  '....B...B...',
  '....B...B...',
  '....B....B..',
  '....B....B..',
  '...BB....BB.',
];
// arms thrown up, reaching for Boo
const REACH_ARMS = [
  'F..........F',
  'FF........FF',
  '.G........G.',
  '.B........B.',
  '.S........S.',
  '.B........B.',
  '.B........B.',
  '..B......B..',
];
const TORSO_UP = [
  '..BBBBBBBB..',
  '...BBBBBB...',
  '....BBBB....',
  '....BBBB....',
  '....BSSB....',
  '....BBBB....',
  '....BBBB....',
  '....BBBB....',
  '....BSSB....',
  '....BBBB....',
  '....BBBB....',
  '....B..B....',
  '....B..B....',
  '....B..B....',
  '....B..B....',
];
// on all fours: low and fast, head first
const CRAWL0 = [
  '....................FFFFFF..',
  '...................FFFFFFFF.',
  '...................FEEFFEEF.',
  '...BBBBBBBBBBBBBBB.FEEFFEEF.',
  '..BSSSSSSSSSSSSSSBBFFFFFFFF.',
  '.BSBBBBBBBBBBBBBBBFEEEEEEEEF',
  '.BB.............BBFETETETETF',
  '.B.B...........B..BFEEEEEEF.',
  '.B..B.........B.....FFFFFF..',
  'B....B.......B..............',
  'B....B.......B..............',
  'S....B.......S..............',
  'B.....B.....B...............',
  'B.....B.....B...............',
  'FF....FF....FF..............',
];
const CRAWL1 = [
  '....................FFFFFF..',
  '...................FFFFFFFF.',
  '...................FEEFFEEF.',
  '...BBBBBBBBBBBBBBB.FEEFFEEF.',
  '..BSSSSSSSSSSSSSSBBFFFFFFFF.',
  '.BSBBBBBBBBBBBBBBBFEEEEEEEEF',
  '..BB...........BB.FETETETETF',
  '..B.B.........B.B.BFEEEEEEF.',
  '..B..B.......B...B..FFFFFF..',
  '..B...B.....B....B..........',
  '..B...B.....B.....B.........',
  '..S...B.....S.....B.........',
  '.B.....B...B......B.........',
  '.B.....B...B......B.........',
  'FF.....FF.FF......FF........',
];

const GRAVE = [
  '....DDDD....',
  '..DDSSSSDD..',
  '.DSSLLLLSSD.',
  '.DSLLSSLLSD.',
  'DSSLSSSSLSSD',
  'DSSDDDDDDSSD',
  'DSSSSSSSSSSD',
  'DSDDDDDDDDSD',
  'DSSSSSSSSSSD',
  'DSSSSSSSSSSD',
  'DSLSSSSSSLSD',
  'DSSSSSSSSSSD',
  'DSSSSSSSSSSD',
  'DMSSSSSSSSMD',
  'MMMSSSSSSMMM',
  'MMMMMMMMMMMM',
];
const GRAVE_PAL = { D: '#3a3a4c', S: '#6a6a7e', L: '#9a9ab0', M: '#3e5a38' };

const CRATE = [
  'DDDDDDDDDDDDDD',
  'DLLLLLLLLLLLLD',
  'DLDWWWWWWWWDLD',
  'DLWDWWWWWWDWLD',
  'DLWWDWWWWDWWLD',
  'DLWWWDWWDWWWLD',
  'DLWWWWDDWWWWLD',
  'DLWWWWDDWWWWLD',
  'DLWWWDWWDWWWLD',
  'DLWWDWWWWDWWLD',
  'DLWDWWWWWWDWLD',
  'DLDWWWWWWWWDLD',
  'DLLLLLLLLLLLLD',
  'DDDDDDDDDDDDDD',
];
const CRATE_PAL = { D: '#4a2a14', L: '#b07a3a', W: '#7e5428' };

// salt shotgun: grey barrels, wood stock, a sprinkle of salt
const SALT_GUN = [
  '...........W..',
  'GGGGGGGGGGGG.W',
  'GLLLLLLLLLLG..',
  'GGGGGGBBBGGG.W',
  '.....BBB......',
  '....BBB.......',
  '...BBB........',
  '...BB.........',
];
const SALT_PAL = { G: '#5a5a6e', L: '#a8a8bc', B: '#8a5a2a', W: '#ffffff' };


// hospital and morgue: a wet floor sign instead of a tombstone (tombstones in a ward read wrong)
const WET_FLOOR = [
  '.....KK.....',
  '....KYYK....',
  '...KYYYYK...',
  '...KYKKYK...',
  '..KYYKKYYK..',
  '..KYYKKYYK..',
  '.KYYYKKYYYK.',
  '.KYYYYYYYYK.',
  '.KYYYKKYYYK.',
  'KYYYYKKYYYYK',
  'KYYYYYYYYYYK',
  'KKKKKKKKKKKK',
  'K..........K',
  'K..........K',
  'K..........K',
  'KK........KK',
];
const WET_PAL = { Y: '#f0c030', K: '#2a2418' };

// ---------------- v6 world traps (one per zone) ----------------
const GURNEY = [ // ward: a hospital bed rolling at you, something under the sheet
  '......WWWWW.........',
  '..WWWWWWWWWWWWWWWW..',
  '.WWSWWWWWWWWWWWWWWW.',
  'GGGGGGGGGGGGGGGGGGGG',
  'G..F...............G',
  '.G.F..............G.',
  '.G................G.',
  '.G................G.',
  'KKK..............KKK',
  '.K................K.',
];
const GURNEY_PAL = { W: '#e6e2ee', S: '#b8b2c8', G: '#7a7a90', F: '#d8d0c0', K: '#1a1824' };
const DRAWER = [ // morgue: a slab that slides out at head height
  'GGGGGGGGGGGGGGGGGGGGGG',
  'GLLLLLLLLLLLLLLLLLLLLG',
  'GWWWWWWWWWWWWWWWWWWWWG',
  'GWWWWWWWWWWWWWWWWWTTWG',
  'GWWWWWWWWWWWWWWWWWTTWG',
  'GWWWWWWWWWWWWWWWWWWWWG',
  'GLLLLLLLLLLLLLLLLLLLLG',
  'GGGGGGGGGGGGGGGGGGGGGG',
];
const DRAWER_PAL = { G: '#5a5a70', L: '#9a9ab0', W: '#dcd8e6', T: '#e8c060' };
const CHANDELIER = [ // catacombs: watch its shadow on the floor
  '.........II.........',
  '.........II.........',
  '..Y...Y..II..Y...Y..',
  '..C...C..II..C...C..',
  '..C...C.IIII.C...C..',
  'IIIIIIIIIIIIIIIIIIII',
  '.I......IIII......I.',
  '..IIIIIIIIIIIIIIII..',
  '.......I....I.......',
];
const CHANDELIER_PAL = { I: '#4a4458', Y: '#ffd75e', C: '#e8e0d0' };
const CART = [ // carnival: a coaster cart on the rails
  '..RRRRRRRRRRRRRR..',
  '.RYYYYYYYYYYYYYYR.',
  'RRRRRRRRRRRRRRRRRR',
  'RRRRRWWWRRRRRRRRRR',
  'RRRRWKKKWRRRRRRRRR',
  'RRRRRWWWRRRRRRRRRR',
  'RRRRRRRRRRRRRRRRRR',
  '.GGGGGGGGGGGGGGGG.',
  '..KK.........KK...',
  '..KK.........KK...',
];
const CART_PAL = { R: '#c83a5a', Y: '#ffd75e', W: '#ffffff', K: '#1a1824', G: '#6a6a80' };
const EYE = [ // the other side: a floating eye that bobs up and down
  '...WWWW...',
  '.WWWWWWWW.',
  'WWWVPPVWWW',
  'WWPPPPPPWW',
  'WVPPKKPPVW',
  'WVPPKKPPVW',
  'WWPPPPPPWW',
  'WWWVPPVWWW',
  '.WWWWWWWW.',
  '...WWWW...',
];
const EYE_PAL = { W: '#f4f0f8', V: '#e090a8', P: '#9a5ae0', K: '#140f24' };
const VENT = [ // sewer: a grate that blasts steam
  'GGGGGGGGGGGG',
  'GKGKGKGKGKGG',
  'GGGGGGGGGGGG',
];
const VENT_PAL = { G: '#6a7a6a', K: '#141c14' };

// ---------------- v6 weapons ----------------
const FLAME_GUN = [ // candle flamethrower
  '...........OY.',
  'RRRRRRRRRRGOYY',
  'RLLLLLLLLRG.O.',
  'RRRRRRRRRRG...',
  '..BB..........',
  '.BBB..........',
  '.BB...........',
  '.B............',
];
const FLAME_PAL = { R: '#b03a2a', L: '#e0604a', G: '#6a6a7e', O: '#ff8a2a', Y: '#ffd75e', B: '#8a5a2a' };
const SLING = [ // holy water slingshot
  'B.......B...',
  'B.......B...',
  '.B.....B....',
  '..BWWWB.....',
  '...BBB......',
  '....B....L..',
  '....B...LLL.',
  '....B...LLL.',
  '....B....L..',
];
const SLING_PAL = { B: '#8a5a2a', W: '#e8e0d0', L: '#6fb7ff' };
const BONE = [ // bone boomerang
  'FF..........',
  'FFF.........',
  '.FSF........',
  '..FSF.......',
  '...FSF......',
  '....FSF..FF.',
  '.....FSFFFFF',
  '......FFFFF.',
];
const BONE_PAL = { F: '#ece8dc', S: '#b8b0a0' };
// HUD: THE STRETCH's face for the danger meter
const STRETCH_ICON = STRETCH_ICON_ROWS();
function STRETCH_ICON_ROWS() { return [
  '.FFFFFF.',
  'FEEFFEEF',
  'FEEFFEEF',
  'FFFFFFFF',
  'EEEEEEEE',
  'ETETETET',
  '.EEEEEE.',
]; }


// the ending close-up: THE STRETCH's porcelain face, 24 x 20, a crack, red pin-prick pupils, the grin
const FACE_BIG = [ // phase 4b: tall and narrow, like the rest of it (18 x 26): high hollow eyes, a crack, a long jaw
  '......FFFFFF......',
  '....FFFFFFFFFF....',
  '...FFFFFFFCFFFF...',
  '..FFFFFFFFCFFFFF..',
  '..FFFFFFFFFCFFFF..',
  '.FFFFFFFFFFCFFFFF.',
  '.FFFFFFFFFFFFFFFF.',
  '.FEEEEFFFFFFEEEEF.',
  '.FEEEEEFFFFEEEEEF.',
  '.FEEEREFFFFEREEEF.',
  '.FEEEEEFFFFEEEEEF.',
  '.GFEEEFFFFFFEEEFG.',
  '.GFFFFFFFFFFFFFFG.',
  '..GFFFFFEEFFFFFG..',
  '..GFFFFFFFFFFFFG..',
  '..GFFFFFFFFFFFFG..',
  '..FEEEEEEEEEEEEF..',
  '..FETETETETETETF..',
  '..FEEEEEEEEEEEEF..',
  '..FEEEEEEEEEEEEF..',
  '...FEEEEEEEEEEF...',
  '...FETETETETETF...',
  '...GFEEEEEEEEFG...',
  '....GFFFFFFFFG....',
  '.....GFFFFFFG.....',
  '......GGGGGG......',
];
// the graveyard scare's hand (14 x 20): open (clawing up) and shut (closing on air)
// phase 4 round 6: crooked and broken: every finger a different length and angle, the pinky and thumb
// jut out, the ring finger hooks, the wrist leans out of the dirt
const HAND_OPEN = [
  '............N.......', '...........SN.......', '..N........SD.......', '..SN.......SD.......', '...SS.....SSD....NN.',
  '....SD.NS.SD....SSN.', '....SD..SDSD...SSD..', '.....SSSDSSD..SSD...', 'NN...SDSD.SDSSSD....', '.SSS.SDSD.SSSSD.....',
  '..SSSSSSSSSSSDD.....', '...SSSDSSSSSSSD..N..', '....SSSSSSSSSSSSSD..', '....SSSSLSSSSSSDD...', '....SDSSSSSSSDSS....',
  '.....SSSSSSSSSS.....', '.....SSSSDSSSSS.....', '......SSSSSSSS......', '.......SSSSSS.......', '.......SSSDSS.......',
  '........SSSSSS......', '........SSSSSS......', '........SSDSSSS.....', '.........SSSSSS.....', '...MMMMMMSSSSSSMMMM.',
  '..MMMMMMMMMMMMMMMMMM',
];
const HAND_SHUT = [ // a fist closing on air: uneven knuckles, nails, the thumb across
  '....................', '....................', '....................', '....................', '....................',
  '....................', '....................', '..........S.........', '......SS.SSD.SS.....', '.....SSSDSSSDSSS....',
  '....SSSDSSSSSDSSS...', '....SDSSSDSSSSSDSS..', '....SSNSSSSNSSSNSD..', '....SSSSSNSSSSSSSD..', '...SSSSDSSSSSSSDSS..',
  '...SDDDSSSSSSSSSS...', '....SSDDDDDSSSSN....', '.....SSSSSSDSSS.....', '......SSSSSSSS......', '.......SSSSSS.......',
  '.......SSSDSS.......', '........SSSSSS......', '........SSSSSS......', '........SSDSSSS.....', '.........SSSSSS.....',
  '...MMMMMMSSSSSSMMMM.', '..MMMMMMMMMMMMMMMMMM',
];
const HAND_PAL = { S: '#9fb39a', D: '#5e6e58', N: '#e8dcc0', M: '#4a3a2a' };

export function makeRunnerArt(scene) {
  px(scene, 'stretch_walk0', [...HEAD, ...TORSO, ...LEGS0], STRETCH_PAL);
  px(scene, 'stretch_walk1', [...HEAD_LEAN, ...TORSO, ...LEGS1], STRETCH_PAL);
  px(scene, 'stretch_walk2', [...HEAD, ...TORSO_B, ...LEGS2], STRETCH_PAL);
  px(scene, 'stretch_walk3', [...HEAD_LEAN, ...TORSO_B, ...LEGS3], STRETCH_PAL);
  // the grab: arms tucked (the reaching arm is drawn in code so it can stretch any length)
  px(scene, 'stretch_grab', [...HEAD_LEAN, ...TORSO_UP, ...LEGS0], STRETCH_PAL);
  px(scene, 'stretch_reach', [...REACH_ARMS, ...HEAD, ...TORSO_UP, ...LEGS0], STRETCH_PAL);
  px(scene, 'stretch_crawl0', CRAWL0, STRETCH_PAL);
  px(scene, 'stretch_crawl1', CRAWL1, STRETCH_PAL);
  px(scene, 'grave', GRAVE, GRAVE_PAL);
  px(scene, 'crate', CRATE, CRATE_PAL);
  px(scene, 'salt_gun', SALT_GUN, SALT_PAL);
  px(scene, 'gurney', GURNEY, GURNEY_PAL);
  px(scene, 'wetfloor', WET_FLOOR, WET_PAL);
  px(scene, 'drawer', DRAWER, DRAWER_PAL);
  px(scene, 'chandelier', CHANDELIER, CHANDELIER_PAL);
  px(scene, 'cart', CART, CART_PAL);
  px(scene, 'eye', EYE, EYE_PAL);
  px(scene, 'vent', VENT, VENT_PAL);
  px(scene, 'flame_gun', FLAME_GUN, FLAME_PAL);
  px(scene, 'sling', SLING, SLING_PAL);
  px(scene, 'bone', BONE, BONE_PAL);
  px(scene, 'stretch_icon', STRETCH_ICON, STRETCH_PAL);
  // phase 4: the closer it is, the hungrier it looks
  for (const st of ['m', 'n']) {
    px(scene, `stretch_walk0_${st}`, hungry([...HEAD, ...TORSO, ...LEGS0], st), STRETCH_PAL);
    px(scene, `stretch_walk1_${st}`, hungry([...HEAD_LEAN, ...TORSO, ...LEGS1], st), STRETCH_PAL);
    px(scene, `stretch_walk2_${st}`, hungry([...HEAD, ...TORSO_B, ...LEGS2], st), STRETCH_PAL);
    px(scene, `stretch_walk3_${st}`, hungry([...HEAD_LEAN, ...TORSO_B, ...LEGS3], st), STRETCH_PAL);
    px(scene, `stretch_crawl0_${st}`, hungry(CRAWL0, st), STRETCH_PAL);
    px(scene, `stretch_crawl1_${st}`, hungry(CRAWL1, st), STRETCH_PAL);
    px(scene, `stretch_icon_${st}`, ['.FFFFFF.', st === 'n' ? 'FEEFCEEF' : 'FEEFFEEF', 'FERFFREF', 'FFFFFFFF', 'EEEEEEEE', st === 'n' ? 'TTTTTTTT' : 'ETETETET', st === 'n' ? '.ETETET.' : '.EEEEEE.'], STRETCH_PAL);
  }
  // the ending close-up: its face, big (2x the head rows, hand-drawn so it reads at full screen)
  px(scene, 'stretch_face', FACE_BIG, STRETCH_PAL);
  px(scene, 'grave_hand_open', HAND_OPEN, HAND_PAL);
  px(scene, 'grave_hand_shut', HAND_SHUT, HAND_PAL);
  px(scene, 'stretch_face_lit', FACE_BIG.map((r) => r.replace(/R/g, 'E')), { ...STRETCH_PAL, F: '#fff6d8', G: '#e8d8b0', C: '#c0a878' });
}

export function makeRunnerAnims(scene) {
  const mk = (key, frames, rate) => {
    if (scene.anims.exists(key)) return;
    scene.anims.create({ key, frames: frames.map((k) => ({ key: k })), frameRate: rate, repeat: -1 });
  };
  mk('stretch_walk', ['stretch_walk0', 'stretch_walk1', 'stretch_walk2', 'stretch_walk3'], 9);
  mk('stretch_crawl', ['stretch_crawl0', 'stretch_crawl1'], 12);
  for (const st of ['m', 'n']) {
    mk(`stretch_walk_${st}`, [0, 1, 2, 3].map((i) => `stretch_walk${i}_${st}`), st === 'm' ? 11 : 13);
    mk(`stretch_crawl_${st}`, [`stretch_crawl0_${st}`, `stretch_crawl1_${st}`], st === 'm' ? 13 : 16);
  }
}

// row-width check for tests/tools: every sprite's rows must be the same width
export const RUNNER_SPRITES = {
  walk0: [...HEAD, ...TORSO, ...LEGS0], walk1: [...HEAD_LEAN, ...TORSO, ...LEGS1],
  walk2: [...HEAD, ...TORSO_B, ...LEGS2], walk3: [...HEAD_LEAN, ...TORSO_B, ...LEGS3], grab: [...HEAD_LEAN, ...TORSO_UP, ...LEGS0],
  reach: [...REACH_ARMS, ...HEAD, ...TORSO_UP, ...LEGS0], crawl0: CRAWL0, crawl1: CRAWL1,
  grave: GRAVE, crate: CRATE, salt: SALT_GUN,
  gurney: GURNEY, wetfloor: WET_FLOOR, drawer: DRAWER, chandelier: CHANDELIER, cart: CART, eye: EYE, vent: VENT,
  flame: FLAME_GUN, sling: SLING, bone: BONE, icon: STRETCH_ICON, face: FACE_BIG,
};
