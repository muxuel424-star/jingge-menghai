import { AudioEngine } from '../audio.js';
import { Meta, MAX_LV, UPGRADES } from '../meta.js';
import { MAPS, PREY, RIVALS, STAGES } from '../ocean-data.js';
import { TOTAL_TIME, START_INSOMNIA, clamp, displayTime, dist } from './core.js';
import { DreamDive } from './dream.js';
import { HuntDive } from './hunt.js';
import { OceanView } from './view.js';
import { regionAt } from './reefs.js';
import { bossStatus } from './boss.js';
import { drawSeaMap } from './sea-map.js';

const $ = id => document.getElementById(id);
const show = (id, visible) => $(id).classList.toggle('hidden', !visible);
const text = (id, value) => {
  const el = $(id);
  if (el.textContent !== String(value)) el.textContent = value;
};
const fill = (id, ratio) => {
  const value = clamp(ratio, 0, 1).toFixed(3);
  const el = $(id);
  if (el.style.getPropertyValue('--amount') !== value) el.style.setProperty('--amount', value);
};
const screens = ['title', 'huntIntro', 'pause', 'end', 'huntEnd'];
const audio = new AudioEngine();
const meta = new Meta();
const view = new OceanView($('c'));
const keys = new Set();
const pointers = new Map();
const mouse = new Set();
const moveKeys = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyC', 'KeyQ'];
let screen = 'title';
let dive;
let lastMap = -1;
let lastTime = performance.now();
let visualTime = 0;
let hudTimer = 0;

function switchScreen(next) {
  screen = next;
  for (const name of screens) show(name, next === name);
  show('playHud', next === 'play');
  keys.clear();
  mouse.clear();
  pointers.clear();
  document.querySelectorAll('[data-touch].pressed').forEach(button => button.classList.remove('pressed'));
}

function start(kind) {
  audio.init();
  audio.suspend(false);
  audio.setDread(0);
  dive = kind === 'hunt' ? new HuntDive(audio, meta, endHunt) : new DreamDive(audio, endDream);
  dive.start();
  lastMap = -1;
  view.snap = true;
  hudTimer = 0;
  $('seaChart').classList.remove('expanded');
  switchScreen('play');
  show('huntStats', kind === 'hunt');
  show('dreamStats', kind === 'dream');
  show('touchBite', kind === 'hunt');
  show('btnReturn', kind === 'hunt');
  text('keyHelp', kind === 'hunt'
    ? 'WASD / 方向键 游动  ·  按住 J / 左键 猛扑  ·  F / 右键 鲸歌  ·  Shift 冲刺  ·  Tab 海图'
    : 'WASD / 方向键 游动  ·  按住 F / 左键 唱鲸歌  ·  Shift 冲刺  ·  Esc 暂停');
  renderHud();
}

function pause() {
  if (screen === 'play') {
    dive.cancelHeld?.();
    if (dive.singing) dive.singing = false;
    audio.songOff();
    audio.suspend(true);
    switchScreen('pause');
  } else if (screen === 'pause') {
    audio.suspend(false);
    switchScreen('play');
    renderHud();
  }
}

function toTitle() {
  dive = null;
  audio.songOff();
  audio.suspend(false);
  audio.setDread(0);
  switchScreen('title');
}

function buildMeta() {
  $('metaMissions').innerHTML = meta.missionList().map(m =>
    '<div class="mrow"><span>' + m.text + '</span><span class="rw">珍珠 ' + m.reward + '</span></div>').join('');
  text('metaPearls', meta.pearls);
  $('metaUpg').innerHTML = UPGRADES.map(u => {
    const level = meta.lv(u.key);
    const cost = meta.costOf(u.key);
    const pips = '●'.repeat(level) + '<s>' + '●'.repeat(MAX_LV - level) + '</s>';
    const button = cost === null ? '<button class="ubuy" disabled>已满级</button>'
      : '<button class="ubuy" data-k="' + u.key + '"' + (meta.pearls < cost ? ' disabled' : '') + '>珍珠 ' + cost + '</button>';
    const description = (level ? u.desc(level) : '未升级') + (cost === null ? '' : ' → ' + u.desc(level + 1));
    return '<div class="urow"><div class="un">' + u.name + '<i>' + pips + '</i></div>' + button
      + '<div class="ud">' + description + '</div></div>';
  }).join('');
  const best = meta.best;
  text('metaRecord', meta.runs
    ? '最高分 ' + best.score + ' · 最远长到「' + STAGES[best.stage]?.name + '」 · 通关 ' + best.wins + ' 次 · 已下潜 ' + meta.runs + ' 次'
    : '第一次下潜，先把小荧鱼吃个痛快吧。');
}

