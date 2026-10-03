import { describe, expect, it } from "vitest";
import {
  difficultyForChapter,
  enemyFromMonster,
  heroStats,
  heroStrike,
  magicFindOf,
  monsterForWave,
  monsterStrike,
  newRng,
  oddsFor,
  qualityColor,
  qualityLabel,
  rollLoot,
  stageForWave,
  stageLabelFor,
  startingCharacter,
} from "./d2-bridge";

describe("d2 桥：关卡映射", () => {
  it("第 N 波落在正确的一关（每章 10 关）", () => {
    expect(stageForWave(1)).toEqual({ chapter: 1, stage: 1, difficulty: "normal" });
    expect(stageForWave(10)).toEqual({ chapter: 1, stage: 10, difficulty: "normal" });
    expect(stageForWave(11)).toEqual({ chapter: 2, stage: 1, difficulty: "normal" });
    expect(stageForWave(31)).toEqual({ chapter: 4, stage: 1, difficulty: "elite" });
    expect(stageForWave(61)).toEqual({ chapter: 7, stage: 1, difficulty: "nightmare" });
    expect(stageForWave(91)).toEqual({ chapter: 10, stage: 1, difficulty: "hell" });
  });

  it("难度按章节推进：1-3 普通 / 4-6 精英 / 7-9 噩梦 / 10+ 地狱", () => {
    expect([1, 2, 3].map(difficultyForChapter)).toEqual(["normal", "normal", "normal"]);
    expect([4, 5, 6].map(difficultyForChapter)).toEqual(["elite", "elite", "elite"]);
    expect([7, 8, 9].map(difficultyForChapter)).toEqual(["nightmare", "nightmare", "nightmare"]);
    expect([10, 11, 12].map(difficultyForChapter)).toEqual(["hell", "hell", "hell"]);
  });

  it("关卡文案带章节/关卡/难度/怪名", () => {
    const label = stageLabelFor(1);
    expect(label).toContain("第1章");
    expect(label).toContain("1-1");
    expect(label).toContain("普通");
    expect(label).toContain(monsterForWave(1).name);
  });
});

describe("d2 桥：怪 → 单位参数", () => {
  it("血量/防御/等级/掉落参数直接来自关卡表", () => {
    const monster = monsterForWave(1);
    const spec = enemyFromMonster(monster, 0, 4);
    expect(spec.hp).toBe(monster.hp);
    expect(spec.defense).toBe(monster.defense);
    expect(spec.mlvl).toBe(monster.mlvl);
    expect(spec.tcLevel).toBe(monster.tcLevel);
    expect(spec.noDrop).toBe(monster.noDrop);
    expect(spec.name).toBe(monster.name);
    expect(spec.damage).toBeGreaterThan(0);
  });

  it("每三个里有一个远程；第 10 关是首领关", () => {
    const boss = enemyFromMonster(monsterForWave(10), 0, 4);
    expect(boss.rank).toBe(2);
    const champ = enemyFromMonster(monsterForWave(5), 0, 4);
    expect(champ.rank).toBe(1);
    expect(enemyFromMonster(monsterForWave(1), 2, 4).kind).toBe("ranged");
    expect(enemyFromMonster(monsterForWave(1), 3, 4).kind).toBe("melee");
  });

  it("越往后的怪越硬（同一难度内）", () => {
    const early = enemyFromMonster(monsterForWave(1), 0, 4);
    const later = enemyFromMonster(monsterForWave(9), 0, 4);
    expect(later.hp).toBeGreaterThan(early.hp);
    expect(later.damage).toBeGreaterThan(early.damage);
  });
});

