import { PREY } from '../ocean-data.js';
import { clamp, dist } from './core.js';
import { resolveTerrain } from './reefs.js';

const COLORS = { fry: '#8bffe5', lantern: '#ffde8a', manta: '#c6a0ff', royal: '#ff9f76', abyss: '#aab0ff' };
const REST = { fry: 0, lantern: 5.6, manta: 6.8, royal: 4.9, abyss: 7.3 };

function initialAction(kind) {
  return { fry: 'school', lantern: 'pulse', manta: 'glide', royal: 'guard', abyss: 'lurk' }[kind];
}

export function createFish(kind, x, y, options = {}) {
  const phase = options.phase ?? Math.random() * Math.PI * 2;
  return {
    ...options, kind, x, y, baseX: options.baseX ?? x, baseY: options.baseY ?? y,
    homeX: options.homeX ?? x, homeY: options.homeY ?? y,
    schoolX: options.schoolX ?? Math.round(x / 105) * 105,
    schoolY: options.schoolY ?? y, member: options.member ?? 0,
    vx: 0, vy: 0, dir: options.dir ?? 1, phase, timer: options.timer ?? 0,
    action: initialAction(kind), stateT: 0, tellT: 0, pulseRadius: 0,
    glow: 0, armored: kind === 'royal', hunting: false, stun: 0,
    cooldown: 1.8 + phase * 0.5, panic: 0, armorBiteSerial: -1,
    aimX: options.dir ?? 1, aimY: 0, foodEaten: 0, ecology: true,
  };
}

function changeAction(fish, action) {
  fish.action = action;
  fish.stateT = 0;
  fish.tellT = 0;
  fish.pulseRadius = 0;
}

function skillSound(game, fish, event) {
  if (dist(game.player, fish) < 500) game.audio.fishSkill?.(fish.kind, event);
}

function beginSkill(game, fish, action, duration) {
  const claims = game.zone.fishActions ??= [];
  game.zone.fishActions = claims.filter(claim => claim.until > game.time);
  if (game.zone.fishActions.length >= 2) return false;
  game.zone.fishActions.push({ fish, until: game.time + duration });
  changeAction(fish, action);
  fish.tellT = { flash: 0.85, vortex: 0.72, charge: 0.82, suction: 0.95 }[action] ?? 0;
  const length = Math.max(1, dist(fish, game.player));
  fish.aimX = (game.player.x - fish.x) / length;
  fish.aimY = (game.player.y - fish.y) / length;
  fish.dir = fish.aimX < 0 ? -1 : 1;
  skillSound(game, fish, 'tell');
  return true;
}

function steer(fish, x, y, speed, dt, response = 4) {
  const dx = x - fish.x;
  const dy = y - fish.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const factor = 1 - Math.exp(-response * dt);
  fish.vx += (dx / length * speed - fish.vx) * factor;
  fish.vy += (dy / length * speed - fish.vy) * factor;
}

function driftHome(game, fish, speed, dt, radiusX = 72, radiusY = 28) {
  const wave = game.time * 0.68 + fish.phase;
  steer(fish, fish.homeX + Math.sin(wave) * radiusX, fish.homeY + Math.sin(wave * 0.79) * radiusY, speed, dt);
}

function nearestThreat(game, fish) {
  let threat = null;
  let closest = 126;
  if (!game.player.hidden && !game.equipment?.bait && dist(game.player, fish) < closest) {
    threat = game.player;
    closest = dist(game.player, fish);
  }
  for (const predator of game.zone.predators ?? []) {
    if (predator === fish || predator.timer || PREY[predator.kind]?.tier <= PREY[fish.kind].tier) continue;
    const separation = dist(predator, fish);
    if (separation < Math.min(closest, 150)) {
      closest = separation;
      threat = predator;
    }
  }
  return threat;
}

function flee(fish, threat, speed, dt) {
  const dx = fish.x - threat.x;
  const dy = fish.y - threat.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  steer(fish, fish.x + dx / length * 160, fish.y + dy / length * 160, speed, dt, 8);
}

function updateFry(game, fish, dt) {
  const threat = nearestThreat(game, fish);
  if (threat) {
    fish.panic = 0.85;
    fish.threatX = threat.x;
    fish.threatY = threat.y;
  }
  fish.panic = Math.max(0, fish.panic - dt);
  if (fish.panic > 0) {
    fish.action = 'flee';
    flee(fish, { x: fish.threatX, y: fish.threatY }, 123 + Math.sin(fish.phase) * 16, dt);
    fish.glow = 0.8;
    return;
  }
  fish.action = 'school';
  const wave = game.time * 0.85 + fish.schoolX * 0.007;
  const rank = fish.member;
  let x = fish.schoolX + Math.sin(wave) * 83 + (rank - 3.5) * 13;
  let y = fish.schoolY + Math.sin(wave * 0.71) * 30 + Math.sin(rank * 1.5) * 23;
  if (fish.lureUntil > game.time) {
    x = fish.lureX + Math.sin(rank + wave) * 28;
    y = fish.lureY + Math.cos(rank + wave) * 22;
    fish.glow = 0.9;
  } else {
    fish.glow = 0.35 + Math.sin(wave * 2) * 0.15;
  }
  steer(fish, x, y, 58, dt);
}

