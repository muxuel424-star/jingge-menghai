import { clamp, dist, moveToward } from './core.js';
import { floorAt, roofAt, resolveTerrain } from './reefs.js';

const HEALTH = [390, 790, 1150, 1580, 2300];
const COLORS = { plate: '#a4e8ff', stone: '#fff1d5', wave: '#ffbc7e', ambush: '#eeb6ff' };
const PATTERNS = {
  grok: [
    { skill: 'dash', title: '三连猎袭', windup: 0.86, rushes: 3, speed: 610, recovery: 1.8 },
    { skill: 'wave', title: '深红震潮', windup: 0.8, rings: 2, speed: 245, recovery: 1.7 },
    { skill: 'plates', title: '扇形鳍刃', windup: 0.7, volleys: 2, count: 3, spread: 0.29, speed: 260, recovery: 1.7 },
  ],
  qwen: [
    { skill: 'plates', title: '青花五连盘', windup: 0.78, volleys: 3, count: 5, spread: 0.22, speed: 260, recovery: 1.9 },
    { skill: 'plates', title: '回旋瓷刃', windup: 0.95, volleys: 2, count: 3, spread: 0.45, speed: 275, returning: true, recovery: 2.0 },
    { skill: 'wave', title: '碎瓷潮环', windup: 0.82, rings: 3, speed: 250, recovery: 1.85 },
  ],
  gemini: [
    { skill: 'ambush', title: '幽影三重袭', windup: 0.88, marks: 3, recovery: 1.8 },
    { skill: 'dash', title: '月影折返', windup: 0.72, rushes: 2, speed: 690, recovery: 1.65 },
    { skill: 'plates', title: '紫月散射', windup: 0.74, volleys: 3, count: 5, spread: 0.28, speed: 295, recovery: 1.8 },
  ],
  zhipu: [
    { skill: 'stones', title: '黑白封路', windup: 0.92, volleys: 2, count: 5, speed: 350, recovery: 1.8 },
    { skill: 'wave', title: '星位震荡', windup: 0.88, rings: 3, speed: 275, recovery: 1.75 },
    { skill: 'stones', title: '追子连落', windup: 0.72, volleys: 4, count: 3, speed: 395, recovery: 2.0 },
  ],
  claude: [
    { skill: 'wave', title: '第一乐章 · 环潮', windup: 0.82, rings: 3, speed: 290, recovery: 1.7 },
    { skill: 'plates', title: '第二乐章 · 织网', windup: 0.8, volleys: 4, count: 5, spread: 0.24, speed: 315, recovery: 1.75 },
    { skill: 'dash', title: '第三乐章 · 鲸袭', windup: 0.77, rushes: 3, speed: 740, recovery: 1.8 },
    { skill: 'stones', title: '终乐章 · 星落', windup: 0.9, volleys: 3, count: 5, speed: 420, recovery: 1.9 },
  ],
};

export function createBoss(def, position) {
  const home = Array.isArray(position) ? { x: position[0], y: position[1] } : position;
  const maxHp = HEALTH[def.mapIdx];
  return {
    ...home, home: { ...home }, def, hp: maxHp, maxHp, dir: -1,
    timer: 0.95, stun: 0, resist: 0, invuln: 0, recovery: 0, engaged: false,
    attack: null, phase: 1, sequence: 0, lastBiteSerial: -1, lost: 0,
  };
}

function direction(from, to) {
  const length = Math.max(1, dist(from, to));
  return { dx: (to.x - from.x) / length, dy: (to.y - from.y) / length };
}

