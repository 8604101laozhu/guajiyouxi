/** Secondary motion on top of the walk: hair lag/jitter, optional chest bounce. */

export type SecondaryAmounts = {
  hair: number;
  chest: number;
};

export type HairSecondary = {
  angle: number;
  jitter: number;
  tip: number;
};

export type ChestSecondary = {
  y: number;
  scaleY: number;
};

export function hairSecondary(t: number, amount = 1): HairSecondary {
  const a = ((t % 1) + 1) % 1 * Math.PI * 2;
  const follow = Math.sin(a + 0.62) * 8;
  const plant = Math.abs(Math.sin(a)) * -1.4;
  const jitter = Math.sin(a * 2.6) * 1.5 + Math.sin(a * 5.3 + 0.7) * 0.7;
  return {
    angle: (follow + plant) * amount,
    jitter: jitter * amount,
    tip: (follow * 0.45 + jitter) * amount,
  };
}

/** Delayed squash after each foot plant. Male pipeline keeps amount at 0. */
export function chestSecondary(t: number, amount = 0): ChestSecondary {
  if (amount <= 0) return { y: 0, scaleY: 1 };
  const a = ((t % 1) + 1) % 1 * Math.PI * 2;
  const lagged = a + 0.85;
  const plant = Math.pow(Math.max(0, Math.cos(2 * a)), 3);
  return {
    y: (Math.sin(lagged) * 3.2 + plant * 2.4) * amount,
    scaleY: 1 + Math.sin(lagged) * 0.045 * amount,
  };
}

export function strandPoints(
  root: { x: number; y: number },
  hair: HairSecondary,
  length: number,
  swaySign: number,
): { x: number; y: number }[] {
  const a0 = ((hair.angle + hair.jitter * 0.35) * Math.PI) / 180;
  const a1 = a0 + (hair.tip * Math.PI) / 180;
  const mid = {
    x: root.x + Math.sin(a0) * length * 0.45 * swaySign,
    y: root.y + Math.cos(a0) * length * 0.55,
  };
  const tip = {
    x: mid.x + Math.sin(a1) * length * 0.55 * swaySign,
    y: mid.y + Math.cos(a1) * length * 0.5,
  };
  return [root, mid, tip];
}
