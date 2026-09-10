import { describe, expect, it } from "vitest";
import { walkPose } from "./walk-cycle";

describe("walk cycle kinematics", () => {
  it("swings opposite legs 180 degrees apart", () => {
    const a = walkPose(0.25);
    const b = walkPose(0.75);
    expect(a.thighL).toBeCloseTo(-b.thighL, 5);
    expect(Math.abs(a.thighL - a.thighR)).toBeGreaterThan(40);
    expect(a.thighL).toBeCloseTo(-a.thighR, 5);
  });

  it("swings arms opposite the same-side leg", () => {
    const mid = walkPose(0.25);
    expect(Math.sign(mid.armL)).toBe(-Math.sign(mid.thighL));
    expect(Math.sign(mid.armR)).toBe(-Math.sign(mid.thighR));
  });

  it("bobs up at passing positions", () => {
    expect(walkPose(0.25).bob).toBeGreaterThan(walkPose(0).bob);
    expect(walkPose(0.75).bob).toBeGreaterThan(walkPose(0).bob);
  });
});
