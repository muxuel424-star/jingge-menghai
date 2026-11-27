import { TUNING as T } from '../../data/tuning.js';
import { SPECIES } from '../../data/species.js';
import { approach, clamp, normalize } from '../math.js';
export function movePlayer(game, dt, input) {
  const p = game.player, haste = p.buffs.find(b => b.key === 'haste');
  const wasDashing = p.dashing;
  if (!input.dash) p.dashExhausted = false;
  else if (p.dash <= 0) p.dashExhausted = true;
  const direction = normalize(input.x || 0, input.y || 0);
  if (direction.x) p.dir = Math.sign(direction.x);
  if (direction.x || direction.y) p.angle = Math.atan2(direction.y, direction.x);
  p.dashing = Boolean(input.dash && !p.dashExhausted && p.dash > 0 && (direction.x || direction.y));
  if (game.state === 'SURFACE' && p.singing) p.dashing = false;
  if (p.dashing && p.singing) { game.breakSong(); p.singing = false; }
  if (p.dashing && !wasDashing) { p.dashPassTimer = SPECIES.manta.dashPassInvulnerable; game.emit('dash', { x: p.x, y: p.y }); }
  if (p.dashing) game.stats.dashSeconds += dt;
  let speed = T.tiers[p.tier].speed * (1 + (game.meta.upg?.fin ?? 0) * T.upgrade.fin);
  if (p.dashing) speed = T.player.dashSpeed;
  if (p.frenzy > 0) speed *= T.combo.frenzySpeed;
  if (p.singing) speed *= haste ? haste.singingSpeedMul : T.player.singSpeedMul;
  else if (haste) speed *= haste.speedMul;
  if (p.biteWindow > 0) speed += T.bite.lunge;
  const attackDir = p.biteWindow > 0 && !direction.x && !direction.y ? { x: p.dir, y: 0 } : direction;
  p.vx = approach(p.vx, attackDir.x * speed, T.player.accel, dt);
  p.vy = approach(p.vy, attackDir.y * speed, T.player.accel, dt);
  p.x += p.vx * dt; p.y += p.vy * dt;
  game.terrain.resolve(p, p.r, p.tier);
  const regen = T.player.dashRegen * (haste?.dashRegenMul ?? 1);
  p.dash = clamp(p.dash + (p.dashing ? -T.player.dashDrain : regen) * dt, 0, T.player.dashMax);
  // A held exhausted button must not alternate dash/swim every time regen adds a fraction.
  if (p.dashing && p.dash <= 0) p.dashExhausted = true;
}
export function tickResources(game, dt) {
  const p = game.player;
  for (const key of ['biteTimer','biteWindow','invuln','hurtTimer','comboTimer','frenzy','songCooldown','dashPassTimer']) p[key] = Math.max(0, p[key] - dt);
  if (!p.comboTimer) p.combo = 0;
  p.breath = clamp(p.breath + (p.singing ? -T.player.breathDrain : T.player.breathRegen) * dt, 0, p.maxBreath);
  if (p.breath <= 0 && p.singing) game.breakSong();
  if (game.state === 'DEEP') {
    if (!p.frenzy) p.stability = Math.max(0, p.stability - T.stability.drain * game.stabilityPressure * (1 - (game.meta.upg?.belly ?? 0) * T.upgrade.belly) * dt);
    if (!p.stability) game.finish('FADED');
  }
  if (game.state === 'SURFACE' && p.breath <= 0) {
    p.stability = Math.max(0, p.stability - T.player.surfaceExhaustDrain * dt);
    p.hp = Math.max(0, p.hp - T.player.surfaceExhaustDamage * dt);
  }
}
