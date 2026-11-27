import { P, SEA } from './palette.js';

// 02 owns effective food tiers. 06's old 3/4 tiers are retained only as provenance.
export const SPECIES = {
  fry: {
    key: 'fry', nameKey: 'species.fry', tier: 0, hp: 1, dmg: 0, mem: 3, food: 6,
    size: { w: 26, h: 15 }, radius: 13, color: P.dream, count: [8, 14], levels: [1, 2, 3, 4, 5],
    initial: 'school', fleeSpeedMul: 0.63, songLureCount: 7, alwaysVulnerable: true,
    actions: [{ key: 'school', tell: 0, duration: null, next: 'flee' }, { key: 'flee', tell: 0, duration: 0.85, next: 'school' }],
    ecology: { luredBy: 'lantern', consumedBy: 'abyss', startledBy: 'dash', stunnedBy: 'royal', stunDuration: 1.5 },
  },
  lantern: {
    key: 'lantern', nameKey: 'species.lantern', tier: 1, hp: 1, dmg: 9, mem: 12, food: 14,
    size: { w: 48, h: 36 }, radius: 24, color: P.lamp, count: [3, 5], levels: [1, 2, 3, 4, 5],
    initial: 'pulse', triggerRadius: 210, attackRadius: 114, lurePeriod: 4.3,
    actions: [{ key: 'pulse', tell: 0, duration: 4.3, next: 'flash' }, { key: 'flash', tell: 0.85, duration: 0.85, next: 'recover', effect: 'shock' }, { key: 'recover', tell: 0, duration: 1.1, next: 'pulse', vulnerable: true, speed: 0 }],
    ecology: { lures: 'fry' },
  },
  manta: {
    key: 'manta', nameKey: 'species.manta', tier: 2, hp: 1, dmg: 14, mem: 30, food: 22,
    size: { w: 85, h: 42 }, radius: 42.5, color: SEA[2].hi, count: [2, 3], levels: [2, 3, 4, 5],
    initial: 'glide', triggerRadius: 240, attackRadius: 120, sineMul: 1.7, dashPassInvulnerable: 0.2,
    actions: [{ key: 'glide', tell: 0, duration: null, next: 'evade' }, { key: 'evade', tell: 0, duration: 0.6, next: 'vortex' }, { key: 'vortex', tell: 0.72, duration: 2.52, activeDuration: 1.8, next: 'recover' }, { key: 'recover', tell: 0, duration: 0.6, speed: 0, vulnerable: true, next: 'glide' }],
    ecology: { vortexPulls: 'fry' },
  },
  royal: {
    key: 'royal', nameKey: 'species.royal', tier: 2, sourceTier: 3, hp: 1, dmg: 18, mem: 55, food: 30,
    size: { w: 94, h: 64 }, radius: 47, color: SEA[3].hi, count: [1, 2], levels: [1, 2, 3, 4, 5],
    initial: 'guard', triggerRadius: 300, tellLineLength: 250, armorHits: 2, backOffset: -10,
    actions: [{ key: 'guard', tell: 0, duration: null, next: 'charge', armored: true }, { key: 'charge', tell: 0.82, duration: 0.82, next: 'rush', armored: true }, { key: 'rush', tell: 0, duration: 0.52, next: 'recover', speed: 395, armored: true }, { key: 'recover', tell: 0, duration: 2.2, next: 'guard', armored: false, vulnerable: true }],
    ecology: { rushStuns: 'fry', stunDuration: 1.5 },
  },
  abyss: {
    key: 'abyss', nameKey: 'species.abyss', tier: -1, sourceTier: 4, hp: 1, dmg: 32, mem: 90, food: 35,
    size: { w: 156, h: 100 }, radius: 78, color: SEA[2].mid, count: [1, 1], levels: [3, 4, 5],
    initial: 'lurk', triggerRadius: 310, suctionRadius: 205, suctionCone: 1.05,
    counterkill: { perfectStun: 2, requiresLunge: true, duration: 2, pearls: 10 },
    actions: [{ key: 'lurk', tell: 0, duration: null, next: 'suction', speed: 8 }, { key: 'suction', tell: 0.95, duration: 2.85, activeDuration: 1.9, next: 'lungeTell' }, { key: 'lungeTell', tell: 0.32, duration: 0.32, next: 'lunge' }, { key: 'lunge', tell: 0, duration: 0.38, speed: 520, next: 'recover' }, { key: 'recover', tell: 0, duration: 2, next: 'lurk', vulnerable: true }],
    ecology: { consumes: ['fry', 'lantern', 'manta', 'royal'] },
  },
  jelly: {
    key: 'jelly', nameKey: 'species.jelly', tier: 1, hp: 1, dmg: 0, mem: 0, food: 0,
    size: { w: 74, h: 55 }, radius: 37, color: SEA[1].hi, count: [4, 6], levels: [2, 3, 4, 5],
    neutral: true, initial: 'float', bounce: { vy: -385, cooldown: 1.2 },
    actions: [{ key: 'float', tell: 0, duration: null }],
  },
  tapir: {
    key: 'tapir', nameKey: 'species.tapir', tier: -1, hp: 1, dmg: 0, mem: 0, food: 0,
    size: { w: 100, h: 67 }, radius: 50, color: P.bone, count: [1, 1], levels: [3, 4, 5],
    neutral: true, initial: 'seekDream', steal: [1, 2], sleepDuration: 12, sleepReleasesDreams: true,
    actions: [{ key: 'seekDream', tell: 0, duration: null, speed: 38 }, { key: 'sleep', tell: 0, duration: 12, next: 'seekDream', speed: 0 }],
  },
  guard: {
    key: 'guard', nameKey: 'species.guard', tier: -1, hp: 1, dmg: 12, mem: 0, food: 0,
    size: { w: 70, h: 70 }, radius: 35, color: SEA[0].mid, count: [2, 4], levels: [1, 2],
    fixed: true, initial: 'closed', triggerRadius: 90, rearPassable: true,
    actions: [{ key: 'closed', tell: 0, duration: null, next: 'open' }, { key: 'open', tell: 0.4, duration: 0.8, next: 'recover' }, { key: 'recover', tell: 0, duration: 1.6, next: 'closed', vulnerable: true }],
  },
  nightmare: {
    key: 'nightmare', nameKey: 'species.nightmare', tier: -1, hp: 1, dmg: 0, mem: 0, food: 0,
    size: { w: 89, h: 70 }, radius: 44.5, color: P.night, count: [1, 5], levels: [1, 2, 3, 4, 5],
    surfaceOnly: true, initial: 'wander', calmRate: 0.68, maxSize: 1.9, releasedDreams: [2, 6],
    actions: [{ key: 'wander', tell: 0, duration: null, next: 'chaseDream' }, { key: 'chaseDream', tell: 0, duration: null, next: 'scatterChain' }, { key: 'calmed', tell: 0, duration: 1, next: null }],
  },
};

export const SPECIES_LIST = Object.values(SPECIES);
