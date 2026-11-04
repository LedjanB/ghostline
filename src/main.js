import { W, H } from './data.js';
import { makeArt, makeAnims } from './art.js';
import { MenuScene } from './scenes/menu.js';
import { PlayScene } from './scenes/play.js';
import { OverScene } from './scenes/over.js';
import { HudScene } from './scenes/hud.js';
import { PauseScene } from './scenes/pause.js';
import { SettingsScene } from './scenes/settings.js';

class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }
  create() {
    makeArt(this);
    makeAnims(this);
    const loading = document.getElementById('loading');
    if (loading) loading.remove();
    this.scene.start('menu');
  }
}

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
    scene: [BootScene, MenuScene, PlayScene, HudScene, OverScene, PauseScene, SettingsScene],
  });
  window.__game = game;
}

start();
