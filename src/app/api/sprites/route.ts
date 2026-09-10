import { NextResponse } from "next/server";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { sortNumericFrames } from "@/lib/sprites/clip";

export async function GET(request: Request) {
  const clip = new URL(request.url).searchParams.get("clip") ?? "mage/walk";
  if (!/^[a-z0-9/_-]+$/i.test(clip) || clip.includes("..")) {
    return NextResponse.json({ error: "invalid clip" }, { status: 400 });
  }
  const dir = path.join(process.cwd(), "public", "sprites", clip);
  try {
    const names = await readdir(dir);
    const files = sortNumericFrames(names);
    const frames = await Promise.all(
      files.map(async (file) => {
        const info = await stat(path.join(dir, file));
        return `/sprites/${clip}/${file}?v=${Math.floor(info.mtimeMs)}`;
      }),
    );
    return NextResponse.json({ clip, frames, dir: `public/sprites/${clip}` });
  } catch {
    return NextResponse.json({ clip, frames: [], dir: `public/sprites/${clip}` });
  }
}
