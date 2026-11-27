import { TUNING as T } from '../../data/tuning.js';
import { SPECIES } from '../../data/species.js';
import { text } from '../../data/dialogue.js';
import { distance, approach, normalize } from '../math.js';
function teach(game) {
  const p = game.player, layer = game.scene.layer;
  game.currentBeat = game.scene.beats?.find(beat => p.x >= beat.from && p.x < beat.to) ?? null;
  const beat = game.currentBeat, beatId = layer + ':' + beat?.key;
  if (beat?.teachKey && !game.taught.has(beatId)) {
    game.taught.add(beatId);
    game.emit('notify', { text: text(beat.teachKey), ttl: T.world.hintDuration, beat: beat.key, layer });
  }
  for (const f of game.entities.fragments) {
    const hintId = layer + ':hidden:' + f.id;
    if (!f.condition || f.collected || game.checkCondition(f.condition) || game.taught.has(hintId) || distance(p, f) > T.world.hintRadius) continue;
    game.taught.add(hintId);
    game.emit('notify', { text: text('teach.hidden.' + f.condition), ttl: T.world.hintDuration, fragment: f.id, layer });
  }
}
export function tickDreams(game, dt) {
  const p = game.player, chain = game.entities.dreamChain;
  teach(game);
  if (game.state === 'SURFACE') {
    for (const fish of game.fish) {
      if (fish.kind !== 'dreamfish' || fish.eaten || chain.length >= T.chain.max) continue;
      if (distance(fish, p) < T.chain.collectRadius + p.r) {
        fish.eaten = true; fish.respawn = Infinity;
        chain.push({ id: fish.id, kind: 'dreamfish', x: fish.x, y: fish.y, prevX: fish.x, prevY: fish.y });
        game.stats.maxChain = Math.max(game.stats.maxChain, chain.length); game.emit('dream.collect', { count: chain.length, x: fish.x, y: fish.y });
      }
    }
    let head = p;
    for (const fish of chain) {
      fish.prevX = fish.x; fish.prevY = fish.y;
      const n = normalize(fish.x - head.x, fish.y - head.y);
      fish.x = approach(fish.x, head.x + n.x * T.chain.followGap, T.chain.followSpeed, dt);
      fish.y = approach(fish.y, head.y + n.y * T.chain.followGap, T.chain.followSpeed, dt); head = fish;
    }
    if (chain.length && distance(p, game.scene.well) < T.chain.deliveryRadius) {
      const count = chain.length; game.delivered += count; game.stats.delivered += count; chain.length = 0;
      p.stability = Math.min(100, p.stability + count); game.emit('dream.deliver', { count, total: game.delivered, x: p.x, y: p.y });
    }
    for (const f of game.entities.fragments) {
      if (f.collected || distance(f, p) > T.world.fragmentRadius + p.r) continue;
      const lamp = p.buffs.some(b => b.key === 'lamp');
      if (f.hidden && !lamp && !game.checkCondition(f.condition)) continue;
      if (!game.checkCondition(f.condition)) continue;
      f.collected = true; game.storyFragments.add(f.id); game.stats.fragments++;
      game.emit('fragment.collect', { id: f.id, textKey: f.textKey, x: f.x, y: f.y });
    }
    game.riftOpen = game.storyCount >= 3 || game.surfaceTime >= T.run.riftFallback;
    if (game.riftOpen && distance(p, game.scene.exit) < game.scene.exit.r + p.r) game.transition('DESCENT');
  } else if (game.state === 'DEEP') {
    for (const f of game.entities.melodies) if (!f.collected && p.tier >= f.requiresTier && distance(f, p) < T.world.fragmentRadius + p.r) game.collectMelody(f.id);
    if (distance(p, game.scene.exit) < game.scene.exit.r + p.r || game.deepTime >= T.run.bossFallback) game.enterBoss();
  }
  for (const shortcut of game.scene.shortcuts ?? []) {
    if (game.usedShortcuts.has(shortcut.id) || distance(p, shortcut.from) > T.world.pickupRadius) continue;
    if (p.tier < (shortcut.requiresTier ?? 0) || (shortcut.requiresItem && !p.buffs.some(b => b.key === shortcut.requiresItem))) continue;
    p.x = shortcut.to.x; p.y = shortcut.to.y; game.terrain.resolve(p); game.usedShortcuts.add(shortcut.id); game.stats.shortcuts = game.usedShortcuts.size;
    game.emit('shortcut', { id: shortcut.id, x: p.x, y: p.y });
  }
}
export function applySongRelease(game, quality, radius = game.songRadius, stun = null) {
  const p = game.player;
  if (quality === 'Perfect') game.stats.perfects++;
  for (const f of game.fish) {
    if (f.eaten || distance(f, p) > radius) continue;
    game.seen.add(f.kind);
    if (f.kind === 'tapir') { if (f.sleep <= 0) game.stats.tapirsSlept++; f.sleep = SPECIES.tapir.sleepDuration; game.seen.add('tapir'); if (f.stolen) { game.releaseDreams(f, f.stolen); f.stolen = 0; } }
    else if (f.kind === 'abyss' && quality === 'Perfect') { f.stun = T.fish.stunPerfect; f.perfectStun = true; }
    else if (f.kind !== 'abyss') f.stun = stun ?? (quality === 'Perfect' ? T.fish.stunPerfect : quality === 'Miss' ? T.song.stun * T.song.missStun : T.fish.stunGood);
  }
  game.lastSongQuality = quality;
}
