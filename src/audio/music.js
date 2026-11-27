import { MIX, STEM_LEVELS, modeFor } from '../data/audio.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

/** Five additive stems; scheduling uses AudioContext time, never setInterval. */
export class MusicSystem {
  constructor(engine) {
    this.engine = engine;
    this.state = 'TITLE';
    this.channels = {};
    this.targets = {};
    this.pads = [];
    this.phase = 1;
    this.nextPulse = this.nextDrop = this.nextBoss = this.nextHeart = 0;
    this.bossBeat = 0;
    this.dropIndex = 0;
    this.silenceUntil = 0;
    this.stopped = false;
  }

  ensure() {
    const audio = this.engine, ctx = audio.ctx;
    if (!ctx || this.channels.pad) return;
    for (const name of Object.keys(STEM_LEVELS)) {
      const bus = name === 'pad' ? 'ambient' : 'music';
      const dry = ctx.createGain(), wet = ctx.createGain();
      dry.gain.value = wet.gain.value = 0;
      dry.connect(audio.buses[bus]); wet.connect(audio.sends[bus]);
      this.channels[name] = { dry, wet };
    }
    this.lfo = ctx.createOscillator(); this.lfo.frequency.value = .05;
    this.lfoDepth = ctx.createGain(); this.lfoDepth.gain.value = 90;
    this.lfo.connect(this.lfoDepth); this.lfo.start();
    this.startPads();
    this.nextPulse = this.nextDrop = this.nextBoss = this.nextHeart = ctx.currentTime;
  }

  startPads() {
    const audio = this.engine, scale = modeFor(audio.level).scale;
    this.lfoDepth.disconnect();
    for (const voice of this.pads) voice.stop();
    this.pads = [];
    // Six gently detuned voices; bass below 120Hz is always a sine.
    for (const [note, octave] of [[0, -1], [2, -1], [4, -1]]) {
      for (const detune of [-5, 5]) {
        const voice = audio.tone({ frequency: scale[note] * 2 ** octave,
          wave: 'sawtooth', detune, duration: 3600, volume: .023, attack: 1.2,
          filter: { frequency: 520 }, wet: .38, bus: 'ambient', channel: this.channels.pad, priority: 3, sustain: true });
        if (voice) { this.pads.push(voice); this.lfoDepth.connect(voice.filter.frequency); }
      }
    }
  }

  changeLevel() {
    if (this.channels.pad) this.startPads();
    this.bossBeat = this.dropIndex = 0;
  }

  stateChange(state) {
    this.state = state ?? this.state;
    if (['SURFACE', 'DEEP', 'BOSS', 'BRIEF', 'TITLE'].includes(this.state)) this.stopped = false;
    if (this.state === 'DAWN') this.stop();
  }

  phaseChange(phase) {
    this.phase = phase ?? this.phase + 1;
    if (!this.engine.ctx) return;
    const now = this.engine.ctx.currentTime;
    this.silenceUntil = now + MIX.phaseSilence;
    for (const channel of Object.values(this.channels)) {
      for (const node of [channel.dry, channel.wet]) {
        node.gain.cancelScheduledValues(now);
        node.gain.value = 0;
        node.gain.setValueAtTime(0, now);
      }
    }
    this.targets = Object.fromEntries(Object.keys(this.channels).map(name => [name, 0]));
    this.nextBoss = this.silenceUntil;
    this.bossBeat = 0;
  }

