export type Rng = () => number;

/** Deterministic [0, 1) generator. Same seed → same loot / same rolls. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng: Rng, min: number, max: number): number {
  if (max <= min) return min;
  return min + Math.floor(rng() * (max - min + 1));
}

/** D2 `rand(n)`: integer in [0, n). n<=1 always returns 0. */
export function randBelow(rng: Rng, n: number): number {
  if (n <= 1) return 0;
  return Math.floor(rng() * n);
}

export function pick<T>(rng: Rng, list: readonly T[]): T {
  if (list.length === 0) {
    throw new Error("pick() on empty list");
  }
  return list[Math.floor(rng() * list.length)] as T;
}

export function weightedPick<T>(
  rng: Rng,
  items: readonly T[],
  weight: (item: T) => number,
): T {
  if (items.length === 0) {
    throw new Error("weightedPick() on empty list");
  }
  let total = 0;
  const weights = items.map((item) => {
    const w = Math.max(0, weight(item));
    total += w;
    return w;
  });
  if (total <= 0) return pick(rng, items);
  let roll = rng() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i] as number;
    if (roll <= 0) return items[i] as T;
  }
  return items[items.length - 1] as T;
}

export function chance(rng: Rng, percent: number): boolean {
  return rng() * 100 < percent;
}

export function makeId(rng: Rng, prefix = "it"): string {
  const n = Math.floor(rng() * 1e16)
    .toString(36)
    .padStart(8, "0");
  return `${prefix}_${n}`;
}
