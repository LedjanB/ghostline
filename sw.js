// Service worker: caches the whole game so the home screen app works offline.
// Serves from cache right away, then refreshes the cache in the background,
// so a new version shows up on the next launch.
const CACHE = 'ghostline-v6-runner-38';
const FILES = [
  './', './index.html', './manifest.webmanifest', './vendor/phaser.min.js', './fonts/press-start-2p.woff2',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  "./src/art.js",  "./src/audio.js",  "./src/data.js",  "./src/input.js",  "./src/main.js",  "./src/missions.js",  "./src/pacing.js",  "./src/run-features.js",  "./src/save.js",  "./src/scenes/charms.js",  "./src/scenes/hud.js",  "./src/scenes/menu.js",  "./src/scenes/missions.js",  "./src/scenes/over.js",  "./src/scenes/pause.js",  "./src/scenes/play.js",  "./src/scenes/settings.js",  "./src/scenes/spin.js",  "./src/scenes/stats.js",  "./src/scenes/story.js",  "./src/ui.js",  "./src/zones.js",  "./src/unlocks.js",  "./src/looks.js",  "./src/run-score.js",  "./src/scenes/unlocks.js",  "./src/runner.js",  "./src/runner-const.js",  "./src/runner-stretch.js",  "./src/runner-flight.js",  "./src/runner-weapons.js",  "./src/runner-art.js",  "./src/tricks.js",  "./src/patterns.js",  "./src/setpieces.js",  "./src/ending.js",  "./src/scares.js",  "./src/story.js",  "./src/scenes/boss.js",  "./src/scenes/matron.js",  "./src/station.js",  "./src/scenes/opening.js",  "./src/opening-art.js",  "./src/opening-audio.js",  "./src/scenes/artlab.js",  "./src/artlab-assets.js",  "./src/scenes/milolab.js",  "./src/scenes/milolab-move.js",  "./src/milo-sprite.js",  "./assets/milo/milo-living.png",  "./assets/milo/milo-ghost.png",  "./assets/milo/frames.json",  "./assets/milo/milo-sleep.png",  "./src/boo-sprite.js",  "./src/opening-encounter.js",  "./assets/boo/boo-cold.png",  "./assets/boo/boo-lit.png",  "./assets/boo/frames.json",  './src/scenes/wardlab.js',  './assets/ward4-bed7/room-plate.png',  './assets/ward4-bed7/near-pipes.png', './assets/ward4-bed7/bed-front.png', './assets/ward4-bed7/bed-body.png', './assets/ward4-bed7/cabinet.png', './assets/ward4-bed7/room-shell-v1.png', './src/scenes/prelude.js', './assets/opening-prelude/st-mercy-exterior.png', './assets/opening-prelude/ward4-corridor.png', './src/scenes/opening-v2.js', './src/scenes/escape.js', './assets/opening-prelude/room-clock.png', './assets/opening-prelude/soft-glow.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(e.request, { ignoreSearch: true });
    const fresh = fetch(e.request).then((res) => { if (res.ok) cache.put(e.request, res.clone()); return res; }).catch(() => hit);
    return hit || fresh;
  }));
});
