import { BABBLE, BOSS_PITCH, BOSS_TELLS, MIX, modeFor, quantize } from '../data/audio.js';
import { WhaleSong } from './song.js';

const N = (frequency, end, duration, volume, extra = {}) =>
  ({ wave: 'noise', duration, volume, filter: { frequency, end }, ...extra });
const T = (note, duration, volume, extra = {}) => ({ note, duration, volume, ...extra });

export class SoundEffects {
  constructor(engine) {
    this.engine = engine;
    this.last = new Map();
    this.pending = [];
    this.song = new WhaleSong(this);
    this.lineVoices = [];
  }

  flush() {
    const now = this.engine.ctx?.currentTime ?? 0;
    const ready = this.pending.filter(item => item.when <= now + MIX.lookahead);
    this.pending = this.pending.filter(item => item.when > now + MIX.lookahead);
    for (const item of ready) {
      const voice = this.engine.tone(item);
      if (item.babble && voice) this.lineVoices.push(voice);
    }
  }

  play(key, cooldown, layers, data = {}, priority = 1) {
    const audio = this.engine, now = audio.ctx?.currentTime;
    if (now == null || now - (this.last.get(key) ?? -Infinity) < cooldown) return;
    const spatial = audio.distance(data);
    if (!spatial.volume) return;
    this.last.set(key, now);
    const scale = modeFor(audio.level).scale;
    for (const layer of layers) {
      const index = ((layer.note ?? 0) % 5 + 5) % 5;
      const octave = Math.floor((layer.note ?? 0) / 5);
      const options = { ...layer,
        frequency: layer.frequency ?? scale[index] * 2 ** octave,
        volume: layer.volume * spatial.volume,
        pan: spatial.pan, wet: layer.wet ?? .2, priority,
        when: now + (layer.delay ?? 0), delay: 0,
      };
      delete options.note;
      if (key.startsWith('babble.')) options.babble = true;
      if (options.when > now + MIX.lookahead) this.pending.push(options);
      else {
        const voice = audio.tone(options);
        if (options.babble && voice) this.lineVoices.push(voice);
      }
    }
  }

  arpeggio(key, notes = [0, 2, 4], { gap = .09, duration = .38, volume = .08,
    wet = .5, bus, wave = 'sine', ...data } = {}) {
    this.play(key, .08, notes.map((note, index) => T(note, duration, volume,
      { delay: index * gap, wet, bus, wave })), data, 2);
  }

