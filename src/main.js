import { W, H } from './data.js';
import { makeArt, makeAnims, makeArt2, makeAnims2 } from './art.js';
import { makeZoneArt } from './zones.js';
import { MenuScene } from './scenes/menu.js';
import { PlayScene } from './scenes/play.js';
import { BossScene } from './scenes/boss.js';
import { OverScene } from './scenes/over.js';
import { HudScene } from './scenes/hud.js';
import { PauseScene } from './scenes/pause.js';
import { SettingsScene } from './scenes/settings.js';
import { SpinScene } from './scenes/spin.js';
import { MissionsScene } from './scenes/missions.js';
import { CharmsScene } from './scenes/charms.js';
import { StoryScene } from './scenes/story.js';
import { OpeningScene } from './scenes/opening.js';
import { ArtLabScene } from './scenes/artlab.js';
import { MiloLabScene } from './scenes/milolab.js';
import { WardLabScene } from './scenes/wardlab.js';
import { StatsScene } from './scenes/stats.js';
import { UnlocksScene } from './scenes/unlocks.js';
import { Save } from './save.js';
import { makeRunnerArt, makeRunnerAnims } from './runner-art.js';

class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }
  create() {
    makeArt(this);
    makeAnims(this);
    makeArt2(this);
    makeZoneArt(this);
    makeAnims2(this);
    makeRunnerArt(this);
    makeRunnerAnims(this);
    const loading = document.getElementById('loading');
    if (loading) loading.remove();
    // first launch: the playable opening (THE WRONG SIDE OF THE BED); ?opening=1 replays it
    // ?artlab=1: the Visual Art Benchmark (isolated preview, docs/visual-target-v1.md)
    if (new URLSearchParams(location.search).get('artlab') === '1') { this.scene.start('artlab'); return; }
    // ?milolab=1: THE NEW MILO, animation prototype V1 (isolated preview, docs/milo-approved-art-brief.md)
    if (new URLSearchParams(location.search).get('milolab') === '1') { this.scene.start('milolab'); return; }
    if (new URLSearchParams(location.search).get('wardlab') === '1') { this.scene.start('wardlab'); return; }
    const replay = new URLSearchParams(location.search).get('opening') === '1';
    this.scene.start(replay || !Save.get().storySeen ? 'opening' : 'menu');
  }
}

// If anything throws, show a way out instead of a frozen screen, and keep a short local log.
function showCrash(msg) {
  try {
    const log = JSON.parse(localStorage.getItem('ghostline-errors') || '[]');
    log.push({ t: Date.now(), msg: String(msg).slice(0, 300) });
    localStorage.setItem('ghostline-errors', JSON.stringify(log.slice(-20)));
  } catch (e) { /* storage blocked */ }
  if (document.getElementById('gl-crash')) return;
  const d = document.createElement('div');
  d.id = 'gl-crash';
  d.style.cssText = 'position:fixed;inset:auto 0 0 0;z-index:30;padding:14px;background:#140f24;color:#e6f0ff;font:12px monospace;text-align:center;border-top:3px solid #ff5577;';
  d.textContent = 'Something broke. Tap here to reload. Your progress is saved.';
  d.onclick = () => location.reload();
  document.body.appendChild(d);
}
window.addEventListener('error', (e) => showCrash(e.message));
window.addEventListener('unhandledrejection', (e) => { try { const log = JSON.parse(localStorage.getItem('ghostline-errors') || '[]'); log.push({ t: Date.now(), msg: 'promise: ' + String(e.reason).slice(0, 200) }); localStorage.setItem('ghostline-errors', JSON.stringify(log.slice(-20))); } catch (err) { /* ignore */ } });

async function start() {
  // Wait for the pixel font so text doesn't render in a fallback font.
  try {
    await Promise.race([
      document.fonts.load('16px "Press Start 2P"'),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch (e) { /* ignore */ }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: W,
    height: H,
    backgroundColor: '#07060d',
    pixelArt: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 3, gamepad: true },
    // draw order = list order: run, then HUD, then overlays on top
    scene: [BootScene, StoryScene, OpeningScene, ArtLabScene, MiloLabScene, WardLabScene, MenuScene, PlayScene, HudScene, BossScene, SpinScene, OverScene, PauseScene, MissionsScene, CharmsScene, SettingsScene, StatsScene, UnlocksScene],
  });
  window.__game = game;
  // playtest link: ?boss=matron (&act=2 or 3) opens that fight right away, then goes back to the menu
  const q = new URLSearchParams(location.search), boss = q.get('boss');
  if (boss === 'matron' || boss === 'coroner') {
    const go = () => {
      if (!game.scene.isActive('menu') && !game.scene.isActive('story') && !game.scene.isActive('opening')) { setTimeout(go, 100); return; }
      game.scene.getScenes(true).forEach((s) => s.scene.stop());
      setTimeout(() => game.scene.start('boss', {
        boss, phase: Number(q.get('act')) || 1, char: 'survivor',
        powers: boss === 'coroner' ? ['penlight', 'sheet'] : ['penlight'],
        onEnd: () => game.scene.start('menu'),
      }), 60);
    };
    go();
  }
}

start();
