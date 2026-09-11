import { getBase } from "./bases";
import { pick, type Rng } from "./rng";
import type { Item, ItemKind, RolledAffix } from "./types";

const RARE_WORDS: Record<ItemKind, { a: string[]; b: string[] }> = {
  helm: {
    a: ["残酷", "死亡", "鹰隼", "毒牙", "恶魔", "食尸", "恐怖", "憎恶", "疫病", "怒火", "暗影", "骷髅", "灵魂", "风暴", "怨灵"],
    b: ["面甲", "头冠", "头巾", "角盔", "面罩", "护额", "护盔", "兜帽", "帷帽", "之眼"],
  },
  armor: {
    a: ["野兽", "血污", "碎骨", "黑暗", "龙鳞", "命运", "墓穴", "浩劫", "风暴", "灵魂", "荆棘", "墓碑", "毒液", "战神"],
    b: ["甲胄", "护胸", "罩衣", "披挂", "外壳", "护心", "结扣", "肩甲", "战衣", "遮护"],
  },
  belt: {
    a: ["咬噬", "血环", "暗影", "铁绞", "风暴", "荆棘", "墓穴", "怒火"],
    b: ["束带", "束腰", "绞索", "环扣", "腰带", "缠绕", "束结", "腰封"],
  },
  gloves: {
    a: ["血污", "碎骨", "钢铁", "风暴", "灵魂", "荆棘", "墓穴", "怒火"],
    b: ["之握", "之爪", "指节", "拳套", "之触", "抓握", "拳锋", "拳套"],
  },
  boots: {
    a: ["血污", "疾风", "暗影", "墓穴", "风暴", "灵魂", "疾行", "战神"],
    b: ["足迹", "之踏", "靴刺", "行者", "足印", "足靴", "行军", "之步"],
  },
  amulet: {
    a: ["野兽", "血咒", "碎骨", "龙息", "命运", "墓穴", "风暴", "灵魂", "荆棘", "怨灵"],
    b: ["项圈", "垂饰", "之眼", "心核", "结扣", "星坠", "之喉", "咒印", "吊坠", "之翼"],
  },
  ring: {
    a: ["咬噬", "骨环", "血环", "鹰眼", "毒牙", "恶魔", "恐怖", "疫病", "怒火", "暗影", "骷髅", "风暴"],
    b: ["指环", "环扣", "指节", "之握", "轮回", "之眼", "指箍", "指套", "轮圈", "指戒"],
  },
  weapon: {
    a: ["咬噬", "碎骨", "血刃", "黑暗", "鹰隼", "毒牙", "恶魔", "食尸", "恐怖", "憎恶", "疫病", "怒火", "符文", "暗影", "骷髅", "灵魂", "风暴", "污秽", "怨灵"],
    b: ["之咬", "之眉", "之爪", "之牙", "收割", "克星", "克星者", "撕裂", "之刺", "劈砍", "之刃", "斩击", "穿刺", "挥砍", "之嚎"],
  },
  shield: {
    a: ["野兽", "血污", "碎骨", "黑暗", "龙鳞", "命运", "墓穴", "浩劫", "风暴", "灵魂", "荆棘", "墓碑"],
    b: ["屏障", "守护", "盾面", "墙垣", "壁垒", "罩盾", "防壁", "盾牌", "格挡", "盾徽"],
  },
};

export function rareName(kind: ItemKind, rng: Rng): string {
  const table = RARE_WORDS[kind];
  const a = pick(rng, table.a);
  let b = pick(rng, table.b);
  let guard = 0;
  while (a === b && guard++ < 8) {
    b = pick(rng, table.b);
  }
  return `${a}${b}`;
}

export function magicName(baseName: string, affixes: RolledAffix[]): string {
  const prefix = affixes.find((affix) => affix.kind === "prefix");
  const suffix = affixes.find((affix) => affix.kind === "suffix");
  if (prefix && suffix) return `${prefix.name}${baseName}之${suffix.name}`;
  if (prefix) return `${prefix.name}${baseName}`;
  if (suffix) return `${baseName}之${suffix.name}`;
  return baseName;
}

export function displayName(item: Item): string {
  return item.name;
}

export function baseLine(item: Item): string | null {
  if (item.quality === "normal" || item.quality === "magic") return null;
  return getBase(item.baseId).name;
}
