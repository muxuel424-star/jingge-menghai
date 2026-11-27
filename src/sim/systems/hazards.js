import { TUNING as T } from '../../data/tuning.js';
import { text } from '../../data/dialogue.js';
import { distance, normalize, pointSegmentDistance } from '../math.js';

const FLOW = new Set(['current', 'reverseCurrent', 'upcurrent', 'downcurrent', 'weightCurrent']);
const LAVA = new Set(['lava', 'porcelainLava']);
const inside = (entity, h, padding = entity.r ?? 0) => Math.abs(entity.x - h.x) <= h.w / 2 + padding && Math.abs(entity.y - h.y) <= h.h / 2 + padding;

function flow(game, h, dt) {
  const p = game.player;
  const entered = inside(p, h);
  if (entered && !h.playerInside) game.emit('current.enter', { kind: h.kind, x: h.x, y: h.y });
  h.playerInside = entered;
  if (!entered) return;
  let x = h.forceX ?? 0, y = h.forceY ?? 0;
  if (h.kind === 'current' || h.kind === 'reverseCurrent') x ||= T.hazards.flow * (h.kind === 'reverseCurrent' ? -1 : 1);
  if (h.kind === 'upcurrent') y ||= -T.hazards.upflow;
  if (h.kind === 'downcurrent' || h.kind === 'weightCurrent') y ||= p.tier < 2 ? T.hazards.weightFlow : T.hazards.downflow / T.hazards.heavyDivisor;
  p.x += x * dt; p.y += y * dt;
  if ((game.input.x ?? 0) * x + (game.input.y ?? 0) * y < 0) game.conditions.reverseCurrent = true;
}

function steam(game, h, dt) {
  for (const enemy of [...game.entities.nightmares, ...game.fish]) {
    if (enemy.eaten || !inside(enemy, h)) continue;
    const n = normalize(enemy.x - h.x, enemy.y - h.y);
    enemy.x += n.x * T.hazards.steamPush * dt;
    enemy.y += (n.y || -1) * T.hazards.steamPush * dt;
    game.terrain.resolve(enemy, enemy.r, 2);
  }
  if (inside(game.player, h)) {
    game.conditions.steamExposure = true;
    game.damagePlayer(h.damage, h.kind, h);
  }
}

function vortex(game, h, dt) {
  const p = game.player, radius = Math.min(h.w, h.h) / 2;
  if (distance(p, h) > radius + p.r) return;
  const n = normalize(h.x - p.x, h.y - p.y);
  p.x += (n.x * T.hazards.vortexPull - n.y * T.hazards.vortexTurn) * dt;
  p.y += (n.y * T.hazards.vortexPull + n.x * T.hazards.vortexTurn) * dt;
  if (distance(p, h) < radius / T.hazards.vortexCoreDivisor) game.damagePlayer(h.damage, h.kind, h);
}

function ricochet(game, h, dt, started) {
  if (started) {
    h.shards = Array.from({ length: T.hazards.shardCount }, () => {
      const angle = game.rng.range(0, Math.PI * 2);
      return { x: h.x, y: h.y, vx: Math.cos(angle) * T.hazards.shardSpeed, vy: Math.sin(angle) * T.hazards.shardSpeed, r: T.hazards.shardRadius, bounces: 0 };
    });
  }
  for (const shard of h.shards) {
    if (shard.bounces > T.hazards.shardBounces) continue;
    shard.x += shard.vx * dt; shard.y += shard.vy * dt;
    const left = h.x - h.w / 2, right = h.x + h.w / 2, top = h.y - h.h / 2, bottom = h.y + h.h / 2;
    if (shard.x < left || shard.x > right) { shard.x = Math.max(left, Math.min(right, shard.x)); shard.vx *= -1; shard.bounces++; }
    if (shard.y < top || shard.y > bottom) { shard.y = Math.max(top, Math.min(bottom, shard.y)); shard.vy *= -1; shard.bounces++; }
    if (distance(game.player, shard) < game.player.r + shard.r) game.damagePlayer(h.damage, h.kind, shard);
  }
}