  update(game = {}) {
    this.ensure();
    const audio = this.engine, ctx = audio.ctx;
    const now = ctx.currentTime, horizon = now + MIX.lookahead;
    if (game.state) this.state = game.state;
    this.phase = game.boss?.phase ?? this.phase;
    const player = game.player ?? {};
    const moving = Math.hypot(player.vx ?? 0, player.vy ?? 0) > 30;
    const enemies = game.enemies ?? game.deep?.enemies ?? game.fish ?? [];
    const nightmares = game.entities?.nightmares ?? game.surface?.nightmares ?? [];
    const danger = [...enemies, ...nightmares].some(enemy => !enemy.dead
      && Math.hypot((enemy.x ?? 9999) - (player.x ?? 0), (enemy.y ?? 9999) - (player.y ?? 0)) < 300);
    const deep = ['DEEP', 'BOSS'].includes(this.state), boss = this.state === 'BOSS';
    const interactive = ['SURFACE', 'DEEP', 'BOSS'].includes(this.state);
    const enabled = { pad: true, pulse: interactive && moving, tension: interactive && danger, deep, boss };
    const order = ['pad', 'pulse', 'tension', 'deep', 'boss'];
    const highest = Math.max(0, ...order.map((name, index) => enabled[name] ? index : 0));
    const silent = this.stopped || now < this.silenceUntil;
    for (let index = 0; index < order.length; index++) {
      const name = order[index];
      const target = silent || !enabled[name] ? 0 : STEM_LEVELS[name] * (index < highest ? .3 : 1);
      this.fade(name, target, now);
    }
    const ambientTarget = MIX.ambient * (boss ? .5 : 1);
    if (this.ambientTarget !== ambientTarget) {
      this.ambientTarget = ambientTarget;
      for (const node of [audio.buses.ambient, audio.sends.ambient]) node.gain.setTargetAtTime(ambientTarget, now, .15);
    }
    if (silent) return;
    const scale = modeFor(audio.level).scale, beat = 60 / 72;
    const schedule = (field, gap, callback) => {
      if (this[field] < now - gap) this[field] = now;
      let guard = 0;
      while (this[field] <= horizon && guard++ < 4) {
        callback(this[field]); this[field] += gap;
      }
    };
    schedule('nextPulse', beat * 2, time => {
      if (moving) this.note('pulse', scale[(this.dropIndex++ * 3) % 5], time, .38, .045, 'triangle');
    });
    schedule('nextHeart', beat, time => {
      if (!danger) return;
      this.note('tension', scale[0] / 4, time, .16, .1);
      this.note('tension', scale[2] / 4, time + .16, .12, .055);
    });
    schedule('nextDrop', beat / 4, time => {
      if (deep) this.note('deep', scale[(this.dropIndex++ * 2) % 5] * 2, time, .12, .018);
    });
    schedule('nextBoss', 60 / MIX.bossBpm, time => {
      if (boss) this.bossStep(time, scale);
    });
  }

  fade(name, target, now) {
    if (this.targets[name] === target) return;
    const duration = target > (this.targets[name] ?? 0) ? MIX.fadeIn : MIX.fadeOut;
    for (const node of [this.channels[name].dry, this.channels[name].wet]) {
      node.gain.cancelScheduledValues(now);
      node.gain.setValueAtTime(clamp(node.gain.value, 0, 1), now);
      node.gain.linearRampToValueAtTime(target, now + duration);
    }
    this.targets[name] = target;
  }

  note(stem, frequency, when, duration, volume, wave = 'sine', extra = {}) {
    return this.engine.tone({ frequency, when, duration, volume, wave, wet: .4,
      bus: stem === 'pad' ? 'ambient' : 'music', channel: this.channels[stem], priority: 2, ...extra });
  }

  bossStep(time, scale) {
    const index = this.bossBeat++ % 16, measure = Math.floor(index / 4), beat = index % 4;
    this.note('boss', scale[[0, 0, 2, 4][measure]] / 4, time, .36, .08);
    if (beat === 1 || beat === 3) this.note('boss', scale[(measure + beat) % 5], time, .48, .055, 'triangle');
    if (this.phase >= 2 && beat === 0) {
      this.note('boss', scale[measure % 5], time, 2.4, .022, 'sawtooth', { filter: { frequency: 520 } });
      this.note('boss', scale[measure % 5] * 2, time, 2.4, .009, 'triangle');
    }
    if (this.phase >= 3) {
      this.note('boss', scale[0] / 4, time, .17, .065);
      if (measure === 3 && beat === 0) this.note('boss', scale[0] / 2, time, 2.5, .065, 'sine', { vibrato: 12 });
    }
  }

  stop() {
    this.stopped = true;
    if (!this.engine.ctx) return;
    const now = this.engine.ctx.currentTime;
    for (const channel of Object.values(this.channels)) for (const node of [channel.dry, channel.wet]) {
      node.gain.cancelScheduledValues(now);
      node.gain.setTargetAtTime(0, now, .12);
    }
    this.targets = Object.fromEntries(Object.keys(this.channels).map(name => [name, 0]));
  }

  destroy() {
    this.stop();
    try { this.lfo?.stop(); } catch {}
    this.lfo?.disconnect(); this.lfoDepth?.disconnect();
    for (const channel of Object.values(this.channels)) {
      channel.dry.disconnect(); channel.wet.disconnect();
    }
    this.channels = {};
    this.pads = [];
  }
}
