#!/usr/bin/env node
/**
 * Import a studio character pack into public/sprites/inbox.
 *
 * Layout (auto-built by art tools):
 *   D:\ai炼丹\香草社\人物生成图\{名字}\待机|走路|攻击|死亡\00.png …
 *
 * Usage:
 *   node scripts/import-char.mjs
 *   node scripts/import-char.mjs 法师1新
 *   node scripts/import-char.mjs "D:\ai炼丹\香草社\人物生成图\法师1新"
 *   node scripts/import-char.mjs 史莱姆王 --as=boss
 *   node scripts/import-char.mjs 法师1新 --no-push
 */
import { existsSync } from "node:fs";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inboxRoot = path.join(repoRoot, "public", "sprites");
const configPath = path.join(repoRoot, "char-import.json");

/** Same folder the art pipeline auto-creates. Edit char-import.json if yours differs. */
export const DEFAULT_STUDIO_ROOT = String.raw`D:\ai炼丹\香草社\人物生成图`;

/** Studio action folder → hero inbox clip. */
export const HERO_ACTION_CLIPS = {
  待机: "inbox/base_animations/idle",
  idle: "inbox/base_animations/idle",
  stand: "inbox/base_animations/idle",
  走路: "inbox/base_animations/walking",
  walking: "inbox/base_animations/walking",
  walk: "inbox/base_animations/walking",
  攻击: "inbox/base_animations/attack",
  attack: "inbox/base_animations/attack",
  死亡: "inbox/base_animations/death",
  death: "inbox/base_animations/death",
  立绘: "inbox/stills",
  stills: "inbox/stills",
};

const ROLE_ALIAS = {
  minion: "minion",
  小怪: "minion",
  champion: "champion",
  elite: "champion",
  精英: "champion",
  boss: "boss",
  首领: "boss",
  头目: "boss",
  hero: "hero",
  player: "hero",
  角色: "hero",
  主角: "hero",
};

const IMAGE_RE = /\.(png|webp|gif|jpe?g)$/i;

export function normalizeFrameName(file) {
  const match = file.match(/^.*?(\d+)\.(png|webp|gif|jpe?g)$/i);
  if (!match) return null;
  const ext = match[2].toLowerCase() === "jpeg" ? "jpg" : match[2].toLowerCase();
  return `${Number(match[1])}.${ext}`;
}

export function resolveActionClip(actionFolder, asRole) {
  const key = actionFolder.trim();
  const heroClip = HERO_ACTION_CLIPS[key] ?? HERO_ACTION_CLIPS[key.toLowerCase()];
  if (!heroClip) return null;
  if (asRole === "hero") return heroClip;
  const anim = heroClip.split("/").at(-1);
  if (anim === "stills") return `inbox/monsters/${asRole}/idle`;
  return `inbox/monsters/${asRole}/${anim}`;
}

export function resolveRole(raw) {
  if (!raw) return "hero";
  return ROLE_ALIAS[raw] ?? ROLE_ALIAS[raw.toLowerCase()] ?? "hero";
}

async function loadConfig() {
  const fallback = {
    studioRoot: DEFAULT_STUDIO_ROOT,
    lastChar: "法师1新",
    as: "hero",
    push: true,
  };
  try {
    const raw = JSON.parse(await readFile(configPath, "utf8"));
    return { ...fallback, ...raw };
  } catch {
    return fallback;
  }
}

async function saveConfig(cfg) {
  await writeFile(configPath, `${JSON.stringify(cfg, null, 2)}\n`, "utf8");
}

function parseArgs(argv) {
  let asRole = null;
  let push = null;
  const positionals = [];
  for (const arg of argv) {
    if (arg === "--no-push") push = false;
    else if (arg === "--push") push = true;
    else if (arg.startsWith("--as=")) asRole = arg.slice("--as=".length);
    else if (!arg.startsWith("-")) positionals.push(arg);
  }
  return { positionals, asRole, push };
}

function resolveCharDir(input, studioRoot) {
  if (!input) return null;
  if (/^[a-zA-Z]:[\\/]/.test(input) || input.startsWith("\\\\")) return input;
  if (path.isAbsolute(input)) return input;
  return path.join(studioRoot, input);
}

