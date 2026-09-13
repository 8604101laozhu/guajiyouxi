import { describe, expect, it } from "vitest";
import {
  characterBodyDir,
  DEFAULT_PLAYER_ID,
  legacyBaseAnimationDir,
  resolvePlayerId,
} from "./characters";

describe("named player characters", () => {
  it("maps 女法师 aliases onto nv-fashi", () => {
    expect(resolvePlayerId("女法师")).toBe("nv-fashi");
    expect(resolvePlayerId("法师1新")).toBe("nv-fashi");
    expect(resolvePlayerId("nv-fashi")).toBe("nv-fashi");
    expect(DEFAULT_PLAYER_ID).toBe("nv-fashi");
  });

  it("puts the character name in the body path", () => {
    expect(characterBodyDir("nv-fashi", "walking")).toBe("inbox/characters/nv-fashi/walking");
    expect(characterBodyDir("nv-fashi", "attack")).toBe("inbox/characters/nv-fashi/attack");
    expect(legacyBaseAnimationDir("walking")).toBe("inbox/base_animations/walking");
  });
});
