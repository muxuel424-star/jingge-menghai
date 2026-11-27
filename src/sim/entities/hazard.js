import { TUNING as T } from '../../data/tuning.js';
const FLOW = new Set(['current', 'reverseCurrent', 'upcurrent', 'downcurrent', 'weightCurrent']);
const LAVA = new Set(['lava', 'porcelainLava']);

export function createHazard(spec, id, pressure) {
  const kind = spec.kind ?? 'current';
  const continuous = FLOW.has(kind) || LAVA.has(kind);
  return {
    ...spec, id, kind, age: 0, tellT: 0, active: continuous, cooldown: 0,
    continuous, period: spec.period > 0 ? spec.period : T.hazards.defaultPeriod,
    tell: spec.tell ?? pressure.hazardTell, activeAge: 0, cycle: -1,
    damage: spec.damage ?? (FLOW.has(kind) || kind === 'thermalVent' ? 0 : LAVA.has(kind) ? T.damage.lava : T.damage.hazardBase),
    shards: [], ringRadius: 0, logY: spec.y, angle: 0,
  };
}
