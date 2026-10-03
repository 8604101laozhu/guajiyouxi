/**
 * 药水槽：阈值、冷却、槽位顺序与边界（死人/满血/全空）。
 */
import { describe, expect, it } from "vitest";
import {
  POTION_COOLDOWN,
  POTION_SLOTS,
  POTION_THRESHOLD,
  POTION_HEAL_PCT,
  POTIONS_PER_SLOT,
  createPotions,
  potionsLeft,
  updatePotions,
  type PotionState,
} from "./potions";

const MAX_POTIONS = POTION_SLOTS * POTIONS_PER_SLOT;

describe("药水槽", () => {
  it("初始 4 槽 × 每槽 5 瓶，cd=0，drunk=0", () => {
    const s = createPotions();
    expect(s.slots).toHaveLength(POTION_SLOTS);
    expect(s.slots.every((n) => n === POTIONS_PER_SLOT)).toBe(true);
    expect(s.cd).toBe(0);
    expect(s.drunk).toBe(0);
    expect(potionsLeft(s)).toBe(MAX_POTIONS);
  });

  it("hp/maxHp 低于默认阈值时会喝一瓶", () => {
    const s = createPotions();
    const maxHp = 100;
    const hp = Math.floor(maxHp * POTION_THRESHOLD) - 1;
    const tick = updatePotions(s, 0, hp, maxHp);
    expect(tick.drank).toBe(true);
    expect(tick.slot).toBe(0);
    expect(s.slots[0]).toBe(POTIONS_PER_SLOT - 1);
    expect(s.drunk).toBe(1);
  });

  it("满血（不低于阈值）不喝", () => {
    const s = createPotions();
    const tick = updatePotions(s, 0, 100, 100);
    expect(tick).toEqual({ drank: false, heal: 0, slot: -1, empty: false });
    expect(potionsLeft(s)).toBe(MAX_POTIONS);
  });

  it("冷却中连续调用只喝一瓶", () => {
    const s = createPotions();
    const maxHp = 100;
    const hp = 30;
    const t1 = updatePotions(s, 0, hp, maxHp);
    const t2 = updatePotions(s, 0, hp, maxHp);
    expect(t1.drank).toBe(true);
    expect(t2.drank).toBe(false);
    expect(s.drunk).toBe(1);
    expect(s.cd).toBe(POTION_COOLDOWN);
  });

  it("按槽下标从小到大消耗", () => {
    const s = createPotions();
    s.slots[0] = 0;
    const tick = updatePotions(s, 0, 10, 100);
    expect(tick.drank).toBe(true);
    expect(tick.slot).toBe(1);
    expect(s.slots[1]).toBe(POTIONS_PER_SLOT - 1);
  });

  it("全空时 empty:true 且不喝", () => {
    const s: PotionState = { slots: [0, 0, 0, 0], cd: 0, drunk: 0 };
    const tick = updatePotions(s, 0, 1, 100);
    expect(tick).toEqual({ drank: false, heal: 0, slot: -1, empty: true });
  });

  it("hp<=0 不喝（复活逻辑不在本模块）", () => {
    const s = createPotions();
    const tick = updatePotions(s, 0, 0, 100);
    expect(tick.drank).toBe(false);
    expect(potionsLeft(s)).toBe(MAX_POTIONS);
  });

  it("heal === round(maxHp * 0.30)", () => {
    const s = createPotions();
    const maxHp = 137;
    const tick = updatePotions(s, 0, 1, maxHp);
    expect(tick.heal).toBe(Math.round(maxHp * POTION_HEAL_PCT));
  });

  it("自定义 threshold 生效", () => {
    const s = createPotions();
    const maxHp = 100;
    const atHalf = updatePotions(s, 0, 50, maxHp, 0.5);
    expect(atHalf.drank).toBe(false);
    const belowHalf = updatePotions(s, 0, 49, maxHp, 0.5);
    expect(belowHalf.drank).toBe(true);
  });

  it("dt 累积超过冷却后能再喝一瓶", () => {
    const s = createPotions();
    const hp = 20;
    const maxHp = 100;
    updatePotions(s, 0, hp, maxHp);
    const between = updatePotions(s, POTION_COOLDOWN * 0.5, hp, maxHp);
    expect(between.drank).toBe(false);
    const again = updatePotions(s, POTION_COOLDOWN, hp, maxHp);
    expect(again.drank).toBe(true);
    expect(s.drunk).toBe(2);
  });

  it("maxHp<=0 不喝", () => {
    const s = createPotions();
    expect(updatePotions(s, 0, 10, 0).drank).toBe(false);
  });
});
