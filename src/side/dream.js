import { floorAt, roofAt } from './reefs.js';
import { START_INSOMNIA, TOTAL_TIME, Dive, clamp, dist, moveToward, rand } from './core.js';

const DREAM_COLORS = ['#78efff', '#a6c1ff', '#d8a9ff'];
const WELL = { x: 917, y: 365 };
const VENTS = [235, 565, 1210, 1630];
const JELLYFISH = [413, 792, 1377, 1590];

export class DreamDive extends Dive {
  start() {
    super.reset();
    this.player.x = 775;
    this.player.y = 302;
    this.well = WELL;
    this.vents = VENTS.map(x => ({ x, y: floorAt(x, this.reef) }));
    this.jellies = JELLYFISH.map((x, i) => ({ x, y: 220 + (i % 3) * 64, cooldown: 0 }));
    this.timeLeft = TOTAL_TIME;
    this.insomnia = START_INSOMNIA;
    this.breath = 100;
    this.charge = this.rest = 0;
    this.singing = false;
    this.chain = [];
    this.dreams = [];
    this.nightmares = [];
    this.stats = { delivered: 0, purified: 0, best: 0, gold: 0, stolen: 0 };
    this.dreamClock = 0;
    this.nightmareClock = 0;
    for (let i = 0; i < 50; i++) this.spawnDream(42 + i * 36, undefined, 0);
    for (const x of [440, 705, 1180, 1440, 1690]) this.spawnNightmare(x);
    this.notice('碰触发光的梦，再带它们回到月光井。', 6);
  }

  spawnDream(x = rand(60, this.reef.width - 60), y = rand(135, floorAt(x, this.reef) - 48), mercy = 0.65) {
    const gold = Math.random() < 0.13;
    this.dreams.push({ x, y, bx: x, by: y, gold, mercy, phase: rand(0, 6.28),
      color: gold ? '#ffe090' : DREAM_COLORS[Math.floor(rand(0, DREAM_COLORS.length))], dir: 1 });
  }

  spawnNightmare(x = rand(95, this.reef.width - 95)) {
    this.nightmares.push({ x, y: rand(165, 410), dir: -1, calm: 0, flee: 0, size: 1, eaten: 0, phase: rand(0, 6.28) });
  }

  deliver() {
    if (!this.chain.length) return;
    let points = 0;
    this.chain.forEach((d, i) => {
      points += (d.gold ? 36 : 12) + 3 * i;
      this.stats.gold += Number(d.gold);
      this.effect(d, { type: 'float', target: WELL, color: d.color, duration: 1 + i * 0.045 });
    });
    const count = this.chain.length;
    this.stats.delivered += count;
    this.stats.best = Math.max(this.stats.best, count);
    this.chain.length = 0;
    this.insomnia = Math.max(0, this.insomnia - points);
    this.audio.deliver(count);
    this.effect(WELL, { type: 'ring', radius: 110, color: '#ffe9ab', duration: 1 });
    this.notice(count + ' 个梦回家了 · 失眠 −' + points);
  }

  scatterFrom(index) {
    const scattered = this.chain.splice(index);
    this.stats.stolen += scattered.length;
    for (const d of scattered) {
      d.bx = clamp(d.x + rand(-57, 57), 38, this.reef.width - 38);
      d.by = clamp(d.y + rand(-40, 40), roofAt(d.bx, this.reef) + 24, floorAt(d.bx, this.reef) - 28);
      d.mercy = 1.4;
      d.attached = false;
      this.dreams.push(d);
    }
    return scattered.length;
  }

  purify(nightmare) {
    for (let i = 0; i < Math.min(6, 2 + nightmare.eaten); i++) {
      this.spawnDream(clamp(nightmare.x + rand(-48, 48), 36, this.reef.width - 36), nightmare.y + rand(-35, 35));
    }
    this.stats.purified++;
    this.insomnia = Math.max(0, this.insomnia - 15);
    this.notice('噩梦睡着了 · 失眠 −15');
    this.effect(nightmare, { type: 'ring', radius: 75, color: '#f6daad' });
    this.audio.purify();
  }

