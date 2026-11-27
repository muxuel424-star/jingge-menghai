export const BOSS_RULES = {
  entrance: 3, defeat: 4, defeatSkipSubtitle: 2, hitInvulnerability: 0.32,
  phaseThresholds: [1, 0.66, 0.33], phaseRest: 1.2,
  minDamageTier: 1, tier2DamageMul: 1.5, baseDamage: 19, damagePerTier: 10,
  backDamageMul: 1.4, frenzyDamageMul: 1.25, vulnerableDamageMul: 1.25,
  disengageRadius: 940, hiddenDisengage: 4.5,
  gate: { tell: 1.2, beats: 4, perfect: 2.4, good: 1.2, missResist: 8, perfectWindow: 0.08 },
  instrument: { cooldown: 8, hintRadius: 160, trigger: 'lunge' },
  phase3TellReduction: 0.07, phase3RecoveryReduction: 0.16,
};

export function defineBoss(spec) {
  return {
    ...spec,
    arena: { ...spec.arena, cover: spec.arena.cover.map(cover => cover.r
      ? { ...cover, rx: cover.r, ry: cover.r, kind: 'solid' }
      : { ...cover, kind: 'solid', points: [
        { x: cover.x - cover.w / 2, y: cover.y - cover.h / 2 },
        { x: cover.x + cover.w / 2, y: cover.y - cover.h / 2 },
        { x: cover.x + cover.w / 2, y: cover.y + cover.h / 2 },
        { x: cover.x - cover.w / 2, y: cover.y + cover.h / 2 },
      ] }) },
    nameKey: `boss.${spec.key}.name`, roleKey: `boss.${spec.key}.role`,
    maxHp: spec.segmentHp * 3, hp: spec.segmentHp * 3, phaseHP: spec.segmentHp, contactDamage: 14 + spec.level * 5,
    dialogue: Object.fromEntries(['enter', 'phase2', 'gate', 'phase3', 'hurt', 'defeat'].map(key => [key, `boss.${spec.key}.${key}`])),
    phases: [1, 2, 3].map(phase => ({
      phase, hp: spec.segmentHp, threshold: BOSS_RULES.phaseThresholds[phase - 1],
      skills: spec.skills.filter(skill => skill.phases.includes(phase)).map(skill => skill.key),
      attacks: spec.skills.filter(skill => skill.phases.includes(phase)),
      gate: { required: true, window: BOSS_RULES.gate.perfectWindow, beats: BOSS_RULES.gate.beats },
      instrument: spec.instrument, clearProjectiles: true, rest: BOSS_RULES.phaseRest,
    })),
  };
}
