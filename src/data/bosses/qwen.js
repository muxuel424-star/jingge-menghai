import { defineBoss } from './shared.js';

export const QWEN = defineBoss({
  key: 'qwen', level: 2, segmentHp: 240, targetSeconds: [110, 140],
  melody: { mode: 'A-yu', notes: ['A', 'G', 'E', 'D', 'C'], gateNotes: ['A', 'G', 'E', 'C'], releaseNote: 'C' },
  arena: { width: 900, height: 620, shape: 'ellipse', theme: 'kiln', safePoints: [{ x: 140, y: 150 }, { x: 450, y: 480 }, { x: 760, y: 150 }], instruments: [{ key: 'porcelainBell', x: 100, y: 310, r: 33 }, { key: 'porcelainBell', x: 450, y: 85, r: 33 }, { key: 'porcelainBell', x: 800, y: 310, r: 33 }, { key: 'porcelainBell', x: 450, y: 535, r: 33 }], cover: [{ x: 140, y: 200, r: 58 }, { x: 450, y: 450, r: 58 }, { x: 760, y: 200, r: 58 }] },
  instrument: { type: 'porcelainBell', count: 4, required: 2, window: 8, cooldown: 8, stun: 0.4, vulnerable: 1.8, clearProjectiles: true },
  skills: [
    { key: 'fan', nameKey: 'boss.qwen.fan', phases: [1, 2, 3], pattern: 'fan', tell: 0.78, tellShape: 'fan', damage: 17, recovery: 1.9, waves: [3, 4, 5], count: [5, 5, 5], speed: 260, counter: 'fixedGap' },
    { key: 'return', nameKey: 'boss.qwen.return', phases: [1, 2, 3], pattern: 'boomerang', tell: 0.95, tellShape: 'ring', damage: 19, recovery: 2, waves: [2, 2, 2], speed: 275, returnAt: 1.06, counter: 'nearBoss' },
    { key: 'rings', nameKey: 'boss.qwen.rings', phases: [1, 2, 3], pattern: 'rings', tell: 0.82, tellShape: 'cracks', damage: 18, recovery: 1.85, count: [3, 4, 5], speed: 250, counter: 'ringGapOrBell' },
    { key: 'rule', nameKey: 'boss.qwen.rule', phases: [2], pattern: 'halfRain', tell: 1.1, tellShape: 'verticalLine', damage: 15, damagePerSecond: true, recovery: 1.6, duration: 4, safeSide: 'left', counter: 'leftHalf' },
    { key: 'finale', nameKey: 'boss.qwen.finale', phases: [3], pattern: 'coverRain', tell: 0.9, tellShape: 'cover', damage: 22, recovery: 2, safeCount: 3, counter: 'intactPlate' },
  ],
  counterSkill: 'fan', defeat: { pose: 'bow', action: 'placeLastPlate', dissolve: 'porcelainDustToDreamfish' },
});
