# 挂机游戏（guajiyouxi）

以后都在这个工程里跑。暗黑 2 装备底子 + 手游关卡梯度。立绘和循环帧放 `public/sprites`。

角色动画接 [mor-o/comfyui-2d-character-pipeline](https://github.com/mor-o/comfyui-2d-character-pipeline)，**没有单独的攻击/死亡工作流，也不另做一套纸娃娃模型**。

- 走路 / 攻击 / 死亡：同一条 **W2**，只换 `ANIMATION_NAME`
- 换武器：W4/W5 的 `COSMETIC_NAME`，只换武器层，不重出身体
- 网页「动作循环」：选走路/攻击/死亡，选空手/法杖/剑。纸娃娃换主手也走同一套 cosmetics

本机 16GB 先跑 W2 出空手身体。生成图不要拖进对话：本机打开 `drop/走路`（或双击 `投放.cmd`），`npm run drop:watch -- --push` 会拷进 `public/sprites/inbox` 并推到仓库。炼丹盘可以在 `drop.json` 里写成 `D:\\ai炼丹\\投给挂机游戏`。

工坊左侧可复制填好 `ANIMATION_NAME` 的 W2 提示词。槽位与抽帧说明在 [`workflows/walk-cycle`](workflows/walk-cycle/README.md)。

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

纸娃娃换武器：空手 / 法杖 / 剑。法杖对应 staff/wand/scepter，剑刃对应 sword/dagger/axe/mace/spear/polearm。画面上只换武器层。

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

## 生成图怎么给我

你炼丹的电脑，不是我现在跑网页的那台。所以我看不见 `D:\`。

工程下载到炼丹这台电脑之后：

1. 双击 `投放.cmd`
2. 把 png 丢进弹出的 `走路` 文件夹
3. 跟我说「图放好了」

工程还没下载到这台电脑时，只能继续把图拖进对话框。