function segmentDistance(from, to, point) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  const fraction = lengthSquared ? clamp(((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared, 0, 1) : 0;
  return Math.hypot(point.x - from.x - dx * fraction, point.y - from.y - dy * fraction);
}

function addHazard(game, kind, position, options = {}) {
  if (game.hazards.length >= 64) return;
  game.hazards.push({ kind, x: position.x, y: position.y, vx: 0, vy: 0,
    age: 0, life: 3.1, radius: 15, delay: 0, color: COLORS[kind], ...options });
}

function endAttack(boss) {
  const recovery = boss.attack.recovery;
  boss.attack = null;
  boss.recovery = recovery;
  boss.timer = 0.6;
}

function prepareAttack(game, boss) {
  const pool = PATTERNS[boss.def.key];
  const pattern = pool[boss.sequence++ % pool.length];
  const target = game.player;
  const phaseBonus = boss.phase - 1;
  const aim = direction(boss, target);
  boss.attack = {
    ...pattern, age: 0, fired: 0, step: 0, x: target.x, y: target.y,
    ...aim, originX: boss.x, originY: boss.y,
    windup: Math.max(0.58, pattern.windup - phaseBonus * 0.07),
    recovery: Math.max(1.25, pattern.recovery - phaseBonus * 0.16),
    volleys: (pattern.volleys ?? 0) + phaseBonus,
    rushes: (pattern.rushes ?? 0) + (phaseBonus && pattern.skill === 'dash' ? 1 : 0),
    rings: (pattern.rings ?? 0) + phaseBonus,
  };
  boss.dir = aim.dx < 0 ? -1 : 1;
  if (pattern.skill === 'ambush') {
    boss.attack.marks = Array.from({ length: pattern.marks + phaseBonus }, (_, index) => ({
      x: clamp(target.x + (index - 1) * 112, 70, game.reef.width - 70),
      y: clamp(target.y + (index % 2 ? -72 : 15), roofAt(target.x, game.reef) + 50, floorAt(target.x, game.reef) - 50),
    }));
  }
  game.audio.bossTell?.(boss.def.key, pattern.skill);
}

function firePlates(game, boss, attack) {
  const angle = Math.atan2(attack.dy, attack.dx);
  const stagger = attack.fired % 2 ? attack.spread * 0.45 : 0;
  const speed = attack.speed + (boss.phase - 1) * 28;
  for (let index = 0; index < attack.count; index++) {
    const heading = angle + (index - (attack.count - 1) / 2) * attack.spread + stagger;
    addHazard(game, 'plate', boss, {
      vx: Math.cos(heading) * speed,
      vy: Math.sin(heading) * speed,
      radius: 13 + game.map, returning: attack.returning,
    });
  }
}

function fireStones(game, boss, attack) {
  const alternating = attack.fired % 2 ? 58 : -18;
  for (let index = 0; index < attack.count; index++) {
    const x = clamp(attack.x + (index - (attack.count - 1) / 2) * 111 + alternating, 70, game.reef.width - 70);
    const targetY = clamp(attack.y + (index % 2 ? 64 : -35), roofAt(x, game.reef) + 70, floorAt(x, game.reef) - 40);
    addHazard(game, 'stone', { x, y: Math.max(roofAt(x, game.reef) + 26, targetY - 190) }, {
      vy: attack.speed + (boss.phase - 1) * 30,
      radius: 20, delay: 0.68, targetY, life: 2.0,
    });
  }
}

function runRush(game, boss, attack, dt) {
  const elapsed = attack.age - attack.windup;
  const beatLength = 0.62;
  const step = Math.floor(elapsed / beatLength);
  const beatTime = elapsed - step * beatLength;
  if (step >= attack.rushes) { endAttack(boss); return; }
  // Every follow-up lunge visibly winds up before its direction is locked.
  if (step > attack.step) {
    attack.step = step;
    attack.x = game.player.x;
    attack.y = game.player.y;
    Object.assign(attack, direction(boss, game.player));
    boss.dir = attack.dx < 0 ? -1 : 1;
    attack.originX = boss.x;
    attack.originY = boss.y;
  }
  if (beatTime < 0.25) return;
  if (attack.soundedStep !== step) {
    attack.soundedStep = step;
    game.audio.bossAttack?.(boss.def.key, 'dash');
  }
  const previous = { x: boss.x, y: boss.y };
  const speed = attack.speed + (boss.phase - 1) * 40;
  boss.x += attack.dx * speed * dt;
  boss.y += attack.dy * speed * dt;
  resolveTerrain(boss, 34, game.reef);
  if (segmentDistance(previous, boss, game.player) < 42 + game.map * 3) {
    game.hurt(22 + game.map * 6, boss, attack.title);
  }
}

function runAttack(game, boss, dt) {
  const attack = boss.attack;
  attack.age += dt;
  if (attack.age < attack.windup) return;
  if (attack.skill === 'dash') { runRush(game, boss, attack, dt); return; }
  const elapsed = attack.age - attack.windup;
  const interval = attack.skill === 'wave' ? 0.72 : attack.skill === 'stones' ? 0.66 : 0.43;
  const count = attack.skill === 'wave' ? attack.rings : attack.skill === 'ambush' ? 1 : attack.volleys;
  if (attack.fired < count && elapsed >= attack.fired * interval) {
    game.audio.bossAttack?.(boss.def.key, attack.skill);
    if (attack.skill === 'plates') firePlates(game, boss, attack);
    if (attack.skill === 'stones') fireStones(game, boss, attack);
    if (attack.skill === 'wave') {
      addHazard(game, 'wave', boss, { radius: 32, speed: attack.speed, life: 2.45 });
    }
    if (attack.skill === 'ambush') {
      for (const mark of attack.marks) addHazard(game, 'ambush', mark, { radius: 50, delay: 0.22, life: 0.75 });
      const last = attack.marks.at(-1);
      boss.x = last.x - 65;
      boss.y = last.y;
      resolveTerrain(boss, 34, game.reef);
    }
    attack.fired++;
  }
  if (attack.fired >= count && elapsed > (count - 1) * interval + 0.42) endAttack(boss);
}

function updateHazards(game, dt) {
  const player = game.player;
  const boss = game.zone.boss;
  for (const hazard of game.hazards) {
    hazard.age += dt;
    if (hazard.age < hazard.delay) continue;
    const previous = { x: hazard.x, y: hazard.y };
    const previousRadius = hazard.radius;
    if (hazard.returning && hazard.age > 1.06 && !hazard.returned) {
      hazard.vx *= -1.12;
      hazard.vy *= -1.12;
      hazard.returned = true;
    }
    hazard.x += hazard.vx * dt;
    hazard.y += hazard.vy * dt;
    if (hazard.kind === 'wave') hazard.radius += dt * hazard.speed;
    const distance = dist(hazard, player);
    const hit = hazard.kind === 'wave'
      ? distance >= previousRadius - 25 && distance <= hazard.radius + 25
      : segmentDistance(previous, hazard, player) < hazard.radius + 20;
    if (hit) game.hurt(18 + game.map * 5 + (boss.phase - 1) * 3, hazard, boss.def.name);
  }
  game.hazards = game.hazards.filter(hazard => hazard.age < hazard.life
    && hazard.y < game.reef.bounds + 80 && hazard.y > -150
    && hazard.x > -120 && hazard.x < game.reef.width + 120);
}

function defeatBoss(game, boss) {
  game.audio.bossDown?.(boss.def.key);
  boss.attack = null;
  boss.recovery = 0;
  boss.engaged = false;
  game.hazards = [];
  game.stats.rivals++;
  game.stats.downs[boss.def.key] = 1;
  game.clearedMaps.add(game.map);
  game.pearls += 8 + game.map * 5;
  game.eat(70 + game.map * 26, 45, boss, '#ffdd83', '首领战利品');
  game.effect(boss, { type: 'ring', color: '#ffe2a0', radius: 160, duration: 1.2 });
  game.notice(boss.def.name + '被击败 · 珍珠 +' + (8 + game.map * 5));
  if (boss.def.boss) {
    game.won = true;
    game.finish('win');
  }
}

function biteBoss(game, boss) {
  const player = game.player;
  if (!game.biting || boss.lastBiteSerial === game.biteSerial || boss.invuln > 0) return;
  const facingTarget = (boss.x - player.x) * player.dir > -12;
  if (!facingTarget || !game.touches(boss, 32 + game.map * 3)) return;
  boss.lastBiteSerial = game.biteSerial;
  const behind = (player.x - boss.x) * boss.dir < -22;
  const opportunity = boss.recovery > 0 || boss.stun > 0 || (!boss.attack && behind);
  if (game.stage < boss.def.tier) {
    game.notice('体型不足 · 进化到第 ' + (boss.def.tier + 1) + ' 阶再挑战', 2.0);
    return;
  }
  if (!opportunity) {
    game.effect(boss, { type: 'food', text: '护甲格挡 · 等待破绽', color: '#ced5ed' });
    boss.invuln = 0.18;
    return;
  }
  const damage = Math.round((19 + game.stage * 10) * (behind ? 1.4 : 1) * (game.frenzyT > 0 ? 1.25 : 1));
  boss.hp = Math.max(0, boss.hp - damage);
  boss.invuln = 0.32;
  boss.x += Math.sign(boss.x - player.x || player.dir) * 11;
  game.biteFlash = 0.23;
  game.shake = Math.max(game.shake, 5.2);
  game.audio.bossHurt?.(boss.def.key);
  game.effect(boss, { type: 'pop', radius: 43, color: '#ffe099' });
  game.effect(boss, { type: 'food', text: (behind ? '背袭 ' : '') + '−' + damage, color: '#ffe5a2' });
  if (!boss.hp) defeatBoss(game, boss);
}

export function updateBoss(game, dt) {
  const boss = game.zone.boss;
  if (!boss.hp || game.ended) return;
  updateHazards(game, dt);
  if (game.ended) return;
  boss.invuln = Math.max(0, boss.invuln - dt);
  boss.stun = Math.max(0, boss.stun - dt);
  boss.resist = Math.max(0, boss.resist - dt);
  boss.recovery = Math.max(0, boss.recovery - dt);
  const player = game.player;
  const distance = dist(player, boss);
  const leash = dist(player, boss.home);
  if (distance < 625 && !player.hidden && leash < 1100) boss.engaged = true;
  if ((distance > 940 || player.hidden || leash > 1250) && boss.engaged) boss.lost += dt;
  else boss.lost = 0;
  if (boss.lost > 4.5) {
    boss.engaged = false;
    boss.attack = null;
    boss.recovery = 0;
    game.hazards = [];
  }
  const phase = boss.hp <= boss.maxHp * 0.25 && boss.def.boss ? 3 : boss.hp < boss.maxHp * 0.5 ? 2 : 1;
  if (phase > boss.phase) {
    boss.phase = phase;
    game.audio.bossPhase?.(boss.def.key, phase);
    boss.attack = null;
    boss.stun = 0;
    boss.recovery = 0;
    boss.resist = 4;
    boss.timer = 0.6;
    game.notice(boss.def.name + (phase === 3 ? '进入终乐章 · 警惕连续追击' : '进入狂暴阶段 · 攻势加快'));
    game.effect(boss, { type: 'ring', color: '#ff8b91', radius: 105, duration: 0.8 });
  }
  if (!boss.engaged) {
    moveToward(boss, boss.home, 112, dt);
    boss.timer = 0.95;
  } else if (!boss.stun && !boss.recovery) {
    if (boss.attack) runAttack(game, boss, dt);
    else {
      // Near the player she turns slowly, leaving a flank for a deliberate dash.
      if (distance > 145) moveToward(boss, player, 100 + game.map * 14, dt);
      else if ((boss.timer -= dt) < 0.4) boss.dir = player.x < boss.x ? -1 : 1;
      if (distance >= 145) boss.timer -= dt;
      if (boss.timer <= 0 && distance < 560) prepareAttack(game, boss);
    }
  }
  boss.x = clamp(boss.x, 80, game.reef.width - 80);
  boss.y = clamp(boss.y, roofAt(boss.x, game.reef) + 36, floorAt(boss.x, game.reef) - 36);
  resolveTerrain(boss, 34, game.reef);
  biteBoss(game, boss);
  if (!boss.hp || game.ended) return;
  if (boss.engaged && !boss.stun && !boss.recovery && dist(boss, player) < 40 + game.map * 3) {
    game.hurt(14 + game.map * 5, boss, boss.def.name);
  }
}

export function singAtBoss(game, quality, reach) {
  const boss = game.zone.boss;
  if (!boss.hp || dist(boss, game.player) > reach + 32) return false;
  if (boss.resist > 0) {
    game.notice('首领正在抵抗鲸歌 · 等待招式结束后的破绽', 2.4);
    return false;
  }
  const interrupted = boss.attack !== null;
  if (interrupted) game.stats.interrupts++;
  boss.attack = null;
  boss.recovery = 0;
  boss.timer = 0.75;
  boss.stun = Math.min(2.4, game.mod.stun * (quality > 1 ? 0.76 : quality === 1 ? 0.52 : 0.29));
  boss.resist = 7.2 + game.map * 0.6;
  boss.engaged = true;
  game.stats.stuns++;
  game.notice(boss.def.name + (game.stage < boss.def.tier ? '暂时失衡 · 趁机撤离' : '露出破绽 · 猛扑背部'));
  return true;
}

export function bossStatus(game) {
  const boss = game.zone.boss;
  if (!boss.hp) return '已击败';
  if (game.stage < boss.def.tier) return '体型不足 · 需第 ' + (boss.def.tier + 1) + ' 阶';
  if (boss.stun > 0) return '鲸歌失衡 · 猛扑背部';
  if (boss.recovery > 0) return '破绽 ' + boss.recovery.toFixed(1) + ' 秒 · 猛扑';
  if (boss.attack) return boss.attack.title + (boss.attack.age < boss.attack.windup ? ' · 即将发动' : ' · 躲避');
  return boss.phase > 1 ? '狂暴阶段 · 绕后等待破绽' : '绕到背部 · 留意攻击预警';
}
