import { TUNING as T } from '../../data/tuning.js';
import { MISSIONS } from '../../data/items.js';
import { SPECIES } from '../../data/species.js';
import { clamp } from '../math.js';
export function createStats() {
  return { eaten: 0, fry: 0, abyss: 0, hits: 0, bossHits: 0, fragments: 0, melodies: 0, perfects: 0, maxChain: 0, delivered: 0, calmed: 0, nightmaresSlept: 0, tapirsSlept: 0, souvenir: 0, shortcuts: 0, seconds: 0, win: 0, score: 0, dashSeconds: 0, gatePerfects: 0, maxGatePerfects: 0, downs: {} };
}
export function chooseMissions(game) {
  const highest = Math.max(1, ...Object.entries(game.meta.levels ?? {}).filter(([, l]) => l.cleared).map(([key]) => Number(key)));
  const available = MISSIONS.filter(m => m.level <= highest);
  const requested = game.meta.missions?.active?.map(id => available.find(m => m.id === id)).filter(Boolean) ?? [];
  const chosen = [...requested.slice(0, 3)];
  const unseen = available.filter(m => !chosen.includes(m) && !game.meta.missions?.done?.includes(m.id));
  const pool = unseen.length >= 3 - chosen.length ? [...unseen] : available.filter(m => !chosen.includes(m));
  while (chosen.length < 3 && pool.length) chosen.push(pool.splice(game.rng.int(0, pool.length - 1), 1)[0]);
  return chosen;
}
export function makeResult(game, outcome) {
  const won = outcome === 'CLEARED'; game.stats.win = won ? 1 : 0; game.stats.seconds = game.time;
  const completed = game.missions.filter(m => m.comparison === 'equal' ? won && game.stats[m.stat] === m.target : m.comparison === 'less' ? won && game.stats[m.stat] <= m.target : game.stats[m.stat] >= m.target);
  const wages = clamp(Math.floor(game.stats.score / T.economy.wageDivisor), T.economy.wageMin, T.economy.wageMax);
  const first = won && !game.meta.levels?.[game.level.level]?.cleared;
  const earned = game.pearls + wages + completed.reduce((n, m) => n + m.pearls, 0) + (first ? T.economy.firstClear : 0);
  const collection = game.storyCount * T.grade.collectionPerFragment + game.usedShortcuts.size * T.grade.shortcut + (game.stats.souvenir ? T.grade.souvenir : 0);
  const target = game.level.targetSeconds ?? T.grade.target;
  const speed = clamp(T.grade.speedMax - Math.max(0, Math.ceil((game.time / target - T.grade.speedFull) / T.grade.speedStep)) * T.grade.speedPenalty, 0, T.grade.speedMax);
  const safety = Math.max(0, T.grade.hurtMax - game.stats.hits * T.grade.hurtPenalty);
  const evaluation = Math.min(100, collection + speed + safety);
  let grade = evaluation >= T.grade.S ? 'S' : evaluation >= T.grade.A ? 'A' : evaluation >= T.grade.B ? 'B' : 'C';
  if (game.melodyCount >= 3) grade = ['S','S','A','B'][['S','A','B','C'].indexOf(grade)];
  return { id: `${game.seed}:${game.runSerial}`, seed: game.seed, level: game.level.level, levelKey: game.level.key, outcome, won, grade, evaluation,
    pearls: Math.floor(earned * (won ? 1 : T.economy.failMul)), lootPearls: game.pearls, wages, score: game.stats.score, time: game.time, tier: game.player.tier, rank: grade,
    storyCount: game.storyCount, melodyCount: game.melodyCount, fragmentIds: [...game.storyFragments], delivered: game.delivered, eaten: game.stats.eaten,
    stats: structuredClone(game.stats), fragments: [...game.storyFragments], melodies: [...game.melodies], melody: game.melodies.size,
    species: [...game.seen].filter(kind => SPECIES[kind]), souvenir: game.souvenir ?? null, missions: completed.map(m => m.id), missionProgress: game.missions.map(m => ({ id: m.id, value: game.stats[m.stat], target: m.target })),
    breakdown: { collection, speed, safety }, retryFrom: 'DESCENT' };
}
