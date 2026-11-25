import { MAPS, PREY, RIVALS, STAGES } from '../ocean-data.js';
import { Dive, clamp, dist, moveToward, rand } from './core.js';
import { REEFS, floorAt, roofAt } from './reefs.js';

const CHARGE = 0.9;
const COMBO_TIME = 2.8;
const PALETTES = ['#68f4dd', '#ffc472', '#d8a0ff', '#ff886b'];
const BITE_TIME = 0.39;
const HAZARD_COLORS = { plate: '#a4e8ff', stone: '#eafff7', wave: '#ffbc7e', ambush: '#f2b6ff' };

export class HuntDive extends Dive {
  constructor(audio, meta, onEnd) {
    super(audio, onEnd);
    this.meta = meta;
  }

  start() {
    super.reset();
    this.meta.beginRun();
    this.mod = this.meta.mods;
    this.stage = this.xp = this.score = this.pearls = 0;
    this.won = false;
    this.hunger = 62;
    this.hp = this.maxHp = STAGES[0].hp * this.mod.hp;
    this.player.speed = this.mod.speed;
    this.combo = this.comboT = this.frenzy = this.frenzyT = 0;
    this.biteCd = this.biteFlash = this.songCd = this.songCharge = this.transition = 0;
    this.charging = this.singHeld = this.biteHeld = false;
    this.hazards = [];
    this.locations = [];
    this.visitedMaps = new Set();
    this.clearedMaps = new Set();
    this.stats = { eaten: 0, rivals: 0, maxCombo: 0, bites: 0, crystals: 0, chests: 0,
      interrupts: 0, clams: 0, gold: 0, rings: 0, geysers: 0, salary: 0, stuns: 0, frenzies: 0,
      kind: { fry: 0, lantern: 0, manta: 0, royal: 0 }, downs: {} };
    this.enter(0);
  }

  buildMap(index) {
    const reef = REEFS[index];
    const things = [];
    const point = ([x, y]) => ({ x, y });
    const swimY = (x, y) => clamp(y, roofAt(x, reef) + 36, floorAt(x, reef) - 36);
    const put = (kind, x, y, extras = {}) => things.push({ kind, x, y, timer: 0, ...extras });
    for (const shoal of reef.shoals) {
      for (let j = 0; j < shoal.count; j++) {
        const x = shoal.x + j * 13 - (shoal.count - 1) * 6;
        const y = swimY(x, shoal.y + Math.sin(j * 1.55) * 27 + rand(-7, 7));
        put(shoal.kind, x, y, { baseX: x, baseY: y, phase: rand(0, 6.28), dir: 1 });
      }
    }
    const seabedItems = [
      ['clam', reef.clams, 24], ['crystal', reef.crystals, 29], ['chest', reef.chests, 24],
      ['urchin', reef.urchins, 32], ['geyser', reef.jets, 0],
    ];
    for (const [kind, positions, offset] of seabedItems) {
      for (const x of positions) put(kind, x, floorAt(x, reef) - offset);
    }
    for (const [x, y, dx, dy] of reef.currents) put('current', x, y, { dx, dy });
    for (const [x, y] of reef.jellies ?? []) put('jelly', x, y, { phase: rand(0, 6.28) });
    put('salary', ...reef.salary);
    const def = RIVALS[index];
    return {
      things,
      altars: reef.altars.map(position => ({ ...point(position), lit: false })),
      back: point(reef.back),
      gate: point(reef.gate),
      key: null,
      unlocked: false,
      boss: { ...point(reef.boss), hp: def.hp, def, timer: 0, stun: 0, invuln: 0, dir: -1, attack: null, phase: 0 },
    };
  }

  enter(index, direction = 1) {
    this.map = index;
    this.reef = REEFS[index];
    this.zone = this.locations[index] ??= this.buildMap(index);
    this.visitedMaps.add(index);
    const [x, y] = direction < 0 ? [this.reef.gate[0] - 140, this.reef.gate[1]] : this.reef.spawn;
    Object.assign(this.player, { x, y, vx: 0, vy: 0, dir: direction });
    this.zone.boss.attack = null;
    this.zone.boss.timer = 1.2;
    this.hazards = [];
    this.effects = [];
    this.transition = 1.3;
    this.notice(MAPS[index].short + ' · ' + this.reef.flavor, 4.2);
  }

