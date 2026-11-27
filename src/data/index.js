export { DIALOGUE, text } from './dialogue.js';
export { SPECIES, SPECIES_LIST } from './species.js';
export { ITEMS, ITEM_RULES, UPGRADES, MELODIES, MISSIONS } from './items.js';
export { BOSS_RULES } from './bosses/shared.js';
import { LEVEL_01 } from './levels/level-01.js';
import { LEVEL_02 } from './levels/level-02.js';
import { LEVEL_03 } from './levels/level-03.js';
import { LEVEL_04 } from './levels/level-04.js';
import { LEVEL_05 } from './levels/level-05.js';
import { GROK } from './bosses/grok.js';
import { QWEN } from './bosses/qwen.js';
import { GEMINI } from './bosses/gemini.js';
import { ZHIPU } from './bosses/zhipu.js';
import { CLAUDE } from './bosses/claude.js';

export const LEVELS = [LEVEL_01, LEVEL_02, LEVEL_03, LEVEL_04, LEVEL_05];
export const BOSSES = { grok: GROK, qwen: QWEN, gemini: GEMINI, zhipu: ZHIPU, claude: CLAUDE };
export const LEVEL_BY_KEY = Object.fromEntries(LEVELS.map(level => [level.key, level]));
