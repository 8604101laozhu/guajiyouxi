import { averagePacket, weaponDamageInputs } from "./damage";
import { generateItem } from "./generate";
import { magicChance, oddsLabel, rareChance, uniqueChance } from "./quality";
import { chance, type Rng } from "./rng";
import { characterAttackRating, characterDefense, characterLife } from "./stats";
import type { Item } from "./types";
import { getStage, type DifficultyId, type StageMonster } from "./campaign";

export function combatPower(character: Parameters<typeof weaponDamageInputs>[0]): number {
  const breakdown = weaponDamageInputs(character);
  const dps = averagePacket(breakdown) * breakdown.aps;
  return Math.round(
    dps * 8 +
      characterDefense(character) * 1.15 +
      characterLife(character) * 0.32 +
      characterAttackRating(character) * 0.04,
  );
}

export type FarmResult = {
  ok: boolean;
  reason: string;
  crush: boolean;
  gold: number;
  items: Item[];
  noDrops: number;
  picks: number;
  monster: StageMonster;
  odds: { unique: string; rare: string; magic: string };
};

export function stageOdds(monster: StageMonster, magicFind: number) {
  const sampleQlvl = Math.max(1, monster.tcLevel - 4);
  const input = { mlvl: monster.mlvl, qlvl: sampleQlvl, magicFind, uber: monster.uber };
  return {
    unique: oddsLabel(uniqueChance(input)),
    rare: oddsLabel(rareChance(input)),
    magic: oddsLabel(magicChance(input)),
  };
}

export function farmStage(options: {
  rng: Rng;
  seed: number;
  chapter: number;
  stage: number;
  difficulty: DifficultyId;
  magicFind: number;
  power: number;
}): FarmResult {
  const monster = getStage(options.chapter, options.stage, options.difficulty);
  const ratio = options.power / Math.max(1, monster.recommendedPower);
  const odds = stageOdds(monster, options.magicFind);

  if (ratio < 0.55) {
    return {
      ok: false,
      reason: `战力 ${Math.round(options.power)} / 推荐 ${monster.recommendedPower}，清剿失败`,
      crush: false,
      gold: 0,
      items: [],
      noDrops: 0,
      picks: 0,
      monster,
      odds,
    };
  }

  const crush = ratio >= 1.35;
  const noDrop = crush ? Math.max(2, Math.round(monster.noDrop * 0.7)) : ratio < 0.85 ? Math.round(monster.noDrop * 1.25) : monster.noDrop;
  let picks = monster.picks;
  if (crush) picks += 1;

  const items: Item[] = [];
  let noDrops = 0;
  for (let i = 0; i < picks; i++) {
    if (chance(options.rng, noDrop)) {
      noDrops += 1;
      continue;
    }
    items.push(
      generateItem({
        rng: options.rng,
        ilvl: monster.tcLevel,
        mlvl: monster.mlvl,
        magicFind: options.magicFind,
        uber: monster.uber,
        jewelryChance: monster.jewelryChance,
        tcBias: 0,
        seed: (options.seed + i * 17) >>> 0,
      }),
    );
  }

  const goldJitter = 0.85 + options.rng() * 0.3;
  const gold = Math.max(1, Math.round(monster.gold * goldJitter * (crush ? 1.25 : 1)));

  return {
    ok: true,
    reason: crush ? "碾压清剿" : ratio >= 1 ? "清剿成功" : "勉强清剿",
    crush,
    gold,
    items,
    noDrops,
    picks,
    monster,
    odds,
  };
}
