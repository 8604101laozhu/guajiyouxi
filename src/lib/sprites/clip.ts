import { allInboxClips } from "./catalog";

export function numericFrameName(file: string): number | null {
  const match = file.match(/^(\d+)\.(png|webp|gif|jpe?g)$/i);
  if (!match) return null;
  return Number(match[1]);
}

export function sortNumericFrames(files: string[]): string[] {
  return files
    .filter((file) => numericFrameName(file) !== null)
    .sort((a, b) => (numericFrameName(a) ?? 0) - (numericFrameName(b) ?? 0));
}

export function sliceDirection(frames: string[], framesPerDir: number, direction: number): string[] {
  if (framesPerDir <= 0 || framesPerDir >= frames.length) return frames;
  const dirs = Math.floor(frames.length / framesPerDir);
  const dir = ((direction % dirs) + dirs) % dirs;
  const start = dir * framesPerDir;
  return frames.slice(start, start + framesPerDir);
}

export const SPRITE_INBOX = {
  stills: "inbox/stills",
  walking: "inbox/base_animations/walking",
  attack: "inbox/base_animations/attack",
  death: "inbox/base_animations/death",
} as const;

export const INBOX_CLIPS = allInboxClips();

export const MAGE_WALK_CLIP = "mage/walk";
export const MAGE_WALK_CYCLE_CLIP = SPRITE_INBOX.walking;

