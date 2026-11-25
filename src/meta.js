/* ============================================================
   鲸宫小金库：局外成长（珍珠存档 · 永久升级 · 夜班任务 · 纪录）
   存在 localStorage，读写失败时退化成本局内存，不影响游玩。
   ============================================================ */

const KEY = 'jg_hunt_save_v1';
export const WAGE_PER = 400;          // 每 400 分折 1 颗珍珠的夜班工资

export const UPGRADES = [
  { key: 'belly', name: '大胃袋', desc: (l) => `饱食度消耗 −${l * 8}%`, cost: [15, 30, 55, 90, 140] },
  { key: 'fin', name: '鳍力', desc: (l) => `游速 +${l * 4}%`, cost: [15, 30, 55, 90, 140] },
  { key: 'fat', name: '厚脂肪', desc: (l) => `生命上限 +${l * 10}%`, cost: [15, 30, 55, 90, 140] },
  { key: 'echo', name: '回声鲸歌', desc: (l) => `冷却 −${(l * 0.8).toFixed(1)} 秒 · 定得更久更远`, cost: [20, 40, 70, 110, 160] },
];
export const MAX_LV = 5;

// 一局之内完成的任务；lv = 大约要长到第几阶才做得到；prog(s) 从本局统计里取进度
const MISSIONS = [
  { id: 'fry60', lv: 0, text: '一局吃掉 60 条小荧鱼', goal: 60, reward: 12, prog: (s) => s.kind.fry },
  { id: 'fry150', lv: 1, text: '一局吃掉 150 条小荧鱼', goal: 150, reward: 25, prog: (s) => s.kind.fry },
  { id: 'lan15', lv: 1, text: '一局吃掉 15 条灯笼鱼', goal: 15, reward: 18, prog: (s) => s.kind.lantern },
  { id: 'manta6', lv: 2, text: '一局吃掉 6 只夜光鳐', goal: 6, reward: 25, prog: (s) => s.kind.manta },
  { id: 'grok', lv: 1, text: '撞晕 Grok 前辈', goal: 1, reward: 15, prog: (s) => s.downs.grok || 0 },
  { id: 'qwen', lv: 2, text: '撞晕千问前辈', goal: 1, reward: 22, prog: (s) => s.downs.qwen || 0 },
  { id: 'gemini', lv: 3, text: '撞晕 Gemini 前辈', goal: 1, reward: 30, prog: (s) => s.downs.gemini || 0 },
  { id: 'zhipu', lv: 4, text: '撞晕智谱前辈', goal: 1, reward: 40, prog: (s) => s.downs.zhipu || 0 },
  { id: 'frenzy2', lv: 0, text: '一局触发 2 次狂食', goal: 2, reward: 15, prog: (s) => s.frenzies },
  { id: 'frenzy5', lv: 2, text: '一局触发 5 次狂食', goal: 5, reward: 35, prog: (s) => s.frenzies },
  { id: 'salary2', lv: 0, text: '一局哄睡 2 个迷路的上班族', goal: 2, reward: 20, prog: (s) => s.salary },
  { id: 'stage3', lv: 2, text: '一局长到「女仆长」', goal: 3, reward: 25, prog: (s) => s.stage },
  { id: 'survive5', lv: 1, text: '一局存活 5 分钟', goal: 300, reward: 20, prog: (s) => Math.floor(s.time), fmt: (v) => `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}` },
  { id: 'score8k', lv: 1, text: '一局拿到 8000 分', goal: 8000, reward: 20, prog: (s) => s.score },
  { id: 'score20k', lv: 3, text: '一局拿到 20000 分', goal: 20000, reward: 40, prog: (s) => s.score },
  { id: 'stun6', lv: 1, text: '一局用鲸歌定住 6 次前辈', goal: 6, reward: 18, prog: (s) => s.stuns },
  { id: 'clean', lv: 1, text: '一次都不挨撞，长到「女仆领班」', goal: 2, reward: 30, prog: (s) => s.cleanStage },
  { id: 'clam8', lv: 0, text: '一局捡 8 个珍珠贝', goal: 8, reward: 15, prog: (s) => s.clams },
  { id: 'gold1', lv: 0, text: '捡到一颗金珍珠', goal: 1, reward: 15, prog: (s) => s.gold },
  { id: 'combo20', lv: 0, text: '一次连吃 20 口', goal: 20, reward: 15, prog: (s) => s.maxCombo },
  { id: 'combo60', lv: 2, text: '一次连吃 60 口', goal: 60, reward: 35, prog: (s) => s.maxCombo },
  { id: 'crystal4', lv: 0, text: '一局咬碎 4 个梦糖晶簇', goal: 4, reward: 15, prog: (s) => s.crystals },
  { id: 'chest2', lv: 1, text: '一局打开 2 个宝箱', goal: 2, reward: 20, prog: (s) => s.chests },
  { id: 'interrupt3', lv: 2, text: '一局打断前辈的招式 3 次', goal: 3, reward: 25, prog: (s) => s.interrupts },
  { id: 'ring10', lv: 0, text: '一局穿过 10 个洋流环', goal: 10, reward: 12, prog: (s) => s.rings },
  { id: 'geyser3', lv: 1, text: '被热泉弹飞 3 次', goal: 3, reward: 12, prog: (s) => s.geysers },
  { id: 'win', lv: 5, text: '长成深海之主，撞晕 Claude 女仆长', goal: 1, reward: 80, prog: (s) => s.win },
];
const MISSION_BY_ID = Object.fromEntries(MISSIONS.map((m) => [m.id, m]));
// 开档先给容易上手的三条
const FIRST = ['combo20', 'crystal4', 'grok'];

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* 隐私模式 / 被禁用：用内存档 */ }
  return null;
}

