import { describe, expect, it } from "vitest";
import { getStage } from "./campaign";
import { farmStage } from "./farm";
import { generateItem } from "./generate";
import { magicChance, rareChance, uniqueChance } from "./quality";
import { mulberry32 } from "./rng";
import { createCharacter } from "./character";
import { combatPower } from "./farm";

describe("D2 quality chances", () => {
  it("unique chance at mlvl=qlvl is (400)*128", () => {
    expect(uniqueChance({ mlvl: 1, qlvl: 1, magicFind: 0 })).toBe(51200);
  });

  it("higher mlvl vs low qlvl improves unique odds (lower chance number)", () => {
    expect(uniqueChance({ mlvl: 40, qlvl: 1, magicFind: 0 })).toBeLessThan(
      uniqueChance({ mlvl: 1, qlvl: 1, magicFind: 0 }),
    );
  });

  it("MF 250 unique is diminished to 125 and beats 0 MF", () => {
    const none = uniqueChance({ mlvl: 30, qlvl: 20, magicFind: 0 });
    const stacked = uniqueChance({ mlvl: 30, qlvl: 20, magicFind: 250 });
    expect(stacked).toBeLessThan(none);
    expect(stacked).toBeGreaterThan(uniqueChance({ mlvl: 30, qlvl: 20, magicFind: 9999 }));
  });

  it("magic items use full MF with no diminishing cap", () => {
    const zero = magicChance({ mlvl: 20, qlvl: 10, magicFind: 0 });
    const hundred = magicChance({ mlvl: 20, qlvl: 10, magicFind: 100 });
    expect(hundred).toBe(Math.floor((zero * 100) / 200));
  });

  it("uber row makes rare and magic easier than the normal row", () => {
    const input = { mlvl: 40, qlvl: 24, magicFind: 0 };
    expect(rareChance({ ...input, uber: true })).toBeLessThan(rareChance(input));
    expect(magicChance({ ...input, uber: true })).toBeLessThan(magicChance(input));
  });

  it("never goes below UniqueMin 6400 before MF", () => {
    expect(uniqueChance({ mlvl: 99, qlvl: 1, magicFind: 0 })).toBeGreaterThanOrEqual(6400);
  });
});

describe("mobile difficulty gradient", () => {
  it("hell boss is far tankier than normal minion in the same chapter", () => {
    const normal = getStage(3, 1, "normal");
    const hellBoss = getStage(3, 10, "hell");
    expect(hellBoss.hp).toBeGreaterThan(normal.hp * 20);
    expect(hellBoss.picks).toBeGreaterThan(normal.picks);
    expect(hellBoss.mlvl).toBeGreaterThan(normal.mlvl);
    expect(hellBoss.uber).toBe(true);
    expect(hellBoss.noDrop).toBeLessThan(normal.noDrop);
  });

  it("later chapters raise treasure class", () => {
    expect(getStage(12, 1, "normal").tcLevel).toBeGreaterThan(getStage(1, 1, "normal").tcLevel);
  });

  it("underpowered runs fail without loot", () => {
    const result = farmStage({
      rng: mulberry32(1),
      seed: 1,
      chapter: 12,
      stage: 10,
      difficulty: "hell",
      magicFind: 0,
      power: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.items).toHaveLength(0);
    expect(result.gold).toBe(0);
  });

  it("crushing chapter 1 still uses D2 quality instead of forcing rares", () => {
    const hero = createCharacter();
    const power = Math.max(combatPower(hero), getStage(1, 1, "normal").recommendedPower * 2);
    const result = farmStage({
      rng: mulberry32(9),
      seed: 9,
      chapter: 1,
      stage: 1,
      difficulty: "normal",
      magicFind: 0,
      power,
    });
    expect(result.ok).toBe(true);
    expect(result.picks).toBeGreaterThanOrEqual(1);
    for (const item of result.items) {
      expect(["normal", "magic", "rare", "unique"]).toContain(item.quality);
    }
  });
});

describe("treasure class generation", () => {
  it("ilvl-gated bases stay at or below the TC cap", () => {
    const item = generateItem({
      rng: mulberry32(12),
      ilvl: 9,
      mlvl: 8,
      seed: 12,
    });
    expect(item.ilvl).toBe(9);
  });
});
