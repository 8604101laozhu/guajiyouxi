import { copyFile, mkdir, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const IMAGE_EXT = "(png|webp|gif|jpe?g)";

const ANIM_ALIAS = {
  walking: "walking",
  walk: "walking",
  走路: "walking",
  attack: "attack",
  攻击: "attack",
  death: "death",
  死亡: "death",
};

const COS_ALIAS = {
  staff: "staff",
  法杖: "staff",
  sword: "sword",
  剑: "sword",
};

const STILL_ALIAS = new Set(["stills", "still", "立绘"]);

const BG_ROOT = new Set(["背景", "backgrounds", "background", "bg"]);

const CHAPTER_NAMES = {
  鲜血荒地: 1,
  冰冷之原: 2,
  地下墓穴: 3,
  鲁高因下水道: 4,
  干燥高地: 5,
  "塔·拉夏古墓": 6,
  蜘蛛森林: 7,
  库拉斯特集市: 8,
  平原要塞: 9,
  混沌避难所: 10,
  冰冻高原: 11,
  世界之石要塞: 12,
};

const BG_LAYERS = {
  sky: "sky",
  far: "sky",
  天空: "sky",
  远景: "sky",
  mid: "mid",
  middle: "mid",
  中景: "mid",
  ground: "ground",
  near: "ground",
  地面: "ground",
  近景: "ground",
  loop: "loop",
  strip: "loop",
  循环: "loop",
  整图: "loop",
};

export const DROP_FOLDERS = [
  { folder: "走路", clip: "inbox/base_animations/walking" },
  { folder: "攻击", clip: "inbox/base_animations/attack" },
  { folder: "死亡", clip: "inbox/base_animations/death" },
  { folder: "立绘", clip: "inbox/stills" },
  { folder: "法杖/走路", clip: "inbox/cosmetics/staff/walking" },
  { folder: "法杖/攻击", clip: "inbox/cosmetics/staff/attack" },
  { folder: "法杖/死亡", clip: "inbox/cosmetics/staff/death" },
  { folder: "剑/走路", clip: "inbox/cosmetics/sword/walking" },
  { folder: "剑/攻击", clip: "inbox/cosmetics/sword/attack" },
  { folder: "剑/死亡", clip: "inbox/cosmetics/sword/death" },
  { folder: "背景/1", clip: "inbox/backgrounds/chapter-1" },
  { folder: "背景/2", clip: "inbox/backgrounds/chapter-2" },
  { folder: "背景/3", clip: "inbox/backgrounds/chapter-3" },
  { folder: "背景/4", clip: "inbox/backgrounds/chapter-4" },
  { folder: "背景/5", clip: "inbox/backgrounds/chapter-5" },
  { folder: "背景/6", clip: "inbox/backgrounds/chapter-6" },
  { folder: "背景/7", clip: "inbox/backgrounds/chapter-7" },
  { folder: "背景/8", clip: "inbox/backgrounds/chapter-8" },
  { folder: "背景/9", clip: "inbox/backgrounds/chapter-9" },
  { folder: "背景/10", clip: "inbox/backgrounds/chapter-10" },
  { folder: "背景/11", clip: "inbox/backgrounds/chapter-11" },
  { folder: "背景/12", clip: "inbox/backgrounds/chapter-12" },
];

export function toPosix(rel) {
  return rel.replaceAll("\\", "/").replace(/^\.\//, "");
}

function fold(token) {
  return token.trim().replaceAll("_", "-").toLowerCase();
}

function mapAnim(token) {
  return ANIM_ALIAS[fold(token)] ?? ANIM_ALIAS[token] ?? null;
}

function mapCos(token) {
  return COS_ALIAS[fold(token)] ?? COS_ALIAS[token] ?? null;
}

function isStill(token) {
  return STILL_ALIAS.has(fold(token)) || STILL_ALIAS.has(token);
}

function clipFor(anim, cosmetic) {
  if (anim === "stills") return "inbox/stills";
  if (cosmetic) return `inbox/cosmetics/${cosmetic}/${anim}`;
  return `inbox/base_animations/${anim}`;
}

function parseFile(file) {
  const match = file.match(new RegExp(`^(.+)\\.(${IMAGE_EXT})$`, "i"));
  if (!match) return null;
  const stem = match[1];
  const ext = match[2].toLowerCase() === "jpeg" ? "jpg" : match[2].toLowerCase();
  const numbered = stem.match(/(\d+)$/);
  const prefix = numbered ? stem.slice(0, numbered.index).replace(/[-_\s]+$/, "") : stem;
  const index = numbered ? Number(numbered[1]) : null;
  return { index, ext, prefix };
}

function hitFromTokens(tokens, index, ext) {
  const parts = tokens.map(fold).filter(Boolean);
  if (parts[0] === "base-animations" || parts[0] === "base_animations") {
    const anim = mapAnim(parts[1] ?? "");
    if (!anim) return null;
    return { clip: clipFor(anim), index, ext };
  }
  if (parts[0] === "cosmetics") {
    const cosmetic = mapCos(parts[1] ?? "");
    const anim = mapAnim(parts[2] ?? "");
    if (!cosmetic || !anim) return null;
    return { clip: clipFor(anim, cosmetic), index, ext };
  }
  if (parts.length >= 2) {
    const cosmetic = mapCos(parts[0]);
    const anim = mapAnim(parts[1]);
    if (cosmetic && anim) return { clip: clipFor(anim, cosmetic), index, ext };
  }
  if (parts.length >= 1) {
    if (isStill(parts[0])) return { clip: clipFor("stills"), index, ext };
    const anim = mapAnim(parts[0]);
    if (anim) return { clip: clipFor(anim), index, ext };
  }
  return null;
}

function mapChapter(token) {
  if (!token) return null;
  if (CHAPTER_NAMES[token]) return CHAPTER_NAMES[token];
  const folded = fold(token).replace(/^chapter-/, "").replace(/^ch-?/, "");
  if (CHAPTER_NAMES[folded]) return CHAPTER_NAMES[folded];
  const n = Number(folded);
  if (Number.isInteger(n) && n >= 1 && n <= 12) return n;
  return null;
}

function mapLayer(stem, index) {
  const folded = fold(stem);
  if (BG_LAYERS[stem]) return BG_LAYERS[stem];
  if (BG_LAYERS[folded]) return BG_LAYERS[folded];
  if (index === 0) return "loop";
  if (index === 1) return "mid";
  if (index === 2) return "ground";
  return "loop";
}

function backgroundHit(chapter, stem, index, ext) {
  if (!chapter) return null;
  return {
    clip: `inbox/backgrounds/chapter-${chapter}`,
    index: null,
    ext,
    destName: `${mapLayer(stem, index)}.${ext}`,
  };
}

function hitFromPrefix(prefix, index, ext) {
  const folded = fold(prefix);
  if (!folded) return null;
  const cosAnim = folded.match(/^(staff|sword|法杖|剑)[-/]?(walking|attack|death|walk|走路|攻击|死亡)$/i);
  if (cosAnim) {
    const cosmetic = mapCos(cosAnim[1]);
    const anim = mapAnim(cosAnim[2]);
    if (cosmetic && anim) return { clip: clipFor(anim, cosmetic), index, ext };
  }
  if (isStill(folded)) return { clip: clipFor("stills"), index, ext };
  const anim = mapAnim(folded);
  if (anim) return { clip: clipFor(anim), index, ext };
  return null;
}

export function resolveDropRel(rel) {
  const posix = toPosix(rel);
  if (!posix || posix.endsWith("/")) return null;
  const bits = posix.split("/").filter(Boolean);
  const file = bits.pop();
  if (!file) return null;
  const parsed = parseFile(file);
  if (!parsed) return null;
  if (bits[0] && BG_ROOT.has(bits[0])) {
    const chapter = mapChapter(bits[1] ?? parsed.prefix);
    const stem = bits.length >= 3 ? bits[2] : parsed.prefix;
    const hit = backgroundHit(chapter, stem, parsed.index, parsed.ext);
    if (hit) return hit;
  }
  if (bits.length === 0) {
    const bgPrefix = parsed.prefix.match(/^(背景|bg|backgrounds?)[-_]?(.+)$/i);
    if (bgPrefix) {
      const rest = bgPrefix[2];
      const parts = rest.split(/[-_/]/).filter(Boolean);
      const chapter = mapChapter(parts[0] ?? "");
      const stem = parts[1] ?? parsed.prefix;
      const hit = backgroundHit(chapter, stem, parsed.index, parsed.ext);
      if (hit) return hit;
    }
  }
  const fromFolders = hitFromTokens(bits, parsed.index, parsed.ext);
  if (fromFolders) return fromFolders;
  if (bits.length === 0) {
    return (
      hitFromPrefix(parsed.prefix, parsed.index, parsed.ext) ?? {
        clip: "inbox/unsorted",
        index: parsed.index,
        ext: parsed.ext,
      }
    );
  }
  return { clip: "inbox/unsorted", index: parsed.index, ext: parsed.ext };
}

export function numericFrameName(file) {
  const match = file.match(/^(\d+)\.(png|webp|gif|jpe?g)$/i);
  return match ? Number(match[1]) : null;
}

export function nextFrameIndex(existing) {
  const nums = existing.map(numericFrameName).filter((n) => n !== null);
  return nums.length ? Math.max(...nums) + 1 : 0;
}

export function destFrameName(index, ext) {
  return `${index}.${ext}`;
}

export async function ensureDropTree(dropDir) {
  await mkdir(dropDir, { recursive: true });
  for (const slot of DROP_FOLDERS) {
    await mkdir(path.join(dropDir, ...slot.folder.split("/")), { recursive: true });
  }
}

export async function loadDropConfig(repoRoot) {
  const fallback = path.join(repoRoot, "drop");
  let dropDir = process.env.SPRITE_DROP || fallback;
  let push = false;
  try {
    const raw = await readFile(path.join(repoRoot, "drop.json"), "utf8");
    const parsed = JSON.parse(raw);
    if (parsed.dropDir) dropDir = parsed.dropDir;
    if (parsed.push) push = true;
  } catch {
    /* optional */
  }
  return { dropDir, push };
}

async function listFilesRecursive(root, rel = "") {
  const dir = path.join(root, rel);
  let names = [];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const out = [];
  for (const name of names) {
    if (name.startsWith(".")) continue;
    if (name === "放到这里.txt" || name === "开始投放.cmd") continue;
    const child = rel ? `${rel}/${name}` : name;
    const info = await stat(path.join(root, child));
    if (info.isDirectory()) out.push(...(await listFilesRecursive(root, child)));
    else out.push(toPosix(child));
  }
  return out;
}

export async function ingestDrop(dropDir, inboxRoot) {
  const files = await listFilesRecursive(dropDir);
  const copied = [];
  const assigned = new Map();

  async function listing(clip) {
    if (!assigned.has(clip)) {
      try {
        assigned.set(clip, await readdir(path.join(inboxRoot, clip)));
      } catch {
        assigned.set(clip, []);
      }
    }
    return assigned.get(clip);
  }

  for (const rel of files) {
    const hit = resolveDropRel(rel);
    if (!hit) continue;
    const names = await listing(hit.clip);
    const index = hit.index ?? nextFrameIndex(names);
    const destName = hit.destName ?? destFrameName(index, hit.ext);
    const destDir = path.join(inboxRoot, hit.clip);
    await mkdir(destDir, { recursive: true });
    const dest = path.join(destDir, destName);
    await copyFile(path.join(dropDir, rel), dest);
    assigned.set(
      hit.clip,
      names.filter((name) => name !== destName).concat(destName),
    );
    copied.push({ from: rel, to: `${hit.clip}/${destName}`, clip: hit.clip });
  }
  return copied;
}
