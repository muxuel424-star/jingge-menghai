import { ITEMS, ITEM_RULES } from '../../data/items.js';
import { TUNING as T } from '../../data/tuning.js';
import { clamp, distance } from '../math.js';
import { forecastSupplies } from './supply.js';
export function applyItem(game, key) {
  const p = game.player, spec = ITEMS[key];
  if (!spec) return false;
  if (key === 'heal') { p.hp = Math.min(p.maxHp, p.hp + p.maxHp * spec.healFraction); p.stability = Math.min(100, p.stability + spec.stability); }
  else {
    const previous = p.buffs.find(b => b.key === key);
    if (previous) Object.assign(previous, { remaining: spec.duration ?? Infinity, charges: spec.charges });
    else if (p.buffs.length >= ITEM_RULES.maxBuffs) { game.emit('notify', { text: '先让身上的潮光散去', ttl: 2 }); return false; }
    else p.buffs.push({ ...spec, remaining: spec.duration ?? Infinity });
    if (key === 'shield') p.shield = spec.charges;
  }
  game.emit('item.pickup', { key, x: p.x, y: p.y });
  return true;
}
export function tickItems(game, dt) {
  const p = game.player;
  forecastSupplies(game);
  for (const buff of p.buffs) { buff.remaining -= dt; if (buff.key === 'smoke' && buff.remaining <= 0) game.targetGrace = T.fish.retargetGrace; }
  p.buffs = p.buffs.filter(b => b.remaining > 0 && (b.key !== 'shield' || p.shield > 0));
  for (const item of game.entities.pickups) {
    if (item.collected || distance(item, p) > T.world.pickupRadius + p.r) continue;
    if (item.key === 'souvenir') { item.collected = true; game.stats.souvenir = 1; game.souvenir = item.id ?? game.level.souvenir; game.emit('item.pickup', { key: 'souvenir', x: item.x, y: item.y }); }
    else if (item.key === 'chest' || item.key === 'clam' || item.key === 'crystal') {
      if ((item.key === 'chest' && p.tier < 1) || (item.hidden && !p.buffs.some(b => b.key === 'lamp'))) continue;
      item.collected = true; game.addMem(T.mem[item.key], item.key === 'chest' ? 18 : 6, item.key);
      game.pearls += item.key === 'chest' ? T.economy.chest : item.key === 'clam' ? (game.rng.next() < T.economy.clamBonusChance ? T.economy.clamBonus : T.economy.clam) : 0;
    } else if (applyItem(game, item.key)) item.collected = true;
  }
  const magnet = p.buffs.find(b => b.key === 'magnet'), bait = p.buffs.find(b => b.key === 'bait');
  for (const f of game.fish) {
    if (f.eaten || f.armored || f.tier < 0 || f.tier > p.tier) continue;
    const d = distance(f, p), radius = Math.max(magnet?.radius ?? 0, f.kind === 'fry' ? bait?.radius ?? 0 : 0);
    if (d > radius || !radius) continue;
    const fraction = clamp(T.fish.lureSpeed * dt / Math.max(1, d), 0, 1);
    f.x += (p.x - f.x) * fraction; f.y += (p.y - f.y) * fraction;
  }
}
