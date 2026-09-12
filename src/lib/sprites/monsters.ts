import type { AnimationName } from "./catalog";
import type { MonsterKind } from "@/lib/d2/campaign";

export const MONSTER_KINDS = ["minion", "champion", "boss"] as const;

export const MONSTER_KIND_LABEL: Record<MonsterKind, string> = {
  minion: "小怪",
  champion: "精英",
  boss: "首领",
};

/** Shared across chapters: inbox/monsters/{kind}/{anim} */
export function monsterClip(kind: MonsterKind, animation: AnimationName): string {
  return `inbox/monsters/${kind}/${animation}`;
}

/** Chapter-scoped override: inbox/monsters/chapter-{n}/{kind}/{anim} */
export function monsterChapterClip(
  chapter: number,
  kind: MonsterKind,
  animation: AnimationName,
): string {
  return `inbox/monsters/chapter-${chapter}/${kind}/${animation}`;
}

export function allMonsterClips(): string[] {
  const clips: string[] = [];
  for (const kind of MONSTER_KINDS) {
    for (const animation of ["walking", "attack", "death"] as const) {
      clips.push(monsterClip(kind, animation));
      for (let chapter = 1; chapter <= 12; chapter++) {
        clips.push(monsterChapterClip(chapter, kind, animation));
      }
    }
  }
  return clips;
}
