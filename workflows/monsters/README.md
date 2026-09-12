# 怪物纸娃娃出图

和角色一样：一类怪一套 **走路 / 攻击 / 死亡** 帧，侧面横板，脚踩地面线。

## 分类

| 英文目录 | 中文 | 用在 |
| --- | --- | --- |
| `minion` | 小怪 | 每章 1–8 关 |
| `champion` | 精英 | 每章 9 关 |
| `boss` | 首领 | 每章 10 关 |

先做通用三套即可；要分章再放进 `mob/1/minion/` 这种带章号的目录。

## 规格建议

- PNG，透明底
- 单帧建议约 256–512 高，脚在画面底部
- **默认朝左**（面向左侧的玩家）。跑道右侧不翻转。
- 走路 4–8 帧编号 `0.png` `1.png` …
- 不要 UI、字、水印；不要和背景糊成一坨

## 投放（Windows）

1. 把帧放进：

```
G:\guajiyouxi\guajiyouxi\drop\mob\minion\walking\0.png
G:\guajiyouxi\guajiyouxi\drop\mob\minion\walking\1.png
…
```

精英：`drop\mob\champion\walking\`  
首领：`drop\mob\boss\walking\`  
攻击/死亡：把 `walking` 换成 `attack` / `death`

中文目录同样可用：`drop\怪物\小怪\走路\`

2. 双击项目根目录的 **`push-mob.cmd`**
3. 跟我说：**图放好了**

分章覆盖（可选）：`drop\mob\1\minion\walking\` → 只给第 1 章小怪用。
