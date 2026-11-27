import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { TUNING as T } from '../src/data/tuning.js';
import { LEVELS, BOSSES } from '../src/data/index.js';
import { createFish } from '../src/sim/entities/fish.js';
import { setupWorld, tickBreakables } from '../src/sim/systems/world.js';
import { tickEmergence, emergence } from '../src/sim/systems/emergence.js';
import { eat, startBite } from '../src/sim/systems/feeding.js';
import { tickFish } from '../src/sim/systems/ecology.js';
import { applySongRelease } from '../src/sim/systems/dreams.js';
import { supplyWeights, forecastSupplies } from '../src/sim/systems/supply.js';
import { tickResources } from '../src/sim/systems/movement.js';
import { beginAttack, tickAttack, tickProjectiles } from '../src/sim/systems/boss-attacks.js';
import { tickInstruments } from '../src/sim/systems/combat.js';
import { Terrain } from '../src/sim/terrain.js';
import { tickHazards } from '../src/sim/systems/hazards.js';

const dt = T.sim.step;
function water({ key = 'bay', meta = {} } = {}) {
  const game = new Game({ level: key, seed: 73, meta }); game.start(key).begin(); game.transition('DEEP');
  setupWorld(game, { layer: 'deep', width: 2400, height: 1000, solids: [], spawns: [], pickups: [], exit: { x: 2300, y: 800, r: 30 } });
  Object.assign(game.player, { x: 300, y: 400, prevX: 300, prevY: 400 });
  return game;
}
function fish(game, kind, x = 700, y = 400) {
  const result = createFish(kind, x, y, game.nextId++, game.rng); game.fish.push(result); return result;
}
function encounter(key) {
  const game = water({ key }); game.addMem(T.tiers[2].mem, 0); game.evolutionTimer = 0; game.enterBoss();
  game.boss.state = 'idle'; game.boss.timer = T.boss.intro; game.boss.recovery = 0; game.player.invuln = 0;
  return game;
}

test('a consumed fish leaves three-second remains that lure only two or three same-kind fish', () => {
  const game = water(), eaten = fish(game, 'fry');
  const same = [1,2,3,4].map(i => fish(game, 'fry', 700 + i * 35)), other = fish(game, 'lantern', 730);
  eat(game, eaten); tickEmergence(game, 0);
  const event = game.ecologyEvents.find(e => e.type === 'corpse');
  assert.ok(event.targets.length >= 2 && event.targets.length <= 3);
  assert.ok(event.targets.every(id => same.some(f => f.id === id)));
  assert.ok(!event.targets.includes(other.id));
  const target = same.find(f => event.targets.includes(f.id)), previous = target.x;
  tickFish(game, dt); assert.ok(target.x < previous);
  tickEmergence(game, T.ecology.corpseDuration + dt);
  assert.equal(game.entities.remains.length, 0); assert.equal(game.ecologyEvents.length, 0);
});

test('all six kinds of ecological interaction share two slots, independent of enemy attack slots', () => {
  const game = water(), sources = ['scatter','suction','lantern','royal','steal','corpse'];
  for (let i = 0; i < sources.length; i++) emergence(game, sources[i], { id: 500 + i, x: 0, y: 0 }, 1);
  assert.equal(game.ecologyEvents.length, 2);
  assert.deepEqual(game.ecologyEvents.map(event => event.type), sources.slice(0, 2));
  tickEmergence(game, 1 + dt);
  assert.ok(emergence(game, 'corpse', { id: 999, x: 0, y: 0 }, 1));
  assert.equal(game.ecologyEvents.length, 1);
});

