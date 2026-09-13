# 统一到 GitHub（一份仓库，两端共用）

目标：云端 Agent 与本机 `G:\guajiyouxi\guajiyouxi` **只认一个仓库**：

`https://github.com/8604101laozhu/guajiyouxi`

## 为什么以前对不上

- 云端写在 Cursor Origin 临时仓
- 本机写在 GitHub
- 两边不通 → 我建的目录进不了你的 G 盘

## 统一后流程

| 谁 | 做什么 |
| --- | --- |
| Agent | 改代码 / 建目录 → `git push` 到 GitHub |
| 你 | 本机双击 `unify-pull.cmd` 或 `git pull` |
| 你 | 改图后 `git push`，跟我说「备份好了」 |
| Agent | `git fetch github` 收你的图 |

## 你需要做的一次授权

1. GitHub 新建 Personal Access Token（至少能写这个仓库）
2. 在 Cursor 提示里填入密钥 `GITHUB_TOKEN`
3. 回我说：**密钥好了**
4. 等我推送成功后，本机运行 `unify-pull.cmd`

## 女法师目录（统一后）

```text
public\sprites\inbox\characters\nv-fashi\walking\
public\sprites\inbox\characters\nv-fashi\attack\
public\sprites\inbox\characters\nv-fashi\death\
public\sprites\inbox\characters\nv-fashi\idle\
```
