import { getBase } from "./bases";
import { itemFitsSlot } from "./generate";
import { SLOT_BY_ID, type SlotId } from "./slots";
import { totalAttributes } from "./stats";
import type { Character, Equipment, Item } from "./types";

export function createCharacter(): Character {
  return {
    name: "佣兵",
    level: 30,
    base: { str: 80, dex: 50, vit: 40, nrg: 15 },
    equipment: {},
  };
}

export type EquipFail = { ok: false; reason: string };
export type EquipOk = { ok: true; equipment: Equipment; replaced: Item[] };
export type EquipResult = EquipFail | EquipOk;

export function canWear(item: Item, character: Character): { ok: true } | EquipFail {
  const base = getBase(item.baseId);
  const attrs = totalAttributes({ ...character, equipment: withoutItem(character.equipment, item.id) });
  if (character.level < base.reqLevel) {
    return { ok: false, reason: `需要等级 ${base.reqLevel}` };
  }
  if (attrs.str < base.reqStr) {
    return { ok: false, reason: `需要力量 ${base.reqStr}` };
  }
  if (attrs.dex < base.reqDex) {
    return { ok: false, reason: `需要敏捷 ${base.reqDex}` };
  }
  return { ok: true };
}

function withoutItem(equipment: Equipment, itemId: string): Equipment {
  const next: Equipment = { ...equipment };
  for (const slot of Object.keys(next) as (keyof Equipment)[]) {
    if (next[slot]?.id === itemId) delete next[slot];
  }
  return next;
}

export function equipItem(character: Character, item: Item, slot: SlotId): EquipResult {
  if (!itemFitsSlot(item, slot)) {
    return { ok: false, reason: `${SLOT_BY_ID[slot].name}不能放这件` };
  }
  const wear = canWear(item, character);
  if (!wear.ok) return wear;

  const base = getBase(item.baseId);
  const next: Equipment = { ...character.equipment };
  const replaced: Item[] = [];

  if (next[slot]) replaced.push(next[slot]);

  if (base.kind === "weapon" && base.twoHanded) {
    if (slot !== "mainHand") {
      return { ok: false, reason: "双手武器只能放主手" };
    }
    if (next.offHand) replaced.push(next.offHand);
    delete next.offHand;
  }

  if (slot === "offHand") {
    const main = next.mainHand;
    if (main && getBase(main.baseId).twoHanded) {
      return { ok: false, reason: "双手武器占用副手" };
    }
    if (base.kind === "weapon" && main && getBase(main.baseId).kind !== "weapon") {
      return { ok: false, reason: "副手武器需要主手已装备武器" };
    }
  }

  for (const key of Object.keys(next) as (keyof Equipment)[]) {
    if (next[key]?.id === item.id) delete next[key];
  }

  next[slot] = item;
  return { ok: true, equipment: next, replaced };
}

export function unequip(character: Character, slot: SlotId): { equipment: Equipment; item: Item | null } {
  const item = character.equipment[slot] ?? null;
  const equipment = { ...character.equipment };
  delete equipment[slot];
  return { equipment, item };
}

export function offHandBlocked(character: Character): boolean {
  const main = character.equipment.mainHand;
  return Boolean(main && getBase(main.baseId).twoHanded);
}
