import { BASES, getBase } from "./bases";
import { chance, weightedPick, type Rng } from "./rng";
import type { ItemBase, ItemKind } from "./types";
import { uniquesForBase } from "./uniques";

export type TreasureClass = {
  id: string;
  /** 本 TC 能出的最高 qlvl，对应 D2 的 weapX / armoX。 */
  maxQlvl: number;
  /** 往下覆盖几档 qlvl。 */
  span: number;
};

/** 用 qlvl 带宽模拟 D2 武器/防具 TC，地区等级升高就换更高的 TC。 */
export function treasureClassFor(maxQlvl: number): TreasureClass {
  const capped = Math.max(3, Math.min(87, Math.ceil(maxQlvl / 3) * 3));
  return { id: `tc${capped}`, maxQlvl: capped, span: 8 };
}

export function basesInClass(tc: TreasureClass, kind?: ItemKind): ItemBase[] {
  const min = Math.max(1, tc.maxQlvl - tc.span);
  return BASES.filter((base) => {
    if (base.qlvl < min || base.qlvl > tc.maxQlvl) return false;
    if (kind && base.kind !== kind) return false;
    if (base.kind === "ring" || base.kind === "amulet") return false;
    return true;
  });
}

const KIND_WEIGHT: Record<Exclude<ItemKind, "ring" | "amulet">, number> = {
  weapon: 10,
  shield: 3,
  helm: 3,
  armor: 6,
  belt: 2,
  gloves: 2,
  boots: 2,
};

export type PickBaseOptions = {
  rng: Rng;
  ilvl: number;
  kind?: ItemKind;
  baseId?: string;
  jewelryChance?: number;
  tcBias?: number;
};

export function pickTreasureBase(options: PickBaseOptions): ItemBase {
  const { rng } = options;
  if (options.baseId) return getBase(options.baseId);
  if (options.kind === "ring" || options.kind === "amulet") {
    return getBase(options.kind);
  }

  const jewelryChance = options.jewelryChance ?? 6;
  if (!options.kind && chance(rng, jewelryChance)) {
    return getBase(rng() < 0.55 ? "ring" : "amulet");
  }

  const tc = treasureClassFor(options.ilvl + (options.tcBias ?? 0));
  let pool = basesInClass(tc, options.kind);
  if (pool.length === 0) {
    pool = BASES.filter((base) => {
      if (base.kind === "ring" || base.kind === "amulet") return false;
      if (options.kind && base.kind !== options.kind) return false;
      return base.qlvl <= tc.maxQlvl;
    });
  }
  if (pool.length === 0) {
    pool = BASES.filter((base) => !options.kind || base.kind === options.kind);
  }

  return weightedPick(rng, pool, (base) => {
    const kindWeight = base.kind === "ring" || base.kind === "amulet" ? 1 : KIND_WEIGHT[base.kind];
    const towardTop = 1 + Math.max(0, base.qlvl - (tc.maxQlvl - 4));
    return kindWeight * towardTop;
  });
}

export function hasUniqueFor(baseId: string, ilvl: number): boolean {
  return uniquesForBase(baseId, ilvl).length > 0;
}
