#!/usr/bin/env node
/**
 * 第三方商业素材闸门（third-party asset guard）
 *
 * 为什么要它
 * ----------
 * 拆包出来的商业游戏素材只能待在本机隔离区里当参考，绝不能进这个仓库——远端是公开的。
 * 而本机有两条「图进仓库」的路：
 *   1. 手动 `git add` + `commit`；
 *   2. `npm run drop:push`（scripts/drop.mjs 会自动 `git add public/sprites/inbox`
 *      → `commit` → `push`，全程不问人）。
 * 第 2 条是自动的，没人会逐张过目，所以闸门设在 git 层最省事：
 *   pre-commit → 查暂存区（挡提交，也就顺手挡住了 drop:push 那条自动路）
 *   pre-push   → 查所有已跟踪文件（挡住"已经进过历史、正要推公开远端"的东西）
 *
 * 判定分两层
 * ----------
 *   ① 文件名 / 路径特征：这些扩展名本工程永远用不到（.ftx/.mbs/.quad/.cpk/.pkg/.iso…），
 *      外加隔离区关键字（rip-work / vanillaware / 香草社 …）。
 *   ② sha256 清单：改名、换目录、裁掉文件名也拦得住。清单**不在仓库里**
 *      （清单本身也不该公开），默认读隔离区的 manifest.sha256，可用环境变量覆盖。
 *
 * 已知边界（不粉饰）
 * ----------------
 *   - 清单是本机快照：隔离区新增文件后要重跑隔离区里的 make-manifest.py。
 *   - 暂存内容与工作区不一致时按工作区文件算 —— 够拦手滑，不防刻意对抗。
 *   - `git commit --no-verify` / `git push --no-verify` 能绕过；这是防误操作，不是防人。
 *
 * 用法
 * ----
 *   node scripts/thirdparty-asset-guard.mjs --staged     # pre-commit 调用
 *   node scripts/thirdparty-asset-guard.mjs --tracked    # pre-push / npm run guard:assets
 *   node scripts/thirdparty-asset-guard.mjs --paths a b  # 手查指定文件
 * 环境变量：TRIPARTY_MANIFEST=<清单路径> 覆盖默认位置
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

// 隔离区（本机拆包素材的家，在仓库外面）；清单由隔离区里的 make-manifest.py 生成
const DEFAULT_MANIFEST = "C:/Users/86041/tools/rip-work/manifest.sha256";

// ① 这些扩展名只可能来自拆包产物，本工程正常素材是 png/json/atlas
const BLOCKED_SUFFIX = [
  ".ftx", ".mbs", ".mbp",            // 打包纹理 / 精灵数据
  ".quad", ".v55",                   // 上游解包中间格式
  ".gnf", ".gnf.rgba",               // PS4 纹理及解包出的原始像素
  ".osb", ".oeb", ".otm", ".orb", ".oab", ".zld", // 同族数据表
  ".cpk", ".acb", ".awb", ".acf", ".fms",         // CriWare 容器/音频/消息表
  ".pkg", ".xiso", ".iso",                        // 光盘/安装包镜像
];

// ① 路径里出现这些词也一样拦（隔离区名 + 商业作品名，任何大小写）
const BLOCKED_KEYWORDS = [
  "rip-work", "rip_work", "ripwork",
  "vanillaware", "香草社",
  "odin2", "odin_sphere", "odin-sphere", "odin sphere",
  "rehd_",
];

function sh(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts });
}

function repoRoot() {
  const r = sh("git", ["rev-parse", "--show-toplevel"]);
  if (r.status !== 0) {
    console.error("离线/非 git 仓库，闸门跳过。");
    process.exit(0);
  }
  return r.stdout.trim();
}

/**
 * 暂存区条目：只列"这次提交真正要写进去"的路径。
 * 为什么不用 `git ls-files --cached`：那会列出**整个索引**（几百个已跟踪文件），
 * 每次提交都全量扫一遍，既慢又让日志里那个数字骗人（不是本次暂存数）。
 * 加/改/复制/改名都算，删除不算（没有内容可查）。
 */