async function clearImages(dir) {
  if (!existsSync(dir)) return;
  const files = await readdir(dir);
  for (const file of files) {
    if (IMAGE_RE.test(file)) await rm(path.join(dir, file), { force: true });
  }
}

async function importPack(charDir, asRole) {
  if (!existsSync(charDir)) {
    throw new Error(`角色包不存在：${charDir}`);
  }
  const entries = await readdir(charDir, { withFileTypes: true });
  const actions = entries.filter((d) => d.isDirectory()).map((d) => d.name);
  const copied = [];

  for (const action of actions) {
    const clip = resolveActionClip(action, asRole);
    if (!clip) {
      console.log(`跳过未识别动作文件夹：${action}`);
      continue;
    }
    const srcDir = path.join(charDir, action);
    const files = (await readdir(srcDir))
      .filter((f) => IMAGE_RE.test(f))
      .sort((a, b) => {
        const na = Number(a.match(/(\d+)/)?.[1] ?? NaN);
        const nb = Number(b.match(/(\d+)/)?.[1] ?? NaN);
        if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
        return a.localeCompare(b);
      });
    if (!files.length) continue;

    const destDir = path.join(inboxRoot, clip);
    await mkdir(destDir, { recursive: true });
    await clearImages(destDir);
    for (const file of files) {
      const destName = normalizeFrameName(file) ?? file.toLowerCase();
      await cp(path.join(srcDir, file), path.join(destDir, destName));
      copied.push({ from: path.join(action, file), to: `${clip}/${destName}` });
    }
  }
  return copied;
}

function gitPushInbox(charName, asRole) {
  if (!existsSync(path.join(repoRoot, ".git"))) {
    console.log("图已进工程，但没有 git，推不上去。");
    return false;
  }
  const add = spawnSync("git", ["add", "--", "public/sprites/inbox"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (add.status !== 0) {
    console.error(add.stderr || add.stdout);
    return false;
  }
  const status = spawnSync("git", ["status", "--porcelain", "--", "public/sprites/inbox"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (!status.stdout.trim()) {
    console.log("没有新的帧要提交（和仓库里一样）。");
    return false;
  }
  console.log(status.stdout);
  const msg = `Import ${charName} (${asRole}) frames from studio pack.`;
  const commit = spawnSync("git", ["commit", "-m", msg], { cwd: repoRoot, encoding: "utf8" });
  if (commit.status !== 0) {
    console.error(commit.stderr || commit.stdout);
    console.error("提交失败：检查 git user.name / user.email。");
    return false;
  }
  const push = spawnSync("git", ["push"], { cwd: repoRoot, encoding: "utf8" });
  if (push.status !== 0) {
    console.error(push.stderr || push.stdout);
    console.error("推送失败。");
    return false;
  }
  console.log("已推到仓库。回来跟我说「图放好了」。");
  return true;
}

async function main() {
  const cfg = await loadConfig();
  const args = parseArgs(process.argv.slice(2));
  const asRole = resolveRole(args.asRole ?? cfg.as ?? "hero");
  const doPush = args.push ?? cfg.push ?? true;

  const input = args.positionals[0] ?? cfg.lastChar;
  const charDir = resolveCharDir(input, cfg.studioRoot);
  if (!charDir) {
    console.log("用法: node scripts/import-char.mjs 法师1新");
    console.log(`默认炼丹目录: ${cfg.studioRoot}`);
    process.exitCode = 1;
    return;
  }

  const charName = path.basename(charDir);
  console.log(`角色包: ${charDir}`);
  console.log(`导入为: ${asRole}`);

  const copied = await importPack(charDir, asRole);
  if (!copied.length) {
    console.log("FAIL: 没找到 待机/走路/攻击/死亡 下的图片。");
    console.log(`请确认存在例如：${path.join(charDir, "走路", "00.png")}`);
    process.exitCode = 1;
    return;
  }
  for (const item of copied) {
    console.log(`${item.from} → public/sprites/${item.to}`);
  }
  console.log(`共 ${copied.length} 帧`);

  cfg.lastChar = charName;
  cfg.as = asRole;
  cfg.push = doPush;
  await saveConfig(cfg);

  if (doPush) gitPushInbox(charName, asRole);
  else console.log("已跳过 git push（--no-push）。");
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entry === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
