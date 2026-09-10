import { getBase, isArmorLike } from "./bases";
import { STAT_IDS, type Character, type Item, type StatBag, type StatId } from "./types";

export function emptyStats(): StatBag {
  const bag = {} as StatBag;
  for (const id of STAT_IDS) bag[id] = 0;
  return bag;
}

export function addStat(bag: StatBag, stat: StatId, value: number): void {
  bag[stat] += value;
}

export function collectItemMods(item: Item): StatBag {
  const bag = emptyStats();
  for (const affix of item.affixes) {
    for (const mod of affix.mods) {
      if (!STAT_IDS.includes(mod.stat)) continue;
      addStat(bag, mod.stat, mod.value);
    }
  }
  return bag;
}

export function sumEquipment(items: Item[]): StatBag {
  const bag = emptyStats();
  for (const item of items) {
    const mods = collectItemMods(item);
    for (const id of STAT_IDS) bag[id] += mods[id];
  }
  return bag;
}

export function equippedList(character: Character): Item[] {
  return Object.values(character.equipment).filter((item): item is Item => Boolean(item));
}

export function totalAttributes(character: Character): {
  str: number;
  dex: number;
  vit: number;
  nrg: number;
  stats: StatBag;
} {
  const stats = sumEquipment(equippedList(character));
  return {
    str: character.base.str + stats.strength,
    dex: character.base.dex + stats.dexterity,
    vit: character.base.vit + stats.vitality,
    nrg: character.base.nrg + stats.energy,
    stats,
  };
}

export function armorDefense(item: Item): number {
  const base = getBase(item.baseId);
  if (!isArmorLike(base)) return 0;
  const mods = collectItemMods(item);
  return Math.floor((item.defense * (100 + mods.enhancedDefense)) / 100) + mods.defense;
}

export function characterDefense(character: Character): number {
  const { dex, stats } = totalAttributes(character);
  const fromItems = equippedList(character).reduce((sum, item) => sum + armorDefense(item), 0);
  return Math.floor(dex / 4) + fromItems + stats.defense;
}

export function characterAttackRating(character: Character): number {
  const { dex, stats } = totalAttributes(character);
  const raw = dex * 5 - 7 + stats.attackRating;
  return Math.max(0, Math.floor((raw * (100 + stats.attackRatingPercent)) / 100));
}

export function characterLife(character: Character): number {
  const { vit, stats } = totalAttributes(character);
  return 40 + character.level * 2 + vit * 3 + stats.life;
}

export function characterMana(character: Character): number {
  const { nrg, stats } = totalAttributes(character);
  return 15 + character.level + nrg * 2 + stats.mana;
}

export function resistTotal(stats: StatBag, single: StatId): number {
  return Math.min(75, stats.allRes + stats[single]);
}
