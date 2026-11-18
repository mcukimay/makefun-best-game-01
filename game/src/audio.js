// WebAudio synth: every sound is generated, no audio files, no network.
// SFX are tiny oscillator/noise envelopes; music is a quiet 8-step bass
// pulse scheduled on a lookahead timer. M toggles mute; audio starts on
// the first user gesture (browser autoplay rule).

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicOn = false;
    this.musicTimer = null;
    this.step = 0;
    // A-minor-ish bass line, one note per 8th at 112 BPM.
    this.bass = [55, 0, 55, 65.41, 55, 0, 49, 58.27, 55, 0, 55, 65.41, 82.41, 0, 73.42, 65.41];
  }

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch { this.ctx = null; }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  tone(freq, dur, type = 'square', vol = 0.16, slideTo = null, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  noise(dur, vol = 0.2, filterFreq = 1200, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0);
  }

  shoot() { this.tone(720, 0.07, 'square', 0.07, 320); }
  enemyHit() { this.tone(240, 0.05, 'triangle', 0.08, 160); }
  enemyDie() { this.noise(0.18, 0.22, 900); this.tone(180, 0.16, 'sawtooth', 0.10, 50); }
  playerHurt() { this.tone(140, 0.22, 'sawtooth', 0.20, 60); this.noise(0.12, 0.14, 500); }
  pickup() { this.tone(880, 0.08, 'sine', 0.10, 1320); }
  levelUp() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.12, null, i * 0.07)); }
  waveClear() { [392, 523, 659].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.12, null, i * 0.09)); }
  bossWarn() { this.tone(65, 0.7, 'sawtooth', 0.22, 45); this.noise(0.5, 0.10, 300); }
  dash() { this.noise(0.14, 0.12, 2400); }
  gameOver() { [330, 262, 196, 131].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.14, null, i * 0.16)); }
  victory() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.13, null, i * 0.1)); }
  click() { this.tone(660, 0.05, 'sine', 0.09, 880); }

  startMusic() {
    this.ensure();
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    const stepDur = 60 / 112 / 2; // 8th notes at 112 BPM
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const f = this.bass[this.step % this.bass.length];
      if (f) this.tone(f, stepDur * 0.95, 'triangle', 0.075);
      if (this.step % 4 === 2) this.noise(0.05, 0.05, 4000); // hat tick
      this.step++;
    }, stepDur * 1000);
  }

  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null; this.musicOn = false;
  }
}
