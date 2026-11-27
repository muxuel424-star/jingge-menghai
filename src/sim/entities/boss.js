import { TUNING as T } from '../../data/tuning.js';
export function createBoss(spec, center) {
  const hp = spec.maxHp ?? spec.segmentHp * 3;
  return { key: spec.key, level: spec.level, spec, x: center.x, y: center.y, prevX: center.x, prevY: center.y,
    home: { ...center }, vx: 0, vy: 0, dir: -1, r: 70, hp, maxHp: hp, segmentHp: spec.segmentHp,
    phase: 1, engaged: true, timer: 0, recovery: T.boss.intro, invuln: 0, resist: 0, stun: 0,
    attack: null, sequence: 0, gate: null, gateOpen: 0, gateHits: 0, gateRequired: 1, gateTimer: 0,
    phaseGate: false, attacksDone: 0, instrument: null, instrumentHits: [], instrumentMul: 1,
    hidden: 0, down: false, defeatTimer: 0, state: 'intro', tell: 0, bullets: [], areas: [] };
}
