import { TUNING as T } from '../../data/tuning.js';
import { distance, isBehind, pointSegmentDistance } from '../math.js';
import { biteDamage } from './feeding.js';
import { beginAttack, tickAttack, tickProjectiles } from './boss-attacks.js';
export function openBossGate(game) {
  const b = game.boss;
  if (!b || b.down || b.gate || b.resist > 0) return;
  b.attack = null; b.bullets.length = 0; b.areas.length = 0;
  const beatSeconds = game.song?.beatSeconds ?? game.song?.beatDuration ?? .6;
  b.gate = { age: 0, beats: T.boss.gateBeats, openedAt: game.time, duration: T.boss.gateTell + T.boss.gateBeats * beatSeconds };
  b.state = 'gate'; b.gateTimer = b.gate.duration; b.resist = 0;
  // A scripted answer must be startable even if the previous phase ended on a
  // Perfect release. Resource management still matters: breath is not refilled.
  game.song.cooldown = 0;
  if (game.player.breath < T.player.breathDrain * T.boss.gateBeats * beatSeconds) game.emit('notify', { text: '气息偏低，先收声恢复，再应答', ttl: T.boss.gateTell });
  game.emit('boss.gate', { key: b.key, phase: b.phase, beats: b.gate.beats, duration: b.gate.duration });
}
export function resolveBossGate(game, quality) {
  const b = game.boss;
  if (!b?.gate) return false;
  b.gate = null; b.resist = 0; b.gateTimer = 0;
  game.stats.gatePerfects = quality === 'Perfect' ? game.stats.gatePerfects + 1 : 0;
  game.stats.maxGatePerfects = Math.max(game.stats.maxGatePerfects, game.stats.gatePerfects);
  if (quality === 'Perfect' || quality === 'Good') {
    b.gateOpen = (quality === 'Perfect' ? T.boss.perfectOpen : T.boss.goodOpen) + (game.melodyCount >= 3 ? T.boss.melodyBonus : 0);
    b.stun = b.gateOpen; b.phaseGate = true; b.gateHits++; b.state = 'vulnerable';
    game.emit('notify', { text: quality === 'Perfect' ? '完美应答 · 她松开了防备' : '应答成功 · 猛扑靠近她', ttl: 2 });
  } else {
    b.resist = T.boss.missResist; b.recovery = 0; b.state = 'counter';
    const skill = b.spec.skills.find(s => s.key === b.spec.counterSkill) ?? b.spec.skills[0]; beginAttack(game, skill);
  }
  game.emit('boss.gate.result', { key: b.key, phase: b.phase, quality, duration: b.gateOpen }); return true;
}
function nextPhase(game) {
  const b = game.boss;
  b.phase++; b.phaseGate = false; b.attacksDone = 0; b.gate = null; b.attack = null; b.bullets.length = 0; b.areas.length = 0;
  b.recovery = T.boss.transitionRest; b.stun = 0; b.resist = 0; b.state = 'transition';
  game.emit('boss.phase', { key: b.key, phase: b.phase });
}
export function hitBoss(game) {
  const b = game.boss, p = game.player;
  if (!b || b.down || b.invuln > 0 || b.gate || p.biteWindow <= 0 || p.hitIds.has('boss')) return;
  if (distance(b, p) > b.r + T.tiers[p.tier].reach + T.bite.reachBonus) return;
  p.hitIds.add('boss');
  if (p.tier < T.boss.tierMin) { game.emit('notify', { text: '长到水缸级才能伤到她', ttl: 2 }); return; }
  let damage = biteDamage(p, { ...b, action: b.recovery > 0 ? 'recover' : b.state });
  if (p.tier === 2) damage *= T.boss.tier2Mul;
  damage *= b.instrumentMul;
  const floor = b.segmentHp * (3 - b.phase);
  b.hp = Math.max(b.phaseGate ? floor : floor + 1, b.hp - damage); b.invuln = T.boss.iframe;
  game.emit('boss.hurt', { key: b.key, amount: damage, back: isBehind(p, b), x: b.x, y: b.y });
  game.hitstop = T.player.hitstop;
  if (!b.phaseGate && b.hp <= floor + 1) openBossGate(game);
  else if (b.hp <= floor && b.phase < 3) nextPhase(game);
  else if (b.hp <= 0 && b.phase === 3) defeatBoss(game);
}
export function defeatBoss(game) {
  const b = game.boss;
  if (!b || b.down) return;
  b.down = true; b.hp = 0; b.attack = null; b.gate = null; b.bullets.length = 0; b.areas.length = 0;
  b.state = 'defeated'; b.defeatTimer = T.run.defeat; game.cancelHeld();
  game.stats.downs[b.key] = (game.stats.downs[b.key] ?? 0) + 1;
  game.emit('boss.down', { key: b.key, pose: b.spec.defeat.pose, duration: b.defeatTimer });
}
export function tickInstruments(game, dt) {
  const b = game.boss, p = game.player, rule = b.spec.instrument;
  for (const i of game.entities.instruments) {
    i.cd = Math.max(0, i.cd - dt);
    const reachable = i.w ? pointSegmentDistance(p, { x: i.x - i.w / 2, y: i.y }, { x: i.x + i.w / 2, y: i.y }) <= p.r + T.bite.reachBonus : distance(i, p) <= (i.r ?? 30) + T.world.instrumentReach;
    if (i.cd || p.biteWindow <= 0 || p.hitIds.has(i.id) || !reachable) continue;
    p.hitIds.add(i.id); i.cd = rule.cooldown ?? T.boss.instrumentCd;
    b.instrumentHits.push({ id: i.id, time: game.time });
    const interval = rule.window ?? T.bossAttack.instrumentWindow;
    b.instrumentHits = b.instrumentHits.filter(hit => game.time - hit.time <= interval);
    const count = new Set(b.instrumentHits.map(hit => hit.id)).size;
    const phase = game.song?.phase ?? 0, beat = Math.abs(phase - Math.round(phase));
    const sameBeat = beat * (game.song?.beatSeconds ?? .6) <= (game.melodyCount >= 3 ? .11 : .08);
    const success = count >= (rule.required ?? 1) && (b.key !== 'claude' || (p.singing && sameBeat));
    let stun = rule.singleStun ?? (b.key === 'qwen' ? .4 : b.key === 'claude' ? .5 : 0);
    if (success) { stun = b.key === 'claude' ? rule.onSameBeatSong.vulnerable : Math.max(rule.stun ?? 0, rule.vulnerable ?? 0); if (b.key === 'zhipu' && sameBeat) stun = rule.onSameBeat.stopAttacks; b.instrumentHits.length = 0; }
    if (stun) { b.stun = Math.max(b.stun, stun); b.attack = null; }
    if (success && b.key !== 'zhipu') { b.gateOpen = Math.max(b.gateOpen, b.key === 'claude' ? rule.onSameBeatSong.vulnerable : (rule.vulnerable ?? stun)); b.instrumentMul = rule.damageMul ?? 1.25; }
    if (success && (rule.clearProjectiles || ['qwen','claude'].includes(b.key))) { b.bullets.length = 0; b.areas.length = 0; }
    game.emit('instrument.hit', { key: i.key, boss: b.key, success, sameBeat, count, x: i.x, y: i.y });
  }
}
export function tickBoss(game, dt) {
  const b = game.boss;
  if (!b) return;
  b.prevX = b.x; b.prevY = b.y; b.timer += dt;
  if (b.down) { b.defeatTimer -= dt; if (b.defeatTimer <= 0) game.finish('CLEARED'); return; }
  for (const key of ['invuln','resist','stun','gateOpen','hidden']) b[key] = Math.max(0, b[key] - dt);
  b.hiddenPlayerTime = game.player.buffs.some(buff => buff.key === 'smoke') ? (b.hiddenPlayerTime ?? 0) + dt : 0;
  if (distance(b, game.player) > T.boss.disengage || b.hiddenPlayerTime > T.boss.hiddenDisengage) {
    b.x = b.home.x; b.y = b.home.y; b.attack = null; b.gate = null; b.bullets.length = 0; b.areas.length = 0;
    b.recovery = T.boss.transitionRest; b.state = 'return'; return;
  }
  if (!b.gateOpen) b.instrumentMul = 1;
  tickInstruments(game, dt); hitBoss(game);
  if (b.down) return;
  if (b.gate) { b.gate.age += dt; b.gateTimer = Math.max(0, b.gate.duration - b.gate.age); if (!b.gateTimer) resolveBossGate(game, 'Miss'); return; }
  tickProjectiles(game, dt);
  if (b.stun > 0) return;
  if (b.recovery > 0) { b.recovery = Math.max(0, b.recovery - dt); return; }
  if (!b.phaseGate && b.attacksDone >= T.boss.gateAfterAttacks && !b.resist) { openBossGate(game); return; }
  if (b.attack) tickAttack(game, dt);
  else {
    const skills = b.spec.phases[b.phase - 1].attacks;
    beginAttack(game, skills[b.sequence++ % skills.length]);
  }
}