  get missionStats() {
    const { stats } = this;
    return { ...stats, time: this.time, stage: this.stage, score: this.score,
      cleanStage: stats.bites ? 0 : this.stage, win: this.won ? 1 : 0 };
  }

  eat(xp, food, target, color, label = '') {
    this.combo++;
    this.comboT = COMBO_TIME;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
    const multiplier = Math.min(4, 1 + Math.floor(this.combo / 4) * 0.25) * (this.frenzyT > 0 ? 2 : 1);
    this.score += Math.round(xp * 10 * multiplier);
    this.xp += xp;
    this.hunger = Math.min(100, this.hunger + food);
    this.hp = Math.min(this.maxHp, this.hp + Math.ceil(food * 0.18));
    this.stats.eaten++;
    this.effect(target, { type: 'food', text: label ? label + ' +' + food : '+' + food, color });
    this.effect(target, { type: 'pop', color, radius: 20 });
    this.biteFlash = 0.23;
    this.shake = Math.max(this.shake, food >= 15 ? 3 : 1.4);
    if (this.combo % 3 === 1) this.audio.combo(this.combo);
    if (this.frenzyT <= 0) {
      this.frenzy += xp * 1.6 + 2.5;
      if (this.frenzy >= 100) {
        this.frenzy = 100;
        this.frenzyT = 9;
        this.stats.frenzies++;
        this.notice('狂食觉醒 · 9 秒无敌，分数翻倍');
        this.audio.win();
      }
    }
    const next = STAGES[this.stage + 1];
    if (next && this.xp >= next.xp) {
      this.stage++;
      this.maxHp = next.hp * this.mod.hp;
      this.hp = this.maxHp;
      this.player.size = next.size;
      this.player.speed = next.speed * this.mod.speed;
      this.audio.purify();
      this.notice('进化 · ' + next.name);
      this.effect(this.player, { type: 'ring', color: '#ffdf8e', radius: 104 });
    }
  }

  settleCombo() {
    this.pearls += Math.floor(this.combo / 10);
    this.combo = 0;
    this.comboT = 0;
  }

  hurt(amount, target, name) {
    const p = this.player;
    if (p.invuln > 0 || this.frenzyT > 0 || this.ended) return false;
    this.hp = Math.max(0, this.hp - amount);
    p.invuln = 1;
    p.vx = Math.sign(p.x - target.x || -p.dir) * 230;
    p.vy = -65;
    this.stats.bites++;
    this.shake = 8;
    this.damage = 1;
    this.settleCombo();
    this.audio.hit();
    this.effect(p, { type: 'food', text: '生命 −' + amount, color: '#ffa6a5' });
    if (this.hp <= 0) this.finish('rival', name);
    return true;
  }

  update(dt, input) {
    this.updateMovement(dt, input, this.charging);
    this.transition = Math.max(0, this.transition - dt);
    this.biteCd = Math.max(0, this.biteCd - dt);
    this.biteFlash = Math.max(0, this.biteFlash - dt);
    this.songCd = Math.max(0, this.songCd - dt);
    if (this.combo > 0 && (this.comboT -= dt) <= 0) this.settleCombo();
    if (this.frenzyT > 0 && (this.frenzyT -= dt) <= 0) this.frenzy = 0;
    this.hunger = Math.max(0, this.hunger - (1.2 + this.stage * 0.25) * this.mod.hunger * dt);
    if (this.hunger <= 0) this.hp = Math.max(0, this.hp - 5.5 * dt);
    else if (this.hunger > 55) this.hp = Math.min(this.maxHp, this.hp + 3.5 * dt);
    if (this.hp <= 0) { this.finish('starve'); return; }

    if (input.bite && !this.biteHeld && this.biteCd <= 0) {
      this.biteCd = BITE_TIME;
      this.biteFlash = 0.2;
      this.player.vx += this.player.dir * 245;
      this.audio.chomp();
    }
    this.biteHeld = input.bite;
    if (input.sing && !this.singHeld && this.songCd <= 0) {
      this.charging = true;
      this.audio.songOn();
    }
    this.singHeld = input.sing;
    if (this.charging) {
      this.songCharge += dt;
      if (!input.sing || this.songCharge >= CHARGE * 2.2) this.releaseSong();
    }
    this.player.hidden = this.reef.kelp.some(x => Math.abs(this.player.x - x) < 43
      && this.player.y > floorAt(x, this.reef) - 88) && !this.player.dashing && !this.biting;
    const player = this.player;
    if (this.reef.lava?.some(([start, end]) => player.x >= start && player.x <= end)
      && player.y > floorAt(player.x, this.reef) - 43) {
      if (this.hurt(16, { x: player.x - player.dir * 24 }, '熔岩裂缝')) player.vy -= 95;
    }
    this.updateThings(dt);
    if (this.ended) return;
    this.updateBoss(dt);
    if (this.ended) return;
    this.updateGates();
    for (const m of this.meta.check(this.missionStats)) this.notice('任务完成 · ' + m.text + ' · 珍珠 +' + m.reward);
  }

