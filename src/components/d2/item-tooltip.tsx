"use client";

import { QUALITY_COLOR, tooltipLines, type Item, type Quality } from "@/lib/d2";
import { cn } from "@/lib/utils";

export function ItemTooltip({
  item,
  showRange,
  slotLabel,
  className,
}: {
  item: Item;
  showRange: boolean;
  slotLabel?: string;
  className?: string;
}) {
  const lines = tooltipLines(item, showRange);
  return (
    <div
      className={cn(
        "min-w-[220px] max-w-[280px] border border-[#8a6a2f] bg-[#0c0a08]/95 px-3 py-2.5 shadow-[0_0_0_1px_#2a1c10,0_12px_32px_rgba(0,0,0,0.55)]",
        className,
      )}
    >
      {slotLabel ? (
        <p className="mb-1 text-[10px] tracking-widest text-[#8a7a5a] uppercase">{slotLabel}</p>
      ) : null}
      {lines.map((line, index) => (
        <p
          key={`${line.text}-${index}`}
          className={cn("text-[13px] leading-5", line.muted && "text-[#8a7a5a]")}
          style={{ color: line.muted ? undefined : line.color ?? "#f0ead8" }}
        >
          {line.text}
        </p>
      ))}
    </div>
  );
}

export function qualityTint(quality: Quality): string {
  return QUALITY_COLOR[quality];
}