function lureFry(game, fish) {
  let attracted = 0;
  for (const prey of game.zone.things ?? []) {
    if (prey.kind !== 'fry' || prey.timer || dist(prey, fish) > 175) continue;
    prey.lureX = fish.x;
    prey.lureY = fish.y + 10;
    prey.lureUntil = game.time + 2.8;
    if (++attracted >= 7) break;
  }
}

function updateLantern(game, fish, dt, predator) {
  const danger = game.stage < PREY.lantern.tier;
  const separation = dist(game.player, fish);
  fish.glow = 0.35 + (Math.sin(game.time * 2.2 + fish.phase) + 1) * 0.27;
  if (fish.action === 'flash') {
    fish.tellT = Math.max(0, 0.85 - fish.stateT);
    fish.glow = 0.9 + Math.sin(fish.stateT * 25) * 0.1;
    fish.pulseRadius = 114 * clamp(fish.stateT / 0.85, 0, 1);
    fish.vx *= Math.exp(-7 * dt);
    fish.vy *= Math.exp(-7 * dt);
    if (fish.stateT >= 0.85) {
      skillSound(game, fish, 'release');
      game.effect(fish, { type: 'ring', radius: 114, color: COLORS.lantern, duration: 0.48 });
      lureFry(game, fish);
      if (separation < 114 && !game.player.hidden) game.hurt(danger ? 11 + Number(predator) * 5 : 4, fish, '灯笼电光');
      changeAction(fish, 'recover');
      fish.cooldown = REST.lantern;
    }
    return;
  }
  if (fish.action === 'recover') {
    fish.glow = 0.13;
    driftHome(game, fish, 28, dt);
    if (fish.stateT > 1.1) changeAction(fish, 'pulse');
    return;
  }
  fish.action = 'pulse';
  if (game.time - (fish.lastLure ?? -5) >= 4.3) {
    fish.lastLure = game.time;
    lureFry(game, fish);
  }
  if (!danger && separation < 110) flee(fish, game.player, 94, dt);
  else driftHome(game, fish, predator ? 74 : 46, dt, 88, 36);
  if (separation < 210 && !game.player.hidden && fish.cooldown <= 0) beginSkill(game, fish, 'flash', 2);
}

function updateManta(game, fish, dt, predator) {
  const player = game.player;
  const separation = dist(player, fish);
  const edible = game.stage >= PREY.manta.tier;
  if (fish.action === 'vortex') {
    fish.tellT = Math.max(0, 0.72 - fish.stateT);
    fish.pulseRadius = fish.stateT < 0.72 ? fish.stateT / 0.72 * 120 : 120;
    fish.vx *= Math.exp(-4 * dt);
    fish.vy *= Math.exp(-4 * dt);
    if (fish.stateT >= 0.72) {
      if (!fish.released) {
        fish.released = true;
        skillSound(game, fish, 'release');
        game.effect(fish, { type: 'ring', radius: 120, color: COLORS.manta, duration: 0.9 });
        if (separation < 140) {
          const dx = (player.x - fish.x) / Math.max(1, separation);
          const dy = (player.y - fish.y) / Math.max(1, separation);
          player.vx += -dy * 145;
          player.vy += dx * 145;
        }
      }
      if (separation < 140 && separation > 8) {
        const dx = (player.x - fish.x) / separation;
        const dy = (player.y - fish.y) / separation;
        player.vx += (-dy * 500 + dx * 90) * dt;
        player.vy += (dx * 500 + dy * 90) * dt;
      }
    }
    if (fish.stateT > 1.8) {
      fish.cooldown = REST.manta;
      changeAction(fish, 'glide');
    }
    return;
  }
  fish.action = edible && separation < 180 ? 'evade' : 'glide';
  fish.released = false;
  const wave = game.time * 0.68 + fish.phase;
  if (fish.action === 'evade') flee(fish, player, predator ? 270 : 242, dt);
  else steer(fish, fish.homeX + Math.sin(wave) * 190, fish.homeY + Math.sin(wave * 1.7) * 76, predator ? 126 : 102, dt, 2.3);
  fish.glow = 0.42 + Math.sin(wave * 2.7) * 0.25;
  if (separation < 240 && !player.hidden && fish.cooldown <= 0) beginSkill(game, fish, 'vortex', 2.1);
}

