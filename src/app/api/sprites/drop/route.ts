import { readdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { DROP_FOLDERS, loadDropConfig } from "@/lib/sprites/drop.mjs";
import { numericFrameName } from "@/lib/sprites/clip";

export async function GET() {
  const repoRoot = process.cwd();
  const config = await loadDropConfig(repoRoot);
  const folders = await Promise.all(
    DROP_FOLDERS.map(async (slot) => {
      const dir = path.join(config.dropDir, ...slot.folder.split("/"));
      try {
        const names = (await readdir(dir)).filter((name) => numericFrameName(name) !== null);
        return { folder: slot.folder, clip: slot.clip, files: names.length };
      } catch {
        return { folder: slot.folder.replaceAll("\\", "/"), clip: slot.clip, files: 0 };
      }
    }),
  );
  return NextResponse.json({
    dropDir: config.dropDir,
    command: "npm run drop:watch -- --push",
    folders,
  });
}
