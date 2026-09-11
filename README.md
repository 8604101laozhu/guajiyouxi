# 挂机游戏（guajiyouxi）

以后都在这个工程里跑。暗黑 2 装备底子 + 手游关卡梯度。立绘和走路帧放 `public/sprites`。

走路关键帧已经放进 `public/sprites/mage/walk/`（`0.png` … `7.png`）。这些还是同一姿势的试色，没有摆臂和换脚。步态工作流在 [`workflows/walk-cycle`](workflows/walk-cycle/README.md)：用 OpenPose 锁手脚，再走 [mor-o 的 ComfyUI 管线](https://github.com/mor-o/comfyui-2d-character-pipeline)（Qwen-Image-Edit → WAN 2.2 图生视频 → 抽帧）。工坊左侧「法师走路」分女/男管线：同一套 WAN 图生视频，只换 `BODY` / `HAIR` / `CHEST` 提示词。女角色默认长发滞后抖动，部分角色再加落脚延迟的胸腔回弹；男角色提示词写成躯干稳住。槽位见 [`workflows/walk-cycle`](workflows/walk-cycle/README.md)。

立绘和走路帧统一收进 [`public/sprites/inbox`](public/sprites/inbox/放到这里.txt)。走路循环放 `inbox/mage/walk-cycle/`，立绘试色放 `inbox/mage/stills/`，头发层放 `inbox/mage/hair/`。文件名 `0.png`、`1.png`… 拖进对话输入框也可以，我会拷进对应子文件夹。

## 掉落（暗黑 2）

每只怪先抽 Treasure Class 基底，再按 `ItemRatio.txt` 判定品质：

1. 暗金（MF 衰减 250）
2. 套装（目前空表，判定成功会继续往下）
3. 稀有（MF 衰减 600）
4. 魔法（MF 不衰减）
5. 白板；可能有孔、可能无形

chance 越小越好，成功条件是 `rand(chance) === 0`。金怪/首领/噩梦/地狱走 Uber 行，稀有和魔法更密，暗金底仍很稀。

## 关卡（手游梯度）

12 章 × 10 关，第 5/8 关精英怪，第 10 关首领。难度：普通 / 精英 / 噩梦 / 地狱。

血量、推荐战力按章节指数抬；更高难度加抽次、降空箱率、抬 TC。战力不够会清剿失败，不掉东西。

## 部位

对照暗黑 2 人物界面：

- 头盔、盔甲、腰带、手套、靴子
- 项链、左戒指、右戒指
- 主手、副手（盾或单手武器；双手武器占用副手）

## 伤害

1. 武器基底 min/max；无形 ×1.5
2. 只乘**武器上的** `%增强伤害`，再加上武器上的 `+最小 / +最大`
3. 装外 `%增强伤害` 与力量（近战）或敏捷（弓弩/标枪）加算后乘
4. 戒指、护甲等部位的 `+伤害` 在这之后加，不再吃武器 ED
5. 火/冰/电/毒各自掷骰，不吃 ED
6. 致命一击先判定，未触发再判定死伤，物理 ×2，两者不叠加

命中率：`clamp(200 × AR/(AR+防御) × 等级比, 5%, 95%)`。

## 本地运行

```bash
npm install
npm test
npm run dev
```

浏览器打开 [http://localhost:43147](http://localhost:43147)。
