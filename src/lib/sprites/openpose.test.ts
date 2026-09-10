import { describe, expect, it } from "vitest";
import { walkSkeleton } from "./openpose";

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
});
