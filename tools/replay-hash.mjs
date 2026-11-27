import { createHash } from 'node:crypto';

// Browser and Node can differ in the last digits of Math.sin and Math.hypot.
// Hash with subpixel precision across engines. Native replay tests check exact equality independently.
export function replayHash(snapshot) {
  const json = JSON.stringify(snapshot, (_, value) =>
    typeof value === 'number' && Number.isFinite(value) && !Number.isInteger(value)
      ? Number(value.toFixed(7)) : value);
  return createHash('sha256').update(json).digest('hex');
}
