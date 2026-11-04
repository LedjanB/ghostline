import { W, H } from './data.js';
import { makeArt, makeAnims, makeArt2, makeAnims2 } from './art.js';
import { MenuScene } from './scenes/menu.js';
import { PlayScene } from './scenes/play.js';
import { OverScene } from './scenes/over.js';
import { HudScene } from './scenes/hud.js';
import { PauseScene } from './scenes/pause.js';
import { SettingsScene } from './scenes/settings.js';
import { SpinScene } from './scenes/spin.js';
import { MissionsScene } from './scenes/missions.js';
import { CharmsScene } from './scenes/charms.js';

class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }
  create() {
    makeArt(this);
    makeAnims(this);
    makeArt2(this);
    makeAnims2(this);
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
    scene: [BootScene, MenuScene, PlayScene, HudScene, SpinScene, OverScene, PauseScene, MissionsScene, CharmsScene, SettingsScene],
  });
  window.__game = game;
}

start();