function rushHits(game, fish, previous, radius, amount, name) {
  const dx = fish.x - previous.x;
  const dy = fish.y - previous.y;
  const length = dx * dx + dy * dy;
  const t = length ? clamp(((game.player.x - previous.x) * dx + (game.player.y - previous.y) * dy) / length, 0, 1) : 0;
  if (Math.hypot(game.player.x - previous.x - t * dx, game.player.y - previous.y - t * dy) < radius) {
    game.hurt(amount, fish, name);
  }
}

function updateRoyal(game, fish, dt, predator) {
  const separation = dist(game.player, fish);
  fish.glow = fish.armored ? 0.4 : 0.8;
  if (fish.action === 'charge') {
    fish.armored = true;
    fish.tellT = Math.max(0, 0.82 - fish.stateT);
    fish.vx *= Math.exp(-6 * dt);
    fish.vy *= Math.exp(-6 * dt);
    if (fish.stateT >= 0.82) {
      changeAction(fish, 'rush');
      skillSound(game, fish, 'release');
    }
    return;
  }
  if (fish.action === 'rush') {
    const previous = { x: fish.x, y: fish.y };
    const speed = predator ? 510 : 435;
    fish.x += fish.aimX * speed * dt;
    fish.y += fish.aimY * speed * dt;
    resolveTerrain(fish, 31, game.reef);
    rushHits(game, fish, previous, 43, 22 + Number(predator) * 8, '赤甲撞角');
    fish.vx = fish.aimX * speed * 0.25;
    fish.vy = fish.aimY * speed * 0.25;
    if (fish.stateT >= 0.52) {
      changeAction(fish, 'recover');
      fish.armored = false;
      fish.cooldown = REST.royal;
      fish.armorBiteSerial = -1;
    }
    return;
  }
  if (fish.action === 'recover') {
    fish.armored = false;
    driftHome(game, fish, 48, dt);
    if (fish.stateT >= 2.2) {
      fish.armored = true;
      fish.armorBiteSerial = -1;
      changeAction(fish, 'guard');
    }
    return;
  }
  fish.armored = true;
  fish.action = 'guard';
  driftHome(game, fish, predator ? 85 : 55, dt, 95, 29);
  if (separation < 300 && !game.player.hidden && fish.cooldown <= 0) beginSkill(game, fish, 'charge', 3.7);
}

function pullPrey(game, fish, dt) {
  for (const prey of game.zone.things ?? []) {
    if (!PREY[prey.kind] || PREY[prey.kind].tier >= PREY.abyss.tier || prey.timer) continue;
    const separation = dist(prey, fish);
    if (separation >= 135) continue;
    if (separation < 24) {
      prey.timer = 17;
      prey.ecologyReset = true;
      fish.foodEaten = Math.min(5, fish.foodEaten + 1);
      continue;
    }
    const factor = Math.min(1, dt * 2.8);
    prey.x += (fish.x - prey.x) * factor;
    prey.y += (fish.y - prey.y) * factor;
  }
}

function updateAbyss(game, fish, dt, predator) {
  const player = game.player;
  const separation = dist(player, fish);
  fish.glow = 0.2 + (Math.sin(game.time * 2 + fish.phase) + 1) * 0.26;
  if (fish.action === 'suction') {
    fish.tellT = Math.max(0, 0.95 - fish.stateT);
    fish.pulseRadius = 180;
    fish.vx *= Math.exp(-7 * dt);
    fish.vy *= Math.exp(-7 * dt);
    if (fish.stateT >= 0.95) {
      if (!fish.released) {
        fish.released = true;
        skillSound(game, fish, 'release');
      }
      const forward = ((player.x - fish.x) * fish.aimX + (player.y - fish.y) * fish.aimY) / Math.max(1, separation);
      if (separation < 205 && forward > 0.15 && !player.hidden) {
        const pull = predator ? 1020 : 850;
        player.vx += (fish.x - player.x) / Math.max(1, separation) * pull * dt;
        player.vy += (fish.y - player.y) / Math.max(1, separation) * pull * dt;
      }
      pullPrey(game, fish, dt);
    }
    if (fish.stateT >= 1.9) {
      const length = Math.max(1, dist(fish, player));
      fish.aimX = (player.x - fish.x) / length;
      fish.aimY = (player.y - fish.y) / length;
      changeAction(fish, 'lungeTell');
      fish.tellT = 0.32;
    }
    return;
  }
  if (fish.action === 'lungeTell') {
    fish.tellT = Math.max(0, 0.32 - fish.stateT);
    if (fish.stateT >= 0.32) {
      changeAction(fish, 'lunge');
      skillSound(game, fish, 'lunge');
    }
    return;
  }
  if (fish.action === 'lunge') {
    const previous = { x: fish.x, y: fish.y };
    fish.x += fish.aimX * 520 * dt;
    fish.y += fish.aimY * 520 * dt;
    resolveTerrain(fish, 38, game.reef);
    rushHits(game, fish, previous, 48, 34 + Number(predator) * 7, '巨口吞袭');
    if (fish.stateT > 0.38) {
      changeAction(fish, 'recover');
      fish.cooldown = REST.abyss;
    }
    return;
  }
  if (fish.action === 'recover') {
    driftHome(game, fish, 55, dt, 16, 12);
    fish.glow = 0.12;
    if (fish.stateT > 2) changeAction(fish, 'lurk');
    return;
  }
  fish.action = 'lurk';
  driftHome(game, fish, 23, dt, 18, 12);
  fish.released = false;
  if (separation < 310 && !player.hidden && fish.cooldown <= 0) beginSkill(game, fish, 'suction', 4.7);
}

