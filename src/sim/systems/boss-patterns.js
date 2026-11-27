import { TUNING as T } from '../../data/tuning.js';
import { normalize, distance } from '../math.js';

const P = T.bossPatterns, A = T.bossAttack;
export function startYarn(game, attack) {
  const b = game.boss, direction = normalize(attack.target.x - b.x, attack.target.y - b.y);
  const ball = { id: game.nextId++, kind: 'yarnBall', x: b.x, y: b.y, prevX: b.x, prevY: b.y,
    vx: direction.x * P.yarnSpeed, vy: (direction.y || -.4) * P.yarnSpeed, r: P.yarnRadius,
    damage: attack.skill.damage, age: 0, ttl: P.yarnLifetime, bounceCount: 0, lastBounce: { x: b.x, y: b.y } };
  b.bullets.push(ball); attack.yarnId = ball.id; b.yarnCut = 0;
}

export function tickYarnBall(game, ball, dt) {
  const b = game.boss, width = game.scene.width, height = game.scene.height;
  ball.x += ball.vx * dt; ball.y += ball.vy * dt;
  let bounced = false;
  if (ball.x < ball.r || ball.x > width - ball.r) { ball.x = Math.max(ball.r, Math.min(width - ball.r, ball.x)); ball.vx *= -1; bounced = true; }
  if (ball.y < ball.r || ball.y > height - ball.r) { ball.y = Math.max(ball.r, Math.min(height - ball.r, ball.y)); ball.vy *= -1; bounced = true; }
  if (bounced) {
    ball.bounceCount++;
    b.areas.push({ id: game.nextId++, kind: 'yarn', ...ball.lastBounce, x2: ball.x, y2: ball.y,
      tellT: 0, age: 0, ttl: P.yarnLineLife, damage: ball.damage });
    ball.lastBounce = { x: ball.x, y: ball.y };
    game.emit('boss.yarn.bounce', { key: b.key, count: ball.bounceCount, x: ball.x, y: ball.y });
    if (ball.bounceCount >= (b.attack?.skill.bounces ?? A.yarnCount)) ball.ttl = 0;
  }
  if (distance(ball, game.player) < ball.r + game.player.r) game.damagePlayer(ball.damage, 'boss.yarnBall', ball);
}

export function startKo(game, attack) {
  const width = game.scene.width, height = game.scene.height, cover = attack.skill.coveredFraction ?? P.koCover;
  const sideW = width * cover / 2, sideH = height * cover / 2, interval = attack.skill.interval ?? P.koInterval;
  const rectangles = [
    { x: 0, y: 0, w: sideW, h: height, delay: 0 }, { x: width - sideW, y: 0, w: sideW, h: height, delay: 0 },
    { x: 0, y: 0, w: width, h: sideH, delay: interval }, { x: 0, y: height - sideH, w: width, h: sideH, delay: interval },
  ];
  game.boss.safeCell = { x: sideW, y: sideH, w: width - sideW * 2, h: height - sideH * 2 };
  for (const rect of rectangles) game.boss.areas.push({ id: game.nextId++, kind: 'ko', ...rect,
    tellT: rect.delay, age: 0, ttl: rect.delay + P.koImpactLife, damage: attack.skill.damage });
}

export function starWave(game, attack, count, speed) {
  const b = game.boss, safe = b.spec.arena.safePoints ?? [];
  const columns = Array.from({ length: P.starColumns }, (_, index) => game.scene.width * (index + .5) / P.starColumns)
    .filter(x => safe.every(point => Math.abs(point.x - x) > A.safeRadius * P.starMargin));
  for (let index = 0; index < count; index++) {
    const x = columns[Math.floor((index + .5) * columns.length / count)];
    b.bullets.push({ id: game.nextId++, kind: 'star', x, y: 0, prevX: x, prevY: 0, vx: 0, vy: speed,
      r: T.boss.bulletRadius, damage: attack.skill.damage, age: 0, ttl: T.boss.bulletLife });
  }
}

export function tickDarkness(game, attack, dt) {
  const b = game.boss, age = attack.age - attack.windup;
  b.x = b.home.x + Math.sin(age * P.darknessSpeed) * P.darknessSway;
  b.lampCone = { x: b.x, y: b.y, angle: -Math.PI / 2 + Math.sin(age * P.darknessSpeed) * .5,
    radius: A.lampRadius, halfAngle: P.lampHalfAngle };
  const angle = Math.atan2(game.player.y - b.y, game.player.x - b.x);
  const diff = Math.atan2(Math.sin(angle - b.lampCone.angle), Math.cos(angle - b.lampCone.angle));
  const inside = distance(b, game.player) <= A.lampRadius && Math.abs(diff) <= P.lampHalfAngle;
  attack.damageTimer = (attack.damageTimer ?? 0) + dt;
  if (!inside && !game.player.buffs.some(buff => buff.key === 'lamp') && attack.damageTimer >= P.damageInterval) {
    attack.damageTimer = 0; game.damagePlayer(attack.skill.damage, `boss.${attack.skill.key}`, b);
  }
  const warning = Math.floor(age / P.darknessShotInterval);
  if (attack.darkTell !== warning) {
    attack.darkTell = warning; attack.darkTarget = { x: game.player.x, y: game.player.y }; attack.darkFired = false;
    game.emit('boss.tell', { key: b.key, skill: 'rings', pattern: 'rings', shape: 'rings', windup: T.boss.defaultTell, x: b.x, y: b.y, audioOnly: true });
  }
  if (!attack.darkFired && age % P.darknessShotInterval >= T.boss.defaultTell) {
    attack.darkFired = true;
    const target = attack.darkTarget;
    b.bullets.push({ id: game.nextId++, kind: 'ring', x: b.x, y: b.y, prevX: b.x, prevY: b.y, radius: 0, r: 0,
      speed: T.boss.defaultSpeed, damage: attack.skill.damage, age: 0, ttl: T.boss.bulletLife,
      gap: Math.atan2(target.y - b.y, target.x - b.x), gapWidth: .55 });
    game.emit('boss.attack', { key: b.key, skill: 'rings', pattern: 'rings', x: b.x, y: b.y });
  }
}