test('lantern attraction pulses once per 4.3 seconds rather than luring forever', () => {
  const game = water(), lantern = fish(game, 'lantern', 1200), times = [];
  game.bus.on('ecology.start', event => { if (event.type === 'lantern') times.push(game.time); });
  for (let frame = 0; frame < 9 / dt; frame++) { game.time += dt; tickEmergence(game, dt); tickFish(game, dt); }
  assert.equal(times.length, 3);
  for (let i = 1; i < times.length; i++) assert.ok(Math.abs(times[i] - times[i - 1] - 4.3) < .04);
  assert.ok(lantern.lureTimer > 0);
});

test('tapirs wake after twelve seconds and refreshing one sleep does not count another', () => {
  const game = water(), tapir = fish(game, 'tapir', 320);
  applySongRelease(game, 'Perfect'); applySongRelease(game, 'Perfect');
  assert.equal(game.stats.tapirsSlept, 1);
  for (let i = 0; i < 13 / dt; i++) tickFish(game, dt);
  assert.equal(tapir.sleep, 0); assert.notEqual(tapir.action, 'sleep');
});

test('the forty-second resource forecast changes supply weights and preserves the final shield', () => {
  const game = water(), full = supplyWeights(game);
  game.player.stability = 40; const starving = supplyWeights(game);
  assert.ok(starving.heal > full.heal);
  assert.ok(full.bait > full.haste && full.magnet > full.haste);
  game.entities.pickups = [{ id: 1, key: 'lamp', supply: true, x: 350, y: 400 }, { id: 2, key: 'heal', supply: true, bossSupply: true, x: 400, y: 400 }];
  forecastSupplies(game); const selected = game.entities.pickups.map(item => item.key);
  assert.equal(selected.at(-1), 'shield');
  game.player.stability = 100; forecastSupplies(game);
  assert.deepEqual(game.entities.pickups.map(item => item.key), selected, 'visible items must not flicker into another kind');
});

test('supply choice is deterministic for the same run seed and needs', () => {
  const select = () => { const game = water(); game.entities.pickups = Array.from({ length: 7 }, (_, i) => ({ id: i, key: 'lamp', supply: true, x: 350 + i * 50, y: 400 })); forecastSupplies(game); return [game.entities.pickups.map(item => item.key), game.rng.state]; };
  assert.deepEqual(select(), select());
});

test('optional two-failure assistance changes damage and drain while preserving every tell', () => {
  const meta = { settings: { assistance: false }, levels: { 5: { failures: 2 } } }, game = water({ key: 'sanctuary', meta });
  const pressure = structuredClone(game.pressureConfig); game.damagePlayer(20); assert.equal(game.player.hp, 80);
  game.player.hp = 100; game.player.invuln = 0; meta.settings.assistance = true;
  game.damagePlayer(20); assert.ok(Math.abs(game.player.hp - (100 - 20 * 1.12 / 1.25)) < 1e-8);
  assert.equal(game.stabilityPressure, 1.12); assert.deepEqual(game.pressureConfig, pressure);
  meta.levels[5].failures = 1; assert.equal(game.stabilityPressure, 1.25);
});

test('three story pieces grant the documented deep feeding memory bonus only', () => {
  const game = water(); game.storyFragments = new Set([0,1,2]);
  game.addMem(10, 0, 'fry'); assert.equal(game.player.mem, 11);
  game.addMem(8, 0, 'song'); assert.equal(game.player.mem, 19);
  game.state = 'BOSS'; game.addMem(10, 0, 'fry'); assert.equal(game.player.mem, 29);
});

test('retry collections survive without claiming them as fresh mission progress', () => {
  const game = new Game({ level: 'bay', meta: { levels: { 1: { fragments: [1,1,1], melodyIds: [0,1,2], melody: 3 } } } });
  game.start('bay', { retry: true });
  assert.equal(game.storyCount, 3); assert.equal(game.melodyCount, 3);
  assert.equal(game.stats.fragments, 0); assert.equal(game.stats.melodies, 0); assert.equal(game.stats.delivered, 0);
  assert.equal(game.collectMelody(0), false); assert.equal(game.stats.melodies, 0);
});

