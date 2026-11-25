// 全部声音都是 WebAudio 现场合成：环境铺底、鲸歌、拾取铃声、梦录"叮"

const PENTA = [587.33, 659.25, 739.99, 880, 987.77];           // D 大调五声
const SONG = [293.66, 329.63, 369.99, 440, 493.88, 587.33, 659.25];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.voice = null;
  }

  init() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.impulse(4.5, 2.4);
    this.verbIn = ctx.createGain();
    const verbOut = ctx.createGain();
    verbOut.gain.value = 0.6;
    this.verbIn.connect(this.verb).connect(verbOut).connect(this.master);
    this.startAmbient();
    this.chimeLoop();
  }

  impulse(sec, decay) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  noiseBuffer(sec) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    return buf;
  }

  startAmbient() {
    const ctx = this.ctx, now = ctx.currentTime;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    lp.Q.value = 0.6;
    const pad = ctx.createGain();
    pad.gain.setValueAtTime(0, now);
    pad.gain.linearRampToValueAtTime(0.045, now + 5);
    lp.connect(pad);
    pad.connect(this.master);
    pad.connect(this.verbIn);
    for (const f of [73.42, 110, 146.83, 164.81, 220, 277.18]) {
      for (const det of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = det;
        const g = ctx.createGain();
        g.gain.value = 0.3;
        o.connect(g).connect(lp);
        o.start();
      }
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lg = ctx.createGain();
    lg.gain.value = 240;
    lfo.connect(lg).connect(lp.frequency);
    lfo.start();
    // 深海低频
    const n = ctx.createBufferSource();
    n.buffer = this.noiseBuffer(4);
    n.loop = true;
    const nl = ctx.createBiquadFilter();
    nl.type = 'lowpass';
    nl.frequency.value = 170;
    const ng = ctx.createGain();
    ng.gain.value = 0.16;
    n.connect(nl).connect(ng).connect(this.master);
    n.start();
    // 噩梦靠近时的低鸣
    const dl = ctx.createBiquadFilter();
    dl.type = 'lowpass';
    dl.frequency.value = 260;
    this.dread = ctx.createGain();
    this.dread.gain.value = 0;
    dl.connect(this.dread).connect(this.master);
    for (const f of [55, 58.3, 82.4]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.connect(dl);
      o.start();
    }
  }

  chimeLoop() {
    const tick = () => {
      if (this.ctx && this.ctx.state === 'running') {
        const f = PENTA[Math.floor(Math.random() * PENTA.length)] * (Math.random() < 0.3 ? 2 : 1);
        this.bell(f, this.ctx.currentTime, 0.025, 3.5, 1.0);
      }
      setTimeout(tick, 2500 + Math.random() * 4500);
    };
    setTimeout(tick, 3000);
  }

  bell(freq, when, vol = 0.05, dur = 2.5, wet = 0.7) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    g.connect(this.master);
    const w = ctx.createGain();
    w.gain.value = wet;
    g.connect(w).connect(this.verbIn);
    for (const [mul, amp] of [[1, 1], [2.756, 0.3], [5.4, 0.1]]) {
      const o = ctx.createOscillator();
      o.frequency.value = freq * mul;
      const og = ctx.createGain();
      og.gain.value = amp;
      o.connect(og).connect(g);
      o.start(when);
      o.stop(when + dur + 0.05);
    }
  }

  pickup(i) {
    if (!this.ctx) return;
    const f = PENTA[i % 5] * Math.pow(2, Math.min(2, Math.floor(i / 5)));
    this.bell(f, this.ctx.currentTime, 0.07, 1.4, 0.6);
  }

  deliver(n) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let k = 0; k < Math.min(n + 2, 12); k++) {
      this.bell(PENTA[k % 5] * Math.pow(2, Math.floor(k / 5) - 1), t + k * 0.09, 0.06, 2.4, 0.9);
    }
  }

  ding() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.bell(1760, t, 0.05, 0.6, 0.3);
    this.bell(2637, t + 0.07, 0.04, 0.7, 0.3);
  }

  sweep(type, f0, f1, dur, vol, when = 0) {
    const ctx = this.ctx, t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
    return g;
  }

  noiseHit(dur, f0, f1, vol) {
    const ctx = this.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuffer(dur + 0.1);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
  }

  hit() {
    if (!this.ctx) return;
    this.noiseHit(0.45, 900, 90, 0.5);
    this.sweep('sine', 150, 45, 0.5, 0.35);
  }

  purify() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let k = 0; k < 9; k++) this.bell(PENTA[k % 5] * Math.pow(2, Math.floor(k / 5)), t + k * 0.05, 0.045, 2.2, 1);
  }

  boing() {
    if (!this.ctx) return;
    this.sweep('sine', 170, 520, 0.28, 0.18);
    this.sweep('triangle', 340, 900, 0.2, 0.05, 0.03);
  }

  dash() {
    if (!this.ctx) return;
    this.noiseHit(0.35, 2400, 300, 0.25);
  }

  win() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const seq = [0, 2, 4, 1, 3, 5, 7, 9];
    seq.forEach((k, i) => this.bell(PENTA[k % 5] * Math.pow(2, Math.floor(k / 5) - 1), t + i * 0.16, 0.07, 3.5, 1));
  }

  songOn() {
    if (!this.ctx || this.voice) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13, t + 0.35);
    const o1 = ctx.createOscillator();
    o1.type = 'sine';
    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    const f = SONG[Math.floor(Math.random() * 4)];
    o1.frequency.setValueAtTime(f * 0.8, t);
    o1.frequency.setTargetAtTime(f, t, 0.12);
    o2.frequency.setValueAtTime(f * 0.4, t);
    o2.frequency.setTargetAtTime(f / 2, t, 0.12);
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.2;
    const vg = ctx.createGain();
    vg.gain.value = 6;
    vib.connect(vg);
    vg.connect(o1.frequency);
    vg.connect(o2.frequency);
    const o2g = ctx.createGain();
    o2g.gain.value = 0.28;
    const form = ctx.createBiquadFilter();
    form.type = 'bandpass';
    form.frequency.value = 820;
    form.Q.value = 1.1;
    const fg = ctx.createGain();
    fg.gain.value = 0.9;
    o1.connect(g);
    o2.connect(o2g).connect(g);
    o1.connect(form).connect(fg).connect(g);
    const dry = ctx.createGain();
    dry.gain.value = 0.55;
    g.connect(dry).connect(this.master);
    g.connect(this.verbIn);
    o1.start(t); o2.start(t); vib.start(t);
    this.voice = { g, o1, o2, vib, noteT: 0.6, f };
  }

  songOff() {
    const v = this.voice;
    if (!v) return;
    this.voice = null;
    const t = this.ctx.currentTime;
    v.g.gain.cancelScheduledValues(t);
    v.g.gain.setValueAtTime(Math.max(0.0001, v.g.gain.value), t);
    v.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    v.o1.frequency.setTargetAtTime(v.f * 0.7, t, 0.3);
    for (const o of [v.o1, v.o2, v.vib]) o.stop(t + 0.9);
  }

  update(dt) {
    const v = this.voice;
    if (!v) return;
    v.noteT -= dt;
    if (v.noteT <= 0) {
      const t = this.ctx.currentTime;
      let f = SONG[Math.floor(Math.random() * SONG.length)];
      if (Math.random() < 0.18) f *= 0.5;      // 偶尔往下沉的一声鲸鸣
      v.f = f;
      v.o1.frequency.setTargetAtTime(f, t, 0.14);
      v.o2.frequency.setTargetAtTime(f / 2, t, 0.14);
      v.noteT = 0.45 + Math.random() * 0.9;
    }
  }

  setDread(x) {
    if (!this.ctx) return;
    this.dread.gain.setTargetAtTime(x * 0.09, this.ctx.currentTime, 0.3);
  }

  /* ---- 捕食模式用的音效 ---- */

  // 咬合：一声低沉的“嗷呜”+ 牙齿合上的脆响
  chomp(big = 0) {
    if (!this.ctx) return;
    this.sweep('sine', 220 - big * 60, 70, 0.16, 0.32 + big * 0.12);
    this.noiseHit(0.07, 5200, 900, 0.22);
  }

  // 咬中：多一层“咔嚓”
  crunch(k = 1) {
    if (!this.ctx) return;
    this.noiseHit(0.18 + k * 0.08, 3200, 160, 0.35 + k * 0.1);
    this.sweep('square', 120, 55, 0.12, 0.08);
  }

  shatter() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noiseHit(0.35, 9000, 1200, 0.3);
    for (let k = 0; k < 5; k++) this.bell(1800 + Math.random() * 2600, t + k * 0.03, 0.03, 0.5, 0.4);
  }

  whoosh() {
    if (!this.ctx) return;
    this.noiseHit(0.5, 600, 3800, 0.22);
  }

  geyser() {
    if (!this.ctx) return;
    this.noiseHit(1.2, 380, 2600, 0.3);
    this.sweep('sine', 60, 140, 0.9, 0.2);
  }

  heartbeat() {
    if (!this.ctx) return;
    this.sweep('sine', 75, 40, 0.14, 0.45);
    this.sweep('sine', 70, 38, 0.14, 0.3, 0.2);
  }

  growl() {
    if (!this.ctx) return;
    this.sweep('sawtooth', 70, 50, 0.6, 0.06);
    this.sweep('sine', 110, 60, 0.7, 0.15, 0.15);
  }

  warn() {
    if (!this.ctx) return;
    this.sweep('square', 880, 660, 0.12, 0.05);
    this.sweep('square', 880, 660, 0.12, 0.05, 0.16);
  }

  combo(n) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = PENTA[n % 5] * Math.pow(2, Math.min(3, Math.floor(n / 5)) - 1);
    this.bell(f, t, 0.05, 0.6, 0.25);
  }

  // 角色“说话”：动森式叽里咕噜，每个人音高、音色不同
  babble(pitch = 1, n = 8, type = 'triangle') {
    if (!this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.value = 0.07;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1300 * pitch;
    f.Q.value = 1.4;
    g.connect(f).connect(this.master);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * 0.075;
      const o = ctx.createOscillator();
      o.type = type;
      const base = (230 + Math.random() * 140) * pitch;
      o.frequency.setValueAtTime(base, t);
      o.frequency.linearRampToValueAtTime(base * (0.85 + Math.random() * 0.4), t + 0.06);
      const e = ctx.createGain();
      e.gain.setValueAtTime(0.0001, t);
      e.gain.exponentialRampToValueAtTime(1, t + 0.012);
      e.gain.exponentialRampToValueAtTime(0.0001, t + 0.065);
      o.connect(e).connect(g);
      o.start(t);
      o.stop(t + 0.08);
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  suspend(on) {
    if (!this.ctx) return;
    if (on) this.ctx.suspend();
    else this.ctx.resume();
  }
}
