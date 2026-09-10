"use client";

import { getBase, offHandBlocked, PAPER_DOLL, SLOT_BY_ID, type Character, type Item, type SlotId } from "@/lib/d2";
import { cn } from "@/lib/utils";
import { qualityTint } from "./item-tooltip";

export function PaperDoll({
  character,
  selectedId,
  onSelect,
}: {
  character: Character;
  selectedId: string | null;
  onSelect: (item: Item, slot: SlotId) => void;
}) {
  const blocked = offHandBlocked(character);
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
    </div>
  );
}
