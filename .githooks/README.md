# .githooks —— 第三方商业素材闸门

## 它防什么

这个仓库的远端是**公开**的。而本机拆包出来的商业游戏素材（隔离区在
`C:\Users\86041\tools\rip-work\`，仓库外面）只允许当本机参考，**不能进仓库**。

危险的是：本机有一条**自动**把图放进仓库的路 —— `npm run drop:push`
（`scripts/drop.mjs` 会 `git add public/sprites/inbox` → `commit` → `push`，全程不问人）。
所以闸门设在 git 层，而不是靠"记得别放"。

## 两层闸门

| hook | 时机 | 查什么 |
| --- | --- | --- |
| `pre-commit` | 每次 `git commit`（含 `drop:push` 里的自动提交） | 暂存区：文件名特征 + 内容 sha256 清单 |
| `pre-push` | 每次 `git push`（含 `backup.cmd`） | 所有已跟踪文件（兜底：闸门装上之前提交的、或 `--no-verify` 绕过的） |

判定标准见 `scripts/thirdparty-asset-guard.mjs` 顶部注释；清单在隔离区
（`rip-work/manifest.sha256`，由隔离区的 `make-manifest.py` 生成），**不进仓库**。

## 启用（每个 clone 各做一次）

```bash
git config core.hooksPath .githooks
```

没做这一步时钩子不会跑（`git config core.hooksPath` 空着就是没启用）。

## 手动体检

```bash
npm run guard:assets        # 扫一遍所有已跟踪文件，正常输出「干净」
node scripts/thirdparty-asset-guard.mjs --paths 某个文件   # 单文件手查
```

## 已知边界（别当它是万能的）

- 清单是**本机快照**：隔离区里新增素材后，要在隔离区重跑 `make-manifest.py`，否则新文件只能靠文件名拦。
- 暂存内容与工作区不一致时按工作区文件算 —— 拦手滑够用，不防刻意对抗。
- `git commit --no-verify` / `git push --no-verify` 能绕过。它是防误操作，不是防人。
