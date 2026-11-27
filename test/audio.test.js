import test from 'node:test';
import assert from 'node:assert/strict';
import { MODES, MIX, quantize } from '../src/data/audio.js';
import { AudioEngine } from '../src/audio/engine.js';

test('all quantized tonal effects stay in the current five-note scale, including bass', () => {
  for (const [level, mode] of Object.entries(MODES)) {
    for (let frequency = 28; frequency < 6000; frequency *= 1.051) {
      const quantized = quantize(frequency, level);
      assert.ok(mode.scale.some(note => Math.abs(Math.log2(quantized / note) - Math.round(Math.log2(quantized / note))) < 1e-9));
    }
    for (const frequency of mode.melody) assert.equal(quantize(frequency, level), frequency);
  }
});

test('Boss melodies preserve the specified full notes and fourth-beat release pitch', () => {
  assert.deepEqual(MODES[2].notes, ['A', 'G', 'E', 'D', 'C']);
  assert.equal(MODES[2].notes[MODES[2].beats.indexOf(3)], 'C');
  assert.deepEqual(MODES[5].notes, ['G', 'A', 'B', 'D', 'E']);
  assert.equal(MODES[5].notes[MODES[5].beats.indexOf(3)], 'D');
  assert.equal(MIX.voices, 56);
  assert.equal(MIX.voicesPerFrame, 8);
});

test('missing WebAudio degrades silently and bus subscription is disposed', async () => {
  let handler, disposed = false;
  const audio = new AudioEngine({ bus: { on: (key, fn) => { assert.equal(key, '*'); handler = fn; return () => { disposed = true; }; } } });
  assert.equal(await audio.init(), false);
  handler('song.start', {}); audio.update({}); audio.setMuted(true); await audio.suspend(true);
  audio.destroy(); assert.equal(disposed, true);
});
