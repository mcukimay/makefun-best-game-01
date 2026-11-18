// Seeded RNG (mulberry32) so screenshot presets and replays are deterministic.
// The live game seeds from Math.random; ?seed=N pins it.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    range: (lo, hi) => lo + next() * (hi - lo),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: arr => arr[Math.floor(next() * arr.length)],
    chance: p => next() < p,
  };
}

// Random point on the arena edge (spawn point, away from the player).
export function edgePoint(rng, arena, px, py, minDist = 260) {
  for (let tries = 0; tries < 12; tries++) {
    const side = rng.int(0, 3);
    let x, y;
    if (side === 0) { x = rng.range(arena.x, arena.x + arena.w); y = arena.y + 8; }
    else if (side === 1) { x = rng.range(arena.x, arena.x + arena.w); y = arena.y + arena.h - 8; }
    else if (side === 2) { x = arena.x + 8; y = rng.range(arena.y, arena.y + arena.h); }
    else { x = arena.x + arena.w - 8; y = rng.range(arena.y, arena.y + arena.h); }
    if (Math.hypot(x - px, y - py) >= minDist) return { x, y };
  }
  return { x: arena.x + 40, y: arena.y + 40 };
}
