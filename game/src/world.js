// World: the game state machine and all rules. Title → playing →
// upgrade-pick → wave-clear breather → boss → victory / game over.
// Owns spawning, collisions, XP/levels, dash, screen shake and hit-stop.

import { ARENA, VIEW, WIN_WAVE, PLAYER, waveComp, waveHpScale, XP_FOR_LEVEL, UPGRADES } from './config.js';
import { makePlayer, makeBullet, makeEnemy, makeGem, makeHeart, makeParticle, burst, makeFloatText, updateBullets, updateParticles, updateFloats, steerEnemy } from './entities.js';
import { makeRng, edgePoint } from './random.js';

export const STATES = ['title', 'playing', 'upgrade', 'clear', 'paused', 'gameover', 'victory'];

export class World {
  constructor(audio) {
    this.audio = audio;
    this.rng = makeRng((Math.random() * 1e9) | 0);
    this.reset();
  }

  reset(seed) {
    if (seed !== undefined) this.rng = makeRng(seed);
    const cx = ARENA.x + ARENA.w / 2, cy = ARENA.y + ARENA.h / 2;
    this.state = 'title';
    this.player = makePlayer(cx, cy);
    this.enemies = [];
    this.bullets = [];
    this.ebullets = [];
    this.gems = [];
    this.pickups = [];
    this.parts = [];
    this.floats = [];
    this.wave = 0;
    this.score = 0;
    this.kills = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.time = 0;
    this.waveState = 'idle';       // idle | spawning | fighting | done
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.clearTimer = 0;
    this.shake = 0;
    this.hitStop = 0;
    this.flashRed = 0;
    this.upgradeChoices = [];
    this.boss = null;
    this.bossWarned = false;
    this.best = Number(localStorage.getItem('emberfall-best') || 0);
    this.newBest = false;
    this.endStats = null;
    this.titleT = 0;
    this.ambientTimer = 0;
    // Decorative drifting embers behind the title screen.
    this.titleEmbers = [];
    for (let i = 0; i < 46; i++) {
      this.titleEmbers.push({
        x: this.rng.range(0, VIEW.w), y: this.rng.range(0, VIEW.h),
        s: this.rng.range(6, 26), v: this.rng.range(0.4, 1.6),
        drift: this.rng.range(-14, 14), hue: this.rng.pick(['#ff7a18', '#ffb703', '#ff2e63', '#ffd166']),
      });
    }
  }

  startGame() {
    this.reset();
    this.state = 'playing';
    this.audio.ensure();
    this.audio.startMusic();
    this.nextWave();
  }

