import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { LEVELS } from '../src/data/index.js';
import { TUNING } from '../src/data/tuning.js';
import { chooseMissions } from '../src/sim/systems/scoring.js';
import { canEat } from '../src/sim/systems/feeding.js';

const step = TUNING.sim.step;

// This fixture begins at the authored deep-layer destination. During the encounter
// the bot uses only the same movement / bite / four-beat song inputs as a player.
function bossEncounter(key) {
  const game = new Game({ level: key, seed: 42 });
  game.start(key).begin(); game.transition('DEEP');
  game.addMem(TUNING.tiers[2].mem, 100); game.evolutionTimer = 0;
  game.enterBoss(); game.step(step, {});
  return game;
}

function fightInput(game) {
  const player = game.player, boss = game.boss;
  let sing = false;
  if (boss.gate) {
    sing = game.song.active ? game.song.age + step < game.song.phraseSeconds
      : game.song.cooldown <= 0 && !game.song.blockedUntilUp;
  }
  const dx = boss.x - player.x, dy = boss.y - player.y, length = Math.max(1, Math.hypot(dx, dy));
  return { x: boss.gate ? 0 : dx / length, y: boss.gate ? 0 : dy / length, bite: !boss.gate, sing };
}

function clearLine(game, target) {
  const player = game.player, samples = Math.ceil(Math.hypot(target.x - player.x, target.y - player.y) / 25);
  for (let i = 1; i < samples; i++) {
    if (game.terrain.contains(player.x + (target.x - player.x) * i / samples, player.y + (target.y - player.y) * i / samples, player.r, player.tier)) return false;
  }
  return true;
}

function deepRouteInput(game, bot, frame) {
  const player = game.player, scene = game.scene, path = scene.mainPath;
  while (bot.pathIndex < path.length - 1 && Math.hypot(path[bot.pathIndex].x - player.x, path[bot.pathIndex].y - player.y) < 70) bot.pathIndex++;
  if (game.blockHeld || game.evolutionTimer > 0 || (scene.loop && !game.conditions.still3s && game.loopCount)) return {};
  if (frame % 15 === 0) {
    bot.target = null;
    if (player.tier < 2 || player.stability < 45) {
      const gate = scene.gates.find(candidate => candidate.tier > player.tier);
      const candidates = [
        ...game.fish.filter(fish => canEat(player, fish)),
        ...game.entities.pickups.filter(item => !item.collected && (['crystal', 'clam'].includes(item.key) || (item.key === 'chest' && player.tier >= 1))),
      ].filter(target => (!gate || target.x < gate.x - 70) && Math.hypot(target.x - player.x, target.y - player.y) < 650)
        .sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y));
      bot.target = candidates.find(target => clearLine(game, target));
    }
  }
  if (bot.target?.eaten || bot.target?.collected) bot.target = null;
  const target = bot.target ?? path[bot.pathIndex], dx = target.x - player.x, dy = target.y - player.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  return { x: dx / length, y: dy / length, bite: true };
}

for (const level of LEVELS) {
  test(`${level.key}: a retry can swim, feed and use size keys to collect all melody without stat changes`, () => {
    const game = new Game({ level: level.key, seed: 21 });
    game.start(level.key, { retry: true }); game.skipDescent();
    const bot = { pathIndex: 0, target: null }, maxFrames = 450 / step;
    for (let frame = 0; frame < maxFrames && !game.ended && game.state !== 'BOSS'; frame++) {
      game.step(step, game.state === 'DESCENT' ? {} : deepRouteInput(game, bot, frame));
    }
    assert.equal(game.state, 'BOSS', `outcome=${game.result?.outcome} x=${game.player.x} mem=${game.player.mem}`);
    assert.equal(game.player.tier, 2);
    assert.equal(game.melodyCount, 3);
    assert.ok(game.player.hp > 0);
    assert.ok(game.deepTime < TUNING.run.bossFallback, 'must reach the arena by swimming rather than the fallback teleport');
  });

  test(`${level.key}: normal input can complete all three boss song gates and reach dawn`, () => {
    const game = bossEncounter(level.key), maxFrames = 240 / step;
    for (let frame = 0; frame < maxFrames && !game.ended; frame++) game.step(step, fightInput(game));
    assert.equal(game.result?.outcome, 'CLEARED', `phase=${game.boss.phase} hp=${game.boss.hp} songCD=${game.song.cooldown}`);
    assert.equal(game.boss.phase, 3);
    assert.equal(game.boss.gateHits, 3);
    assert.ok(game.stats.perfects >= 3);
    assert.ok(game.player.hp > 0);
    assert.equal(game.player.stability, 100, 'the boss arena has no food and must not drain deep-layer stability');
  });
}

test('an existing partial mission selection is filled to three without duplicates', () => {
  const game = new Game({ level: 'bay', seed: 17, meta: { missions: { active: ['fry60'], done: [] } } });
  const missions = chooseMissions(game);
  assert.equal(missions.length, 3);
  assert.equal(new Set(missions.map(mission => mission.id)).size, 3);
  assert.ok(missions.some(mission => mission.id === 'fry60'));
});

test('a newly unlocked dream does not draw missions above the highest completed pressure', () => {
  const game = new Game({ level: 'porcelain', seed: 17, meta: { levels: { 1: { cleared: true }, 2: { unlocked: true, cleared: false } } } });
  const missions = chooseMissions(game);
  assert.equal(missions.length, 3);
  assert.ok(missions.every(mission => mission.level <= 1));
});
