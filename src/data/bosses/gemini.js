import { defineBoss } from './shared.js';

export const GEMINI = defineBoss({
  key: 'gemini', level: 3, segmentHp: 320, targetSeconds: [120, 150],
  melody: { mode: 'F#-yu', notes: ['F#', 'C#', 'E', 'F#'], gateNotes: ['F#', 'C#', 'E', 'F#'], releaseNote: 'F#' },
  arena: { width: 1000, height: 600, shape: 'rect', theme: 'rooftop', instruments: [{ key: 'windChime', x: 100, y: 100, r: 26 }, { key: 'windChime', x: 500, y: 80, r: 26 }, { key: 'windChime', x: 900, y: 100, r: 26 }, { key: 'windChime', x: 100, y: 490, r: 26 }, { key: 'windChime', x: 500, y: 520, r: 26 }, { key: 'windChime', x: 900, y: 490, r: 26 }], cover: [{ x: 300, y: 340, w: 120, h: 90 }, { x: 700, y: 250, w: 120, h: 90 }], safePoints: [{ x: 300, y: 430 }, { x: 700, y: 340 }] },
  instrument: { type: 'windChime', count: 6, required: 3, window: 6, cooldown: 8, emotional: true, vulnerable: 2.5, stopAttacks: 2.5, damageMul: 1.5, lineKey: 'boss.gemini.instrument' },
  skills: [
    { key: 'hide', nameKey: 'boss.gemini.hide', phases: [1, 2, 3], pattern: 'ambush', tell: 0.9, tellShape: 'purpleMist', damage: 21, recovery: 1.6, speed: 650, counter: 'listenBackattack' },
    { key: 'mark', nameKey: 'boss.gemini.mark', phases: [1, 2, 3], pattern: 'markers', tell: 0.88, tellShape: 'circles', damage: 19, recovery: 1.8, count: [3, 4, 5], interval: 0.22, counter: 'unmarkedGround' },
    { key: 'sweep', nameKey: 'boss.gemini.sweep', phases: [1, 2, 3], pattern: 'sweep', tell: 0.75, tellShape: 'arc', damage: 24, recovery: 1.65, radius: 220, angle: 3.141592653589793, counter: 'aboveOrBelow' },
    { key: 'yarn', nameKey: 'boss.gemini.yarn', phases: [2], pattern: 'yarn', tell: 0.8, tellShape: 'ball', damage: 14, recovery: 1.8, bounces: 6, cutLinesToStun: 3, counter: 'lungeCut' },
    { key: 'finale', nameKey: 'boss.gemini.finale', phases: [3], pattern: 'coverShock', tell: 1.2, tellShape: 'fullBody', damage: 26, recovery: 2, duration: 1.5, interruptInstrument: true, counter: 'roofRidge' },
  ],
  counterSkill: 'mark', defeat: { pose: 'curlSleep', action: 'bowlLight', dissolve: false },
});
GEMINI.dialogue.hurt = null;
GEMINI.dialogue.instrument = 'boss.gemini.instrument';
export default GEMINI;
