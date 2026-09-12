import { describe, expect, it } from "vitest";
import {
  HERO_ACTION_CLIPS,
  normalizeFrameName,
  resolveActionClip,
  resolveRole,
} from "../../../scripts/import-char.mjs";

describe("studio character import", () => {
  it("maps 待机/走路/攻击/死亡 onto hero inbox clips", () => {
    expect(resolveActionClip("走路", "hero")).toBe("inbox/base_animations/walking");
    expect(resolveActionClip("攻击", "hero")).toBe("inbox/base_animations/attack");
    expect(resolveActionClip("死亡", "hero")).toBe("inbox/base_animations/death");
    expect(resolveActionClip("待机", "hero")).toBe("inbox/base_animations/idle");
    expect(HERO_ACTION_CLIPS["走路"]).toBe("inbox/base_animations/walking");
  });

  it("routes monster packs by --as role", () => {
    expect(resolveActionClip("走路", "boss")).toBe("inbox/monsters/boss/walking");
    expect(resolveActionClip("攻击", "minion")).toBe("inbox/monsters/minion/attack");
    expect(resolveActionClip("待机", "champion")).toBe("inbox/monsters/champion/idle");
    expect(resolveRole("首领")).toBe("boss");
  });

  it("normalizes 00.png to 0.png", () => {
    expect(normalizeFrameName("00.png")).toBe("0.png");
    expect(normalizeFrameName("walk_07.PNG")).toBe("7.png");
    expect(normalizeFrameName("note.txt")).toBeNull();
  });
});
