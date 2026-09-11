import { describe, expect, it } from "vitest";
import { INBOX_CLIPS, numericFrameName, sliceDirection, sortNumericFrames } from "./clip";

describe("numeric sprite clips", () => {
  it("sorts 0-10 in numeric order not lexicographic", () => {
    expect(sortNumericFrames(["10.png", "2.png", "0.png", "1.png"])).toEqual([
      "0.png",
      "1.png",
      "2.png",
      "10.png",
    ]);
  });

  it("ignores non-numeric names", () => {
    expect(sortNumericFrames(["walk.png", "3.PNG", "notes.txt"])).toEqual(["3.PNG"]);
  });

  it("slices a four-direction strip", () => {
    const frames = ["0.png", "1.png", "2.png", "3.png", "4.png", "5.png", "6.png", "7.png"];
    expect(sliceDirection(frames, 4, 1)).toEqual(["4.png", "5.png", "6.png", "7.png"]);
  });

  it("parses zero-padded names", () => {
    expect(numericFrameName("00.png")).toBe(0);
    expect(numericFrameName("07.webp")).toBe(7);
    expect(numericFrameName("2.jpg")).toBe(2);
  });

  it("keeps a fixed inbox so generated frames have one drop folder", () => {
    expect(INBOX_CLIPS).toContain("inbox/base_animations/walking");
    expect(INBOX_CLIPS).toContain("inbox/cosmetics/staff/attack");
    expect(INBOX_CLIPS).toContain("inbox/cosmetics/sword/death");
  });
});
