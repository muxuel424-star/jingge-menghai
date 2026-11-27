export const SAVE_KEY = 'jg_save_v2';
export const LEGACY_KEY = 'jg_hunt_save_v1';
export const RANKS = ['C', 'B', 'A', 'S'];
export const UPGRADE_NAMES = { belly: '大胃袋', fin: '鳍力', fat: '厚脂肪', echo: '回声鲸歌' };
export const MISSION_NAMES = {
  fry60: '吃掉60条小荧鱼', frag3: '找到三段心事', chain12: '梦链达到12条', perfect3: '三次完美鲸歌',
  clean: '无伤完成梦境', abyss1: '反杀巨口鮟鱇', melody: '集齐本关旋律', nohitboss: '无伤安抚前辈',
  fast: '十分钟内完成', tapir: '唱睡两只梦貘', hidden: '找到纪念品', win: '完成第五夜',
};
export const ACHIEVEMENTS = [
  { id: 'first', name: '第一盏灯', test: (r) => r.win },
  { id: 'clean', name: '衣角未湿', test: (r) => r.win && r.hits === 0 },
  { id: 'noDash', name: '慢慢游也好', test: (r) => r.win && r.dashSeconds === 0 },
  { id: 'calm', name: '用歌说晚安', test: (r) => r.nightmaresSlept >= 3 },
  { id: 'abyss', name: '一口勇气', test: (r) => r.abyss >= 1 },
  { id: 'abyss5', name: '深海不再怕', test: (_, m) => m.stats.totalAbyss >= 5 },
  { id: 'perfect3', name: '应答三连', test: (r) => r.maxGatePerfects >= 3 },
  { id: 'souvenirs', name: '替你收好', test: (_, m) => m.souvenirs.length === 5 },
  { id: 'stories', name: '听完心事', test: (_, m) => m.codex.fragments.length === 15 },
  { id: 'species', name: '深海朋友', test: (_, m) => m.codex.species.length === 9 },
  { id: 'allDreams', name: '五夜天明', test: (_, m) => Object.values(m.levels).every((l) => l.cleared) },
  { id: 'rankS', name: '满分派工单', test: (r) => r.rank === 'S' },
  { id: 'chain12', name: '一串月光', test: (r) => r.maxChain >= 12 },
  { id: 'fry60', name: '吃饱再出发', test: (r) => r.fry >= 60 },
  { id: 'melody', name: '找回旋律', test: (r) => r.melodies >= 3 },
  { id: 'giant', name: '鲸宫盛得下', test: (r) => r.tier === 2 },
  { id: 'shortcuts', name: '另一条路', test: (r) => r.shortcuts >= 2 },
  { id: 'delivery', name: '送梦人', test: (_, m) => m.stats.totalDreams >= 100 },
  { id: 'perfect10', name: '听见潮汐', test: (r) => r.perfects >= 10 },
  { id: 'bossClean', name: '轻声解开心结', test: (r) => r.win && r.bossHits === 0 },
];
export const META_RULES = { debounce: 500, minWage: 5, maxWage: 25, scorePerPearl: 400, failurePay: 0.3, firstClear: 30 };

