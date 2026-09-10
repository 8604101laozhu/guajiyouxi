import type { AffixDef, AffixKind, ItemBase, ItemKind, StatId } from "./types";

type AffixInput = {
  id: string;
  name: string;
  group: string;
  level: number;
  freq?: number;
  mods: AffixDef["mods"];
  kinds?: ItemKind[];
  exclude?: ItemKind[];
};

const WEAPON: ItemKind[] = ["weapon"];
const ARMOR: ItemKind[] = ["helm", "armor", "belt", "gloves", "boots", "shield"];
const JEWEL: ItemKind[] = ["ring", "amulet"];
const ARMOR_JEWEL: ItemKind[] = [...ARMOR, ...JEWEL];
const NOT_WEAPON: ItemKind[] = [...ARMOR, ...JEWEL];
const WEAPON_JEWEL: ItemKind[] = ["weapon", "ring", "amulet"];
const GLOVES: ItemKind[] = ["gloves"];
const BOOTS: ItemKind[] = ["boots"];
const ALL: ItemKind[] | undefined = undefined;

function p(input: AffixInput): AffixDef {
  return { kind: "prefix", freq: 4, ...input };
}

function s(input: AffixInput): AffixDef {
  return { kind: "suffix", freq: 4, ...input };
}

function rng(stat: StatId, min: number, max: number) {
  return { stat, min, max };
}

