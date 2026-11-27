import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { TUNING as T } from '../src/data/tuning.js';
import { LEVELS, BOSSES } from '../src/data/index.js';
import { Game, STATES } from '../src/sim/game.js';
import { Terrain } from '../src/sim/terrain.js';
import { RNG } from '../src/sim/rng.js';
import { canEat, biteDamage, tickFeeding } from '../src/sim/systems/feeding.js';
import { hitBoss, tickInstruments } from '../src/sim/systems/combat.js';
import { createFish } from '../src/sim/entities/fish.js';
import { applySongRelease } from '../src/sim/systems/dreams.js';

function advance(g, seconds, input = {}) { for (let i = 0; i < Math.ceil(seconds / T.sim.step); i++) g.step(T.sim.step, input); }
function deep(key = 'bay') { const g = new Game({ level: key, seed: 123 }); g.start(key, { retry: true }); g.transition(STATES.DEEP); return g; }
function boss(key = 'bay') { const g = deep(key); g.addMem(760, 100); g.evolutionTimer = 0; g.enterBoss(); g.boss.timer = T.boss.intro; g.boss.recovery = 0; g.boss.state = 'idle'; return g; }

test('xorshift128 replay state and seed are deterministic', () => {
  const a = new RNG('鲸歌-42'), b = new RNG('鲸歌-42'), c = new RNG('different');
  const aa = Array.from({ length: 1000 }, () => a.next());
  assert.deepEqual(aa, Array.from({ length: 1000 }, () => b.next()));
  assert.notDeepEqual(aa.slice(0, 5), Array.from({ length: 5 }, () => c.next()));
  assert.deepEqual(a.clone().state, a.state);
});

test('terrain projects 10,000 random whale-palace positions without sticking', () => {
  const rng = new RNG(42);
  for (const level of LEVELS) for (const scene of [level.surface, level.deep]) {
    const terrain = new Terrain(scene);
    for (let i = 0; i < 1000; i++) {
      const p = { x: rng.range(0, scene.width), y: rng.range(0, scene.height), vx: 220, vy: 80, tier: 2 };
      terrain.resolve(p, 51);
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
      assert.equal(terrain.contains(p.x, p.y, 51, 2), false, `${level.key}/${scene.layer}: ${JSON.stringify(p)}`);
    }
  }
});

test('eating respects size, rear armor, frenzy, and angler exception', () => {
  const p = { x: 0, y: 0, tier: 0, frenzy: 0 }, prey = { kind: 'lantern', x: 20, y: 0, tier: 1, dir: 1 };
  assert.equal(canEat(p, prey), false);
  p.frenzy = 7; assert.equal(canEat(p, prey), false);
  p.tier = 1; assert.equal(canEat(p, prey), true);
  const royal = { ...prey, kind: 'royal', tier: 2, armored: true };
  p.tier = 2; p.x = 40; assert.equal(canEat(p, royal), false);
  p.x = 0; assert.equal(canEat(p, royal), true);
  assert.equal(canEat(p, { ...royal, kind: 'abyss', tier: -1, armored: false }), false);
  const normal = biteDamage({ ...p, frenzy: 0 }, { ...prey, action: 'school' });
  assert.equal(biteDamage(p, { ...prey, action: 'school' }), normal * T.combo.frenzyDamage);
});

test('two distinct front lunges break royal armor; no double hit in one lunge', () => {
  const g = deep(), p = g.player;
  p.tier = 2; p.x = 800; p.y = 800;
  const f = createFish('royal', 780, 800, 999, g.rng); f.dir = 1; g.entities.fish = [f];
  p.biteWindow = .18; p.biteId = 1;
  tickFeeding(g); tickFeeding(g); assert.equal(f.armorHits, 1); assert.equal(f.armored, true);
  p.hitIds.clear(); p.biteId++; tickFeeding(g); assert.equal(f.armored, false); assert.equal(f.eaten, false);
  p.hitIds.clear(); tickFeeding(g); assert.equal(f.eaten, true);
});

