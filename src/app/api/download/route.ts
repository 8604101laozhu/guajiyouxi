import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const CANDIDATES = [
  path.join(process.cwd(), "public", "guajiyouxi.zip"),
  "/opt/cursor/artifacts/guajiyouxi.zip",
];

export async function GET() {
  for (const file of CANDIDATES) {
    try {
      const info = await stat(file);
      const body = await readFile(file);
      return new NextResponse(body, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": 'attachment; filename="guajiyouxi.zip"',
          "Content-Length": String(info.size),
          "Cache-Control": "no-store",
        },
      });
    } catch {
      continue;
    }
  }
  return NextResponse.json({ error: "zip missing" }, { status: 404 });
}
