import { getBase } from "./bases";
import { chance, randInt, type Rng } from "./rng";
import { collectItemMods, emptyStats, equippedList, totalAttributes } from "./stats";
import type { Character } from "./types";

export type Range = { min: number; max: number };

export type DamageBreakdown = {
  weaponName: string;
  base: Range;
  ethereal: boolean;
  weaponED: number;
  plusOnWeapon: Range;
  afterWeapon: Range;
  offWeaponED: number;
  statED: number;
  statName: "力量" | "敏捷";
  plusOffWeapon: Range;
  physical: Range;
  fire: Range;
  cold: Range;
  lightning: Range;
  poison: Range;
  criticalStrike: number;
  deadlyStrike: number;
  ias: number;
  wsm: number;
  eias: number;
  frames: number;
  aps: number;
};

export type HitRoll = {
  hit: boolean;
  chanceToHit: number;
  crit: boolean;
  deadly: boolean;
  physical: number;
  fire: number;
  cold: number;
  lightning: number;
  poison: number;
  total: number;
};

function range(min: number, max: number): Range {
  const lo = Math.max(0, Math.floor(min));
  const hi = Math.max(lo, Math.floor(max));
  return { min: lo, max: hi };
}

function avg(r: Range): number {
  return (r.min + r.max) / 2;
}

function rollRange(rng: Rng, r: Range): number {
  return randInt(rng, r.min, r.max);
}

/**
 * 暗黑 2 物理伤害（工坊实现，顺序固定，方便你对表）：
 *
 * 1. 武器基底 min/max；无形再 ×1.5
 * 2. 武器上的 %增强伤害 乘到基底
 * 3. 再加武器上的 +最小 / +最大
 * 4. 非武器 %增强伤害 与 力量或敏捷（1 点 = +1% ED）加算后乘
 * 5. 再加戒指/护甲等部位的 +最小 / +最大
 *
 * 元素伤害不吃 ED，独立掷骰后加到本次命中。
 * 致命一击 / 死伤先判定致命，再判定死伤，两者不叠加，物理 ×2。
 */
export function weaponDamageInputs(character: Character): DamageBreakdown {
  const { str, dex, stats } = totalAttributes(character);
  const weapon = character.equipment.mainHand;
  const items = equippedList(character);
  const weaponMods = weapon ? collectItemMods(weapon) : emptyStats();

  const baseItem = weapon ? getBase(weapon.baseId) : null;
  const ethereal = Boolean(weapon?.ethereal);
  let baseMin = baseItem?.dmgMin ?? 1;
  let baseMax = baseItem?.dmgMax ?? 2;
  if (ethereal) {
    baseMin = Math.floor((baseMin * 150) / 100);
    baseMax = Math.floor((baseMax * 150) / 100);
  }

  let offED = 0;
  let offMin = 0;
  let offMax = 0;
  for (const item of items) {
    const mods = collectItemMods(item);
    const isMainWeapon = weapon !== undefined && item.id === weapon.id;
    if (isMainWeapon) continue;
    offED += mods.enhancedDamage;
    offMin += mods.minDamage;
    offMax += mods.maxDamage;
  }

  const weaponED = weapon ? weaponMods.enhancedDamage : 0;
  const plusOnMin = weapon ? weaponMods.minDamage : 0;
  const plusOnMax = weapon ? weaponMods.maxDamage : 0;

  const afterWeaponMin = Math.floor((baseMin * (100 + weaponED)) / 100) + plusOnMin;
  const afterWeaponMax = Math.floor((baseMax * (100 + weaponED)) / 100) + plusOnMax;

  const useDex = baseItem?.damageStat === "dex";
  const statED = useDex ? dex : str;
  const statName: "力量" | "敏捷" = useDex ? "敏捷" : "力量";

  const physicalMin = Math.floor((afterWeaponMin * (100 + offED + statED)) / 100) + offMin;
  const physicalMax = Math.floor((afterWeaponMax * (100 + offED + statED)) / 100) + offMax;

  let fireMin = 0;
  let fireMax = 0;
  let coldMin = 0;
  let coldMax = 0;
  let lightningMin = 0;
  let lightningMax = 0;
  let poisonMin = 0;
  let poisonMax = 0;
  for (const item of items) {
    const mods = collectItemMods(item);
    fireMin += mods.fireMin;
    fireMax += mods.fireMax;
    coldMin += mods.coldMin;
    coldMax += mods.coldMax;
    lightningMin += mods.lightningMin;
    lightningMax += mods.lightningMax;
    poisonMin += mods.poisonMin;
    poisonMax += mods.poisonMax;
  }

  const ias = stats.ias;
  const wsm = baseItem?.wsm ?? 0;
  const eias = Math.min(75, ias - wsm);
  const baseFrames = baseItem?.weaponClass === "bow" ? 13 : baseItem?.twoHanded ? 14 : 12;
  const frames = attackFrames(baseFrames, eias);
  const aps = 25 / frames;

  return {
    weaponName: weapon?.name ?? "拳头",
    base: range(baseMin, baseMax),
    ethereal,
    weaponED,
    plusOnWeapon: range(plusOnMin, plusOnMax),
    afterWeapon: range(afterWeaponMin, afterWeaponMax),
    offWeaponED: offED,
    statED,
    statName,
    plusOffWeapon: range(offMin, offMax),
    physical: range(Math.max(1, physicalMin), Math.max(1, physicalMax)),
    fire: range(fireMin, Math.max(fireMin, fireMax)),
    cold: range(coldMin, Math.max(coldMin, coldMax)),
    lightning: range(lightningMin, Math.max(lightningMin, lightningMax)),
    poison: range(poisonMin, Math.max(poisonMin, poisonMax)),
    criticalStrike: stats.criticalStrike,
    deadlyStrike: stats.deadlyStrike,
    ias,
    wsm,
    eias,
    frames,
    aps,
  };
}

