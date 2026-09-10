import { randBelow, type Rng } from "./rng";
import type { Quality } from "./types";

/**
 * ItemRatio.txt 普通行 / Uber 行（暗黑 2 1.10+）。
 * Unique 先判定，失败再套装、稀有、魔法，全失败才是白板。
 */
export type RatioRow = {
  unique: number;
  uniqueDivisor: number;
  uniqueMin: number;
  set: number;
  setDivisor: number;
  setMin: number;
  rare: number;
  rareDivisor: number;
  rareMin: number;
  magic: number;
  magicDivisor: number;
  magicMin: number;
};

export const RATIO_NORMAL: RatioRow = {
  unique: 400,
  uniqueDivisor: 1,
  uniqueMin: 6400,
  set: 160,
  setDivisor: 2,
  setMin: 5600,
  rare: 100,
  rareDivisor: 2,
  rareMin: 3200,
  magic: 34,
  magicDivisor: 3,
  magicMin: 192,
};

/** 金怪 / 首领 / 地狱难度用 Uber 行，稀有和魔法明显更密。 */
export const RATIO_UBER: RatioRow = {
  unique: 400,
  uniqueDivisor: 1,
  uniqueMin: 6400,
  set: 120,
  setDivisor: 2,
  setMin: 2400,
  rare: 80,
  rareDivisor: 2,
  rareMin: 1600,
  magic: 17,
  magicDivisor: 6,
  magicMin: 96,
};

export function diminishingMf(mf: number, cap: number): number {
  if (mf <= 0) return 0;
  return (mf * cap) / (mf + cap);
}

/**
 * chance 越小越好。成功条件是 rand(chance) === 0。
 * chance = max(Min, (Ratio - (mlvl-qlvl)/Divisor) * 128)
 * 再乘 100/(100+MF)。暗金 MF 衰减 250，套装 500，稀有 600，魔法不衰减。
 */
export function qualityChance(
  ratio: number,
  divisor: number,
  min: number,
  mlvl: number,
  qlvl: number,
  mf: number,
): number {
  const delta = Math.floor((mlvl - qlvl) / Math.max(1, divisor));
  let chance = (ratio - delta) * 128;
  if (chance < min) chance = min;
  if (mf > 0) {
    chance = Math.floor((chance * 100) / (100 + mf));
  }
  return Math.max(1, chance);
}

export type QualityRollInput = {
  mlvl: number;
  qlvl: number;
  magicFind?: number;
  uber?: boolean;
};

export function uniqueChance(input: QualityRollInput): number {
  const row = input.uber ? RATIO_UBER : RATIO_NORMAL;
  return qualityChance(
    row.unique,
    row.uniqueDivisor,
    row.uniqueMin,
    input.mlvl,
    input.qlvl,
    diminishingMf(input.magicFind ?? 0, 250),
  );
}

export function rareChance(input: QualityRollInput): number {
  const row = input.uber ? RATIO_UBER : RATIO_NORMAL;
  return qualityChance(
    row.rare,
    row.rareDivisor,
    row.rareMin,
    input.mlvl,
    input.qlvl,
    diminishingMf(input.magicFind ?? 0, 600),
  );
}

export function magicChance(input: QualityRollInput): number {
  const row = input.uber ? RATIO_UBER : RATIO_NORMAL;
  return qualityChance(
    row.magic,
    row.magicDivisor,
    row.magicMin,
    input.mlvl,
    input.qlvl,
    input.magicFind ?? 0,
  );
}

export function setChance(input: QualityRollInput): number {
  const row = input.uber ? RATIO_UBER : RATIO_NORMAL;
  return qualityChance(
    row.set,
    row.setDivisor,
    row.setMin,
    input.mlvl,
    input.qlvl,
    diminishingMf(input.magicFind ?? 0, 500),
  );
}

function hits(rng: Rng, chance: number): boolean {
  return randBelow(rng, chance) === 0;
}

export type QualityCheck = {
  quality: Quality;
  uniqueHit: boolean;
  setHit: boolean;
  uniqueAvailable: boolean;
};

/**
 * 暗黑 2 品质链。套装表目前是空的：套装判定成功会往下掉到稀有，和“这件基底没有套装”一样。
 */
export function rollItemQuality(
  rng: Rng,
  input: QualityRollInput,
  uniqueAvailable: boolean,
): QualityCheck {
  const uniqueHit = hits(rng, uniqueChance(input));
  if (uniqueHit && uniqueAvailable) {
    return { quality: "unique", uniqueHit: true, setHit: false, uniqueAvailable: true };
  }
  const setHit = hits(rng, setChance(input));
  if (hits(rng, rareChance(input))) {
    return { quality: "rare", uniqueHit, setHit, uniqueAvailable };
  }
  if (hits(rng, magicChance(input))) {
    return { quality: "magic", uniqueHit, setHit, uniqueAvailable };
  }
  return { quality: "normal", uniqueHit, setHit, uniqueAvailable };
}

export function oddsLabel(chance: number): string {
  return `1/${chance}`;
}
