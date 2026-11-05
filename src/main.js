import { W, H } from './data.js';
import { makeArt, makeAnims, makeArt2, makeAnims2 } from './art.js';
import { makeZoneArt } from './zones.js';
import { MenuScene } from './scenes/menu.js';
import { PlayScene } from './scenes/play.js';
import { OverScene } from './scenes/over.js';
import { HudScene } from './scenes/hud.js';
import { PauseScene } from './scenes/pause.js';
import { SettingsScene } from './scenes/settings.js';
import { SpinScene } from './scenes/spin.js';
import { MissionsScene } from './scenes/missions.js';
import { CharmsScene } from './scenes/charms.js';
import { StoryScene } from './scenes/story.js';
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
    // first launch: the story, then straight into the first run
    this.scene.start(Save.get().storySeen ? 'menu' : 'story');
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
    scene: [BootScene, StoryScene, MenuScene, PlayScene, HudScene, SpinScene, OverScene, PauseScene, MissionsScene, CharmsScene, SettingsScene, StatsScene, UnlocksScene],
  });
  window.__game = game;
}

start();
