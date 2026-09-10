import { affixesFor } from "./affixes";
import { BASES, getBase, isArmorLike } from "./bases";
import { magicName, rareName } from "./naming";
import { chance, makeId, randInt, type Rng, weightedPick } from "./rng";
import { kindMatchesSlot, type SlotId } from "./slots";
import type {
  AffixDef,
  AffixKind,
  Item,
  ItemBase,
  ItemKind,
  Quality,
  RolledAffix,
} from "./types";
import { UNIQUES, uniquesForBase } from "./uniques";

export type GenerateOptions = {
  rng: Rng;
  ilvl: number;
  magicFind?: number;
  kind?: ItemKind;
  slot?: SlotId;
  quality?: Quality;
  baseId?: string;
  identified?: boolean;
  seed: number;
};

function effectiveMf(mf: number, diminishing: number): number {
  if (mf <= 0) return 0;
  return (mf * diminishing) / (mf + diminishing);
}

/**
 * D2-style diminishing MF, then a workshop-friendly quality table.
 * Unique that cannot spawn on the chosen base falls through to rare.
 */
export function rollQuality(rng: Rng, mf: number): Quality {
  const uniqueMf = effectiveMf(mf, 250);
  const rareMf = effectiveMf(mf, 500);
  const uniqueChance = 2 * ((100 + uniqueMf) / 100);
  const rareChance = 12 * ((100 + rareMf) / 100);
  const magicChance = 50;
  const roll = rng() * 100;
  if (roll < uniqueChance) return "unique";
  if (roll < uniqueChance + rareChance) return "rare";
  if (roll < uniqueChance + rareChance + magicChance) return "magic";
  return "normal";
}

function pickBase(rng: Rng, ilvl: number, kind?: ItemKind, baseId?: string): ItemBase {
  if (baseId) return getBase(baseId);
  const pool = BASES.filter((base) => {
    if (base.qlvl > ilvl) return false;
    if (kind && base.kind !== kind) return false;
    return true;
  });
  if (pool.length === 0) {
    const fallback = BASES.filter((base) => !kind || base.kind === kind);
    return weightedPick(rng, fallback, (base) => Math.max(1, 40 - base.qlvl));
  }
  return weightedPick(rng, pool, (base) => {
    const distance = Math.abs(ilvl - base.qlvl);
    return Math.max(1, 24 - distance);
  });
}

function rollMods(def: AffixDef, rng: Rng): RolledAffix {
  return {
    id: def.id,
    kind: def.kind,
    name: def.name,
    group: def.group,
    mods: def.mods.map((mod) => ({
      stat: mod.stat,
      min: mod.min,
      max: mod.max,
      value: randInt(rng, mod.min, mod.max),
    })),
  };
}

function pickAffix(
  rng: Rng,
  kind: AffixKind,
  base: ItemBase,
  ilvl: number,
  usedGroups: Set<string>,
): AffixDef | null {
  const pool = affixesFor(kind, base, ilvl, usedGroups);
  if (pool.length === 0) return null;
  return weightedPick(rng, pool, (affix) => affix.freq * (1 + affix.level / 10));
}

function rollMagicAffixes(rng: Rng, base: ItemBase, ilvl: number): RolledAffix[] {
  const used = new Set<string>();
  const mode = rng();
  const wantPrefix = mode < 0.4 || mode >= 0.8;
  const wantSuffix = mode >= 0.4;
  const rolled: RolledAffix[] = [];
  if (wantPrefix) {
    const def = pickAffix(rng, "prefix", base, ilvl, used);
    if (def) {
      used.add(def.group);
      rolled.push(rollMods(def, rng));
    }
  }
  if (wantSuffix) {
    const def = pickAffix(rng, "suffix", base, ilvl, used);
    if (def) {
      used.add(def.group);
      rolled.push(rollMods(def, rng));
    }
  }
  return rolled;
}

function rollRareAffixes(rng: Rng, base: ItemBase, ilvl: number): RolledAffix[] {
  const used = new Set<string>();
  let prefixes = 1;
  let suffixes = 1;
  const extras = randInt(rng, 1, 4);
  for (let i = 0; i < extras; i++) {
    if (prefixes >= 3) suffixes += 1;
    else if (suffixes >= 3) prefixes += 1;
    else if (rng() < 0.5) prefixes += 1;
    else suffixes += 1;
  }
  const rolled: RolledAffix[] = [];
  for (let i = 0; i < prefixes; i++) {
    const def = pickAffix(rng, "prefix", base, ilvl, used);
    if (!def) break;
    used.add(def.group);
    rolled.push(rollMods(def, rng));
  }
  for (let i = 0; i < suffixes; i++) {
    const def = pickAffix(rng, "suffix", base, ilvl, used);
    if (!def) break;
    used.add(def.group);
    rolled.push(rollMods(def, rng));
  }
  return rolled;
}