  releaseSong() {
    const err = Math.abs(this.songCharge - CHARGE);
    const quality = err < 0.09 ? 1.3 : err < 0.2 ? 1 : 0.7;
    this.charging = false;
    this.songCharge = 0;
    this.songCd = this.mod.songCd * (quality > 1 ? 0.6 : 1);
    this.audio.songOff();
    this.audio.purify();
    const reach = 152 * quality * this.mod.songR;
    this.effect(this.player, { type: 'ring', color: '#7cebff', radius: reach, duration: 0.85 });
    this.effect(this.player, { type: 'ring', color: '#e3f4ff', radius: reach * 0.88, duration: 0.65 });
    if (quality > 1) {
      this.score += 300;
      if (this.frenzyT <= 0) this.frenzy = Math.min(99, this.frenzy + 15);
    }
    this.notice(quality > 1 ? '完美鲸歌 · +300 分' : quality === 1 ? '鲸歌共鸣' : '微弱鲸歌 · 在亮线处松开');
    for (const altar of this.zone.altars) {
      if (!altar.lit && dist(altar, this.player) <= reach + 25) {
        altar.lit = true;
        this.effect(altar, { type: 'ring', radius: 84, color: '#8affde' });
        this.notice('海脉祭坛已点亮 · ' + this.zone.altars.filter(a => a.lit).length + ' / 2');
      }
    }
    const boss = this.zone.boss;
    if (boss.hp > 0 && dist(boss, this.player) <= reach + 25) {
      if (boss.attack) this.stats.interrupts++;
      boss.attack = null;
      boss.timer = 1.5;
      boss.stun = this.mod.stun * (quality > 1 ? 1.45 : quality === 1 ? 1 : 0.75);
      this.stats.stuns++;
      this.notice(boss.def.name + '被定住了 · 趁现在撕咬');
    }
    for (const item of this.zone.things) {
      if (item.kind !== 'salary' || item.timer > 0 || dist(item, this.player) > reach) continue;
      item.timer = 35;
      this.stats.salary++;
      this.pearls += 2;
      this.score += 250;
      this.effect(item, { type: 'food', text: '终于下班了 · 珍珠 +2', color: '#ffd770' });
    }
  }

  get biting() { return this.biteCd > BITE_TIME - 0.18; }
  get reach() { return 28 + this.stage * 3; }

  touches(target, radius) {
    const player = this.player;
    if (dist(player, target) < this.reach + radius) return true;
    if (!this.biting || (target.x - player.x) * player.dir < 0) return false;
    return Math.hypot(player.x + player.dir * 34 - target.x, player.y + player.tilt * 30 - target.y) < this.reach + radius + 14;
  }

