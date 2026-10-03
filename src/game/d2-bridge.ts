/**
 * d2 数值桥 —— **整个游戏里唯一认识 `src/lib/d2` 的文件**。
 *
 * 为什么集中在一个文件：改数值（词条、掉落、掉落率）去 `src/lib/d2`；
 * 改「d2 的东西怎么映射成游戏里的单位/事件」只来这里。
 * 其它内核文件（units/ai/combat/waves/main）不知道 d2 的存在。
 *
 * 一波 = 一个关卡：第 N 波对应 campaign 里推进到的那一关（章节/关卡/难度/怪种）。
 */
import { createCharacter } from "@/lib/d2/character";
import {
  CHAPTERS,
  STAGES_PER_CHAPTER,
  difficultyById,
  getStage,
  kindLabel,
  type DifficultyId,
  type StageMonster,
} from "@/lib/d2/campaign";
import { averagePacket, chanceToHit, swing, weaponDamageInputs, type HitRoll } from "@/lib/d2/damage";
import { generateItem } from "@/lib/d2/generate";
import { stageOdds } from "@/lib/d2/farm";
import { chance, mulberry32, type Rng } from "@/lib/d2/rng";
import { characterAttackRating, characterDefense, characterLife, totalAttributes } from "@/lib/d2/stats";
import type { Character, Item, Quality } from "@/lib/d2/types";
import type { EnemySpec } from "./units";

/** 难度推进：1-3 章普通 / 4-6 精英 / 7-9 噩梦 / 10-12 地狱 */
export function difficultyForChapter(chapter: number): DifficultyId {
  if (chapter <= 3) return "normal";
  if (chapter <= 6) return "elite";
  if (chapter <= 9) return "nightmare";
  return "hell";
}

export type StageRef = { chapter: number; stage: number; difficulty: DifficultyId };

/** 第 wave 波（从 1 开始）落在哪一关 */
export function stageForWave(wave: number): StageRef {
  const w = Math.max(1, Math.floor(wave));
  const chapter = Math.min(CHAPTERS.length, Math.floor((w - 1) / STAGES_PER_CHAPTER) + 1);
  const stage = ((w - 1) % STAGES_PER_CHAPTER) + 1;
  return { chapter, stage, difficulty: difficultyForChapter(chapter) };
}

export function chapterName(chapter: number): string {
  return CHAPTERS[Math.max(0, Math.min(CHAPTERS.length, chapter) - 1)]?.name ?? "未知地区";
}

export function monsterForWave(wave: number): StageMonster {
  const { chapter, stage, difficulty } = stageForWave(wave);
  return getStage(chapter, stage, difficulty);
}

/** 关卡怪 → 游戏里的敌人参数（血量/防御/等级/掉落参数全部来自 d2） */
export function enemyFromMonster(monster: StageMonster, index: number, total: number): EnemySpec {
  // 观感：每三个里有一个远程；最后一只在精英/首领关就是精英/首领
  const ranged = index % 3 === 2;
  const rank: 0 | 1 | 2 = monster.kind === "boss" ? 2 : monster.kind === "champion" ? 1 : 0;
  // d2 关卡表没有怪的「攻击力」这一项，按 mlvl 推一个，精英/首领跟着倍率走
  const kindScale = rank === 2 ? 2.2 : rank === 1 ? 1.5 : 1;
  const damage = Math.round((4 + monster.mlvl * 0.35) * kindScale);
  return {
    kind: ranged ? "ranged" : "melee",
    rank,
    hp: monster.hp,
    damage,
    speed: ranged ? 30 : 52 + Math.min(18, Math.floor(monster.mlvl / 3)),
    variant: (index + total) % 3,
    defense: monster.defense,
    mlvl: monster.mlvl,
    tcLevel: monster.tcLevel,
    picks: monster.picks,
    noDrop: monster.noDrop,
    uber: monster.uber,
    jewelryChance: monster.jewelryChance,
    gold: monster.gold,
    name: monster.name,
  };
}

// ---------------- 英雄侧 ----------------

export type HeroStats = {
  life: number;
  /** 平均每次命中的伤害（HUD 展示用；实际每次挥砍都会重新掷骰） */
  damage: number;
  attackRating: number;
  defense: number;
  weaponName: string;
  aps: number;
};

export function heroStats(character: Character): HeroStats {
  const breakdown = weaponDamageInputs(character);
  return {
    life: characterLife(character),
    damage: Math.round(averagePacket(breakdown)),
    attackRating: characterAttackRating(character),
    defense: characterDefense(character),
    weaponName: breakdown.weaponName,
    aps: Math.round(breakdown.aps * 100) / 100,
  };
}

