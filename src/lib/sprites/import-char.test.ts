import { describe, expect, it } from "vitest";
import {
  HERO_ACTION_CLIPS,
  resolveActionClip,
  resolveHeroClip,
  resolvePlayerId,
} from "../../../scripts/import-char.mjs";

describe("studio character import", () => {
  it("puts 女法师 frames under characters/nv-fashi", () => {
    expect(resolveHeroClip("走路", "nv-fashi")).toBe("inbox/characters/nv-fashi/walking");
    expect(resolveActionClip("走路", "hero", "nv-fashi")).toBe("inbox/characters/nv-fashi/walking");
    expect(resolveActionClip("攻击", "hero")).toBe("inbox/characters/nv-fashi/attack");
    expect(resolveActionClip("死亡", "hero")).toBe("inbox/characters/nv-fashi/death");
    expect(resolveActionClip("待机", "hero")).toBe("inbox/characters/nv-fashi/idle");
    expect(HERO_ACTION_CLIPS["走路"]).toBe("inbox/characters/nv-fashi/walking");
  });

  it("resolves Chinese / studio names onto nv-fashi", () => {
    expect(resolvePlayerId("女法师")).toBe("nv-fashi");
    expect(resolvePlayerId("法师1新")).toBe("nv-fashi");
  });

  it("routes monster packs by --as role", () => {
    expect(resolveActionClip("走路", "boss")).toBe("inbox/monsters/boss/walking");
    expect(resolveActionClip("攻击", "minion")).toBe("inbox/monsters/minion/attack");
  });
});
