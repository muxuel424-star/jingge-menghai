export const STAGES = [
  { name: '见习女仆', size: 1.0, hp: 100, xp: 0, speed: 1.0 },
  { name: '正式女仆', size: 1.3, hp: 140, xp: 40, speed: 1.08 },
  { name: '女仆领班', size: 1.65, hp: 190, xp: 120, speed: 1.16 },
  { name: '女仆长', size: 2.05, hp: 250, xp: 280, speed: 1.25 },
  { name: '鲸宫总管', size: 2.5, hp: 320, xp: 560, speed: 1.34 },
  { name: '深海之主', size: 3.0, hp: 400, xp: 1000, speed: 1.44 },
];

export const RIVALS = [
  {
    key: 'grok', name: 'Grok 前辈', title: '哥特见习生 · 浅湾首领', tier: 1, mapIdx: 0, mapName: '翡翠浅湾',
    h: 1.15, hp: 75, color: '#ff5d8f',
    voice: [1.3, 'square'], skill: 'dash', skillName: '哥特三连冲', home: { x: 0, z: -42 },
    lines: {
      spot: ['哟，新来的？翡翠浅湾归本前辈管！', '站住！还没我高就敢在浅湾乱逛？', '新人？正好拿你练练哥特三连冲！'],
      skill: ['看我的——哥特三连冲！', '躲得开算你厉害！'],
      hit: ['哈！撞到了吧！没长够个子别碰我！', '就这？先去吃小荧鱼长大吧！'],
      hurt: ['痛痛痛！你撞上来就咬啊！', '喂！别咬裙子！', '可恶，牙口这么好？'],
      flee: ['战术撤退！这是战术撤退！', '我、我去青花古渡叫千问前辈！'],
      down: ['呜……浅湾让给你了……北边的海门能去青花古渡……', '今天就先放过你……'],
      stun: ['……这歌好好听……', '腿、腿软了……'],
      grow: ['等等，你怎么长得比我还高了？！', '……前辈不跟你玩了！别撞过来！'],
      lost: ['人呢？刚刚还在这……', '躲海带里算什么本事！'],
      idle: ['今天的珊瑚也很衬我的哥特裙。', '嗷呜！（吃小鱼）'],
    },
  },
  {
    key: 'qwen', name: '千问前辈', title: '青花女官 · 古渡首领', tier: 2, mapIdx: 1, mapName: '青花古渡',
    h: 1.48, hp: 130, color: '#5fb6ff',
    voice: [1.05, 'triangle'], skill: 'plates', skillName: '青花飞盘', home: { x: 0, z: -38 },
    lines: {
      spot: ['擅闯青花古渡？尝尝女官的青花盘！', '规矩点，沉船墓场归女官巡视。'],
      skill: ['青花盘，接好了！', '一盘、两盘、三盘——'],
      hit: ['接不住可不怪我哦。', '这可是官窑的。'],
      hurt: ['我的盘子！你竟敢直接撞上来咬！', '好大的胆子！'],
      flee: ['这仇我记在账本上了！', '先、先回去写个检讨……'],
      down: ['……盘子，碎了一地……去幽影紫海找那只猫吧……', '礼数……周全不了了……'],
      stun: ['这调子……有点耳熟……', '让我听完这一段。'],
      grow: ['你长得比我的青花盘还大……', '今天就到这里，告辞！'],
      lost: ['奇怪，人去哪了？', '跑得倒是挺快。'],
      idle: ['古渡的青花瓷，千年不褪色。', '巡视沉船中，闲人勿近。'],
    },
  },
  {
    key: 'gemini', name: 'Gemini 前辈', title: '紫猫潜行者 · 紫海首领', tier: 3, mapIdx: 2, mapName: '幽影紫海',
    h: 1.85, hp: 190, color: '#c08bff',
    voice: [0.95, 'sine'], skill: 'stealth', skillName: '猫步潜行', home: { x: 0, z: -36 },
    lines: {
      spot: ['喵～欢迎来到幽影紫海，发现一条肥肥的小鱼。', '嘘——水母林里，别回头哦。'],
      skill: ['……喵。', '在你身后哦～'],
      hit: ['抓到了喵！', '太慢了太慢了～'],
      hurt: ['喵呜！尾巴！直接撞过来咬太犯规了喵！', '不许咬猫！'],
      flee: ['猫咪不吃眼前亏～', '喵！撤退！'],
      down: ['喵……想睡觉了……北边的海门通往玄墨熔渊哦……', '下次……还要玩……'],
      stun: ['呼噜呼噜……', '这歌……像猫薄荷……'],
      grow: ['喵？你什么时候变这么大的？', '好吧好吧，你赢了～'],
      lost: ['喵？鱼呢？', '躲猫猫？我最擅长了。'],
      idle: ['在水母伞上伸个懒腰～', '紫海的宝箱都是我的喵。'],
    },
  },
  {
    key: 'zhipu', name: '智谱前辈', title: '黑白执事 · 熔渊首领', tier: 4, mapIdx: 3, mapName: '玄墨熔渊',
    h: 2.27, hp: 270, color: '#e8e8e8',
    voice: [0.8, 'triangle'], skill: 'stones', skillName: '黑白落子', home: { x: 0, z: -28 },
    lines: {
      spot: ['踏入玄墨熔渊的棋盘，这一步你走错了。', '执事的火山棋局上，没有多余的鱼。'],
      skill: ['落子。', '黑白之间，无处可逃。'],
      hit: ['将军。', '我早算到你会往那边游。'],
      hurt: ['……失礼了，再来。', '这一手蛮力撕咬，我没算到。'],
      flee: ['弃子，保大局。', '这盘棋，暂且封盘。'],
      down: ['……投子认负。黄金圣殿的海门已为你敞开。', '好棋……去面见女仆长吧。'],
      stun: ['……这一曲，我认输。', '棋盘……模糊了……'],
      grow: ['局势……逆转了么。', '执事从不下必输的棋。'],
      lost: ['……棋子不见了？', '有趣，藏起来了。'],
      idle: ['熔岩热泉之上的棋局，也要赢。', '请勿打扰执事思考。'],
    },
  },
  {
    key: 'claude', name: 'Claude 女仆长', title: '鲸宫首席 · 圣殿终极首领', tier: 5, mapIdx: 4, mapName: '黄金圣殿',
    h: 2.75, hp: 460, boss: true, color: '#ffb36b',
    voice: [0.9, 'sine'], skill: 'boss', skillName: '女仆长的考核', home: { x: 0, z: -32 },
    lines: {
      spot: ['跨越四片海域来到黄金圣殿……给我看看你学会了什么。', '嗯，长成深海之主了呢。那么，最终考核开始。'],
      skill: ['涟漪——请站好姿势。', '盘子请接稳。', '落子要稳。'],
      hit: ['姿势还不够标准哦。', '再来一次。'],
      hurt: ['不错，有进步。', '……这一下，力道刚好。'],
      phase: ['好了，热身结束。第二乐章，认真起来吧！'],
      down: ['……合格了。五海之主的名号，今晚归你了。'],
      stun: ['鲸歌……好久没听到了。', '……唱得很好。'],
      lost: ['躲起来也算一种策略。'],
      idle: ['黄金圣殿今天也很庄严。', '（擦拭远古鲸骨）'],
      warn: ['这里是黄金圣殿。还没长到第6阶「深海之主」的孩子，请先去前四片海域历练吧。', '再往里游，可就要提前考核了哦。'],
    },
  },
];