test('the fifth-night mission cannot be claimed by clearing the first dream', () => {
  const game = water(); game.missions = [{ id: 'win', stat: 'win', target: 1, level: 5, pearls: 80 }];
  const result = game.finish('CLEARED'); assert.deepEqual(result.missions, []);
});

test('final Perfect choir needs five complete melodies and happens once, including live fifth collection', () => {
  const game = encounter('sanctuary'), events = []; game.boss.phase = 3;
  game.bus.on('awakening', event => events.push(event));
  game.openBossGate(); game.resolveBossGate('Perfect'); assert.equal(events.length, 0);
  game.meta.levels = Object.fromEntries([1,2,3,4].map(id => [id, { melody: 3, melodyIds: [0,1,2] }]));
  game.melodies = new Set([0,1,2]);
  game.openBossGate(); game.resolveBossGate('Perfect');
  game.openBossGate(); game.resolveBossGate('Perfect');
  assert.equal(events.length, 1); assert.equal(events[0].duration, 14); assert.equal(events[0].boss, 'claude');
});

test('each boss supplies its authored defeat action rather than only a shared pose', () => {
  for (const level of LEVELS) {
    const game = encounter(level.key); let payload;
    game.bus.on('boss.down', event => payload = event); game.defeatBoss();
    assert.equal(payload.action, BOSSES[level.boss].defeat.action);
    assert.equal(payload.duration, 4); assert.equal(game.stats.downs[level.boss], 1);
  }
});

test('optional latches take two separate lunges, open collision, and leave authored data untouched', () => {
  const game = water(), block = { id: 'latch', key: 'fragile', x: 600, y: 400, rx: 24, ry: 30, hp: 2, maxHp: 2 };
  setupWorld(game, { ...game.scene, breakables: [block] });
  Object.assign(game.player, { x: 520, y: 400, angle: 0 });
  assert.equal(game.terrain.contains(600, 400, 0, 2), true);
  startBite(game); tickBreakables(game); tickBreakables(game);
  assert.equal(game.entities.breakables[0].hp, 1);
  game.player.biteTimer = 0; startBite(game); tickBreakables(game);
  assert.equal(game.entities.breakables[0].broken, true);
  assert.equal(game.terrain.contains(600, 400, 0, 2), false); assert.equal(block.hp, 2);
});

test('the kiln arena enforces its elliptical boundary for a whale-sized body', () => {
  const game = encounter('porcelain'), terrain = new Terrain(game.scene), radius = game.player.r;
  const p = { x: 0, y: 0, vx: 0, vy: 0 }; terrain.resolve(p, radius, 2);
  assert.ok(Math.hypot((p.x - game.scene.width / 2) / (game.scene.width / 2 - radius), (p.y - game.scene.height / 2) / (game.scene.height / 2 - radius)) <= 1 + 1e-9);
});

test('Qwen right-half rain deals fifteen damage per second, not one tiny frame per invulnerability', () => {
  const game = encounter('porcelain'), b = game.boss; b.phase = 2; game.player.x = game.scene.width * .8;
  const initial = game.player.hp; beginAttack(game, b.spec.skills.find(s => s.key === 'rule'));
  for (let i = 0; i < 6 / dt && b.attack; i++) { tickResources(game, dt); tickAttack(game, dt); }
  const damage = initial - game.player.hp;
  assert.ok(damage >= 45 && damage <= 60, `damage=${damage}`);
});

test('Gemini yarn actually bounces six times and leaves cuttable line segments', () => {
  const game = encounter('violet'), b = game.boss, bounces = []; b.phase = 2; game.player.invuln = 999;
  game.bus.on('boss.yarn.bounce', event => bounces.push(event));
  beginAttack(game, b.spec.skills.find(s => s.key === 'yarn'));
  for (let i = 0; i < 30 / dt && b.attack; i++) { tickProjectiles(game, dt); tickAttack(game, dt); }
  assert.equal(bounces.length, 6); assert.equal(b.bullets.some(shot => shot.kind === 'yarnBall'), false);
  assert.ok(b.areas.some(area => area.kind === 'yarn'));
});

