import { CHAPTERS } from "@/lib/d2/campaign";

/** 横板循环条硬规格。左右必须能接上，游戏按这条尺寸 cover 裁切。 */
export const BACKGROUND_SPEC = {
  width: 3840,
  minWidth: 1920,
  height: 720,
  /** 地面线：人物脚底对齐这条，约画面高度的 78%。 */
  groundY: 0.78,
  format: "png",
} as const;

export const BG_LAYER_IDS = ["sky", "mid", "ground", "loop"] as const;
export type BgLayerId = (typeof BG_LAYER_IDS)[number];

export const BG_LAYER_SPEED: Record<BgLayerId, number> = {
  sky: 0.22,
  mid: 0.55,
  ground: 1,
  loop: 0.72,
};

export const BG_LAYER_LABEL: Record<BgLayerId, string> = {
  sky: "远景/天空",
  mid: "中景",
  ground: "地面",
  loop: "整条循环",
};

/**
 * 香草社（Vanillaware）画风 World。
 * 技术硬规格 + 画风锁在一起，可直接贴进 ComfyUI / NovelAI World，或经 backgroundThemePrompt 拼章节场景。
 */
export const VANILLAWARE_WORLD = {
  name: "香草社横板背景世界",
  style: [
    "Vanillaware style hand-painted 2D fantasy background",
    "Odin Sphere / Dragon's Crown / Muramasa scenic atmosphere",
    "ornate decorative foliage and architecture, rich oil-paint texture",
    "soft theatrical lighting, layered depth silhouettes, controlled saturated palette",
    "game art background plate, not concept-sheet collage, not photoreal, not 3D render",
  ].join(", "),
  hardRulesZh: [
    `尺寸 ${BACKGROUND_SPEC.width}×${BACKGROUND_SPEC.height}（两屏宽）。最低 ${BACKGROUND_SPEC.minWidth}×${BACKGROUND_SPEC.height}`,
    "格式 PNG，不要 JPEG",
    "接缝：左边必须接得上右边，能无缝横铺",
    `地面：地面线水平，大约在画面高度 ${Math.round(BACKGROUND_SPEC.groundY * 100)}%（人物脚踩这条线）`,
    "镜头：纯侧面横板，地平线水平",
    "禁止：人物、怪物、UI、字、水印；太阳/月亮/独一门独一城堡这类没法循环的地标",
  ],
  hardRulesEn: [
    `Canvas ${BACKGROUND_SPEC.width}x${BACKGROUND_SPEC.height} landscape tile (two screens wide); minimum ${BACKGROUND_SPEC.minWidth}x${BACKGROUND_SPEC.height}.`,
    "PNG only, no JPEG banding.",
    "Seamless horizontal loop: left edge matches right edge exactly; tileable terrain only.",
    `Level ground line at ${Math.round(BACKGROUND_SPEC.groundY * 100)}% from the top; characters will stand on this line.`,
    "Pure orthographic side-scroller camera, locked horizon, continuous ground plane, no vanishing-point hallway.",
    "Empty of characters, monsters, UI, text, watermarks, weapons.",
    "No unique landmarks that break looping: one sun, one moon, one named castle, one unique door, one hero monument.",
  ],
} as const;

const CHAPTER_SCENES: Record<number, string> = {
  1: "blood-soaked wasteland, dead grass, cracked red earth, repeating ruined fence posts, overcast crimson sky, Diablo Act 1 wilderness mood",
  2: "frozen tundra at dusk, ice shards, pine silhouettes repeating, pale aurora haze, cold plains",
  3: "underground catacomb corridor in side view, bone piles, torch niches repeating, damp stone, no vanishing-point hallway",
  4: "ancient sewer channel, green water, mossy brick arches repeating, torchlight",
  5: "arid rocky highland, sandstone cliffs, dry shrubs repeating, heat haze, late afternoon",
  6: "desert tomb interior strip, painted pillars repeating, sand drifts, dim gold light",
  7: "spider forest, giant webs between trees, purple fog, twisted roots repeating",
  8: "ruined bazaar street, collapsed stalls, hanging cloth repeating, humid dusk",
  9: "fortified plains, palisades repeating, war camp wreckage, ash sky",
  10: "chaos sanctuary outer court, lava cracks, pentagram tiles repeating, infernal glow",
  11: "frozen plateau, barbarian ruin fragments repeating, snow cliffs, blizzard haze",
  12: "keep hall in side view, crystal veins, red banners repeating, no unique throne",
};

