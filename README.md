# EMBERFALL — Arena Roguelite

[![best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01) [![rank](https://make.fun/badge/best-game-01/mcukimay/makefun-best-game-01/rank.svg)](https://make.fun/bounty/best-game-01) [![reward](https://make.fun/badge/best-game-01/mcukimay/makefun-best-game-01/reward.svg)](https://make.fun/bounty/best-game-01)

A complete 2D arena shooter for make.fun `best-game-01`. No library, no
assets, no network requests: vanilla Canvas 2D + WebAudio, all code and all
sound generated in the browser.

## The game

Survive 10 waves of ember creatures in a neon arena and slay the Magma
Warden — twice. Collect blue XP gems, level up, and forge a build from 10
upgrades (multishot, piercing rounds, Nova dash shockwave, Phoenix Blood
regen, and more).

- **Enemies (5 types + boss):** Ember chasers, Splitters that break into
  minis, Spitters that keep their distance and fire aimed orbs, Dashers
  that telegraph a lunge, and the Magma Warden boss on waves 5 and 10 with
  radial bullet bursts and aimed spreads.
- **Complete loop:** title screen with how-to-play → 10 waves with a
  breather banner and score bonus between them → level-up upgrade picker
  (1 of 3 cards, keys 1/2/3 or click) → victory screen with full run stats
  or game over with stats. Restart with R / Enter / click. Best score in
  localStorage.
- **Feel:** particles, screen shake, hit-stop, floating damage numbers,
  dash with i-frames and a cooldown ring, synthesized SFX plus a bass-pulse
  music loop (M to mute, P to pause).
- **Controls:** WASD / arrows to move, mouse to aim (auto-fire), Space to
  dash, P pause, M mute.

## Play it

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

Open the page and press Enter. Screenshots are staged from real gameplay
via `?shot=start|play|boss|end&seed=1` (see `game/src/shots.js`).

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and
writes `dossier.json` with the vendored `vendor/makefun-game.ts` library.

## Layout

| File | Job |
| --- | --- |
| `game/index.html` | Page shell, canvas, module entry |
| `game/src/main.js` | Game loop, menu clicks, fixed-step timing |
| `game/src/config.js` | Tuning, enemy types, wave table, upgrades |
| `game/src/world.js` | State machine, waves, combat, collisions |
| `game/src/entities.js` | Entity factories, steering, particles |
| `game/src/render.js` | All drawing: arena, HUD, screens |
| `game/src/input.js` | Keyboard + mouse state |
| `game/src/audio.js` | Synthesized SFX + music (WebAudio) |
| `game/src/random.js` | Seeded RNG, edge spawn points |
| `game/src/shots.js` | Screenshot presets (real renders) |

MIT licensed. Original work — every name, picture and sound made in code.
