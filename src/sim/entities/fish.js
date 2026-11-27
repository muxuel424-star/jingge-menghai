import { SPECIES } from '../../data/species.js';
export function createFish(kind, x, y, id, rng) {
  const spec = SPECIES[kind] ?? SPECIES.fry;
  return { id, kind: kind === 'dreamfish' ? kind : spec.key, tier: spec.tier, x, y, prevX: x, prevY: y, homeX: x, homeY: y,
    vx: 0, vy: 0, dir: rng.next() < .5 ? -1 : 1, r: spec.radius, size: 1, hp: spec.hp,
    action: spec.initial, stateT: 0, tellT: 0, cooldown: rng.range(0, 2), stun: 0, perfectStun: false,
    armored: kind === 'royal', armorHits: 0, eaten: false, phase: rng.range(0, Math.PI * 2),
    lastBite: -1, stolen: 0, sleep: 0, bounceCd: 0, respawn: 0 };
}
