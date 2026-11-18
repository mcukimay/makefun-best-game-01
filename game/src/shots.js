// Screenshot presets: ?shot=start|play|boss|end&seed=N puts the game into
// a staged, deterministic state so screenshots are real renders of the
// game's own code (the kit's starter does the same via shots.json).
// Live players never see these — no query string means normal play.

import { ARENA, VIEW } from './config.js';
import { makeEnemy, makeGem, burst, makeFloatText } from './entities.js';

function placeEnemies(world, spec) {
  // spec: [[type, x, y], ...] — exact positions for a readable composition.
  for (const [type, x, y] of spec) {
    const e = makeEnemy(type, x, y, world.wave);
    e.spawnT = 0;
    world.enemies.push(e);
    burst(world.parts, x, y, 6, e.color, 120, 3, 0.4);
  }
}

export function applyShot(world, input, shot, seed) {
  if (!shot) return false;
  world.reset(seed);
  const p = world.player;
  if (shot === 'start') {
    world.state = 'title';
    return true;
  }
  if (shot === 'play') {
    world.state = 'playing';
    world.wave = 3; world.waveState = 'fighting';
    world.score = 12450; world.kills = 47;
    p.hp = 78; p.level = 4; p.xp = 9;
    p.multishot = 2; p.bulletDamage = 29; p.pierce = 1;
    p.x = 620; p.y = 400; p.angle = -0.4;
    input.mouse.x = 950; input.mouse.y = 260;
    placeEnemies(world, [
      ['ember', 980, 240], ['ember', 900, 330], ['ember', 760, 180],
      ['shooter', 1020, 420], ['shooter', 420, 220],
      ['splitter', 300, 480], ['splitter', 1080, 540],
      ['dasher', 520, 560], ['dasher', 830, 520],
      ['ember', 350, 300], ['mini', 700, 300], ['mini', 740, 340],
    ]);
    for (let i = 0; i < 14; i++) world.gems.push(makeGem(560 + (i % 7) * 26, 430 + Math.floor(i / 7) * 24, 1));
    // A volley already in flight + muzzle particles, so the frame reads as action.
    world.fireBullet();
    burst(world.parts, 900, 300, 10, '#ff5a3c', 200, 4, 0.5);
    burst(world.parts, 420, 220, 10, '#c77dff', 200, 4, 0.5);
    world.floats.push(makeFloatText(980, 210, '50', '#ffe8a3', 15));
    return true;
  }
  if (shot === 'boss') {
    world.state = 'playing';
    world.wave = 5; world.waveState = 'fighting';
    world.score = 21800; world.kills = 89;
    p.hp = 64; p.level = 6; p.xp = 4;
    p.multishot = 3; p.bulletDamage = 34; p.pierce = 1;
    p.x = 640; p.y = 560; p.angle = -Math.PI / 2;
    input.mouse.x = 640; input.mouse.y = 220;
    const boss = makeEnemy('boss', 640, 240, 5);
    boss.hp = boss.maxHp * 0.42; boss.spawnT = 0;
    world.enemies.push(boss);
    world.boss = boss;
    placeEnemies(world, [
      ['ember', 420, 300], ['ember', 860, 300],
      ['shooter', 300, 200], ['shooter', 980, 200],
      ['dasher', 520, 420], ['mini', 760, 430],
    ]);
    world.fireBullet();
    burst(world.parts, 640, 300, 18, '#ff2e63', 260, 5, 0.6);
    world.floats.push(makeFloatText(640, 140, 'WARDEN AT 42%', '#ff2e63', 18));
    return true;
  }
  if (shot === 'end') {
    world.state = 'victory';
    world.wave = 10; world.score = 48250; world.kills = 214;
    p.level = 9;
    world.endStats = { won: true, score: 48250, wave: 10, kills: 214, level: 9, time: 742, accuracy: 68 };
    world.best = 48250; world.newBest = true;
    burst(world.parts, 640, 360, 40, '#ffd166', 300, 5, 0.9);
    burst(world.parts, 400, 300, 20, '#ff7a18', 240, 4, 0.8);
    burst(world.parts, 880, 300, 20, '#4cc9f0', 240, 4, 0.8);
    return true;
  }
  return false;
}
