export const DIFFICULTY_IDS = ["normal", "elite", "nightmare", "hell"] as const;
export type DifficultyId = (typeof DIFFICULTY_IDS)[number];

export type MonsterKind = "minion" | "champion" | "boss";

export type DifficultyDef = {
  id: DifficultyId;
  name: string;
  /** 相对普通的血量倍率，手游关卡墙。 */
  hp: number;
  def: number;
  gold: number;
  /** 暗黑 2 风格：每只怪在 TC 里抽几次。 */
  picks: number;
  extraPickChance: number;
  noDrop: number;
  uber: boolean;
  mlvlBonus: number;
  tcBias: number;
  jewelryChance: number;
};

export const DIFFICULTIES: DifficultyDef[] = [
  {
    id: "normal",
    name: "普通",
    hp: 1,
    def: 1,
    gold: 1,
    picks: 1,
    extraPickChance: 0,
    noDrop: 42,
    uber: false,
    mlvlBonus: 0,
    tcBias: 0,
    jewelryChance: 5,
  },
  {
    id: "elite",
    name: "精英",
    hp: 2.5,
    def: 1.7,
    gold: 1.7,
    picks: 1,
    extraPickChance: 45,
    noDrop: 24,
    uber: false,
    mlvlBonus: 8,
    tcBias: 2,
    jewelryChance: 8,
  },
  {
    id: "nightmare",
    name: "噩梦",
    hp: 6.2,
    def: 2.9,
    gold: 2.6,
    picks: 2,
    extraPickChance: 20,
    noDrop: 14,
    uber: true,
    mlvlBonus: 18,
    tcBias: 4,
    jewelryChance: 11,
  },
  {
    id: "hell",
    name: "地狱",
    hp: 15,
    def: 4.6,
    gold: 3.8,
    picks: 3,
    extraPickChance: 35,
    noDrop: 7,
    uber: true,
    mlvlBonus: 30,
    tcBias: 6,
    jewelryChance: 14,
  },
];

export const CHAPTERS = [
  { id: 1, name: "鲜血荒地", act: "一幕" },
  { id: 2, name: "冰冷之原", act: "一幕" },
  { id: 3, name: "地下墓穴", act: "一幕" },
  { id: 4, name: "鲁高因下水道", act: "二幕" },
  { id: 5, name: "干燥高地", act: "二幕" },
  { id: 6, name: "塔·拉夏古墓", act: "二幕" },
  { id: 7, name: "蜘蛛森林", act: "三幕" },
  { id: 8, name: "库拉斯特集市", act: "三幕" },
  { id: 9, name: "平原要塞", act: "四幕" },
  { id: 10, name: "混沌避难所", act: "四幕" },
  { id: 11, name: "冰冻高原", act: "五幕" },
  { id: 12, name: "世界之石要塞", act: "五幕" },
] as const;

export const STAGES_PER_CHAPTER = 10;

export type StageMonster = {
  chapter: number;
  stage: number;
  difficulty: DifficultyId;
  name: string;
  kind: MonsterKind;
  mlvl: number;
  hp: number;
  defense: number;
  recommendedPower: number;
  gold: number;
  picks: number;
  noDrop: number;
  uber: boolean;
  tcLevel: number;
  jewelryChance: number;
};

export function difficultyById(id: DifficultyId): DifficultyDef {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[0];
}

export function monsterKindForStage(stage: number): MonsterKind {
  if (stage === 10) return "boss";
  if (stage === 5 || stage === 8) return "champion";
  return "minion";
}

export function kindLabel(kind: MonsterKind): string {
  if (kind === "boss") return "首领";
  if (kind === "champion") return "精英怪";
  return "小怪";
}

export function getStage(chapter: number, stage: number, difficulty: DifficultyId): StageMonster {
  const ch = Math.max(1, Math.min(CHAPTERS.length, Math.floor(chapter)));
  const st = Math.max(1, Math.min(STAGES_PER_CHAPTER, Math.floor(stage)));
  const diff = difficultyById(difficulty);
  const kind = monsterKindForStage(st);
  const chapterDef = CHAPTERS[ch - 1];
  const kindHp = kind === "boss" ? 5.5 : kind === "champion" ? 2.3 : 1;
  const kindDef = kind === "boss" ? 1.7 : kind === "champion" ? 1.25 : 1;
  const kindPicks = kind === "boss" ? 2 : kind === "champion" ? 1 : 0;
  const hp = Math.round(70 * 1.12 ** (st - 1) * 1.52 ** (ch - 1) * diff.hp * kindHp);
  const defense = Math.round(14 * 1.1 ** (st - 1) * 1.34 ** (ch - 1) * diff.def * kindDef);
  const recommendedPower = Math.round(85 * 1.13 ** (st - 1) * 1.48 ** (ch - 1) * diff.hp * (kind === "boss" ? 1.35 : 1));
  const mlvl = Math.max(1, Math.min(99, ch * 5 + st + diff.mlvlBonus));
  const gold = Math.round(16 * 1.11 ** (st - 1) * 1.38 ** (ch - 1) * diff.gold * (kind === "boss" ? 4 : kind === "champion" ? 1.8 : 1));
  const extra = diff.extraPickChance > 0 && kind !== "minion" ? 1 : 0;
  const picks = diff.picks + kindPicks + extra;
  const noDrop = Math.max(2, Math.round(diff.noDrop * (kind === "boss" ? 0.45 : kind === "champion" ? 0.7 : 1)));
  const tcLevel = Math.min(87, 4 + ch * 4 + Math.floor(st / 2) + diff.tcBias * 3);

  return {
    chapter: ch,
    stage: st,
    difficulty,
    name: `${chapterDef.name} ${ch}-${st}`,
    kind,
    mlvl,
    hp,
    defense,
    recommendedPower,
    gold,
    picks,
    noDrop,
    uber: diff.uber || kind !== "minion",
    tcLevel,
    jewelryChance: diff.jewelryChance + (kind === "boss" ? 10 : kind === "champion" ? 4 : 0),
  };
}

export function chapterName(chapter: number): string {
  return CHAPTERS[Math.max(0, Math.min(CHAPTERS.length, chapter) - 1)]?.name ?? "未知地区";
}

export function nextStage(chapter: number, stage: number): { chapter: number; stage: number } | null {
  if (stage < STAGES_PER_CHAPTER) return { chapter, stage: stage + 1 };
  if (chapter < CHAPTERS.length) return { chapter: chapter + 1, stage: 1 };
  return null;
}

export function formatCompact(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(2)}亿`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(n >= 100_000 ? 1 : 2)}万`;
  return String(Math.round(n));
}