export function backgroundClip(chapter: number): string {
  const id = Math.max(1, Math.min(CHAPTERS.length, Math.floor(chapter)));
  return `inbox/backgrounds/chapter-${id}`;
}

export function chapterFromName(token: string): number | null {
  const raw = token.trim();
  if (!raw) return null;
  const folded = raw.replaceAll("_", "-").toLowerCase().replace(/^chapter-/, "").replace(/^ch-?/, "");
  const byName = CHAPTERS.find((c) => c.name === raw || c.name === folded);
  if (byName) return byName.id;
  const n = Number(folded);
  if (Number.isInteger(n) && n >= 1 && n <= CHAPTERS.length) return n;
  return null;
}

export function parseBgLayer(stem: string): BgLayerId | null {
  const t = stem.trim().replaceAll("_", "-").toLowerCase();
  if (t === "sky" || t === "far" || t === "天空" || t === "远景") return "sky";
  if (t === "mid" || t === "middle" || t === "中景") return "mid";
  if (t === "ground" || t === "near" || t === "地面" || t === "近景") return "ground";
  if (t === "loop" || t === "strip" || t === "循环" || t === "整图") return "loop";
  return null;
}

export function classifyBackgroundFrames(files: string[]): { id: BgLayerId; src: string }[] {
  const byStem = new Map<string, string>();
  const numbered: { n: number; src: string }[] = [];
  for (const src of files) {
    const base = src.split("?")[0].split("/").pop() ?? "";
    const match = base.match(/^(.+)\.(png|webp|gif|jpe?g)$/i);
    if (!match) continue;
    const stem = match[1].toLowerCase();
    byStem.set(stem, src);
    if (/^\d+$/.test(stem)) numbered.push({ n: Number(stem), src });
  }
  numbered.sort((a, b) => a.n - b.n);

  const layered = (["sky", "mid", "ground"] as const)
    .filter((id) => byStem.has(id))
    .map((id) => ({ id, src: byStem.get(id)! }));
  if (layered.length) return layered;
  if (byStem.has("loop")) return [{ id: "loop", src: byStem.get("loop")! }];
  if (numbered.length === 1) return [{ id: "loop", src: numbered[0].src }];
  const ids: BgLayerId[] = ["sky", "mid", "ground"];
  return numbered.slice(0, 3).map((item, i) => ({ id: ids[i] ?? "loop", src: item.src }));
}

export function stageRunSeconds(kind: "minion" | "champion" | "boss", powerRatio: number): number {
  if (powerRatio < 0.55) return 2.4;
  const base = kind === "boss" ? 9 : kind === "champion" ? 6.5 : 4.2;
  return Math.max(2.8, base / Math.min(1.8, Math.max(0.7, powerRatio)));
}

/** 香草社 World 正文（不含章节场景），适合贴进固定 World 槽。 */
export function vanillawareWorldPrompt(): string {
  return [
    VANILLAWARE_WORLD.name,
    VANILLAWARE_WORLD.style,
    ...VANILLAWARE_WORLD.hardRulesEn,
    "Readable silhouette when scaled to 320px tall.",
  ].join(" ");
}

/** 网页「复制本章背景提示词」：香草社 World + 本章场景。 */
export function backgroundThemePrompt(chapter: number): string {
  const ch = CHAPTERS[Math.max(0, Math.min(CHAPTERS.length, chapter) - 1)];
  const scene = CHAPTER_SCENES[ch.id] ?? ch.name;
  return [
    vanillawareWorldPrompt(),
    `Chapter scene: ${ch.act} ${ch.name}. ${scene}.`,
    "Single continuous side-scrolling strip, empty playfield for a character later.",
  ].join(" ");
}
