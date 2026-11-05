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

const STRETCH_PAL = { B: '#2c2540', S: '#463c63', F: '#ece8f2', G: '#b9b2c8', E: '#0b0918', T: '#ffffff' };

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
  'DSSLSDDSLSSD',
  'DSSSSDDSSSSD',
  'DSDDDDDDDDSD',
  'DSSSSDDSSSSD',
  'DSSSSDDSSSSD',
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

export function makeRunnerArt(scene) {
  px(scene, 'stretch_walk0', [...HEAD, ...TORSO, ...LEGS0], STRETCH_PAL);
  px(scene, 'stretch_walk1', [...HEAD, ...TORSO, ...LEGS1], STRETCH_PAL);
  px(scene, 'stretch_reach', [...REACH_ARMS, ...HEAD, ...TORSO_UP, ...LEGS0], STRETCH_PAL);
  px(scene, 'stretch_crawl0', CRAWL0, STRETCH_PAL);
  px(scene, 'stretch_crawl1', CRAWL1, STRETCH_PAL);
  px(scene, 'grave', GRAVE, GRAVE_PAL);
  px(scene, 'crate', CRATE, CRATE_PAL);
  px(scene, 'salt_gun', SALT_GUN, SALT_PAL);
}

export function makeRunnerAnims(scene) {
  const mk = (key, frames, rate) => {
    if (scene.anims.exists(key)) return;
    scene.anims.create({ key, frames: frames.map((k) => ({ key: k })), frameRate: rate, repeat: -1 });
  };
  mk('stretch_walk', ['stretch_walk0', 'stretch_walk1'], 7);
  mk('stretch_crawl', ['stretch_crawl0', 'stretch_crawl1'], 12);
}

// row-width check for tests/tools: every sprite's rows must be the same width
export const RUNNER_SPRITES = {
  walk0: [...HEAD, ...TORSO, ...LEGS0], walk1: [...HEAD, ...TORSO, ...LEGS1],
  reach: [...REACH_ARMS, ...HEAD, ...TORSO_UP, ...LEGS0], crawl0: CRAWL0, crawl1: CRAWL1,
  grave: GRAVE, crate: CRATE, salt: SALT_GUN,
};
