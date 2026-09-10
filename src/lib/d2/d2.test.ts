import { describe, expect, it } from "vitest";
import { canSpawnOn } from "./affixes";
import { getBase } from "./bases";
import { createCharacter, equipItem, offHandBlocked } from "./character";
import { attackFrames, chanceToHit, rollPacket, weaponDamageInputs } from "./damage";
import { generateItem } from "./generate";
import { magicName, rareName } from "./naming";
import { mulberry32 } from "./rng";
import { collectItemMods } from "./stats";
import type { Item, RolledAffix } from "./types";

function affix(partial: Partial<RolledAffix> & Pick<RolledAffix, "mods">): RolledAffix {
  return {
    id: "t",
    kind: "prefix",
    name: "测",
    group: "g",
    ...partial,
  };
}

function weapon(over: Partial<Item> = {}): Item {
  return {
    id: "w1",
    baseId: "broad_sword",
    quality: "magic",
    name: "测试阔剑",
    identified: true,
    ethereal: false,
    ilvl: 20,
    sockets: 0,
    defense: 0,
    affixes: [],
    seed: 1,
    ...over,
  };
}

describe("physical damage formula", () => {
  it("white weapon with 0 str is base damage", () => {
    const character = createCharacter();
    character.base.str = 0;
    character.base.dex = 0;
    character.equipment.mainHand = weapon();
    const dmg = weaponDamageInputs(character);
    expect(dmg.base).toEqual({ min: 7, max: 14 });
    expect(dmg.physical).toEqual({ min: 7, max: 14 });
  });

  it("100% enhanced damage on the weapon doubles the base before plus damage", () => {
    const character = createCharacter();
    character.base.str = 0;
    character.base.dex = 0;
    character.equipment.mainHand = weapon({
      affixes: [affix({ mods: [{ stat: "enhancedDamage", value: 100, min: 100, max: 100 }] })],
    });
    const dmg = weaponDamageInputs(character);
    expect(dmg.afterWeapon).toEqual({ min: 14, max: 28 });
    expect(dmg.physical).toEqual({ min: 14, max: 28 });
  });

  it("plus max on the weapon is added after weapon ED", () => {
    const character = createCharacter();
    character.base.str = 0;
    character.equipment.mainHand = weapon({
      affixes: [
        affix({
          mods: [
            { stat: "enhancedDamage", value: 100, min: 100, max: 100 },
            { stat: "maxDamage", value: 5, min: 5, max: 5 },
          ],
        }),
      ],
    });
    const dmg = weaponDamageInputs(character);
    expect(dmg.afterWeapon.max).toBe(28 + 5);
  });

  it("100 strength is +100% off-weapon ED", () => {
    const character = createCharacter();
    character.base.str = 100;
    character.base.dex = 0;
    character.equipment.mainHand = weapon();
    const dmg = weaponDamageInputs(character);
    expect(dmg.statName).toBe("力量");
    expect(dmg.statED).toBe(100);
    expect(dmg.physical).toEqual({ min: 14, max: 28 });
  });

  it("bows scale with dexterity instead of strength", () => {
    const character = createCharacter();
    character.base.str = 0;
    character.base.dex = 50;
    character.equipment.mainHand = weapon({
      id: "bow1",
      baseId: "long_bow",
      name: "长弓",
    });
    const dmg = weaponDamageInputs(character);
    expect(dmg.statName).toBe("敏捷");
    expect(dmg.physical.min).toBe(Math.floor((3 * 150) / 100));
    expect(dmg.physical.max).toBe(Math.floor((10 * 150) / 100));
  });

  it("ring plus-max is off-weapon and does not ride weapon ED", () => {
    const character = createCharacter();
    character.base.str = 0;
    character.equipment.mainHand = weapon({
      affixes: [affix({ mods: [{ stat: "enhancedDamage", value: 100, min: 100, max: 100 }] })],
    });
    character.equipment.ringLeft = {
      id: "r1",
      baseId: "ring",
      quality: "magic",
      name: "戒指之品质",
      identified: true,
      ethereal: false,
      ilvl: 10,
      sockets: 0,
      defense: 0,
      seed: 2,
      affixes: [
        affix({
          kind: "suffix",
          name: "品质",
          mods: [{ stat: "maxDamage", value: 2, min: 2, max: 2 }],
        }),
      ],
    };
    const dmg = weaponDamageInputs(character);
    expect(dmg.plusOffWeapon.max).toBe(2);
    expect(dmg.physical.max).toBe(28 + 2);
  });

  it("ethereal weapons gain 50% base damage", () => {
    const character = createCharacter();
    character.base.str = 0;
    character.equipment.mainHand = weapon({ ethereal: true });
    const dmg = weaponDamageInputs(character);
    expect(dmg.base.min).toBe(Math.floor((7 * 150) / 100));
    expect(dmg.base.max).toBe(Math.floor((14 * 150) / 100));
  });
});