export class Meta {
  constructor() {
    const d = load() || {};
    this.pearls = d.pearls | 0;
    this.upg = { belly: 0, fin: 0, fat: 0, echo: 0, ...(d.upg || {}) };
    this.best = { score: 0, stage: 0, wins: 0, ...(d.best || {}) };
    this.runs = d.runs | 0;
    this.done = Array.isArray(d.done) ? d.done : [];          // 曾经完成过的任务 id
    this.active = (Array.isArray(d.active) ? d.active : []).filter((id) => MISSION_BY_ID[id]);
    this.fillMissions();
    this.run = null;
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        pearls: this.pearls, upg: this.upg, best: this.best, runs: this.runs, done: this.done, active: this.active,
      }));
    } catch (e) { /* 存不了就算了 */ }
  }

  fillMissions() {
    const fresh = MISSIONS.filter((m) => !this.active.includes(m.id) && !this.done.includes(m.id));
    let pool = fresh.length ? fresh : MISSIONS.filter((m) => !this.active.includes(m.id));
    // 只抽够得着的：难度不超过“最远进度 + 1 阶”
    const reach = pool.filter((m) => m.lv <= this.best.stage + 1);
    if (reach.length) pool = reach;
    while (this.active.length < 3 && pool.length) {
      const first = FIRST.find((id) => pool.some((m) => m.id === id));
      const i = first ? pool.findIndex((m) => m.id === first) : Math.floor(Math.random() * pool.length);
      this.active.push(pool.splice(i, 1)[0].id);
    }
  }

  /* ---- 升级 ---- */

  lv(key) { return this.upg[key] | 0; }

  costOf(key) {
    const u = UPGRADES.find((x) => x.key === key);
    const l = this.lv(key);
    return l >= MAX_LV ? null : u.cost[l];
  }

  buy(key) {
    const c = this.costOf(key);
    if (c === null || this.pearls < c) return false;
    this.pearls -= c;
    this.upg[key] = this.lv(key) + 1;
    this.save();
    return true;
  }

  // 捕食模式读取的加成
  get mods() {
    return {
      hunger: 1 - 0.08 * this.lv('belly'),
      speed: 1 + 0.04 * this.lv('fin'),
      hp: 1 + 0.1 * this.lv('fat'),
      songCd: 7 - 0.8 * this.lv('echo'),
      stun: 2.8 + 0.4 * this.lv('echo'),
      songR: 1 + 0.08 * this.lv('echo'),
    };
  }

  /* ---- 一局 ---- */

  beginRun() {
    this.run = { complete: new Set(), reward: 0 };
  }

  missionList() {
    return this.active.map((id) => MISSION_BY_ID[id]);
  }

  // 每帧（节流后）检查任务；返回本次新完成的任务
  check(s) {
    if (!this.run) return [];
    const out = [];
    for (const m of this.missionList()) {
      if (this.run.complete.has(m.id)) continue;
      if (m.prog(s) >= m.goal) {
        this.run.complete.add(m.id);
        this.run.reward += m.reward;
        out.push(m);
      }
    }
    return out;
  }

  progressText(m, s) {
    const v = Math.min(m.goal, m.prog(s));
    if (this.run?.complete.has(m.id)) return '完成';
    if (m.goal === 1) return '未完成';
    return m.fmt ? `${m.fmt(v)} / ${m.fmt(m.goal)}` : `${v} / ${m.goal}`;
  }

  // 结算：把本局珍珠存进金库，换掉完成的任务，记纪录
  endRun(s, runPearls) {
    const wage = Math.floor(s.score / WAGE_PER);
    const mission = this.run ? this.run.reward : 0;
    const finished = this.missionList().filter((m) => this.run?.complete.has(m.id));
    const total = runPearls + wage + mission;
    this.pearls += total;
    this.runs++;
    const record = s.score > this.best.score;
    const prevBest = this.best.score;
    if (record) this.best.score = s.score;
    this.best.stage = Math.max(this.best.stage, s.stage);
    if (s.win) this.best.wins++;
    for (const m of finished) if (!this.done.includes(m.id)) this.done.push(m.id);
    this.active = this.active.filter((id) => !finished.some((m) => m.id === id));
    this.fillMissions();
    this.run = null;
    this.save();
    return { runPearls, wage, mission, total, finished, record, prevBest, bank: this.pearls };
  }
}
