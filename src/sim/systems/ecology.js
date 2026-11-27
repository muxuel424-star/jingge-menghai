import { SPECIES } from '../../data/species.js';
import { TUNING as T } from '../../data/tuning.js';
import { distance, normalize, clamp } from '../math.js';
const SPECIAL = new Set(['flash','vortex','charge','rush','suction','lungeTell','lunge','open']);
const enter = (f, action, game) => { f.action = action; f.stateT = 0; f.tellT = (SPECIES[f.kind] ?? SPECIES.fry).actions.find(a => a.key === action)?.tell ?? 0; if (game && f.tellT) game.emit('fish.tell', { kind: f.kind, windup: f.tellT, x: f.x, y: f.y }); };
function request(game, f, action) {
  const occupied = game.fish.filter(other => !other.eaten && other !== f && distance(other, game.player) < T.sim.activeRadius && SPECIAL.has(other.action)).length;
  if (occupied >= T.sim.skillSlots) { f.cooldown = T.fish.skillRetry; return false; }
  enter(f, action, game); return true;
}
function drift(f, dt, speed, away = null) {
  const dir = away ? normalize(f.x - away.x, f.y - away.y) : { x: f.dir, y: Math.sin(f.stateT * 1.7 + f.phase) * .4 };
  f.vx = dir.x * speed; f.vy = dir.y * speed; f.x += f.vx * dt; f.y += f.vy * dt;
}
function chase(f, target, dt, speed) {
  const n = normalize(target.x - f.x, target.y - f.y);
  f.vx = n.x * speed; f.vy = n.y * speed; f.x += f.vx * dt; f.y += f.vy * dt;
  if (n.x) f.dir = Math.sign(n.x);
}
export function tickFish(game, dt) {
  const p = game.player, smoke = p.buffs.some(b => b.key === 'smoke') || game.targetGrace > 0;
  const lure = new Set((p.singing || game.song.resonance > 0) ? game.fish.filter(f => ['fry','dreamfish'].includes(f.kind) && !f.eaten && distance(f, p) < game.songRadius).sort((a, b) => distance(a, p) - distance(b, p)).slice(0, SPECIES.fry.songLureCount).map(f => f.id) : []);
  for (const f of game.fish) {
    f.prevX = f.x; f.prevY = f.y;
    if (f.eaten || distance(f, p) > T.sim.activeRadius) continue;
    const spec = SPECIES[f.kind] ?? SPECIES.fry, d = distance(f, p);
    f.cooldown = Math.max(0, f.cooldown - dt); f.bounceCd = Math.max(0, f.bounceCd - dt);
    if (f.stun > 0) { f.stun = Math.max(0, f.stun - dt); f.tellT = 0; if (!f.stun) { f.perfectStun = false; enter(f, spec.initial); } continue; }
    if (f.sleep > 0) { f.sleep -= dt; f.action = 'sleep'; if (!f.sleep) enter(f, spec.initial); continue; }
    f.stateT += dt;
    const action = spec.actions.find(a => a.key === f.action) ?? spec.actions[0];
    f.tellT = Math.max(0, (action.tell ?? 0) - f.stateT);
    if (f.kind === 'fry' || f.kind === 'dreamfish') {
      if (p.dashing && d < T.fish.fleeRadius && f.action !== 'flee') enter(f, 'flee');
      const lantern = game.fish.find(l => l.kind === 'lantern' && !l.eaten && l.action === 'pulse' && distance(l, f) < SPECIES.lantern.triggerRadius);
      if (f.action === 'flee') { drift(f, dt, T.tiers[p.tier].speed * spec.fleeSpeedMul, p); if (f.stateT > action.duration) enter(f, 'school'); }
      else if (lure.has(f.id)) chase(f, p, dt, T.fish.lureSpeed);
      else if (lantern) chase(f, lantern, dt, T.fish.frySpeed);
      else { f.x += Math.cos(game.time * .7 + f.phase) * T.fish.frySpeed * dt; f.y += Math.sin(game.time * 1.4 + f.phase) * T.fish.frySpeed * .35 * dt; }
    } else if (f.kind === 'jelly') {
      f.y = f.homeY + Math.sin(game.time * .8 + f.phase) * 22;
      if (d < f.r + p.r && !f.bounceCd) { p.vy = spec.bounce.vy; f.bounceCd = spec.bounce.cooldown; game.seen.add('jelly'); game.emit('jelly.bounce', { x: f.x, y: f.y }); }
    } else if (f.kind === 'tapir') {
      if (smoke) { drift(f, dt, 12); continue; }
      const tail = game.entities.dreamChain.at(-1), target = tail ?? game.fish.find(a => a.kind === 'dreamfish' && !a.eaten);
      if (target) { chase(f, target, dt, action.speed ?? 38); if (distance(f, target) < f.r && !f.cooldown) {
        if (tail) { f.stolen += game.scatterDreams(game.rng.int(...spec.steal), true); game.emit('notify', { text: '它叼走了你的梦', ttl: 2 }); }
        else { target.eaten = true; target.respawn = T.fish.respawn; f.stolen++; }
        f.cooldown = T.chain.stealCd;
      } }
    } else if (f.kind === 'guard') {
      if (f.action === 'closed' && d < spec.triggerRadius && !f.cooldown && (p.x - f.x) * f.dir > 0) request(game, f, 'open');
      if (f.action === 'open' && f.stateT >= action.tell && d < spec.triggerRadius && (p.x - f.x) * f.dir > 0) game.damagePlayer(spec.dmg, f.kind, f);
      if (action.duration && f.stateT >= action.duration) enter(f, action.next);
    } else if (f.kind === 'lantern') {
      if (f.action === 'pulse') { drift(f, dt, T.fish.idleSpeed); if (d < spec.triggerRadius && !smoke && !f.cooldown) request(game, f, 'flash'); }
      if (f.action === 'flash' && f.stateT >= action.duration) {
        if (d < spec.attackRadius + p.r) game.damagePlayer(spec.dmg, f.kind, f);
        game.emit('fish.attack', { kind: f.kind, x: f.x, y: f.y, radius: spec.attackRadius }); enter(f, 'recover');
      } else if (f.action === 'recover' && f.stateT >= action.duration) { enter(f, 'pulse'); f.cooldown = spec.lurePeriod * game.pressureConfig.fishCd; }
    } else if (f.kind === 'manta') {
      if (f.action === 'glide') { drift(f, dt, T.fish.idleSpeed * spec.sineMul); if (d < spec.triggerRadius && !smoke && !f.cooldown) enter(f, 'evade'); }
      else if (f.action === 'evade') { drift(f, dt, T.tiers[p.tier].speed, p); if (f.stateT >= action.duration) request(game, f, 'vortex'); }
      else if (f.action === 'vortex') {
        if (f.stateT >= action.tell && d < spec.attackRadius && p.dashPassTimer <= 0) {
          const n = normalize(f.x - p.x, f.y - p.y); p.x += n.x * T.fish.mantaPull * dt; p.y += n.y * T.fish.mantaPull * dt; game.damagePlayer(spec.dmg, f.kind, f);
        }
        for (const prey of game.fish) if (prey.kind === 'fry' && distance(prey, f) < spec.attackRadius) chase(prey, f, dt, T.fish.lureSpeed);
        if (f.stateT >= action.duration) enter(f, 'recover');
      } else if (f.action === 'recover' && f.stateT >= action.duration) { enter(f, 'glide'); f.cooldown = T.fish.mantaCd * game.pressureConfig.fishCd; }
    } else if (f.kind === 'royal') {
      if (f.action === 'guard') { f.dir = p.x >= f.x ? 1 : -1; f.armored = f.armorHits < spec.armorHits; if (d < spec.triggerRadius && !smoke && !f.cooldown) request(game, f, 'charge'); }
      if (f.action === 'charge' && f.stateT >= action.duration) { f.locked = normalize(p.x - f.x, p.y - f.y); enter(f, 'rush'); }
      else if (f.action === 'rush') {
        f.x += f.locked.x * action.speed * dt; f.y += f.locked.y * action.speed * dt;
        if (d < f.r + p.r) game.damagePlayer(spec.dmg, f.kind, f);
        for (const prey of game.fish) if (prey.kind === 'fry' && distance(prey, f) < f.r) prey.stun = spec.ecology.stunDuration;
        if (f.stateT >= action.duration) { enter(f, 'recover'); f.armored = false; }
      } else if (f.action === 'recover' && f.stateT >= action.duration) { enter(f, 'guard'); f.cooldown = T.fish.royalCd * game.pressureConfig.fishCd; }
    } else if (f.kind === 'abyss') {
      if (f.action === 'lurk' && d < spec.triggerRadius && !smoke && !f.cooldown) request(game, f, 'suction');
      if (f.action === 'suction' && f.stateT > action.tell) {
        const inCone = (p.x - f.x) * f.dir > 0 && Math.abs(p.y - f.y) < Math.abs(p.x - f.x) * Math.tan(spec.suctionCone);
        if (d < spec.suctionRadius && inCone) { const n = normalize(f.x - p.x, f.y - p.y); p.x += n.x * T.fish.abyssPull * dt; p.y += n.y * T.fish.abyssPull * dt; }
        for (const prey of game.fish) if (prey !== f && !prey.eaten && distance(prey, f) < spec.suctionRadius && (prey.x - f.x) * f.dir > 0) { chase(prey, f, dt, T.fish.abyssPreyPull); if (distance(prey, f) < f.r * .5) { prey.eaten = true; prey.respawn = T.fish.respawn; } }
      }
      if (f.action === 'lungeTell') f.locked = normalize(p.x - f.x, p.y - f.y);
      if (f.action === 'lunge') { f.x += f.locked.x * action.speed * dt; f.y += f.locked.y * action.speed * dt; if (d < f.r + p.r) game.damagePlayer(spec.dmg, f.kind, f); }
      if (action.duration && f.stateT >= action.duration) { enter(f, action.next, game); if (f.action === 'lurk') f.cooldown = T.fish.abyssCd * game.pressureConfig.fishCd; }
    }
    game.terrain.resolve(f, f.r, 2);
    if (Math.abs(f.x - f.homeX) > T.fish.homeRange && !SPECIAL.has(f.action)) f.dir *= -1;
  }
}
export function tickNightmares(game, dt) {
  const p = game.player;
  for (const n of game.entities.nightmares) {
    if (n.eaten) continue;
    n.prevX = n.x; n.prevY = n.y; n.stateT += dt; n.cooldown = Math.max(0, n.cooldown - dt);
    if (p.singing && distance(n, p) < game.songRadius) {
      n.calm = clamp(n.calm + T.nightmare.calmRate * dt / n.size, 0, 1); n.action = 'calming';
      if (n.calm >= 1) { n.eaten = true; const count = game.rng.int(...T.nightmare.release); game.releaseDreams(n, count); game.stats.calmed++; game.stats.nightmaresSlept++; game.seen.add('nightmare'); game.emit('nightmare.calm', { x: n.x, y: n.y, count }); }
      continue;
    }
    if (p.buffs.some(b => b.key === 'smoke') || game.targetGrace > 0) { n.action = 'wander'; drift(n, dt, T.fish.idleSpeed); continue; }
    const chain = game.entities.dreamChain.at(-1), target = chain ?? game.fish.find(f => f.kind === 'dreamfish' && !f.eaten && distance(f, n) < T.nightmare.range);
    if (target && distance(target, n) < T.nightmare.range) {
      n.action = 'chaseDream'; chase(n, target, dt, T.nightmare.speed * game.pressureConfig.nightmareSpeed);
      if (distance(target, n) < n.r && !n.cooldown) {
        if (chain) game.scatterDreams(T.chain.scatterOnHit);
        else { target.eaten = true; target.respawn = T.fish.respawn; }
        n.size = Math.min(T.nightmare.maxSize, n.size + T.chain.growth); n.cooldown = T.chain.stealCd;
      }
    } else { n.action = 'wander'; drift(n, dt, T.fish.idleSpeed); }
    game.terrain.resolve(n, n.r, 2);
  }
}
