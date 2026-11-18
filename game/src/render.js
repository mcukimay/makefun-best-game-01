// Render: every pixel the game draws. Background ember field, arena,
// entities, HUD and all screens (title, upgrade cards, pause, wave-clear
// banner, game over, victory). Canvas 2D only, no assets.

import { VIEW, ARENA, WIN_WAVE, COLORS, XP_FOR_LEVEL } from './config.js';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, s, x, y, size, color, align = 'center', weight = '700', font = 'system-ui, sans-serif') {
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

function glowText(ctx, s, x, y, size, color, glow, align = 'center', weight = '800') {
  ctx.save();
  ctx.shadowColor = glow; ctx.shadowBlur = 18;
  text(ctx, s, x, y, size, color, align, weight);
  ctx.restore();
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    canvas.width = VIEW.w; canvas.height = VIEW.h;
  }

  draw(world, input) {
    const ctx = this.ctx;
    const w = world;
    ctx.save();
    // Screen shake.
    if (w.shake > 0.2) ctx.translate((Math.random() - 0.5) * w.shake, (Math.random() - 0.5) * w.shake);

    this.drawBackground(ctx, w);
    this.drawArena(ctx);

    if (w.state === 'title') { this.drawTitle(ctx, w); ctx.restore(); return; }

    this.drawPickups(ctx, w);
    this.drawEnemies(ctx, w);
    this.drawBullets(ctx, w);
    this.drawPlayer(ctx, w, input);
    this.drawParticles(ctx, w);
    this.drawFloats(ctx, w);
    this.drawHud(ctx, w);

    if (w.state === 'upgrade') this.drawUpgrade(ctx, w);
    if (w.state === 'paused') this.drawPaused(ctx, w);
    if (w.state === 'clear') this.drawClearBanner(ctx, w);
    if (w.state === 'gameover') this.drawEndScreen(ctx, w, false);
    if (w.state === 'victory') this.drawEndScreen(ctx, w, true);

    // Hurt vignette.
    if (w.flashRed > 0) {
      ctx.fillStyle = `rgba(255,30,60,${(w.flashRed * 0.45).toFixed(3)})`;
      ctx.fillRect(-20, -20, VIEW.w + 40, VIEW.h + 40);
    }
    ctx.restore();
  }

  drawBackground(ctx, w) {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW.h);
    g.addColorStop(0, '#120a20'); g.addColorStop(0.55, COLORS.bg); g.addColorStop(1, '#0a0616');
    ctx.fillStyle = g; ctx.fillRect(-20, -20, VIEW.w + 40, VIEW.h + 40);
    // Grid.
    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= VIEW.w; x += 64) { ctx.moveTo(x, 0); ctx.lineTo(x, VIEW.h); }
    for (let y = 0; y <= VIEW.h; y += 64) { ctx.moveTo(0, y); ctx.lineTo(VIEW.w, y); }
    ctx.stroke();
    // Drifting embers.
    for (const e of w.titleEmbers) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = e.hue;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.s * 0.16 + 1, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawArena(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,122,24,0.35)'; ctx.lineWidth = 2;
    rr(ctx, ARENA.x, ARENA.y, ARENA.w, ARENA.h, 14); ctx.stroke();
    ctx.strokeStyle = 'rgba(76,201,240,0.12)'; ctx.lineWidth = 6;
    rr(ctx, ARENA.x + 3, ARENA.y + 3, ARENA.w - 6, ARENA.h - 6, 12); ctx.stroke();
    ctx.restore();
  }

  drawPickups(ctx, w) {
    for (const g of w.gems) {
      const bob = Math.sin(g.bob) * 2;
      ctx.save();
      ctx.shadowColor = '#4cc9f0'; ctx.shadowBlur = 10;
      ctx.fillStyle = '#4cc9f0';
      ctx.beginPath();
      ctx.moveTo(g.x, g.y - 8 + bob); ctx.lineTo(g.x + 6, g.y + bob);
      ctx.lineTo(g.x, g.y + 8 + bob); ctx.lineTo(g.x - 6, g.y + bob);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    for (const h of w.pickups) {
      const bob = Math.sin(h.bob) * 2;
      ctx.save();
      ctx.shadowColor = '#ff4d6d'; ctx.shadowBlur = 12;
      ctx.fillStyle = '#ff4d6d';
      ctx.font = '700 20px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('♥', h.x, h.y + bob);
      ctx.restore();
    }
  }

  drawEnemies(ctx, w) {
    for (const e of w.enemies) {
      if (e.spawnT > 0) { // spawn-in shimmer
        ctx.save(); ctx.globalAlpha = 0.4 + 0.4 * Math.sin(e.spawnT * 40);
        ctx.strokeStyle = e.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.radius + 6, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        continue;
      }
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.angle);
      ctx.shadowColor = e.color; ctx.shadowBlur = 14;
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : e.color;
      ctx.strokeStyle = e.dark; ctx.lineWidth = 2.5;
      const r = e.radius;
      ctx.beginPath();
      if (e.shape === 'tri') {
        ctx.moveTo(r + 4, 0); ctx.lineTo(-r * 0.8, r * 0.85); ctx.lineTo(-r * 0.45, 0); ctx.lineTo(-r * 0.8, -r * 0.85);
      } else if (e.shape === 'diamond') {
        ctx.moveTo(r + 3, 0); ctx.lineTo(0, r * 0.8); ctx.lineTo(-r - 3, 0); ctx.lineTo(0, -r * 0.8);
      } else if (e.shape === 'dart') {
        ctx.moveTo(r + 6, 0); ctx.lineTo(-r, r * 0.6); ctx.lineTo(-r * 0.4, 0); ctx.lineTo(-r, -r * 0.6);
      } else if (e.shape === 'boss') {
        // Spiked ring: rotating outer teeth + core.
        ctx.rotate(-e.angle); // draw boss unrotated, teeth rotate separately
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 + w.time * 0.5;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82);
          ctx.lineTo(Math.cos(a + 0.14) * r * 1.18, Math.sin(a + 0.14) * r * 1.18);
          ctx.lineTo(Math.cos(a + 0.28) * r * 0.82, Math.sin(a + 0.28) * r * 0.82);
          ctx.closePath(); ctx.fill();
        }
        ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffd166';
        ctx.beginPath(); ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#7a0e2e';
        ctx.beginPath(); ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2); ctx.fill();
      } else { // blob: wobbly circle
        ctx.rotate(-e.angle);
        ctx.beginPath();
        for (let i = 0; i <= 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          const rr2 = r * (1 + 0.14 * Math.sin(a * 3 + e.wobble));
          const px = Math.cos(a) * rr2, py = Math.sin(a) * rr2;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      if (e.shape !== 'boss') { ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.restore();
      // Eyes (all but boss, which has a core).
      if (e.shape !== 'boss') {
        ctx.save();
        ctx.translate(e.x, e.y); ctx.rotate(e.angle);
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(r * 0.35, -r * 0.28, 3, 0, Math.PI * 2); ctx.arc(r * 0.35, r * 0.28, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(r * 0.35 + 1, -r * 0.28, 1.5, 0, Math.PI * 2); ctx.arc(r * 0.35 + 1, r * 0.28, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      // HP bar for tough enemies.
      if (e.maxHp > 60 && e.hp < e.maxHp) {
        const bw = e.radius * 2;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(e.x - bw / 2, e.y - e.radius - 12, bw, 5);
        ctx.fillStyle = '#ff4d6d';
        ctx.fillRect(e.x - bw / 2, e.y - e.radius - 12, bw * Math.max(0, e.hp / e.maxHp), 5);
      }
      if (e.lungeState === 'windup') {
        ctx.save(); ctx.globalAlpha = 0.7; ctx.strokeStyle = '#ffb703'; ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + Math.cos(e.angle) * 130, e.y + Math.sin(e.angle) * 130); ctx.stroke();
        ctx.restore();
      }
    }
  }

  drawBullets(ctx, w) {
    for (const b of w.bullets) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,209,102,0.5)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      const t = b.trail[0] || b;
      ctx.moveTo(t.x, t.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.shadowColor = '#ffd166'; ctx.shadowBlur = 10;
      ctx.fillStyle = '#ffe8a3';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff7a18';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.radius * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    for (const b of w.ebullets) {
      ctx.save();
      ctx.shadowColor = '#ff2e63'; ctx.shadowBlur = 12;
      ctx.fillStyle = '#ff2e63';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd6e0';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.radius * 0.45, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  drawPlayer(ctx, w, input) {
    const p = w.player;
    if (w.state === 'gameover') return;
    ctx.save();
    ctx.translate(p.x, p.y);
    // Dash cooldown ring.
    if (p.dashCooldown > 0) {
      ctx.strokeStyle = 'rgba(76,201,240,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - p.dashCooldown / 1.6));
      ctx.stroke();
    }
    // Magnet radius hint when gems nearby.
    ctx.strokeStyle = 'rgba(76,201,240,0.10)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, p.magnetRadius, 0, Math.PI * 2); ctx.stroke();
    if (p.invuln > 0 && Math.floor(w.time * 14) % 2 === 0) ctx.globalAlpha = 0.45;
    ctx.rotate(p.angle);
    ctx.shadowColor = '#4cc9f0'; ctx.shadowBlur = 16;
    ctx.fillStyle = '#e8f6ff'; ctx.strokeStyle = '#4cc9f0'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(p.radius + 6, 0);
    ctx.lineTo(-p.radius * 0.7, p.radius * 0.8);
    ctx.lineTo(-p.radius * 0.3, 0);
    ctx.lineTo(-p.radius * 0.7, -p.radius * 0.8);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff7a18';
    ctx.beginPath(); ctx.arc(2, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // Aim reticle at the mouse.
    ctx.save();
    ctx.strokeStyle = 'rgba(255,209,102,0.85)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(input.mouse.x, input.mouse.y, 10, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(input.mouse.x - 15, input.mouse.y); ctx.lineTo(input.mouse.x - 7, input.mouse.y);
    ctx.moveTo(input.mouse.x + 7, input.mouse.y); ctx.lineTo(input.mouse.x + 15, input.mouse.y);
    ctx.moveTo(input.mouse.x, input.mouse.y - 15); ctx.lineTo(input.mouse.x, input.mouse.y - 7);
    ctx.moveTo(input.mouse.x, input.mouse.y + 7); ctx.lineTo(input.mouse.x, input.mouse.y + 15);
    ctx.stroke();
    ctx.restore();
  }

  drawParticles(ctx, w) {
    for (const pt of w.parts) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (0.5 + pt.life / pt.maxLife * 0.5), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawFloats(ctx, w) {
    for (const f of w.floats) {
      ctx.globalAlpha = Math.min(1, f.life / f.maxLife * 1.6);
      text(ctx, f.text, f.x, f.y, f.size, f.color, 'center', '800');
    }
    ctx.globalAlpha = 1;
  }

  drawHud(ctx, w) {
    const p = w.player;
    // Top bar.
    ctx.fillStyle = 'rgba(10,6,20,0.85)';
    ctx.fillRect(0, 0, VIEW.w, 74);
    ctx.fillStyle = 'rgba(255,122,24,0.35)';
    ctx.fillRect(0, 74, VIEW.w, 2);

    text(ctx, 'EMBERFALL', 28, 26, 22, '#ff7a18', 'left', '900');
    text(ctx, `WAVE ${w.wave} / ${WIN_WAVE}`, 28, 54, 14, COLORS.dim, 'left', '700');

    // HP bar.
    const hx = 210, hw = 220;
    ctx.fillStyle = COLORS.hpBg; rr(ctx, hx, 16, hw, 20, 10); ctx.fill();
    ctx.fillStyle = COLORS.hp; rr(ctx, hx, 16, hw * Math.max(0, p.hp / p.maxHp), 20, 10); ctx.fill();
    text(ctx, `HP ${Math.ceil(p.hp)} / ${p.maxHp}`, hx + hw / 2, 27, 13, '#fff', 'center', '800');
    // XP bar.
    const need = XP_FOR_LEVEL(p.level);
    ctx.fillStyle = COLORS.hpBg; rr(ctx, hx, 42, hw, 12, 6); ctx.fill();
    ctx.fillStyle = COLORS.xp; rr(ctx, hx, 42, hw * Math.min(1, p.xp / need), 12, 6); ctx.fill();
    text(ctx, `LV ${p.level}   XP ${p.xp}/${need}`, hx + hw + 12, 49, 13, COLORS.xp, 'left', '700');

    // Score block, right side.
    text(ctx, `SCORE ${w.score.toLocaleString()}`, VIEW.w - 28, 24, 22, '#ffd166', 'right', '800');
    text(ctx, `KILLS ${w.kills}   BEST ${Math.max(w.best, w.score).toLocaleString()}`, VIEW.w - 28, 50, 13, COLORS.dim, 'right', '700');

    // Wave progress: enemies remaining.
    const left = w.enemies.length + w.spawnQueue.length;
    text(ctx, left > 0 ? `◈ ${left} HOSTILES REMAIN` : '◈ WAVE CLEAR', VIEW.w / 2, 26, 15, left > 0 ? '#ff8a7a' : '#7ee081', 'center', '800');
    // Dash status + weapon summary.
    const dashReady = p.dashCooldown <= 0;
    text(ctx, `DASH ${dashReady ? 'READY [SPACE]' : '…'}`, VIEW.w / 2, 50, 12, dashReady ? '#4cc9f0' : COLORS.dim, 'center', '700');
    text(ctx, `DMG ${Math.round(p.bulletDamage)}  ×${p.multishot} SHOT  PIERCE ${p.pierce}`, VIEW.w / 2, 68, 11, COLORS.dim, 'center', '600');

    // Boss health bar.
    if (w.boss) {
      const bw = 520, bx = (VIEW.w - bw) / 2, by = VIEW.h - 34;
      text(ctx, '☠ MAGMA WARDEN ☠', VIEW.w / 2, by - 14, 15, '#ff2e63', 'center', '900');
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; rr(ctx, bx, by, bw, 14, 7); ctx.fill();
      ctx.fillStyle = '#ff2e63'; rr(ctx, bx, by, bw * Math.max(0, w.boss.hp / w.boss.maxHp), 14, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; rr(ctx, bx, by, bw, 14, 7); ctx.stroke();
    }
    // Mute hint.
    text(ctx, '[P] PAUSE   [M] SOUND', 28, VIEW.h - 14, 11, 'rgba(184,168,204,0.6)', 'left', '600');
  }

  drawTitle(ctx, w) {
    // Dim the arena behind the title.
    ctx.fillStyle = 'rgba(8,4,18,0.55)';
    ctx.fillRect(-20, -20, VIEW.w + 40, VIEW.h + 40);
    const bob = Math.sin(w.titleT * 1.6) * 6;
    glowText(ctx, 'EMBERFALL', VIEW.w / 2, 168 + bob, 92, '#ffb703', '#ff7a18');
    text(ctx, 'A R E N A   R O G U E L I T E', VIEW.w / 2, 226 + bob, 20, '#ff7a18', 'center', '800');
    text(ctx, 'Survive 10 waves. Slay the Magma Warden. Forge your build.', VIEW.w / 2, 268, 18, COLORS.text, 'center', '600');

    // How-to panel.
    const px = VIEW.w / 2 - 330, py = 306, pw = 660, ph = 128;
    ctx.fillStyle = COLORS.panel; rr(ctx, px, py, pw, ph, 14); ctx.fill();
    ctx.strokeStyle = COLORS.panelEdge; ctx.lineWidth = 1.5; rr(ctx, px, py, pw, ph, 14); ctx.stroke();
    text(ctx, 'HOW TO PLAY', VIEW.w / 2, py + 24, 15, '#ffd166', 'center', '800');
    text(ctx, 'WASD / ARROWS — move      MOUSE — aim (auto-fire)', VIEW.w / 2, py + 54, 15, COLORS.text, 'center', '600');
    text(ctx, 'SPACE — dash (brief invulnerability, shockwave if Nova)', VIEW.w / 2, py + 78, 15, COLORS.text, 'center', '600');
    text(ctx, 'Collect blue gems → level up → pick 1 of 3 upgrades', VIEW.w / 2, py + 102, 15, COLORS.text, 'center', '600');

    const pulse = 0.65 + 0.35 * Math.sin(w.titleT * 4);
    ctx.globalAlpha = pulse;
    glowText(ctx, '▶  PRESS ENTER OR CLICK TO START  ◀', VIEW.w / 2, 486, 24, '#ffd166', '#ff7a18');
    ctx.globalAlpha = 1;
    text(ctx, `BEST SCORE  ${w.best.toLocaleString()}`, VIEW.w / 2, 528, 15, COLORS.dim, 'center', '700');
    text(ctx, '5 enemy types  •  2 boss fights  •  10 upgrades  •  sound on (M to mute)', VIEW.w / 2, 566, 13, COLORS.dim, 'center', '600');
    text(ctx, 'A complete game: win by clearing wave 10, lose at 0 HP — then press R to run it back.', VIEW.w / 2, 606, 13, COLORS.dim, 'center', '600');
  }

  drawUpgrade(ctx, w) {
    ctx.fillStyle = 'rgba(8,4,18,0.72)';
    ctx.fillRect(-20, -20, VIEW.w + 40, VIEW.h + 40);
    glowText(ctx, 'LEVEL UP!', VIEW.w / 2, 130, 44, '#4cc9f0', '#4cc9f0');
    text(ctx, `Level ${w.player.level} — choose one upgrade  (keys 1 / 2 / 3 or click)`, VIEW.w / 2, 176, 17, COLORS.text, 'center', '600');
    const cw = 300, ch = 210, gap = 28;
    const total = cw * 3 + gap * 2;
    const x0 = (VIEW.w - total) / 2, y0 = 220;
    w.upgradeChoices.forEach((up, i) => {
      const x = x0 + i * (cw + gap);
      ctx.fillStyle = COLORS.panel; rr(ctx, x, y0, cw, ch, 16); ctx.fill();
      ctx.strokeStyle = i === 0 ? '#ffd166' : COLORS.panelEdge; ctx.lineWidth = 2; rr(ctx, x, y0, cw, ch, 16); ctx.stroke();
      text(ctx, `[${i + 1}]`, x + cw / 2, y0 + 30, 14, COLORS.dim, 'center', '700');
      text(ctx, up.icon, x + cw / 2, y0 + 82, 52, '#ffd166', 'center', '800');
      text(ctx, up.name, x + cw / 2, y0 + 138, 20, COLORS.text, 'center', '800');
      text(ctx, up.blurb, x + cw / 2, y0 + 170, 15, '#4cc9f0', 'center', '600');
    });
    text(ctx, 'Your build so far: ' + this.buildSummary(w.player), VIEW.w / 2, 480, 14, COLORS.dim, 'center', '600');
  }

  buildSummary(p) {
    const bits = [`DMG ${Math.round(p.bulletDamage)}`, `×${p.multishot} shot`, `pierce ${p.pierce}`, `speed ${Math.round(p.speed)}`, `max HP ${p.maxHp}`];
    if (p.nova) bits.push('NOVA');
    if (p.regen > 0) bits.push(`regen ${p.regen.toFixed(1)}/s`);
    return bits.join('  •  ');
  }

  drawPaused(ctx, w) {
    ctx.fillStyle = 'rgba(8,4,18,0.7)';
    ctx.fillRect(-20, -20, VIEW.w + 40, VIEW.h + 40);
    glowText(ctx, 'PAUSED', VIEW.w / 2, 300, 56, COLORS.text, '#4cc9f0');
    text(ctx, 'Press P or ESC to resume', VIEW.w / 2, 360, 18, COLORS.dim, 'center', '600');
    text(ctx, this.buildSummary(w.player), VIEW.w / 2, 400, 14, COLORS.dim, 'center', '600');
  }

  drawClearBanner(ctx, w) {
    const a = Math.min(1, w.clearTimer);
    ctx.globalAlpha = Math.max(0.25, a);
    glowText(ctx, `WAVE ${w.wave} CLEARED`, VIEW.w / 2, 300, 52, '#7ee081', '#2c6b34');
    text(ctx, `Next wave in ${Math.ceil(w.clearTimer)}…  +12 HP restored`, VIEW.w / 2, 350, 17, COLORS.text, 'center', '600');
    ctx.globalAlpha = 1;
  }

  drawEndScreen(ctx, w, won) {
    const s = w.endStats || { score: w.score, wave: w.wave, kills: w.kills, level: w.player.level, time: 0, accuracy: 0 };
    ctx.fillStyle = won ? 'rgba(10,24,8,0.78)' : 'rgba(24,6,12,0.78)';
    ctx.fillRect(-20, -20, VIEW.w + 40, VIEW.h + 40);
    const title = won ? '👑 VICTORY — THE WARDEN FALLS 👑' : '💀 GAME OVER 💀';
    const col = won ? '#ffd166' : '#ff4d6d';
    glowText(ctx, title, VIEW.w / 2, 150, 46, col, col);
    text(ctx, won ? 'All 10 waves cleared. Emberfall is yours.' : `You fell on wave ${s.wave}. The embers remember.`, VIEW.w / 2, 200, 18, COLORS.text, 'center', '600');
    if (w.newBest) glowText(ctx, '★ NEW BEST SCORE ★', VIEW.w / 2, 238, 20, '#ffd166', '#ff7a18');

    const px = VIEW.w / 2 - 260, py = 272, pw = 520, ph = 190;
    ctx.fillStyle = COLORS.panel; rr(ctx, px, py, pw, ph, 16); ctx.fill();
    ctx.strokeStyle = COLORS.panelEdge; ctx.lineWidth = 1.5; rr(ctx, px, py, pw, ph, 16); ctx.stroke();
    const rows = [
      ['FINAL SCORE', s.score.toLocaleString()],
      ['WAVE REACHED', `${s.wave} / ${WIN_WAVE}`],
      ['ENEMIES SLAIN', String(s.kills)],
      ['LEVEL', String(s.level)],
      ['TIME SURVIVED', `${Math.floor(s.time / 60)}:${String(s.time % 60).padStart(2, '0')}`],
      ['ACCURACY', `${s.accuracy}%`],
    ];
    rows.forEach(([k, v], i) => {
      const y = py + 28 + i * 27;
      text(ctx, k, px + 28, y, 15, COLORS.dim, 'left', '700');
      text(ctx, v, px + pw - 28, y, 15, COLORS.text, 'right', '800');
    });
    const pulse = 0.65 + 0.35 * Math.sin(w.titleT * 4);
    ctx.globalAlpha = pulse;
    glowText(ctx, 'PRESS R OR ENTER TO PLAY AGAIN', VIEW.w / 2, 528, 22, '#ffd166', '#ff7a18');
    ctx.globalAlpha = 1;
    text(ctx, `Best score: ${w.best.toLocaleString()}`, VIEW.w / 2, 566, 14, COLORS.dim, 'center', '700');
  }
}
