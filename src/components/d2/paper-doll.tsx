"use client";

import { getBase, offHandBlocked, PAPER_DOLL, SLOT_BY_ID, type Character, type Item, type SlotId } from "@/lib/d2";
import {
  COSMETIC_LABEL,
  COSMETIC_NAMES,
  cosmeticFromWeaponClass,
  type CosmeticName,
} from "@/lib/sprites/catalog";
import { cn } from "@/lib/utils";
import { qualityTint } from "./item-tooltip";

export function PaperDoll({
  character,
  selectedId,
  onSelect,
  onCosmetic,
}: {
  character: Character;
  selectedId: string | null;
  onSelect: (item: Item, slot: SlotId) => void;
  onCosmetic: (cosmetic: CosmeticName) => void;
}) {
  const blocked = offHandBlocked(character);
  const cosmetic = cosmeticFromWeaponClass(
    character.equipment.mainHand ? getBase(character.equipment.mainHand.baseId).weaponClass : undefined,
  );
  return (
    <div className="flex flex-col items-center gap-2">
      {PAPER_DOLL.map((row, rowIndex) => (
        <div key={rowIndex} className="flex items-center justify-center gap-2">
          {row.map((slot) => {
            const def = SLOT_BY_ID[slot];
            const item = character.equipment[slot];
            const isBlocked = slot === "offHand" && blocked;
            return (
              <button
                key={slot}
                type="button"
                disabled={isBlocked && !item}
                onClick={() => {
                  if (item) onSelect(item, slot);
                }}
                className={cn(
                  "relative flex h-[4.75rem] w-[4.75rem] sm:h-20 sm:w-20 flex-col items-center justify-center border text-center transition-colors",
                  isBlocked
                    ? "border-[#3a2a18] bg-[#140f0a] text-[#5a4a32]"
                    : "border-[#6a5428] bg-[#1a140c] hover:border-[#c7a24a]",
                  selectedId && item?.id === selectedId && "ring-1 ring-[#c7a24a]",
                )}
              >
                {item ? (
                  <>
                    <span
                      className="max-w-[4.4rem] px-1 text-[11px] leading-4 font-medium"
                      style={{ color: qualityTint(item.quality) }}
                    >
                      {item.name}
                    </span>
                    <span className="mt-0.5 text-[9px] text-[#8a7a5a]">{getBase(item.baseId).name}</span>
                  </>
                ) : (
                  <>
                    <span className="text-[11px] tracking-wide text-[#8a7a5a]">{def.short}</span>
                    <span className="text-[10px] text-[#5a4a32]">{isBlocked ? "双手占用" : def.name}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      ))}
      <DollFigure cosmetic={cosmetic} />
      <p className="text-[11px] text-[#8a7a5a]">换武器只换主手层，身体还是同一套 W2。</p>
      <div className="flex flex-wrap justify-center gap-1">
        {COSMETIC_NAMES.map((id) => (
          <button
            key={id}
            type="button"
            className={cn(
              "h-7 border px-2 text-[11px]",
              cosmetic === id ? "border-[#c7a24a] text-[#c7a24a]" : "border-[#6a5428] text-[#cfc3a6]",
            )}
            onClick={() => onCosmetic(id)}
          >
            {COSMETIC_LABEL[id]}
          </button>
        ))}
      </div>
    </div>
  );
}

function DollFigure({ cosmetic }: { cosmetic: CosmeticName }) {
  return (
    <svg viewBox="0 0 120 168" className="h-40 w-[7.5rem]" aria-label={`纸娃娃 ${COSMETIC_LABEL[cosmetic]}`}>
      <ellipse cx="62" cy="158" rx="28" ry="6" fill="#1a140c" />
      <circle cx="58" cy="28" r="16" fill="#2a1c10" stroke="#c7a24a" strokeWidth="1.4" />
      <path d="M58 44 L46 86 L50 128 L70 128 L74 86 Z" fill="#24180f" stroke="#c7a24a" strokeWidth="1.3" />
      <path d="M50 56 L22 90" fill="none" stroke="#8a7a5a" strokeWidth="3" strokeLinecap="round" />
      <path d="M70 56 L94 86" fill="none" stroke="#8a7a5a" strokeWidth="3" strokeLinecap="round" />
      <path d="M50 128 L42 154" fill="none" stroke="#8a7a5a" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M70 128 L80 154" fill="none" stroke="#8a7a5a" strokeWidth="3.2" strokeLinecap="round" />
      {cosmetic === "staff" ? (
        <>
          <line x1="18" y1="36" x2="30" y2="148" stroke="#c7a24a" strokeWidth="3" strokeLinecap="round" />
          <circle cx="16" cy="30" r="6" fill="none" stroke="#c7a24a" strokeWidth="2" />
        </>
      ) : null}
      {cosmetic === "sword" ? (
        <>
          <line x1="20" y1="58" x2="8" y2="118" stroke="#d8d0c0" strokeWidth="2.4" strokeLinecap="round" />
          <line x1="12" y1="72" x2="26" y2="66" stroke="#c7a24a" strokeWidth="2" />
        </>
      ) : null}
    </svg>
  );
}
