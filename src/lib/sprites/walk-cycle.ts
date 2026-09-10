/** Classic in-place walk: opposite arm/leg, passing-position bob. t is 0..1. */
export type WalkPose = {
  bob: number;
  hipSway: number;
  thighL: number;
  thighR: number;
  shinL: number;
  shinR: number;
  armL: number;
  armR: number;
  forearmL: number;
  forearmR: number;
  hair: number;
  skirt: number;
};

export function walkPose(t: number): WalkPose {
  const a = ((t % 1) + 1) % 1 * Math.PI * 2;
  const s = Math.sin(a);
  const c = Math.cos(a);
  const backL = Math.max(0, -s);
  const backR = Math.max(0, s);
  return {
    bob: Math.abs(s) * 10,
    hipSway: s * 3,
    thighL: s * 28,
    thighR: -s * 28,
    shinL: 6 + 24 * backL + 8 * Math.max(0, c),
    shinR: 6 + 24 * backR + 8 * Math.max(0, -c),
    armL: -s * 24,
    armR: s * 24,
    forearmL: 8 + 10 * backL,
    forearmR: 8 + 10 * backR,
    hair: Math.sin(a + 0.5) * 5,
    skirt: s * 4,
  };
}

export function walkFrameCount(n = 8): number[] {
  return Array.from({ length: n }, (_, i) => i / n);
}
