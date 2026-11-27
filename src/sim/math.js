import { TUNING } from '../data/tuning.js';
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const lerp = (a, b, t) => a + (b - a) * t;
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function normalize(x, y) { const n = Math.hypot(x, y); return n ? { x: x / n, y: y / n } : { x: 0, y: 0 }; }
export const approach = (value, target, rate, dt) => lerp(value, target, 1 - Math.exp(-rate * dt));
export const isBehind = (player, prey) => (player.x - prey.x) * prey.dir < TUNING.fish.backOffset;
export function pointSegmentDistance(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / Math.max(Number.EPSILON, dx * dx + dy * dy), 0, 1);
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
}
