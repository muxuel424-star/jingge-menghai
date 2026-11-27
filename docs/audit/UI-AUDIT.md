# 元系统与叙事逐条核对

核对基线：272ccdb。范围：01、02、08、10，及05委托人与碎片、07台词。原设计文档保留；本表记录实际差距和修复证据。

| 来源 | 条目 | 基线状态 | 本轮处理 |
|---|---|---|---|
| 01 §3/5；05各关 | 每个梦有主人；15条碎片≤40字；忆质是心事 | 已有委托与碎片及教学句 | 保留原15条与五位前辈身份，内容测试核对 |
| 07各台词表 | 五Boss各≤6句、与心结对应 | 已有30句 | 保留，不增加Boss对白 |
| 08 §3.4；10 M6-3 | 九物种、15碎片、五心事、20成就 | 物种只列名字；心事误重显败场句 | 补物种四字段详情和五段独立“后来”，通关解锁 |
| 08 §3.5 | 五纪念品改变鲸宫房间 | 数字收藏已保存；房间外观无身份 | 统一身份/房间插槽数据；房间渲染由主任务完成 |
| 08 §2.1 | 五关旋律集齐后唤醒调 | 有合唱音，缺跨关条件 | 保存并校验unlocks.awakening；模拟器读取并合并本关实时旋律 |
| 08 §6；10 M6-3 | 每局三任务、只计本局、优先未完成 | 三条与本局结算已有；需证明全部可达 | 任务统计测试、二十成就逐项见后续表；修复任务快照/门槛边界 |
| 02 §7 | 连败两次可选援助，仅伤害与稳度 | 缺设置与持久连续失败数 | 每关failures，胜利清零；settings.assistance默认关 |
| 02 §5 | 海图按钮、暂停世界 | 只有Tab | PLAY增加海图按钮，主入口接map动作 |
| 08 §3.3；10 M6-1 | 派工单顺序/评价/星数/重玩DESCENT | 已实现 | 保留并测试 |
| 08 §5 | v1迁移/内存降级/静音保存 | 已实现 | 保留，增强新字段校验及重载测试 |
| 10 M6-2 | 纸票、逐行、盖章声、评级 | 已实现 | 保留；具体评级由模拟器任务核对 |
| 10 M6-4 | 屏震滑条/高对比/静音 | 设置已有 | 保留；渲染可读性由主任务截图验收 |
| 01 §8；10最终9 | 中文≤2500含UI | 需按实际打包正文总量核验 | 新文案集中data；交付前记录实际计数 |
| 01 §10；10最终10 | 外部试玩者复述心结等 | 未提供真人记录 | 不以自动测试伪称通过；试玩表由验收任务准备 |

## 推导登记

原文明确要求五段“后来”，但未提供这五段正文。本轮按01“温柔/松手/工作交接”、05各委托人的物件与07心结，补短篇后记；没有替换原碎片、增加系统或许诺所有遗憾都被解决。写作前依用户文风协议阅读文风索引与`style-kezhi-corpus.md`，只学习短句、物件与留白，不套用句式。

## 数据接口

- `meta.data.souvenirs`仍为关卡数字1–5，旧档兼容。`data/narrative.js`的`SOUVENIRS`提供`level/id/nameKey/shape/slot`，用于房间中五件不同陈设。
- `meta.data.unlocks.awakening`由五关各三段旋律重算，不能由损坏存档的独立布尔值直接解锁。
- `meta.data.levels[n].failures`记录该关连续失败，通关置0；`settings.assistance`为自选，模拟器须同时检查failures≥2，只降生命伤害/稳度压力一档。
- 屏幕`map`/`room`动作由main接线。叙事详情展开发`dialogue {speaker,textKey}`给既有音频事件总线。

## 成就触发审查

下表20项均有生产统计来源；`test/meta-completion.test.js`用Game生成的统计快照走真实结算/存档链路，覆盖所有20项。它验证触发和持久化合同，不冒充人手逐项挑战录像。

| id | 达成条件 | 生产来源 |
|---|---|---|
| first | 通关一梦 | scoring.makeResult的CLEARED结果 |
| clean | 通关且hits=0 | game.hurt递增hits；无伤路线可达 |
| noDash | 通关且dashSeconds=0 | movement只在真实冲刺递增；普通游动可通行主路 |
| calm | 本局安抚≥3噩梦 | ecology安抚完成递增nightmaresSlept |
| abyss | 本局反杀鮟鱇≥1 | feeding反杀流程递增abyss |
| abyss5 | 累计反杀≥5 | Meta聚合各局abyss；可重进3–5关 |
| perfect3 | Boss连续三次Perfect | combat.resolveBossGate维护连续值/最大值；非Perfect清零 |
| souvenirs | 五纪念品 | items拾取、Meta按关保存、身份重载测试 |
| stories | 全15碎片 | dreams拾取、Meta保存关-片ID |
| species | 全九种 | feeding吃、game.hurt受击、dreams唱睡、ecology水母接触 |
| allDreams | 五梦通关 | 五关cleared顺序解锁 |
| rankS | S评价 | scoring三项评级及旋律升档 |
| chain12 | 梦链峰值12 | dreams接触收梦维护maxChain |
| fry60 | 本局吃60小荧鱼 | feeding.eat递增fry |
| melody | 本局收齐3旋律 | game.collectMelody及本局stats.melodies |
| giant | 鲸宫阶 | game.addMem达到760升阶，结果保存tier |
| shortcuts | 本局走两捷径 | dreams记录usedShortcuts与stats.shortcuts |
| delivery | 累计送100梦鱼 | dreams单次送达增本局delivered，Meta累加；重试继承气息不重复计入 |
| perfect10 | 本局10次Perfect | dreams.applySongRelease递增perfects |
| bossClean | 通关且Boss命中0 | game.hurt在BOSS态递增bossHits |

## 本轮实际修复

- 五段后记分别解锁；九种图鉴每种可展开识别/预警/破绽/反制，未发现的仍隐藏。
- 五件纪念品以稳定ID和独立插槽供房间渲染，收藏数字不改动旧档。
- 五关旋律保存后才置唤醒flag；旧版仅有melody=3的档补齐对应三片ID。伪造独立flag、无效收藏ID不会解锁。
- 连败按关保存，通关归零；援助默认关闭，由玩家自选，模拟器只调整伤害/梦耗。
- 修复结算可能使用菜单当前任务而非本局任务的问题：采用result.missionProgress的ID快照；第五夜任务同时要求关5。
- 修复已保存故事/旋律及上局送达可能再计任务/累计成就的问题：收藏用于进度，本局stats用于任务和累计。模拟器配套分离已完成。
- 所有Screens中文集中到data/dialogue；新增海图与房间入口。结算、委托、心事详情发dialogue音色事件。
- 设置保存校验NaN屏震值、重复/越界旋律、无效图鉴/纪念品ID，防止坏档误判全收集。

## 验证记录

`node --test test/meta.test.js test/meta-completion.test.js`：12 tests / 12 pass / 0 fail（本轮初次运行）。`node --test test/meta.test.js test/content.test.js`：32 tests / 32 pass / 0 fail。完整集成构建、截图及最终中文总预算由主验收合并记录。

新文案全部位于data。当前DIALOGUE中文1989字；另有升级/任务/成就名及模拟/渲染提示，最终应计实际运行正文，不能仅用DIALOGUE数量冒充全游戏文本。
