import { describe, expect, it } from "vitest";
import { weaponLength, weaponPolyline } from "./weapon";

describe("wrist weapon glyphs", () => {
  it("draws nothing for unarmed", () => {
    expect(weaponPolyline("unarmed", { x: 10, y: 10 }, { x: 0, y: 20 })).toBeNull();
    expect(weaponLength("unarmed")).toBe(0);
  });

  it("makes the staff layer longer than the sword layer", () => {
    expect(weaponLength("staff")).toBeGreaterThan(weaponLength("sword"));
  });
});
