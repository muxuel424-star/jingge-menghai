import { TUNING as T } from '../../data/tuning.js';
import { distance } from '../math.js';

// These slots are separate from enemy attack slots: an attack can still happen
// when its secondary food-chain interaction is suppressed for readability.
export function emergence(game, type, source, duration, targets = []) {
  const events = game.ecologyEvents ??= [];
  const current = events.find(event => event.type === type && event.sourceId === source.id);
  if (current) return current;
  if (events.length >= T.ecology.maxEvents) return null;
  const event = { id: game.nextId++, type, sourceId: source.id, x: source.x, y: source.y, duration, remaining: duration, targets };
  events.push(event); game.emit('ecology.start', { ...event, targets: [...targets] });
  return event;
}

export function leaveRemains(game, prey) {
  const same = game.fish.filter(f => !f.eaten && f.id !== prey.id && f.kind === prey.kind && distance(f, prey) <= T.ecology.corpseRadius)
    .sort((a, b) => distance(a, prey) - distance(b, prey) || a.id - b.id);
  const remains = { id: game.nextId++, kind: prey.kind, x: prey.x, y: prey.y, remaining: T.ecology.corpseDuration,
    targets: same.slice(0, game.rng.int(...T.ecology.corpseCount)).map(f => f.id) };
  game.entities.remains.push(remains);
  return remains;
}

export function activeEmergence(game, type, source) {
  return game.ecologyEvents?.find(event => event.type === type && event.sourceId === source.id);
}

export function tickEmergence(game, dt) {
  for (const event of game.ecologyEvents) event.remaining = Math.max(0, event.remaining - dt);
  game.ecologyEvents = game.ecologyEvents.filter(event => event.remaining > 0);
  for (const remains of game.entities.remains) {
    remains.remaining = Math.max(0, remains.remaining - dt);
    if (remains.remaining > 0 && remains.targets.length) emergence(game, 'corpse', remains, remains.remaining, remains.targets);
  }
  game.entities.remains = game.entities.remains.filter(remains => remains.remaining > 0);
}

export function corpseTarget(game, fish) {
  const event = game.ecologyEvents.find(event => event.type === 'corpse' && event.targets.includes(fish.id));
  return event ?? null;
}