test('Perfect song plus lunge locks 2s angler reversal; ordinary bite cannot eat it', () => {
  const g = deep('violet'), p = g.player;
  p.x = 800; p.y = 800; p.tier = 2;
  const f = createFish('abyss', 825, 800, 999, g.rng); g.entities.fish = [f]; p.biteWindow = .18;
  tickFeeding(g); assert.equal(f.eaten, false); assert.equal(g.counterkill, null);
  applySongRelease(g, 'Perfect'); assert.ok(f.stun >= 2);
  tickFeeding(g); assert.equal(g.counterkill.remaining, 2); assert.equal(f.eaten, false);
  advance(g, 1); assert.equal(f.eaten, false);
  advance(g, 1.1); assert.equal(f.eaten, true); assert.equal(g.stats.abyss, 1); assert.equal(g.pearls, 10);
});

test('campaign state contract, collection, delivery, rift and deep bonuses', () => {
  const g = new Game({ seed: 77 });
  assert.equal(g.state, STATES.TITLE);
  g.start('bay'); assert.equal(g.state, STATES.BRIEF);
  advance(g, 1, { x: 1 }); assert.equal(g.time, 0);
  g.begin(); assert.equal(g.state, STATES.SURFACE);
  const fish = g.fish.find(f => f.kind === 'dreamfish');
  g.player.x = fish.x; g.player.y = fish.y; advance(g, T.sim.step);
  assert.ok(g.chain.length >= 1);
  g.player.x = g.scene.well.x; g.player.y = g.scene.well.y; advance(g, T.sim.step);
  assert.ok(g.delivered >= 1); assert.equal(g.chain.length, 0);
  g.conditions.reverseCurrent = true;
  for (const fragment of g.entities.fragments) { g.player.x = fragment.x; g.player.y = fragment.y; advance(g, T.sim.step); }
  assert.equal(g.storyCount, 3); assert.equal(g.riftOpen, true);
  g.delivered = 40; g.player.x = g.scene.exit.x; g.player.y = g.scene.exit.y; advance(g, T.sim.step);
  assert.equal(g.state, STATES.DESCENT); const oldTime = g.time;
  const position = { x: g.player.x, y: g.player.y }; advance(g, 1, { x: 1, sing: true });
  assert.equal(g.player.x, position.x); assert.equal(g.time, oldTime);
  g.skipDescent(); advance(g, 3.1);
  assert.equal(g.state, STATES.DEEP); assert.equal(g.player.maxBreath, 132);
});

test('fallbacks open rift and start boss without imposing a minimum duration', () => {
  const g = new Game(); g.start('bay').begin(); g.surfaceTime = 360;
  advance(g, T.sim.step); assert.equal(g.riftOpen, true);
  const h = deep(); h.deepTime = 420; advance(h, T.sim.step);
  assert.equal(h.state, STATES.BOSS); assert.equal(h.boss.key, 'grok');
});

test('a low-tier timeout provides finite ordinary memory food and grows through real movement', () => {
  const g = deep(); g.deepTime = T.run.bossFallback; advance(g, T.sim.step);
  assert.equal(g.player.tier, 0); assert.equal(g.player.mem, 0);
  const food = g.entities.pickups.filter(i => i.key === 'crystal');
  assert.ok(food.length * T.mem.crystal >= T.tiers[1].mem);
  assert.ok(food.length * T.mem.crystal < T.tiers[1].mem + T.mem.crystal);
  advance(g, T.boss.intro + .1); advance(g, 2, { x: 1 });
  assert.equal(g.player.tier, 1); assert.ok(g.player.mem >= 260);
  const normal = boss(); assert.equal(normal.entities.pickups.length, 0);
});

