// EMBERFALL — entry point. Wires input, world, renderer and audio into a
// requestAnimationFrame loop with a fixed-step accumulator (stable physics
// at any refresh rate) and click handling for every menu button/choice.

import { Input } from './input.js';
import { World } from './world.js';
import { Renderer } from './render.js';
import { AudioSys } from './audio.js';
import { applyShot } from './shots.js';
import { VIEW } from './config.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const input = new Input(canvas);
const audio = new AudioSys();
const world = new World(audio);
const renderer = new Renderer(canvas);

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 1);
const shot = params.get('shot');
const isShot = applyShot(world, input, shot, seed);

// Click: start from title, pick an upgrade card, restart from end screens.
canvas.addEventListener('click', () => {
  audio.ensure();
  const mx = input.mouse.x, my = input.mouse.y;
  if (world.state === 'title') { world.startGame(); return; }
  if (world.state === 'gameover' || world.state === 'victory') { world.startGame(); return; }
  if (world.state === 'upgrade') {
    const cw = 300, ch = 210, gap = 28;
    const total = cw * 3 + gap * 2;
    const x0 = (VIEW.w - total) / 2, y0 = 220;
    for (let i = 0; i < 3; i++) {
      const x = x0 + i * (cw + gap);
      if (mx >= x && mx <= x + cw && my >= y0 && my <= y0 + ch) { world.pickUpgrade(i); return; }
    }
  }
});

// Announce state changes for screen readers.
let lastState = world.state;
function announce() {
  if (world.state === lastState) return;
  lastState = world.state;
  const msgs = {
    title: 'Emberfall title screen. Press Enter to start.',
    playing: `Wave ${world.wave}. Fight!`,
    upgrade: 'Level up! Choose one of three upgrades, keys 1, 2 or 3.',
    paused: 'Game paused.',
    gameover: `Game over on wave ${world.wave}. Score ${world.score}. Press R to play again.`,
    victory: `Victory! Final score ${world.score}. Press R to play again.`,
  };
  statusEl.textContent = msgs[world.state] || '';
}

// Fixed-step loop: 1/60s simulation steps, render every frame.
let last = performance.now();
let acc = 0;
const STEP = 1 / 60;
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  acc += dt;
  let steps = 0;
  while (acc >= STEP && steps < 5) {
    // In screenshot presets the world is staged; still simulate so
    // particles, bullets and enemies are mid-motion in the capture.
    world.update(STEP, input);
    input.endFrame();
    acc -= STEP;
    steps++;
  }
  if (steps === 5) acc = 0;
  renderer.draw(world, input);
  announce();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Expose a tiny debug handle for playtesting (not part of gameplay).
window.__emberfall = { world, input, audio };
