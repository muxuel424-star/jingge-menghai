import { DREAM_REEF, resolveTerrain } from './reefs.js';

export const START_INSOMNIA = 1095;
export const TOTAL_TIME = 480;
export const TAU = Math.PI * 2;

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const rand = (min, max) => min + Math.random() * (max - min);
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const displayTime = (seconds) =>
  Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');

export function moveToward(entity, target, speed, dt) {
  const dx = target.x - entity.x;
  const dy = target.y - entity.y;
  const step = Math.min(1, speed * dt / Math.max(1, Math.hypot(dx, dy)));
  entity.x += dx * step;
  entity.y += dy * step;
  if (Math.abs(dx) > 2) entity.dir = Math.sign(dx);
}

export class Dive {
  constructor(audio, onEnd) {
    this.audio = audio;
    this.onEnd = onEnd;
  }

  reset() {
    this.player = { x: 190, y: 297, vx: 0, vy: 0, dir: 1, tilt: 0, size: 1, dash: 100, invuln: 0, scull: 0, turn: 0 };
    this.map = 0;
    this.time = 0;
    this.shake = 0;
    this.damage = 0;
    this.effects = [];
    this.reef = DREAM_REEF;
    this.message = '';
    this.messageT = 0;
    this.ended = false;
  }

  notice(message, duration = 3.8) {
    this.message = message;
    this.messageT = duration;
  }

  effect(position, options) {
    if (this.effects.length >= 100) this.effects.shift();
    this.effects.push({ x: position.x, y: position.y, age: 0, duration: 0.75, ...options });
  }

  updateMovement(dt, input, singing) {
    const p = this.player;
    const length = Math.max(1, Math.hypot(input.x, input.y));
    const x = input.x / length;
    const y = input.y / length;
    const wasDashing = p.dashing;
    p.dashing = input.dash && p.dash > 0 && (input.x !== 0 || input.y !== 0) && !p.exhausted;
    if (p.dashing && !wasDashing) this.audio.dash();
    p.dash = clamp(p.dash + (p.dashing ? -34 : 22) * dt, 0, 100);
    if (p.dash === 0) p.exhausted = true;
    if (!input.dash || p.dash >= 22) p.exhausted = false;
    const speed = (p.dashing ? (this.zone ? 355 : 255) : singing ? 110 : this.zone ? 195 : 150) * (p.speed ?? 1);
    const inertia = 1 - Math.exp(-9 * dt);
    p.vx += (x * speed - p.vx) * inertia;
    p.vy += (y * speed - p.vy) * inertia;
    if (input.x && p.dir !== Math.sign(input.x)) {
      p.dir = Math.sign(input.x);
      p.turn = 0.16;
    }
    p.turn = Math.max(0, p.turn - dt);
    const strokeRate = p.dashing ? 2.72 : 0.53 + Math.min(1, Math.hypot(p.vx, p.vy) / 145) * 1.48;
    p.scull = (p.scull + dt * strokeRate) % 1;
    p.tilt += (clamp(p.vy / 580, -0.32, 0.32) - p.tilt) * inertia;
    p.x = clamp(p.x + p.vx * dt, 26, this.reef.width - 26);
    p.y += p.vy * dt;
    const padding = 23 + Math.min(12, (p.size - 1) * 6);
    resolveTerrain(p, padding, this.reef);
    p.invuln = Math.max(0, p.invuln - dt);
    this.shake = Math.max(0, this.shake - dt * 20);
    this.damage = Math.max(0, this.damage - dt * 2.8);
    this.messageT = Math.max(0, this.messageT - dt);
    for (const e of this.effects) e.age += dt;
    this.effects = this.effects.filter((e) => e.age < e.duration);
    this.time += dt;
  }

  finish(result, by) {
    if (this.ended) return;
    this.ended = true;
    this.audio.songOff();
    this.audio.setDread(0);
    if (result === 'win') this.audio.win();
    this.onEnd(result, by);
  }
}
