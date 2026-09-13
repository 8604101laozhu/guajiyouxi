import { describe, expect, it } from "vitest";
import {
  allInboxClips,
  baseAnimationDir,
  cosmeticDir,
  cosmeticFromWeaponClass,
  isAnimationName,
  isCosmeticName,
  layeredClips,
} from "./catalog";

describe("named player catalog paths", () => {
  it("puts the default player id in the body path", () => {
    expect(baseAnimationDir("walking")).toBe("inbox/characters/nv-fashi/walking");
    expect(baseAnimationDir("attack")).toBe("inbox/characters/nv-fashi/attack");
    expect(baseAnimationDir("death")).toBe("inbox/characters/nv-fashi/death");
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
    expect(allInboxClips().some((c) => c.includes("/unarmed/"))).toBe(false);
  });

  it("layers named body with legacy fallback and weapon", () => {
    expect(layeredClips("attack", "staff")).toEqual({
      body: "inbox/characters/nv-fashi/attack",
      bodyFallback: "inbox/base_animations/attack",
      weapon: "inbox/cosmetics/staff/attack",
    });
    expect(layeredClips("walking", "unarmed").weapon).toBeNull();
    expect(isAnimationName("walking")).toBe(true);
    expect(isCosmeticName("staff")).toBe(true);
    expect(isAnimationName("walk")).toBe(false);
  });
});
