# 鲸歌梦海

《鲸歌梦海》是一款横版 2D 深海浏览器游戏。大肥鱼可以潜入五片海域，捕食、进化并挑战首领，也可以唱睡噩梦，把迷路的梦送回月光井。

[在线游玩](https://muxuel424-star.github.io/jingge-menghai/) · [反馈问题](https://github.com/muxuel424-star/jingge-menghai/issues)

## 操作

| 操作 | 按键 |
| --- | --- |
| 游动 | WASD 或方向键 |
| 冲刺 | Shift |
| 猛扑（捕食模式） | J 或鼠标左键 |
| 鲸歌 | F。捕食模式按住蓄力，到亮线时松开 |
| 暂停 | Esc |
| 静音 | M |

触屏设备会显示屏幕按键。捕食模式里的珍珠、任务和永久升级保存在浏览器本地。

## 本地运行

使用 Node.js 22 或更新版本。

```bash
npm ci
npm run dev
```

打开终端显示的本地地址。运行 `npm run build` 也可以生成自包含的 `dist/play.html`，双击即可离线游玩。

## 参与修改

欢迎 Fork 仓库，克隆自己的副本，修改后提交 Pull Request。角色动画和渲染在 `src/side/`，海域地形和生态配置在 `src/side/reefs.js`，2D 美术文件在 `assets/side/`。

更改游戏后可以运行 `npm run build:pages` 更新 `docs/index.html`。GitHub Pages 从 `main` 分支的 `docs/` 目录部署试玩版。

项目源代码采用 [MIT 许可](LICENSE)。角色设定和参考美术的相关权利归各自权利人。
