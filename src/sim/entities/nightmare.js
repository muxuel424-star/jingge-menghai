import { SPECIES } from '../../data/species.js';
export function createNightmare(x, y, id, rng) {
  return { id, kind: 'nightmare', x, y, prevX: x, prevY: y, vx: 0, vy: 0, dir: 1, size: 1, r: SPECIES.nightmare.radius, calm: 0, action: 'wander', stateT: 0, cooldown: 0, phase: rng.range(0, Math.PI * 2), eaten: false };
}
