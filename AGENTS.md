<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:guajiyouxi-rules -->
# guajiyouxi 项目规范

> 全文见 `docs/编程规范.md`。本块由人工维护，`next dev` 不会动它（它只重写上面那个 nextjs 块）。

## 你的角色：设计总负责人 + 记录者

你不是代码打字机。

1. **先设计，后动手。** 新功能 / 新库 / 新算法 / 新交互，先列现成方案的优劣表（体积 / 依赖 /
   是否需资源文件 / 维护状态），结论落 `docs/选型-<主题>.md`，再开工。
   改一个已有模型的颜色、调个常量，不用走这一步。
2. **每次交付都带总结**，四段：改了 / 新建了哪些文件 · 关键设计决策与理由 · 我做了哪些取舍 ·
   我没做到或留给下一步的。**做不到就直说，不要粉饰。**
3. **不许扩大范围。** 点名之外的文件不动；不顺手重构、不顺手格式化、不删文件。
4. **不许猜标识符。** 键名 / 路径 / 字段 / 常量先读文件确认，找不到就问。别用"应该是"。

## 技术栈（别引入别的）

TypeScript strict · Next.js 16（Turbopack）· React 19（**只做面板 UI**）· Canvas2D ·
Electron `.cjs` · vitest

游戏内核**零依赖**：不引 Phaser / Howler / Tone.js / three；音效内联 ZzFX，飘字自写 `floaters.ts`。

## 红线

- `src/game/main.ts` 只放装配 + 主循环 + 行为，目标 < 400 行；超了先把行为拆成独立模块。
- 这是**挂机游戏 —— 没有玩家输入**；**React 不参与每帧**。
- 一个模型一个文件（`src/game/models/*.ts`）= 外观 + 数据，**不放行为**。
- 坐标 / 旋转 / 缩放 / 碰撞只在 `public/scenes/*.json`。
- 加载失败**只记账不崩**：记 `ErrorLedger` + 洋红占位方块，主循环继续跑。
- 数值只在一处放大：`src/game/d2-bridge.ts` 是唯一认识 `src/lib/d2` 的文件；
  `makeUnit` 只补默认值、不做倍率。
- "造对象"的函数（`makeUnit` / `World.spawn`）返回对象第一行必须 `...input` —— 逐字段手抄会
  **静默吞掉**新增字段（掉落恒为 0、名字标签永不出现，都是这么来的）。加字段顺手补透传断言测试。
- 全屏叠加层**不许**用 `multiply` / `lighter` 回贴（会抬 alpha）→ 用 `source-atop`。
- 不用 `as any` 绕过类型错误；补真实的类型信息（如 JSDoc `@returns`）。
- **不要用 `npx next dev`**（本机 rtk 会改写它）→ 用 `./node_modules/.bin/next dev`。

## 改完怎么验（唯一合并门）

```bash
npm run smoke -- --fast   # 改完先跑静态 4 项
npm run smoke             # 合并门：必须 16/16
```

自检项判定 = **出口码 0 且出现哨兵行**（只看出口码会假绿：`app.quit()` 也是 0）。
一个探针配一个专用环境变量，别和别的自检块抢退出。

## 交付细节

中文注释，`/** */` 块注释写**"为什么"**；整理已有文件先备份、保留 `*-old/`，别直接删；
文件名要写明具体内容；**图走 git 不走聊天视觉**（见 `.cursor/rules/sprites-git.mdc`）。

## 更多

`docs/编程规范.md`（全文）· `docs/踩坑记录.md`（16 个已踩的坑）· `docs/内核骨架.md`（契约全表）
<!-- END:guajiyouxi-rules -->
