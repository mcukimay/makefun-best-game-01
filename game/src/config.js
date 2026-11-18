// EMBERFALL — tuning, enemy types, wave table and upgrade pool.
// One job: every number the game balances on lives here, so tuning never
// means hunting through logic files.

export const VIEW = { w: 1280, h: 720 };
export const ARENA = { x: 24, y: 86, w: 1232, h: 610 }; // playfield inside the HUD band
export const WIN_WAVE = 10;

export const PLAYER = {
  radius: 16,
  speed: 265,
  maxHp: 100,
  fireInterval: 0.16,   // seconds between shots
  bulletSpeed: 640,
  bulletDamage: 22,
  bulletRadius: 5,
  dashSpeed: 760,
  dashTime: 0.16,
  dashCooldown: 1.6,
  magnetRadius: 90,
  pickupRadius: 26,
};

// Enemy archetypes. hp/damage/speed scale with wave in world.js.
export const ENEMIES = {
  ember: {            // chaser — drifts at the player, the bread and butter
    name: 'Ember', color: '#ff5a3c', dark: '#a11f0e', radius: 15,
    hp: 30, speed: 105, damage: 10, score: 50, xp: 1, shape: 'tri',
  },
  splitter: {         // slow blob — splits into two minis on death
    name: 'Splitter', color: '#7ee081', dark: '#2c6b34', radius: 22,
    hp: 55, speed: 62, damage: 12, score: 80, xp: 2, shape: 'blob',
  },
  mini: {
    name: 'Mini', color: '#a8f0a0', dark: '#3d7a44', radius: 10,
    hp: 14, speed: 150, damage: 7, score: 25, xp: 1, shape: 'blob',
  },
  shooter: {          // keeps distance, fires aimed orbs
    name: 'Spitter', color: '#c77dff', dark: '#5a189a', radius: 16,
    hp: 40, speed: 88, damage: 8, score: 100, xp: 2, shape: 'diamond',
    shootInterval: 2.4, bulletSpeed: 210,
  },
  dasher: {           // telegraphs, then lunges fast
    name: 'Dasher', color: '#ffb703', dark: '#9c6a00', radius: 14,
    hp: 34, speed: 95, damage: 14, score: 120, xp: 2, shape: 'dart',
    lungeSpeed: 430, lungeWindup: 0.55, lungeCooldown: 2.2,
  },
  boss: {             // Magma Warden — wave 5 and wave 10 (final, stronger)
    name: 'Magma Warden', color: '#ff2e63', dark: '#7a0e2e', radius: 52,
    hp: 1400, speed: 55, damage: 22, score: 2500, xp: 25, shape: 'boss',
    shootInterval: 1.5,
  },
};

// How many of each type a wave spawns (beyond the boss on 5 / 10).
export function waveComp(wave) {
  const comp = { ember: 4 + wave * 2, splitter: 0, shooter: 0, dasher: 0 };
  if (wave >= 2) comp.splitter = 1 + Math.floor(wave / 2);
  if (wave >= 3) comp.shooter = 1 + Math.floor((wave - 1) / 2);
  if (wave >= 4) comp.dasher = Math.floor(wave / 2);
  return comp;
}

export function waveHpScale(wave) { return 1 + (wave - 1) * 0.22; }
export function waveSpeedScale(wave) { return 1 + Math.min(0.45, (wave - 1) * 0.045); }

// Upgrade cards offered on level-up. id, name, blurb, icon (drawn), apply().
export const UPGRADES = [
  { id: 'rapid',   name: 'Rapid Trigger',  icon: '»', blurb: '+22% fire rate',        apply: p => { p.fireInterval *= 0.78; } },
  { id: 'split',   name: 'Split Shot',     icon: '✦', blurb: '+1 projectile',         apply: p => { p.multishot += 1; } },
  { id: 'heavy',   name: 'Heavy Rounds',   icon: '●', blurb: '+30% bullet damage',    apply: p => { p.bulletDamage *= 1.30; } },
  { id: 'pierce',  name: 'Piercing Rounds',icon: '→', blurb: 'Shots pierce +1 enemy', apply: p => { p.pierce += 1; } },
  { id: 'swift',   name: 'Swift Boots',    icon: '≫', blurb: '+14% move speed',       apply: p => { p.speed *= 1.14; } },
  { id: 'vital',   name: 'Vital Core',     icon: '♥', blurb: '+25 max HP, heal 25',   apply: p => { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); } },
  { id: 'magnet',  name: 'Ember Magnet',   icon: '◎', blurb: '+60% pickup radius',    apply: p => { p.magnetRadius *= 1.6; } },
  { id: 'nova',    name: 'Nova Burst',     icon: '✺', blurb: 'Dash emits a shockwave',apply: p => { p.nova = true; } },
  { id: 'regen',   name: 'Phoenix Blood',  icon: '✚', blurb: 'Regenerate 1.2 HP / s',  apply: p => { p.regen += 1.2; } },
  { id: 'velocity',name: 'Hot Barrels',    icon: '↗', blurb: '+25% bullet speed',     apply: p => { p.bulletSpeed *= 1.25; } },
];

export const XP_FOR_LEVEL = level => 6 + (level - 1) * 5; // gems to next level
export const COLORS = {
  bg: '#0b0714', bg2: '#150a24', grid: 'rgba(150,110,255,0.07)',
  ember: '#ff7a18', gold: '#ffd166', cyan: '#4cc9f0', pink: '#ff2e63',
  text: '#f4ead8', dim: '#b8a8cc', panel: 'rgba(16,10,32,0.88)',
  panelEdge: 'rgba(255,150,60,0.45)', hp: '#ff4d6d', hpBg: 'rgba(255,255,255,0.14)',
  xp: '#4cc9f0',
};