  nextWave() {
    this.wave++;
    const comp = waveComp(this.wave);
    this.spawnQueue = [];
    for (const [type, n] of Object.entries(comp)) {
      for (let i = 0; i < n; i++) this.spawnQueue.push(type);
    }
    // Shuffle the queue so types arrive mixed.
    for (let i = this.spawnQueue.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng.next() * (i + 1));
      [this.spawnQueue[i], this.spawnQueue[j]] = [this.spawnQueue[j], this.spawnQueue[i]];
    }
    const isBossWave = this.wave === 5 || this.wave === WIN_WAVE;
    if (isBossWave) {
      this.bossWarned = false;
      this.floats.push(makeFloatText(VIEW.w / 2, 200, '⚠ THE MAGMA WARDEN AWAKENS ⚠', '#ff2e63', 26));
      this.audio.bossWarn();
      // Boss first, minions trickle in after.
      this.spawnQueue.unshift('boss');
    }
    this.waveState = 'spawning';
    this.spawnTimer = 0.4;
  }

  spawnOne() {
    const type = this.spawnQueue.shift();
    const p = this.player;
    const pos = edgePoint(this.rng, ARENA, p.x, p.y, type === 'boss' ? 320 : 240);
    const e = makeEnemy(type, pos.x, pos.y, this.wave);
    e.spawnT = 0.35; // brief spawn-in shimmer, no collision yet
    this.enemies.push(e);
    if (type === 'boss') {
      this.boss = e;
      this.shake = Math.max(this.shake, 10);
      burst(this.parts, pos.x, pos.y, 26, '#ff2e63', 320, 5, 0.8);
    } else {
      burst(this.parts, pos.x, pos.y, 8, e.color, 140, 3, 0.4);
    }
  }

  // --- upgrades -------------------------------------------------------

  openUpgrade() {
    const pool = [...UPGRADES];
    this.upgradeChoices = [];
    for (let i = 0; i < 3; i++) {
      const idx = Math.floor(this.rng.next() * pool.length);
      this.upgradeChoices.push(pool.splice(idx, 1)[0]);
    }
    this.state = 'upgrade';
    this.audio.levelUp();
  }

  pickUpgrade(i) {
    const up = this.upgradeChoices[i];
    if (!up) return;
    up.apply(this.player);
    this.floats.push(makeFloatText(this.player.x, this.player.y - 30, up.name + '!', '#4cc9f0', 20));
    this.audio.click();
    burst(this.parts, this.player.x, this.player.y, 22, '#4cc9f0', 260, 4, 0.7);
    this.upgradeChoices = [];
    this.state = 'playing';
  }

  gainXp(n) {
    this.player.xp += n;
    const need = XP_FOR_LEVEL(this.player.level);
    if (this.player.xp >= need) {
      this.player.xp -= need;
      this.player.level++;
      this.openUpgrade();
    }
  }

  // --- combat ---------------------------------------------------------

  fireBullet() {
    const p = this.player;
    const aim = Math.atan2(this.mouseY - p.y, this.mouseX - p.x);
    p.angle = aim;
    const n = p.multishot;
    const spread = 0.13;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * spread;
      const a = aim + off;
      const bx = p.x + Math.cos(a) * (p.radius + 8);
      const by = p.y + Math.sin(a) * (p.radius + 8);
      this.bullets.push(makeBullet(bx, by, Math.cos(a) * p.bulletSpeed, Math.sin(a) * p.bulletSpeed, p.bulletDamage, p.pierce, true));
    }
    this.shotsFired += n;
    this.audio.shoot();
    burst(this.parts, p.x + Math.cos(aim) * 24, p.y + Math.sin(aim) * 24, 2, '#ffd166', 120, 3, 0.2);
  }

  dash() {
    const p = this.player;
    if (p.dashCooldown > 0 || this.state !== 'playing') return;
    const mv = this.moveVec;
    const dir = (mv.x || mv.y) ? mv : { x: Math.cos(p.angle), y: Math.sin(p.angle) };
    p.dashDir = dir;
    p.dashTimer = PLAYER.dashTime;
    p.dashCooldown = PLAYER.dashCooldown;
    p.invuln = Math.max(p.invuln, 0.28);
    this.audio.dash();
    burst(this.parts, p.x, p.y, 10, '#4cc9f0', 200, 4, 0.4);
    if (p.nova) {
      // Shockwave: damage + knockback everything nearby.
      burst(this.parts, p.x, p.y, 30, '#ffb703', 420, 5, 0.6);
      this.shake = Math.max(this.shake, 6);
      for (const e of this.enemies) {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < 190) {
          this.damageEnemy(e, 45, e.x, e.y);
          const k = 340 / Math.max(40, d);
          e.vx += (e.x - p.x) / d * k * 10; e.vy += (e.y - p.y) / d * k * 10;
        }
      }
    }
  }

  damageEnemy(e, dmg, hx, hy) {
    e.hp -= dmg;
    e.flash = 0.09;
    this.shotsHit++;
    this.floats.push(makeFloatText(hx, hy, String(Math.round(dmg)), '#ffe8a3', 14));
    burst(this.parts, hx, hy, 3, e.color, 160, 3, 0.35);
    if (e.hp <= 0) this.killEnemy(e);
    else this.audio.enemyHit();
  }

  killEnemy(e) {
    const idx = this.enemies.indexOf(e);
    if (idx >= 0) this.enemies.splice(idx, 1);
    this.kills++;
    this.player.kills++;
    this.score += e.score;
    this.audio.enemyDie();
    burst(this.parts, e.x, e.y, e.type === 'boss' ? 60 : 16, e.color, 300, 5, 0.7);
    burst(this.parts, e.x, e.y, 8, '#ffd166', 200, 4, 0.5);
    this.shake = Math.max(this.shake, e.type === 'boss' ? 14 : 3);
    this.hitStop = Math.max(this.hitStop, e.type === 'boss' ? 0.12 : 0.03);
    // Drops: XP gems always; hearts sometimes.
    const gems = e.xp;
    for (let i = 0; i < gems; i++) {
      const a = this.rng.next() * Math.PI * 2, d = this.rng.range(4, 26);
      this.gems.push(makeGem(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, 1));
    }
    if (this.rng.chance(e.type === 'boss' ? 1 : 0.06)) this.pickups.push(makeHeart(e.x, e.y));
    if (e.type === 'splitter') {
      for (let i = 0; i < 2; i++) {
        const m = makeEnemy('mini', e.x + (i ? 14 : -14), e.y, this.wave);
        this.enemies.push(m);
      }
    }
    if (e.type === 'boss') {
      this.boss = null;
      this.score += 500;
      this.floats.push(makeFloatText(e.x, e.y - 40, 'WARDEN SLAIN  +2500', '#ffd166', 24));
      for (let i = 0; i < 10; i++) {
        const a = this.rng.next() * Math.PI * 2, d = this.rng.range(10, 60);
        this.gems.push(makeGem(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, 1));
      }
    }
  }

  hurtPlayer(dmg, sx, sy) {
    const p = this.player;
    if (p.invuln > 0 || this.state !== 'playing') return;
    p.hp -= dmg;
    p.invuln = 0.6;
    this.flashRed = 0.35;
    this.shake = Math.max(this.shake, 7);
    this.audio.playerHurt();
    burst(this.parts, p.x, p.y, 14, '#ff4d6d', 260, 4, 0.5);
    if (p.hp <= 0) {
      p.hp = 0;
      this.endGame(false);
    }
  }

  endGame(won) {
    this.state = won ? 'victory' : 'gameover';
    this.waveState = 'done';
    const acc = this.shotsFired ? Math.round(100 * this.shotsHit / this.shotsFired) : 0;
    this.endStats = {
      won, score: this.score, wave: this.wave, kills: this.kills,
      level: this.player.level, time: Math.round(this.time), accuracy: acc,
    };
    if (this.score > this.best) {
      this.best = this.score; this.newBest = true;
      localStorage.setItem('emberfall-best', String(this.best));
    }
    burst(this.parts, this.player.x, this.player.y, 50, won ? '#ffd166' : '#ff4d6d', 380, 6, 1.0);
    if (won) this.audio.victory(); else this.audio.gameOver();
  }

  // --- main update ----------------------------------------------------

  update(dt, input) {
    this.mouseX = input.mouse.x; this.mouseY = input.mouse.y;
    this.moveVec = input.moveVector();
    this.titleT += dt;
    for (const e of this.titleEmbers) {
      e.y -= e.v * dt * 22; e.x += e.drift * dt;
      if (e.y < -30) { e.y = VIEW.h + 20; e.x = this.rng.range(0, VIEW.w); }
    }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 26);
    if (this.flashRed > 0) this.flashRed -= dt;
    if (this.hitStop > 0) { this.hitStop -= dt; return; } // freeze frame = impact

    updateParticles(this.parts, dt);
    updateFloats(this.floats, dt);

    if (this.state === 'title') {
      if (input.wasPressed('Enter', ' ')) { this.audio.ensure(); this.startGame(); }
      return;
    }
    if (this.state === 'gameover' || this.state === 'victory') {
      if (input.wasPressed('Enter', 'r', 'R')) this.startGame();
      return;
    }
    if (this.state === 'paused') {
      if (input.wasPressed('p', 'P', 'Escape')) this.state = 'playing';
      return;
    }
    if (this.state === 'upgrade') {
      if (input.wasPressed('1')) this.pickUpgrade(0);
      else if (input.wasPressed('2')) this.pickUpgrade(1);
      else if (input.wasPressed('3')) this.pickUpgrade(2);
      return;
    }
    if (this.state === 'clear') {
      // Breather between waves: banner shows, timer runs, then next wave.
      this.clearTimer -= dt;
      if (this.clearTimer <= 0) { this.state = 'playing'; this.nextWave(); }
      return;
    }
    if (this.state !== 'playing') return;

    // Pause / mute / dash.
    if (input.wasPressed('p', 'P', 'Escape')) { this.state = 'paused'; return; }
    if (input.wasPressed('m', 'M')) this.audio.toggleMute();
    if (input.wasPressed(' ', 'Shift')) this.dash();

    this.time += dt;
    const p = this.player;

    // Movement + dash.
    if (p.dashTimer > 0) {
      p.dashTimer -= dt;
      p.vx = p.dashDir.x * PLAYER.dashSpeed;
      p.vy = p.dashDir.y * PLAYER.dashSpeed;
    } else {
      p.vx = this.moveVec.x * p.speed;
      p.vy = this.moveVec.y * p.speed;
    }
    p.x = Math.min(ARENA.x + ARENA.w - p.radius, Math.max(ARENA.x + p.radius, p.x + p.vx * dt));
    p.y = Math.min(ARENA.y + ARENA.h - p.radius, Math.max(ARENA.y + p.radius, p.y + p.vy * dt));
    p.angle = Math.atan2(this.mouseY - p.y, this.mouseX - p.x);
    if (p.dashCooldown > 0) p.dashCooldown -= dt;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.regen > 0) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);

    // Auto-fire at the mouse aim.
    p.fireTimer -= dt;
    if (p.fireTimer <= 0) { this.fireBullet(); p.fireTimer = p.fireInterval; }

    // Spawning.
    if (this.waveState === 'spawning') {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        if (this.spawnQueue.length) { this.spawnOne(); this.spawnTimer = Math.max(0.25, 0.9 - this.wave * 0.05); }
        else this.waveState = 'fighting';
      }
    }

    // Enemies.
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.spawnT > 0) { e.spawnT -= dt; continue; }
      if (e.flash > 0) e.flash -= dt;
      if (e.contactCooldown > 0) e.contactCooldown -= dt;
      steerEnemy(e, p, dt, this.rng, this.ebullets);
      e.x += e.vx * dt; e.y += e.vy * dt;
      e.x = Math.min(ARENA.x + ARENA.w - e.radius, Math.max(ARENA.x + e.radius, e.x));
      e.y = Math.min(ARENA.y + ARENA.h - e.radius, Math.max(ARENA.y + e.radius, e.y));
      // Touch damage (once per 0.7s per enemy).
      if (e.contactCooldown <= 0 && Math.hypot(e.x - p.x, e.y - p.y) < e.radius + p.radius - 2) {
        e.contactCooldown = 0.9;
        this.hurtPlayer(e.damage, e.x, e.y);
      }
    }

    // Bullets vs enemies.
    updateBullets(this.bullets, dt, ARENA);
    updateBullets(this.ebullets, dt, ARENA);
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      let consumed = false;
      for (const e of this.enemies) {
        if (e.spawnT > 0) continue;
        if (Math.hypot(b.x - e.x, b.y - e.y) < b.radius + e.radius) {
          this.damageEnemy(e, b.damage, b.x, b.y);
          if (b.pierce > 0) { b.pierce--; } else { consumed = true; }
          break;
        }
      }
      if (consumed) this.bullets.splice(i, 1);
    }
    // Enemy bullets vs player.
    for (let i = this.ebullets.length - 1; i >= 0; i--) {
      const b = this.ebullets[i];
      if (Math.hypot(b.x - p.x, b.y - p.y) < b.radius + p.radius - 2) {
        this.ebullets.splice(i, 1);
        this.hurtPlayer(b.damage, b.x, b.y);
      }
    }

    // Gems: magnet toward player, collect.
    for (let i = this.gems.length - 1; i >= 0; i--) {
      const g = this.gems[i];
      g.bob += dt * 5;
      const d = Math.hypot(p.x - g.x, p.y - g.y);
      if (d < p.magnetRadius) {
        const pull = 520 * (1 - d / (p.magnetRadius + 60));
        g.x += (p.x - g.x) / d * pull * dt;
        g.y += (p.y - g.y) / d * pull * dt;
      }
      if (d < p.pickupRadius) {
        this.gems.splice(i, 1);
        this.audio.pickup();
        this.gainXp(g.value);
        if (this.state !== 'playing') return; // level-up opened the picker
      }
    }
    // Hearts heal.
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const h = this.pickups[i];
      h.bob += dt * 5;
      if (Math.hypot(p.x - h.x, p.y - h.y) < p.pickupRadius + 6) {
        this.pickups.splice(i, 1);
        p.hp = Math.min(p.maxHp, p.hp + 30);
        this.floats.push(makeFloatText(p.x, p.y - 28, '+30 HP', '#7ee081', 18));
        this.audio.pickup();
      }
    }

    // Wave cleared?
    if (this.waveState === 'fighting' && this.enemies.length === 0 && this.spawnQueue.length === 0) {
      if (this.wave >= WIN_WAVE) { this.endGame(true); return; }
      this.waveState = 'done';
      this.clearTimer = 2.6;
      this.state = 'clear';
      const bonus = 100 + this.wave * 50;
      this.score += bonus;
      p.hp = Math.min(p.maxHp, p.hp + 12);
      this.floats.push(makeFloatText(VIEW.w / 2, 260, `WAVE ${this.wave} CLEARED  +${bonus}`, '#ffd166', 24));
      this.audio.waveClear();
    }
    // (clear-state countdown handled near the top of update)
  }
}
