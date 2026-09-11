import { describe, expect, it } from "vitest";
import { cycleSkeleton, walkSkeleton } from "./openpose";

describe("openpose walk skeleton", () => {
  it("plants opposite feet on contact vs half-cycle", () => {
    const a = walkSkeleton(0.25, 512, 768);
    const b = walkSkeleton(0.75, 512, 768);
    const lAnk = 13;
    const rAnk = 10;
    expect(a[lAnk].x).toBeLessThan(a[rAnk].x);
    expect(b[lAnk].x).toBeGreaterThan(b[rAnk].x);
  });

  it("swings the far wrist opposite the near wrist", () => {
    const a = walkSkeleton(0.25, 512, 768);
    expect(a[4].x).not.toBeCloseTo(a[7].x, 0);
  });

  it("drops the hips on death and keeps them planted on attack", () => {
    const walk = cycleSkeleton("walking", 0.2, 512, 768);
    const attack = cycleSkeleton("attack", 0.2, 512, 768);
    const death = cycleSkeleton("death", 0.9, 512, 768);
    expect(Math.abs(attack[8].y - walk[8].y)).toBeLessThan(20);
    expect(death[8].y).toBeGreaterThan(walk[8].y + 40);
  });
});
