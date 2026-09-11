# 香草社横板背景世界

把出图硬规格锁进香草社（Vanillaware）画风，当作固定 World 用。网页「复制本章背景提示词」会自动带上这份 World + 当前章节场景。

## 硬规格（不要改）

| 项 | 要求 |
| --- | --- |
| 尺寸 | **3840×720**（两屏宽）。最低 1920×720 |
| 格式 | **PNG**，不要 JPEG |
| 接缝 | 左边必须接得上右边，能无缝横铺 |
| 地面 | 地面线水平，大约在画面高度 **78%**（人物脚踩这条线） |
| 镜头 | 纯侧面横板，地平线水平 |
| 禁止 | 人物、怪物、UI、字、水印；太阳/月亮/独一门独一城堡这类没法循环的地标 |

投放：`drop/背景/1/loop.png`（第 2 章起换数字）。或三层视差 `sky.png` / `mid.png` / `ground.png`（中景、地面要透明）。

## World 正文（英文，贴进固定槽）

可直接复制下面整段进 ComfyUI / NovelAI World。章节场景另写在正向提示词里，或用网页复制按钮一次拿齐。

```
香草社横板背景世界
Vanillaware style hand-painted 2D fantasy background, Odin Sphere / Dragon's Crown / Muramasa scenic atmosphere, ornate decorative foliage and architecture, rich oil-paint texture, soft theatrical lighting, layered depth silhouettes, controlled saturated palette, game art background plate, not concept-sheet collage, not photoreal, not 3D render
Canvas 3840x720 landscape tile (two screens wide); minimum 1920x720.
PNG only, no JPEG banding.
Seamless horizontal loop: left edge matches right edge exactly; tileable terrain only.
Level ground line at 78% from the top; characters will stand on this line.
Pure orthographic side-scroller camera, locked horizon, continuous ground plane, no vanishing-point hallway.
Empty of characters, monsters, UI, text, watermarks, weapons.
No unique landmarks that break looping: one sun, one moon, one named castle, one unique door, one hero monument.
Readable silhouette when scaled to 320px tall.
```

## 章节场景怎么加

World 固定不动。正向提示词只补本章地景，例如第 1 章：

```
Chapter scene: 一幕 鲜血荒地. blood-soaked wasteland, dead grass, cracked red earth, repeating ruined fence posts, overcast crimson sky, Diablo Act 1 wilderness mood.
Single continuous side-scrolling strip, empty playfield for a character later.
```

代码里完整拼法见 `src/lib/sprites/backgrounds.ts` 的 `vanillawareWorldPrompt()` / `backgroundThemePrompt()`。
