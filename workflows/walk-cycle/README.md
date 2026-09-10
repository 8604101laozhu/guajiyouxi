# 法师走路工作流

现在工坊里那 8 张是**同一姿势的试色**，没有摆臂、也没有左右脚交替。GitHub 上能用的现成管线都说了同一句话：**不要用文生图一张一张出走路帧。**

## 用哪条

按你已经在用 Qwen 炼丹的机器，走这条（也是现在最稳的）：

### 1. 推荐：Qwen 改姿势 + WAN 图生视频

仓库：[mor-o/comfyui-2d-character-pipeline](https://github.com/mor-o/comfyui-2d-character-pipeline)

| 步 | 工作流 | 做什么 |
| --- | --- | --- |
| W1 | Qwen-Image-Edit 2509 + InstantX ControlNet-Union（`openpose`） | 用骨骼把立绘拧到某一帧走路姿势，人还是同一个人 |
| W2 | WAN 2.2 i2v 14B | **真正写出摆臂和换脚**。一张关键帧外推整段视频 |
| W3 | BiRefNet | 去底，切成横向 sprite strip |

本目录 `openpose/0.png` … `7.png` 就是 W1 要用的 8 张 COCO-18 骨骼（JSON 在旁边）。把干净立绘 `public/sprites/mage/rig/texture.png` 和 `openpose/0.png` 丢进 ComfyUI `input/`。

W2 提示词按性别只换三个槽：`BODY` / `HAIR` / `CHEST`。图还是同一套 WAN，不要另训模型。槽位在 `prompts.json`，工坊左侧可复制填好的全文。

女管线默认：长发梢滞后抖动；落脚后胸腔有小幅延迟回弹。个别女性角色不需要胸动时，把 `CHEST` 换成男槽，或把滑条打到 0。

男管线：头发轻摆、`firm torso; no chest bounce`。

```json
{{HAIR}}  → 女：delayed sway + tip jitter
           男：light sway only
{{CHEST}} → 女：subtle delayed chest bounce
            男：no chest bounce
```

头发按 [mor-o Pipeline 2](https://github.com/mor-o/comfyui-2d-character-pipeline) 做成独立 cosmetic 层（W4 VACE 两遍 inpaint，W5 SAM3 `prompt=hair`）。运行时叠在身体上，梢用二次运动抖动。男女同一张图生视频工作流，只替换提示词槽。

WAN 帧数必须是 `4n+1`（33 或 49）。16fps 下 33 帧约 2 秒。从视频里**只抽一个完整循环的 8～12 帧**，存成 `public/sprites/mage/walk-cycle/0.png` …

### 2. 只要关键帧、先不跑视频

仓库：[Spit8/_ComfyUI_CharacterPose](https://github.com/Spit8/_ComfyUI_CharacterPose)

`CP_PoseComposer3D` 的 `walk_01` … `walk_04`，相机用 `SE` 或 `E`。再接到 Qwen-Image-Edit + ControlNet Union。这能做出换脚的 4 张关键帧，但循环没有 W2 顺。

### 3. 不要用

- 每帧单独文生图（就是现在这 8 张立绘）
- 把格子图、像素网格当 i2v 第二张输入（[chongdashu/ai-game-spritesheets](https://github.com/chongdashu/ai-game-spritesheets) 里写了，会融进画面）
- Facebook [AnimatedDrawings](https://github.com/facebookresearch/AnimatedDrawings) 能绑骨骼走路，但画风会变成剪纸，不适合当正式立绘

同一结论也写在 [chongdashu/ai-game-spritesheets](https://github.com/chongdashu/ai-game-spritesheets) 的 `prompts/05-walk-cycle-i2v.md`：走路只能图生视频再抽帧。

## 抽好的帧怎么交给工坊

文件名纯数字，拖进这条对话的输入框：

`public/sprites/mage/walk-cycle/0.png` … `11.png`

工坊「法师走路」会按数字排序循环。骨骼引导只是预览步态；衣服和靴子的形变要等 W2 的帧。
