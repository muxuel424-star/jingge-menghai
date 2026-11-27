import { ITEMS, ITEM_RULES } from '../../data/items.js';
import { TUNING as T } from '../../data/tuning.js';
import { distance, clamp } from '../math.js';

export function supplyWeights(game) {
  const p = game.player, horizon = ITEM_RULES.forecastSeconds, S = T.supply;
  const weights = Object.fromEntries(Object.keys(ITEMS).map(key => [key, S.baseWeight]));
  const drain = game.state === 'DEEP' ? T.stability.drain * game.stabilityPressure * (1 - (game.meta.upg?.belly ?? 0) * T.upgrade.belly) : 0;
  const predictedStability = p.stability - drain * horizon;
  const healthNeed = clamp((S.hpThreshold - p.hp / p.maxHp) / S.hpThreshold, 0, 1);
  const stabilityNeed = clamp((S.reserveStability - predictedStability) / S.reserveStability, 0, 1);
  weights.heal += S.needWeight * Math.max(healthNeed, stabilityNeed);
  const nextGate = (game.scene.gates ?? []).find(gate => gate.x >= p.x && gate.tier > p.tier
    && gate.x - p.x < T.tiers[p.tier].speed * horizon);
  if (game.state === 'DEEP' && (nextGate || p.tier < T.tiers.length - 1)) {
    const targetTier = nextGate?.tier ?? p.tier + 1;
    const need = clamp((T.tiers[targetTier].mem - p.mem) / T.tiers[targetTier].mem, 0, 1);
    weights.magnet += S.growthWeight * need; weights.bait += S.growthWeight * need;
  }
  const danger = game.fish.some(fish => !fish.eaten && fish.tier > p.tier && distance(fish, p) < S.revealRadius);
  if (danger || game.chain.length) { weights.shield += S.dangerWeight; weights.smoke += S.dangerWeight; }
  if (game.entities.fragments.some(f => f.hidden && !f.collected)) { weights.lamp += S.dangerWeight; weights.sonar += S.dangerWeight; }
  for (const buff of p.buffs) weights[buff.key] = 0;
  if (game.lastSupplyKey) weights[game.lastSupplyKey] *= S.repeatMul;
  return weights;
}

export function forecastSupplies(game) {
  for (const supply of game.entities.pickups) {
    if (!supply.supply || supply.forecast || supply.collected || distance(supply, game.player) > T.supply.revealRadius) continue;
    if (supply.bossSupply) supply.key = ITEM_RULES.bossSupply;
    else {
      const weights = supplyWeights(game), entries = Object.entries(weights);
      let roll = game.rng.next() * entries.reduce((sum, [, weight]) => sum + weight, 0);
      supply.key = entries.find(([, weight]) => (roll -= weight) < 0)?.[0] ?? 'heal';
    }
    supply.forecast = true; game.lastSupplyKey = supply.key;
    game.emit('supply.reveal', { id: supply.id, key: supply.key, forecastSeconds: ITEM_RULES.forecastSeconds, x: supply.x, y: supply.y });
  }
}
