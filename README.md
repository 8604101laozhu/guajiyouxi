# 挂机游戏（guajiyouxi）

以后都在这个工程里跑。暗黑 2 装备底子 + 手游关卡梯度。立绘和循环帧放 `public/sprites`。

角色动画接 [mor-o/comfyui-2d-character-pipeline](https://github.com/mor-o/comfyui-2d-character-pipeline)，**没有单独的攻击/死亡工作流，也不另做一套纸娃娃模型**。

- 走路 / 攻击 / 死亡：同一条 **W2**，只换 `ANIMATION_NAME`
- 换武器：W4/W5 的 `COSMETIC_NAME`，只换武器层，不重出身体
- 网页「动作循环」：选走路/攻击/死亡，选空手/法杖/剑。纸娃娃换主手也走同一套 cosmetics

本机 16GB 先跑 W2 出空手身体。生成图不要拖进对话。

**最省事（香草社人物包）**：炼丹输出已是  
`D:\ai炼丹\香草社\人物生成图\{名字}\待机|走路|攻击|死亡\`。  
在工程根双击 **`import-char.cmd`**（默认导「法师1新」），或：

```bat
import-char.cmd 法师1新
import-char.cmd 史莱姆王 --as=boss
```

也可把角色文件夹拖到 `import-char.cmd` 上。会拷进 `public/sprites/inbox` 并 `git push`。路径记在 `char-import.json`。

旧方式：本机打开 `drop/走路`（或双击 `投放.cmd`），`npm run drop:watch -- --push`。炼丹盘可在 `drop.json` 写成 `D:\\ai炼丹\\投给挂机游戏`。

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

点「清剿本关」时人物在横板里走路，背景循环滚动，打完本关（第 10 关是首领）后停住并结算掉落。

## 横板背景怎么出图

画风锁在**香草社（Vanillaware）横板背景世界**：手绘 2D、油彩质感、装饰性植被与建筑，不要照片、不要 3D。完整 World 正文在 [`workflows/backgrounds`](workflows/backgrounds/README.md)。

GitHub 上目前**没有**关卡背景，只有角色走路 8 帧。背景按**章**共用，不必每小关画一张。先只做第 1 章「鲜血荒地」一条循环条即可。

| 项 | 要求 |
| --- | --- |
| 尺寸 | **3840×720**（两屏宽）。最低 1920×720 |
| 格式 | **PNG**，不要 JPEG |
| 接缝 | 左边必须接得上右边，能无缝横铺 |
| 地面 | 地面线水平，大约在画面高度 **78%**（人物脚踩这条线） |
| 镜头 | 纯侧面横板，地平线水平 |
| 禁止 | 人物、怪物、UI、字、水印；太阳/月亮/独一门独一城堡这类没法循环的地标 |

文件名与投放：

- 一条整图：`drop/背景/1/loop.png`
- 或三层视差（透明 PNG）：`sky.png` / `mid.png` / `ground.png`（中景、地面上面要透明）
- 第 2 章放 `drop/背景/2/`，以此类推到 12

网页横板右上角「复制本章背景提示词」= 香草社 World + 本章场景。出好后不要拖进对话，投放.cmd 推上来再跟我说「图放好了」。

## 怪物怎么投送

关卡右侧显示本关怪物（小怪 / 精英 / 首领）。和角色一样放走路帧即可，攻击/死亡可选。

| 类型 | 目录 | 关卡 |
| --- | --- | --- |
| 小怪 | `drop/mob/minion/walking/` | 每章 1–8 |
| 精英 | `drop/mob/champion/walking/` | 每章 9 |
| 首领 | `drop/mob/boss/walking/` | 每章 10 |

帧命名：`0.png` `1.png` …，默认**朝左**，透明底。中文目录：`drop/怪物/小怪/走路/`。

Windows：图放进目录后双击 **`push-mob.cmd`**，再跟我说「图放好了」。分章覆盖可用 `drop/mob/1/minion/walking/`。说明见 [`workflows/monsters`](workflows/monsters/README.md)。

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

**不要把 png 拖进 Cursor 对话。** 聊天里看图会按像素吃 token，以后频繁上传会很亏。

GitHub 的做法是：图只当仓库里的文件（blob），`git push` / `git pull` 传文件，模型默认看不到像素。

仓库已接通：https://github.com/8604101laozhu/guajiyouxi.git

1. 双击 `投放.cmd`（一直开着）
2. png 扔进 `G:\guajiyouxi\guajiyouxi\drop` 对应子目录（走路 / 攻击 / 死亡 / 法杖 / 剑 / 背景或 bg/1 / mob/minion/walking）
3. 跟我说「图放好了」——我只 `git pull` 数文件名，不打开图