  updateThings(dt) {
    const player = this.player;
    for (const item of this.zone.things) {
      if (this.ended) break;
      item.timer = Math.max(0, item.timer - dt);
      if (item.timer > 0) continue;
      const prey = PREY[item.kind];
      if (prey) {
        const phase = this.time * (0.85 + prey.tier * 0.08) + item.phase;
        item.x = item.baseX + Math.sin(phase) * (prey.tier ? 45 : 30);
        item.y = item.baseY + Math.cos(phase * 0.81) * 15;
        const separation = dist(player, item);
        const avoid = prey.tier <= this.stage && separation < 124;
        const away = Math.sign(item.x - player.x || 1);
        item.scare = (item.scare || 0) * Math.exp(-2.2 * dt) + (avoid ? away * dt * 55 : 0);
        item.x += item.scare;
        item.y = clamp(item.y, roofAt(item.x, this.reef) + 22, floorAt(item.x, this.reef) - 22);
        item.dir = avoid && Math.abs(item.scare) > 9 ? away : Math.cos(phase) < 0 ? -1 : 1;
        if (!this.touches(item, 8 + prey.tier * 5)) continue;
        if (prey.tier > this.stage && this.frenzyT <= 0) {
          this.hurt(prey.dmg, item, prey.name);
          continue;
        }
        item.timer = prey.tier ? 18 : 12;
        this.stats.kind[item.kind]++;
        this.eat(prey.xp, prey.food, item, PALETTES[prey.tier]);
        continue;
      }
      if (item.kind === 'geyser') {
        const hot = (this.time + item.x * 0.02) % 6 < 1.4;
        if (hot && Math.abs(player.x - item.x) < 28 && player.y > item.y - 116) {
          player.vy = -420;
          item.timer = 3;
          this.stats.geysers++;
          this.audio.geyser();
        }
        continue;
      }
      if (item.kind === 'salary' || !this.touches(item, 9)) continue;
      if (item.kind === 'jelly') {
        item.timer = 2;
        player.vy = -385;
        this.audio.boing();
        this.effect(item, { type: 'ring', color: '#e9c7ff', radius: 64 });
        continue;
      }
      if (item.kind === 'urchin' && this.frenzyT <= 0) {
        this.hurt(14, item, '剧毒刺海胆');
        continue;
      }
      if (item.kind === 'current') {
        item.timer = 9;
        player.vx += item.dx * 370;
        player.vy += item.dy * 370;
        player.dash = Math.min(100, player.dash + 35);
        this.stats.rings++;
        this.effect(item, { type: 'ring', color: '#a5faff', radius: 58 });
        this.audio.whoosh();
        continue;
      }
      if (item.kind === 'clam') {
        item.timer = 22;
        const gold = Math.random() < 0.14;
        this.pearls += gold ? 3 : 1;
        this.stats.clams++;
        this.stats.gold += Number(gold);
        this.eat(gold ? 8 : 3, 8, item, '#ffe1a3', gold ? '金珍珠' : '珍珠贝');
      } else if (item.kind === 'chest') {
        item.timer = 45;
        this.pearls += 5;
        this.stats.chests++;
        this.eat(18, 16, item, '#ffe1a3', '沉船宝箱');
      } else {
        item.timer = 17;
        if (item.kind === 'crystal') this.stats.crystals++;
        this.eat(6, 12, item, '#a0ffe7', item.kind === 'crystal' ? '梦糖' : '海胆');
      }
    }
  }

  updateBoss(dt) {
    const p = this.player;
    const r = this.zone.boss;
    this.updateHazards(dt);
    if (!r.hp || this.ended) return;
    r.stun = Math.max(0, r.stun - dt);
    r.invuln = Math.max(0, r.invuln - dt);
    const distance = dist(p, r);
    if (!r.stun) {
      if (r.attack) this.runAttack(r, dt);
      else if (distance < 335) {
        if (!p.hidden) moveToward(r, p, distance > 115 ? 57 + 9 * this.map : 22, dt);
        if (!p.hidden && (r.timer -= dt) <= 0) {
          const skill = r.def.boss ? ['wave', 'plates', 'stones', 'ambush'][r.phase++ % (r.hp < r.def.hp / 2 ? 4 : 3)] : r.def.skill;
          r.attack = { skill, age: 0, launched: false, x: p.x, y: p.y, lane: r.y, dx: p.x >= r.x ? 1 : -1 };
          this.audio.warn();
        }
      } else {
        const [x, y] = this.reef.boss;
        moveToward(r, { x, y }, 48, dt);
      }
    }
    r.x = clamp(r.x, 110, this.reef.width - 110);
    r.y = clamp(r.y, roofAt(r.x, this.reef) + 28, floorAt(r.x, this.reef) - 30);
    if (!this.touches(r, 28 + this.map * 4)) return;
    const edible = r.def.boss ? this.stage >= r.def.tier : this.stage >= r.def.tier || r.stun > 0 || this.frenzyT > 0;
    if (!edible) { this.hurt(14 + 3 * this.map, r, r.def.name); return; }
    if (r.invuln) return;
    if (r.attack && this.biting) {
      r.attack = null;
      r.timer = 1.6;
      this.stats.interrupts++;
    }
    const bite = this.biting;
    r.hp = Math.max(0, r.hp - (16 + this.stage * 9) * (bite ? 1.35 : 1) * (this.frenzyT > 0 ? 1.6 : 1));
    r.invuln = 0.62;
    r.x += Math.sign(r.x - p.x || p.dir) * 29;
    p.vx -= p.dir * 100;
    this.biteFlash = 0.23;
    this.shake = 6;
    this.audio.crunch();
    this.effect(r, { type: 'pop', radius: 50, color: '#ffe099' });
    if (r.hp > 0) return;
    r.attack = null;
    this.hazards = [];
    this.stats.rivals++;
    this.stats.downs[r.def.key] = 1;
    this.clearedMaps.add(this.map);
    this.pearls += (this.map + 1) * 3;
    this.eat(30 + this.map * 12, 37, r, '#ffdd83');
    this.notice(r.def.name + '认输了');
    if (r.def.boss) {
      this.won = true;
      this.finish('win');
    }
  }