function openHunt() {
  $('huntLadder').innerHTML = STAGES.map((stage, i) => {
    const prey = Object.values(PREY).find(p => p.tier === i);
    const rival = RIVALS.find(r => r.tier === i);
    return '<div class="st"><div class="n">第 ' + (i + 1) + ' 阶</div><div class="k">' + stage.name
      + '</div><div class="u">' + [prey && '能吃：' + prey.name, rival && rival.mapName].filter(Boolean).join('<br>') + '</div></div>';
  }).join('');
  buildMeta();
  switchScreen('huntIntro');
}

function setRank(id, rank) {
  text(id, rank);
  $(id).dataset.rank = rank;
}

function endDream(result) {
  const rank = result !== 'win' ? 'C' : dive.timeLeft >= 150 ? 'S' : dive.timeLeft >= 60 ? 'A' : 'B';
  const titles = { S: '特级女仆', A: '正式女仆', B: '见习女仆（续签）', C: '还是先去刷碗吧' };
  setRank('eRank', rank);
  text('eTitle', result === 'win' ? '满城入睡' : '天亮了');
  text('eSub', titles[rank]);
  text('eText', result === 'win' ? '所有迷路的梦都回到了月光井。' : '城里还有 ' + dive.insomnia + ' 个人醒着。');
  const s = dive.stats;
  const rows = [['送回的梦', s.delivered], ['唱睡的噩梦', s.purified], ['单趟最多', s.best],
    ['金色的梦', s.gold], ['被叼散', s.stolen], ['用时', displayTime(TOTAL_TIME - dive.timeLeft)]];
  $('eStats').innerHTML = rows.map(([k, v]) => '<div><span>' + k + '</span><b>' + v + '</b></div>').join('');
  switchScreen('end');
}

function endHunt(result, by) {
  const titles = { win: '深海之主', starve: '饿晕了', rival: '被撞晕了', return: '满载返航' };
  const notes = {
    win: '鲸宫的走廊又多了一幅画像。画里的大肥鱼手里还是那只饭碗。',
    starve: '大肥鱼在海底睡着了，梦里全是饭。下次记得边游边吃。',
    return: '把这次收集的珍珠带回鲸宫，准备下一次下潜。',
    rival: (by || '前辈') + '把你撞回了鲸宫。先吃到对应体型，闪开预警后抓住收招破绽。',
  };
  setRank('heRank', result === 'win' ? 'S' : dive.stage >= 4 ? 'A' : dive.stage >= 2 ? 'B' : 'C');
  text('heTitle', titles[result]);
  text('heSub', '最终形态 · ' + STAGES[dive.stage].name);
  text('heText', notes[result]);
  const s = dive.stats;
  const rows = [['捕食分数', dive.score], ['珍珠', dive.pearls], ['吃掉猎物', s.eaten], ['击溃首领', s.rivals],
    ['探索海域', dive.visitedMaps.size + ' / 5'], ['制霸海域', dive.clearedMaps.size + ' / 5'], ['最高连吞', s.maxCombo],
    ['开宝箱', s.chests], ['咬碎晶簇', s.crystals], ['打断招式', s.interrupts], ['哄睡上班族', s.salary], ['存活', displayTime(dive.time)]];
  $('heStats').innerHTML = rows.map(([k, v], i) =>
    '<div style="--d:' + (0.4 + i * 0.05).toFixed(2) + 's"><span>' + k + '</span><i></i><b>' + v + '</b></div>').join('');
  const bank = meta.endRun(dive.missionStats, dive.pearls);
  if (bank.record) $('heSub').insertAdjacentHTML('beforeend', '<span class="recTag">新纪录</span>');
  $('heBank').innerHTML = '存进小金库 <span class="tot">+' + bank.total + '</span> 颗珍珠（现有 ' + bank.bank + '）<br>'
    + '捡到 ' + bank.runPearls + ' · 夜班工资 ' + bank.wage + ' · 任务 ' + bank.mission
    + (bank.finished.length ? '<br>' + bank.finished.map(m => '✓ ' + m.text + '（+' + m.reward + '）').join('<br>') : '');
  switchScreen('huntEnd');
}

