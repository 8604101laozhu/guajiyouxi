import type { ItemKind, SlotId } from "./types";
import { SLOT_IDS } from "./types";

export type SlotDef = {
  id: SlotId;
  name: string;
  short: string;
  kinds: ItemKind[];
};

/** 暗黑 2 人物界面十个穿着部位。戒指分左右，主副手分开。 */
export const SLOTS: SlotDef[] = [
  { id: "helm", name: "头盔", short: "头", kinds: ["helm"] },
  { id: "armor", name: "盔甲", short: "甲", kinds: ["armor"] },
  { id: "belt", name: "腰带", short: "腰", kinds: ["belt"] },
  { id: "gloves", name: "手套", short: "手", kinds: ["gloves"] },
  { id: "boots", name: "靴子", short: "靴", kinds: ["boots"] },
  { id: "amulet", name: "项链", short: "链", kinds: ["amulet"] },
  { id: "ringLeft", name: "左戒指", short: "戒", kinds: ["ring"] },
  { id: "ringRight", name: "右戒指", short: "戒", kinds: ["ring"] },
  { id: "mainHand", name: "主手", short: "主", kinds: ["weapon"] },
  { id: "offHand", name: "副手", short: "副", kinds: ["shield", "weapon"] },
];

export const SLOT_BY_ID: Record<SlotId, SlotDef> = Object.fromEntries(
  SLOTS.map((slot) => [slot.id, slot]),
) as Record<SlotId, SlotDef>;

export const PAPER_DOLL: SlotId[][] = [
  ["mainHand", "helm", "offHand"],
  ["gloves", "armor", "boots"],
  ["ringLeft", "belt", "ringRight"],
  ["amulet"],
];

export function slotLabel(id: SlotId): string {
  return SLOT_BY_ID[id].name;
}

export function kindMatchesSlot(kind: ItemKind, slot: SlotId): boolean {
  return SLOT_BY_ID[slot].kinds.includes(kind);
}

export function defaultSlotForKind(kind: ItemKind): SlotId {
  switch (kind) {
    case "helm":
      return "helm";
    case "armor":
      return "armor";
    case "belt":
      return "belt";
    case "gloves":
      return "gloves";
    case "boots":
      return "boots";
    case "amulet":
      return "amulet";
    case "ring":
      return "ringLeft";
    case "weapon":
      return "mainHand";
    case "shield":
      return "offHand";
  }
}

export { SLOT_IDS };
export type { SlotId };
