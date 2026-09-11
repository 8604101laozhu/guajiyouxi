import { describe, expect, it } from "vitest";
import { attackPose, deathPose, walkPose } from "./walk-cycle";

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

describe("attack and death from the same W2 graph", () => {
  it("plants the feet and swings one arm through a strike", () => {
    const mid = attackPose(0.45);
    expect(Math.abs(mid.thighL - mid.thighR)).toBeLessThan(20);
    expect(Math.abs(attackPose(0.2).armR)).toBeGreaterThan(40);
    expect(attackPose(0.5).armR).toBeGreaterThan(20);
  });

  it("collapses then holds instead of getting up", () => {
    expect(deathPose(0.8).bob).toBeGreaterThan(deathPose(0).bob);
    expect(deathPose(0.9).bob).toBeCloseTo(deathPose(0.8).bob, 5);
  });
});
