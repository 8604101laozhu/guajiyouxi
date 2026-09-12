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

console.log(`drop: ${dropDir}`);
console.log(`backgrounds: ${bgAscii}`);
console.log(`chapter 1 file: ${path.join(chapter1, "loop.png")}`);

if (process.platform === "win32") {
  spawn("explorer", [bgAscii], { detached: true, stdio: "ignore" }).unref();
}