test('cutting three yarn lines trips Gemini and stops the ball', () => {
  const game = encounter('violet'), b = game.boss, p = game.player;
  b.bullets = [{ id: 99, kind: 'yarnBall', x: 800, y: 200, vx: 0, vy: 0, r: 18, age: 0, ttl: 10 }];
  b.yarnCut = 0; b.areas = [1,2,3].map(id => ({ id, kind: 'yarn', x: p.x - 50, y: p.y, x2: p.x + 50, y2: p.y, tellT: 0, ttl: 10, age: 0, damage: 14 }));
  p.biteWindow = .18; tickProjectiles(game, dt);
  assert.equal(b.stun, 2.5); assert.equal(b.yarnCut, 3); assert.equal(b.bullets.length, 0);
});

test('Zhipu ko covers seventy percent per drop and retains a shared safe square', () => {
  const game = encounter('magma'), b = game.boss; b.phase = 2;
  beginAttack(game, b.spec.skills.find(s => s.key === 'ko'));
  while (!b.attack.fired) tickAttack(game, dt);
  assert.equal(b.areas.length, 4);
  const firstArea = b.areas.filter(area => area.delay === 0).reduce((sum, area) => sum + area.w * area.h, 0);
  assert.ok(Math.abs(firstArea / (game.scene.width * game.scene.height) - .7) < 1e-9);
  assert.ok(b.safeCell.w > game.player.r * 2 && b.safeCell.h > game.player.r * 2);
});

test('Claude stars have three, four and five real waves of five falling projectiles', () => {
  for (const phase of [1,2,3]) {
    const game = encounter('sanctuary'), b = game.boss; b.phase = phase;
    beginAttack(game, b.spec.skills.find(s => s.key === 'stars'));
    for (let i = 0; i < 5 / dt && b.attack; i++) tickAttack(game, dt);
    assert.equal(b.bullets.filter(shot => shot.kind === 'star').length, (phase + 2) * 5);
    for (const shot of b.bullets) assert.equal(shot.vy, 420);
  }
});

test('bronze bell preemption follows a real stone beat rather than a silent global song phase', () => {
  const game = encounter('magma'), b = game.boss, i = game.entities.instruments[0], p = game.player;
  Object.assign(p, { x: i.x, y: i.y, biteWindow: .18 }); game.song.phase = 0;
  tickInstruments(game, dt); assert.equal(b.stun, 1.5);
  i.cd = 0; p.hitIds.clear(); b.lastStoneAt = game.time;
  tickInstruments(game, dt); assert.equal(b.stun, 3); assert.equal(b.gateOpen, 0);
});

test('hidden ambush first waits, then visibly lunges from behind', () => {
  const game = encounter('bay'), b = game.boss; b.phase = 2;
  beginAttack(game, b.spec.skills.find(s => s.key === 'hide'));
  assert.equal(b.hidden, 1.6);
  for (let i = 0; i < 1 / dt; i++) tickAttack(game, dt);
  assert.equal(b.attack.fired, false);
  for (let i = 0; i < 1 / dt && !b.attack.fired; i++) tickAttack(game, dt);
  assert.equal(b.hidden, 0); assert.equal(b.attack.fired, true);
});

test('current entry sound fires once per entry and can fire after leaving and returning', () => {
  const game = water(); setupWorld(game, { ...game.scene, hazards: [{ kind: 'current', x: 300, y: 400, w: 200, h: 200, period: 0 }] });
  const events = []; game.bus.on('current.enter', event => events.push(event));
  tickHazards(game, dt); tickHazards(game, dt); assert.equal(events.length, 1);
  game.player.y = 700; tickHazards(game, dt); game.player.y = 400; tickHazards(game, dt);
  assert.equal(events.length, 2);
});
