import { TUNING as T } from '../../data/tuning.js';
import { distance, normalize, pointSegmentDistance } from '../math.js';
const atPhase = (value, phase) => Array.isArray(value) ? value[phase - 1] : value;
const A = T.bossAttack;
export function beginAttack(game, skill) {
  const b = game.boss;
  const windup = Math.max(A.minTell, skill.tell - (b.phase === 3 ? A.phase3TellReduction : 0));
  b.attack = { skill, age: 0, windup, fired: false, target: { x: game.player.x, y: game.player.y }, lastWave: -1 };
  b.state = 'tell'; b.tell = windup;
  game.emit('boss.tell', { key: b.key, skill: skill.key, pattern: skill.pattern, shape: skill.tellShape, windup, x: b.x, y: b.y, target: b.attack.target });
}
function bullet(game, x, y, angle, speed, damage, extra = {}) {
  game.boss.bullets.push({ id: game.nextId++, kind: 'bullet', x, y, prevX: x, prevY: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: T.boss.bulletRadius, damage, age: 0, ttl: T.boss.bulletLife, ...extra });
}
function waves(game, attack, t) {
  const b = game.boss, s = attack.skill, count = atPhase(s.count, b.phase) ?? A.defaultCount;
  const waveCount = atPhase(s.waves, b.phase) ?? (s.pattern === 'rings' ? count : 1);
  const wave = Math.floor(t / (s.interval ?? A.waveInterval));
  if (wave <= attack.lastWave || wave >= waveCount) return;
  attack.lastWave = wave;
  const angle = Math.atan2(attack.target.y - b.y, attack.target.x - b.x), speed = atPhase(s.speed, b.phase) ?? T.boss.defaultSpeed;
  if (s.pattern === 'rings') {
    b.bullets.push({ id: game.nextId++, kind: 'ring', x: b.x, y: b.y, prevX: b.x, prevY: b.y, r: 0, radius: 0, speed, damage: s.damage, age: 0, ttl: T.boss.bulletLife, gap: angle + Math.PI / 2, gapWidth: .55 });
  } else if (['fan','boomerang','tracking'].includes(s.pattern)) {
    for (let i = 0; i < count; i++) bullet(game, b.x, b.y, angle + (i - (count - 1) / 2) * A.fanSpread, speed, s.damage, { boomerang: s.pattern === 'boomerang', tracking: s.pattern === 'tracking', returnAt: s.returnAt ?? A.boomerangReturn });
  } else if (s.pattern === 'grid') {
    for (let i = 0; i < count; i++) { bullet(game, game.scene.width * (i + .5) / count, 0, Math.PI / 2, speed, s.damage); bullet(game, 0, game.scene.height * (i + .5) / count, 0, speed, s.damage); }
  } else if (s.pattern === 'falling') {
    for (let i = 0; i < count; i++) bullet(game, Math.max(40, Math.min(game.scene.width - 40, attack.target.x + (i - count / 2) * 100)), 0, Math.PI / 2, speed, s.damage);
  }
}
export function tickAttack(game, dt) {
  const b = game.boss, a = b.attack;
  if (!a) return;
  a.age += dt; b.tell = Math.max(0, a.windup - a.age);
  if (b.tell > 0) return;
  const s = a.skill, t = a.age - a.windup, count = atPhase(s.count, b.phase) ?? A.defaultWaves;
  if (!a.fired) {
    a.fired = true; b.state = 'attack'; game.emit('boss.attack', { key: b.key, skill: s.key, pattern: s.pattern, x: b.x, y: b.y });
    if (s.pattern === 'ambush') { b.hidden = s.hidden ?? A.ambushHidden; b.x = game.player.x - game.player.dir * A.ambushOffset; b.y = game.player.y; a.target = { x: game.player.x, y: game.player.y }; }
    if (['markers','doubleMarkers'].includes(s.pattern)) {
      for (let i = 0; i < count; i++) b.areas.push({ id: game.nextId++, kind: 'marker', x: a.target.x + Math.cos(i * A.markerAngle) * i * A.markerSpread, y: a.target.y + Math.sin(i * A.markerAngle) * i * A.markerSpread, r: A.markerRadius, tellT: A.markerTell + i * (s.interval ?? 0), age: 0, ttl: A.markerLife + i * (s.interval ?? 0), damage: s.damage });
    }
    if (s.pattern === 'yarn') {
      for (let i = 0; i < A.yarnCount; i++) b.areas.push({ id: game.nextId++, kind: 'yarn', x: A.yarnSpacing + i * A.yarnSpacing, y: 80, x2: 180 + i * A.yarnSpacing, y2: game.scene.height - 50, tellT: A.markerTell, age: 0, ttl: A.yarnLife, damage: s.damage });
      b.yarnCut = 0;
    }
  }
  let duration = s.duration ?? A.defaultDuration;
  if (['dash','ambush'].includes(s.pattern)) {
    const segmentDuration = s.duration ?? s.interval ?? A.dashDuration, segment = Math.floor(t / segmentDuration);
    duration = segmentDuration * (s.pattern === 'ambush' ? 1 : count);
    if (a.segment !== segment) { a.segment = segment; a.direction = normalize(game.player.x - b.x, game.player.y - b.y); }
    const speed = atPhase(s.speed, b.phase) ?? A.dashSpeed;
    b.vx = a.direction.x * speed; b.vy = a.direction.y * speed;
    b.x += b.vx * dt; b.y += b.vy * dt; game.terrain.resolve(b, b.r, 2);
    if (distance(b, game.player) < b.r + game.player.r) game.damagePlayer(s.damage, `boss.${s.key}`, b);
  } else if (['fan','rings','boomerang','grid','falling','tracking'].includes(s.pattern)) {
    waves(game, a, t); duration = (atPhase(s.waves, b.phase) ?? count) * (s.interval ?? A.waveInterval) + A.waveTail;
  } else if (s.pattern === 'sweep') {
    if (distance(b, game.player) < (s.radius ?? A.ambushOffset) && game.player.y >= b.y - A.sweepUpperMargin) game.damagePlayer(s.damage, `boss.${s.key}`, b);
    duration = A.sweepDuration;
  } else if (['rain','coverRain','coverShock'].includes(s.pattern)) {
    const safe = (b.spec.arena.safePoints ?? []).some(p => distance(p, game.player) < A.safeRadius);
    const covered = (b.spec.arena.cover ?? []).some(c => Math.abs(game.player.x - c.x) < (c.w ?? c.rx ?? 80) && game.player.y > c.y);
    if (!safe && !covered) game.damagePlayer(s.damage, `boss.${s.key}`, b);
    duration = s.duration ?? A.rainDuration;
  } else if (s.pattern === 'halfRain') {
    if (game.player.x > game.scene.width / 2) game.damagePlayer(s.damage * dt, `boss.${s.key}`, b);
    duration = s.duration ?? A.halfRainDuration;
  } else if (s.pattern === 'darkness') {
    b.darkness = true;
    if (distance(b, game.player) > A.lampRadius && !game.player.buffs.some(buff => buff.key === 'lamp')) game.damagePlayer(s.damage, `boss.${s.key}`, b);
    duration = s.duration ?? A.darknessDuration;
  }
  if (t >= duration) { b.attack = null; b.darkness = false; b.vx = 0; b.vy = 0; b.recovery = Math.max(A.recoveryMin, (s.recovery ?? T.boss.defaultRecovery) - (b.phase === 3 ? A.phase3RecoveryReduction : 0)); b.state = 'recover'; b.attacksDone++; }
}
export function tickProjectiles(game, dt) {
  const b = game.boss, p = game.player;
  for (const shot of b.bullets) {
    shot.prevX = shot.x; shot.prevY = shot.y; shot.age += dt;
    if (shot.kind === 'ring') {
      shot.radius += shot.speed * dt; shot.r = shot.radius;
      const angle = Math.atan2(p.y - shot.y, p.x - shot.x), diff = Math.atan2(Math.sin(angle - shot.gap), Math.cos(angle - shot.gap));
      if (Math.abs(distance(shot, p) - shot.radius) < p.r + T.boss.bulletRadius && Math.abs(diff) > shot.gapWidth) game.damagePlayer(shot.damage, 'boss.ring', shot);
    } else {
      if (shot.boomerang && shot.age > shot.returnAt && !shot.turned) { shot.vx *= -1; shot.vy *= -1; shot.turned = true; }
      if (shot.tracking) { const n = normalize(p.x - shot.x, p.y - shot.y); shot.vx += n.x * A.trackingAcceleration * dt; shot.vy += n.y * A.trackingAcceleration * dt; }
      shot.x += shot.vx * dt; shot.y += shot.vy * dt;
      if (game.terrain.contains(shot.x, shot.y, 0, 2)) shot.ttl = 0;
      if (distance(shot, p) < shot.r + p.r) { game.damagePlayer(shot.damage, 'boss.bullet', shot); shot.ttl = 0; }
    }
  }
  b.bullets = b.bullets.filter(shot => shot.age < shot.ttl);
  for (const area of b.areas) {
    area.age += dt; area.tellT = Math.max(0, area.tellT - dt);
    if (area.kind === 'yarn') {
      const near = pointSegmentDistance(p, area, { x: area.x2, y: area.y2 }) < p.r;
      if (near && p.biteWindow > 0) { area.ttl = 0; b.yarnCut++; if (b.yarnCut >= (b.spec.skills.find(s => s.pattern === 'yarn')?.cutLinesToStun ?? 3)) { b.stun = A.yarnStun; b.gateOpen = A.yarnStun; b.attack = null; } }
      else if (near && !area.tellT) game.damagePlayer(area.damage, 'boss.yarn', area);
    } else if (!area.tellT && distance(area, p) < area.r + p.r) game.damagePlayer(area.damage, 'boss.marker', area);
  }
  b.areas = b.areas.filter(area => area.age < area.ttl);
}
