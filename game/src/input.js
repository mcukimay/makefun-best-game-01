// Keyboard + mouse state. One job: turn DOM events into a clean, polled
// input snapshot the world reads each frame. Also tracks "just pressed"
// edges for menus (Enter, P, M, 1/2/3, Space).

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();   // edges, consumed each frame by world
    this.mouse = { x: 640, y: 360, down: false };
    this.canvas = canvas;

    window.addEventListener('keydown', e => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      this.keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    });
    window.addEventListener('keyup', e => {
      this.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    });
    canvas.addEventListener('mousemove', e => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener('mousedown', e => { if (e.button === 0) this.mouse.down = true; });
    window.addEventListener('mouseup', () => { this.mouse.down = false; });
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; });
  }

  down(...names) { return names.some(n => this.keys.has(n)); }
  wasPressed(...names) { return names.some(n => this.pressed.has(n)); }
  endFrame() { this.pressed.clear(); }

  // WASD / arrows as a normalised movement vector.
  moveVector() {
    let x = 0, y = 0;
    if (this.down('a', 'ArrowLeft')) x -= 1;
    if (this.down('d', 'ArrowRight')) x += 1;
    if (this.down('w', 'ArrowUp')) y -= 1;
    if (this.down('s', 'ArrowDown')) y += 1;
    const len = Math.hypot(x, y);
    return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
  }
}
