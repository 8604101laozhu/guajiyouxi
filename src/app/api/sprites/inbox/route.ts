import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { INBOX_CLIPS, sortNumericFrames } from "@/lib/sprites/clip";

export async function GET() {
  const slots = await Promise.all(
    INBOX_CLIPS.map(async (clip) => {
      const dir = path.join(process.cwd(), "public", "sprites", clip);
      try {
        const names = sortNumericFrames(await readdir(dir));
        const newest = await Promise.all(
          names.map(async (file) => (await stat(path.join(dir, file))).mtimeMs),
        );
        return { clip, dir: `public/sprites/${clip}`, frames: names.length, updatedAt: newest.length ? Math.max(...newest) : 0 };
      } catch {
        return { clip, dir: `public/sprites/${clip}`, frames: 0, updatedAt: 0 };
      }
    }),
  );
  return NextResponse.json({ inbox: "public/sprites/inbox", slots });
}