  event(name, data = {}) {
    if (name === 'fragment.collect') this.babble('player');
    const aliases = { 'item.pickup': 'item.pick', 'instrument.hit': 'instrument', 'hazard.vent': 'geyser',
      'jelly.bounce': 'boing', 'song.break': 'song.cancel', 'fish.attack': 'fish.release',
      'fragment.collect': 'heal', 'melody.collect': 'heal', 'dream.collect': 'ui.pick', 'current.enter': 'whoosh' };
    name = aliases[name] ?? name;
    if (name === 'song.start') return this.song.start(data);
    if (name === 'song.beat') return this.song.beat(data);
    if (name === 'song.cancel') return this.stopSong();
    if (name === 'song.release') return this.releaseSong(data);
    if (name === 'song.resonate') return this.arpeggio(name, [0, 2, 4, 5, 7, 9, 10, 7, 5],
      { gap: .18, duration: 2, volume: .065, wet: 1, bus: 'music' });
    if (name === 'eat') return this.eat(data.kind, data.combo ?? 0, data);
    if (name === 'bite') return this.play(data.hit ? 'biteHit' : 'biteWhiff', .05,
      data.hit ? [N(1800, 160, .18, .18), T(-5, .12, .055, { wave: 'square' })]
        : [N(4800, 900, .07, .09)], data);
    if (name === 'dash') return this.play(name, .3, [N(1800, 300, .35, .11, { wet: .2 })], data);
    if (name === 'hurt') return this.play(name, .18,
      [N(1800, 190, .16, .16), T(-5, .29, .14, { end: modeFor(this.engine.level).scale[0] / 4, wet: .3 })], data, 3);
    if (name === 'heal' || name === 'evolve') return this.arpeggio(name, [0, 2, 4, 5], { ...data, volume: .09, wet: .5 });
    if (name === 'dream.deliver') return this.arpeggio(name, [0, 2, 4], { ...data, gap: .12 });
    if (name === 'dream.scatter') return this.arpeggio(name, [4, 2, 0], { ...data, volume: .04 });
    if (name === 'nightmare.calm') return this.arpeggio(name, [0, 2, 4, 5], { ...data, duration: .7, wet: .8, volume: .055 });
    if (name === 'shield.break') return this.play(name, .1, [T(9, .3, .08), N(4800, 900, .15, .05)], data);
    if (['boss.enter', 'boss.phase', 'boss.gate', 'boss.down'].includes(name)) {
      this.babble(data.key, name === 'boss.phase' ? MIX.phaseSilence : name === 'boss.down' ? (data.lineAt ?? 3.2) : 0);
    }
    if (name === 'item.pick') return this.pickup(data);
    if (name === 'fish.tell' || name.startsWith('fish.tell.')) return this.fish('tell', data.kind ?? name.split('.').pop(), data);
    if (name === 'fish.release' || name.startsWith('fish.release.')) return this.fish('release', data.kind ?? name.split('.').pop(), data);
    if (name === 'fish.crack') return this.play(name, .1, [N(4800, 950, .18, .12), T(7, .15, .04, { wave: 'square' })], data);
    if (name === 'boss.tell' || name.startsWith('boss.tell.')) return this.bossTell(data);
    if (name === 'boss.attack' || name.startsWith('boss.attack.')) return this.bossAttack(data);
    if (name === 'boss.hurt') return this.play(data.back ? 'boss.backhit' : name, .15,
      [T(4, .22, .09, { wave: 'triangle', end: modeFor(this.engine.level).scale[0] }), N(4800, 950, .12, .08),
        ...(data.back ? [T(9, .2, .055, { wet: .5 })] : [])], data, 2);
    if (name === 'boss.stone') return this.play(name, .1, [N(950, 190, .11, .07), T(-3, .16, .045)], data, 3);
    if (name === 'boss.yarn.bounce') return this.play(name, .1, [T(5, .15, .055, { wave: 'sine' }), N(650, 220, .08, .025)], data);
    if (name === 'boss.phase') return this.play(name, .5,
      [T(-5, 1.2, .18, { wave: 'sine', vibrato: 13, wet: .75, bus: 'music' })], data, 4);
    if (name === 'boss.down') return this.down(data);
    if (name === 'boss.gate') return this.arpeggio(name, [0, 1, 2, 3], { gap: .12, volume: .045, wet: .65 });
    if (name === 'awakening') return this.choir();
    if (name === 'env.warn' || name === 'env.fire') return this.environment(name, data);
    if (name === 'geyser') return this.play(name, .4, [N(380, 1800, 1.2, .095)], data);
    if (name === 'whoosh') return this.play(name, .6, [N(600, 1800, .5, .065)], data);
    if (name === 'boing') return this.play(name, .3,
      [T(0, .3, .09, { end: modeFor(this.engine.level).scale[4] }), T(5, .22, .035, { wave: 'triangle' })], data);
    if (name === 'instrument') return this.arpeggio(name, [0, 4, 7], { ...data, wet: .9, duration: 1.4, volume: .09 });
    if (name === 'dialogue') return this.babble(data.speaker ?? data.key ?? 'player');
    if (name === 'dawn.bell') return this.arpeggio(name, [0, 4, 5], { gap: .45, duration: 2.2, volume: .09, wet: .9, bus: 'music' });
    if (name.startsWith('ui.')) {
      const notes = name === 'ui.seal' ? [0, 4, 5] : name === 'ui.confirm' ? [2, 4] : [4];
      return this.arpeggio(name, notes, { bus: 'voice', duration: .18, volume: .055, wet: .1 });
    }
    if (name === 'state.change') {
      if (!['SURFACE', 'DEEP', 'BOSS'].includes(data.to)) this.stopSong();
      if (data.to === 'DAWN') this.event('dawn.bell');
      if (data.to === 'DESCENT') this.play('descent', 1, [T(-5, 3, .065, { bus: 'music', wet: 1 }),
        N(700, 220, 1.3, .035, { delay: 1.2, wet: .8 })]);
    }
    if (name === 'counterkill') return this.play(name, .5, [T(-5, 1.5, .09, { wet: .8 }),
      N(900, 160, .8, .065, { delay: .5 }), T(7, .4, .06, { delay: 1.3, wet: .8 })], data, 4);
    if (name === 'frenzy') return this.arpeggio(name, [0, 2, 4, 5, 9], { volume: .055, wet: .5 });
    if (name === 'shortcut') return this.play(name, .5, [N(600, 1600, .4, .045), T(5, .35, .045, { wet: .5 })], data);
    if (name === 'run.finish' && data.outcome !== 'CLEARED') return this.arpeggio('failure', [2, 0, -3],
      { gap: .4, duration: 1.2, volume: .06, wet: .8, bus: 'music' });
  }

