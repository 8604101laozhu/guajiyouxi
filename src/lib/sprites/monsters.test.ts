import { describe, expect, it } from "vitest";
import { monsterChapterClip, monsterClip } from "./monsters";

describe("monster clips", () => {
  it("builds shared and chapter paths", () => {
    expect(monsterClip("minion", "walking")).toBe("inbox/monsters/minion/walking");
    expect(monsterClip("boss", "death")).toBe("inbox/monsters/boss/death");
    expect(monsterChapterClip(1, "champion", "attack")).toBe(
      "inbox/monsters/chapter-1/champion/attack",
    );
  });
});
