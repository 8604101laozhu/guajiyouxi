export type GenderId = "female" | "male";

export type PromptSlots = {
  BODY: string;
  HAIR: string;
  CHEST: string;
};

export const WALK_I2V_TEMPLATE = `Animate this single character into a simple in-place side-view walk cycle for a 2D game.

{{BODY}}
The character faces left for the entire clip.
Preserve the exact identity, painted illustration look, proportions, palette, costume, and silhouette from the input image.
Do not turn toward any other direction. Do not pivot or rotate the body to a new view.

Keep the camera fixed and centered. Keep the framing unchanged.
Keep the character centered on a flat empty background. No floor, room, horizon, or environment.

Motion:
- in-place walk loop
- alternating left/right foot steps
- clear arm swing opposite the legs
- subtle vertical bob
{{HAIR}}
{{CHEST}}
- feet stay visible and plant, then lift
- character does not travel across the frame

One character only. No extra props, labels, camera move, zoom, attack, or magic effects.`;

export const GENDER_SLOTS: Record<GenderId, PromptSlots> = {
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

export function fillWalkPrompt(gender: GenderId, slots: Partial<PromptSlots> = {}): string {
  const filled = { ...GENDER_SLOTS[gender], ...slots };
  return WALK_I2V_TEMPLATE.replace("{{BODY}}", filled.BODY)
    .replace("{{HAIR}}", filled.HAIR)
    .replace("{{CHEST}}", filled.CHEST)
    .trim();
}

export function genderLabel(gender: GenderId): string {
  return gender === "female" ? "女" : "男";
}
