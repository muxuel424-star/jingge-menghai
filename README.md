# 鲸歌梦海

[在线游玩](https://muxuel424-star.github.io/jingge-menghai/) · [设计文档](docs/design/README.md) · [反馈问题](https://github.com/muxuel424-star/jingge-menghai/issues)

大肥鱼在鲸宫值夜班，替睡不着的人送梦。五张派工单对应五个独立梦境，每一夜按「浅梦送梦 → 潜梦 → 深梦捕食成长 → 安抚前辈 → 日报领薪」推进。重玩可以从潜梦开始。

最近的[地形与动作改进](docs/VISUAL-POLISH.md)补齐了自然礁岸、五海材质与环境细节，并加入连续动作插值、平滑转身，修复自动吞小鱼顿帧和挥空抖屏。

## 操作

| 操作 | 按键 |
| --- | --- |
| 游动 | WASD / 方向键 |
| 冲刺 | Shift |
| 猛扑 | J，可按住连续使用 |
| 鲸歌 | 按住 F（或空格）唱四拍，圆环合拢时松开 |
| 海图 | Tab |
| 暂停 / 潜梦跳过片刻 | Esc |
| 静音 | M |

触屏设备显示摇杆和动作按钮。先碰梦鱼，再护送梦链回月光井。噩梦能被鲸歌安抚。找到三段心事后，游进裂隙；六分钟仍没找到时会开放保底裂隙。

深梦中吃忆质长成茶碗、水缸、鲸宫三种体型，推开相应通道。生命、稳度、气息和冲刺分别计算。三段旋律能扩大鲸歌容错。Boss 的三阶段都有歌门和场地乐器，预警后的攻击可以避开，收招和应答时会露出破绽。

## 本地运行

Node.js 22 或更新版本：

```bash
npm ci
npm run dev
```

打开终端显示的本地地址。也可以运行 `npm run build`，双击生成的 `dist/play.html` 离线游玩。单文件自带美术和合成音频，不依赖外部字体或网络。

```bash
npm test
npm run test:replay
npm run test:smoke
npm run test:shots
npm run test:audio
npm run test:perf
npm run test:motion
```

浏览器检查使用本机 Chrome，或先运行 `npx playwright install chromium`。工具自动启动只监听 127.0.0.1 的临时服务器与独立浏览器存档。截图、音频与性能报告默认进入系统临时目录，也可加 `--out=绝对路径`。

动作录像工具另需本机已安装 ffmpeg。

## 参与修改

欢迎 Fork 后修改并提交 Pull Request。公开仓库允许所有人浏览、克隆和分支开发；主分支通过维护者合并更新。

- `src/data/`：集中数值、五关地形、物种、道具、Boss 和中文文案。
- `src/sim/`：固定步长、确定性随机数、碰撞、生态与战斗，不依赖浏览器。
- `src/render/`：角色八动作、地形分块缓存、视差、特效和六项 HUD。
- `src/audio/`：四总线、五层配乐、鲸歌及动作/战斗音效。
- `src/ui/`：派工单、小金库、图鉴、设置与存档迁移。
- `assets/side/`：当前实际使用的美术；旧版未引用素材已移出项目。

珍珠、升级与进度保存在浏览器本地。旧版 `jg_hunt_save_v1` 会迁移到 `jg_save_v2`，迁移完成后才移除旧键；无法写入时使用内存档。

`npm run build:pages` 更新 `docs/index.html`。GitHub Pages 从 `main` 分支的 `docs/` 部署。

实现与验收边界见 [v2 改造记录](docs/V2-IMPLEMENTATION.md)。源代码采用 [MIT 许可](LICENSE)，角色设定与参考美术的相关权利归各自权利人。
