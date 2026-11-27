import { defineBoss } from './shared.js';

export const ZHIPU = defineBoss({
  key: 'zhipu', level: 4, segmentHp: 400, targetSeconds: [130, 160],
  melody: { mode: 'C-yu', notes: ['C', 'G', 'C', 'G'], gateNotes: ['C', 'G', 'C', 'G'], releaseNote: 'G' },
  arena: { width: 1000, height: 700, shape: 'rect', theme: 'goBoard', grid: 19, instruments: [{ key: 'bronzeBell', x: 500, y: 350, r: 40 }], cover: [{ x: 230, y: 230, w: 65, h: 65 }, { x: 770, y: 470, w: 65, h: 65 }], safePoints: [{ x: 200, y: 520 }, { x: 800, y: 180 }] },
  instrument: { type: 'bronzeBell', count: 1, required: 1, cooldown: 8, stun: 1.5, vulnerable: 0, onSameBeat: { stopAttacks: 3, skipTurn: true } },
  skills: [
    { key: 'stones', nameKey: 'boss.zhipu.stones', phases: [1, 2, 3], pattern: 'falling', tell: 0.92, tellShape: 'fiveCircles', damage: 20, recovery: 1.8, waves: [2, 3, 4], count: [5, 5, 5], speed: 350, counter: 'landingGap' },
    { key: 'rings', nameKey: 'boss.zhipu.rings', phases: [1, 2, 3], pattern: 'rings', tell: 0.88, tellShape: 'cross', damage: 18, recovery: 1.75, count: [3, 4, 5], speed: 275, counter: 'ringGap' },
    { key: 'track', nameKey: 'boss.zhipu.track', phases: [1, 2, 3], pattern: 'tracking', tell: 0.72, tellShape: 'trackingCircles', damage: 17, recovery: 2, waves: [4, 5, 6], count: [3, 3, 3], speed: 395, counter: 'leadIntoWall' },
    { key: 'ko', nameKey: 'boss.zhipu.ko', phases: [2], pattern: 'doubleMarkers', tell: 1, tellShape: 'twoAreas', damage: 22, recovery: 1.9, interval: 0.5, coveredFraction: 0.7, counter: 'singleFreeCell' },
    { key: 'finale', nameKey: 'boss.zhipu.finale', phases: [3], pattern: 'rain', tell: 1.3, tellShape: 'safeCells', damage: 24, recovery: 2.2, duration: 3, safeCount: 2, counter: 'litSafeCell' },
  ],
  counterSkill: 'track', defeat: { pose: 'sit', action: 'collectStones', smile: true, dissolve: 'dreamfish' },
});
