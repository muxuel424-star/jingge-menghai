import { MAPS, PREY, RIVALS, STAGES } from '../ocean-data.js';
import { Dive, clamp, dist, moveToward, rand } from './core.js';
import { REEFS, floorAt, roofAt, resolveTerrain, regionAt } from './reefs.js';
import { createBoss, updateBoss, singAtBoss } from './boss.js';

const CHARGE = 0.9;
const COMBO_TIME = 2.8;
const PALETTES = ['#68f4dd', '#ffc472', '#d8a0ff', '#ff886b', '#c1adff'];
const BITE_TIME = 0.48;

export class HuntDive extends Dive {
  constructor(audio, meta, onEnd) {
    super(audio, onEnd);
    this.meta = meta;
  }

  start() {
    super.reset();
    this.meta.beginRun();
    this.mod = this.meta.mods;
    this.stage = this.xp = this.score = this.pearls = this.biteSerial = 0;
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
      kind: { fry: 0, lantern: 0, manta: 0, royal: 0, abyss: 0 }, downs: {} };
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
        const fish = { kind: shoal.kind, x, y, timer: 0, baseX: x, baseY: y, phase: rand(0, 6.28), dir: 1 };
        resolveTerrain(fish, 14, reef);
        fish.baseX = fish.x;
        fish.baseY = fish.y;
        things.push(fish);
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
    const predators = (reef.predators ?? []).map((point, i) => ({
      ...point, kind: point.kind ?? 'royal', homeX: point.x, homeY: point.y,
      dir: i % 2 ? -1 : 1, timer: 0, stun: 0, phase: i * 2.7, hunting: false,
    }));
    const def = RIVALS[index];
    return {
      things,
      predators,
      back: point(reef.back),
      gate: point(reef.gate),
      boss: createBoss(def, point(reef.boss)),
      lastTime: this.time,
      visited: new Set(),
    };
  }

  enter(index, direction = 1) {
    this.cancelHeld();
    this.map = index;
    this.reef = REEFS[index];
    this.zone = this.locations[index] ??= this.buildMap(index);
    this.visitedMaps.add(index);
    const away = Math.max(0, this.time - this.zone.lastTime);
    for (const entity of [...this.zone.things, ...this.zone.predators]) entity.timer = Math.max(0, entity.timer - away);
    this.zone.lastTime = this.time;
    const [x, y] = direction < 0 ? [this.reef.gate[0] - 140, this.reef.gate[1]] : this.reef.spawn;
    Object.assign(this.player, { x, y, vx: 0, vy: 0, dir: direction });
    this.zone.boss.attack = null;
    this.zone.boss.timer = 1.2;
    this.zone.boss.engaged = false;
    resolveTerrain(this.player, 27, this.reef);
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
    if (label || this.time - (this.lastFoodText ?? -1) > 0.16) {
      this.effect(target, { type: 'food', text: label ? label + ' +' + food : '+' + food, color });
      this.lastFoodText = this.time;
    }
    this.effect(target, { type: 'pop', color, radius: 20 });
    this.biteFlash = 0.23;
    this.shake = Math.max(this.shake, food >= 15 ? 3 : 1.4);
    if (this.combo % 3 === 1) this.audio.combo(this.combo);
    if (this.frenzyT <= 0) {
      this.frenzy += xp * 0.23 + 0.9;
      if (this.frenzy >= 100) {
        this.frenzy = 100;
        this.frenzyT = 7;
        this.stats.frenzies++;
        this.notice('狂食觉醒 · 7 秒狂食 · 分数翻倍');
        this.audio.win();
      }
    }
    while (this.stage + 1 < STAGES.length && this.xp >= STAGES[this.stage + 1].xp) {
      const next = STAGES[this.stage + 1];
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
    if (!this.combo && this.frenzyT <= 0) this.frenzy = Math.max(0, this.frenzy - dt * 0.55);
    if (this.frenzyT > 0 && (this.frenzyT -= dt) <= 0) this.frenzy = 0;
    this.hunger = Math.max(0, this.hunger - (1.45 + this.stage * 0.28 + (this.player.dashing ? 0.65 : 0)) * this.mod.hunger * dt);
    if (this.hunger <= 0) this.hp = Math.max(0, this.hp - 5.5 * dt);
    else if (this.hunger > 55) this.hp = Math.min(this.maxHp, this.hp + 1.1 * dt);
    if (this.hp <= 0) { this.finish('starve'); return; }

    if (input.bite && this.biteCd <= 0) {
      this.biteSerial++;
      this.biteCd = BITE_TIME;
      this.biteFlash = 0.2;
      const length = Math.hypot(input.x, input.y);
      this.player.vx += (length ? input.x / length : this.player.dir) * 275;
      this.player.vy += (length ? input.y / length : 0) * 275;
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
    this.updatePredators(dt);
    updateBoss(this, dt);
    if (this.ended) return;
    this.zone.lastTime = this.time;
    const region = regionAt(this.reef, this.player.x);
    if (region && !this.zone.visited.has(region.name)) {
      this.zone.visited.add(region.name);
      this.notice(region.name + ' · ' + region.detail, 4);
    }
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
      if (this.frenzyT <= 0) this.frenzy = Math.min(99, this.frenzy + 5);
    }
    this.notice(quality > 1 ? '完美鲸歌 · +300 分' : quality === 1 ? '鲸歌共鸣' : '微弱鲸歌 · 在亮线处松开');
    singAtBoss(this, quality, reach);
    for (const predator of this.zone.predators) {
      if (!predator.timer && dist(predator, this.player) < reach + 35) predator.stun = 0.8 + quality * 0.75;
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
      if (Math.abs(item.x - player.x) > 1200 || Math.abs(item.y - player.y) > 850) continue;
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
        resolveTerrain(item, 12 + prey.tier * 2, this.reef);
        item.dir = avoid && Math.abs(item.scare) > 9 ? away : Math.cos(phase) < 0 ? -1 : 1;
        if (!this.touches(item, 8 + prey.tier * 5)) continue;
        if (prey.tier > this.stage) {
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

  updatePredators(dt) {
    const p = this.player;
    for (const predator of this.zone.predators) {
      predator.timer = Math.max(0, predator.timer - dt);
      predator.stun = Math.max(0, predator.stun - dt);
      if (predator.timer || Math.abs(predator.x - p.x) > 1150) continue;
      const def = PREY[predator.kind];
      const danger = def.tier > this.stage;
      const separation = dist(p, predator);
      predator.hunting = danger && separation < 345 && !p.hidden;
      const flee = !danger && separation < 210;
      const home = {
        x: predator.homeX + Math.sin(this.time * 0.45 + predator.phase) * 160,
        y: predator.homeY + Math.cos(this.time * 0.57 + predator.phase) * 80,
      };
      let target = home;
      if (predator.hunting) target = p;
      if (flee) target = { x: predator.x + Math.sign(predator.x - p.x || 1) * 180, y: predator.y - 12 };
      if (!predator.stun) moveToward(predator, target, predator.hunting ? 173 + def.tier * 9 : flee ? 145 : 68, dt);
      if (dist(predator, { x: predator.homeX, y: predator.homeY }) > 650) {
        moveToward(predator, home, 210, dt);
        predator.hunting = false;
      }
      resolveTerrain(predator, 25 + def.tier * 5, this.reef);
      if (!this.touches(predator, 24 + def.tier * 6)) continue;
      if (danger) {
        this.hurt(def.dmg + 8, predator, def.name);
      } else {
        predator.timer = 48;
        predator.x = predator.homeX;
        predator.y = predator.homeY;
        this.stats.kind[predator.kind]++;
        this.eat(def.xp * 2, def.food, predator, PALETTES[def.tier], def.name);
        this.audio.crunch();
      }
    }
  }

  updateGates() {
    if (this.transition > 0) return;
    const z = this.zone;
    if (this.map > 0 && dist(z.back, this.player) < 64) this.enter(this.map - 1, -1);
    else if (this.map < 4 && dist(z.gate, this.player) < 64) this.enter(this.map + 1);
  }

  cancelHeld() {
    this.singHeld = this.charging = this.biteHeld = false;
    this.songCharge = 0;
    this.audio.songOff();
  }

  finish(result, by) {
    if (this.ended) return;
    this.settleCombo();
    this.meta.check(this.missionStats);
    super.finish(result, by);
  }
}