function activate(game, h, dt, started) {
  const p = game.player;
  if (LAVA.has(h.kind)) { if (inside(p, h)) game.damagePlayer(h.damage, h.kind, h); return; }
  if (h.kind === 'thermalVent') {
    if (inside(p, h)) {
      p.vy = T.hazards.ventImpulse; p.y += p.vy * dt;
      if (h.cooldown <= 0) { h.cooldown = T.hazards.ventCd; game.emit('hazard.vent', { x: h.x, y: h.y }); }
    }
  } else if (h.kind === 'steam' || h.kind === 'steamVent') steam(game, h, dt);
  else if (h.kind === 'vortex') vortex(game, h, dt);
  else if (h.kind === 'fallingTimber') {
    h.logY = h.y - h.h / 2 + h.activeAge * T.hazards.timberSpeed;
    if (Math.abs(p.y - h.logY) < p.r + T.hazards.doorHalfWidth && Math.abs(p.x - h.x) < h.w / 2 + p.r) game.damagePlayer(h.damage, h.kind, { x: h.x, y: h.logY });
  } else if (h.kind === 'swingingDoor') {
    h.angle = Math.sin(h.age / h.period * Math.PI * 2) * T.hazards.doorSwing;
    h.hinge = { x: h.x, y: h.y - h.h / 2 };
    h.tip = { x: h.x + Math.sin(h.angle) * h.h, y: h.hinge.y + Math.cos(h.angle) * h.h };
    if (pointSegmentDistance(p, h.hinge, h.tip) < p.r + T.hazards.doorHalfWidth) game.damagePlayer(h.damage, h.kind, h.tip);
  } else if (h.kind === 'echoRing') {
    h.ringRadius = h.activeAge * T.hazards.ringSpeed;
    if (Math.abs(distance(p, h) - h.ringRadius) < p.r + T.hazards.ringWidth) game.damagePlayer(h.damage, h.kind, h);
  } else if (h.kind === 'ricochetShards') ricochet(game, h, dt, started);
  else if (inside(p, h)) game.damagePlayer(h.damage, h.kind, h);
}

function narrativeStillness(game, dt) {
  const p = game.player, loop = game.scene.loop;
  if (game.input.x || game.input.y) game.stillTime = 0;
  else game.stillTime += dt;
  const fragment = game.scene.fragments?.find(f => f.condition === 'still3s');
  const atStoryPlace = fragment && distance(p, fragment) <= T.world.fragmentRadius + p.r;
  const inLoop = loop && p.x >= loop.fromX && p.x <= loop.toX;
  if (game.stillTime >= (loop?.breakWhenStill ?? T.hazards.stillSeconds) && (atStoryPlace || inLoop)) game.conditions.still3s = true;
  if (loop && !game.conditions.still3s && p.x > loop.toX) {
    p.x = loop.fromX; p.vx = 0; game.loopCount++;
    const key = game.loopCount >= loop.maxLoops ? loop.hintKey : 'teach.stop';
    game.emit('notify', { text: text(key), ttl: T.hazards.hintDuration });
    game.emit('world.loop', { count: game.loopCount, clockHandsStatic: true });
  }
}

export function tickHazards(game, dt) {
  for (const h of game.entities.hazards) {
    if (Math.abs(h.x - game.player.x) > T.sim.activeRadius) continue;
    h.age += dt; h.cooldown = Math.max(0, h.cooldown - dt);
    if (FLOW.has(h.kind)) { h.active = true; flow(game, h, dt); continue; }
    const cycle = h.age % h.period, previousActive = h.active, wasTelling = h.tellT > 0;
    h.tellT = !h.continuous && cycle < h.tell ? h.tell - cycle : 0;
    if (h.tellT > 0 && !wasTelling) game.emit('env.warn', { kind: h.kind, x: h.x, y: h.y, windup: h.tellT });
    const duration = h.kind === 'ricochetShards' ? h.period - h.tell : T.hazards.activeDuration;
    h.active = h.continuous || (cycle >= h.tell && cycle < h.tell + duration);
    if (h.active && !previousActive && !h.continuous) game.emit('env.fire', { kind: h.kind, x: h.x, y: h.y });
    h.activeAge = h.continuous ? h.age : Math.max(0, cycle - h.tell);
    if (h.active) activate(game, h, dt, !previousActive);
    else { h.shards.length = 0; h.ringRadius = 0; }
  }
  narrativeStillness(game, dt);
  game.terrain.resolve(game.player);
}
