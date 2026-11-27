import { TUNING } from '../data/tuning.js';
import { SONG_DEFAULTS } from '../data/audio.js';
import { RNG } from './rng.js';

/** Pure rhythm state. Every time is simulation seconds; no browser/audio clocks. */
export class Song {
  constructor({ bus, emit, onEvent, level = 1, echo = 0, tuning = {}, rng } = {}) {
    this.emit = onEvent ?? emit ?? ((name, data) => bus?.emit(name, data));
    this.config = { ...SONG_DEFAULTS, ...TUNING.song, ...tuning };
    this.level = level;
    this.rng = rng ?? new RNG(level);
    this.echo = echo;
    this.clock = 0;
    this.age = 0;
    this.active = false;
    this.cooldown = 0;
    this.resonance = 0;
    this.perfectStreak = 0;
    this.lastRelease = null;
    this.blockedUntilUp = false;
    this.beatSeconds = 60 / this.config.bpm;
    this.beatDuration = this.beatSeconds;
    this.beat = 0;
    this.phase = 0;
    this.response = false;
    this.noteSteps = [];
    this.x = this.y = 0;
  }

  get holding() { return this.active; }
  get radius() {
    return this.config.radius * (1 + this.echo * this.config.echoRadius)
      * (this.resonance > 0 ? this.config.resonanceRadius : 1);
  }

  begin(options = {}) {
    if (this.active || this.cooldown > 0 || this.blockedUntilUp || options.canSing === false) return false;
    this.active = true;
    this.age = 0;
    this.phase = 0;
    this.beat = 0;
    this.startedAt = this.clock;
    this.response = !!options.response;
    this.noteSteps = [this.rng.int(0, this.config.beats)];
    for (let beat = 1; beat <= Math.ceil(this.config.beats * this.config.maxPhrases); beat++) {
      this.noteSteps.push((this.noteSteps[beat - 1] + (this.rng.int(0, 1) ? 1 : -1) + 5) % 5);
    }
    this.x = options.x ?? this.x;
    this.y = options.y ?? this.y;
    this.emit('song.start', this.payload({ beat: 0, response: this.response }));
    this.emit('song.beat', this.payload({ beat: 0, response: this.response }));
    return true;
  }

  step(dt, options = {}) {
    if (!Number.isFinite(dt) || dt < 0) return {};
    this.clock += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.resonance = Math.max(0, this.resonance - dt);
    this.x = options.x ?? this.x;
    this.y = options.y ?? this.y;
    if (!options.held) this.blockedUntilUp = false;
    // Input edges belong to the end of this step. A freshly started phrase does
    // not accidentally gain a frame of charge at different rendering rates.
    if (!this.active) {
      this.phase = (this.clock / this.beatSeconds) % this.config.beats;
      this.beat = Math.floor(this.phase);
      if (options.held) this.begin(options);
      return {};
    }
    const previousBeat = Math.floor((this.age + 1e-9) / this.beatSeconds);
    this.age = this.clock - this.startedAt;
    this.phase = (this.age / this.beatSeconds) % this.config.beats;
    this.beat = Math.floor(this.phase);
    const currentBeat = Math.floor((this.age + 1e-9) / this.beatSeconds);
    for (let index = previousBeat + 1; index <= currentBeat; index++) {
      this.emit('song.beat', this.payload({ beat: index % this.config.beats, index, response: this.response }));
    }
    const forced = this.age >= this.phraseSeconds * this.config.maxPhrases;
    if (forced || options.canSing === false || !options.held) {
      return { release: this.release({ ...options, forced: forced || options.canSing === false }) };
    }
    return {};
  }

  get phraseSeconds() { return this.beatSeconds * this.config.beats; }

  release({ forced = false, response = this.response, at } = {}) {
    if (!this.active) return null;
    // Optional timestamp lets input replay retain the exact release instant.
    const age = Number.isFinite(at) ? Math.max(0, at - this.startedAt) : this.age;
    const phrase = this.phraseSeconds;
    const nearest = Math.max(1, Math.round(age / phrase));
    const error = Math.abs(age - nearest * phrase);
    const perfectWindow = response ? this.config.responsePerfect : this.config.perfect;
    const quality = forced ? 'miss' : error <= perfectWindow + 1e-9 ? 'perfect'
      : error <= this.config.good + 1e-9 ? 'good' : 'miss';
    const perfect = quality === 'perfect', miss = quality === 'miss';
    this.perfectStreak = perfect ? this.perfectStreak + 1 : 0;
    if (this.perfectStreak >= 3) {
      this.perfectStreak = 0;
      this.resonance = this.config.resonanceDuration;
      this.emit('song.resonate', this.payload({ duration: this.resonance }));
    }
    this.cooldown = Math.max(0, this.config.cooldown - this.echo * this.config.echoCooldown)
      * (perfect ? this.config.perfectCooldown : 1);
    const result = this.payload({
      quality, error, forced, response, cooldown: this.cooldown,
      radius: this.radius * (perfect ? this.config.perfectRadius : miss ? this.config.missRadius : 1),
      stun: this.config.stun * (perfect ? this.config.perfectStun : miss ? this.config.missStun : 1),
      breathPenalty: miss ? this.config.missBreath : 0,
      memBonus: perfect ? this.config.perfectMem : 0,
      resonance: this.resonance,
    });
    this.active = false;
    this.blockedUntilUp = true;
    this.lastRelease = result;
    this.emit('song.release', result);
    return result;
  }

  cancel(reason = 'transition') {
    const wasActive = this.active;
    this.active = false;
    this.age = 0;
    this.blockedUntilUp = true;
    if (wasActive) this.emit('song.cancel', this.payload({ reason }));
  }

  payload(extra = {}) {
    return { x: this.x, y: this.y, age: this.age, radius: this.radius,
      clock: this.clock, startedAt: this.startedAt, noteSteps: this.noteSteps,
      maxPhrases: this.config.maxPhrases, beats: this.config.beats,
      level: this.level, bpm: this.config.bpm, ...extra };
  }
}

export const createSong = options => new Song(options);
export const beginSong = (song, options) => song.begin(options);
export const updateSong = (song, dt, options) => song.step(dt, options);
export const releaseSong = (song, options) => song.release(options);
