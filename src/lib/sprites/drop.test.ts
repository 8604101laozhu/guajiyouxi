import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ingestDrop, nextFrameIndex, resolveDropRel } from "./drop.mjs";

describe("drop folder routing", () => {
  it("maps Chinese folders onto the official inbox", () => {
    expect(resolveDropRel("走路/0.png")).toEqual({
      clip: "inbox/base_animations/walking",
      index: 0,
      ext: "png",
    });
    expect(resolveDropRel("攻击/3.webp")).toEqual({
      clip: "inbox/base_animations/attack",
      index: 3,
      ext: "webp",
    });
    expect(resolveDropRel("法杖/走路/00.png")?.clip).toBe("inbox/cosmetics/staff/walking");
    expect(resolveDropRel("剑/死亡/1.png")?.clip).toBe("inbox/cosmetics/sword/death");
    expect(resolveDropRel("立绘/2.jpg")?.clip).toBe("inbox/stills");
  });

  it("accepts a flat dump with prefixes", () => {
    expect(resolveDropRel("walking-4.png")?.clip).toBe("inbox/base_animations/walking");
    expect(resolveDropRel("法杖-攻击-01.png")).toEqual({
      clip: "inbox/cosmetics/staff/attack",
      index: 1,
      ext: "png",
    });
    expect(resolveDropRel("notes.txt")).toBeNull();
  });

  it("fills the next index when the file is not numbered", async () => {
    expect(nextFrameIndex(["0.png", "2.png"])).toBe(3);
    const root = await mkdtemp(path.join(os.tmpdir(), "guaji-drop-"));
    const dropDir = path.join(root, "drop");
    const inbox = path.join(root, "inbox-root");
    await mkdir(path.join(dropDir, "走路"), { recursive: true });
    await mkdir(path.join(inbox, "inbox/base_animations/walking"), { recursive: true });
    await writeFile(path.join(dropDir, "走路", "pose.png"), "fake");
    await writeFile(path.join(inbox, "inbox/base_animations/walking", "0.png"), "old");
    const copied = await ingestDrop(dropDir, inbox);
    expect(copied[0]?.to).toBe("inbox/base_animations/walking/1.png");
    expect(await readFile(path.join(inbox, copied[0].to), "utf8")).toBe("fake");
  });
});