  update(dt, input) {
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    this.updateMovement(dt, input, this.singing);
    const p = this.player;
    const singing = input.sing && this.breath > 0.5;
    if (singing !== this.singing) {
      if (singing) this.audio.songOn();
      else this.audio.songOff();
      this.singing = singing;
    }
    this.charge = clamp(this.charge + dt * (singing ? 0.8 : -3), 0, 1);
    if (singing) {
      this.breath = Math.max(0, this.breath - dt * 15);
      this.rest = 0.8;
    } else {
      this.rest = Math.max(0, this.rest - dt);
      if (!this.rest) this.breath = Math.min(100, this.breath + dt * 8);
    }
    this.songRadius = 66 + this.charge * 112;
    for (const v of this.vents) {
      if (Math.abs(p.x - v.x) < 42 && p.y > v.y - 180) {
        this.breath = Math.min(100, this.breath + dt * 45);
        p.dash = Math.min(100, p.dash + dt * 40);
      }
    }
    for (const j of this.jellies) {
      j.cooldown = Math.max(0, j.cooldown - dt);
      if (j.cooldown || dist(p, j) > 43) continue;
      p.vy = -410;
      j.cooldown = 1.2;
      this.audio.boing();
      this.effect(j, { type: 'ring', radius: 58, color: '#d4a5ff' });
    }
    this.dreamClock += dt;
    if (this.dreamClock >= 0.8 && this.dreams.length < 52) {
      this.dreamClock = 0;
      this.spawnDream(clamp(p.x + (Math.random() < 0.5 ? -1 : 1) * rand(160, 340), 38, this.reef.width - 38));
    }
    if (this.nightmares.length < 5 && (this.nightmareClock += dt) > 12) {
      this.nightmareClock = 0;
      this.spawnNightmare(clamp(p.x + (p.x > WELL.x ? -400 : 400), 55, this.reef.width - 55));
    }
    for (const dream of this.dreams) {
      dream.mercy = Math.max(0, dream.mercy - dt);
      if (singing && dist(p, dream) < this.songRadius && !dream.mercy) {
        moveToward(dream, p, 138, dt);
        dream.bx = dream.x;
        dream.by = dream.y;
      } else {
        const phase = this.time * 1.1 + dream.phase;
        dream.x += (dream.bx + Math.sin(phase) * 20 - dream.x) * dt * 2;
        dream.y += (dream.by + Math.cos(phase * 0.65) * 17 - dream.y) * dt * 2;
        dream.dir = Math.cos(phase) > 0 ? 1 : -1;
      }
      if (dream.mercy || dist(p, dream) > 37 || this.chain.length >= 16) continue;
      dream.attached = true;
      this.chain.push(dream);
      this.audio.pickup(this.chain.length);
      this.effect(dream, { type: 'pop', radius: 24, color: dream.color });
    }
    this.dreams = this.dreams.filter(d => !d.attached);
    let previous = p;
    for (const dream of this.chain) {
      const distance = dist(previous, dream);
      if (distance > 27) moveToward(dream, previous, (distance - 27) * 9, dt);
      previous = dream;
    }
    if (dist(p, WELL) < 68) this.deliver();
    this.updateNightmares(dt);
    if (this.insomnia === 0) this.finish('win');
    else if (this.timeLeft === 0) this.finish('time');
  }

  updateNightmares(dt) {
    const p = this.player;
    let dread = 0;
    for (const n of this.nightmares) {
      const distance = dist(n, p);
      const sung = this.singing && distance < this.songRadius + 15;
      n.calm = clamp(n.calm + dt * (sung ? 0.68 / n.size : -0.22), 0, 1);
      if (n.calm >= 1) { this.purify(n); continue; }
      dread = Math.max(dread, clamp(1 - distance / 210, 0, 1));
      const wandering = { x: n.x + Math.sin(this.time * 0.4 + n.phase) * 55, y: 285 + Math.cos(this.time * 0.5 + n.phase) * 145 };
      let target = wandering;
      if (n.flee > 0) {
        n.flee -= dt;
        target = { x: n.x + Math.sign(n.x - p.x || 1) * 130, y: n.y - 18 };
      } else if (this.chain.length && distance < 230) {
        target = this.chain.at(-1);
      } else if (distance < 118) {
        target = p;
      } else {
        target = this.dreams.find(d => !d.eaten && !d.mercy && dist(n, d) < 119) ?? wandering;
      }
      moveToward(n, target, (target === wandering ? 23 : 58) * (1 - n.calm * 0.78), dt);
      n.x = clamp(n.x, 30, this.reef.width - 30);
      n.y = clamp(n.y, 95, floorAt(n.x, this.reef) - 46);
      if (n.calm > 0.32 || n.flee > 0 || dist(WELL, n) < 110) continue;
      const eaten = this.dreams.find(d => !d.eaten && !d.mercy && dist(n, d) < 16 * n.size);
      if (eaten) {
        eaten.eaten = true;
        n.eaten++;
        n.size = Math.min(1.9, n.size + 0.13);
      }
      const caught = this.chain.findIndex(d => dist(n, d) < 21 * n.size);
      if (caught >= 0) {
        this.scatterFrom(caught);
        n.flee = 3.5;
        this.audio.hit();
        this.notice('噩梦叼散了梦链 · 按住 F 唱睡它');
      } else if (distance < 25 + 16 * n.size && p.invuln <= 0 && !p.dashing) {
        const lost = this.scatterFrom(Math.max(0, this.chain.length - 3));
        this.breath = Math.max(0, this.breath - 15);
        p.invuln = 1.5;
        p.vx = Math.sign(p.x - n.x || 1) * 220;
        n.flee = 2.5;
        this.damage = 1;
        this.shake = 6;
        this.audio.hit();
        this.notice(lost ? '被撞散了 ' + lost + ' 个梦' : '噩梦撞了过来 · 按住 F 唱鲸歌');
      }
    }
    this.nightmares = this.nightmares.filter(n => n.calm < 1);
    this.dreams = this.dreams.filter(d => !d.eaten);
    this.audio.setDread(dread);
  }
}
