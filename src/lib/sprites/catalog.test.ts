import { describe, expect, it } from "vitest";
import {
  allInboxClips,
  cosmeticDir,
  cosmeticFromWeaponClass,
  baseAnimationDir,
  isAnimationName,
  isCosmeticName,
  layeredClips,
} from "./catalog";

describe("mor-o catalog paths", () => {
  it("uses one W2 folder per ANIMATION_NAME", () => {
    expect(baseAnimationDir("walking")).toBe("inbox/base_animations/walking");
    expect(baseAnimationDir("attack")).toBe("inbox/base_animations/attack");
    expect(baseAnimationDir("death")).toBe("inbox/base_animations/death");
  });

  it("puts weapons under cosmetics/{COSMETIC_NAME}/{ANIMATION_NAME}", () => {
    expect(cosmeticDir("staff", "walking")).toBe("inbox/cosmetics/staff/walking");
    expect(cosmeticDir("sword", "death")).toBe("inbox/cosmetics/sword/death");
  });

  it("maps paper-doll weapons onto staff / sword / unarmed", () => {
    expect(cosmeticFromWeaponClass("staff")).toBe("staff");
    expect(cosmeticFromWeaponClass("wand")).toBe("staff");
    expect(cosmeticFromWeaponClass("scepter")).toBe("staff");
    expect(cosmeticFromWeaponClass("sword")).toBe("sword");
    expect(cosmeticFromWeaponClass("axe")).toBe("sword");
    expect(cosmeticFromWeaponClass("spear")).toBe("sword");
    expect(cosmeticFromWeaponClass(undefined)).toBe("unarmed");
  });

  it("does not create a separate unarmed cosmetic folder", () => {
    expect(allInboxClips().some((c) => c.includes("unarmed"))).toBe(false);
  });

  it("layers body and weapon without a second doll model", () => {
    expect(layeredClips("attack", "staff")).toEqual({
      body: "inbox/base_animations/attack",
      weapon: "inbox/cosmetics/staff/attack",
    });
    expect(layeredClips("walking", "unarmed").weapon).toBeNull();
    expect(isAnimationName("walking")).toBe(true);
    expect(isCosmeticName("staff")).toBe(true);
    expect(isAnimationName("walk")).toBe(false);
  });
});