  addHazard(kind, x, y, options = {}) {
    this.hazards.push({ kind, x, y, vx: 0, vy: 0, age: 0, life: 2.4, radius: 17, delay: 0, color: HAZARD_COLORS[kind], ...options });
  }

  runAttack(r, dt) {
    const attack = r.attack;
    attack.age += dt;
    const windup = 0.72;
    if (attack.age < windup) return;
    if (attack.skill === 'dash' && attack.age < 2.05) {
      const phase = (attack.age - windup) % 0.45;
      if (phase < 0.29) {
        r.x += attack.dx * 410 * dt;
        r.y += (attack.y - r.y) * dt * 5;
        if (dist(r, this.player) < 63) this.hurt(22, r, r.def.skillName);
      }
      if (phase >= 0.29) attack.dx = this.player.x >= r.x ? 1 : -1;
      return;
    }
    if (!attack.launched) {
      attack.launched = true;
      if (attack.skill === 'plates') {
        for (const dy of [-95, 0, 95]) {
          this.addHazard('plate', r.x, r.y, { vx: attack.dx * 230, vy: dy });
        }
      } else if (attack.skill === 'stones') {
        for (const dx of [-100, 0, 100]) {
          this.addHazard('stone', attack.x + dx, attack.y - 135, { vy: 265, delay: 0.28, radius: 24 });
        }
      } else if (attack.skill === 'wave') {
        this.addHazard('wave', r.x, r.y, { radius: 29, life: 1.05 });
      } else if (attack.skill === 'stealth' || attack.skill === 'ambush') {
        r.x = clamp(attack.x - this.player.dir * 60, 40, this.reef.width - 40);
        r.y = attack.y;
        this.addHazard('ambush', attack.x, attack.y, { delay: 0.18, life: 0.65, radius: 55 });
      }
    }
    r.attack = null;
    r.timer = r.def.boss && r.hp < r.def.hp / 2 ? 0.95 : 2.0;
  }

  updateHazards(dt) {
    for (const hazard of this.hazards) {
      hazard.age += dt;
      if (hazard.age <= hazard.delay) continue;
      hazard.x += hazard.vx * dt;
      hazard.y += hazard.vy * dt;
      if (hazard.kind === 'wave') hazard.radius += dt * 255;
      const separation = dist(hazard, this.player);
      const hit = hazard.kind === 'wave' ? Math.abs(separation - hazard.radius) < 24 : separation < hazard.radius + 17;
      if (hit) this.hurt(17 + this.map * 3, hazard, this.zone.boss.def.skillName);
    }
    this.hazards = this.hazards.filter(h => h.age < h.life && h.y < this.reef.bounds + 50 && h.x > -120 && h.x < this.reef.width + 120);
  }

  updateGates() {
    const z = this.zone;
    const altarCount = z.altars.filter(a => a.lit).length;
    if (this.map < 4 && !z.boss.hp && altarCount === 2 && !z.unlocked && !z.key) {
      z.key = { x: z.boss.x, y: z.boss.y };
      this.notice('潮汐钥匙出现 · 拾取后进入右侧海门');
    }
    if (z.key && dist(z.key, this.player) < 46) {
      z.key = null;
      z.unlocked = true;
      this.audio.ding();
      this.notice('海门开启 · 继续向右');
    }
    if (this.transition > 0) return;
    if (this.map > 0 && dist(z.back, this.player) < 48) this.enter(this.map - 1, -1);
    else if (this.map < 4 && z.unlocked && dist(z.gate, this.player) < 52) this.enter(this.map + 1);
  }

  cancelHeld() {
    this.singHeld = this.charging = this.biteHeld = false;
    this.songCharge = 0;
    this.audio.songOff();
  }

  finish(result, by) {
    this.settleCombo();
    this.meta.check(this.missionStats);
    super.finish(result, by);
  }
}
