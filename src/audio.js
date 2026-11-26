// 全部声音都是 WebAudio 现场合成：环境铺底、鲸歌、拾取铃声、梦录"叮"

const PENTA = [587.33, 659.25, 739.99, 880, 987.77];           // D 大调五声
const SONG = [293.66, 329.63, 369.99, 440, 493.88, 587.33, 659.25];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.voice = null;
    this.sfxTimes = new Map();
    this.activeSfx = 0;
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
    if (!this.ctx) return;
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
    o.onended = () => { o.disconnect(); g.disconnect(); };
    return g;
  }

  noiseHit(dur, f0, f1, vol) {
    if (!this.ctx) return;
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
    s.stop(t + dur + 0.04);
    s.onended = () => { s.disconnect(); f.disconnect(); g.disconnect(); };
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


  // Short gameplay sounds use their own gain and bounded voices. Their envelopes
  // remain tied to AudioContext time, so pause and mute apply to scheduled tails.
  playSfx(key, gap, parts) {
    const ctx = this.ctx;
    if (!ctx || !this.master || ctx.state === 'closed') return false;
    const now = ctx.currentTime;
    if (now - (this.sfxTimes.get(key) ?? -Infinity) < gap) return false;
    if (this.activeSfx + parts.length > 56) return false;
    this.sfxTimes.set(key, now);
    if (!this.sfxGain) {
      this.sfxGain = ctx.createGain();
      this.sfxGain.gain.value = 0.9;
      this.sfxGain.connect(this.master);
    }
    if (!this.sfxNoise) {
      this.sfxNoise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const samples = this.sfxNoise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    for (const part of parts) {
      const start = now + (part.delay ?? 0);
      const duration = part.duration;
      const end = start + duration;
      const gain = ctx.createGain();
      const attack = Math.min(0.012, duration * 0.12);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(part.volume, start + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      gain.connect(this.sfxGain);
      let source;
      let filter;
      if (part.wave === 'noise') {
        source = ctx.createBufferSource();
        source.buffer = this.sfxNoise;
        source.loop = true;
        filter = ctx.createBiquadFilter();
        filter.type = part.filter ?? 'lowpass';
        filter.Q.value = part.q ?? 0.7;
        filter.frequency.setValueAtTime(part.f0, start);
        filter.frequency.exponentialRampToValueAtTime(part.f1, end);
        source.connect(filter).connect(gain);
      } else {
        source = ctx.createOscillator();
        source.type = part.wave ?? 'sine';
        source.frequency.setValueAtTime(part.f0, start);
        source.frequency.exponentialRampToValueAtTime(part.f1, end);
        source.connect(gain);
      }
      this.activeSfx++;
      source.onended = () => {
        source.disconnect();
        filter?.disconnect();
        gain.disconnect();
        this.activeSfx = Math.max(0, this.activeSfx - 1);
      };
      source.start(start);
      source.stop(end + 0.025);
    }
    return true;
  }

  consume(kind = 'fry', combo = 0, big = false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - (this.sfxTimes.get('eat:all') ?? -Infinity) < 0.065) return;
    const recipes = {
      fry: [
        { f0: 285, f1: 85, duration: 0.10, volume: 0.20 },
        { wave: 'noise', f0: 2800, f1: 420, duration: 0.055, volume: 0.24 },
        { f0: 610, f1: 860, duration: 0.055, volume: 0.085, delay: 0.035 },
      ],
      lantern: [
        { wave: 'triangle', f0: 465, f1: 125, duration: 0.15, volume: 0.22 },
        { wave: 'noise', f0: 4100, f1: 450, duration: 0.09, volume: 0.28 },
        { f0: 1170, f1: 590, duration: 0.12, volume: 0.10, delay: 0.035 },
      ],
      manta: [
        { wave: 'triangle', f0: 145, f1: 49, duration: 0.25, volume: 0.29 },
        { wave: 'noise', f0: 1100, f1: 170, duration: 0.20, volume: 0.34 },
        { wave: 'noise', f0: 3400, f1: 650, duration: 0.10, volume: 0.15, delay: 0.06 },
      ],
      royal: [
        { wave: 'noise', f0: 6500, f1: 850, duration: 0.135, volume: 0.42 },
        { wave: 'square', f0: 180, f1: 55, duration: 0.12, volume: 0.10 },
        { f0: 102, f1: 39, duration: 0.24, volume: 0.29, delay: 0.025 },
      ],
      abyss: [
        { wave: 'sawtooth', f0: 106, f1: 34, duration: 0.30, volume: 0.11 },
        { f0: 69, f1: 29, duration: 0.37, volume: 0.34 },
        { wave: 'noise', f0: 1900, f1: 150, duration: 0.25, volume: 0.38 },
        { f0: 430, f1: 118, duration: 0.18, volume: 0.14, delay: 0.065 },
      ],
      clam: [
        { f0: 990, f1: 630, duration: 0.18, volume: 0.13 },
        { f0: 1485, f1: 1190, duration: 0.22, volume: 0.075, delay: 0.045 },
        { wave: 'noise', f0: 4800, f1: 1500, duration: 0.045, volume: 0.14 },
      ],
      crystal: [
        { wave: 'noise', f0: 7800, f1: 1100, duration: 0.15, volume: 0.25 },
        { f0: 1710, f1: 1180, duration: 0.28, volume: 0.10 },
        { f0: 2600, f1: 1700, duration: 0.22, volume: 0.07, delay: 0.04 },
      ],
      chest: [
        { wave: 'noise', f0: 1900, f1: 170, duration: 0.18, volume: 0.29 },
        { wave: 'triangle', f0: 155, f1: 80, duration: 0.20, volume: 0.22 },
        { f0: 785, f1: 990, duration: 0.25, volume: 0.13, delay: 0.10 },
        { f0: 1180, f1: 1485, duration: 0.24, volume: 0.09, delay: 0.16 },
      ],
    };
    const pitch = (big ? 0.84 : 1) * (1 + Math.min(combo, 24) * 0.003);
    const parts = (recipes[kind] ?? recipes.royal).map(part => ({
      ...part, f0: part.f0 * pitch, f1: part.f1 * pitch, volume: part.volume * (big ? 1.08 : 1),
    }));
    if (this.playSfx('eat:' + kind, 0.09, parts)) this.sfxTimes.set('eat:all', now);
  }

  playerHurt(source = 'impact') {
    const electric = /电|雷|灯|shock/.test(source);
    this.playSfx('hurt:player', 0.18, [
      { wave: 'noise', f0: electric ? 6500 : 3500, f1: 190, duration: 0.16, volume: 0.34 },
      { f0: 150, f1: 42, duration: 0.29, volume: 0.36 },
      { wave: electric ? 'sawtooth' : 'triangle', f0: 370, f1: 145, duration: 0.17, volume: 0.14, delay: 0.035 },
    ]);
  }

  fishSkill(kind, event = 'tell') {
    const release = event !== 'tell';
    if (event === 'crack') {
      this.playSfx('fish:crack', 0.14, [
        { wave: 'noise', f0: 7100, f1: 1200, duration: 0.16, volume: 0.34 },
        { wave: 'square', f0: 230, f1: 70, duration: 0.13, volume: 0.12 },
      ]);
      return;
    }
    const recipes = {
      fry: [
        { wave: 'noise', f0: 2000, f1: 3400, duration: 0.09, volume: 0.08 },
        { f0: 700, f1: 1020, duration: 0.065, volume: 0.035 },
      ],
      lantern: release ? [
        { wave: 'noise', filter: 'highpass', f0: 1800, f1: 5000, duration: 0.17, volume: 0.16 },
        { wave: 'sawtooth', f0: 1270, f1: 270, duration: 0.19, volume: 0.075 },
      ] : [
        { wave: 'triangle', f0: 740, f1: 1440, duration: 0.30, volume: 0.085 },
        { f0: 280, f1: 560, duration: 0.27, volume: 0.07 },
      ],
      manta: release ? [
        { wave: 'noise', filter: 'bandpass', f0: 1850, f1: 230, duration: 0.42, volume: 0.27, q: 1.2 },
        { f0: 190, f1: 66, duration: 0.33, volume: 0.18 },
      ] : [
        { wave: 'noise', filter: 'bandpass', f0: 330, f1: 1550, duration: 0.34, volume: 0.15 },
      ],
      royal: release ? [
        { wave: 'noise', f0: 3200, f1: 360, duration: 0.24, volume: 0.32 },
        { wave: 'square', f0: 160, f1: 52, duration: 0.20, volume: 0.095 },
      ] : [
        { wave: 'sawtooth', f0: 72, f1: 126, duration: 0.33, volume: 0.075 },
        { wave: 'noise', f0: 900, f1: 2400, duration: 0.28, volume: 0.14 },
      ],
      abyss: release ? [
        { wave: 'noise', f0: 560, f1: 1800, duration: 0.46, volume: 0.25 },
        { f0: 135, f1: 32, duration: 0.42, volume: 0.26 },
        { wave: 'triangle', f0: 380, f1: 95, duration: 0.21, volume: 0.12, delay: 0.08 },
      ] : [
        { f0: 44, f1: 69, duration: 0.42, volume: 0.20 },
        { wave: 'noise', filter: 'bandpass', f0: 1300, f1: 340, duration: 0.38, volume: 0.19 },
      ],
    };
    this.playSfx('fish:' + kind + ':' + event, release ? 0.22 : 0.5, recipes[kind] ?? recipes.royal);
  }

  environment(kind = 'current', event = 'release') {
    const tell = event === 'tell' || event === 'warning';
    const category = kind.toLowerCase();
    const hot = /vent|lava|geyser|heat|eruption|steam/.test(category);
    const rock = /debris|wreck|gate|barrier|sluice/.test(category);
    const light = /light|pulse/.test(category);
    const parts = light ? [
      { wave: 'sine', f0: tell ? 620 : 980, f1: tell ? 980 : 420, duration: tell ? 0.36 : 0.48, volume: 0.14 },
      { wave: 'triangle', f0: tell ? 1240 : 1960, f1: tell ? 1960 : 840, duration: 0.34, volume: 0.08, delay: 0.05 },
      { wave: 'noise', filter: 'bandpass', f0: 2600, f1: 950, duration: 0.25, volume: tell ? 0.07 : 0.18 },
    ] : tell ? [
      { wave: 'triangle', f0: hot ? 90 : rock ? 220 : 420, f1: hot ? 170 : rock ? 310 : 630, duration: 0.32, volume: 0.10 },
      { wave: 'noise', f0: 500, f1: hot ? 2200 : 1400, duration: 0.30, volume: 0.14 },
    ] : hot ? [
      { wave: 'noise', f0: 650, f1: 3300, duration: 0.58, volume: 0.32 },
      { f0: 75, f1: 150, duration: 0.42, volume: 0.25 },
    ] : rock ? [
      { wave: 'noise', f0: 3800, f1: 170, duration: 0.32, volume: 0.31 },
      { wave: 'triangle', f0: 130, f1: 45, duration: 0.30, volume: 0.21 },
      { f0: 800, f1: 510, duration: 0.13, volume: 0.08, delay: 0.06 },
    ] : [
      { wave: 'noise', filter: 'bandpass', f0: 400, f1: 2300, duration: 0.43, volume: 0.18, q: 1.1 },
      { f0: 210, f1: 440, duration: 0.34, volume: 0.09 },
    ];
    this.playSfx('environment:' + kind + ':' + event, tell ? 0.7 : 0.42, parts);
  }

  powerup(kind) {
    if (kind === 'shieldBlock') {
      this.playSfx('shield:block', 0.2, [
        { wave: 'noise', filter: 'highpass', f0: 6200, f1: 2000, duration: 0.15, volume: 0.18 },
        { f0: 1040, f1: 420, duration: 0.28, volume: 0.17 },
        { f0: 180, f1: 68, duration: 0.18, volume: 0.16 },
      ]);
      return;
    }
    const notes = {
      shield: [392, 587, 784],
      magnet: [330, 660, 990],
      sonar: [660, 990, 1320],
      haste: [440, 880, 1760],
      bait: [294, 440, 587],
      heal: [523, 659, 784],
    }[kind] ?? [523, 784, 1046];
    const parts = notes.map((frequency, index) => ({
      wave: 'sine', f0: frequency * 0.92, f1: frequency,
      duration: 0.33, volume: 0.12 - index * 0.018, delay: index * 0.07,
    }));
    parts.push({ wave: 'noise', filter: 'highpass', f0: 2900, f1: 7000, duration: 0.19, volume: 0.07 });
    this.playSfx('powerup', 0.14, parts);
  }

  bossTell(key, skill) {
    const pitch = { grok: 1.18, qwen: 1.5, gemini: 1.8, zhipu: 0.84, claude: 1.05 }[key] ?? 1;
    const base = skill === 'dash' ? 155 : skill === 'wave' ? 230 : skill === 'stones' ? 125 : skill === 'ambush' ? 620 : 470;
    this.playSfx('boss:tell', 0.18, [
      { wave: 'triangle', f0: base * pitch, f1: base * 1.7 * pitch, duration: 0.38, volume: 0.18 },
      { wave: 'sine', f0: base * 1.5 * pitch, f1: base * 2.1 * pitch, duration: 0.19, volume: 0.11, delay: 0.20 },
      { wave: 'noise', filter: 'bandpass', f0: 380, f1: 1600, duration: 0.31, volume: 0.15 },
    ]);
  }

  bossAttack(key, skill) {
    const pitch = { grok: 1.1, qwen: 1.27, gemini: 1.52, zhipu: 0.85, claude: 0.95 }[key] ?? 1;
    const recipes = {
      dash: [
        { wave: 'noise', f0: 4800, f1: 420, duration: 0.28, volume: 0.35 },
        { wave: 'sawtooth', f0: 170, f1: 42, duration: 0.23, volume: 0.095 },
        { f0: 104, f1: 38, duration: 0.28, volume: 0.25 },
      ],
      plates: [
        { wave: 'noise', filter: 'bandpass', f0: 4400, f1: 1300, duration: 0.18, volume: 0.19, q: 1.7 },
        { wave: 'sine', f0: 1780, f1: 970, duration: 0.24, volume: 0.10 },
        { wave: 'triangle', f0: 2600, f1: 1450, duration: 0.18, volume: 0.07, delay: 0.04 },
      ],
      stones: [
        { wave: 'noise', f0: 2100, f1: 150, duration: 0.29, volume: 0.35 },
        { f0: 90, f1: 36, duration: 0.28, volume: 0.29 },
        { wave: 'square', f0: 190, f1: 62, duration: 0.10, volume: 0.07 },
      ],
      wave: [
        { f0: 140, f1: 42, duration: 0.54, volume: 0.29 },
        { wave: 'noise', filter: 'bandpass', f0: 340, f1: 1900, duration: 0.45, volume: 0.26 },
        { wave: 'triangle', f0: 420, f1: 180, duration: 0.42, volume: 0.11 },
      ],
      ambush: [
        { wave: 'noise', filter: 'highpass', f0: 1400, f1: 5500, duration: 0.20, volume: 0.19 },
        { wave: 'triangle', f0: 1050, f1: 190, duration: 0.18, volume: 0.19 },
        { wave: 'noise', f0: 4300, f1: 460, duration: 0.12, volume: 0.27, delay: 0.06 },
      ],
    };
    const parts = (recipes[skill] ?? recipes.dash).map(part => ({
      ...part, f0: part.f0 * pitch, f1: part.f1 * pitch,
    }));
    this.playSfx('boss:attack:' + skill, 0.16, parts);
  }

  bossHurt(key) {
    const pitch = key === 'claude' ? 0.85 : key === 'gemini' ? 1.35 : 1;
    this.playSfx('boss:hurt', 0.15, [
      { wave: 'noise', f0: 6500, f1: 550, duration: 0.17, volume: 0.34 },
      { wave: 'triangle', f0: 210 * pitch, f1: 70 * pitch, duration: 0.21, volume: 0.23 },
      { f0: 122, f1: 46, duration: 0.25, volume: 0.24 },
    ]);
  }

  bossPhase(key, phase) {
    const pitch = key === 'claude' ? 0.86 : 1;
    this.playSfx('boss:phase', 0.7, [
      { wave: 'noise', f0: 350, f1: 2600, duration: 0.64, volume: 0.26 },
      { wave: 'sawtooth', f0: 55 * pitch, f1: 118 * pitch, duration: 0.59, volume: 0.11 },
      { f0: 180, f1: 72, duration: 0.37, volume: 0.25, delay: 0.15 },
      { wave: 'triangle', f0: 440 + phase * 80, f1: 220, duration: 0.29, volume: 0.13, delay: 0.36 },
    ]);
  }

  bossDown(key) {
    const pitch = key === 'claude' ? 0.8 : 1;
    this.playSfx('boss:down', 0.9, [
      { wave: 'noise', f0: 4800, f1: 180, duration: 0.67, volume: 0.32 },
      { f0: 108 * pitch, f1: 28, duration: 0.64, volume: 0.33 },
      { wave: 'triangle', f0: 523, f1: 659, duration: 0.38, volume: 0.15, delay: 0.28 },
      { f0: 784, f1: 1046, duration: 0.42, volume: 0.10, delay: 0.42 },
    ]);
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
