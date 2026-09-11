import type { WeaponClass } from "@/lib/d2/types";

export const ANIMATION_NAMES = ["walking", "attack", "death"] as const;
export type AnimationName = (typeof ANIMATION_NAMES)[number];

export const COSMETIC_NAMES = ["unarmed", "staff", "sword"] as const;
export type CosmeticName = (typeof COSMETIC_NAMES)[number];

export const ANIMATION_LABEL: Record<AnimationName, string> = {
  walking: "走路",
  attack: "攻击",
  death: "死亡",
};

export const COSMETIC_LABEL: Record<CosmeticName, string> = {
  unarmed: "空手",
  staff: "法杖",
  sword: "剑",
};

export function baseAnimationDir(animation: AnimationName): string {
  return `inbox/base_animations/${animation}`;
}

export function cosmeticDir(cosmetic: CosmeticName, animation: AnimationName): string {
  return `inbox/cosmetics/${cosmetic}/${animation}`;
}

export function allInboxClips(): string[] {
  const clips = [
    "inbox/stills",
    ...ANIMATION_NAMES.map(baseAnimationDir),
  ];
  for (const cosmetic of COSMETIC_NAMES) {
    if (cosmetic === "unarmed") continue;
    for (const animation of ANIMATION_NAMES) {
      clips.push(cosmeticDir(cosmetic, animation));
    }
  }
  return clips;
}

export function isAnimationName(value: string): value is AnimationName {
  return (ANIMATION_NAMES as readonly string[]).includes(value);
}

export function isCosmeticName(value: string): value is CosmeticName {
  return (COSMETIC_NAMES as readonly string[]).includes(value);
}

export function cosmeticFromWeaponClass(weaponClass: WeaponClass | undefined): CosmeticName {
  if (!weaponClass) return "unarmed";
  if (weaponClass === "staff" || weaponClass === "wand" || weaponClass === "scepter") return "staff";
  if (weaponClass === "sword" || weaponClass === "dagger") return "sword";
  if (weaponClass === "axe" || weaponClass === "mace" || weaponClass === "spear" || weaponClass === "polearm") {
    return "sword";
  }
  return "unarmed";
}

export function layeredClips(animation: AnimationName, cosmetic: CosmeticName) {
  return {
    body: baseAnimationDir(animation),
    weapon: cosmetic === "unarmed" ? null : cosmeticDir(cosmetic, animation),
  };
}
