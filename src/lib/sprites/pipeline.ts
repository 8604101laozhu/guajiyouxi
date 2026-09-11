import type { AnimationName } from "./catalog";

export type GenderId = "female" | "male";
export type { AnimationName };

export type PromptSlots = {
  BODY: string;
  HAIR: string;
  CHEST: string;
  MOTION: string;
};

export const W2_TEMPLATE = `Animate this single character into a simple in-place {{ANIMATION_NAME}} cycle for a 2D game.

{{BODY}}
The character faces left for the entire clip.
Preserve the exact identity, painted illustration look, proportions, palette, costume, and silhouette from the input image.
Do not turn toward any other direction. Do not pivot or rotate the body to a new view.
The character is unarmed in this pass — no staff, sword, or extra props. Weapons are a later cosmetic layer.

Keep the camera fixed and centered. Keep the framing unchanged.
Keep the character centered on a flat empty background. No floor, room, horizon, or environment.

Motion:
{{MOTION}}
{{HAIR}}
{{CHEST}}
- character does not travel across the frame

One character only. No extra props, labels, camera move, zoom, or magic effects.`;

export const ANIMATION_MOTION: Record<AnimationName, string> = {
  walking:
    "- in-place walk loop\n- alternating left/right foot steps\n- clear arm swing opposite the legs\n- subtle vertical bob\n- feet stay visible and plant, then lift",
  attack:
    "- in-place attack cycle, one strike or cast then return to idle\n- arms and torso drive the hit\n- feet stay planted, no locomotion",
  death:
    "- in-place death collapse, then hold the last pose\n- no get-up, no extra characters",
};

export const GENDER_SLOTS: Record<GenderId, Omit<PromptSlots, "MOTION">> = {
  female: {
    BODY: "The character is an adult woman. Keep a feminine silhouette. Clothing stays fully on.",
    HAIR: "- long hair secondary motion: delayed sway one-eighth cycle after the head bob, tips jitter on each step, roots stay attached to the scalp",
    CHEST: "- subtle chest bounce on each foot plant, delayed, small amplitude, follows the torso, no exaggeration",
  },
  male: {
    BODY: "The character is an adult man. Keep a masculine silhouette.",
    HAIR: "- hair and any cloak stay mostly with the skull; only light sway if the hair is long; no wild flutter",
    CHEST: "- firm torso; no chest bounce",
  },
};

export const DEFAULT_SECONDARY: Record<GenderId, { hair: number; chest: number }> = {
  female: { hair: 1, chest: 0.7 },
  male: { hair: 0.28, chest: 0 },
};

export function fillW2Prompt(
  gender: GenderId,
  animation: AnimationName,
  slots: Partial<PromptSlots> = {},
): string {
  const filled = { ...GENDER_SLOTS[gender], MOTION: ANIMATION_MOTION[animation], ...slots };
  return W2_TEMPLATE.replaceAll("{{ANIMATION_NAME}}", animation)
    .replace("{{BODY}}", filled.BODY)
    .replace("{{MOTION}}", filled.MOTION)
    .replace("{{HAIR}}", filled.HAIR)
    .replace("{{CHEST}}", filled.CHEST)
    .trim();
}

/** @deprecated use fillW2Prompt */
export function fillWalkPrompt(gender: GenderId, slots: Partial<Omit<PromptSlots, "MOTION">> = {}): string {
  return fillW2Prompt(gender, "walking", slots);
}

export function genderLabel(gender: GenderId): string {
  return gender === "female" ? "女" : "男";
}

export function w2DriverKnobs(animation: AnimationName): string {
  return `ANIMATION_NAME=${animation}\n# 16GB: run W2 body only. Weapons are W4/W5 later.`;
}