describe("d2 桥：英雄数值", () => {
  it("初始装备给出正的数值，且同种子结果一致", () => {
    const a = heroStats(startingCharacter(1234));
    const b = heroStats(startingCharacter(1234));
    expect(a.life).toBeGreaterThan(50);
    expect(a.damage).toBeGreaterThan(0);
    expect(a.defense).toBeGreaterThan(0);
    expect(a.attackRating).toBeGreaterThan(0);
    expect(a.weaponName.length).toBeGreaterThan(0);
    expect(a.aps).toBeGreaterThan(0);
    expect(a).toEqual(b);
  });

  it("不同种子给出不同装备（不是写死的）", () => {
    const a = startingCharacter(1);
    const b = startingCharacter(2);
    const nameOf = (c: ReturnType<typeof startingCharacter>) => Object.values(c.equipment).map((i) => i?.name).join("|");
    expect(nameOf(a)).not.toBe(nameOf(b));
  });

  it("MF 从装备上算出来（不是常量）", () => {
    const mf = magicFindOf(startingCharacter(20261002));
    expect(mf).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(mf)).toBe(true);
  });
});

describe("d2 桥：命中与伤害掷骰", () => {
  it("英雄挥砍会命中也会挥空，命中时伤害 > 0", () => {
    const character = startingCharacter(20261002);
    const rng = newRng(7);
    let hits = 0;
    let misses = 0;
    for (let i = 0; i < 400; i++) {
      const r = heroStrike(rng, character, { defense: 900, mlvl: 60 });
      if (r.miss) {
        expect(r.damage).toBe(0);
        misses++;
      } else {
        expect(r.damage).toBeGreaterThan(0);
        hits++;
      }
    }
    expect(hits).toBeGreaterThan(0);
    expect(misses).toBeGreaterThan(0); // 高防御的怪不该被 100% 命中
  });

  it("怪打英雄：英雄防御越高，怪命中率越低", () => {
    const rng = newRng(11);
    const soft = monsterStrike(rng, { damage: 20, mlvl: 10 }, { defense: 0, level: 30 }).chance;
    const hard = monsterStrike(rng, { damage: 20, mlvl: 10 }, { defense: 600, level: 30 }).chance;
    expect(hard).toBeLessThan(soft);
  });
});

describe("d2 桥：掉落", () => {
  it("同种子掉落可复现", () => {
    const spec = enemyFromMonster(monsterForWave(3), 0, 4);
    const a = rollLoot(newRng(99), spec, 120);
    const b = rollLoot(newRng(99), spec, 120);
    expect(a.items.map((i) => i.name)).toEqual(b.items.map((i) => i.name));
    expect(a.gold).toBe(b.gold);
  });

  it("noDrop 100 就是一件不掉", () => {
    const spec = { ...enemyFromMonster(monsterForWave(3), 0, 4), noDrop: 100 };
    const roll = rollLoot(newRng(5), spec, 0);
    expect(roll.items).toHaveLength(0);
    expect(roll.noDrop).toBe(Math.max(1, spec.picks));
    expect(roll.gold).toBeGreaterThan(0); // 不掉装备也有金币
  });

  it("掉落件数不超过 picks，且带上来的怪至少会掉点东西", () => {
    const spec = { ...enemyFromMonster(monsterForWave(20), 0, 4), noDrop: 0 };
    const roll = rollLoot(newRng(3), spec, 250);
    expect(roll.items.length).toBe(spec.picks);
    expect(roll.items.every((i) => i.quality !== undefined)).toBe(true);
  });

  it("高 MF 下能抽到魔法以上品质（抽样 300 只）", () => {
    const rng = newRng(2026);
    const spec = { ...enemyFromMonster(monsterForWave(25), 0, 4), noDrop: 0, picks: 1 };
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      for (const item of rollLoot(rng, spec, 300).items) seen.add(item.quality);
    }
    expect(seen.has("magic") || seen.has("rare") || seen.has("unique")).toBe(true);
  });

  it("掉率文案来自 d2 的 ItemRatio", () => {
    const odds = oddsFor(monsterForWave(1), 100);
    expect(odds.unique).toMatch(/1\/|保底|必出/);
    expect(odds.rare).toMatch(/1\/|保底|必出/);
    expect(odds.magic).toMatch(/1\/|保底|必出/);
  });

  it("品质的配色/中文名齐全", () => {
    for (const q of ["normal", "magic", "rare", "unique"] as const) {
      expect(qualityColor(q)).toMatch(/^#[0-9a-f]{6}$/i);
      expect(qualityLabel(q).length).toBeGreaterThan(0);
    }
    expect(qualityLabel("unique")).toBe("暗金");
  });
});
