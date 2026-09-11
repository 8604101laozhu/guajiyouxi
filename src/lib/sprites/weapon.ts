import type { CosmeticName } from "./catalog";

export type Point = { x: number; y: number };

/** Wrist-aligned glyph used until W4 weapon frames exist. */
export function weaponPolyline(
  cosmetic: CosmeticName,
  wrist: Point,
  elbow: JointLike,
): Point[] | null {
  if (cosmetic === "unarmed") return null;
  const dx = wrist.x - elbow.x;
  const dy = wrist.y - elbow.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  if (cosmetic === "staff") {
    return [
      { x: wrist.x - ux * 28, y: wrist.y - uy * 28 },
      { x: wrist.x + ux * 118, y: wrist.y + uy * 118 },
    ];
  }
  return [
    { x: wrist.x - ux * 10, y: wrist.y - uy * 10 },
    { x: wrist.x + ux * 72, y: wrist.y + uy * 72 },
  ];
}

type JointLike = Point;

export function weaponLength(cosmetic: CosmeticName): number {
  const pts = weaponPolyline(cosmetic, { x: 0, y: 0 }, { x: 0, y: 10 });
  if (!pts) return 0;
  return Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
}
