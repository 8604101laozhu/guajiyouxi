import type { AnimationName } from "./catalog";

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

/** Same W2 graph, different ANIMATION_NAME: planted feet, one strike then recover. */
export function attackPose(t: number): WalkPose {
  const a = ((t % 1) + 1) % 1;
  let armR = 0;
  if (a < 0.35) armR = -40 - (a / 0.35) * 22;
  else if (a < 0.55) armR = -62 + ((a - 0.35) / 0.2) * 118;
  else armR = 56 * (1 - (a - 0.55) / 0.45);
  return {
    bob: 3,
    hipSway: 0,
    thighL: 5,
    thighR: -4,
    shinL: 8,
    shinR: 8,
    armL: -armR * 0.22,
    armR,
    forearmL: 12,
    forearmR: a > 0.35 && a < 0.55 ? 30 : 16,
    hair: Math.sin(a * Math.PI * 2) * 2,
    skirt: 0,
  };
}

/** Collapse then hold. No get-up. */
export function deathPose(t: number): WalkPose {
  const a = ((t % 1) + 1) % 1;
  const k = Math.min(1, a / 0.72);
  const ease = k * k;
  return {
    bob: ease * 80,
    hipSway: -ease * 18,
    thighL: 8 + ease * 40,
    thighR: -4 + ease * 30,
    shinL: 10 + ease * 20,
    shinR: 8 + ease * 16,
    armL: 20 + ease * 50,
    armR: -10 + ease * 40,
    forearmL: 20,
    forearmR: 18,
    hair: ease * 12,
    skirt: ease * 8,
  };
}

export function cyclePose(animation: AnimationName, t: number): WalkPose {
  if (animation === "attack") return attackPose(t);
  if (animation === "death") return deathPose(t);
  return walkPose(t);
}
