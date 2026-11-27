import test from 'node:test';
import assert from 'node:assert/strict';
import { createHazard } from '../src/sim/entities/hazard.js';
import { tickHazards } from '../src/sim/systems/hazards.js';
import { RNG } from '../src/sim/rng.js';

function fixture(spec) {
  const hazard = createHazard({ x: 500, y: 500, w: 400, h: 400, ...spec }, 1, { hazardTell: 0.7 });
  const damage = [], events = [];
  const game = {
    player: { x: 500, y: 500, vx: 0, vy: 0, r: 23, tier: 0 },
    entities: { hazards: [hazard], nightmares: [] }, fish: [],
    scene: {}, input: {}, conditions: {}, stillTime: 0, loopCount: 0,
    rng: new RNG(123), terrain: { resolve: entity => entity },
    damagePlayer: (amount, kind) => damage.push({ amount, kind }),
    emit: (type, payload) => events.push({ type, ...payload }),
  };
  return { game, hazard, damage, events };
}

test('zero-period currents stay finite and the heavy body resists the shaft current', () => {
  const rising = fixture({ kind: 'upcurrent', period: 0 });
  tickHazards(rising.game, 1);
  assert.ok(rising.game.player.y < 500);
  assert.equal(rising.damage.length, 0);
  const small = fixture({ kind: 'downcurrent', period: 0 });
  const heavy = fixture({ kind: 'downcurrent', period: 0 }); heavy.game.player.tier = 2;
  tickHazards(small.game, 1); tickHazards(heavy.game, 1);
  assert.ok(small.game.player.y > heavy.game.player.y);
  assert.ok(Number.isFinite(heavy.game.player.y));
});

test('continuous lava hurts and thermal springs propel without dealing damage', () => {
  const lava = fixture({ kind: 'lava', period: 0 });
  tickHazards(lava.game, 1 / 60);
  assert.deepEqual(lava.damage, [{ amount: 16, kind: 'lava' }]);
  const vent = fixture({ kind: 'thermalVent', period: 5 });
  vent.hazard.age = vent.hazard.tell;
  tickHazards(vent.game, 0.1);
  assert.ok(vent.game.player.y < 500);
  assert.equal(vent.damage.length, 0);
  assert.ok(vent.events.some(event => event.type === 'hazard.vent'));
});

test('steam can push a nightmare out and unlock the exposure story fragment', () => {
  const { game, hazard } = fixture({ kind: 'steam', period: 5 });
  const nightmare = { x: 530, y: 500, r: 20 };
  game.entities.nightmares.push(nightmare); hazard.age = hazard.tell;
  tickHazards(game, 0.1);
  assert.ok(nightmare.x > 530);
  assert.equal(game.conditions.steamExposure, true);
});

test('falling timber only hits at its moving log and porcelain shards actually rebound', () => {
  const timber = fixture({ kind: 'fallingTimber', period: 5 });
  timber.hazard.age = timber.hazard.tell;
  tickHazards(timber.game, 0.1);
  assert.equal(timber.damage.length, 0);
  timber.game.player.y = timber.hazard.logY;
  tickHazards(timber.game, 1 / 60);
  assert.equal(timber.damage[0].kind, 'fallingTimber');
  const shards = fixture({ kind: 'ricochetShards', period: 5, w: 60, h: 60 });
  shards.hazard.age = shards.hazard.tell;
  tickHazards(shards.game, 0.2);
  assert.equal(shards.hazard.shards.length, 3);
  assert.ok(shards.hazard.shards.some(shard => shard.bounces > 0));
});

test('the night-shift corridor keeps repeating until the player stops inside it', () => {
  const { game } = fixture({ kind: 'current', period: 0 });
  game.entities.hazards = []; game.scene.loop = { fromX: 100, toX: 700, maxLoops: 2, breakWhenStill: 3, hintKey: 'ui.loop' };
  game.input.x = 1;
  for (let i = 0; i < 3; i++) { game.player.x = 710; tickHazards(game, 1 / 60); assert.equal(game.player.x, 100); }
  assert.equal(game.loopCount, 3);
  game.input = {}; game.player.x = 200; tickHazards(game, 3.1);
  assert.equal(game.conditions.still3s, true);
  game.player.x = 710; tickHazards(game, 1 / 60);
  assert.equal(game.player.x, 710);
});

test('the maid-room cat requires stopping by the tea things rather than elsewhere', () => {
  const { game } = fixture({ kind: 'current', period: 0 }); game.entities.hazards = [];
  game.scene.fragments = [{ condition: 'still3s', x: 700, y: 500 }];
  tickHazards(game, 4);
  assert.equal(game.conditions.still3s, undefined);
  game.player.x = 700; game.input.x = 1; tickHazards(game, 1 / 60);
  game.input = {}; tickHazards(game, 3.1);
  assert.equal(game.conditions.still3s, true);
});

test('each timed mechanism emits one warning and one firing sound per cycle', () => {
  const { game, events } = fixture({ kind: 'lightGrate', period: 5 });
  for (let i = 0; i < 70; i++) tickHazards(game, 1 / 60);
  assert.equal(events.filter(event => event.type === 'env.warn').length, 1);
  assert.equal(events.filter(event => event.type === 'env.fire').length, 1);
});