  eat(kind = 'fry', combo = 0, data = {}) {
    const recipes = {
      fry: [T(0, .13, .07), N(1600, 420, .06, .035)],
      lantern: [T(2, .2, .075, { wave: 'triangle' }), N(4800, 450, .09, .04), T(7, .24, .04, { delay: .06 })],
      manta: [T(-3, .28, .09, { wave: 'triangle' }), N(1100, 180, .18, .07)],
      royal: [N(4800, 1200, .16, .08), T(0, .22, .055, { wave: 'square' }), T(8, .25, .04, { delay: .08 })],
      abyss: [T(-5, .65, .16), N(900, 120, .34, .1), T(5, .6, .07, { delay: .3, wet: .6 })],
      clam: [T(9, .4, .08, { wet: .5 }), T(12, .3, .045, { delay: .07, wet: .5 })],
      crystal: [N(4800, 900, .07, .04), T(10, .32, .07, { wet: .35 })],
      chest: [N(950, 240, .2, .08), ...[0, 2, 4].map((note, i) => T(note + 5, .4, .065, { delay: .08 + i * .09, wet: .4 }))],
    };
    if (kind === 'jellyfish' || kind === 'paper') kind = 'lantern';
    const multiplier = Math.min(1.25, 1 + combo * .006);
    this.play(`eat.${kind}`, .045, (recipes[kind] ?? recipes.fry).map(layer => ({ ...layer, volume: layer.volume * multiplier })), data);
    if (combo > 0 && combo % 4 === 0) this.arpeggio('combo', [5 + Math.min(5, Math.floor(combo / 4))], { ...data, duration: .22, volume: .045 });
  }

  pickup(data) {
    const kind = data.kind ?? data.key;
    const notes = { lamp: [5, 7, 9], shield: [0, 4, 5], magnet: [0, 2, 5],
      bait: [2, 4, 5], haste: [0, 1, 2, 4], heal: [0, 2, 4], smoke: [4, 2, 0], sonar: [5, 9, 10] };
    this.arpeggio(`item.${kind}`, notes[kind] ?? [0, 2, 4], { ...data, duration: .33, volume: .065 });
  }

  fish(action, kind = 'lantern', data = {}) {
    const timbres = {
      lantern: { note: 1, wave: 'triangle', wet: .15 },
      manta: { note: -3, wave: 'sine', wet: .4 },
      royal: { note: 3, wave: 'square', wet: .12 },
      abyss: { note: -5, wave: 'sine', wet: .6 },
      nightmare: { note: -2, wave: 'triangle', wet: .7 },
      guard: { note: -1, wave: 'square', wet: .12 },
      tapir: { note: -4, wave: 'triangle', wet: .5 },
      jelly: { note: 5, wave: 'sine', wet: .55 },
      fry: { note: 4, wave: 'sine', wet: .1 },
    };
    const timbre = timbres[kind] ?? { note: 2, wave: 'sine', wet: .25 };
    const tell = action === 'tell';
    const duration = Math.min(1.5, tell ? (data.duration ?? data.windup ?? .65) : .22);
    const layers = [T(timbre.note, duration, tell ? .055 : .1, timbre)];
    if (!tell) layers.push(N(kind === 'abyss' ? 700 : 1600, 180, .18, .075));
    this.play(`fish.${action}.${kind}`, .22, layers, data);
  }

  bossTell(data) {
    const pitch = BOSS_PITCH[data.key] ?? 1;
    const base = modeFor(this.engine.level).scale[0];
    const frequency = quantize(base * pitch, this.engine.level);
    const score = BOSS_TELLS[data.key]?.[data.skill] ?? { notes: [0, 2], wave: 'triangle' };
    const duration = Math.min(1.5, data.windup ?? data.duration ?? .7);
    this.play(`boss.tell.${data.key}.${data.skill}`, .18,
      [{ frequency, wave: score.wave, duration, volume: .055, wet: .55, vibrato: 6 },
        ...score.notes.map((note, index) => T(note, Math.min(.2, duration / score.notes.length), .042,
          { wave: score.wave, delay: index * duration / score.notes.length, wet: .35 }))], data, 3);
  }