test('tier spatial gates cannot be bypassed above or below', () => {
  const g = deep('violet'), gate = g.scene.gates[0];
  g.player.x = gate.x + 100; g.player.y = 100; advance(g, T.sim.step);
  assert.ok(g.player.x < gate.x);
  g.addMem(760, 100); g.evolutionTimer = 0; g.player.x = gate.x + 100; advance(g, T.sim.step);
  assert.ok(g.player.x > gate.x); assert.equal(g.player.tier, 2);
});

test('dash resource is independent from breath and deep dash breaks held song', () => {
  const g = deep(); advance(g, T.sim.step); g.player.breath = 100;
  advance(g, .5, { x: 1, dash: true });
  assert.equal(g.player.breath, 100); assert.ok(g.player.dash < 100); assert.ok(g.stats.dashSeconds > 0);
  advance(g, .1, {}); advance(g, .1, { sing: true }); assert.equal(g.player.singing, true);
  advance(g, T.sim.step, { sing: true, x: 1, dash: true }); assert.equal(g.player.singing, false);
  const s = new Game(); s.start('bay').begin(); advance(s, T.sim.step);
  advance(s, .1, { sing: true }); advance(s, .1, { sing: true, dash: true, x: 1 });
  assert.equal(s.player.dashing, false); assert.equal(s.player.singing, true);
});

test('all three song gate results work, response melody widens reward, misses counter', () => {
  for (const quality of ['Perfect', 'Good', 'Miss']) {
    const g = boss(); g.openBossGate(); assert.ok(g.boss.gate); assert.equal(g.boss.attack, null);
    g.resolveBossGate(quality);
    if (quality === 'Miss') { assert.equal(g.boss.resist, 8); assert.ok(g.boss.attack); assert.equal(g.boss.phaseGate, false); }
    else { assert.equal(g.boss.gateOpen, quality === 'Perfect' ? 2.4 : 1.2); assert.equal(g.boss.phaseGate, true); }
  }
  const g = boss(); [0,1,2].forEach(id => g.collectMelody(id)); g.openBossGate(); g.resolveBossGate('Perfect'); assert.equal(g.boss.gateOpen, 3.2);
});

test('all five bosses require a song gate in every phase and end once at DAWN', () => {
  for (const level of LEVELS) {
    const g = boss(level.key);
    for (let phase = 1; phase <= 3; phase++) {
      const b = g.boss; assert.equal(b.phase, phase);
      b.hp = b.segmentHp * (3 - phase) + 1; b.invuln = 0;
      g.player.x = b.x; g.player.y = b.y; g.player.biteWindow = .18; g.player.hitIds.clear();
      hitBoss(g); assert.ok(b.gate, `${level.key}/${phase} gate`); assert.equal(b.phase, phase);
      g.resolveBossGate('Perfect'); b.invuln = 0; g.player.hitIds.clear(); hitBoss(g);
      if (phase < 3) { assert.equal(b.phase, phase + 1); assert.equal(b.bullets.length, 0); assert.ok(b.recovery >= 1.2); }
    }
    assert.equal(g.boss.down, true); assert.equal(g.stats.maxGatePerfects, 3);
    advance(g, 4.1); assert.equal(g.state, STATES.DAWN); assert.equal(g.result.outcome, 'CLEARED');
    const result = g.result; assert.equal(g.finish('CLEARED'), false); assert.equal(g.result, result);
  }
});

test('instruments have distinct counters: Qwen two bells and Claude same-beat duet', () => {
  const q = boss('porcelain'); q.player.biteWindow = .18;
  for (const bell of q.entities.instruments.slice(0, 2)) { q.player.x = bell.x; q.player.y = bell.y; tickInstruments(q, 0); }
  assert.equal(q.boss.gateOpen, 1.8); assert.equal(q.boss.bullets.length, 0);
  const c = boss('sanctuary'), string = c.entities.instruments[0];
  c.player.x = string.x; c.player.y = string.y; c.player.biteWindow = .18; c.player.singing = true; c.song.phase = 0;
  tickInstruments(c, 0); assert.equal(c.boss.gateOpen, 3);
  const far = boss('sanctuary'), edge = far.entities.instruments[0];
  far.player.x = edge.x - edge.w / 2 + 20; far.player.y = edge.y; far.player.biteWindow = .18; far.player.singing = true; far.song.phase = 0;
  tickInstruments(far, 0); assert.equal(far.boss.gateOpen, 3, 'the whole visible string is playable');
});