function renderHud() {
  const game = dive;
  if (!game) return;
  const hunt = !!game.zone;
  const region = hunt ? regionAt(game.reef, game.player.x) : null;
  text('runMap', hunt ? MAPS[game.map].short + ' · ' + region.name : '月光梦海');
  text('runNotice', game.messageT > 0 ? game.message : '');
  if (hunt) {
    const next = STAGES[game.stage + 1];
    const xp = STAGES[game.stage].xp;
    const edible = Object.values(PREY).filter(prey => prey.tier <= game.stage).at(-1);
    text('runObjective', '可捕食 ' + edible.name + ' · 击败首领 ' + game.clearedMaps.size + '/5');
    drawSeaMap($('seaMap'), game);
    text('foodValue', Math.ceil(game.hunger) + ' / 100');
    fill('foodBar', game.hunger / 100);
    text('healthValue', Math.ceil(game.hp) + ' / ' + Math.ceil(game.maxHp));
    fill('healthBar', game.hp / game.maxHp);
    text('stageName', STAGES[game.stage].name);
    text('stageValue', next ? game.xp + ' / ' + next.xp : '已达最高阶');
    fill('stageBar', next ? (game.xp - xp) / (next.xp - xp) : 1);
    text('runScore', game.score.toLocaleString('zh-CN'));
    text('runPearls', game.pearls);
    text('combo', game.combo >= 2 ? game.combo + ' 连吞' : '');
    text('frenzyText', game.frenzyT > 0 ? '狂食 ' + game.frenzyT.toFixed(1) + ' 秒' : '狂食蓄积');
    fill('frenzyBar', game.frenzyT > 0 ? game.frenzyT / 9 : game.frenzy / 100);
    text('songText', game.songCd > 0 ? '鲸歌 ' + game.songCd.toFixed(1) + ' 秒' : '按住 F 蓄力');
    const boss = game.zone.boss;
    show('bossStatus', boss.hp > 0 && boss.engaged && dist(boss, game.player) < 1100);
    text('bossName', boss.def.name);
    fill('bossBar', boss.hp / boss.maxHp);
    text('bossHint', bossStatus(game));
    show('seaChart', true);
    show('songPulse', game.charging);
    fill('chargeBar', game.songCharge / 1.8);
  } else {
    text('runObjective', '收集梦鱼，送回月光井');
    text('dreamLeft', game.insomnia);
    text('dreamTime', displayTime(game.timeLeft));
    text('dreamChain', game.chain.length);
    text('breathValue', Math.ceil(game.breath));
    fill('breathBar', game.breath / 100);
    fill('dreamProgress', 1 - game.insomnia / START_INSOMNIA);
    show('bossStatus', false);
    show('seaChart', false);
    show('songPulse', false);
  }
  fill('dashBar', game.player.dash / 100);
  fill('routeBar', game.player.x / game.reef.width);
}

