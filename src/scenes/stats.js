// Lifetime stats: what you've done and what keeps killing you.
import { W, H, ZONES } from '../data.js';
import { Save } from '../save.js';
import { text, button, focusGroup } from '../ui.js';
import { createInput } from '../input.js';

const CAUSES = { beam: 'SPIRIT BEAMS', hand: 'GRABBY HANDS', swing: 'SWINGING THINGS', banshee: 'BANSHEES', laser: 'LASERS', dark: 'THE DARK' };

export class StatsScene extends Phaser.Scene {
  constructor() { super('stats'); }

  init(data) { this.from = data.from; }

  create() {
    const s = Save.get();
    const st = s.stats;
    this.add.rectangle(0, 0, W, H, 0x07060d).setOrigin(0).setAlpha(0.95).setInteractive();
    text(this, W / 2, 28, 'STATS', 24, '#ffd75e');
    const rows = [
      ['RUNS', st.runs], ['BEST', `${s.best}M`], ['TOTAL DISTANCE', `${st.meters}M`],
      ['CANDLES GRABBED', st.candles], ['CLOSE CALLS', st.nearMisses], ['GRAVE SPINS', st.spins],
      ['SECOND CHANCES', st.revives], ['DEEPEST PLACE', ZONES[st.maxZone].name],
    ];
    rows.forEach(([k, v], i) => {
      text(this, 60, 64 + i * 22, k, 16, '#a99fd0', 0);
      text(this, W - 60, 64 + i * 22, `${v}`, 16, '#e6f0ff', 1);
    });
    const deaths = Object.entries(st.deaths).sort((a, b) => b[1] - a[1]);
    text(this, W / 2, 252, deaths.length ? `KILLED MOST BY: ${CAUSES[deaths[0][0]] || deaths[0][0]} (${deaths[0][1]})` : 'NOTHING HAS KILLED YOU YET', 16, '#ff7a8a');
    if (deaths.length > 1) text(this, W / 2, 276, deaths.slice(1, 4).map(([k, v]) => `${(CAUSES[k] || k).split(' ').pop()} ${v}`).join('   '), 8, '#a99fd0');
    this.group = focusGroup(this, [button(this, W / 2, 322, 'BACK', () => this.close(), { w: 180, h: 32 })]);
    this.inputMap = createInput(this);
  }

  update() {
    this.inputMap.update();
    this.group.handle(this.inputMap);
    if (this.inputMap.pressed('back')) this.close();
  }

  close() { this.scene.stop(); this.scene.resume(this.from); }
}
