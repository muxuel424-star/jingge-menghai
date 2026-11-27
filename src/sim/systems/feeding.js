import { SPECIES } from '../../data/species.js';
import { TUNING as T } from '../../data/tuning.js';
import { distance, isBehind } from '../math.js';
import { leaveRemains } from './emergence.js';
export function canEat(player, prey, options = {}) {
  if (prey.eaten || prey.kind === 'abyss' || prey.tier < 0 || prey.tier > player.tier) return false;
  if (prey.kind === 'royal' && prey.armored && !isBehind(player, prey) && !options.ignoreArmor) return false;
  return true;
}
export function biteDamage(player, prey) {
  let damage = T.bite.damage + player.tier * T.bite.damagePerTier;
  if (isBehind(player, prey)) damage *= T.bite.backMul;
  if (prey.action === 'recover' || prey.stun > 0) damage *= T.bite.vulnerableMul;
  if (player.frenzy > 0) damage *= T.combo.frenzyDamage;
  return damage;
}
export function eat(game, prey) {
  if (prey.eaten) return;
  const spec = SPECIES[prey.kind]; prey.eaten = true; prey.respawn = T.fish.respawn;
  leaveRemains(game, prey);
  game.addMem(spec.mem, spec.food, prey.kind);
  game.stats.eaten++; game.stats[prey.kind] = (game.stats[prey.kind] ?? 0) + 1;
  game.seen.add(prey.kind);
  game.emit('eat', { kind: prey.kind, combo: game.player.combo, x: prey.x, y: prey.y });
}
export function startBite(game) {
  const p = game.player;
  if (p.biteTimer > 0 || p.dash < T.player.dashCostPerBite) return false;
  p.biteTimer = T.bite.cd; p.biteWindow = T.bite.hurtWindow; p.biteId++; p.hitIds.clear();
  p.dash -= T.player.dashCostPerBite;
  p.vx += Math.cos(p.angle) * T.bite.lunge; p.vy += Math.sin(p.angle) * T.bite.lunge;
  game.emit('bite', { hit: false, target: null });
  return true;
}
export function tickFeeding(game) {
  const p = game.player;
  if (game.state === 'SURFACE') return;
  for (const f of game.fish) {
    if (f.eaten) continue;
    const reach = T.tiers[p.tier].reach + (p.biteWindow > 0 ? T.bite.reachBonus : 0);
    if (distance(p, f) > reach + f.r) continue;
    if (f.kind === 'abyss' && f.perfectStun && f.stun > 0 && p.biteWindow > 0 && !p.hitIds.has(f.id)) {
      p.hitIds.add(f.id); game.counterkill = { fish: f, remaining: SPECIES.abyss.counterkill.duration };
      game.cancelHeld(); game.emit('counterkill', { x: f.x, y: f.y, duration: SPECIES.abyss.counterkill.duration }); return;
    }
    if (f.kind === 'royal' && f.armored && !isBehind(p, f) && p.biteWindow > 0 && !p.hitIds.has(f.id) && p.tier >= f.tier) {
      p.hitIds.add(f.id); f.armorHits++; game.emit('bite', { hit: true, target: f.kind, armor: true, x: f.x, y: f.y });
      if (f.armorHits >= SPECIES.royal.armorHits) { f.armored = false; f.action = 'recover'; f.stateT = 0; game.emit('fish.crack', { kind: f.kind, x: f.x, y: f.y }); }
      continue;
    }
    if (canEat(p, f) && (f.kind === 'fry' || p.biteWindow > 0)) {
      if (p.hitIds.has(f.id)) continue;
      p.hitIds.add(f.id); eat(game, f);
      // Passive fry feeding must not repeatedly freeze swimming through a school.
      if (f.kind !== 'fry' && p.biteWindow > 0) game.hitstop = T.player.hitstop;
      if (p.biteWindow > 0) game.emit('bite', { hit: true, target: f.kind, x: f.x, y: f.y });
    }
  }
}
