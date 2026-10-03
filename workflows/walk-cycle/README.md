# 动作循环工作流

走路 / 攻击 / 死亡**共用一条 W2**，只换 `ANIMATION_NAME`。不要另做攻击图、死亡图，也不要另训一套纸娃娃模型。

换武器走 W4/W5：只换 `COSMETIC_NAME`，只出武器层，身体还是 W2 那一套。

## 用哪条

按你已经在用 Qwen 炼丹的机器，走这条：

仓库：[mor-o/comfyui-2d-character-pipeline](https://github.com/mor-o/comfyui-2d-character-pipeline)

| 步 | 工作流 | 做什么 |
| --- | --- | --- |
| W1 | Qwen-Image-Edit 2509 + InstantX ControlNet-Union（`openpose`） | 用骨骼把立绘拧到某一帧姿势，人还是同一个人 |
| W2 | WAN 2.2 i2v 14B | **真正写出动作**。同一张图，只换 `ANIMATION_NAME=walking\|attack\|death` |
| W3 | BiRefNet | 去底，切成横向 sprite strip |
| W4 / W5 | VACE inpaint + SAM3 | 武器层。`COSMETIC_NAME=staff\|sword`。16GB 先别跑 |

本目录 `openpose/0.png` … `7.png` 是 W1 走路用的 8 张 COCO-18 骨骼（JSON 在旁边）。把干净立绘 `public/sprites/mage/rig/texture.png` 和对应骨骼丢进 ComfyUI `input/`。攻击、死亡也用同一套 W2 图，不必另做 OpenPose 包。

### 16GB

先跑 W2 出**空手身体**。武器目录已经建成：

`public/sprites/inbox/cosmetics/{staff,sword}/{walking,attack,death}/`

有显存再跑 W4，只换武器层。

### 提示词槽

W2 提示词按性别换 `BODY` / `HAIR` / `CHEST`，按动作换 `ANIMATION_NAME` 和 `MOTION`。图还是同一套 WAN。槽位在 `prompts.json`，工坊左侧可复制填好的全文。

女管线默认：长发梢滞后抖动；**胸部槽加密度**——每个落脚两次峰值、延迟下落再回弹、精灵尺寸下仍可读。个别女性角色不需要胸动时，把 `CHEST` 换成男槽，或把滑条打到 0。

男管线：头发轻摆、`firm torso; no chest bounce`。

W2 身体必须是 **unarmed**。法杖和剑是以后叠上去的 cosmetic 层。

WAN 帧数必须是 `4n+1`（33 或 49）。16fps 下 33 帧约 2 秒。从视频里**只抽一个完整循环的 8～12 帧**。

### 不要用

- 每帧单独文生图
- 单独的攻击工作流、单独的死亡工作流
- 另训一套带武器的纸娃娃
- 把格子图、像素网格当 i2v 第二张输入
- Facebook AnimatedDrawings（画风会变成剪纸）

## 抽好的帧怎么交给工坊

统一收进 `public/sprites/inbox/`：

| 产出 | 文件夹 |
| --- | --- |
| W2 身体 · 走路 | `public/sprites/inbox/base_animations/walking/0.png` … |
| W2 身体 · 攻击 | `public/sprites/inbox/base_animations/attack/` |
| W2 身体 · 死亡 | `public/sprites/inbox/base_animations/death/` |
| W4 法杖 | `public/sprites/inbox/cosmetics/staff/{ANIMATION_NAME}/` |
| W4 剑 | `public/sprites/inbox/cosmetics/sword/{ANIMATION_NAME}/` |
| 立绘试色 | `public/sprites/inbox/stills/` |

拖进这条对话的输入框也可以，但更省事的是本机 `drop/` 文件夹 + `npm run drop:watch -- --push`。不要只留在本机炼丹目录。

---

## 投放门禁（W3 必过）

`W2 → W3 → 验收 → 投放`。**验收不过不许投放。**

```
check-alpha.cmd <角色文件夹>      拖动角色文件夹到脚本上，或写进 alpha-src.txt
check-fashi-alpha.cmd             法师专用（读 mage-src.txt）
```

| 结果 | 怎么办 |
| --- | --- |
| 全是 **PASS** | 可以进游戏 |
| 有 **FAIL** | 回「动作循环」页面重跑 W3 BiRefNet，再导出一次。**不要直接投放，也不要在游戏里补抠** |

`push-mage.cmd` / `push-mage.ps1` 已内置这道门禁：验收不过**直接中止**，
不会拷贝、不会 git commit、不会 push。

## W3 验收表

| 指标 | 通过条件 | 不通过说明 |
| --- | --- | --- |
| alpha 通道 | 存在且以 `A` 结尾 | 不是真透明 PNG |
| 全透明占比 | ≥ **15%** | 背景基本没删掉 |
| 不透明占比 | < **60%** | 主体外还有大块底色 |
| 边缘纯白占比 | < **25%** | 有白边 / 白晕 |
| 孤立碎渣数 | < **20** | 背景有噪点 / 碎块 |
| 独立主体数 | = **1** | 拼图 / 多角色，不是单角色帧 |

阈值单一事实来源：工具箱 `pages/phone/matting_w3.py`。
门禁脚本 `scripts/check-sprite-alpha.py` 默认调用它的 `check_frame`；
工具箱不可用时用内置等价实现，并会**明确告警**（避免悄悄降级后误判通过）。

## 投放清单（逐条过）

1. **目录**：`人物生成图/{角色}/{待机|走路|攻击|死亡}/` 下有 `00.png` 起连续编号
2. **帧数**：主角 26 帧；普通角色与 `prompts.json` 的 `frames` 一致
3. **透明底**：`.png` 带 alpha，背景是全透明（不是白色）
4. **无残留**：无白边、无白晕、无碎渣、无地面投影
5. **边缘**：有 1~2px 羽化过渡，不是硬切口
6. **单主体**：一帧里只有 1 个角色（不是拼图 / 多角色）
7. **对齐**：所有帧尺寸一致、脚底同一条水平线、水平居中
8. **朝向**：一套帧里左右朝向一致
9. **门禁**：`check-alpha.cmd` 全 PASS

> 后期 `rembg` 只能救急。已经糊进角色轮廓里的脏边救不回来 —— 必须回 W3 重出。

详见 [`docs/抠图.md`](../../docs/抠图.md)。
