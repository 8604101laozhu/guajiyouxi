import type { ItemBase, ItemKind } from "./types";

function w(
  partial: Omit<ItemBase, "kind" | "reqStr" | "reqDex" | "reqLevel" | "maxSockets"> & {
    reqStr?: number;
    reqDex?: number;
    reqLevel?: number;
    maxSockets?: number;
  },
): ItemBase {
  return {
    kind: "weapon",
    reqStr: 0,
    reqDex: 0,
    reqLevel: 0,
    maxSockets: 3,
    damageStat: partial.twoHanded && (partial.weaponClass === "bow" || partial.weaponClass === "crossbow")
      ? "dex"
      : partial.damageStat ?? (partial.weaponClass === "bow" || partial.weaponClass === "crossbow" || partial.weaponClass === "javelin"
        ? "dex"
        : "str"),
    ...partial,
  };
}

function armor(
  kind: ItemKind,
  partial: Omit<ItemBase, "kind" | "reqStr" | "reqDex" | "reqLevel" | "maxSockets"> & {
    reqStr?: number;
    reqDex?: number;
    reqLevel?: number;
    maxSockets?: number;
  },
): ItemBase {
  return {
    kind,
    reqStr: 0,
    reqDex: 0,
    reqLevel: 0,
    maxSockets: kind === "armor" || kind === "helm" ? 2 : 0,
    ...partial,
  };
}

