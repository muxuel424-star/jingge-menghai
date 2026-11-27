import { P, SEA } from './palette.js';

export const ITEMS = {
  lamp: { key: 'lamp', nameKey: 'item.lamp', duration: 8, lightRadius: 420, revealHidden: true, color: P.lamp },
  shield: { key: 'shield', nameKey: 'item.shield', duration: null, charges: 2, breakInvulnerability: 0.85, color: P.bone },
  magnet: { key: 'magnet', nameKey: 'item.magnet', duration: 18, radius: 192, edibleOnly: true, ignoresArmored: true, color: P.dream },
  bait: { key: 'bait', nameKey: 'item.bait', duration: 16, radius: 300, attracts: ['fry'], color: P.paper },
  haste: { key: 'haste', nameKey: 'item.haste', duration: 14, speedMul: 1.32, dashRegenMul: 1.5, singingSpeedMul: 0.73, color: SEA[1].hi },
  heal: { key: 'heal', nameKey: 'item.heal', duration: 0, healFraction: 0.35, stability: 12, instant: true, color: SEA[0].hi },
  smoke: { key: 'smoke', nameKey: 'item.smoke', duration: 6, loseTargets: true, stopNightmareChainChase: true, color: SEA[2].mid },
  sonar: { key: 'sonar', nameKey: 'item.sonar', duration: 25, reveal: ['chest', 'fragment', 'instrument'], color: SEA[1].hi },
};

export const ITEM_RULES = { maxBuffs: 2, refreshSame: true, supplyPoints: [12, 16], forecastSeconds: 40, bossSupply: 'shield' };
export const UPGRADES = {
  // 08's printed total (830) conflicts with its price rows (1370). Keep the rows.
  belly: { key: 'belly', max: 5, prices: [15, 30, 55, 90, 140], stabilityDrainPerLevel: -0.08 },
  fin: { key: 'fin', max: 5, prices: [15, 30, 55, 90, 140], speedPerLevel: 0.04 },
  fat: { key: 'fat', max: 5, prices: [15, 30, 55, 90, 140], hpPerLevel: 0.1 },
  echo: { key: 'echo', max: 5, prices: [20, 40, 70, 110, 160], songCooldownPerLevel: -0.8, songRadiusPerLevel: 0.08 },
};
export const MELODIES = {
  calm: { key: 'calm', default: true, stun: [0.8, 1.5], nightmareCalmMul: 1 },
  response: { key: 'response', requiredFragments: 3, perfectWindow: 0.11, extraVulnerability: 0.8 },
  awakening: { key: 'awakening', requiredDreams: 5, finalPhaseChoir: true },
};
export const MISSIONS = [
  { id: 'fry60', target: 60, pearls: 12, level: 1, stat: 'fry' },
  { id: 'frag3', target: 3, pearls: 20, level: 1, stat: 'fragments' },
  { id: 'chain12', target: 12, pearls: 15, level: 1, stat: 'maxChain' },
  { id: 'perfect3', target: 3, pearls: 18, level: 1, stat: 'perfects' },
  { id: 'clean', target: 0, pearls: 30, level: 2, stat: 'hits', comparison: 'equal' },
  { id: 'abyss1', target: 1, pearls: 25, level: 3, stat: 'abyss' },
  { id: 'melody', target: 3, pearls: 22, level: 2, stat: 'melodies' },
  { id: 'nohitboss', target: 0, pearls: 40, level: 3, stat: 'bossHits', comparison: 'equal' },
  { id: 'fast', target: 600, pearls: 25, level: 2, stat: 'seconds', comparison: 'less' },
  { id: 'tapir', target: 2, pearls: 15, level: 3, stat: 'tapirsSlept' },
  { id: 'hidden', target: 1, pearls: 20, level: 1, stat: 'souvenir' },
  { id: 'win', target: 1, pearls: 80, level: 5, stat: 'win' },
];