export const AFFIXES: AffixDef[] = [
  p({ id: "jagged", name: "锯齿", group: "ed", level: 1, mods: [rng("enhancedDamage", 10, 20)], kinds: WEAPON }),
  p({ id: "deadly", name: "致命", group: "ed", level: 5, mods: [rng("enhancedDamage", 21, 30)], kinds: WEAPON }),
  p({ id: "vicious", name: "残忍", group: "ed", level: 8, mods: [rng("enhancedDamage", 31, 40)], kinds: WEAPON }),
  p({ id: "brutal", name: "残暴", group: "ed", level: 14, mods: [rng("enhancedDamage", 41, 50)], kinds: WEAPON }),
  p({ id: "massive", name: "巨型", group: "ed", level: 20, mods: [rng("enhancedDamage", 51, 65)], kinds: WEAPON }),
  p({ id: "savage", name: "野蛮", group: "ed", level: 26, mods: [rng("enhancedDamage", 66, 80)], kinds: WEAPON }),
  p({ id: "merciless", name: "无情", group: "ed", level: 32, mods: [rng("enhancedDamage", 81, 100)], kinds: WEAPON }),
  p({ id: "ferocious", name: "凶猛", group: "ed", level: 41, mods: [rng("enhancedDamage", 101, 200)], kinds: WEAPON, freq: 2 }),
  p({ id: "cruel", name: "残酷", group: "ed", level: 51, mods: [rng("enhancedDamage", 201, 300)], kinds: WEAPON, freq: 1 }),

  p({ id: "fine", name: "精良", group: "ar", level: 1, mods: [rng("attackRating", 10, 20)], kinds: WEAPON_JEWEL }),
  p({ id: "sharp", name: "锐利", group: "ar_ed", level: 5, mods: [rng("attackRating", 21, 40), rng("enhancedDamage", 10, 20)], kinds: WEAPON }),
  p({ id: "fine_ar", name: "精准", group: "ar", level: 12, mods: [rng("attackRating", 41, 60)], kinds: WEAPON_JEWEL }),
  p({ id: "warriors", name: "战士", group: "ar_ed", level: 18, mods: [rng("attackRating", 21, 40), rng("enhancedDamage", 15, 25)], kinds: WEAPON }),
  p({ id: "soldiers", name: "士兵", group: "ar_ed", level: 25, mods: [rng("attackRating", 41, 60), rng("enhancedDamage", 21, 30), rng("maxDamage", 1, 3)], kinds: WEAPON }),
  p({ id: "knights", name: "骑士", group: "ar_ed", level: 33, mods: [rng("attackRating", 61, 80), rng("enhancedDamage", 31, 40), rng("maxDamage", 2, 5)], kinds: WEAPON }),
  p({ id: "lords", name: "领主", group: "ar_ed", level: 39, mods: [rng("attackRating", 81, 100), rng("enhancedDamage", 41, 50), rng("maxDamage", 4, 7)], kinds: WEAPON }),
  p({ id: "kings", name: "国王", group: "ar_ed", level: 47, mods: [rng("attackRating", 101, 130), rng("enhancedDamage", 51, 65), rng("maxDamage", 5, 10)], kinds: WEAPON, freq: 2 }),

  p({ id: "sturdy", name: "坚固", group: "edef", level: 1, mods: [rng("enhancedDefense", 10, 20)], kinds: ARMOR }),
  p({ id: "strong", name: "强壮", group: "edef", level: 5, mods: [rng("enhancedDefense", 21, 30)], kinds: ARMOR }),
  p({ id: "glorious", name: "光辉", group: "edef", level: 9, mods: [rng("enhancedDefense", 31, 40)], kinds: ARMOR }),
  p({ id: "blessed", name: "祝福", group: "edef", level: 13, mods: [rng("enhancedDefense", 41, 50)], kinds: ARMOR }),
  p({ id: "saintly", name: "圣洁", group: "edef", level: 18, mods: [rng("enhancedDefense", 51, 65)], kinds: ARMOR }),
  p({ id: "holy", name: "神圣", group: "edef", level: 24, mods: [rng("enhancedDefense", 66, 80)], kinds: ARMOR }),
  p({ id: "godly", name: "神性", group: "edef", level: 36, mods: [rng("enhancedDefense", 81, 100)], kinds: ARMOR, freq: 2 }),

  p({ id: "crimson", name: "绯红", group: "fire", level: 1, mods: [rng("fireMin", 1, 3), rng("fireMax", 2, 6)], kinds: WEAPON }),
  p({ id: "carbuncle", name: "红玉", group: "fire", level: 12, mods: [rng("fireMin", 4, 7), rng("fireMax", 8, 14)], kinds: WEAPON }),
  p({ id: "carmine", name: "朱红", group: "fire", level: 23, mods: [rng("fireMin", 8, 12), rng("fireMax", 15, 22)], kinds: WEAPON }),
  p({ id: "burning", name: "燃烧", group: "fire", level: 35, mods: [rng("fireMin", 13, 21), rng("fireMax", 23, 36)], kinds: WEAPON }),
  p({ id: "flaming", name: "烈焰", group: "fire", level: 47, mods: [rng("fireMin", 22, 30), rng("fireMax", 37, 55)], kinds: WEAPON, freq: 2 }),

  p({ id: "azure", name: "碧蓝", group: "cold", level: 1, mods: [rng("coldMin", 1, 2), rng("coldMax", 2, 4)], kinds: WEAPON }),
  p({ id: "lapis", name: "青金石", group: "cold", level: 12, mods: [rng("coldMin", 3, 4), rng("coldMax", 5, 8)], kinds: WEAPON }),
  p({ id: "cobalt", name: "钴蓝", group: "cold", level: 23, mods: [rng("coldMin", 5, 7), rng("coldMax", 9, 14)], kinds: WEAPON }),
  p({ id: "sapphire", name: "蓝宝石", group: "cold", level: 35, mods: [rng("coldMin", 8, 12), rng("coldMax", 15, 22)], kinds: WEAPON }),
  p({ id: "freezing", name: "冰冻", group: "cold", level: 47, mods: [rng("coldMin", 13, 18), rng("coldMax", 23, 32)], kinds: WEAPON, freq: 2 }),

  p({ id: "white", name: "苍白", group: "light", level: 1, mods: [rng("lightningMin", 1, 1), rng("lightningMax", 4, 8)], kinds: WEAPON }),
  p({ id: "pearl", name: "珍珠", group: "light", level: 12, mods: [rng("lightningMin", 1, 3), rng("lightningMax", 9, 16)], kinds: WEAPON }),
  p({ id: "amber", name: "琥珀", group: "light", level: 23, mods: [rng("lightningMin", 1, 5), rng("lightningMax", 17, 28)], kinds: WEAPON }),
  p({ id: "jade", name: "翡翠电", group: "light", level: 35, mods: [rng("lightningMin", 1, 8), rng("lightningMax", 29, 48)], kinds: WEAPON }),
  p({ id: "lightning", name: "闪电", group: "light", level: 47, mods: [rng("lightningMin", 1, 14), rng("lightningMax", 49, 80)], kinds: WEAPON, freq: 2 }),

  p({ id: "rancid", name: "腐臭", group: "poison", level: 5, mods: [rng("poisonMin", 4, 7), rng("poisonMax", 8, 14)], kinds: WEAPON }),
  p({ id: "venomous", name: "剧毒", group: "poison", level: 18, mods: [rng("poisonMin", 12, 18), rng("poisonMax", 19, 36)], kinds: WEAPON }),
  p({ id: "toxic", name: "毒性", group: "poison", level: 32, mods: [rng("poisonMin", 24, 36), rng("poisonMax", 37, 60)], kinds: WEAPON }),

  p({ id: "ruby", name: "红宝石", group: "fres", level: 12, mods: [rng("fireRes", 10, 20)], kinds: NOT_WEAPON }),
  p({ id: "garnet", name: "石榴石", group: "fres", level: 1, mods: [rng("fireRes", 5, 10)], kinds: NOT_WEAPON }),
  p({ id: "cobalt_res", name: "钴蓝抗", group: "cres", level: 12, mods: [rng("coldRes", 10, 20)], kinds: NOT_WEAPON }),
  p({ id: "coral", name: "珊瑚", group: "lres", level: 12, mods: [rng("lightningRes", 10, 20)], kinds: NOT_WEAPON }),
  p({ id: "emerald", name: "绿宝石", group: "pres", level: 12, mods: [rng("poisonRes", 10, 20)], kinds: NOT_WEAPON }),
  p({ id: "shimmering", name: "闪耀", group: "allres", level: 8, mods: [rng("allRes", 3, 7)], kinds: ARMOR_JEWEL }),
  p({ id: "rainbow", name: "彩虹", group: "allres", level: 18, mods: [rng("allRes", 8, 11)], kinds: ARMOR_JEWEL }),
  p({ id: "prismatic", name: "棱彩", group: "allres", level: 31, mods: [rng("allRes", 12, 15)], kinds: JEWEL }),
  p({ id: "chromatic", name: "五彩", group: "allres", level: 42, mods: [rng("allRes", 16, 20)], kinds: JEWEL, freq: 2 }),

  p({ id: "lizzards", name: "蜥蜴", group: "mana", level: 3, mods: [rng("mana", 3, 5)], kinds: ALL }),
  p({ id: "serpents", name: "毒蛇", group: "mana", level: 12, mods: [rng("mana", 6, 10)], kinds: ALL }),
  p({ id: "drakes", name: "龙蜥", group: "mana", level: 23, mods: [rng("mana", 11, 15)], kinds: ALL }),
  p({ id: "dragons", name: "巨龙", group: "mana", level: 35, mods: [rng("mana", 16, 22)], kinds: ALL }),

  p({ id: "fortunate", name: "幸运", group: "mf", level: 18, mods: [rng("magicFind", 5, 10)], kinds: ["amulet", "ring", "boots", "gloves"] }),
  p({ id: "lucky", name: "鸿运", group: "mf", level: 31, mods: [rng("magicFind", 11, 15)], kinds: ["amulet", "boots"], freq: 2 }),

  s({ id: "craftsmanship", name: "工艺", group: "maxdmg", level: 1, mods: [rng("maxDamage", 1, 1)], kinds: WEAPON_JEWEL }),
  s({ id: "quality", name: "品质", group: "maxdmg", level: 5, mods: [rng("maxDamage", 2, 2)], kinds: WEAPON_JEWEL }),
  s({ id: "maiming", name: "残害", group: "maxdmg", level: 8, mods: [rng("maxDamage", 3, 3)], kinds: WEAPON_JEWEL }),
  s({ id: "slaying", name: "杀戮", group: "maxdmg", level: 13, mods: [rng("maxDamage", 4, 5)], kinds: WEAPON }),
  s({ id: "gore", name: "血肉", group: "maxdmg", level: 20, mods: [rng("maxDamage", 6, 8)], kinds: WEAPON }),
  s({ id: "carnage", name: "屠戮", group: "maxdmg", level: 28, mods: [rng("maxDamage", 9, 12)], kinds: WEAPON }),
  s({ id: "slaughter", name: "屠杀", group: "maxdmg", level: 38, mods: [rng("maxDamage", 13, 20)], kinds: WEAPON, freq: 2 }),

  s({ id: "worth", name: "价值", group: "mindmg", level: 1, mods: [rng("minDamage", 1, 1)], kinds: WEAPON_JEWEL }),
  s({ id: "measure", name: "度量", group: "mindmg", level: 12, mods: [rng("minDamage", 2, 3)], kinds: WEAPON_JEWEL }),
  s({ id: "excellence", name: "卓越", group: "mindmg", level: 24, mods: [rng("minDamage", 4, 5)], kinds: WEAPON }),
  s({ id: "performance", name: "发挥", group: "mindmg", level: 36, mods: [rng("minDamage", 6, 9)], kinds: WEAPON }),

  s({ id: "readiness", name: "迅速", group: "ias", level: 5, mods: [rng("ias", 10, 10)], kinds: ["weapon", "gloves"] }),
  s({ id: "alacrity", name: "机敏", group: "ias", level: 13, mods: [rng("ias", 20, 20)], kinds: ["weapon", "gloves"] }),
  s({ id: "swiftness", name: "迅捷", group: "ias", level: 22, mods: [rng("ias", 30, 30)], kinds: WEAPON }),
  s({ id: "quickness", name: "快速", group: "ias", level: 34, mods: [rng("ias", 40, 40)], kinds: WEAPON, freq: 2 }),

  s({ id: "strength", name: "力量", group: "str", level: 1, mods: [rng("strength", 1, 3)], kinds: ALL }),
  s({ id: "might", name: "威力", group: "str", level: 8, mods: [rng("strength", 4, 6)], kinds: ALL }),
  s({ id: "ox", name: "公牛", group: "str", level: 18, mods: [rng("strength", 7, 9)], kinds: ALL }),
  s({ id: "giant", name: "巨人", group: "str", level: 28, mods: [rng("strength", 10, 12)], kinds: ALL }),
  s({ id: "titan", name: "泰坦", group: "str", level: 38, mods: [rng("strength", 13, 20)], kinds: ["weapon", "armor", "belt", "amulet"], freq: 2 }),

  s({ id: "dexterity", name: "敏捷", group: "dex", level: 1, mods: [rng("dexterity", 1, 3)], kinds: ALL }),
  s({ id: "skill", name: "技巧", group: "dex", level: 8, mods: [rng("dexterity", 4, 6)], kinds: ALL }),
  s({ id: "accuracy", name: "准确", group: "dex", level: 18, mods: [rng("dexterity", 7, 9)], kinds: ALL }),
  s({ id: "precision", name: "精密", group: "dex", level: 28, mods: [rng("dexterity", 10, 12)], kinds: ALL }),
  s({ id: "perfection", name: "完美", group: "dex", level: 38, mods: [rng("dexterity", 13, 20)], kinds: ["weapon", "gloves", "ring", "amulet"], freq: 2 }),

  s({ id: "jackal", name: "豺狼", group: "life", level: 1, mods: [rng("life", 1, 5)], kinds: ALL }),
  s({ id: "fox", name: "狐狸", group: "life", level: 6, mods: [rng("life", 6, 10)], kinds: ALL }),
  s({ id: "wolf", name: "狼", group: "life", level: 12, mods: [rng("life", 11, 20)], kinds: ALL }),
  s({ id: "tiger", name: "虎", group: "life", level: 20, mods: [rng("life", 21, 30)], kinds: ALL }),
  s({ id: "mammoth", name: "猛犸", group: "life", level: 31, mods: [rng("life", 31, 40)], kinds: ALL }),
  s({ id: "colossus", name: "巨神", group: "life", level: 42, mods: [rng("life", 41, 60)], kinds: ["armor", "belt", "amulet"], freq: 2 }),
  s({ id: "whale", name: "鲸", group: "life", level: 50, mods: [rng("life", 61, 80)], kinds: ["armor", "amulet"], freq: 1 }),

  s({ id: "flame", name: "火焰", group: "fire", level: 4, mods: [rng("fireMin", 1, 2), rng("fireMax", 2, 5)], kinds: WEAPON_JEWEL }),
  s({ id: "burning_s", name: "燃烧", group: "fire", level: 16, mods: [rng("fireMin", 3, 6), rng("fireMax", 6, 12)], kinds: WEAPON_JEWEL }),
  s({ id: "incineration", name: "焚烧", group: "fire", level: 32, mods: [rng("fireMin", 8, 14), rng("fireMax", 15, 28)], kinds: WEAPON }),

  s({ id: "frost", name: "寒霜", group: "cold", level: 4, mods: [rng("coldMin", 1, 2), rng("coldMax", 2, 4)], kinds: WEAPON_JEWEL }),
  s({ id: "icicle", name: "冰柱", group: "cold", level: 16, mods: [rng("coldMin", 3, 4), rng("coldMax", 5, 9)], kinds: WEAPON_JEWEL }),
  s({ id: "glacier", name: "冰川", group: "cold", level: 32, mods: [rng("coldMin", 6, 10), rng("coldMax", 11, 18)], kinds: WEAPON }),

  s({ id: "shock", name: "电击", group: "light", level: 4, mods: [rng("lightningMin", 1, 1), rng("lightningMax", 6, 11)], kinds: WEAPON_JEWEL }),
  s({ id: "lightning_s", name: "雷电", group: "light", level: 16, mods: [rng("lightningMin", 1, 3), rng("lightningMax", 12, 22)], kinds: WEAPON_JEWEL }),
  s({ id: "thunder", name: "雷霆", group: "light", level: 32, mods: [rng("lightningMin", 1, 6), rng("lightningMax", 23, 44)], kinds: WEAPON }),

  s({ id: "blight", name: "凋零", group: "poison", level: 8, mods: [rng("poisonMin", 6, 10), rng("poisonMax", 11, 20)], kinds: WEAPON_JEWEL }),
  s({ id: "venom", name: "毒液", group: "poison", level: 20, mods: [rng("poisonMin", 16, 24), rng("poisonMax", 25, 40)], kinds: WEAPON }),
  s({ id: "pestilence", name: "瘟疫", group: "poison", level: 36, mods: [rng("poisonMin", 32, 48), rng("poisonMax", 41, 80)], kinds: WEAPON }),

  s({ id: "leech", name: "吸血", group: "ll", level: 6, mods: [rng("lifeLeech", 2, 3)], kinds: ["weapon", "ring"] }),
  s({ id: "the_bat", name: "蝙蝠", group: "ml", level: 8, mods: [rng("manaLeech", 2, 4)], kinds: ["weapon", "ring"] }),
  s({ id: "the_leech", name: "水蛭", group: "ll", level: 20, mods: [rng("lifeLeech", 4, 5)], kinds: ["weapon", "ring"] }),
  s({ id: "the_locust", name: "蝗虫", group: "ml", level: 24, mods: [rng("manaLeech", 5, 6)], kinds: ["weapon"] }),

  s({ id: "fortune", name: "财富", group: "mf", level: 12, mods: [rng("magicFind", 5, 15)], kinds: ["amulet", "ring", "boots", "gloves", "helm"] }),
  s({ id: "good_luck", name: "好运", group: "mf", level: 26, mods: [rng("magicFind", 16, 25)], kinds: ["amulet", "boots"], freq: 2 }),
  s({ id: "wealth", name: "财富金", group: "gf", level: 10, mods: [rng("goldFind", 20, 40)], kinds: ["boots", "gloves", "ring"] }),
  s({ id: "greed", name: "贪婪", group: "gf", level: 22, mods: [rng("goldFind", 41, 80)], kinds: ["boots", "ring"] }),

  s({ id: "balance", name: "平衡", group: "frw", level: 5, mods: [rng("frw", 10, 10)], kinds: BOOTS }),
  s({ id: "the_hare", name: "野兔", group: "frw", level: 12, mods: [rng("frw", 20, 20)], kinds: BOOTS }),
  s({ id: "speed", name: "速度", group: "frw", level: 22, mods: [rng("frw", 30, 30)], kinds: BOOTS }),

  s({ id: "blocking", name: "格挡", group: "block", level: 5, mods: [rng("toBlock", 10, 10)], kinds: ["shield"] }),
  s({ id: "deflecting", name: "偏斜", group: "block", level: 18, mods: [rng("toBlock", 20, 20)], kinds: ["shield"] }),

  s({ id: "the_apprentice", name: "学徒", group: "fcr", level: 8, mods: [rng("fcr", 10, 10)], kinds: ["amulet", "ring"] }),
  s({ id: "the_magus", name: "法师", group: "fcr", level: 22, mods: [rng("fcr", 20, 20)], kinds: ["amulet", "ring"] }),

  s({ id: "vita", name: "活力", group: "vit", level: 1, mods: [rng("vitality", 1, 3)], kinds: ALL }),
  s({ id: "vitality", name: "体质", group: "vit", level: 12, mods: [rng("vitality", 4, 6)], kinds: ALL }),
  s({ id: "life_s", name: "生命", group: "vit", level: 24, mods: [rng("vitality", 7, 10)], kinds: ALL }),

  s({ id: "energy", name: "能量", group: "nrg", level: 1, mods: [rng("energy", 1, 3)], kinds: ALL }),
  s({ id: "the_mind", name: "心灵", group: "nrg", level: 16, mods: [rng("energy", 4, 6)], kinds: ALL }),
  s({ id: "brilliance", name: "辉煌", group: "nrg", level: 28, mods: [rng("energy", 7, 9)], kinds: ALL }),

  s({ id: "puncture", name: "穿透", group: "ds", level: 16, mods: [rng("deadlyStrike", 5, 10)], kinds: ["weapon"] }),
  s({ id: "slaying_ds", name: "必杀", group: "ds", level: 28, mods: [rng("deadlyStrike", 11, 20)], kinds: ["weapon"] }),
  s({ id: "evisceration", name: "开膛", group: "ds", level: 40, mods: [rng("deadlyStrike", 21, 30)], kinds: ["weapon"], freq: 2 }),

  s({ id: "chance", name: "机遇", group: "cs", level: 12, mods: [rng("criticalStrike", 5, 8)], kinds: ["weapon", "gloves"] }),
  s({ id: "misfortune", name: "厄运", group: "cs", level: 24, mods: [rng("criticalStrike", 9, 12)], kinds: WEAPON }),

  p({ id: "defenders", name: "防御者", group: "def", level: 1, mods: [rng("defense", 10, 20)], kinds: ARMOR }),
  p({ id: "guardians", name: "守护", group: "def", level: 12, mods: [rng("defense", 21, 40)], kinds: ARMOR }),
  p({ id: "protectors", name: "保护", group: "def", level: 24, mods: [rng("defense", 41, 80)], kinds: ARMOR }),

  p({ id: "forged", name: "锻造", group: "ar_pct", level: 10, mods: [rng("attackRatingPercent", 10, 20)], kinds: WEAPON }),
  p({ id: "visionary", name: "神视", group: "ar_pct", level: 28, mods: [rng("attackRatingPercent", 21, 40)], kinds: WEAPON }),

  s({ id: "the_thief", name: "盗贼", group: "mf", level: 20, mods: [rng("magicFind", 10, 20)], kinds: GLOVES }),
];

export const AFFIX_BY_ID: Record<string, AffixDef> = Object.fromEntries(
  AFFIXES.map((affix) => [affix.id, affix]),
);

export function canSpawnOn(affix: AffixDef, base: ItemBase): boolean {
  if (affix.exclude?.includes(base.kind)) return false;
  if (!affix.kinds || affix.kinds.length === 0) return true;
  return affix.kinds.includes(base.kind);
}

export function affixesFor(
  kind: AffixKind,
  base: ItemBase,
  ilvl: number,
  usedGroups: Set<string>,
): AffixDef[] {
  return AFFIXES.filter(
    (affix) =>
      affix.kind === kind &&
      affix.level <= ilvl &&
      !usedGroups.has(affix.group) &&
      canSpawnOn(affix, base),
  );
}