function contactRule(game, fish, predator) {
  const def = PREY[fish.kind];
  const edible = game.stage >= def.tier;
  const result = { edible, blocked: false, bonus: 1, label: def.name };
  if (fish.kind === 'abyss') result.bonus = 1 + fish.foodEaten * 0.12;
  if (fish.kind !== 'royal' || !edible) return result;
  const rear = (game.player.x - fish.x) * fish.dir < -10;
  if (rear || fish.stun > 0 || (fish.action === 'recover' && fish.armorBiteSerial < 0)) return result;
  const radius = predator ? 45 : 25;
  const touching = game.touches ? game.touches(fish, radius) : dist(game.player, fish) < radius + 35;
  if (fish.armored && touching && game.biting && fish.armorBiteSerial !== game.biteSerial) {
    fish.armored = false;
    fish.armorBiteSerial = game.biteSerial;
    fish.cooldown = Math.max(fish.cooldown, 2.4);
    changeAction(fish, 'recover');
    skillSound(game, fish, 'crack');
    game.effect(fish, { type: 'pop', color: '#ffd9a4', radius: 45 });
    game.effect(fish, { type: 'food', text: '破甲 · 再猛扑一次', color: '#ffe0ac' });
  }
  result.blocked = fish.armored || !game.biting || fish.armorBiteSerial === game.biteSerial;
  result.label = result.blocked ? '前甲坚硬 · 绕后或猛扑破甲' : '赤甲破防';
  return result;
}

// Root owns respawn timers and consumption. Movement and special attacks run only for nearby active entities.
export function updateFish(game, fish, dt, { predator = false } = {}) {
  if (!fish.ecology) Object.assign(fish, createFish(fish.kind, fish.x, fish.y, fish));
  if (fish.ecologyReset) {
    const options = { ...fish, phase: fish.phase, dir: fish.dir, timer: fish.timer };
    Object.assign(fish, createFish(fish.kind, fish.homeX, fish.homeY, options));
    fish.ecologyReset = false;
  }
  if (fish.timer > 0) return { edible: false, blocked: true, bonus: 1, label: '' };
  fish.stun = Math.max(0, fish.stun - dt);
  fish.cooldown = Math.max(0, fish.cooldown - dt);
  fish.stateT += dt;
  fish.tellT = 0;
  fish.pulseRadius = 0;
  fish.hunting = false;
  if (fish.stun > 0) {
    fish.action = 'stunned';
    fish.vx *= Math.exp(-7 * dt);
    fish.vy *= Math.exp(-7 * dt);
  } else {
    if (fish.action === 'stunned') {
      changeAction(fish, initialAction(fish.kind));
      fish.cooldown = Math.max(fish.cooldown, 1.2);
    }
    if (fish.kind === 'fry') updateFry(game, fish, dt);
    if (fish.kind === 'lantern') updateLantern(game, fish, dt, predator);
    if (fish.kind === 'manta') updateManta(game, fish, dt, predator);
    if (fish.kind === 'royal') updateRoyal(game, fish, dt, predator);
    if (fish.kind === 'abyss') updateAbyss(game, fish, dt, predator);
  }
  const rushing = fish.action === 'rush' || fish.action === 'lunge';
  if (!rushing) {
    fish.x += fish.vx * dt;
    fish.y += fish.vy * dt;
  }
  resolveTerrain(fish, predator ? 25 + PREY[fish.kind].tier * 5 : 12 + PREY[fish.kind].tier * 2, game.reef);
  if (!rushing && fish.tellT <= 0 && Math.abs(fish.vx) > 9) fish.dir = fish.vx < 0 ? -1 : 1;
  fish.hunting = PREY[fish.kind].tier > game.stage && ['charge', 'rush', 'suction', 'lungeTell', 'lunge'].includes(fish.action);
  return contactRule(game, fish, predator);
}
