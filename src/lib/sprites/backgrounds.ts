import { CHAPTERS } from "@/lib/d2/campaign";

/** 横板循环条。左右必须能接上，游戏按这条尺寸 cover 裁切。 */
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

export function backgroundThemePrompt(chapter: number): string {
  const ch = CHAPTERS[Math.max(0, Math.min(CHAPTERS.length, chapter) - 1)];
  const scenes: Record<number, string> = {
    1: "blood-soaked wasteland, dead grass, cracked red earth, distant ruined keep, overcast crimson sky, Diablo 2 Act 1 wilderness",
    2: "frozen tundra at dusk, ice shards, pine silhouettes, pale aurora, Diablo 2 cold plains",
    3: "underground catacomb corridor in side view, bone piles, torch niches, damp stone, no vanishing-point hallway",
    4: "ancient sewer channel, green water, mossy brick arches repeating, torchlight, Lut Gholein sewers",
    5: "arid rocky highland, sandstone cliffs, dry shrubs, heat haze, late afternoon",
    6: "desert tomb interior strip, painted pillars repeating, sand drifts, dim gold light",
    7: "spider forest, giant webs between trees, purple fog, twisted roots, Kurast jungle",
    8: "ruined Kurast bazaar street, collapsed stalls, hanging cloth, humid dusk",
    9: "fortified plains, palisades, war camp wreckage, ash sky, Hellforge approach",
    10: "Chaos Sanctuary outer court, lava cracks, pentagram tiles repeating, infernal glow",
    11: "frozen plateau, barbarian ruins, snow cliffs, blizzard haze",
    12: "Worldstone Keep hall in side view, crystal veins, red banners repeating, no unique throne",
  };
  const scene = scenes[ch.id] ?? ch.name;
  return [
    `Side-scrolling 2D game background tile, landscape, ${BACKGROUND_SPEC.width}x${BACKGROUND_SPEC.height}.`,
    scene,
    `${ch.act} ${ch.name}.`,
    "Empty of characters, monsters, UI, text, watermarks, and weapons.",
    "Orthographic side view, camera locked, horizon straight, ground plane continuous.",
    `Ground line at ${Math.round(BACKGROUND_SPEC.groundY * 100)}% from the top, perfectly level.`,
    "Seamless horizontal loop: left edge matches right edge. Repeatable terrain only.",
    "No unique landmarks (one sun, one named castle, one moon, one door).",
    "Painterly dark fantasy, muted, readable silhouette at 320px tall.",
    "PNG, no JPEG banding.",
  ].join(" ");
}
