import { getBase } from "./bases";
import type { DamageBreakdown } from "./damage";
import { slotLabel, type SlotId } from "./slots";
import type { Item, Quality, StatId } from "./types";

export const QUALITY_COLOR: Record<Quality, string> = {
  normal: "#f0ead8",
  magic: "#6969ff",
  rare: "#ffff64",
  unique: "#c7b377",
};

export const QUALITY_NAME: Record<Quality, string> = {
  normal: "普通",
  magic: "魔法",
  rare: "稀有",
  unique: "暗金",
};

export const STAT_LINE: Record<StatId, (value: number) => string> = {
  enhancedDamage: (n) => `+${n}% 增强伤害`,
  minDamage: (n) => `+${n} 最小伤害`,
  maxDamage: (n) => `+${n} 最大伤害`,
  enhancedDefense: (n) => `+${n}% 增强防御`,
  defense: (n) => `+${n} 防御`,
  strength: (n) => `+${n} 力量`,
  dexterity: (n) => `+${n} 敏捷`,
  vitality: (n) => `+${n} 体力`,
  energy: (n) => `+${n} 能量`,
  life: (n) => `+${n} 生命`,
  mana: (n) => `+${n} 法力`,
  attackRating: (n) => `+${n} 准确率`,
  attackRatingPercent: (n) => `+${n}% 准确率`,
  ias: (n) => `+${n}% 加速攻击`,
  fcr: (n) => `+${n}% 快速施法`,
  frw: (n) => `+${n}% 快速移动`,
  lifeLeech: (n) => `${n}% 生命偷取`,
  manaLeech: (n) => `${n}% 法力偷取`,
  magicFind: (n) => `${n}% 更好的魔法装备`,
  goldFind: (n) => `${n}% 获得额外金钱`,
  allRes: (n) => `全抗性 +${n}%`,
  fireRes: (n) => `火焰抗性 +${n}%`,
  coldRes: (n) => `冰冷抗性 +${n}%`,
  lightningRes: (n) => `闪电抗性 +${n}%`,
  poisonRes: (n) => `毒素抗性 +${n}%`,
  fireMin: (n) => `+${n} 最小火焰伤害`,
  fireMax: (n) => `+${n} 最大火焰伤害`,
  coldMin: (n) => `+${n} 最小冰冷伤害`,
  coldMax: (n) => `+${n} 最大冰冷伤害`,
  lightningMin: (n) => `+${n} 最小闪电伤害`,
  lightningMax: (n) => `+${n} 最大闪电伤害`,
  poisonMin: (n) => `+${n} 最小毒素伤害`,
  poisonMax: (n) => `+${n} 最大毒素伤害`,
  criticalStrike: (n) => `${n}% 几率造成致命一击`,
  deadlyStrike: (n) => `${n}% 几率造成死伤`,
  toBlock: (n) => `${n}% 增加格挡几率`,
};

export type TooltipLine = {
  text: string;
  color?: string;
  muted?: boolean;
};

function pairRange(
  lines: TooltipLine[],
  minStat: StatId,
  maxStat: StatId,
  label: string,
  color: string,
  item: Item,
  showRange: boolean,
): Set<StatId> {
  const used = new Set<StatId>();
  let min = 0;
  let max = 0;
  let minLo = 0;
  let minHi = 0;
  let maxLo = 0;
  let maxHi = 0;
  for (const affix of item.affixes) {
    for (const mod of affix.mods) {
      if (mod.stat === minStat) {
        min += mod.value;
        minLo += mod.min;
        minHi += mod.max;
        used.add(minStat);
      }
      if (mod.stat === maxStat) {
        max += mod.value;
        maxLo += mod.min;
        maxHi += mod.max;
        used.add(maxStat);
      }
    }
  }
  if (min === 0 && max === 0) return used;
  const shownMax = Math.max(min, max);
  const text = showRange
    ? `+${min}-${shownMax} ${label}（掷骰 ${minLo}-${minHi} / ${maxLo}-${maxHi}）`
    : `+${min}-${shownMax} ${label}`;
  lines.push({ text, color });
  return used;
}