export const BASES: ItemBase[] = [
  w({ id: "hand_axe", name: "手斧", weaponClass: "axe", qlvl: 1, dmgMin: 3, dmgMax: 6, wsm: 0, maxSockets: 2 }),
  w({ id: "axe", name: "斧", weaponClass: "axe", qlvl: 7, dmgMin: 4, dmgMax: 11, wsm: 10, reqStr: 32, maxSockets: 4 }),
  w({ id: "double_axe", name: "双刃斧", weaponClass: "axe", qlvl: 13, dmgMin: 5, dmgMax: 13, wsm: 10, reqStr: 43, maxSockets: 5 }),
  w({ id: "military_pick", name: "军用镐", weaponClass: "axe", qlvl: 19, dmgMin: 7, dmgMax: 11, wsm: -10, reqStr: 49, reqDex: 33, maxSockets: 4 }),
  w({ id: "war_axe", name: "战斧", weaponClass: "axe", qlvl: 25, dmgMin: 10, dmgMax: 18, wsm: 0, reqStr: 67, maxSockets: 6 }),
  w({ id: "large_axe", name: "巨斧", weaponClass: "axe", qlvl: 6, dmgMin: 6, dmgMax: 13, wsm: -10, reqStr: 35, twoHanded: true, maxSockets: 4 }),
  w({ id: "broad_axe", name: "宽刃斧", weaponClass: "axe", qlvl: 12, dmgMin: 10, dmgMax: 18, wsm: 0, reqStr: 48, twoHanded: true, maxSockets: 5 }),
  w({ id: "great_axe", name: "大斧", weaponClass: "axe", qlvl: 23, dmgMin: 9, dmgMax: 30, wsm: 10, reqStr: 84, reqDex: 43, twoHanded: true, maxSockets: 5 }),
  w({ id: "giant_axe", name: "巨人斧", weaponClass: "axe", qlvl: 33, dmgMin: 22, dmgMax: 45, wsm: 10, reqStr: 84, twoHanded: true, maxSockets: 6 }),

  w({ id: "short_sword", name: "短剑", weaponClass: "sword", qlvl: 1, dmgMin: 2, dmgMax: 7, wsm: 0, maxSockets: 2 }),
  w({ id: "scimitar", name: "弯刀", weaponClass: "sword", qlvl: 5, dmgMin: 2, dmgMax: 6, wsm: -20, reqDex: 21, maxSockets: 2 }),
  w({ id: "saber", name: "军刀", weaponClass: "sword", qlvl: 8, dmgMin: 3, dmgMax: 8, wsm: -10, reqStr: 25, reqDex: 20, maxSockets: 2 }),
  w({ id: "falchion", name: "弯刃剑", weaponClass: "sword", qlvl: 11, dmgMin: 9, dmgMax: 17, wsm: 20, reqStr: 33, maxSockets: 2 }),
  w({ id: "crystal_sword", name: "水晶剑", weaponClass: "sword", qlvl: 11, dmgMin: 5, dmgMax: 15, wsm: 0, maxSockets: 6 }),
  w({ id: "broad_sword", name: "阔剑", weaponClass: "sword", qlvl: 15, dmgMin: 7, dmgMax: 14, wsm: 0, reqStr: 48, maxSockets: 4 }),
  w({ id: "long_sword", name: "长剑", weaponClass: "sword", qlvl: 20, dmgMin: 3, dmgMax: 19, wsm: -10, reqStr: 55, reqDex: 39, maxSockets: 4 }),
  w({ id: "war_sword", name: "战争剑", weaponClass: "sword", qlvl: 27, dmgMin: 8, dmgMax: 20, wsm: 0, reqStr: 71, reqDex: 45, maxSockets: 3 }),
  w({ id: "two_handed_sword", name: "双手剑", weaponClass: "sword", qlvl: 10, dmgMin: 8, dmgMax: 17, wsm: 0, reqStr: 35, reqDex: 27, twoHanded: true, maxSockets: 3 }),
  w({ id: "claymore", name: "阔身剑", weaponClass: "sword", qlvl: 17, dmgMin: 13, dmgMax: 30, wsm: 10, reqStr: 47, twoHanded: true, maxSockets: 4 }),
  w({ id: "giant_sword", name: "巨剑", weaponClass: "sword", qlvl: 21, dmgMin: 9, dmgMax: 28, wsm: 0, reqStr: 56, reqDex: 34, twoHanded: true, maxSockets: 4 }),
  w({ id: "great_sword", name: "卓越剑", weaponClass: "sword", qlvl: 25, dmgMin: 12, dmgMax: 20, wsm: 10, reqStr: 100, reqDex: 60, twoHanded: true, maxSockets: 4 }),
  w({ id: "flamberge", name: "焰形剑", weaponClass: "sword", qlvl: 27, dmgMin: 9, dmgMax: 15, wsm: -10, reqStr: 70, reqDex: 49, twoHanded: true, maxSockets: 5 }),
  w({ id: "colossus_blade", name: "巨神之刃", weaponClass: "sword", qlvl: 37, dmgMin: 25, dmgMax: 65, wsm: 5, reqStr: 189, reqDex: 110, twoHanded: true, maxSockets: 6 }),

  w({ id: "club", name: "木棒", weaponClass: "mace", qlvl: 1, dmgMin: 1, dmgMax: 6, wsm: -10, maxSockets: 2 }),
  w({ id: "spiked_club", name: "钉棒", weaponClass: "mace", qlvl: 4, dmgMin: 5, dmgMax: 8, wsm: 0, maxSockets: 2 }),
  w({ id: "mace", name: "钉锤", weaponClass: "mace", qlvl: 8, dmgMin: 3, dmgMax: 10, wsm: 0, reqStr: 27, maxSockets: 2 }),
  w({ id: "morning_star", name: "晨星", weaponClass: "mace", qlvl: 13, dmgMin: 7, dmgMax: 16, wsm: 10, reqStr: 36, maxSockets: 3 }),
  w({ id: "flail", name: "连枷", weaponClass: "mace", qlvl: 19, dmgMin: 3, dmgMax: 24, wsm: -10, reqStr: 41, reqDex: 35, maxSockets: 5 }),
  w({ id: "war_hammer", name: "战锤", weaponClass: "mace", qlvl: 25, dmgMin: 19, dmgMax: 30, wsm: 20, reqStr: 53, maxSockets: 4 }),
  w({ id: "maul", name: "大锤", weaponClass: "mace", qlvl: 21, dmgMin: 30, dmgMax: 43, wsm: 10, reqStr: 69, twoHanded: true, maxSockets: 4 }),
  w({ id: "great_maul", name: "卓越大锤", weaponClass: "mace", qlvl: 32, dmgMin: 38, dmgMax: 58, wsm: 20, reqStr: 99, twoHanded: true, maxSockets: 6 }),

  w({ id: "scepter", name: "权杖", weaponClass: "scepter", qlvl: 3, dmgMin: 6, dmgMax: 11, wsm: 0, reqStr: 25, maxSockets: 2 }),
  w({ id: "grand_scepter", name: "宏伟权杖", weaponClass: "scepter", qlvl: 15, dmgMin: 8, dmgMax: 18, wsm: 10, reqStr: 37, maxSockets: 3 }),
  w({ id: "war_scepter", name: "战争权杖", weaponClass: "scepter", qlvl: 21, dmgMin: 10, dmgMax: 17, wsm: -10, reqStr: 55, maxSockets: 5 }),

  w({ id: "dagger", name: "匕首", weaponClass: "dagger", qlvl: 1, dmgMin: 1, dmgMax: 4, wsm: -20, maxSockets: 1 }),
  w({ id: "dirk", name: "短剑刺", weaponClass: "dagger", qlvl: 9, dmgMin: 3, dmgMax: 9, wsm: 0, reqDex: 25, maxSockets: 1 }),
  w({ id: "kris", name: "波刃匕首", weaponClass: "dagger", qlvl: 17, dmgMin: 2, dmgMax: 11, wsm: -20, reqDex: 45, maxSockets: 3 }),
  w({ id: "blade", name: "刃", weaponClass: "dagger", qlvl: 23, dmgMin: 4, dmgMax: 15, wsm: -10, reqStr: 35, reqDex: 51, maxSockets: 2 }),

  w({ id: "short_spear", name: "短矛", weaponClass: "javelin", qlvl: 5, dmgMin: 2, dmgMax: 4, wsm: -10, reqDex: 20, damageStat: "dex", maxSockets: 0 }),
  w({ id: "javelin", name: "标枪", weaponClass: "javelin", qlvl: 1, dmgMin: 1, dmgMax: 5, wsm: -10, damageStat: "dex", maxSockets: 0 }),
  w({ id: "spear", name: "矛", weaponClass: "spear", qlvl: 5, dmgMin: 3, dmgMax: 15, wsm: 0, reqStr: 20, reqDex: 22, twoHanded: true, maxSockets: 3 }),
  w({ id: "trident", name: "三叉戟", weaponClass: "spear", qlvl: 9, dmgMin: 9, dmgMax: 15, wsm: 0, reqStr: 38, reqDex: 24, twoHanded: true, maxSockets: 4 }),
  w({ id: "brandistock", name: "叉", weaponClass: "spear", qlvl: 13, dmgMin: 7, dmgMax: 17, wsm: -20, reqStr: 40, reqDex: 50, twoHanded: true, maxSockets: 3 }),
  w({ id: "pike", name: "长枪", weaponClass: "spear", qlvl: 21, dmgMin: 14, dmgMax: 63, wsm: 20, reqStr: 60, reqDex: 52, twoHanded: true, maxSockets: 4 }),

  w({ id: "bardiche", name: "斧枪", weaponClass: "polearm", qlvl: 5, dmgMin: 1, dmgMax: 27, wsm: 10, reqStr: 40, twoHanded: true, maxSockets: 3 }),
  w({ id: "voulge", name: "长柄斧", weaponClass: "polearm", qlvl: 11, dmgMin: 6, dmgMax: 21, wsm: 0, reqStr: 50, twoHanded: true, maxSockets: 4 }),
  w({ id: "scythe", name: "镰刀", weaponClass: "polearm", qlvl: 15, dmgMin: 8, dmgMax: 20, wsm: -10, reqStr: 41, reqDex: 41, twoHanded: true, maxSockets: 4 }),
  w({ id: "halberd", name: "戟", weaponClass: "polearm", qlvl: 29, dmgMin: 12, dmgMax: 45, wsm: 0, reqStr: 75, reqDex: 47, twoHanded: true, maxSockets: 5 }),

  w({ id: "short_bow", name: "短弓", weaponClass: "bow", qlvl: 1, dmgMin: 1, dmgMax: 4, wsm: 5, twoHanded: true, maxSockets: 3 }),
  w({ id: "hunters_bow", name: "猎弓", weaponClass: "bow", qlvl: 5, dmgMin: 2, dmgMax: 6, wsm: -10, twoHanded: true, maxSockets: 4 }),
  w({ id: "long_bow", name: "长弓", weaponClass: "bow", qlvl: 8, dmgMin: 3, dmgMax: 10, wsm: 0, reqDex: 22, twoHanded: true, maxSockets: 5 }),
  w({ id: "composite_bow", name: "复合弓", weaponClass: "bow", qlvl: 12, dmgMin: 4, dmgMax: 8, wsm: -10, reqStr: 25, reqDex: 35, twoHanded: true, maxSockets: 4 }),
  w({ id: "short_battle_bow", name: "短战弓", weaponClass: "bow", qlvl: 18, dmgMin: 5, dmgMax: 11, wsm: 0, reqStr: 30, reqDex: 40, twoHanded: true, maxSockets: 5 }),
  w({ id: "long_battle_bow", name: "长战弓", weaponClass: "bow", qlvl: 23, dmgMin: 3, dmgMax: 18, wsm: 10, reqStr: 40, reqDex: 50, twoHanded: true, maxSockets: 6 }),
  w({ id: "short_war_bow", name: "短战争弓", weaponClass: "bow", qlvl: 27, dmgMin: 6, dmgMax: 14, wsm: 0, reqStr: 35, reqDex: 55, twoHanded: true, maxSockets: 5 }),
  w({ id: "long_war_bow", name: "长战争弓", weaponClass: "bow", qlvl: 31, dmgMin: 3, dmgMax: 23, wsm: 10, reqStr: 50, reqDex: 65, twoHanded: true, maxSockets: 6 }),
  w({ id: "light_crossbow", name: "轻弩", weaponClass: "crossbow", qlvl: 6, dmgMin: 6, dmgMax: 9, wsm: -10, reqStr: 21, reqDex: 27, twoHanded: true, maxSockets: 3 }),
  w({ id: "crossbow", name: "弩", weaponClass: "crossbow", qlvl: 15, dmgMin: 9, dmgMax: 16, wsm: 0, reqStr: 40, reqDex: 33, twoHanded: true, maxSockets: 4 }),
  w({ id: "heavy_crossbow", name: "重弩", weaponClass: "crossbow", qlvl: 24, dmgMin: 14, dmgMax: 26, wsm: 10, reqStr: 60, reqDex: 40, twoHanded: true, maxSockets: 6 }),

  w({ id: "short_staff", name: "短杖", weaponClass: "staff", qlvl: 1, dmgMin: 1, dmgMax: 5, wsm: 0, twoHanded: true, maxSockets: 2 }),
  w({ id: "long_staff", name: "长杖", weaponClass: "staff", qlvl: 8, dmgMin: 2, dmgMax: 8, wsm: 0, twoHanded: true, maxSockets: 3 }),
  w({ id: "gnarled_staff", name: "多节杖", weaponClass: "staff", qlvl: 12, dmgMin: 4, dmgMax: 12, wsm: 10, twoHanded: true, maxSockets: 4 }),
  w({ id: "battle_staff", name: "战斗杖", weaponClass: "staff", qlvl: 17, dmgMin: 6, dmgMax: 13, wsm: 0, twoHanded: true, maxSockets: 4 }),
  w({ id: "war_staff", name: "战争杖", weaponClass: "staff", qlvl: 23, dmgMin: 12, dmgMax: 28, wsm: 20, twoHanded: true, maxSockets: 6 }),
  w({ id: "wand", name: "魔杖", weaponClass: "wand", qlvl: 2, dmgMin: 2, dmgMax: 4, wsm: 0, maxSockets: 1 }),
  w({ id: "yew_wand", name: "紫杉魔杖", weaponClass: "wand", qlvl: 12, dmgMin: 2, dmgMax: 8, wsm: 10, maxSockets: 1 }),
  w({ id: "bone_wand", name: "骨魔杖", weaponClass: "wand", qlvl: 18, dmgMin: 3, dmgMax: 7, wsm: -20, maxSockets: 2 }),
  w({ id: "grim_wand", name: "恐怖魔杖", weaponClass: "wand", qlvl: 26, dmgMin: 5, dmgMax: 11, wsm: 0, maxSockets: 2 }),

  armor("helm", { id: "cap", name: "便帽", qlvl: 1, defMin: 3, defMax: 5, maxSockets: 2 }),
  armor("helm", { id: "skull_cap", name: "骷髅帽", qlvl: 5, defMin: 8, defMax: 11, maxSockets: 2 }),
  armor("helm", { id: "helm", name: "头盔", qlvl: 11, defMin: 15, defMax: 18, reqStr: 26, maxSockets: 2 }),
  armor("helm", { id: "full_helm", name: "全护盔", qlvl: 15, defMin: 23, defMax: 26, reqStr: 41, maxSockets: 2 }),
  armor("helm", { id: "great_helm", name: "巨盔", qlvl: 22, defMin: 30, defMax: 35, reqStr: 63, maxSockets: 3 }),
  armor("helm", { id: "crown", name: "王冠", qlvl: 29, defMin: 25, defMax: 45, reqStr: 55, maxSockets: 3 }),
  armor("helm", { id: "mask", name: "面具", qlvl: 19, defMin: 9, defMax: 27, reqStr: 23, maxSockets: 3 }),
  armor("helm", { id: "bone_helm", name: "骨盔", qlvl: 22, defMin: 33, defMax: 36, reqStr: 25, maxSockets: 2 }),

  armor("armor", { id: "quilted_armor", name: "布甲", qlvl: 1, defMin: 8, defMax: 11, maxSockets: 2 }),
  armor("armor", { id: "leather_armor", name: "皮甲", qlvl: 3, defMin: 14, defMax: 17, maxSockets: 2 }),
  armor("armor", { id: "hard_leather", name: "硬皮甲", qlvl: 5, defMin: 21, defMax: 24, reqStr: 20, maxSockets: 2 }),
  armor("armor", { id: "studded_leather", name: "镶钉甲", qlvl: 8, defMin: 32, defMax: 35, reqStr: 27, maxSockets: 2 }),
  armor("armor", { id: "ring_mail", name: "锁环甲", qlvl: 11, defMin: 45, defMax: 48, reqStr: 36, maxSockets: 3 }),
  armor("armor", { id: "scale_mail", name: "鳞甲", qlvl: 13, defMin: 57, defMax: 60, reqStr: 44, maxSockets: 2 }),
  armor("armor", { id: "chain_mail", name: "锁子甲", qlvl: 15, defMin: 74, defMax: 82, reqStr: 48, maxSockets: 2 }),
  armor("armor", { id: "breast_plate", name: "胸甲", qlvl: 18, defMin: 65, defMax: 68, reqStr: 30, maxSockets: 3 }),
  armor("armor", { id: "splint_mail", name: "板条甲", qlvl: 20, defMin: 90, defMax: 95, reqStr: 51, maxSockets: 3 }),
  armor("armor", { id: "plate_mail", name: "板甲", qlvl: 24, defMin: 108, defMax: 116, reqStr: 65, maxSockets: 2 }),
  armor("armor", { id: "field_plate", name: "野战甲", qlvl: 28, defMin: 112, defMax: 116, reqStr: 55, maxSockets: 2 }),
  armor("armor", { id: "gothic_plate", name: "哥特甲", qlvl: 32, defMin: 128, defMax: 135, reqStr: 70, maxSockets: 4 }),
  armor("armor", { id: "full_plate", name: "全身板甲", qlvl: 37, defMin: 150, defMax: 161, reqStr: 80, maxSockets: 4 }),
  armor("armor", { id: "ancient_armor", name: "古代盔甲", qlvl: 40, defMin: 218, defMax: 233, reqStr: 100, maxSockets: 4 }),

  armor("shield", { id: "buckler", name: "小圆盾", qlvl: 1, defMin: 4, defMax: 6, maxSockets: 1 }),
  armor("shield", { id: "small_shield", name: "小盾", qlvl: 5, defMin: 8, defMax: 10, reqStr: 22, maxSockets: 2 }),
  armor("shield", { id: "large_shield", name: "大盾", qlvl: 11, defMin: 12, defMax: 14, reqStr: 34, maxSockets: 3 }),
  armor("shield", { id: "kite_shield", name: "鸢盾", qlvl: 15, defMin: 16, defMax: 18, reqStr: 47, maxSockets: 3 }),
  armor("shield", { id: "tower_shield", name: "塔盾", qlvl: 22, defMin: 22, defMax: 25, reqStr: 75, maxSockets: 3 }),
  armor("shield", { id: "gothic_shield", name: "哥特盾", qlvl: 30, defMin: 30, defMax: 35, reqStr: 60, maxSockets: 3 }),
  armor("shield", { id: "bone_shield", name: "骨盾", qlvl: 19, defMin: 10, defMax: 30, reqStr: 25, maxSockets: 2 }),

  armor("gloves", { id: "leather_gloves", name: "皮手套", qlvl: 3, defMin: 2, defMax: 3 }),
  armor("gloves", { id: "heavy_gloves", name: "重手套", qlvl: 7, defMin: 5, defMax: 6 }),
  armor("gloves", { id: "chain_gloves", name: "锁链手套", qlvl: 12, defMin: 8, defMax: 9, reqStr: 25 }),
  armor("gloves", { id: "light_gauntlets", name: "轻铁手套", qlvl: 20, defMin: 9, defMax: 11, reqStr: 45 }),
  armor("gloves", { id: "gauntlets", name: "铁手套", qlvl: 27, defMin: 12, defMax: 15, reqStr: 60 }),

  armor("boots", { id: "boots", name: "皮靴", qlvl: 3, defMin: 2, defMax: 3 }),
  armor("boots", { id: "heavy_boots", name: "重靴", qlvl: 7, defMin: 5, defMax: 6, reqStr: 18 }),
  armor("boots", { id: "chain_boots", name: "锁链靴", qlvl: 12, defMin: 8, defMax: 9, reqStr: 30 }),
  armor("boots", { id: "light_plated_boots", name: "轻板靴", qlvl: 20, defMin: 9, defMax: 11, reqStr: 50 }),
  armor("boots", { id: "greaves", name: "护胫", qlvl: 27, defMin: 12, defMax: 15, reqStr: 70 }),

  armor("belt", { id: "sash", name: "腰带", qlvl: 3, defMin: 2, defMax: 3 }),
  armor("belt", { id: "light_belt", name: "轻腰带", qlvl: 7, defMin: 3, defMax: 5 }),
  armor("belt", { id: "belt", name: "皮带", qlvl: 12, defMin: 5, defMax: 7, reqStr: 25 }),
  armor("belt", { id: "heavy_belt", name: "重腰带", qlvl: 20, defMin: 6, defMax: 8, reqStr: 45 }),
  armor("belt", { id: "plated_belt", name: "板带", qlvl: 27, defMin: 8, defMax: 11, reqStr: 60 }),

  armor("ring", { id: "ring", name: "戒指", qlvl: 1, maxSockets: 0 }),
  armor("amulet", { id: "amulet", name: "项链", qlvl: 1, maxSockets: 0 }),
];

export const BASE_BY_ID: Record<string, ItemBase> = Object.fromEntries(
  BASES.map((base) => [base.id, base]),
);

export function getBase(id: string): ItemBase {
  const base = BASE_BY_ID[id];
  if (!base) throw new Error(`Unknown item base: ${id}`);
  return base;
}

export function basesForKind(kind: ItemKind, ilvl: number): ItemBase[] {
  return BASES.filter((base) => base.kind === kind && base.qlvl <= Math.max(1, ilvl));
}

export function isWeaponBase(base: ItemBase): boolean {
  return base.kind === "weapon";
}

export function isArmorLike(base: ItemBase): boolean {
  return base.defMin !== undefined && base.defMax !== undefined;
}
