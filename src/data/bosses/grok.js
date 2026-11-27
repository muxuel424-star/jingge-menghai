import { defineBoss } from './shared.js';

export const GROK = defineBoss({
  key: 'grok', level: 1, segmentHp: 160, targetSeconds: [90, 110],
  melody: { mode: 'D-gong', notes: ['D', 'E', 'F#', 'A'], gateNotes: ['D', 'E', 'F#', 'A'], releaseNote: 'A' },
  arena: { width: 900, height: 500, shape: 'rect', theme: 'schoolyard', safePoints: [{ x: 120, y: 110 }, { x: 780, y: 110 }, { x: 120, y: 390 }, { x: 780, y: 390 }], instruments: [{ key: 'schoolBell', x: 450, y: 120, r: 38 }], cover: [] },
  instrument: { type: 'schoolBell', count: 1, required: 1, cooldown: 8, stun: 2, vulnerable: 2, damageMul: 1.25 },
  skills: [
    { key: 'hunt', nameKey: 'boss.grok.hunt', phases: [1, 2, 3], pattern: 'dash', tell: 0.86, tellShape: 'line', damage: 28, recovery: 1.8, count: [3, 3, 3], speed: [610, 650, 700], duration: 0.62, counter: 'sideDash' },
    { key: 'rings', nameKey: 'boss.grok.rings', phases: [1, 2, 3], pattern: 'rings', tell: 0.8, tellShape: 'circle', damage: 18, recovery: 1.7, count: [2, 3, 4], speed: 245, counter: 'ringGap' },
    { key: 'fan', nameKey: 'boss.grok.fan', phases: [1, 2, 3], pattern: 'fan', tell: 0.7, tellShape: 'fan', damage: 16, recovery: 1.7, waves: [2, 3, 4], count: [3, 3, 5], speed: 260, counter: 'waveGap' },
    { key: 'hide', nameKey: 'boss.grok.hide', phases: [2], pattern: 'ambush', tell: 0, tellShape: 'hide', damage: 24, recovery: 1.4, hidden: 1.6, speed: 650, counter: 'listenBackattack' },
    { key: 'finale', nameKey: 'boss.grok.finale', phases: [3], pattern: 'rain', tell: 1, tellShape: 'safePoints', damage: 20, recovery: 2, duration: 0.9, safeCount: 4, counter: 'litSafePoint' },
  ],
  counterSkill: 'hunt', defeat: { pose: 'sit', action: 'untieHair', lineAt: 3.2, dissolve: 'fry', destination: 'schoolGate' },
});
