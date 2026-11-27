import { TUNING as T } from '../../data/tuning.js';
import { SPECIES } from '../../data/species.js';
import { Terrain } from '../terrain.js';
import { createFish } from '../entities/fish.js';
import { createNightmare } from '../entities/nightmare.js';
import { createHazard } from '../entities/hazard.js';
import { distance } from '../math.js';
export function setupWorld(game, scene) {
  game.scene = scene;
  game.entities = { fish: [], nightmares: [], hazards: [], pickups: [], fragments: [], melodies: [], dreamChain: [], instruments: [], remains: [], breakables: (scene.breakables ?? []).map(s => ({ ...s, broken: false })) };
  game.terrain = new Terrain({ ...scene, breakables: game.entities.breakables });
  game.ecologyEvents = []; game.lastSupplyKey = null;
  for (const group of scene.spawns ?? []) {
    if (group.kind === 'nightmare') continue;
    for (let n = 0; n < group.count; n++) {
      const angle = game.rng.range(0, Math.PI * 2), radius = Math.sqrt(game.rng.next()) * (group.radius ?? 60);
      const x = group.x + Math.cos(angle) * radius, y = group.y + Math.sin(angle) * radius;
      if (['crystal','chest','clam'].includes(group.kind)) {
        const point = game.terrain.resolve({ x, y }, T.world.pickupRadius / 2, 2);
        game.entities.pickups.push({ id: game.nextId++, key: group.kind, ...point, collected: false });
      } else {
        const fish = createFish(group.kind, x, y, game.nextId++, game.rng);
        fish.school = `${group.kind}:${group.x}:${group.y}`;
        game.terrain.resolve(fish, fish.r, 2); fish.homeX = fish.x; fish.homeY = fish.y;
        game.entities.fish.push(fish);
      }
    }
  }
  if (scene.layer === 'surface') {
    const points = (scene.spawns ?? []).filter(g => g.kind === 'nightmare');
    for (let n = 0; n < game.pressureConfig.nightmares; n++) {
      const group = points[Math.min(points.length - 1, Math.floor(n * points.length / game.pressureConfig.nightmares))] ?? { x: scene.width / 2, y: scene.height / 2 };
      const nightmare = createNightmare(group.x, group.y, game.nextId++, game.rng);
      game.terrain.resolve(nightmare, nightmare.r, 2); game.entities.nightmares.push(nightmare);
    }
  }
  game.entities.hazards = (scene.hazards ?? []).map(h => createHazard(h, game.nextId++, game.pressureConfig));
  game.entities.pickups.push(...(scene.pickups ?? []).map(i => ({ ...i, id: i.id ?? game.nextId++, collected: false })));
  if (scene.souvenir) game.entities.pickups.push({ ...scene.souvenir, key: 'souvenir', souvenirKey: scene.souvenir.key, collected: false });
  game.entities.fragments = (scene.fragments ?? []).map(f => ({ ...f, collected: game.storyFragments.has(f.id) }));
  game.entities.melodies = (scene.melodies ?? []).map(f => ({ ...f, collected: game.melodies.has(f.id) }));
  game.entities.instruments = (scene.instruments ?? []).map(i => ({ ...i, id: game.nextId++, cd: 0 }));
  return game.entities;
}
export function tickBreakables(game) {
  const p = game.player;
  if (p.biteWindow <= 0) return;
  for (const block of game.entities.breakables) {
    if (block.broken || p.hitIds.has(block.id) || distance(p, block) > p.r + Math.max(block.rx, block.ry) + T.tiers[p.tier].reach + T.bite.reachBonus) continue;
    p.hitIds.add(block.id); block.hp = Math.max(0, block.hp - 1); block.broken = !block.hp;
    game.emit(block.broken ? 'terrain.break' : 'terrain.crack', { id: block.id, hp: block.hp, maxHp: block.maxHp, x: block.x, y: block.y });
  }
}
export function respawnFish(game, dt) {
  for (const f of game.fish) {
    if (!f.eaten || !Number.isFinite(f.respawn)) continue;
    f.respawn -= dt;
    if (f.respawn > 0 || distance({ x: f.homeX, y: f.homeY }, game.player) > T.fish.refillRadius) continue;
    if (f.kind === 'royal' || f.kind === 'abyss') continue;
    f.eaten = false; f.x = f.homeX; f.y = f.homeY; f.action = (SPECIES[f.kind] ?? SPECIES.fry).initial;
    f.stun = 0; f.stateT = 0; f.cooldown = game.pressureConfig.fishCd;
  }
}
export function enforceTierGates(game) {
  if (game.state !== 'DEEP') return;
  const p = game.player;
  for (const gate of game.scene.gates ?? []) {
    if (p.tier >= gate.tier || p.x <= gate.x - p.r) continue;
    p.x = gate.x - p.r - T.world.safeMargin; p.vx = Math.min(0, p.vx);
    if (game.time - (game.lastGateHint ?? -10) > 3) {
      game.lastGateHint = game.time; game.emit('notify', { text: `吃忆质，长到${T.tiers[gate.tier].name}级推开这里`, ttl: 3 });
    }
  }
}
