import type { UniqueDef } from "./types";

export const UNIQUES: UniqueDef[] = [
  {
    id: "the_gnasher",
    name: "啮咬者",
    baseId: "hand_axe",
    qlvl: 5,
    mods: [
      { stat: "enhancedDamage", min: 60, max: 70 },
      { stat: "strength", min: 8, max: 8 },
      { stat: "deadlyStrike", min: 20, max: 20 },
    ],
  },
  {
    id: "deathspade",
    name: "死亡之铲",
    baseId: "axe",
    qlvl: 9,
    mods: [
      { stat: "enhancedDamage", min: 60, max: 80 },
      { stat: "attackRating", min: 50, max: 80 },
      { stat: "minDamage", min: 8, max: 8 },
    ],
  },
  {
    id: "blood_crescent",
    name: "血新月",
    baseId: "scimitar",
    qlvl: 7,
    mods: [
      { stat: "enhancedDamage", min: 60, max: 80 },
      { stat: "lifeLeech", min: 15, max: 15 },
      { stat: "life", min: 15, max: 15 },
      { stat: "ias", min: 15, max: 15 },
    ],
  },
  {
    id: "rixots_keen",
    name: "里克索特之锋",
    baseId: "short_sword",
    qlvl: 2,
    mods: [
      { stat: "enhancedDamage", min: 100, max: 100 },
      { stat: "attackRating", min: 20, max: 25 },
      { stat: "minDamage", min: 5, max: 5 },
    ],
  },
  {
    id: "kris_of_pain",
    name: "苦痛波刃",
    baseId: "kris",
    qlvl: 17,
    mods: [
      { stat: "enhancedDamage", min: 70, max: 90 },
      { stat: "poisonMin", min: 20, max: 30 },
      { stat: "poisonMax", min: 40, max: 60 },
      { stat: "dexterity", min: 10, max: 10 },
    ],
  },
  {
    id: "biggins_bonnet",
    name: "比金软帽",
    baseId: "cap",
    qlvl: 3,
    mods: [
      { stat: "defense", min: 14, max: 14 },
      { stat: "life", min: 30, max: 30 },
      { stat: "attackRating", min: 30, max: 30 },
      { stat: "mana", min: 15, max: 15 },
    ],
  },
  {
    id: "twitchthroe",
    name: "抽动",
    baseId: "studded_leather",
    qlvl: 16,
    mods: [
      { stat: "ias", min: 20, max: 20 },
      { stat: "toBlock", min: 25, max: 25 },
      { stat: "dexterity", min: 10, max: 10 },
      { stat: "strength", min: 10, max: 10 },
    ],
  },
  {
    id: "goldwrap",
    name: "金织带",
    baseId: "heavy_belt",
    qlvl: 27,
    mods: [
      { stat: "ias", min: 10, max: 10 },
      { stat: "magicFind", min: 30, max: 50 },
      { stat: "goldFind", min: 50, max: 80 },
      { stat: "enhancedDefense", min: 40, max: 60 },
    ],
  },
  {
    id: "nagelring",
    name: "纳格尔之戒",
    baseId: "ring",
    qlvl: 7,
    mods: [
      { stat: "attackRating", min: 50, max: 75 },
      { stat: "magicFind", min: 15, max: 30 },
      { stat: "lightningRes", min: 10, max: 15 },
    ],
  },
  {
    id: "manald_heal",
    name: "玛纳德的治疗",
    baseId: "ring",
    qlvl: 15,
    mods: [
      { stat: "manaLeech", min: 4, max: 7 },
      { stat: "life", min: 20, max: 20 },
      { stat: "mana", min: 20, max: 20 },
    ],
  },
  {
    id: "noksani",
    name: "诺卡珊",
    baseId: "amulet",
    qlvl: 10,
    mods: [
      { stat: "fireRes", min: 20, max: 30 },
      { stat: "coldRes", min: 20, max: 30 },
      { stat: "lightningRes", min: 20, max: 30 },
      { stat: "poisonRes", min: 20, max: 30 },
    ],
  },
  {
    id: "stormguild",
    name: "风暴公会",
    baseId: "kite_shield",
    qlvl: 13,
    mods: [
      { stat: "enhancedDefense", min: 50, max: 60 },
      { stat: "lightningRes", min: 25, max: 35 },
      { stat: "lightningMin", min: 1, max: 1 },
      { stat: "lightningMax", min: 12, max: 18 },
    ],
  },
  {
    id: "hotspur",
    name: "热刺",
    baseId: "boots",
    qlvl: 5,
    mods: [
      { stat: "fireRes", min: 15, max: 15 },
      { stat: "life", min: 15, max: 15 },
      { stat: "frw", min: 10, max: 10 },
      { stat: "fireMin", min: 3, max: 3 },
      { stat: "fireMax", min: 6, max: 6 },
    ],
  },
  {
    id: "the_hand_of_broc",
    name: "布洛克之手",
    baseId: "leather_gloves",
    qlvl: 5,
    mods: [
      { stat: "lifeLeech", min: 3, max: 5 },
      { stat: "life", min: 20, max: 20 },
      { stat: "poisonRes", min: 10, max: 10 },
      { stat: "mana", min: 20, max: 30 },
    ],
  },
  {
    id: "bladebone",
    name: "刃骨",
    baseId: "bardiche",
    qlvl: 15,
    mods: [
      { stat: "enhancedDamage", min: 30, max: 50 },
      { stat: "fireMin", min: 8, max: 8 },
      { stat: "fireMax", min: 12, max: 12 },
      { stat: "attackRating", min: 40, max: 40 },
      { stat: "ias", min: 20, max: 20 },
    ],
  },
];

export const UNIQUES_BY_BASE: Record<string, UniqueDef[]> = {};
for (const unique of UNIQUES) {
  (UNIQUES_BY_BASE[unique.baseId] ??= []).push(unique);
}

export function uniquesForBase(baseId: string, ilvl: number): UniqueDef[] {
  return (UNIQUES_BY_BASE[baseId] ?? []).filter((unique) => unique.qlvl <= ilvl);
}
