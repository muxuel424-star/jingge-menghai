import { UPGRADES, MISSIONS } from '../data/items.js';
import { SAVE_KEY, LEGACY_KEY, RANKS, ACHIEVEMENTS, META_RULES } from '../data/meta.js';
import { SPECIES_NOTES } from '../data/narrative.js';
const int = (v, lo = 0, hi = Number.MAX_SAFE_INTEGER) => Math.min(hi, Math.max(lo, Math.floor(Number(v) || 0)));
const unique = (a) => [...new Set(Array.isArray(a) ? a : [])];
const melodyIds = l => unique(l?.melodyIds).filter(i=>[0,1,2].includes(i));
const refreshUnlocks = d => { d.unlocks.awakening = Object.values(d.levels).every(l=>l.melodyIds.length===3); };
export function freshSave() {
  return {
    v: 2, pearls: 0, upg: { belly: 0, fin: 0, fat: 0, echo: 0 },
    levels: Object.fromEntries([1,2,3,4,5].map((n) => [n, { unlocked: n === 1, cleared: false, best: null, fragments: [0,0,0], melody: 0, melodyIds: [], runs: 0, failures: 0 }])),
    missions: { active: [], done: [], runComplete: [] }, codex: { species: [], fragments: [], hearts: [] },
    achievements: [], souvenirs: [], lastSeed: null, stats: { runs: 0, wins: 0, bestScore: 0, totalDreams: 0, totalEaten: 0, totalAbyss: 0 },
    unlocks: { awakening: false }, settings: { muted: false, shake: 1, quality: 'auto', contrast: false, assistance: false },
  };
}
export function validateSave(raw) {
  const d = freshSave();
  if (!raw || typeof raw !== 'object') return d;
  d.pearls = int(raw.pearls);
  d.lastSeed = Number.isFinite(raw.lastSeed) ? raw.lastSeed : null;
  for (const k of Object.keys(d.upg)) d.upg[k] = int(raw.upg?.[k], 0, 5);
  for (const k of Object.keys(d.levels)) {
    const a = raw.levels?.[k];
    if (!a) continue;
    Object.assign(d.levels[k], { unlocked: k === '1' || !!a.unlocked, cleared: !!a.cleared, best: RANKS.includes(a.best) ? a.best : null,
      fragments: [0,1,2].map((i) => a.fragments?.[i] ? 1 : 0), melody: int(a.melody, 0, 3), melodyIds: melodyIds(a), runs: int(a.runs), failures: int(a.failures) });
    if (d.levels[k].melody===3 && !d.levels[k].melodyIds.length) d.levels[k].melodyIds=[0,1,2];
    d.levels[k].melody=Math.max(d.levels[k].melody,d.levels[k].melodyIds.length);
  }
  for (const k of Object.keys(d.stats)) d.stats[k] = int(raw.stats?.[k]);
  d.codex.species=unique(raw.codex?.species).filter(k=>Object.hasOwn(SPECIES_NOTES,k));
  d.codex.fragments=unique(raw.codex?.fragments).filter(k=>/^[1-5]-[1-3]$/.test(k));
  d.codex.hearts=unique(raw.codex?.hearts).filter(k=>[1,2,3,4,5].includes(k));
  d.souvenirs = unique(raw.souvenirs).filter(k=>[1,2,3,4,5].includes(k));
  d.achievements = unique(raw.achievements).filter((id) => ACHIEVEMENTS.some((a) => a.id === id));
  d.missions.done = unique(raw.missions?.done).filter(id=>MISSIONS.some(m=>m.id===id));
  d.missions.active = unique(raw.missions?.active).filter((id) => MISSIONS.some((m) => m.id === id)).slice(0, 3);
  d.settings = { ...d.settings, muted: !!raw.settings?.muted, contrast: !!raw.settings?.contrast, assistance: !!raw.settings?.assistance,
    quality: ['auto','high','low'].includes(raw.settings?.quality)?raw.settings.quality:'auto', shake: Math.min(1, Math.max(0, Number.isFinite(+raw.settings?.shake)?+raw.settings.shake:1)) };
  refreshUnlocks(d);
  return d;
}
export function migrate(storage) {
  const current = storage.getItem(SAVE_KEY);
  if (current) return validateSave(JSON.parse(current));
  const old = storage.getItem(LEGACY_KEY);
  const d = freshSave();
  if (old) {
    const v1 = JSON.parse(old);
    d.pearls = int(v1.pearls);
    for (const k of Object.keys(d.upg)) d.upg[k] = int(v1.upg?.[k], 0, 5);
    d.stats.runs = int(v1.runs);
    try { storage.setItem(SAVE_KEY, JSON.stringify(d)); storage.removeItem(LEGACY_KEY); } catch { /* Keep the only persistent copy and use migrated data in memory. */ }
  }
  return d;
}
export class Meta {
  constructor(storage) {
    this.storage = storage; this.persistent = true; this.pending = null; this.settled = new WeakSet();
    this.data = freshSave();
    try { this.storage = storage ?? globalThis.localStorage; this.data = migrate(this.storage); }
    catch { this.persistent = false; }
    try { this.storage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch { this.persistent = false; }
    this.fillMissions();
  }
  get pearls() { return this.data.pearls; }
  get upg() { return this.data.upg; }
  get settings() { return this.data.settings; }
  get levels() { return this.data.levels; }
  get awakening() { return this.data.unlocks.awakening; }
  fillMissions() {
    const highest = Math.max(1, ...Object.entries(this.levels).filter(([,l]) => l.cleared).map(([k]) => +k));
    const pool = MISSIONS.filter((m) => m.level <= highest).sort((a,b) => Number(this.data.missions.done.includes(a.id)) - Number(this.data.missions.done.includes(b.id)));
    this.data.missions.active = pool.slice(0, 3).map((m) => m.id);
    this.data.missions.runComplete = [];
  }
  save(immediate = false) {
    clearTimeout(this.pending);
    if (immediate) return this.flush();
    this.pending = setTimeout(() => this.flush(), META_RULES.debounce);
  }
  flush() {
    clearTimeout(this.pending); this.pending = null;
    try { this.storage.setItem(SAVE_KEY, JSON.stringify(this.data)); return true; }
    catch { this.persistent = false; return false; }
  }
  buy(key) {
    const u = UPGRADES[key], lv = this.upg[key];
    if (!u || lv >= u.max || this.pearls < u.prices[lv]) return false;
    this.data.pearls -= u.prices[lv]; this.upg[key]++; this.save(true); return true;
  }
  settle(result, runStats = {}) {
    if (this.settled.has(result)) return result.receipt;
    const r = { ...runStats, ...result.stats, ...result };
    r.fragmentIds = Array.isArray(result.fragments) ? result.fragments : result.fragmentIds || [];
    r.fragments = result.stats?.fragments ?? (Array.isArray(result.fragments) ? result.fragments.length : result.fragments);
    r.melodies = result.stats?.melodies ?? (Array.isArray(result.melodies) ? result.melodies.length : result.melodies);
    r.rank = result.grade ?? result.rank;
    r.pearls = result.lootPearls ?? (result.wages === undefined ? result.pearls : 0);
    r.nightmaresSlept = result.stats?.nightmaresSlept ?? result.stats?.calmed ?? 0;
    r.souvenir = Number(!!(result.souvenir || result.stats?.souvenir));
    r.delivered = result.stats?.delivered ?? result.delivered ?? 0;
    r.species = (result.species || []).filter(k => ['fry','lantern','manta','royal','abyss','jelly','tapir','guard','nightmare'].includes(k));
    const n = int(result.level?.level ?? result.level ?? runStats.level, 1, 5);
    const l = this.levels[n], win = result.outcome === 'CLEARED' || result.win === true;
    r.win = win; r.hits ??= 0; r.bossHits ??= 0; r.seconds ??= result.time ?? 0;
    r.fragments ??= result.storyCount ?? 0; r.melodies ??= result.melodyCount ?? 0;
    r.score ??= 0; r.rank ??= 'C';
    const wage = int(r.score / META_RULES.scorePerPearl, META_RULES.minWage, META_RULES.maxWage);
    const first = win && !l.cleared ? META_RULES.firstClear : 0;
    const missionIds = Array.isArray(result.missionProgress) ? result.missionProgress.map(m=>m.id) : this.data.missions.active;
    const completed = MISSIONS.filter((m) => missionIds.includes(m.id) && (m.id!=='win'||n===5) && (
      m.comparison === 'equal' ? win && r[m.stat] === m.target :
      m.comparison === 'less' ? win && r[m.stat] <= m.target : (r[m.stat] || 0) >= m.target
    ));
    const taskPay = completed.reduce((s,m) => s + m.pearls, 0);
    const pay = Math.floor((wage + (r.pearls || 0) + taskPay + first) * (win ? 1 : META_RULES.failurePay));
    this.data.pearls += pay; l.runs++; l.cleared ||= win; l.failures=win?0:l.failures+1;
    this.data.lastSeed = result.seed ?? this.data.lastSeed;
    l.melodyIds = melodyIds({melodyIds:[...l.melodyIds,...(Array.isArray(result.melodies)?result.melodies:[])]});
    if (!Array.isArray(result.melodies) && r.melodies===3) l.melodyIds=[0,1,2];
    l.melody = Math.max(l.melody, l.melodyIds.length); refreshUnlocks(this.data);
    const seen = r.fragmentIds || [];
    for (let i=0; i<3; i++) if (seen.includes(i) || seen.includes(n + '-' + (i+1)) || (r.fragments > i && !seen.length)) l.fragments[i] = 1;
    if (win && RANKS.indexOf(r.rank) > RANKS.indexOf(l.best)) l.best = r.rank;
    if (win && n < 5) this.levels[n + 1].unlocked = true;
    const s = this.data.stats;
    s.runs++; s.wins += Number(win); s.bestScore = Math.max(s.bestScore, r.score);
    s.totalDreams += r.delivered || 0; s.totalEaten += r.eaten || 0; s.totalAbyss += r.abyss || 0;
    for (const k of r.species || []) if (!this.data.codex.species.includes(k)) this.data.codex.species.push(k);
    for (let i=0;i<3;i++) if (l.fragments[i] && !this.data.codex.fragments.includes(n+'-'+(i+1))) this.data.codex.fragments.push(n+'-'+(i+1));
    if (win && !this.data.codex.hearts.includes(n)) this.data.codex.hearts.push(n);
    if (r.souvenir && !this.data.souvenirs.includes(n)) this.data.souvenirs.push(n);
    const earned = ACHIEVEMENTS.filter((a) => !this.data.achievements.includes(a.id) && a.test(r, this.data));
    this.data.achievements.push(...earned.map((a) => a.id));
    this.data.missions.runComplete = completed.map((m) => m.id);
    this.data.missions.done = unique([...this.data.missions.done, ...this.data.missions.runComplete]);
    result.receipt = { pay, wage, first, taskPay, completed, earned, rank: r.rank, win, seconds: r.seconds, score: r.score, fragments: r.fragments, melodies: r.melodies, delivered: r.delivered || 0, hits: r.hits };
    this.settled.add(result); this.save(true); return result.receipt;
  }
}
