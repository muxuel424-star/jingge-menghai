import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { LEVELS, text } from '../src/data/index.js';
import { TUNING as T } from '../src/data/tuning.js';

const dt = T.sim.step;
function advance(game, seconds, input = {}) {
  for (let i = 0; i < Math.ceil(seconds / dt); i++) game.step(dt, input);
}
function surface(key = 'bay') {
  const game = new Game({ level: key, seed: 71 });
  game.start(key).begin(); game.step(dt, {});
  return game;
}
function placeFixture(game, x, y) {
  Object.assign(game.player, { x, y, prevX: x, prevY: y, vx: 0, vy: 0 });
  assert.equal(game.terrain.contains(x, y, game.player.r), false, 'fixture must start in authored open water');
}
function perfect(game) {
  const frames = Math.round(game.song.phraseSeconds / dt);
  for (let i = 0; i < frames; i++) game.step(dt, { sing: true });
  game.step(dt, {});
  assert.equal(game.song.lastRelease.quality, 'perfect');
}

test('first-night input alone collects dreamfish and delivers them to the moon well', () => {
  const game = surface();
  for (let i = 0; i < 280 && !game.delivered; i++) game.step(dt, { x: 1 });
  assert.ok(game.delivered > 0);
  assert.equal(game.state, 'SURFACE');
  assert.ok(game.surfaceTime < 10);
  assert.equal(game.player.tier, 0);
});

test('each authored beat teaches only on first entry, independently in the two dream layers', () => {
  const game = surface(), notifications = [];
  game.bus.on('notify', payload => notifications.push(payload));
  for (const layer of ['surface', 'deep']) {
    if (layer === 'deep') { game.transition('DEEP'); game.addMem(T.tiers[2].mem, 100); game.evolutionTimer = 0; }
    const beats = game.scene.beats;
    for (const beat of beats) {
      // This test isolates entry events, rather than claiming to play the level.
      const position = game.scene.mainPath.find(p => p.x >= beat.from && p.x < beat.to);
      placeFixture(game, position.x, position.y);
      game.step(dt, {}); game.step(dt, {});
      if (layer === 'surface' && beat.key === 'B1') continue; // already taught by surface().
      const seen = notifications.filter(n => n.layer === layer && n.beat === beat.key);
      assert.equal(seen.length, 1, layer + ':' + beat.key);
      assert.equal(seen[0].text, text(beat.teachKey));
      assert.ok([...seen[0].text].length <= 12);
    }
    const first = beats[0], position = game.scene.mainPath[0];
    placeFixture(game, position.x, position.y); game.step(dt, {});
    assert.ok(notifications.filter(n => n.layer === layer && n.beat === first.key).length <= 1);
  }
  assert.equal(game.currentBeat.key, 'D1');
});

// The following fixtures begin at a secret's authored location, then exercise
// actual movement, song judgment and hazard timing. Conditions are never forced.
test('the bay secret requires swimming against an actual current', () => {
  const game = surface(), fragment = game.entities.fragments[2];
  placeFixture(game, 2900, 1000);
  game.step(dt, { x: 1 });
  assert.equal(game.conditions.reverseCurrent, undefined);
  game.step(dt, { x: -1 });
  assert.equal(game.conditions.reverseCurrent, true);
  for (let i = 0; i < 100 && !game.storyFragments.has(2); i++) {
    const dx = fragment.x - game.player.x, dy = fragment.y - game.player.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    game.step(dt, { x: dx / length, y: dy / length });
  }
  assert.equal(game.storyFragments.has(2), true);
  assert.ok(game.surfaceTime < T.run.riftFallback);
});

test('the porcelain secret is reached by swimming down along the hull', () => {
  const game = surface('porcelain'), fragment = game.entities.fragments[2];
  placeFixture(game, fragment.x, game.scene.height * .65);
  game.step(dt, {});
  assert.equal(game.checkCondition('lowPass'), false);
  assert.equal(game.storyFragments.has(2), false);
  advance(game, .8, { y: 1 });
  assert.equal(game.checkCondition('lowPass'), true);
  assert.equal(game.storyFragments.has(2), true);
});