function rollDefense(rng: Rng, base: ItemBase, ethereal: boolean): number {
  if (!isArmorLike(base) || base.defMin === undefined || base.defMax === undefined) return 0;
  const raw = randInt(rng, base.defMin, base.defMax);
  return ethereal ? Math.floor((raw * 150) / 100) : raw;
}

function rollSockets(rng: Rng, base: ItemBase, quality: Quality): number {
  if (base.maxSockets <= 0) return 0;
  if (quality === "unique") return 0;
  if (quality === "normal") return chance(rng, 30) ? randInt(rng, 1, base.maxSockets) : 0;
  if (quality === "magic") return chance(rng, 20) ? randInt(rng, 1, Math.min(2, base.maxSockets)) : 0;
  if (quality === "rare") return chance(rng, 12) ? 1 : 0;
  return 0;
}

function rollEthereal(rng: Rng, base: ItemBase, quality: Quality): boolean {
  if (base.kind === "ring" || base.kind === "amulet") return false;
  if (quality === "unique") return false;
  return chance(rng, 5);
}

export function generateItem(options: GenerateOptions): Item {
  const { rng, seed } = options;
  const ilvl = Math.max(1, Math.min(99, Math.floor(options.ilvl)));
  const kind = options.kind ?? (options.slot ? kindFromSlot(options.slot) : undefined);
  const base = pickBase(rng, ilvl, kind, options.baseId);
  let quality = options.quality ?? rollQuality(rng, options.magicFind ?? 0);
  const ethereal = rollEthereal(rng, base, quality);
  let affixes: RolledAffix[] = [];
  let name = base.name;
  let uniqueId: string | undefined;

  if (quality === "unique") {
    const pool = uniquesForBase(base.id, ilvl);
    if (pool.length === 0) {
      quality = "rare";
    } else {
      const unique = weightedPick(rng, pool, (item) => item.qlvl);
      uniqueId = unique.id;
      name = unique.name;
      affixes = [
        {
          id: unique.id,
          kind: "prefix",
          name: unique.name,
          group: `unique:${unique.id}`,
          mods: unique.mods
            .filter((mod) => typeof mod.stat === "string")
            .map((mod) => ({
              stat: mod.stat,
              min: mod.min,
              max: mod.max,
              value: randInt(rng, mod.min, mod.max),
            })),
        },
      ];
    }
  }

  if (quality === "magic") {
    affixes = rollMagicAffixes(rng, base, ilvl);
    name = magicName(base.name, affixes);
  } else if (quality === "rare") {
    affixes = rollRareAffixes(rng, base, ilvl);
    name = rareName(base.kind, rng);
  }

  return {
    id: makeId(rng),
    baseId: base.id,
    quality,
    name,
    identified: options.identified ?? true,
    ethereal,
    ilvl,
    sockets: rollSockets(rng, base, quality),
    defense: rollDefense(rng, base, ethereal),
    affixes,
    uniqueId,
    seed,
  };
}

function kindFromSlot(slot: SlotId): ItemKind | undefined {
  switch (slot) {
    case "helm":
    case "armor":
    case "belt":
    case "gloves":
    case "boots":
    case "amulet":
      return slot;
    case "ringLeft":
    case "ringRight":
      return "ring";
    case "mainHand":
      return "weapon";
    case "offHand":
      return undefined;
  }
}

export function generateForSlot(options: GenerateOptions): Item {
  const slot = options.slot;
  if (!slot) return generateItem(options);
  if (slot === "offHand") {
    const asShield = options.rng() < 0.65;
    return generateItem({ ...options, kind: asShield ? "shield" : "weapon" });
  }
  if (slot === "ringLeft" || slot === "ringRight") {
    return generateItem({ ...options, kind: "ring" });
  }
  if (slot === "mainHand") return generateItem({ ...options, kind: "weapon" });
  return generateItem({ ...options, kind: slot as ItemKind });
}

export function generateStash(options: Omit<GenerateOptions, "slot" | "kind"> & { count: number }): Item[] {
  const items: Item[] = [];
  for (let i = 0; i < options.count; i++) {
    items.push(generateItem(options));
  }
  return items;
}

export function itemFitsSlot(item: Item, slot: SlotId): boolean {
  const base = getBase(item.baseId);
  return kindMatchesSlot(base.kind, slot);
}

export { UNIQUES };