export function tooltipLines(item: Item, showRange = false, slot?: SlotId): TooltipLine[] {
  const base = getBase(item.baseId);
  const lines: TooltipLine[] = [];
  lines.push({ text: item.identified ? item.name : "未鉴定的物品", color: QUALITY_COLOR[item.quality] });
  if (item.quality === "rare" || item.quality === "unique") {
    lines.push({ text: base.name, color: QUALITY_COLOR[item.quality] });
  }
  if (slot) lines.push({ text: slotLabel(slot), muted: true });

  if (base.kind === "weapon" && base.dmgMin !== undefined && base.dmgMax !== undefined) {
    const min = item.ethereal ? Math.floor((base.dmgMin * 150) / 100) : base.dmgMin;
    const max = item.ethereal ? Math.floor((base.dmgMax * 150) / 100) : base.dmgMax;
    const hand = base.twoHanded ? "双手伤害" : "单手伤害";
    lines.push({ text: `${hand}: ${min} 到 ${max}` });
    lines.push({ text: `武器速度修正: ${base.wsm ?? 0}` });
  }

  if (base.defMin !== undefined) {
    lines.push({ text: `防御: ${item.defense}` });
  }

  const skip = new Set<StatId>();
  const fire = pairRange(lines, "fireMin", "fireMax", "火焰伤害", "#ff6b4a", item, showRange);
  const cold = pairRange(lines, "coldMin", "coldMax", "冰冷伤害", "#8ec8ff", item, showRange);
  const light = pairRange(lines, "lightningMin", "lightningMax", "闪电伤害", "#ffe566", item, showRange);
  const poison = pairRange(lines, "poisonMin", "poisonMax", "毒素伤害", "#7dff7d", item, showRange);
  for (const s of [...fire, ...cold, ...light, ...poison]) skip.add(s);

  for (const affix of item.affixes) {
    for (const mod of affix.mods) {
      if (skip.has(mod.stat)) continue;
      const formatter = STAT_LINE[mod.stat];
      if (!formatter) continue;
      const extra = showRange && (mod.min !== mod.max) ? `（${mod.min}-${mod.max}）` : "";
      lines.push({ text: `${formatter(mod.value)}${extra}` });
    }
  }

  if (item.sockets > 0) lines.push({ text: `镶孔: ${item.sockets}`, muted: true });
  if (item.ethereal) lines.push({ text: "无形 (无法修复)", color: "#c0c0c0" });

  const reqs: string[] = [];
  if (base.reqLevel) reqs.push(`等级 ${base.reqLevel}`);
  if (base.reqStr) reqs.push(`力量 ${base.reqStr}`);
  if (base.reqDex) reqs.push(`敏捷 ${base.reqDex}`);
  if (reqs.length) lines.push({ text: `需要 ${reqs.join(" / ")}`, muted: true });
  lines.push({ text: `物品等级: ${item.ilvl}`, muted: true });
  return lines;
}

export function formatRange(r: { min: number; max: number }): string {
  return `${r.min}–${r.max}`;
}

export function breakdownText(b: DamageBreakdown): string[] {
  return [
    `武器 ${b.weaponName}${b.ethereal ? "（无形）" : ""} 基底 ${formatRange(b.base)}`,
    `武器 ED ${b.weaponED}% ，武器平伤 ${formatRange(b.plusOnWeapon)} → 武器后 ${formatRange(b.afterWeapon)}`,
    `装外 ED ${b.offWeaponED}% + ${b.statName} ${b.statED}% ，装外平伤 ${formatRange(b.plusOffWeapon)}`,
    `物理 ${formatRange(b.physical)}`,
    `火 ${formatRange(b.fire)} / 冰 ${formatRange(b.cold)} / 电 ${formatRange(b.lightning)} / 毒 ${formatRange(b.poison)}`,
    `IAS ${b.ias} ，WSM ${b.wsm} ，EIAS ${b.eias} ，${b.frames} 帧 ，${b.aps.toFixed(2)} 击/秒`,
    `致命 ${b.criticalStrike}% / 死伤 ${b.deadlyStrike}%`,
  ];
}
