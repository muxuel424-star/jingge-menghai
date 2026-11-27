import test from 'node:test';
import assert from 'node:assert/strict';
import { SoundEffects } from '../src/audio/sfx.js';
import { MODES, BOSS_TELLS } from '../src/data/audio.js';
import { BOSSES } from '../src/data/index.js';
import { Song } from '../src/sim/song.js';

function probe(level = 1) {
  const tones = [], scheduled = [];
  const engine = { ctx: { currentTime: 10 }, level, distance: () => ({ volume: 1, pan: 0 }),
    tone(options) {
      const voice = { source: { frequency: { setValueAtTime(value, time) { scheduled.push({ value, time }); } } },
        gain: { gain: { setTargetAtTime() {} } }, stop() { this.stopped = true; } };
      tones.push({ ...options, voice }); return voice;
    } };
  const sfx = new SoundEffects(engine);
  return { engine, sfx, tones, scheduled };
}

test('actual simulation event aliases produce pickup, enemy, armor and movement sounds', () => {
  for (const [name, data] of [['item.pickup', { key: 'heal' }], ['fish.attack', { kind: 'abyss' }],
    ['fish.crack', {}], ['jelly.bounce', {}], ['hazard.vent', {}], ['whoosh', {}],
    ['fragment.collect', {}], ['instrument.hit', { key: 'schoolBell' }]]) {
    const { sfx, tones } = probe(); sfx.event(name, data);
    assert.ok(tones.length + sfx.pending.length > 0, `${name} must be audible`);
  }
});

test('every authored Boss skill has a distinct windup score in that encounter', () => {
  for (const boss of Object.values(BOSSES)) {
    const scores = new Set();
    for (const skill of boss.skills) {
      const score = BOSS_TELLS[boss.key]?.[skill.key];
      assert.ok(score, `${boss.key}.${skill.key} has no tell`);
      const signature = JSON.stringify(score); assert.ok(!scores.has(signature)); scores.add(signature);
      const { sfx, tones } = probe(boss.level); sfx.event('boss.tell', { key: boss.key, skill: skill.key, windup: skill.tell });
      assert.ok(tones.length + sfx.pending.length >= 3);
    }
  }
});

test('thermal, rock and light warnings remain distinct for actual camelCase hazard kinds', () => {
  const outputs = ['thermalVent', 'fallingTimber', 'lightGrate'].map(kind => {
    const { sfx, tones } = probe(); sfx.event('env.warn', { kind });
    return JSON.stringify(tones.map(({ frequency, wave, filter }) => ({ frequency, wave, filter })));
  });
  assert.equal(new Set(outputs).size, 3);
});

test('audio-clock scheduling includes Qwen half-beat and Claude final fifth note before frames arrive', () => {
  for (const level of [2, 5]) {
    const { engine, sfx, scheduled } = probe(level), mode = MODES[level];
    sfx.event('song.start', { response: true, bpm: 72, clock: 20, startedAt: 20, age: 0 });
    for (let i = 0; i < mode.melody.length; i++) {
      assert.ok(scheduled.some(note => note.value === mode.melody[i]
        && Math.abs(note.time - (10 + mode.beats[i] * 60 / 72)) < 1e-9));
    }
    const count = scheduled.length;
    engine.ctx.currentTime = 12.02;
    sfx.event('song.beat', { beat: 2, index: 2, clock: 22 });
    assert.equal(scheduled.length, count, 'a late animation frame cannot reschedule audio pitches');
    assert.ok(Math.abs(sfx.song.drift - .02) < 1e-9);
    assert.ok(sfx.pending.some(tone => tone.songSerial != null));
    const voices = [...sfx.song.voices]; sfx.event('song.cancel');
    assert.ok(voices.every(voice => voice.stopped));
    assert.equal(sfx.pending.filter(tone => tone.songSerial != null).length, 0);
  }
});

test('normal whale melody is seeded, moves one pentatonic step, and exposes a replay clock anchor', () => {
  const left = new Song({ level: 3 }), right = new Song({ level: 3 });
  left.begin(); right.begin(); assert.deepEqual(left.noteSteps, right.noteSteps);
  const notes = left.noteSteps;
  for (let i = 1; i < notes.length; i++) assert.ok([1, 4].includes((notes[i] - notes[i - 1] + 5) % 5));
  assert.equal(left.payload().startedAt, 0); assert.equal(left.payload().clock, 0);
});

test('final choir is gated by awakening, and its four phrases preserve each colleague mode', () => {
  const { sfx, tones } = probe(5);
  sfx.event('boss.gate.result', { key: 'claude', phase: 3, quality: 'Perfect' });
  assert.equal(tones.length + sfx.pending.length, 0);
  sfx.event('awakening', { key: 'claude', phase: 3, quality: 'Perfect' });
  const choir = [...tones, ...sfx.pending].filter(tone => tone.tonalLevel != null);
  assert.deepEqual([...new Set(choir.map(tone => tone.tonalLevel))], [1, 2, 3, 4]);
  for (const tone of choir) assert.ok(MODES[tone.tonalLevel].melody.includes(tone.frequency));
});
