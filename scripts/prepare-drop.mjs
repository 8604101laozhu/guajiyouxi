#!/usr/bin/env node
/**
 * ASCII-safe prep for Windows cmd.exe.
 * UTF-8 Chinese inside .cmd is parsed as GBK and breaks the script.
 * Creates drop/bg/1..12 (and 背景/1..12) then opens Explorer on drop/bg.
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDropTree } from "../src/lib/sprites/drop.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dropDir = path.join(repoRoot, "drop");
const bgAscii = path.join(dropDir, "bg");
const chapter1 = path.join(bgAscii, "1");

await ensureDropTree(dropDir);

for (let i = 1; i <= 12; i++) {
  const dir = path.join(bgAscii, String(i));
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "PUT_LOOP_HERE.txt"),
    [
      `Chapter ${i} side-scroll background.`,
      "Save as: loop.png",
      "Size: 3840x720 PNG, seamless left-right, ground ~78%.",
      "Vanillaware painted style. No characters.",
      "",
    ].join("\n"),
    "utf8",
  );
}

await writeFile(
  path.join(bgAscii, "README.txt"),
  [
    "Side-scroll stage backgrounds.",
    "Chapter 1: put loop.png into bg\\1\\",
    "Same as Chinese folder 背景\\1\\",
    "",
  ].join("\n"),
  "utf8",
);

const mobAscii = path.join(dropDir, "mob");
for (const kind of ["minion", "champion", "boss"]) {
  for (const anim of ["walking", "attack", "death"]) {
    const dir = path.join(mobAscii, kind, anim);
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "PUT_FRAMES_HERE.txt"),
      [
        `${kind} ${anim} frames.`,
        "Name: 0.png 1.png 2.png …",
        "Face LEFT. Transparent PNG. Feet near bottom.",
        "",
      ].join("\n"),
      "utf8",
    );
  }
}
await writeFile(
  path.join(mobAscii, "README.txt"),
  [
    "Monster sprites (shared across chapters).",
    "minion = stages 1-8, champion = 9, boss = 10.",
    "Example: mob\\minion\\walking\\0.png",
    "Then double-click push-mob.cmd",
    "Optional chapter override: mob\\1\\minion\\walking\\",
    "",
  ].join("\n"),
  "utf8",
);

console.log(`drop: ${dropDir}`);
console.log(`backgrounds: ${bgAscii}`);
console.log(`chapter 1 file: ${path.join(chapter1, "loop.png")}`);
console.log(`monsters: ${path.join(mobAscii, "minion", "walking")}`);

if (process.platform === "win32") {
  spawn("explorer", [chapter1], { detached: true, stdio: "ignore" }).unref();
}
