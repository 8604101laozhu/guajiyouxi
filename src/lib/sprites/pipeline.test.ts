import { describe, expect, it } from "vitest";
import { fillW2Prompt, GENDER_SLOTS, w2DriverKnobs } from "./pipeline";
import { chestSecondary, hairSecondary } from "./secondary";

describe("gender prompt swap", () => {
  it("keeps one W2 template and only swaps gender slots", () => {
    const f = fillW2Prompt("female", "walking");
    const m = fillW2Prompt("male", "walking");
    expect(f).toContain("in-place walk loop");
    expect(m).toContain("in-place walk loop");
    expect(f).toContain("adult woman");
    expect(m).toContain("adult man");
    expect(f).toContain("chest bounce");
    expect(m).toContain("no chest bounce");
    expect(f).toContain("unarmed");
    expect(f).not.toContain("{{");
  });

  it("switches walk / attack / death by ANIMATION_NAME only", () => {
    const walk = fillW2Prompt("female", "walking");
    const atk = fillW2Prompt("female", "attack");
    const death = fillW2Prompt("female", "death");
    expect(walk).toContain("walking cycle");
    expect(atk).toContain("attack cycle");
    expect(death).toContain("death cycle");
    expect(atk).toContain("adult woman");
    expect(death).toContain("no extra characters");
  });

  it("keeps W2 body unarmed and defers weapons to W4 knobs", () => {
    expect(w2DriverKnobs("attack")).toContain("ANIMATION_NAME=attack");
    expect(w2DriverKnobs("death")).toContain("W2 body only");
  });

  it("lets a female character omit chest bounce via slot override", () => {
    const f = fillW2Prompt("female", "walking", { CHEST: GENDER_SLOTS.male.CHEST });
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
