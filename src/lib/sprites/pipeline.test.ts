import { describe, expect, it } from "vitest";
import { fillWalkPrompt, GENDER_SLOTS } from "./pipeline";
import { chestSecondary, hairSecondary } from "./secondary";

describe("gender prompt swap", () => {
  it("keeps one template and only swaps gender slots", () => {
    const f = fillWalkPrompt("female");
    const m = fillWalkPrompt("male");
    expect(f).toContain("in-place walk loop");
    expect(m).toContain("in-place walk loop");
    expect(f).toContain("adult woman");
    expect(m).toContain("adult man");
    expect(f).toContain("chest bounce");
    expect(m).toContain("no chest bounce");
    expect(f).not.toContain("{{");
    expect(m).not.toContain("{{");
  });

  it("lets a female character omit chest bounce via slot override", () => {
    const f = fillWalkPrompt("female", { CHEST: GENDER_SLOTS.male.CHEST });
    expect(f).toContain("adult woman");
    expect(f).toContain("no chest bounce");
  });
});

describe("secondary motion", () => {
  it("jitters hair faster than the walk and lags the step", () => {
    const a = hairSecondary(0.25, 1);
    const b = hairSecondary(0.3, 1);
    expect(Math.abs(a.jitter)).toBeGreaterThan(0.2);
    expect(a.angle).not.toBeCloseTo(b.angle, 2);
    expect(Math.abs(hairSecondary(0.25, 0).angle)).toBe(0);
  });

  it("gives female chest a delayed bounce and male none", () => {
    expect(chestSecondary(0.25, 0.7).scaleY).not.toBe(1);
    expect(chestSecondary(0.25, 0)).toEqual({ y: 0, scaleY: 1 });
  });
});