function stagedEntries(root) {
  const r = sh("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"], { cwd: root });
  return r.stdout.split("\0").filter(Boolean).map((p) => ({ path: p, blobSha: null }));
}

/** 已跟踪文件：[{path}] */
function trackedEntries(root) {
  const r = sh("git", ["ls-files", "-z"], { cwd: root });
  return r.stdout.split("\0").filter(Boolean).map((p) => ({ path: p, blobSha: null }));
}

function hitByPattern(filePath) {
  const lower = filePath.toLowerCase();
  for (const s of BLOCKED_SUFFIX) if (lower.endsWith(s)) return `扩展名 ${s}`;
  for (const k of BLOCKED_KEYWORDS) if (lower.includes(k.toLowerCase())) return `路径关键字 ${k}`;
  return null;
}

function loadManifest() {
  const file = process.env.TRIPARTY_MANIFEST || DEFAULT_MANIFEST;
  if (!existsSync(file)) return { file, hashes: null };
  const hashes = new Map();                        // sha256 -> 隔离区里的原名（给人看）
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^([0-9a-f]{64})\s\s?(.*)$/.exec(line.trim());
    if (m) hashes.set(m[1], m[2]);
  }
  return { file, hashes };
}

function sha256Of(root, entry) {
  const abs = path.join(root, entry.path);
  try {
    if (statSync(abs).isFile()) return createHash("sha256").update(readFileSync(abs)).digest("hex");
  } catch {
    /* 工作区没有（可能是别处删除的）→ 落到 blob */
  }
  if (!entry.blobSha) return null;
  const r = sh("git", ["cat-file", "blob", entry.blobSha], { cwd: root, encoding: "buffer" });
  if (r.status !== 0 || !r.stdout) return null;
  return createHash("sha256").update(r.stdout).digest("hex");
}

function main() {
  const argv = process.argv.slice(2);
  const root = repoRoot();
  let entries;
  let mode;

  if (argv.includes("--paths")) {
    mode = "paths";
    entries = argv.slice(argv.indexOf("--paths") + 1).map((p) => ({ path: p, blobSha: null }));
  } else if (argv.includes("--tracked")) {
    mode = "tracked";
    entries = trackedEntries(root);
  } else {
    mode = "staged";
    entries = stagedEntries(root);
  }

  const { file: manifestFile, hashes } = loadManifest();
  const hits = [];
  for (const e of entries) {
    const why = hitByPattern(e.path);
    if (why) {
      hits.push({ ...e, why });
      continue;
    }
    if (hashes) {
      const h = sha256Of(root, e);
      if (h && hashes.has(h)) hits.push({ ...e, why: `内容命中隔离区清单（${hashes.get(h)}）` });
    }
  }

  const label = { staged: "暂存区", tracked: "已跟踪文件", paths: "指定文件" }[mode];
  if (!hits.length) {
    const m = hashes ? `清单 ${hashes.size} 条` : `清单缺失（${manifestFile}），只按文件名判定`;
    console.log(`[素材闸门] ${label} ${entries.length} 项 → 干净（${m}）`);
    process.exit(0);
  }

  console.error(`[素材闸门] ${label}命中 ${hits.length} 项，已拦下：\n`);
  for (const h of hits) console.error(`  ✗ ${h.path}\n      ${h.why}`);
  console.error(`
处理办法
  · 这些素材只能留在本机隔离区（C:\\Users\\86041\\tools\\rip-work\\）当参考，不要进仓库。
  · 如果只是本地误放：把它移出工程目录，再 git restore --staged <路径>。
  · 确认是误报（自己画的图恰好撞名/撞哈希）：临时 TRIPARTY_MANIFEST=<空文件> 再重试，
    并把文件名改掉——不要用 --no-verify 硬闯。`);
  process.exit(1);
}

main();
