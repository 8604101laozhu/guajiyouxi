export const SLOT_IDS = [
  "helm",
  "armor",
  "belt",
  "gloves",
  "boots",
  "amulet",
  "ringLeft",
  "ringRight",
  "mainHand",
  "offHand",
] as const;

export type SlotId = (typeof SLOT_IDS)[number];

export const ITEM_KINDS = [
  "helm",
  "armor",
  "belt",
  "gloves",
  "boots",
  "amulet",
  "ring",
  "weapon",
  "shield",
] as const;

export type ItemKind = (typeof ITEM_KINDS)[number];

export type WeaponClass =
  | "sword"
  | "axe"
  | "mace"
  | "scepter"
  | "dagger"
  | "spear"
  | "polearm"
  | "bow"
  | "crossbow"
  | "staff"
  | "wand"
  | "javelin";

export type Quality = "normal" | "magic" | "rare" | "unique";

export const STAT_IDS = [
  "enhancedDamage",
  "minDamage",
  "maxDamage",
  "enhancedDefense",
  "defense",
  "strength",
  "dexterity",
  "vitality",
  "energy",
  "life",
  "mana",
  "attackRating",
  "attackRatingPercent",
  "ias",
  "fcr",
  "frw",
  "lifeLeech",
  "manaLeech",
  "magicFind",
  "goldFind",
  "allRes",
  "fireRes",
  "coldRes",
  "lightningRes",
  "poisonRes",
  "fireMin",
  "fireMax",
  "coldMin",
  "coldMax",
  "lightningMin",
  "lightningMax",
  "poisonMin",
  "poisonMax",
  "criticalStrike",
  "deadlyStrike",
  "toBlock",
] as const;

export type StatId = (typeof STAT_IDS)[number];

export type DamageStat = "str" | "dex";

export type ItemBase = {
  id: string;
  name: string;
  kind: ItemKind;
  qlvl: number;
  reqStr: number;
  reqDex: number;
  reqLevel: number;
  maxSockets: number;
  weaponClass?: WeaponClass;
  twoHanded?: boolean;
  dmgMin?: number;
  dmgMax?: number;
  wsm?: number;
  defMin?: number;
  defMax?: number;
  damageStat?: DamageStat;
};

export type AffixKind = "prefix" | "suffix";

export type AffixModDef = {
  stat: StatId;
  min: number;
  max: number;
};

export type AffixDef = {
  id: string;
  kind: AffixKind;
  name: string;
  group: string;
  level: number;
  freq: number;
  mods: AffixModDef[];
  kinds?: ItemKind[];
  exclude?: ItemKind[];
};

export type RolledMod = {
  stat: StatId;
  value: number;
  min: number;
  max: number;
};

export type RolledAffix = {
  id: string;
  kind: AffixKind;
  name: string;
  group: string;
  mods: RolledMod[];
};

export type Item = {
  id: string;
  baseId: string;
  quality: Quality;
  name: string;
  identified: boolean;
  ethereal: boolean;
  ilvl: number;
  sockets: number;
  defense: number;
  affixes: RolledAffix[];
  uniqueId?: string;
  seed: number;
};

export type UniqueDef = {
  id: string;
  name: string;
  baseId: string;
  qlvl: number;
  ethereal?: boolean;
  mods: AffixModDef[];
};

export type Equipment = Partial<Record<SlotId, Item>>;

export type Attributes = {
  str: number;
  dex: number;
  vit: number;
  nrg: number;
};

export type Character = {
  name: string;
  level: number;
  base: Attributes;
  equipment: Equipment;
};

export type StatBag = Record<StatId, number>;
