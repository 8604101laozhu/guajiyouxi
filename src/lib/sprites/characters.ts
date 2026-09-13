/** Disk ids must stay ASCII (API clip regex). Chinese names are labels/aliases only. */
export type PlayerCharacterId = "nv-fashi";

export type PlayerCharacter = {
  id: PlayerCharacterId;
  /** Display name shown in UI / docs */
  label: string;
  /** Studio folder names, Chinese aliases, etc. */
  aliases: string[];
};

export const PLAYER_CHARACTERS: readonly PlayerCharacter[] = [
  {
    id: "nv-fashi",
    label: "女法师",
    aliases: ["女法师", "女法", "法师", "法师1新", "mage", "fashi", "nv-fashi"],
  },
] as const;

export const DEFAULT_PLAYER_ID: PlayerCharacterId = "nv-fashi";

const PLAYER_BODY_ANIMS = ["walking", "attack", "death", "idle"] as const;
export type PlayerBodyAnim = (typeof PLAYER_BODY_ANIMS)[number];

export function isPlayerCharacterId(value: string): value is PlayerCharacterId {
  return PLAYER_CHARACTERS.some((c) => c.id === value);
}

export function playerCharacterById(id: string): PlayerCharacter | undefined {
  return PLAYER_CHARACTERS.find((c) => c.id === id);
}

/** Resolve studio / Chinese name → ASCII player id. */
export function resolvePlayerId(nameOrId: string): PlayerCharacterId | null {
  const raw = nameOrId.trim();
  if (!raw) return null;
  if (isPlayerCharacterId(raw)) return raw;
  const folded = raw.toLowerCase().replaceAll("_", "-");
  for (const c of PLAYER_CHARACTERS) {
    if (c.id === folded) return c.id;
    if (c.label === raw) return c.id;
    if (c.aliases.some((a) => a === raw || a.toLowerCase() === folded)) return c.id;
  }
  return null;
}

/** Preferred path: inbox/characters/{id}/{anim} */
export function characterBodyDir(characterId: string, animation: PlayerBodyAnim | string): string {
  return `inbox/characters/${characterId}/${animation}`;
}

/** Legacy shared slot (no character name). Kept as fallback while migrating. */
export function legacyBaseAnimationDir(animation: PlayerBodyAnim | string): string {
  return `inbox/base_animations/${animation}`;
}

export function allCharacterBodyClips(): string[] {
  const clips: string[] = [];
  for (const c of PLAYER_CHARACTERS) {
    for (const anim of PLAYER_BODY_ANIMS) {
      clips.push(characterBodyDir(c.id, anim));
    }
  }
  return clips;
}

export function characterDropFolders(): { folder: string; clip: string }[] {
  const out: { folder: string; clip: string }[] = [];
  for (const c of PLAYER_CHARACTERS) {
    out.push(
      { folder: `角色/${c.label}/待机`, clip: characterBodyDir(c.id, "idle") },
      { folder: `角色/${c.label}/走路`, clip: characterBodyDir(c.id, "walking") },
      { folder: `角色/${c.label}/攻击`, clip: characterBodyDir(c.id, "attack") },
      { folder: `角色/${c.label}/死亡`, clip: characterBodyDir(c.id, "death") },
      { folder: `characters/${c.id}/idle`, clip: characterBodyDir(c.id, "idle") },
      { folder: `characters/${c.id}/walking`, clip: characterBodyDir(c.id, "walking") },
      { folder: `characters/${c.id}/attack`, clip: characterBodyDir(c.id, "attack") },
      { folder: `characters/${c.id}/death`, clip: characterBodyDir(c.id, "death") },
    );
  }
  return out;
}
