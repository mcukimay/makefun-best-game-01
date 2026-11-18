// Entities: player, bullets (player + enemy), enemies, pickups (XP gems,
// hearts), particles and floating damage numbers. Pure data + update
// helpers; spawning rules and collisions live in world.js.

import { ENEMIES } from './config.js';

let nextId = 1;

export function makePlayer(x, y) {
  return {
    id: nextId++, kind: 'player', x, y, vx: 0, vy: 0, radius: 16,
    angle: -Math.PI / 2, speed: 265, hp: 100, maxHp: 100,
    fireInterval: 0.16, fireTimer: 0, bulletSpeed: 640, bulletDamage: 22,
    multishot: 1, pierce: 0, magnetRadius: 90, regen: 0, nova: false,
    dashTimer: 0, dashCooldown: 0, dashDir: { x: 1, y: 0 }, invuln: 0,
    level: 1, xp: 0, kills: 0,
  };
}

export function makeBullet(x, y, vx, vy, damage, pierce, friendly = true) {
  return {
    id: nextId++, kind: friendly ? 'bullet' : 'ebullet',
    x, y, vx, vy, radius: friendly ? 5 : 7, damage, pierce,
    life: 1.6, friendly, trail: [],
  };
}

export function makeEnemy(type, x, y, wave) {
  const t = ENEMIES[type];
  const hpScale = 1 + (wave - 1) * 0.22;
  const spScale = 1 + Math.min(0.45, (wave - 1) * 0.045);
  const bossBoost = type === 'boss' && wave >= 10 ? 1.6 : 1;
  return {
    id: nextId++, kind: 'enemy', type, x, y, vx: 0, vy: 0,
    radius: t.radius, hp: t.hp * hpScale * bossBoost, maxHp: t.hp * hpScale * bossBoost,
    speed: t.speed * spScale, damage: t.damage, score: t.score, xp: t.xp,
    color: t.color, dark: t.dark, shape: t.shape,
    shootTimer: t.shootInterval ?? 0, shootInterval: t.shootInterval ?? 0,
    lungeTimer: 1.2, lungeState: 'roam', lungeWindup: 0, flash: 0,
    angle: 0, wobble: Math.random() * Math.PI * 2, spawnT: 0,
    contactCooldown: 0,
  };
}

export function makeGem(x, y, value) {
  return { id: nextId++, kind: 'gem', x, y, vx: 0, vy: 0, radius: 7, value, bob: Math.random() * 6 };
}

export function makeHeart(x, y) {
  return { id: nextId++, kind: 'heart', x, y, vx: 0, vy: 0, radius: 10, bob: Math.random() * 6 };
}

export function makeParticle(x, y, vx, vy, life, size, color, drag = 0.92) {
  return { id: nextId++, kind: 'particle', x, y, vx, vy, life, maxLife: life, size, color, drag };
}

export function burst(parts, x, y, n, color, speed = 220, size = 4, life = 0.6) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.9);
    parts.push(makeParticle(x, y, Math.cos(a) * s, Math.sin(a) * s,
      life * (0.5 + Math.random() * 0.8), size * (0.6 + Math.random() * 0.8), color));
  }
}

export function makeFloatText(x, y, text, color = '#ffd166', size = 15) {
  return { id: nextId++, kind: 'float', x, y, text, color, size, life: 0.9, maxLife: 0.9 };
}

// --- per-frame entity updates (movement, timers, lifetimes) ---

export function updateBullets(bullets, dt, arena) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > 5) b.trail.shift();
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < arena.x - 20 || b.x > arena.x + arena.w + 20 ||
        b.y < arena.y - 20 || b.y > arena.y + arena.h + 20) bullets.splice(i, 1);
  }
}

export function updateParticles(parts, dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= p.drag; p.vy *= p.drag;
    p.life -= dt;
    if (p.life <= 0) parts.splice(i, 1);
  }
}

export function updateFloats(floats, dt) {
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.y -= 42 * dt; f.life -= dt;
    if (f.life <= 0) floats.splice(i, 1);
  }
}

// Enemy steering per archetype. Returns nothing; mutates e.vx/vy and may
// push an enemy bullet into ebullets.
export function steerEnemy(e, player, dt, rng, ebullets) {
  const dx = player.x - e.x, dy = player.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist, ny = dy / dist;
  e.wobble += dt * 2;

  if (e.type === 'shooter') {
    // Keep ~260px away, strafe, fire aimed orbs.
    const want = 260;
    const radial = dist < want - 40 ? -1 : dist > want + 40 ? 1 : 0;
    const strafe = Math.sin(e.wobble) * 0.7;
    e.vx = (nx * radial + -ny * strafe) * e.speed;
    e.vy = (ny * radial + nx * strafe) * e.speed;
    e.shootTimer -= dt;
    if (e.shootTimer <= 0 && dist < 560) {
      e.shootTimer = e.shootInterval * (0.85 + rng.next() * 0.3);
      const bs = 210;
      ebullets.push(makeBullet(e.x, e.y, nx * bs, ny * bs, e.damage, 0, false));
    }
  } else if (e.type === 'dasher') {
    e.lungeTimer -= dt;
    if (e.lungeState === 'roam') {
      e.vx = nx * e.speed; e.vy = ny * e.speed;
      if (e.lungeTimer <= 0 && dist < 420 && dist > 90) {
        e.lungeState = 'windup'; e.lungeWindup = 0.55;
        e.lungeDir = { x: nx, y: ny };
      }
    } else if (e.lungeState === 'windup') {
      e.vx *= 0.8; e.vy *= 0.8;
      e.lungeWindup -= dt;
      if (e.lungeWindup <= 0) { e.lungeState = 'lunge'; e.lungeTimer = 0.32; }
    } else { // lunge
      e.vx = e.lungeDir.x * 430; e.vy = e.lungeDir.y * 430;
      if (e.lungeTimer <= 0) { e.lungeState = 'roam'; e.lungeTimer = 2.2; }
    }
  } else if (e.type === 'boss') {
    // Slow chase + radial bursts + aimed spreads.
    e.vx = nx * e.speed; e.vy = ny * e.speed;
    e.shootTimer -= dt;
    if (e.shootTimer <= 0) {
      e.shootTimer = e.shootInterval;
      const n = 8 + Math.floor(rng.next() * 4);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rng.next() * 0.3;
        ebullets.push(makeBullet(e.x, e.y, Math.cos(a) * 170, Math.sin(a) * 170, 12, 0, false));
      }
      for (let k = -1; k <= 1; k++) {
        const a = Math.atan2(dy, dx) + k * 0.22;
        ebullets.push(makeBullet(e.x, e.y, Math.cos(a) * 260, Math.sin(a) * 260, 14, 0, false));
      }
    }
  } else {
    // ember / splitter / mini: chase with a slight sine wobble.
    const wob = Math.sin(e.wobble) * 0.35;
    e.vx = (nx + -ny * wob) * e.speed;
    e.vy = (ny + nx * wob) * e.speed;
  }
  e.angle = Math.atan2(e.vy, e.vx);
}