  bossAttack(data) {
    const skill = data.pattern ?? data.skill ?? 'dash';
    const recipes = {
      dash: [N(1600, 240, .28, .16), T(-5, .24, .1)],
      plates: [N(4800, 1100, .18, .085), T(9, .25, .06), T(7, .18, .03, { delay: .06 })],
      stones: [N(1800, 150, .29, .15), T(-5, .3, .11), T(-2, .12, .025, { wave: 'square' })],
      wave: [T(-5, .5, .12), N(340, 1600, .45, .095)],
      ambush: [N(4800, 850, .18, .1), T(4, .2, .07, { wave: 'triangle' }), N(1500, 180, .12, .075, { delay: .07 })],
    };
    let recipe = recipes[skill];
    if (!recipe) recipe = /plate|porcelain|shard|fan/.test(skill) ? recipes.plates
      : /stone|chess|fall|board/.test(skill) ? recipes.stones
      : /wave|ring|sweep|rain/.test(skill) ? recipes.wave
      : /hide|pounce|ambush|dark/.test(skill) ? recipes.ambush : recipes.dash;
    this.play(`boss.attack.${skill}`, .16, recipe, data, 3);
  }

  environment(name, data) {
    const kind = data.kind ?? data.type ?? 'rock';
    const warn = name === 'env.warn';
    const thermal = /thermal|steam|eruption|heat|lava|vent|fire|geyser/i.test(kind);
    const light = /light|beam|laser|mirror|echoRing/i.test(kind);
    const layers = light ? [T(warn ? 5 : 9, warn ? .4 : .55, .07, { wet: .7 })]
      : thermal ? [T(-5, warn ? .45 : .6, .085), N(700, warn ? 1200 : 220, .35, warn ? .025 : .11)]
      : [N(warn ? 1000 : 1700, 240, warn ? .35 : .25, warn ? .045 : .1), T(-2, .22, warn ? .025 : .05, { wave: 'triangle' })];
    this.play(`${name}.${kind}`, warn ? .4 : .25, layers, data);
  }

  stopSong() { this.song.stop(); }

  releaseSong(data) {
    this.stopSong();
    const quality = data.quality?.toLowerCase();
    if (quality === 'perfect') {
      this.arpeggio('song.perfect', [0, 2, 4, 9], { gap: .08, duration: .6, volume: .09, wet: 1 });
      // A quiet rising breath supplies the reverse tail without a harsh impact.
      this.play('song.reverse', .1, [N(450, 1200, .65, .025, { attack: .42, wet: 1 })], {}, 2);
    } else if (quality === 'good') this.arpeggio('song.good', [0, 5], { duration: .5, volume: .065, wet: .7 });
    else this.play('song.miss', .1, [T(-2, .32, .055), N(600, 180, .2, .05)], data);
    if (data.response && Number(this.engine.level) === 5 && quality !== 'miss') {
      this.play('song.tail', .1, [T(4, .6, .055, { delay: .2, wet: .8, bus: 'music' })]);
    }
  }

  choir() {
    const beat = 60 / 72;
    // The final answer quotes each colleague's melody in its own mode.
    // These are music phrases, rather than cross-key action effects.
    for (let level = 1; level <= 4; level++) {
      const mode = modeFor(level);
      this.play(`choir.${level}`, 20, mode.melody.map((frequency, index) => ({
        frequency, tonalLevel: level, wave: ['triangle', 'triangle', 'sine', 'sine'][level - 1],
        duration: .9, volume: .042, wet: 1, bus: 'music',
        delay: .3 + ((level - 1) * 4 + mode.beats[index]) * beat,
      })), {}, 3);
    }
  }

  down(data) {
    this.play('boss.down', .9, [N(4800, 180, .6, .09), T(-5, 2.8, .13, { vibrato: 8, wet: .7, bus: 'music' }),
      T(0, 1.3, .07, { delay: 3.2, wet: .8, bus: 'music' }), T(2, 1.3, .07, { delay: 3.7, wet: .8, bus: 'music' })], data, 4);
  }

  babble(key, delay = 0) {
    const voice = BABBLE[key] ?? BABBLE.player;
    for (const lineVoice of this.lineVoices) lineVoice.gain.gain.setTargetAtTime(.003, this.engine.ctx.currentTime, .025);
    for (const item of this.pending) if (item.babble) item.volume *= .3;
    this.lineVoices = [];
    const base = modeFor(this.engine.level).scale[0] * voice.pitch;
    this.play(`babble.${key}`, .3, Array.from({ length: voice.count }, (_, index) => ({
      frequency: quantize(base * [1, 1.25, 1, 1.5][index % 4], this.engine.level),
      wave: voice.wave, duration: .08, volume: voice.wave === 'square' ? .018 : .035,
      delay: delay + index * voice.gap, bus: 'voice', wet: .06,
    })), {}, 2);
  }
}