/** D2-like: frames = ceil( base * 120 / (animation_speed) ) with EIAS cap 75. */
export function attackFrames(baseFrames: number, eias: number): number {
  const capped = Math.max(-50, Math.min(75, eias));
  const speed = Math.floor((256 * (100 + capped)) / 100);
  return Math.max(4, Math.ceil((baseFrames * 256) / speed) - 1);
}

export function chanceToHit(ar: number, defense: number, attackerLevel: number, defenderLevel: number): number {
  const safeAR = Math.max(1, ar);
  const safeDR = Math.max(0, defense);
  const raw =
    200 *
    (safeAR / (safeAR + safeDR)) *
    (attackerLevel / (attackerLevel + Math.max(1, defenderLevel)));
  return Math.max(5, Math.min(95, raw));
}

export function averagePacket(breakdown: DamageBreakdown): number {
  const phys = avg(breakdown.physical);
  const critP = Math.min(100, breakdown.criticalStrike + (100 - breakdown.criticalStrike) * (breakdown.deadlyStrike / 100));
  const physAfterCrit = phys * (1 + critP / 100);
  return (
    physAfterCrit +
    avg(breakdown.fire) +
    avg(breakdown.cold) +
    avg(breakdown.lightning) +
    avg(breakdown.poison)
  );
}

export function rollPacket(rng: Rng, breakdown: DamageBreakdown): Omit<HitRoll, "hit" | "chanceToHit"> {
  let physical = rollRange(rng, breakdown.physical);
  const crit = chance(rng, breakdown.criticalStrike);
  const deadly = !crit && chance(rng, breakdown.deadlyStrike);
  if (crit || deadly) physical *= 2;

  const fire = rollRange(rng, breakdown.fire);
  const cold = rollRange(rng, breakdown.cold);
  const lightning = rollRange(rng, breakdown.lightning);
  const poison = rollRange(rng, breakdown.poison);
  return {
    crit,
    deadly,
    physical,
    fire,
    cold,
    lightning,
    poison,
    total: physical + fire + cold + lightning + poison,
  };
}

export function swing(
  rng: Rng,
  character: Character,
  target: { defense: number; level: number },
  ar: number,
  alwaysHit = false,
): HitRoll {
  const breakdown = weaponDamageInputs(character);
  const cth = chanceToHit(ar, target.defense, character.level, target.level);
  const hit = alwaysHit || chance(rng, cth);
  if (!hit) {
    return {
      hit: false,
      chanceToHit: cth,
      crit: false,
      deadly: false,
      physical: 0,
      fire: 0,
      cold: 0,
      lightning: 0,
      poison: 0,
      total: 0,
    };
  }

  return { hit: true, chanceToHit: cth, ...rollPacket(rng, breakdown) };
}
