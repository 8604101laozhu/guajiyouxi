/**
 * 自动喝药：纯决策，不认识实体与渲染。
 * 主循环在 hp 低于阈值时按槽位顺序扣瓶、给 heal 数值，实际加血由调用方做。
 */

export const POTION_SLOTS = 4;
export const POTIONS_PER_SLOT = 5;
export const POTION_COOLDOWN = 1.0;
export const POTION_THRESHOLD = 0.35;
export const POTION_HEAL_PCT = 0.3;

export type PotionState = { slots: number[]; cd: number; drunk: number };
export type PotionTick = { drank: boolean; heal: number; slot: number; empty: boolean };

const NO_DRINK: Omit<PotionTick, "empty"> = { drank: false, heal: 0, slot: -1 };

function slotsEmpty(s: PotionState): boolean {
  return s.slots.every((n) => n <= 0);
}

function noDrink(s: PotionState): PotionTick {
  return { ...NO_DRINK, empty: slotsEmpty(s) };
}

export function createPotions(): PotionState {
  return {
    slots: Array.from({ length: POTION_SLOTS }, () => POTIONS_PER_SLOT),
    cd: 0,
    drunk: 0,
  };
}

export function potionsLeft(s: PotionState): number {
  return s.slots.reduce((a, n) => a + n, 0);
}

export function updatePotions(
  s: PotionState,
  dt: number,
  hp: number,
  maxHp: number,
  threshold = POTION_THRESHOLD,
): PotionTick {
  s.cd = Math.max(0, s.cd - dt);

  if (maxHp <= 0 || hp <= 0) return noDrink(s);
  if (hp / maxHp >= threshold) return noDrink(s);
  if (s.cd > 0) return noDrink(s);

  let slot = -1;
  for (let i = 0; i < s.slots.length; i++) {
    if (s.slots[i] > 0) {
      slot = i;
      break;
    }
  }
  if (slot < 0) return { drank: false, heal: 0, slot: -1, empty: true };

  s.slots[slot]--;
  s.cd = POTION_COOLDOWN;
  s.drunk++;
  const heal = Math.round(maxHp * POTION_HEAL_PCT);
  return { drank: true, heal, slot, empty: false };
}