describe("hit rolls", () => {
  it("physical roll stays inside min-max", () => {
    const character = createCharacter();
    character.base.str = 0;
    character.equipment.mainHand = weapon();
    const breakdown = weaponDamageInputs(character);
    const rng = mulberry32(42);
    for (let i = 0; i < 40; i++) {
      const hit = rollPacket(rng, breakdown);
      expect(hit.physical).toBeGreaterThanOrEqual(7);
      expect(hit.physical).toBeLessThanOrEqual(14);
    }
  });

  it("clamps chance to hit between 5 and 95", () => {
    expect(chanceToHit(1, 100000, 1, 99)).toBe(5);
    expect(chanceToHit(100000, 0, 99, 1)).toBe(95);
  });

  it("IAS frames get faster but not below 4", () => {
    expect(attackFrames(12, 0)).toBeGreaterThan(attackFrames(12, 40));
    expect(attackFrames(12, 75)).toBeGreaterThanOrEqual(4);
  });
});

describe("equip rules", () => {
  it("two-handed weapons occupy the off-hand", () => {
    const character = createCharacter();
    const claymore = weapon({ id: "2h", baseId: "claymore", name: "阔身剑" });
    const shield: Item = {
      id: "s1",
      baseId: "kite_shield",
      quality: "normal",
      name: "鸢盾",
      identified: true,
      ethereal: false,
      ilvl: 15,
      sockets: 0,
      defense: 16,
      affixes: [],
      seed: 3,
    };
    const equippedShield = equipItem(character, shield, "offHand");
    expect(equippedShield.ok).toBe(true);
    if (equippedShield.ok) character.equipment = equippedShield.equipment;
    const equippedSword = equipItem(character, claymore, "mainHand");
    expect(equippedSword.ok).toBe(true);
    if (equippedSword.ok) character.equipment = equippedSword.equipment;
    expect(character.equipment.offHand).toBeUndefined();
    expect(offHandBlocked(character)).toBe(true);
  });

  it("rejects items when strength is too low", () => {
    const character = createCharacter();
    character.base.str = 10;
    const result = equipItem(character, weapon({ baseId: "war_sword" }), "mainHand");
    expect(result.ok).toBe(false);
  });
});

describe("naming and loot", () => {
  it("magic names use prefix, suffix, or both", () => {
    expect(
      magicName("阔剑", [
        affix({ kind: "prefix", name: "锯齿", mods: [] }),
        affix({ kind: "suffix", name: "品质", mods: [] }),
      ]),
    ).toBe("锯齿阔剑之品质");
    expect(magicName("阔剑", [affix({ kind: "prefix", name: "锯齿", mods: [] })])).toBe("锯齿阔剑");
    expect(magicName("阔剑", [affix({ kind: "suffix", name: "品质", mods: [] })])).toBe("阔剑之品质");
  });

  it("rare names are two-word and independent of the base", () => {
    const name = rareName("weapon", mulberry32(9));
    expect(name.length).toBeGreaterThan(2);
    expect(name).not.toBe("阔剑");
  });

  it("does not stack two affixes from the same group", () => {
    const item = generateItem({
      rng: mulberry32(77),
      ilvl: 40,
      quality: "rare",
      baseId: "war_sword",
      seed: 77,
    });
    const groups = item.affixes.map((a) => a.group);
    expect(new Set(groups).size).toBe(groups.length);
  });

  it("forced unique falls back to rare when the base has none", () => {
    const item = generateItem({
      rng: mulberry32(3),
      ilvl: 20,
      quality: "unique",
      baseId: "colossus_blade",
      seed: 3,
    });
    expect(item.quality).toBe("rare");
  });

  it("rolls affix values inside the listed range", () => {
    const item = generateItem({
      rng: mulberry32(101),
      ilvl: 35,
      quality: "rare",
      kind: "weapon",
      seed: 101,
    });
    for (const rolled of item.affixes) {
      for (const mod of rolled.mods) {
        expect(mod.value).toBeGreaterThanOrEqual(mod.min);
        expect(mod.value).toBeLessThanOrEqual(mod.max);
      }
    }
  });

  it("enhanced damage prefixes only spawn on weapons", () => {
    expect(
      canSpawnOn(
        { id: "jagged", kind: "prefix", name: "锯齿", group: "ed", level: 1, freq: 1, mods: [], kinds: ["weapon"] },
        getBase("broad_sword"),
      ),
    ).toBe(true);
    expect(
      canSpawnOn(
        { id: "jagged", kind: "prefix", name: "锯齿", group: "ed", level: 1, freq: 1, mods: [], kinds: ["weapon"] },
        getBase("ring"),
      ),
    ).toBe(false);
  });
});

describe("stat collection", () => {
  it("sums all equipped affixes", () => {
    const item = weapon({
      affixes: [
        affix({ mods: [{ stat: "strength", value: 10, min: 10, max: 10 }] }),
        affix({ kind: "suffix", mods: [{ stat: "strength", value: 5, min: 5, max: 5 }] }),
      ],
    });
    expect(collectItemMods(item).strength).toBe(15);
  });
});
