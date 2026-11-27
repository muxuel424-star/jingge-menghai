import test from 'node:test';
import assert from 'node:assert/strict';
import { Song } from '../src/sim/song.js';

function perform(fps, offset, options = {}) {
  const events = [];
  const song = new Song({ emit: (type, payload) => events.push({ type, ...payload }), ...options });
  song.begin({ response: options.response });
  const target = song.phraseSeconds + offset;
  while (song.clock + 1 / fps < target - 1e-10) song.step(1 / fps, { held: true });
  const result = song.step(target - song.clock, { held: false, response: options.response });
  return { song, release: result.release, events };
}

test('four-beat release keeps all three judgments at 30, 60 and 144 fps', () => {
  for (const [offset, expected] of [[.075, 'perfect'], [.12, 'good'], [.25, 'miss']]) {
    const results = [30, 60, 144].map(fps => perform(fps, offset));
    for (const { release, events } of results) {
      assert.equal(release.quality, expected);
      assert.ok(Math.abs(release.error - offset) < 1e-9);
      assert.equal(events.filter(event => event.type === 'song.release').length, 1);
      assert.equal(events.filter(event => event.type === 'song.beat').length, 5);
    }
  }
});

test('precise input timestamp survives a render frame crossing the release instant', () => {
  for (const fps of [30, 60, 144]) {
    const song = new Song(); song.begin();
    const at = song.phraseSeconds + .079;
    while (song.clock < at) song.step(1 / fps, { held: true });
    assert.equal(song.step(0, { held: false, at }).release.quality, 'perfect');
  }
});

test('three melody fragments widen Perfect to 110 milliseconds', () => {
  assert.equal(perform(60, .105).release.quality, 'good');
  assert.equal(perform(60, .105, { response: true }).release.quality, 'perfect');
  assert.equal(perform(60, .115, { response: true }).release.quality, 'good');
});

test('Perfect rewards, Miss penalty and long holding do not bypass cooldown', () => {
  const perfect = perform(60, 0).release;
  assert.ok(perfect.stun >= 2);
  assert.equal(perfect.memBonus, 8);
  const { song, release } = perform(60, .3);
  assert.equal(release.breathPenalty, 10);
  assert.equal(song.begin(), false);
  song.step(20, { held: true });
  assert.equal(song.holding, false);
  song.step(0, { held: false });
  assert.equal(song.begin(), true);
  assert.equal(song.step(song.phraseSeconds * 2.2, { held: true }).release.quality, 'miss');
  assert.equal(song.holding, false);
});

test('three consecutive Perfect releases trigger eight seconds of resonance', () => {
  const events = [], song = new Song({ emit: (type, payload) => events.push({ type, ...payload }) });
  for (let phrase = 0; phrase < 3; phrase++) {
    song.step(10, { held: false });
    assert.equal(song.begin(), true);
    song.step(song.phraseSeconds, { held: true });
    song.release();
  }
  assert.equal(song.resonance, 8);
  assert.equal(events.filter(event => event.type === 'song.resonate').length, 1);
  assert.ok(song.lastRelease.radius > 220 * 1.3);
});

test('transition cancellation never grants a release or reward', () => {
  const events = [], song = new Song({ emit: type => events.push(type) });
  song.begin(); song.step(1, { held: true }); song.cancel('transition');
  assert.equal(song.holding, false);
  assert.equal(song.lastRelease, null);
  assert.equal(events.includes('song.release'), false);
  assert.equal(song.release(), null);
});
