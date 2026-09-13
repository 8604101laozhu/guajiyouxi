#!/usr/bin/env node
/**
 * Import ONE studio character pack into public/sprites/inbox.
 *
 * Layout (auto-built by art tools):
 *   D:\ai炼丹\香草社\人物生成图\{名字}\待机|走路|攻击|死亡\00.png …
 *
 * There is NO default character. 法师1新 is just one folder among many.
 *
 * Usage:
 *   node scripts/import-char.mjs 法师1新
 *   node scripts/import-char.mjs 史莱姆王 --as=boss
 *   node scripts/import-char.mjs "D:\ai炼丹\香草社\人物生成图\某角色"
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

/** Studio root only — characters are subfolders. Edit char-import.json if yours differs. */
export const DEFAULT_STUDIO_ROOT = String.raw`D:\ai炼丹\香草社\人物生成图`;

/** Studio action folder → relative anim name under a character. */
export const HERO_ACTION_ANIMS = {
  待机: "idle",
  idle: "idle",
  stand: "idle",
  走路: "walking",
  walking: "walking",
  walk: "walking",
  攻击: "attack",
  attack: "attack",
  死亡: "death",
  death: "death",
};

export const DEFAULT_PLAYER_ID = "nv-fashi";

export const PLAYER_ALIASES = {
  "nv-fashi": "nv-fashi",
  fashi: "nv-fashi",
  mage: "nv-fashi",
  女法师: "nv-fashi",
  女法: "nv-fashi",
  法师: "nv-fashi",
  法师1新: "nv-fashi",
};

export function resolveHeroClip(actionFolder, playerId = DEFAULT_PLAYER_ID) {
  const key = actionFolder.trim();
  const anim = HERO_ACTION_ANIMS[key] ?? HERO_ACTION_ANIMS[key.toLowerCase()];
  if (!anim) {
    if (key === "立绘" || key.toLowerCase() === "stills") return "inbox/stills";
    return null;
  }
  return `inbox/characters/${playerId}/${anim}`;
}

/** @deprecated flat clips without character name — prefer resolveHeroClip */
export const HERO_ACTION_CLIPS = {
  待机: "inbox/characters/nv-fashi/idle",
  idle: "inbox/characters/nv-fashi/idle",
  stand: "inbox/characters/nv-fashi/idle",
  走路: "inbox/characters/nv-fashi/walking",
  walking: "inbox/characters/nv-fashi/walking",
  walk: "inbox/characters/nv-fashi/walking",
  攻击: "inbox/characters/nv-fashi/attack",
  attack: "inbox/characters/nv-fashi/attack",
  死亡: "inbox/characters/nv-fashi/death",
  death: "inbox/characters/nv-fashi/death",
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

export function resolvePlayerId(nameOrId) {
  if (!nameOrId) return DEFAULT_PLAYER_ID;
  const raw = String(nameOrId).trim();
  return (
    PLAYER_ALIASES[raw] ??
    PLAYER_ALIASES[raw.toLowerCase()] ??
    (/^[a-z0-9-]+$/i.test(raw) ? raw.toLowerCase() : DEFAULT_PLAYER_ID)
  );
}

export function resolveActionClip(actionFolder, asRole, playerId = DEFAULT_PLAYER_ID) {
  if (asRole === "hero") return resolveHeroClip(actionFolder, playerId);
  const anim = HERO_ACTION_ANIMS[actionFolder.trim()] ?? HERO_ACTION_ANIMS[actionFolder.trim().toLowerCase()];
  if (!anim) {
    if (actionFolder.trim() === "立绘" || actionFolder.trim().toLowerCase() === "stills") {
      return `inbox/monsters/${asRole}/idle`;
    }
    return null;
  }
  return `inbox/monsters/${asRole}/${anim}`;
}

export function resolveRole(raw) {
  if (!raw) return "hero";
  return ROLE_ALIAS[raw] ?? ROLE_ALIAS[raw.toLowerCase()] ?? "hero";
}

/** One subfolder under studio root = one character. */
export async function listStudioCharacters(studioRoot) {
  if (!existsSync(studioRoot)) return [];
  const entries = await readdir(studioRoot, { withFileTypes: true });
  return entries
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, "zh"));
}

async function loadConfig() {
  const fallback = {
    studioRoot: DEFAULT_STUDIO_ROOT,
    lastChar: "",
    as: "hero",
    push: true,
  };
  try {
    const raw = JSON.parse(await readFile(configPath, "utf8"));
    return { ...fallback, ...raw, lastChar: raw.lastChar ?? "" };
  } catch {
    return fallback;
  }
}

async function saveConfig(cfg) {
  await writeFile(configPath, `${JSON.stringify(cfg, null, 2)}\n`, "utf8");
}

async function printUsage(cfg) {
  console.log("必须指定角色名。法师1新只是其中之一，不会默认导入。");
  console.log("");
  console.log("用法:");
  console.log("  import-char.cmd 角色名");
  console.log("  import-char.cmd 史莱姆王 --as=boss");
  console.log("  或把某个角色文件夹拖到 import-char.cmd 上");
  console.log("");
  console.log("炼丹根目录（下面每个子文件夹是一个角色）:");
  console.log(`  ${cfg.studioRoot}`);
  const names = await listStudioCharacters(cfg.studioRoot);
  if (names.length) {
    console.log("");
    console.log("当前能看到的角色:");
    for (const name of names) {
      const mark = name === cfg.lastChar ? "  <- 上次导过" : "";
      console.log(`  ${name}${mark}`);
    }
  } else if (!existsSync(cfg.studioRoot)) {
    console.log("");
    console.log("这个根目录还不存在，请改 char-import.json 里的 studioRoot。");
  } else {
    console.log("");
    console.log("根目录是空的，先在炼丹机生成角色包。");
  }
  if (cfg.lastChar) {
    console.log("");
    console.log(`上次导过: ${cfg.lastChar}（不会自动再导，请显式写名字）`);
  }
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
  const charName = path.basename(charDir);
  const playerId = asRole === "hero" ? resolvePlayerId(charName) : null;
  if (asRole === "hero") {
    console.log(`玩家角色目录: characters/${playerId}（${charName}）`);
  }
  const entries = await readdir(charDir, { withFileTypes: true });
  const actions = entries.filter((d) => d.isDirectory()).map((d) => d.name);
  const copied = [];

  for (const action of actions) {
    const clip = resolveActionClip(action, asRole, playerId ?? DEFAULT_PLAYER_ID);
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

  const input = args.positionals[0];
  if (!input) {
    await printUsage(cfg);
    process.exitCode = 1;
    return;
  }

  const charDir = resolveCharDir(input, cfg.studioRoot);
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
