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
  scaleX: number;
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

/**
 * Dense twice-per-cycle bounce after each foot plant.
 * Male pipeline keeps amount at 0.
 */
export function chestSecondary(t: number, amount = 0): ChestSecondary {
  if (amount <= 0) return { y: 0, scaleX: 1, scaleY: 1 };
  const a = ((t % 1) + 1) % 1 * Math.PI * 2;
  // Two plants per walk cycle; lag recovery so bounce reads after the step.
  const lagged = a + 0.72;
  const plant = Math.pow(Math.max(0, Math.cos(2 * a)), 2.2);
  const recover = Math.sin(lagged * 2) * 0.55 + Math.sin(lagged) * 0.45;
  const drop = plant * 7.2 + recover * 4.8;
  return {
    y: drop * amount,
    scaleX: 1 + plant * 0.07 * amount - recover * 0.025 * amount,
    scaleY: 1 - plant * 0.1 * amount + recover * 0.055 * amount,
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