test('a Perfect elsewhere cannot reveal the violet cat; singing in its warm room can', () => {
  const game = surface('violet');
  perfect(game);
  assert.equal(game.conditions.perfectSong, undefined);
  advance(game, game.song.cooldown + dt);
  const fragment = game.entities.fragments[2];
  placeFixture(game, fragment.x, fragment.y);
  game.step(dt, {});
  assert.equal(game.storyFragments.has(2), false);
  perfect(game);
  assert.equal(game.conditions.perfectSong, true);
  assert.equal(game.storyFragments.has(2), true);
});

test('the magma story requires real steam exposure, including its damage', () => {
  const game = surface('magma'), fragment = game.entities.fragments[2];
  placeFixture(game, fragment.x, fragment.y);
  game.step(dt, {});
  assert.equal(game.conditions.steamExposure, undefined);
  assert.equal(game.storyFragments.has(2), false);
  advance(game, 2);
  assert.equal(game.conditions.steamExposure, true);
  assert.equal(game.storyFragments.has(2), true);
  assert.ok(game.stats.hits > 0);
  assert.ok(game.player.hp < game.player.maxHp);
});

test('the palace story requires stopping by the tea things for three continuous seconds', () => {
  const game = surface('sanctuary'), fragment = game.entities.fragments[2];
  placeFixture(game, fragment.x, fragment.y);
  game.step(dt, { x: 1 });
  advance(game, 2.8);
  assert.equal(game.storyFragments.has(2), false);
  game.step(dt, { x: 1 });
  advance(game, 2.8);
  assert.equal(game.storyFragments.has(2), false);
  advance(game, .3);
  assert.equal(game.conditions.still3s, true);
  assert.equal(game.storyFragments.has(2), true);
});

test('unresolved secrets give one local hint, never a repeated toast', () => {
  for (const level of LEVELS) {
    const game = surface(level.key), fragment = game.entities.fragments[2], notices = [];
    game.bus.on('notify', payload => notices.push(payload));
    placeFixture(game, fragment.x, fragment.condition === 'lowPass' ? game.scene.height * .65 : fragment.y - 100);
    advance(game, .3);
    assert.equal(notices.filter(n => n.fragment === 2).length, 1, level.key);
    const notice = notices.find(n => n.fragment === 2);
    assert.equal(notice.text, text('teach.hidden.' + fragment.condition));
    assert.ok([...notice.text].length <= 12);
  }
});

test('revisiting after reopening restores known story and unlocked melody while a new full run starts fresh', () => {
  const meta = { levels: { 3: { fragments: [1, 0, 1], melody: 3, cleared: true } } };
  const game = new Game({ level: 'bay', seed: 4, meta });
  game.start('violet', { retry: true });
  assert.equal(game.state, 'DESCENT');
  assert.deepEqual([...game.storyFragments], [0, 2]);
  assert.deepEqual([...game.melodies], [0, 1, 2]);
  game.skipDescent(); advance(game, T.run.descentSkip + dt);
  assert.equal(game.state, 'DEEP');
  assert.equal(game.storyCount, 2);
  assert.ok(game.entities.melodies.every(fragment => fragment.collected));
  game.start('violet');
  assert.equal(game.state, 'BRIEF');
  assert.equal(game.storyCount, 0);
  assert.equal(game.melodyCount, 0);
});

test('a saved partial melody identity survives reopening without guessing which notes were found', () => {
  const game = new Game({ meta: { levels: { 1: { fragments: [0,0,0], melody: 2, melodyIds: [0,2] } } } });
  game.start('bay', { retry: true });
  assert.deepEqual([...game.melodies], [0,2]);
});