test('boss answers reset prior song cooldown and Miss resistance cannot be bypassed by biting', () => {
  const g = boss(); g.song.cooldown = 6; g.openBossGate(); assert.equal(g.song.cooldown, 0);
  g.resolveBossGate('Miss'); g.boss.hp = g.boss.segmentHp * 2 + 1; g.boss.invuln = 0;
  g.player.x = g.boss.x; g.player.y = g.boss.y; g.player.biteWindow = .18;
  hitBoss(g); assert.equal(g.boss.gate, null); assert.equal(g.boss.resist, 8);
});

test('evolution scales physical collision and only the deep exploration drains stability', () => {
  const g = deep(); g.addMem(760, 100); assert.equal(g.player.r, T.player.radius * T.tiers[2].size);
  g.evolutionTimer = 0; const before = g.player.stability; advance(g, .1); assert.ok(g.player.stability < before);
  g.enterBoss(); const bossStability = g.player.stability; advance(g, 5); assert.equal(g.player.stability, bossStability);
});

test('three failure types, idempotent finish and deep retry preserving boss melodies', () => {
  const surface = new Game(); surface.start('bay').begin(); surface.damagePlayer(999, 'test'); assert.equal(surface.result.outcome, 'RESCUED');
  const faded = deep(); faded.player.stability = 0; advance(faded, T.sim.step); assert.equal(faded.result.outcome, 'FADED');
  const g = boss(); g.collectMelody(0); g.collectMelody(2); g.damagePlayer(999, 'test');
  assert.equal(g.result.outcome, 'DEVOURED'); assert.equal(g.result.species.includes('test'), false);
  g.retry(); assert.equal(g.state, STATES.DESCENT); assert.equal(g.melodyCount, 2);
  g.skipDescent(); advance(g, 3.1); assert.equal(g.state, STATES.DEEP); assert.equal(g.melodyCount, 2);
  assert.equal(g.entities.melodies.filter(m => m.collected).length, 2);
});

test('item buffs refresh, cap at two, shield absorbs two hits, heal clamps', () => {
  const g = deep(); assert.equal(g.applyItem('lamp'), true); assert.equal(g.applyItem('magnet'), true);
  assert.equal(g.applyItem('haste'), false); assert.equal(g.applyItem('lamp'), true); assert.equal(g.buffs.length, 2);
  g.player.buffs = []; g.applyItem('shield');
  for (let i = 0; i < 2; i++) { g.player.invuln = 0; assert.equal(g.damagePlayer(30, 'fry'), false); }
  assert.equal(g.player.hp, 100); g.player.invuln = 0; g.damagePlayer(30, 'fry'); assert.equal(g.player.hp, 70);
  g.applyItem('heal'); assert.equal(g.player.hp, 100);
});

test('30-second replay has identical state hashes at 30/60/144 render FPS', () => {
  function replay(fps) {
    const g = new Game({ seed: 'replay' }); g.start('bay').begin();
    for (let frame = 0; frame < 30 * fps; frame++) {
      const time = frame / fps;
      g.step(1 / fps, { x: time < 12 ? 1 : time < 22 ? -1 : 0, y: time >= 22 ? 1 : 0 });
    }
    return createHash('sha256').update(JSON.stringify(g.snapshot())).digest('hex');
  }
  assert.equal(replay(30), replay(60)); assert.equal(replay(60), replay(144));
});
