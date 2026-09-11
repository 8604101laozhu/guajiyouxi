import { describe, expect, it } from "vitest";
import {
  backgroundClip,
  backgroundThemePrompt,
  chapterFromName,
  classifyBackgroundFrames,
  parseBgLayer,
  stageRunSeconds,
} from "./backgrounds";

describe("chapter background tiles", () => {
  it("maps chapter folders and Chinese names", () => {
    expect(backgroundClip(1)).toBe("inbox/backgrounds/chapter-1");
    expect(backgroundClip(12)).toBe("inbox/backgrounds/chapter-12");
    expect(chapterFromName("鲜血荒地")).toBe(1);
    expect(chapterFromName("chapter-10")).toBe(10);
    expect(chapterFromName("03")).toBe(3);
    expect(chapterFromName("nope")).toBeNull();
  });

  it("classifies a single strip as loop, or sky/mid/ground layers", () => {
    expect(parseBgLayer("天空")).toBe("sky");
    expect(classifyBackgroundFrames(["/sprites/x/loop.png"])).toEqual([
      { id: "loop", src: "/sprites/x/loop.png" },
    ]);
    expect(classifyBackgroundFrames(["/sprites/x/0.png?v=1"])).toEqual([
      { id: "loop", src: "/sprites/x/0.png?v=1" },
    ]);
    expect(
      classifyBackgroundFrames(["/sprites/x/ground.png", "/sprites/x/sky.png", "/sprites/x/mid.png"]).map(
        (l) => l.id,
      ),
    ).toEqual(["sky", "mid", "ground"]);
  });

  it("keeps the runway looping longer for bosses, short on wipe", () => {
    expect(stageRunSeconds("boss", 1)).toBeGreaterThan(stageRunSeconds("minion", 1));
    expect(stageRunSeconds("minion", 0.4)).toBeLessThan(3);
    expect(backgroundThemePrompt(1)).toMatch(/Seamless horizontal loop/);
    expect(backgroundThemePrompt(1)).toMatch(/鲜血荒地/);
  });
});
