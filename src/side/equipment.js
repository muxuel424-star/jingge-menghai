import { PREY } from '../ocean-data.js';
import { dist } from './core.js';

export const EQUIPMENT = {
  shield: { name: '珍珠护盾', detail: '抵挡两次伤害', color: '#a2e5ff', index: 0 },
  magnet: { name: '潮汐磁铁', detail: '18 秒吸引可食猎物', color: '#81ffe2', index: 1, duration: 18 },
  sonar: { name: '回声海螺', detail: '25 秒标出宝箱和道具', color: '#d4bcff', index: 2, duration: 25 },
  haste: { name: '疾游鳍符', detail: '14 秒游速提升', color: '#ffcf84', index: 3, duration: 14 },
  bait: { name: '梦糖诱饵', detail: '16 秒聚拢小荧鱼', color: '#ffaa9c', index: 4, duration: 16 },
  heal: { name: '海葵药剂', detail: '恢复 35% 生命和 12 饱食度', color: '#a4ffc8', index: 5 },
};

export function createEquipment() {
  return { shield: 0, magnet: 0, sonar: 0, haste: 0, bait: 0 };
}

export function collectEquipment(game, item) {
  const spec = EQUIPMENT[item.kind];
  if (!spec || item.timer > 0) return false;
  item.timer = 80;
  if (spec.duration) game.equipment[item.kind] = spec.duration;
  if (item.kind === 'shield') game.equipment.shield = 2;
  if (item.kind === 'heal') {
    game.hp = Math.min(game.maxHp, game.hp + Math.ceil(game.maxHp * 0.35));
    game.hunger = Math.min(100, game.hunger + 12);
  }
  game.audio.powerup?.(item.kind);
  game.effect(item, { type: 'ring', color: spec.color, radius: 58 });
  game.effect(item, { type: 'food', color: spec.color, text: spec.name });
  game.notice(spec.name + ' · ' + spec.detail, 3);
  return true;
}

export function shieldHit(game) {
  if (!game.equipment?.shield) return false;
  game.equipment.shield--;
  game.player.invuln = 0.85;
  game.audio.powerup?.('shieldBlock');
  game.effect(game.player, { type: 'ring', color: '#bcf0ff', radius: 86 });
  game.notice('护盾抵挡伤害 · 剩余 ' + game.equipment.shield + ' 次', 2.2);
  return true;
}

export function updateEquipment(game, dt) {
  for (const kind of ['magnet', 'sonar', 'haste', 'bait']) {
    game.equipment[kind] = Math.max(0, game.equipment[kind] - dt);
  }
  const p = game.player;
  for (const fish of game.zone.things) {
    const def = PREY[fish.kind];
    if (!def || fish.timer || Math.abs(p.x - fish.x) > 310) continue;
    const separation = dist(p, fish);
    if (game.equipment.bait && fish.kind === 'fry' && separation < 300) {
      fish.lureX = p.x - p.dir * 54;
      fish.lureY = p.y + Math.sin(game.time * 3) * 15;
      fish.lureUntil = game.time + 0.5;
    }
    if (game.equipment.magnet && def.tier <= game.stage && !fish.armored && separation < 192) {
      const factor = Math.min(1, dt * 3.8);
      fish.x += (p.x - fish.x) * factor;
      fish.y += (p.y - fish.y) * factor;
      fish.vx += (p.x - fish.x) * dt * 4;
      fish.vy += (p.y - fish.y) * dt * 4;
    }
  }
}

export function equipmentText(game) {
  const texts = [];
  for (const [kind, value] of Object.entries(game.equipment)) {
    if (value > 0) texts.push(EQUIPMENT[kind].name + (kind === 'shield' ? ' ×' + value : ' ' + Math.ceil(value) + '秒'));
  }
  return texts.join(' · ');
}