export const SALARY = {
  key: 'suit', name: '迷路的上班族', title: '加班到深夜', tier: 0, color: '#ffd166', voice: [1.15, 'sawtooth'],
  lines: {
    spot: ['这是哪？我只是加了个班……', '救命！我不会游泳！'],
    idle: ['明天还要开早会……', '有、有鱼！好大的鱼！', '报表还没交……'],
    down: ['……好困……我先睡了……', '终于……能下班了……'],
  },
};

export const MAPS = [
  {
    idx: 0, key: 'bay', name: '翡翠浅湾 · 珊瑚迷城', short: '翡翠浅湾', seal: '浅湾',
    sub: '第一海域 · 四大珊瑚峡谷分区与双座海脉祭坛 · 镇守首领：Grok 前辈',
    bossKey: 'grok', recStage: 0, bossStage: 1,
    spawn: [0, 14],
    subZones: [
      { key: 'south', name: '南境 · 浅湾高台', sub: '阳光觅食浅台与三道珊瑚峡谷拱门', x: 0, z: 52, r: 34 },
      { key: 'west', name: '西境 · 海葵秘谷', sub: '西翼珊瑚回廊 · 镇守【西境·海脉共鸣祭坛】', x: -74, z: -18, r: 36 },
      { key: 'east', name: '东境 · 翡翠珠沟', sub: '东翼深海裂谷 · 镇守【东境·海脉共鸣祭坛】', x: 74, z: -18, r: 36 },
      { key: 'north', name: '北境 · 珊瑚王庭', sub: 'Grok前辈领地与北境【远古封印海门】', x: 0, z: -38, r: 38 },
    ],
    altars: [
      { key: 'west', name: '西境·海脉共鸣祭坛', x: -74, z: -18 },
      { key: 'east', name: '东境·海脉共鸣祭坛', x: 74, z: -18 },
    ],
    portals: [
      { to: 1, x: 0, z: -96, name: '青花古渡', sub: '第二海域 · 千问前辈', col: [0.35, 1.0, 1.8], spawnAt: [0, 14], primary: true },
      { to: 2, x: 112, z: -18, name: '幽影紫海', sub: '第三海域 · Gemini前辈', col: [1.2, 0.45, 1.8], spawnAt: [0, 14] },
    ],
  },
  {
    idx: 1, key: 'porcelain', name: '青花古渡 · 千帆沉船湾', short: '青花古渡', seal: '古渡',
    sub: '第二海域 · 古渡断桥、梅瓶秘谷、沉船桅林与画舫旗舰 · 镇守首领：千问前辈',
    bossKey: 'qwen', recStage: 1, bossStage: 2,
    spawn: [0, 14],
    subZones: [
      { key: 'south', name: '南境 · 青花古渡口', sub: '雕花望柱长廊与三道古渡石拱', x: 0, z: 52, r: 34 },
      { key: 'west', name: '西境 · 梅瓶沉宝谷', sub: '巨型青花梅瓶秘谷 · 镇守【西境·海脉共鸣祭坛】', x: -74, z: -18, r: 36 },
      { key: 'east', name: '东境 · 断桅旋涡沟', sub: '古船残骸深沟 · 镇守【东境·海脉共鸣祭坛】', x: 74, z: -18, r: 36 },
      { key: 'north', name: '北境 · 画舫旗舰殿', sub: '千问前辈领地与北境【远古封印海门】', x: 0, z: -38, r: 38 },
    ],
    altars: [
      { key: 'west', name: '西境·海脉共鸣祭坛', x: -74, z: -18 },
      { key: 'east', name: '东境·海脉共鸣祭坛', x: 74, z: -18 },
    ],
    portals: [
      { to: 2, x: 0, z: -96, name: '幽影紫海', sub: '第三海域 · Gemini前辈', col: [1.2, 0.45, 1.8], spawnAt: [0, 14], primary: true },
      { to: 0, x: 0, z: 92, name: '翡翠浅湾', sub: '返回第一海域 · 珊瑚迷城', col: [0.25, 1.5, 1.1], spawnAt: [0, 14], isReturn: true },
      { to: 3, x: 112, z: -18, name: '玄墨熔渊', sub: '第四海域 · 智谱前辈', col: [1.8, 0.7, 0.2], spawnAt: [0, 14] },
    ],
  },
  {
    idx: 2, key: 'violet', name: '幽影紫海 · 荧光水母窟', short: '幽影紫海', seal: '紫海',
    sub: '第三海域 · 新月拱廊、浮空母皇伞林与紫晶深渊 · 镇守首领：Gemini 前辈',
    bossKey: 'gemini', recStage: 2, bossStage: 3,
    spawn: [0, 14],
    subZones: [
      { key: 'south', name: '南境 · 新月迎宾台', sub: '灵猫新月拱门与幻紫海草台', x: 0, z: 52, r: 34 },
      { key: 'west', name: '西境 · 垂丝水母林', sub: '浮空巨型水母窟 · 镇守【西境·海脉共鸣祭坛】', x: -74, z: -18, r: 36 },
      { key: 'east', name: '东境 · 紫晶幽影渊', sub: '深渊猫神遗迹 · 镇守【东境·海脉共鸣祭坛】', x: 74, z: -18, r: 36 },
      { key: 'north', name: '北境 · 双月灵猫殿', sub: 'Gemini前辈领地与北境【远古封印海门】', x: 0, z: -38, r: 38 },
    ],
    altars: [
      { key: 'west', name: '西境·海脉共鸣祭坛', x: -74, z: -18 },
      { key: 'east', name: '东境·海脉共鸣祭坛', x: 74, z: -18 },
    ],
    portals: [
      { to: 3, x: 0, z: -96, name: '玄墨熔渊', sub: '第四海域 · 智谱前辈', col: [1.8, 0.7, 0.2], spawnAt: [0, 14], primary: true },
      { to: 1, x: 0, z: 92, name: '青花古渡', sub: '返回第二海域 · 千帆沉船湾', col: [0.35, 1.0, 1.8], spawnAt: [0, 14], isReturn: true },
      { to: 0, x: -112, z: -18, name: '翡翠浅湾', sub: '返回第一海域 · 珊瑚迷城', col: [0.25, 1.5, 1.1], spawnAt: [0, 14], isReturn: true },
    ],
  },
  {
    idx: 3, key: 'magma', name: '玄墨熔渊 · 九星火山口', short: '玄墨熔渊', seal: '熔渊',
    sub: '第四海域 · 玄武石阶、熔岩裂谷、黑曜晶林与天元星盘 · 镇守首领：智谱前辈',
    bossKey: 'zhipu', recStage: 3, bossStage: 4,
    spawn: [0, 14],
    subZones: [
      { key: 'south', name: '南境 · 玄武热泉阶', sub: '喷发沸腾热泉与黑曜峡谷拱门', x: 0, z: 52, r: 34 },
      { key: 'west', name: '西境 · 金脉晶柱谷', sub: '弯角熔岩晶柱林 · 镇守【西境·海脉共鸣祭坛】', x: -74, z: -18, r: 36 },
      { key: 'east', name: '东境 · 炽焰裂谷渊', sub: '深渊熔岩火口 · 镇守【东境·海脉共鸣祭坛】', x: 74, z: -18, r: 36 },
      { key: 'north', name: '北境 · 天元星盘台', sub: '智谱前辈领地与北境【远古封印海门】', x: 0, z: -38, r: 38 },
    ],
    altars: [
      { key: 'west', name: '西境·海脉共鸣祭坛', x: -74, z: -18 },
      { key: 'east', name: '东境·海脉共鸣祭坛', x: 74, z: -18 },
    ],
    portals: [
      { to: 4, x: 0, z: -96, name: '黄金圣殿', sub: '终极海域 · Claude女仆长', col: [1.9, 1.45, 0.45], spawnAt: [0, 14], primary: true },
      { to: 2, x: 0, z: 92, name: '幽影紫海', sub: '返回第三海域 · 荧光水母窟', col: [1.2, 0.45, 1.8], spawnAt: [0, 14], isReturn: true },
      { to: 1, x: -112, z: -18, name: '青花古渡', sub: '返回第二海域 · 千帆沉船湾', col: [0.35, 1.0, 1.8], spawnAt: [0, 14], isReturn: true },
    ],
  },
  {
    idx: 4, key: 'sanctuary', name: '黄金圣殿 · 远古鲸骨城', short: '黄金圣殿', seal: '圣殿',
    sub: '终极海域 · 凯旋柱廊、东西钟楼侧殿与48米巨鲸骸骨圣堂 · 终极首领：Claude 女仆长',
    bossKey: 'claude', recStage: 4, bossStage: 5,
    spawn: [0, 14],
    subZones: [
      { key: 'south', name: '南境 · 凯旋金柱廊', sub: '黄金玫瑰前庭与哥特迎宾拱门', x: 0, z: 52, r: 34 },
      { key: 'west', name: '西境 · 圣歌钟楼谷', sub: '西侧黄金回廊 · 镇守【西境·海脉共鸣祭坛】', x: -74, z: -18, r: 36 },
      { key: 'east', name: '东境 · 星辉礼拜渊', sub: '东侧深海圣坛 · 镇守【东境·海脉共鸣祭坛】', x: 74, z: -18, r: 36 },
      { key: 'north', name: '北境 · 鲸骨大圣堂', sub: 'Claude女仆长王座与48米远古巨鲸骸骨', x: 0, z: -38, r: 42 },
    ],
    altars: [
      { key: 'west', name: '西境·海脉共鸣祭坛', x: -74, z: -18 },
      { key: 'east', name: '东境·海脉共鸣祭坛', x: 74, z: -18 },
    ],
    portals: [
      { to: 3, x: 0, z: 92, name: '玄墨熔渊', sub: '返回第四海域 · 九星火山口', col: [1.8, 0.7, 0.2], spawnAt: [0, 14], isReturn: true },
      { to: 0, x: -112, z: -18, name: '翡翠浅湾', sub: '返回第一海域 · 珊瑚迷城', col: [0.25, 1.5, 1.1], spawnAt: [0, 14], isReturn: true },
    ],
  },
];

export const PREY = {
  fry: { tier: 0, size: 0.36, xp: 3, food: 6, dmg: 0, n: 85, col: [0.3, 1.45, 1.15], name: '小荧鱼', tag: '1阶可吃' },
  lantern: { tier: 1, size: 0.82, xp: 10, food: 14, dmg: 9, n: 18, col: [1.5, 1.15, 0.35], name: '灯笼鱼', tag: '2阶可吃' },
  manta: { tier: 2, size: 1.52, xp: 24, food: 22, dmg: 14, n: 9, col: [1.1, 0.55, 1.6], name: '夜光鳐', tag: '3阶可吃' },
  royal: { tier: 3, size: 2.05, xp: 40, food: 30, dmg: 18, n: 6, col: [1.65, 0.78, 0.3], name: '赤甲皇鱼', tag: '4阶可吃' },
};