/** 初始一套装备（工坊的 createCharacter 是空手，不出装就没法打） */
export function startingCharacter(seed = 20261002): Character {
  const rng = mulberry32(seed >>> 0);
  const character = createCharacter();
  const mk = (offset: number, opts: Partial<Parameters<typeof generateItem>[0]>) =>
    generateItem({ rng, seed: seed + offset, ilvl: 15, identified: true, ...opts } as Parameters<typeof generateItem>[0]);
  character.equipment = {
    mainHand: mk(1, { kind: "weapon", quality: "magic" }),
    armor: mk(2, { kind: "armor", quality: "magic" }),
    helm: mk(3, { kind: "helm", quality: "normal" }),
    boots: mk(4, { kind: "boots", quality: "normal" }),
  };
  return character;
}

export type StrikeResult = { damage: number; crit: boolean; miss: boolean; chance: number };

/** 英雄挥砍：走 d2 的 swing（命中率 vs 怪防御、致命一击、元素伤害） */
export function heroStrike(rng: Rng, character: Character, monster: { defense: number; mlvl: number }): StrikeResult {
  const roll: HitRoll = swing(rng, character, { defense: monster.defense, level: monster.mlvl }, characterAttackRating(character));
  return { damage: roll.total, crit: roll.crit || roll.deadly, miss: !roll.hit, chance: roll.chanceToHit };
}

/** 怪打英雄：走 d2 的命中率公式（防御高就容易被闪开） */
export function monsterStrike(
  rng: Rng,
  monster: { damage: number; mlvl: number },
  hero: { defense: number; level: number },
): StrikeResult {
  const ar = monster.mlvl * 5;
  const cth = chanceToHit(ar, hero.defense, monster.mlvl, hero.level);
  const miss = !chance(rng, cth);
  const jitter = 0.85 + rng() * 0.3;
  return { damage: miss ? 0 : Math.max(1, Math.round(monster.damage * jitter)), crit: false, miss, chance: cth };
}

// ---------------- 掉落 ----------------

export type LootRoll = { items: Item[]; gold: number; noDrop: number };

/**
 * 一只怪的掉落：按 d2 的 picks 抽几次，每次先判 noDrop，再 generateItem 走 TC + ItemRatio。
 * 和 `src/lib/d2/farm.ts` 的点击模拟同一套规则，区别是这里一次击杀结算一只怪。
 */
export function rollLoot(rng: Rng, spec: EnemySpec, magicFind: number): LootRoll {
  const items: Item[] = [];
  let noDrop = 0;
  for (let i = 0; i < Math.max(1, spec.picks); i++) {
    if (chance(rng, spec.noDrop)) {
      noDrop++;
      continue;
    }
    items.push(
      generateItem({
        rng,
        ilvl: spec.tcLevel,
        mlvl: spec.mlvl,
        magicFind,
        uber: spec.uber,
        jewelryChance: spec.jewelryChance,
        tcBias: 0,
        seed: (Math.floor(rng() * 0xffffffff) ^ (spec.tcLevel << 8)) >>> 0,
      }),
    );
  }
  const goldJitter = 0.85 + rng() * 0.3;
  return { items, gold: Math.max(1, Math.round(spec.gold * goldJitter)), noDrop };
}

/** 关卡掉率文案（1/xxx），显示在 HUD 上 */
export function oddsFor(monster: StageMonster, magicFind: number) {
  return stageOdds(monster, magicFind);
}

export const QUALITY_ORDER: Quality[] = ["normal", "magic", "rare", "unique"];

/** 稀有度配色（AH 风格的暗黑配色） */
export function qualityColor(quality: Quality): string {
  switch (quality) {
    case "unique":
      return "#c7a24a";
    case "rare":
      return "#ffe066";
    case "magic":
      return "#6f8fff";
    default:
      return "#cfc3a6";
  }
}

export function qualityLabel(quality: Quality): string {
  switch (quality) {
    case "unique":
      return "暗金";
    case "rare":
      return "稀有";
    case "magic":
      return "魔法";
    default:
      return "白板";
  }
}

// ---------------- 给主程序用的出口（主程序不认识 d2） ----------------

export type { Rng };

export function newRng(seed: number): Rng {
  return mulberry32(seed >>> 0);
}

/** 装备上的 MF 总和（掉落质量就靠它） */
export function magicFindOf(character: Character): number {
  return totalAttributes(character).stats.magicFind;
}

/** HUD 第一行的关卡文案，如「第1章 鲜血荒地 1-1 普通 · 堕落者(小怪)」 */
export function stageLabelFor(wave: number): string {
  const { chapter, stage, difficulty } = stageForWave(wave);
  const monster = monsterForWave(wave);
  return `第${chapter}章 ${chapterName(chapter)} ${chapter}-${stage} ${difficultyById(difficulty).name} · ${monster.name}(${kindLabel(monster.kind)})`;
}
