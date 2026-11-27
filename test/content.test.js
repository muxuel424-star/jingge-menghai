import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, BOSSES, SPECIES, ITEMS, DIALOGUE } from '../src/data/index.js';
import { TUNING } from '../src/data/tuning.js';
import { Terrain } from '../src/sim/terrain.js';

const largestRadius = TUNING.player.radius * TUNING.tiers.at(-1).size;

function findMissingText(value, missing = new Set()) {
  if (!value || typeof value !== 'object') return missing;
  for (const [key, child] of Object.entries(value)) {
    if (key.endsWith('Key') && typeof child === 'string' && !DIALOGUE[child]) missing.add(child);
    if (child && typeof child === 'object') findMissingText(child, missing);
  }
  return missing;
}

test('five independent dreams have the required authored content and valid text keys', () => {
  assert.equal(LEVELS.length, 5);
  assert.equal(Object.keys(SPECIES).length, 9);
  assert.equal(Object.keys(ITEMS).length, 8);
  assert.equal(Object.keys(BOSSES).length, 5);
  assert.equal(SPECIES.royal.tier, 2);
  assert.equal(SPECIES.abyss.tier, -1);
  assert.equal(SPECIES.jelly.tier, 1);
  assert.deepEqual([...findMissingText({ LEVELS, BOSSES, SPECIES, ITEMS })], []);
  assert.ok(Object.values(DIALOGUE).join('').match(/[\u3400-\u9fff]/g).length <= 2500);
  for (const [index, level] of LEVELS.entries()) {
    assert.equal(level.level, index + 1);
    assert.equal(level.pressure, index + 1);
    assert.equal(level.surface.beats.length, 6);
    assert.equal(level.deep.beats.length, 3);
    assert.equal(level.surface.fragments.length, 3);
    assert.equal(level.deep.melodies.length, 3);
    assert.equal(level.surface.shortcuts.length, 2);
    assert.ok(level.surface.souvenir);
    const supplyCount = level.surface.pickups.length + level.deep.pickups.length;
    assert.ok(supplyCount >= 12 && supplyCount <= 16);
    assert.equal(level.deep.pickups.at(-1).key, 'shield');
    const boss = BOSSES[level.boss];
    assert.equal(boss.phases.length, 3);
    assert.equal(boss.maxHp, boss.segmentHp * 3);
    for (const phase of boss.phases) {
      assert.ok(phase.gate.required);
      assert.ok(phase.attacks.length >= 3);
      assert.ok(phase.attacks.every(attack => attack.phases.includes(phase.phase)));
    }
  }
});

for (const level of LEVELS) {
  for (const layer of ['surface', 'deep']) {
    const scene = level[layer];
    test(`${level.key}/${layer}: the largest body can follow every authored route segment`, () => {
      const terrain = new Terrain(scene);
      for (let i = 1; i < scene.mainPath.length; i++) {
        const a = scene.mainPath[i - 1], b = scene.mainPath[i];
        const samples = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 20);
        for (let j = 0; j <= samples; j++) {
          const x = a.x + (b.x - a.x) * j / samples;
          const y = a.y + (b.y - a.y) * j / samples;
          assert.equal(terrain.contains(x, y, largestRadius, 2), false, `segment ${i} at ${x},${y}`);
        }
      }
    });

    test(`${level.key}/${layer}: all supplies and collectibles are reachable from the entrance`, () => {
      const terrain = new Terrain(scene), step = 40;
      const cols = Math.ceil(scene.width / step), rows = Math.ceil(scene.height / step);
      const open = new Uint8Array(cols * rows), visited = new Uint8Array(cols * rows);
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          open[row * cols + col] = !terrain.contains(col * step, row * step, largestRadius, 2);
        }
      }
      const nearestOpen = position => {
        let best = -1, bestDistance = Infinity;
        const col = Math.round(position.x / step), row = Math.round(position.y / step);
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const x = col + dx, y = row + dy, index = y * cols + x;
            if (x < 0 || x >= cols || y < 0 || y >= rows || !open[index]) continue;
            const distance = Math.hypot(x * step - position.x, y * step - position.y);
            if (distance < bestDistance) { best = index; bestDistance = distance; }
          }
        }
        return best;
      };
      const start = nearestOpen(scene.spawn);
      assert.ok(start >= 0);
      const queue = [start]; visited[start] = 1;
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const current = queue[cursor], col = current % cols, row = Math.floor(current / cols);
        for (const [x, y] of [[col - 1, row], [col + 1, row], [col, row - 1], [col, row + 1]]) {
          if (x < 0 || x >= cols || y < 0 || y >= rows) continue;
          const next = y * cols + x;
          if (open[next] && !visited[next]) { visited[next] = 1; queue.push(next); }
        }
      }
      const shortcutPoints = scene.shortcuts.flatMap(shortcut => [
        { ...shortcut.from, id: `shortcut-${shortcut.id}-from` },
        { ...shortcut.to, id: `shortcut-${shortcut.id}-to` },
      ]);
      const points = [...scene.pickups, ...(scene.fragments ?? []), ...(scene.melodies ?? []), ...shortcutPoints, scene.souvenir, scene.exit, scene.well].filter(Boolean);
      for (const position of points) {
        assert.equal(terrain.contains(position.x, position.y, largestRadius, 2), false, `inside terrain: ${position.id ?? position.key}`);
        const index = nearestOpen(position);
        assert.ok(index >= 0 && visited[index], `unreachable: ${position.id ?? position.key} at ${position.x},${position.y}`);
      }
    });
  }

  test(`${level.key}: enough edible memory exists before every size gate`, () => {
    for (const gate of level.deep.gates) {
      const reachable = level.deep.spawns.filter(spawn => spawn.x < gate.x);
      const mem = reachable.reduce((sum, spawn) => {
        const species = SPECIES[spawn.kind];
        const canEat = !species || (species.tier >= 0 && species.tier < gate.tier);
        return sum + (canEat ? spawn.count * (TUNING.mem[spawn.kind] ?? 0) : 0);
      }, 0);
      assert.ok(mem >= TUNING.tiers[gate.tier].mem, `${gate.key}: ${mem} memory before gate`);
    }
  });
}

test('the five dreams retain their unique narrative interactions', () => {
  const cat = LEVELS[2], nightShift = LEVELS[3], palace = LEVELS[4];
  assert.equal(cat.surface.beats[1].camera, 'vertical');
  assert.equal(cat.deep.beats[1].camera, 'vertical');
  assert.equal(cat.deep.gates[0].tier, 2);
  assert.equal(cat.surface.fragments[2].condition, 'perfectSong');
  assert.equal(nightShift.deep.loop.maxLoops, 2);
  assert.equal(nightShift.deep.loop.breakWhenStill, 3);
  assert.equal(palace.deep.beats[1].camera, 'vertical');
  assert.equal(palace.surface.fragments[2].condition, 'still3s');
  assert.equal(BOSSES.claude.instrument.onSameBeatSong.vulnerable, 3);
  assert.equal(BOSSES.zhipu.instrument.vulnerable, 0);
});
