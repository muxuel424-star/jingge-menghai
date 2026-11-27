import { MIX, SONG_DEFAULTS, modeFor } from '../data/audio.js';

/** One simulation phrase maps to one audio-clock anchor, including fractional notes. */
export class WhaleSong {
  constructor(effects) {
    this.effects = effects;
    this.voices = [];
    this.serial = 0;
    this.anchor = 0;
    this.drift = 0;
  }

  start(data = {}) {
    this.stop();
    const audio = this.effects.engine, mode = modeFor(audio.level);
    const beatSeconds = 60 / (data.bpm ?? SONG_DEFAULTS.bpm);
    const beats = data.beats ?? SONG_DEFAULTS.beats;
    const maxBeats = beats * (data.maxPhrases ?? SONG_DEFAULTS.maxPhrases);
    this.anchor = audio.ctx.currentTime - (data.age ?? 0);
    this.simStart = data.startedAt ?? data.clock ?? 0;
    const serial = this.serial, notes = [];
    if (data.response) {
      for (let cycle = 0; cycle < Math.ceil(maxBeats / beats); cycle++) {
        for (let note = 0; note < mode.beats.length; note++) {
          if (cycle > 0 && mode.beats[note] === 0 && mode.beats.at(-1) === beats) continue;
          notes.push({ frequency: mode.melody[note], at: cycle * beats + mode.beats[note] });
        }
      }
    } else for (let index = 0; index <= Math.ceil(maxBeats); index++) {
      notes.push({ frequency: mode.scale[data.noteSteps?.[index] ?? index % mode.scale.length], at: index });
    }
    const initial = notes[0]?.frequency ?? mode.scale[0];
    for (const ratio of [1, .5]) {
      const voice = audio.tone({ frequency: initial * ratio, duration: maxBeats * beatSeconds + .15,
        when: this.anchor, volume: ratio === 1 ? .08 : .035, wave: ratio === 1 ? 'triangle' : 'sine',
        attack: .15, wet: .8, bus: 'music', vibrato: 10, priority: 4, sustain: true });
      if (!voice) continue;
      this.voices.push(voice);
      for (const note of notes) {
        const when = this.anchor + note.at * beatSeconds;
        if (when < audio.ctx.currentTime || note.at > maxBeats) continue;
        // WebAudio owns all beat times; late animation frames cannot delay a note.
        voice.source.frequency.setValueAtTime(note.frequency * ratio, when);
      }
    }
    const layers = Array.from({ length: Math.ceil(maxBeats) }, (_, index) => ({ wave: 'noise',
      filter: { frequency: 1800, end: 900 }, duration: .04,
      volume: index % beats === beats - 1 ? .025 : .014, wet: .1,
      delay: index * beatSeconds, songSerial: serial }));
    this.effects.play('song.tick.phrase', 0, layers, {}, 2);
  }

  beat(data = {}) {
    if (!this.voices.length) return;
    const expected = this.anchor + (data.clock ?? 0) - this.simStart;
    this.drift = this.effects.engine.ctx.currentTime - expected;
  }

  stop() {
    for (const voice of this.voices) voice.stop();
    this.voices = [];
    this.effects.pending = this.effects.pending.filter(item => item.songSerial == null);
    this.serial++;
  }
}