$('btnStart').addEventListener('click', () => start('dream'));
$('btnHunt').addEventListener('click', openHunt);
$('btnHuntBack').addEventListener('click', toTitle);
$('btnHuntStart').addEventListener('click', () => start('hunt'));
$('btnHuntAgain').addEventListener('click', () => start('hunt'));
$('btnHuntMenu').addEventListener('click', toTitle);
$('btnHuntShop').addEventListener('click', openHunt);
$('btnAgain').addEventListener('click', () => start('dream'));
$('btnDreamMenu').addEventListener('click', toTitle);
$('btnPause').addEventListener('click', pause);
$('btnResume').addEventListener('click', pause);
$('btnPauseMenu').addEventListener('click', toTitle);
$('btnReturn').addEventListener('click', () => {
  if (!dive?.zone) return;
  audio.suspend(false);
  dive.finish('return');
});
$('btnMap').addEventListener('click', () => $('seaChart').classList.toggle('expanded'));
$('metaUpg').addEventListener('click', event => {
  const key = event.target.closest('[data-k]')?.dataset.k;
  if (!key || !meta.buy(key)) return;
  audio.init();
  audio.ding();
  buildMeta();
});

addEventListener('keydown', event => {
  const { code } = event;
  if (code === 'Escape' && !event.repeat) pause();
  if (code === 'Tab' && screen === 'play' && dive?.zone) {
    event.preventDefault();
    if (!event.repeat) $('seaChart').classList.toggle('expanded');
  }
  if (code === 'KeyM' && !event.repeat) {
    audio.setMuted(!audio.muted);
    text('muteTag', audio.muted ? '已静音' : '');
  }
  if (screen !== 'play') return;
  if (moveKeys.includes(code)) event.preventDefault();
  keys.add(code);
});
addEventListener('keyup', event => keys.delete(event.code));
addEventListener('blur', () => { if (screen === 'play') pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && screen === 'play') pause(); });
$('c').addEventListener('contextmenu', event => event.preventDefault());
$('c').addEventListener('pointerdown', event => {
  if (screen === 'play' && event.pointerType === 'mouse') mouse.add(event.button);
});
addEventListener('pointerup', event => mouse.delete(event.button));
addEventListener('pointercancel', event => mouse.delete(event.button));
for (const button of document.querySelectorAll('[data-touch]')) {
  button.addEventListener('pointerdown', event => {
    event.preventDefault();
    pointers.set(event.pointerId, button.dataset.touch);
    button.setPointerCapture(event.pointerId);
    button.classList.add('pressed');
  });
  function release(event) {
    pointers.delete(event.pointerId);
    button.classList.remove('pressed');
  }
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
}

function getInput() {
  const touch = new Set(pointers.values());
  const has = (...codes) => codes.some(code => keys.has(code) || touch.has(code));
  const hunt = !!dive.zone;
  return {
    x: Number(has('KeyD', 'ArrowRight')) - Number(has('KeyA', 'ArrowLeft')),
    y: Number(has('KeyS', 'ArrowDown', 'KeyC', 'KeyQ')) - Number(has('KeyW', 'ArrowUp', 'Space')),
    dash: has('ShiftLeft', 'ShiftRight'),
    sing: has('KeyF', 'KeyE') || mouse.has(hunt ? 2 : 0),
    bite: hunt && (has('KeyJ') || mouse.has(0)),
  };
}

function frame(now) {
  const dt = Math.min(0.04, (now - lastTime) / 1000);
  lastTime = now;
  if (screen !== 'pause') visualTime += dt;
  if (screen === 'play') {
    dive.update(dt, getInput());
    audio.update(dt);
    if (lastMap !== dive.map) {
      view.snap = true;
      lastMap = dive.map;
    }
    hudTimer -= dt;
    if (screen === 'play' && hudTimer <= 0) {
      renderHud();
      hudTimer = 0.065;
    }
  }
  view.draw(dive, screen === 'pause' ? 0 : dt, visualTime, screen === 'title' || screen === 'huntIntro');
  requestAnimationFrame(frame);
}
addEventListener('resize', () => view.resize());
requestAnimationFrame(frame);
view.load().then(() => {
  $('btnStart').disabled = false;
  $('btnHunt').disabled = false;
  text('btnStart', '开始夜班');
}).catch(error => {
  console.error(error);
  text('btnStart', '海域素材读取失败，请重新运行 npm run build');
});

if (new URLSearchParams(location.search).has('test')) {
  window.__jg2d = { get dive() { return dive; }, get screen() { return screen; }, meta };
}
