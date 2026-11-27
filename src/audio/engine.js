import { MIX, modeFor, quantize } from '../data/audio.js';
import { SoundEffects } from './sfx.js';
import { MusicSystem } from './music.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

/** Browser adapter. The simulation only emits descriptive events. */
export class AudioEngine {
  constructor({ bus, context, muted = false } = {}) {
    this.context = context;
    this.ctx = null;
    this.muted = muted;
    this.level = 1;
    this.voices = new Set();
    this.issued = 0;
    this.listener = { x: 0, y: 0, width: 960 };
    this.unsubscribers = [];
    this.sfx = new SoundEffects(this);
    this.music = new MusicSystem(this);
    this.buses = {};
    this.sends = {};
    const unsubscribe = bus?.on?.('*', (name, data) => this.event(name, data));
    if (typeof unsubscribe === 'function') this.unsubscribers.push(unsubscribe);
    this.visibility = () => {
      if (!this.ctx || this.ctx.startRendering) return;
      if (globalThis.document?.hidden) this.ctx.suspend?.().catch?.(() => {});
      else if (!this.userSuspended) this.ctx.resume?.().catch?.(() => {});
    };
  }

  async init() {
    if (this.ctx) {
      if (!this.userSuspended) await this.ctx.resume?.().catch?.(() => {});
      return true;
    }
    const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!this.context && !Context) return false;
    try {
      this.ctx = this.context ?? new Context();
      const ctx = this.ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : MIX.master;
      this.compressor = ctx.createDynamicsCompressor();
      Object.assign(this.compressor.threshold, { value: -18 });
      this.compressor.knee.value = 16;
      this.compressor.ratio.value = 5;
      this.compressor.attack.value = .004;
      this.compressor.release.value = .18;
      this.master.connect(this.compressor).connect(ctx.destination);
      for (const key of ['sfx', 'music', 'ambient', 'voice']) {
        this.buses[key] = ctx.createGain();
        this.buses[key].gain.value = MIX[key];
        this.buses[key].connect(this.master);
        this.sends[key] = ctx.createGain();
        this.sends[key].gain.value = MIX[key];
        this[`${key}Bus`] = this.buses[key];
      }
      this.buses.action = this.buses.sfx;
      this.buses.env = this.buses.ambient;
      this.buses.ui = this.buses.voice;
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = this.makeBuffer(MIX.impulseDuration, true);
      this.reverbOut = ctx.createGain();
      this.reverbOut.gain.value = MIX.reverb;
      this.reverb.connect(this.reverbOut).connect(this.master);
      for (const send of Object.values(this.sends)) send.connect(this.reverb);
      this.noiseBuffer = this.makeBuffer(MIX.noiseDuration);
      globalThis.document?.addEventListener('visibilitychange', this.visibility);
      if (!ctx.startRendering) await ctx.resume?.().catch?.(() => {});
      return true;
    } catch {
      this.ctx = null;
      return false;
    }
  }

  makeBuffer(seconds, impulse = false) {
    const length = Math.ceil(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(impulse ? 2 : 1, length, this.ctx.sampleRate);
    let seed = 0x7182ac1;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      let previous = 0;
      for (let index = 0; index < length; index++) {
        seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
        const white = ((seed >>> 0) / 4294967296) * 2 - 1;
        previous = previous * .65 + white * .35;
        data[index] = previous * (impulse ? (1 - index / length) ** MIX.impulseDecay : 1);
      }
    }
    return buffer;
  }

  update(game = {}) {
    this.issued = 0;
    const player = game.player ?? {};
    this.listener = { x: player.x ?? 0, y: player.y ?? 0, width: 960 };
    const level = game.level?.level ?? game.level?.id ?? game.level?.pressure ?? game.level ?? game.levelId ?? 1;
    if (level !== this.level) { this.level = level; this.music.changeLevel(); }
    if (!this.ctx || (this.ctx.state === 'suspended' && !this.ctx.startRendering) || this.userSuspended) return;
    this.sfx.flush();
    this.music.update(game);
  }

  event(name, data = {}) {
    if (!this.ctx || this.userSuspended || globalThis.document?.hidden) return;
    if (data.level != null) this.level = data.level;
    if (name === 'state.change') this.music.stateChange(data.to);
    if (name === 'boss.phase') this.music.phaseChange(data.phase);
    if (name === 'boss.down') this.music.stop();
    if (name === 'hurt') this.duck('music', .6, .4);
    if (name === 'song.release' && data.quality?.toLowerCase() === 'perfect') this.duck('sfx', .7, .6);
    this.sfx.event(name, data);
  }

  distance(data = {}) {
    if (!Number.isFinite(data.x) || !Number.isFinite(data.y)) return { volume: 1, pan: 0 };
    const distance = Math.hypot(data.x - this.listener.x, data.y - this.listener.y);
    return { volume: distance > MIX.inaudible ? 0 : distance > MIX.distant ? .35 : 1,
      pan: clamp((data.x - this.listener.x) / this.listener.width, -1, 1) * MIX.pan };
  }

  duck(bus, ratio, duration) {
    const params = [this.buses[bus]?.gain, this.sends[bus]?.gain].filter(Boolean);
    const now = this.ctx.currentTime;
    for (const gain of params) {
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(MIX[bus] * ratio, now);
      gain.linearRampToValueAtTime(MIX[bus], now + duration);
    }
  }

  /** Every source is counted and routed through one of the four buses. */
  tone({ frequency, end, wave = 'sine', duration = .22, volume = .1, delay = 0,
    when = this.ctx?.currentTime ?? 0, wet = .2, bus, pan = 0, filter, attack = MIX.attack,
    detune = 0, vibrato = 0, priority = 1, channel, sustain = false, tonalLevel = this.level } = {}) {
    if (!this.ctx || volume <= 0 || this.issued >= MIX.voicesPerFrame) return null;
    if (this.voices.size >= MIX.voices) {
      const expendable = [...this.voices].find(voice => voice.priority < priority);
      expendable?.stop();
      // A fading voice still exists until onended: never briefly create #57.
      return null;
    }
    this.issued++;
    const ctx = this.ctx, start = Math.max(ctx.currentTime, when + delay);
    const stop = start + duration;
    const noisy = wave === 'noise';
    const source = noisy ? ctx.createBufferSource() : ctx.createOscillator();
    const nodes = [source], gain = ctx.createGain();
    nodes.push(gain);
    if (noisy) {
      source.buffer = this.noiseBuffer;
      source.loop = true;
    } else {
      frequency = quantize(frequency ?? modeFor(tonalLevel).scale[0], tonalLevel);
      source.type = frequency < 120 ? 'sine' : wave;
      source.frequency.setValueAtTime(frequency, start);
      if (end) source.frequency.exponentialRampToValueAtTime(quantize(end, tonalLevel), stop);
      source.detune.value = detune;
    }
    const route = bus ?? (duration > MIX.maxSfxDuration ? 'music' : 'sfx');
    const output = channel?.dry ?? this.buses[route] ?? this.buses.sfx;
    let last = source;
    let voiceFilter;
    if (filter || noisy) {
      const lp = ctx.createBiquadFilter();
      lp.type = filter?.type ?? 'lowpass';
      let cutoff = filter?.frequency ?? 1200;
      if (cutoff >= 2000 && cutoff <= 4000) cutoff = 1800;
      lp.frequency.setValueAtTime(cutoff, start);
      if (filter?.end) lp.frequency.exponentialRampToValueAtTime(filter.end, stop);
      lp.Q.value = filter?.q ?? .65;
      last.connect(lp); last = lp; nodes.push(lp);
      voiceFilter = lp;
    }
    last.connect(gain);
    gain.gain.setValueAtTime(MIX.floor, start);
    gain.gain.linearRampToValueAtTime(volume, start + Math.min(attack, duration / 3));
    if (sustain) gain.gain.setValueAtTime(volume, Math.max(start + attack, stop - .15));
    gain.gain.exponentialRampToValueAtTime(MIX.floor, stop);
    let dry = gain;
    if (ctx.createStereoPanner) {
      dry = ctx.createStereoPanner(); dry.pan.value = pan;
      gain.connect(dry); nodes.push(dry);
    }
    dry.connect(output);
    if (wet > 0) {
      const send = ctx.createGain(); send.gain.value = wet;
      // A paired wet lane belongs to the same bus and follows its gain/ducking.
      dry.connect(send).connect(channel?.wet ?? this.sends[route] ?? this.sends.sfx); nodes.push(send);
    }
    let lfo;
    if (vibrato && !noisy) {
      lfo = ctx.createOscillator(); lfo.frequency.value = 5.2;
      const amount = ctx.createGain(); amount.gain.value = vibrato;
      lfo.connect(amount).connect(source.detune); lfo.start(start); lfo.stop(stop);
      nodes.push(lfo, amount);
    }
    const voice = { source, gain, filter: voiceFilter, priority, nodes, end: stop, stop: () => {
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(MIX.floor, now, .015);
      try { source.stop(now + MIX.release); lfo?.stop(now + MIX.release); } catch {}
    } };
    this.voices.add(voice);
    source.onended = () => {
      for (const node of nodes) node.disconnect();
      this.voices.delete(voice);
    };
    source.start(start);
    source.stop(stop + MIX.release);
    return voice;
  }

  setMuted(muted) {
    this.muted = !!muted;
    if (this.master) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.value = muted ? 0 : MIX.master;
      this.master.gain.setValueAtTime(muted ? 0 : MIX.master, this.ctx.currentTime);
    }
  }

  async suspend(paused = true) {
    this.userSuspended = !!paused;
    if (!this.ctx || this.ctx.startRendering) return;
    try { if (paused) await this.ctx.suspend(); else if (!globalThis.document?.hidden) await this.ctx.resume(); } catch {}
  }

  destroy() {
    this.music.destroy();
    for (const voice of this.voices) voice.stop();
    this.sfx.pending = [];
    for (const off of this.unsubscribers) off();
    globalThis.document?.removeEventListener('visibilitychange', this.visibility);
    const closing = this.ctx?.close?.();
    closing?.catch?.(() => {});
    this.ctx = null;
  }
}
