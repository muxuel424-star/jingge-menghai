import { defineBoss } from './shared.js';

export const CLAUDE = defineBoss({
  key: 'claude', level: 5, segmentHp: 500, targetSeconds: [150, 200],
  melody: { mode: 'G-gong', notes: ['G', 'A', 'B', 'D', 'E'], gateNotes: ['G', 'A', 'B', 'D'], releaseNote: 'D', perfectChoir: ['grok', 'qwen', 'gemini', 'zhipu'] },
  arena: { width: 1100, height: 680, shape: 'rect', theme: 'whaleCathedral', instruments: [{ key: 'whaleString', x: 550, y: 145, w: 800, h: 22, r: 30 }, { key: 'whaleString', x: 550, y: 340, w: 800, h: 22, r: 30 }, { key: 'whaleString', x: 550, y: 535, w: 800, h: 22, r: 30 }], safePoints: [{ x: 160, y: 160 }, { x: 550, y: 500 }, { x: 940, y: 160 }], cover: [] },
  instrument: { type: 'whaleString', count: 3, required: 1, cooldown: 8, stun: 0.5, vulnerable: 0, onSameBeatSong: { vulnerable: 3, clearProjectiles: true, gold: true } },
  skills: [
    { key: 'rings', nameKey: 'boss.claude.rings', phases: [1, 2, 3], pattern: 'rings', tell: 0.82, tellShape: 'rings', damage: 20, recovery: 1.7, count: [3, 4, 5], speed: 290, counter: 'ringGapOrString' },
    { key: 'weave', nameKey: 'boss.claude.weave', phases: [1, 2, 3], pattern: 'grid', tell: 0.8, tellShape: 'grid', damage: 18, recovery: 1.75, waves: [4, 5, 6], count: [5, 5, 5], speed: 315, counter: 'diagonalGap' },
    { key: 'rush', nameKey: 'boss.claude.rush', phases: [1, 2, 3], pattern: 'dash', tell: 0.77, tellShape: 'lowerHead', damage: 24, recovery: 1.8, count: [3, 4, 5], speed: 740, interval: 0.62, counter: 'sideDash' },
    { key: 'stars', nameKey: 'boss.claude.stars', phases: [1, 2, 3], pattern: 'rain', tell: 0.9, tellShape: 'darkSky', damage: 22, recovery: 1.9, waves: [3, 4, 5], count: [5, 5, 5], speed: 420, safeCount: 3, counter: 'litSafePoint' },
    { key: 'dark', nameKey: 'boss.claude.dark', phases: [3], pattern: 'darkness', tell: 1.4, tellShape: 'raiseLamp', damage: 26, recovery: 2, duration: 6, audioOnlyTells: true, counter: 'followLampCone' },
  ],
  counterSkill: 'rush', defeat: { pose: 'standing', action: 'handoverLamp', handoverDuration: 3, corridorLights: true, dissolve: false },
});
export default CLAUDE;
