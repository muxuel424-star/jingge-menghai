import { TUNING as T } from '../../data/tuning.js';
export function createPlayer(spawn, meta = {}, delivered = 0) {
  const tier = T.tiers[0], fat = meta.upg?.fat ?? 0;
  const [every, bonus, max] = T.player.breathBonusPer;
  const maxBreath = T.player.breathMax + Math.min(max, Math.floor(delivered / every) * bonus);
  return {
    x: spawn.x, y: spawn.y, prevX: spawn.x, prevY: spawn.y, vx: 0, vy: 0, dir: 1, angle: 0,
    r: T.player.radius, tier: 0, size: tier.size, mem: 0, hp: tier.hp * (1 + fat * T.upgrade.fat), maxHp: tier.hp * (1 + fat * T.upgrade.fat),
    breath: maxBreath, maxBreath, dash: T.player.dashMax, dashExhausted: false, stability: 100, singing: false, dashing: false,
    biteTimer: 0, biteWindow: 0, biteId: 0, hitIds: new Set(), invuln: 0, hurtTimer: 0, dashPassTimer: 0,
    combo: 0, comboTimer: 0, satiety: 0, frenzy: 0, buffs: [], shield: 0, songCooldown: 0,
  };
}
