import type { AnimationName } from "./catalog";
import { cyclePose } from "./walk-cycle";

export type Joint = { x: number; y: number };

function fk(origin: Joint, length: number, angleDeg: number): Joint {
  const r = (angleDeg * Math.PI) / 180;
  return {
    x: origin.x - length * Math.sin(r),
    y: origin.y + length * Math.cos(r),
  };
}

function poseSkeleton(pose: ReturnType<typeof cyclePose>, w: number, h: number, collapse = 0): Joint[] {
  const hip: Joint = { x: w * 0.52 - collapse * 36, y: h * 0.52 + pose.bob };
  const neck: Joint = { x: hip.x + 6, y: hip.y - 148 };
  const nose: Joint = { x: neck.x - 22, y: neck.y - 36 };
  const rSho: Joint = { x: neck.x - 46, y: neck.y + 16 };
  const lSho: Joint = { x: neck.x + 48, y: neck.y + 18 };
  const rElb = fk(rSho, 62, pose.armR + 8);
  const lElb = fk(lSho, 62, pose.armL - 8);
  const rWri = fk(rElb, 58, pose.armR + pose.forearmR);
  const lWri = fk(lElb, 58, pose.armL + pose.forearmL);
  const rHip: Joint = { x: hip.x - 20, y: hip.y + 10 };
  const lHip: Joint = { x: hip.x + 24, y: hip.y + 12 };
  const rKne = fk(rHip, 108, pose.thighR);
  const lKne = fk(lHip, 108, pose.thighL);
  const rAnk = fk(rKne, 102, pose.thighR + pose.shinR * 0.35);
  const lAnk = fk(lKne, 102, pose.thighL + pose.shinL * 0.35);
  const rEye: Joint = { x: nose.x - 6, y: nose.y - 8 };
  const lEye: Joint = { x: nose.x + 12, y: nose.y - 6 };
  const rEar: Joint = { x: nose.x + 10, y: nose.y + 6 };
  const lEar: Joint = { x: nose.x + 24, y: nose.y + 4 };
  return [nose, neck, rSho, rElb, rWri, lSho, lElb, lWri, rHip, rKne, rAnk, lHip, lKne, lAnk, rEye, lEye, rEar, lEar];
}

/** COCO-18 body joints for a 3/4 walk facing screen-left. */
export function walkSkeleton(t: number, w: number, h: number): Joint[] {
  return cycleSkeleton("walking", t, w, h);
}

export function cycleSkeleton(animation: AnimationName, t: number, w: number, h: number): Joint[] {
  const pose = cyclePose(animation, t);
  const collapse = animation === "death" ? Math.min(1, (((t % 1) + 1) % 1) / 0.72) : 0;
  return poseSkeleton(pose, w, h, collapse);
}

export const OPENPOSE_LIMBS: [number, number][] = [
  [1, 2],
  [1, 5],
  [2, 3],
  [3, 4],
  [5, 6],
  [6, 7],
  [1, 8],
  [8, 9],
  [9, 10],
  [1, 11],
  [11, 12],
  [12, 13],
  [0, 1],
  [0, 14],
  [0, 15],
  [14, 16],
  [15, 17],
];

export const OPENPOSE_LIMB_COLORS = [
  "#ff0000",
  "#ff5500",
  "#ffaa00",
  "#ffff00",
  "#aaff00",
  "#55ff00",
  "#00ff00",
  "#00ff55",
  "#00ffaa",
  "#00ffff",
  "#00aaff",
  "#0055ff",
  "#0000ff",
  "#5500ff",
  "#aa00ff",
  "#ff00ff",
  "#ff00aa",
];
