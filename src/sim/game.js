import { TUNING as T } from '../data/tuning.js';
import { LEVELS, BOSSES } from '../data/index.js';
import { RNG } from './rng.js';
import { EventBus } from './bus.js';
import { Song } from './song.js';
import { createPlayer } from './entities/player.js';
import { createFish } from './entities/fish.js';
import { createBoss } from './entities/boss.js';
import { clamp, normalize, distance } from './math.js';
import { setupWorld, respawnFish, enforceTierGates } from './systems/world.js';
import { movePlayer, tickResources } from './systems/movement.js';
import { tickItems, applyItem } from './systems/items.js';
import { tickFish, tickNightmares } from './systems/ecology.js';
import { startBite, tickFeeding, eat } from './systems/feeding.js';
import { tickDreams, applySongRelease } from './systems/dreams.js';
import { tickHazards } from './systems/hazards.js';
import { tickBoss, resolveBossGate, openBossGate, defeatBoss } from './systems/combat.js';
import { createStats, chooseMissions, makeResult } from './systems/scoring.js';

export const STATES = Object.freeze({ TITLE: 'TITLE', BRIEF: 'BRIEF', SURFACE: 'SURFACE', DESCENT: 'DESCENT', DEEP: 'DEEP', BOSS: 'BOSS', DAWN: 'DAWN' });
const EMPTY_INPUT = Object.freeze({ x: 0, y: 0, dash: false, bite: false, sing: false });
const findLevel = key => LEVELS.find(l => l.key === key || l.level === Number(key) || `level-0${l.level}` === key) ?? LEVELS[0];
export class Game {
  constructor({ level = 'bay', seed = 1, meta = {}, bus } = {}) {
    this.meta = meta; this.seed = seed; this.rng = new RNG(seed); this.bus = bus ?? new EventBus();
    this.level = findLevel(typeof level === 'object' ? level.key : level); this.levelKey = this.level.key;
    this.events = []; this.state = STATES.TITLE; this.nextId = 1; this.runSerial = 0;
    this.player = createPlayer(this.level.surface.spawn, meta); this.stats = createStats();
    this.storyFragments = new Set(); this.melodies = new Set(); this.seen = new Set(); this.usedShortcuts = new Set();
    this.time = 0; this.surfaceTime = 0; this.deepTime = 0; this.descentTime = 0; this.stateTime = 0;
    this.pearls = 0; this.delivered = 0; this.boss = null; this.result = null; this.ended = false;
    this.accumulator = 0; this.input = { ...EMPTY_INPUT }; this.conditions = {}; this.loopCount = 0; this.stillTime = 0;
    this.currentBeat = null; this.taught = new Set();
    this.setPressure(); this.createSong(); setupWorld(this, this.level.surface);
  }
  get fish() { return this.entities.fish; }
  get storyCount() { return this.storyFragments.size; }
  get melodyCount() { return this.melodies.size; }
  get songRadius() { return this.song?.radius ?? T.song.radius; }
  get chain() { return this.entities.dreamChain; }
  get buffs() { return this.player.buffs; }
  setPressure() { this.pressure = clamp(this.level.pressure, 1, T.pressure.length); this.pressureConfig = T.pressure[this.pressure - 1]; }
  createSong() { this.song = new Song({ level: this.level.level, echo: this.meta.upg?.echo ?? 0, onEvent: (type, payload) => this.onSong(type, payload) }); }
  emit(type, payload = {}) { this.events.push({ type, ...payload }); this.bus.emit(type, payload); }
  onSong(type, payload) {
    this.emit(type, payload);
    if (type !== 'song.release') return;
    const quality = String(payload.quality).charAt(0).toUpperCase() + String(payload.quality).slice(1).toLowerCase();
    this.player.singing = false;
    this.player.breath = Math.max(0, this.player.breath - (payload.breathPenalty ?? 0));
    applySongRelease(this, quality, payload.radius, payload.stun);
    if (payload.memBonus && ['DEEP','BOSS'].includes(this.state)) this.addMem(payload.memBonus, 0, 'song');
    if (quality === 'Perfect' && this.scene.fragments?.some(f => f.condition === 'perfectSong' && distance(this.player, f) <= this.songRadius)) this.conditions.perfectSong = true;
    if (this.boss?.gate) resolveBossGate(this, quality);
  }
  cancelHeld() {
    this.input = { ...EMPTY_INPUT }; this.song?.cancel('state'); this.blockHeld = true;
    if (this.player) { this.player.singing = false; this.player.dashing = false; this.player.biteWindow = 0; }
  }
  breakSong() { this.song?.cancel('dash'); this.player.singing = false; this.emit('song.break', {}); }
  transition(next) {
    if (next === this.state || (this.state === STATES.DAWN && next === STATES.DAWN)) return false;
    const from = this.state; this.cancelHeld(); this.state = next; this.stateTime = 0;
    if (next === STATES.DESCENT) this.descentTime = 0;
    if (next === STATES.DEEP) this.enterDeep();
    this.emit('state.change', { from, to: next }); return true;
  }
  start(key = this.level.key, { retry = false } = {}) {
    const previousLevel = this.level.key, previousResult = this.result;
    const nextLevel = findLevel(key), saved = this.meta.levels?.[nextLevel.level];
    const keep = retry && previousLevel === nextLevel.key;
    const knownFragments = retry ? [0,1,2].filter(id => saved?.fragments?.[id]) : [];
    const knownMelodies = retry ? (Array.isArray(saved?.melodyIds) ? saved.melodyIds.filter(id => [0,1,2].includes(id)) : saved?.melody >= 3 ? [0,1,2] : []) : [];
    const fragments = new Set([...knownFragments, ...(keep ? this.storyFragments : [])]);
    const melodies = new Set([...knownMelodies, ...(keep && previousResult?.outcome === 'DEVOURED' ? this.melodies : [])]);
    const delivered = keep ? this.delivered : 0;
    this.cancelHeld(); this.level = findLevel(key); this.levelKey = this.level.key; this.setPressure();
    this.rng = new RNG(this.seed); this.runSerial++; this.nextId = 1; this.events.length = 0;
    this.storyFragments = fragments; this.melodies = melodies; this.seen = new Set(); this.usedShortcuts = new Set();
    this.stats = createStats(); this.stats.fragments = fragments.size; this.stats.melodies = melodies.size;
    this.delivered = delivered; this.pearls = 0; this.result = null; this.ended = false; this.boss = null;
    this.time = 0; this.surfaceTime = 0; this.deepTime = 0; this.stateTime = 0; this.accumulator = 0; this.descentTime = 0;
    this.conditions = {}; this.stillTime = 0; this.loopCount = 0; this.hitstop = 0; this.evolutionTimer = 0; this.counterkill = null; this.souvenir = null; this.targetGrace = 0; this.lastGateHint = -Infinity;
    this.currentBeat = null; this.taught = new Set();
    this.player = createPlayer(this.level.surface.spawn, this.meta); this.createSong();
    setupWorld(this, this.level.surface); this.missions = chooseMissions(this); this.riftOpen = false;
    this.state = STATES.TITLE; this.transition(retry ? STATES.DESCENT : STATES.BRIEF); return this;
  }
  begin() { if (this.state === STATES.BRIEF) this.transition(STATES.SURFACE); return this; }
  confirmBrief() { return this.begin(); }
  retry() { return this.start(this.level.key, { retry: true }); }
  enterDeep() {
    this.player = createPlayer(this.level.deep.spawn, this.meta, this.delivered);
    this.createSong(); setupWorld(this, this.level.deep); this.conditions = {}; this.loopCount = 0; this.stillTime = 0; this.currentBeat = null;
    this.emit('notify', { text: '吞下忆质，长成能推开梦门的样子', ttl: 4 });
  }
  enterBoss() {
    if (this.state !== STATES.DEEP) return false;
    const lowTierFallback = this.deepTime >= T.run.bossFallback && this.player.tier < T.boss.tierMin;
    const spec = BOSSES[this.level.boss], arena = spec.arena;
    const scene = { ...arena, layer: 'boss', theme: this.level.key, width: arena.width, height: arena.height, solids: arena.cover ?? [], instruments: arena.instruments, spawn: { x: arena.width * .22, y: arena.height * .55 }, mainPath: [] };
    setupWorld(this, scene); this.player.x = scene.spawn.x; this.player.y = scene.spawn.y; this.player.prevX = this.player.x; this.player.prevY = this.player.y;
    this.boss = createBoss(spec, { x: arena.width * .72, y: arena.height * .5 });
    this.boss.instrument = this.entities.instruments[0] ?? null;
    this.transition(STATES.BOSS);
    if (lowTierFallback) {
      const count = Math.ceil((T.tiers[T.boss.tierMin].mem - this.player.mem) / T.mem.crystal);
      const columns = T.boss.fallbackFoodColumns, gap = T.boss.fallbackFoodGap;
      for (let index = 0; index < count; index++) {
        const item = { id: this.nextId++, key: 'crystal', x: scene.spawn.x + T.boss.fallbackFoodOffset + index % columns * gap, y: scene.spawn.y + (Math.floor(index / columns) - Math.floor(count / columns) / 2) * gap, collected: false };
        this.terrain.resolve(item, T.world.pickupRadius / 2, T.boss.tierMin); this.entities.pickups.push(item);
      }
      this.emit('notify', { text: '先吃忆质，长到水缸', ttl: T.run.defeat });
    }
    this.emit('boss.enter', { key: this.boss.key }); return true;
  }
  skipDescent() {
    if (this.state === STATES.DESCENT) this.descentTime = Math.max(this.descentTime, T.run.descent - T.run.descentSkip);
    else if (this.boss?.down) this.boss.defeatTimer = 0;
    else if (this.evolutionTimer > 0) this.evolutionTimer = Math.min(this.evolutionTimer, T.player.evolutionSkip);
  }
  collectMelody(id) {
    if (this.melodies.has(id)) return false;
    this.melodies.add(id); const melody = this.entities.melodies.find(m => m.id === id); if (melody) melody.collected = true;
    this.stats.melodies = this.melodyCount; this.emit('melody.collect', { id, count: this.melodyCount, x: melody?.x ?? this.player.x, y: melody?.y ?? this.player.y }); return true;
  }
  checkCondition(condition) {
    if (!condition) return true;
    if (condition === 'lowPass') return this.player.y > this.scene.height * .65;
    return Boolean(this.conditions[condition]);
  }
  releaseDreams(position, count) {
    for (let i = 0; i < count; i++) {
      const f = createFish('dreamfish', position.x + this.rng.range(-80, 80), position.y + this.rng.range(-60, 60), this.nextId++, this.rng);
      this.terrain.resolve(f, f.r, 2); this.fish.push(f);
    }
  }
  scatterDreams(count = T.chain.scatterOnHit, swallowed = false) {
    const lost = this.chain.splice(Math.max(0, this.chain.length - count));
    if (!swallowed) for (const f of lost) this.releaseDreams(f, 1);
    if (lost.length) this.emit('dream.scatter', { count: lost.length, swallowed }); return lost.length;
  }
  addMem(amount, food, kind = 'fry') {
    const p = this.player;
    p.mem += amount;
    if (kind !== 'song') {
      p.stability = Math.min(100, p.stability + food); p.hp = Math.min(p.maxHp, p.hp + T.player.hpPerFood);
      p.combo = p.comboTimer > 0 ? p.combo + 1 : 1; p.comboTimer = T.combo.window;
      const multiplier = Math.min(T.combo.maxMul, 1 + Math.floor(p.combo / T.combo.step) * T.combo.scoreStep);
      this.stats.score += Math.round(amount * T.economy.pointsPerMem * multiplier * (p.frenzy ? T.combo.frenzyMul : 1));
      p.satiety += T.combo.satietyPerFood;
      if (p.satiety >= 100) { p.satiety = 0; p.frenzy = T.combo.frenzyHold; this.emit('frenzy', { duration: p.frenzy }); }
    }
    const tier = T.tiers.findLastIndex(t => p.mem >= t.mem);
    if (tier > p.tier) {
      const oldMax = p.maxHp; p.tier = tier; p.size = T.tiers[tier].size; p.r = T.player.radius * p.size; p.maxHp = T.tiers[tier].hp * (1 + (this.meta.upg?.fat ?? 0) * T.upgrade.fat);
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp - oldMax); this.evolutionTimer = T.player.evolutionStop;
      this.terrain.resolve(p); this.cancelHeld(); this.emit('evolve', { tier, name: T.tiers[tier].name, x: p.x, y: p.y });
    }
  }
  damagePlayer(amount, by = 'unknown', source = null) {
    const p = this.player;
    if (this.ended || p.invuln > 0 || this.counterkill || this.boss?.down) return false;
    if (p.shield > 0) { p.shield--; p.invuln = .85; this.emit('shield.break', { charges: p.shield, x: p.x, y: p.y }); return false; }
    const damage = amount * (p.singing ? T.player.hurtMulWhileSinging : 1);
    p.hp = Math.max(0, p.hp - damage); p.invuln = T.player.iframeHit; p.hurtTimer = T.player.iframeHit;
    const direction = source ? normalize(p.x - source.x, p.y - source.y) : { x: -p.dir, y: 0 };
    p.vx = direction.x * T.player.hurtKnock; p.vy = direction.y * T.player.hurtKnock + T.player.hurtLift;
    p.x += p.vx * T.sim.step; p.y += p.vy * T.sim.step; this.terrain.resolve(p);
    this.stats.hits++; if (this.state === STATES.BOSS) this.stats.bossHits++;
    this.seen.add(by); this.scatterDreams(); this.emit('hurt', { by, amount: damage, x: p.x, y: p.y, fromX: source?.x, fromY: source?.y });
    if (!p.hp) this.finish(this.state === STATES.SURFACE ? 'RESCUED' : 'DEVOURED'); return true;
  }
  finish(outcome = 'CLEARED') {
    if (this.ended || this.state === STATES.DAWN) return false;
    this.ended = true; this.result = makeResult(this, outcome); this.transition(STATES.DAWN);
    this.emit('run.finish', this.result); return this.result;
  }
  applyItem(key) { return applyItem(this, key); }
  openBossGate() { return openBossGate(this); }
  resolveBossGate(quality) { return resolveBossGate(this, quality); }
  defeatBoss() { return defeatBoss(this); }
  step(dt, input = EMPTY_INPUT) {
    this.events.length = 0;
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.input = { ...EMPTY_INPUT, ...input };
    if (this.blockHeld) {
      if (!input.sing && !input.bite && !input.dash) this.blockHeld = false;
      else this.input = { ...this.input, sing: false, bite: false, dash: false };
    }
    this.accumulator += Math.min(dt, T.sim.maxDt);
    let count = 0;
    while (this.accumulator + T.sim.epsilon >= T.sim.step && count < T.sim.maxSteps) {
      this.accumulator = Math.max(0, this.accumulator - T.sim.step); this.tick(T.sim.step); count++;
    }
    if (count === T.sim.maxSteps) this.accumulator = Math.min(this.accumulator, T.sim.step);
  }
  tick(dt) {
    if ([STATES.TITLE, STATES.BRIEF, STATES.DAWN].includes(this.state)) return;
    const p = this.player; p.prevX = p.x; p.prevY = p.y;
    this.stateTime += dt;
    if (this.state === STATES.DESCENT) { this.descentTime += dt; if (this.descentTime >= T.run.descent) this.transition(STATES.DEEP); return; }
    if (this.counterkill) { this.counterkill.remaining -= dt; if (this.counterkill.remaining <= 0) { eat(this, this.counterkill.fish); this.pearls += T.economy.abyss; this.counterkill = null; } return; }
    if (this.evolutionTimer > 0) { this.evolutionTimer = Math.max(0, this.evolutionTimer - dt); return; }
    if (this.hitstop > 0) { this.hitstop = Math.max(0, this.hitstop - dt); return; }
    this.targetGrace = Math.max(0, (this.targetGrace ?? 0) - dt);
    if (this.boss?.down) { tickBoss(this, dt); return; }
    if (this.state === STATES.BOSS && this.boss.state === 'intro' && this.boss.timer < T.boss.intro) { tickBoss(this, dt); return; }
    this.time += dt;
    if (this.state === STATES.SURFACE) this.surfaceTime += dt;
    if (this.state === STATES.DEEP) this.deepTime += dt;
    this.song.step(dt, { held: this.input.sing, canSing: p.breath > 0 && !p.dashing, response: this.melodyCount >= 3, x: p.x, y: p.y });
    p.singing = Boolean(this.song.active);
    tickResources(this, dt); if (this.ended) return;
    if (this.input.bite) startBite(this);
    movePlayer(this, dt, this.input); enforceTierGates(this);
    tickItems(this, dt); tickHazards(this, dt);
    if (this.state === STATES.BOSS) { tickBoss(this, dt); if (!this.ended) tickFeeding(this); }
    else { tickFish(this, dt); tickNightmares(this, dt); tickFeeding(this); tickDreams(this, dt); respawnFish(this, dt); }
    if (p.hp <= 0 && !this.ended) this.finish(this.state === STATES.SURFACE ? 'RESCUED' : 'DEVOURED');
  }
  snapshot() {
    const p = this.player;
    return { state: this.state, level: this.level.key, seed: this.seed, rng: [...this.rng.state], time: this.time,
      player: { x: p.x, y: p.y, hp: p.hp, mem: p.mem, tier: p.tier, stability: p.stability, breath: p.breath, dash: p.dash },
      delivered: this.delivered, fragments: [...this.storyFragments], melodies: [...this.melodies],
      fish: this.fish.map(f => [f.id, f.kind, f.x, f.y, f.action, f.eaten]), boss: this.boss ? { hp: this.boss.hp, phase: this.boss.phase, gate: this.boss.gate, sequence: this.boss.sequence } : null,
      stats: structuredClone(this.stats) };
  }
}
export { Game as CampaignGame };
export default Game;
