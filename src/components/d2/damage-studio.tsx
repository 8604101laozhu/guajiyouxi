"use client";

import {
  averagePacket,
  breakdownText,
  characterAttackRating,
  characterDefense,
  characterLife,
  characterMana,
  chanceToHit,
  formatRange,
  resistTotal,
  totalAttributes,
  weaponDamageInputs,
  type Character,
  type HitRoll,
} from "@/lib/d2";
import { Button } from "@/components/ui/button";

export function DamageStudio({
  character,
  dummyDefense,
  dummyLevel,
  extraMf,
  hits,
  onSwing,
  auto,
  onToggleAuto,
}: {
  character: Character;
  dummyDefense: number;
  dummyLevel: number;
  extraMf: number;
  hits: HitRoll[];
  onSwing: () => void;
  auto: boolean;
  onToggleAuto: () => void;
}) {
  const { str, dex, vit, nrg, stats } = totalAttributes(character);
  const breakdown = weaponDamageInputs(character);
  const ar = characterAttackRating(character);
  const def = characterDefense(character);
  const cth = chanceToHit(ar, dummyDefense, character.level, dummyLevel);
  const avg = averagePacket(breakdown);
  const last = hits[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-[#f0ead8] sm:grid-cols-4">
        <Stat label="力量" value={str} />
        <Stat label="敏捷" value={dex} />
        <Stat label="体力" value={vit} />
        <Stat label="能量" value={nrg} />
        <Stat label="生命" value={characterLife(character)} />
        <Stat label="法力" value={characterMana(character)} />
        <Stat label="防御" value={def} />
        <Stat label="准确率" value={ar} />
        <Stat label="MF" value={`${stats.magicFind + extraMf}%`} />
        <Stat label="火抗" value={`${resistTotal(stats, "fireRes")}%`} />
        <Stat label="冰抗" value={`${resistTotal(stats, "coldRes")}%`} />
        <Stat label="电抗" value={`${resistTotal(stats, "lightningRes")}%`} />
      </div>

      <div className="border border-[#6a5428] bg-[#140f0a] p-3">
        <p className="text-xs tracking-[0.2em] text-[#c7a24a]">伤害</p>
        <p className="mt-1 font-medium text-[#f0ead8]">
          物理 {formatRange(breakdown.physical)}
          <span className="ml-2 text-[#ff6b4a]">火 {formatRange(breakdown.fire)}</span>
          <span className="ml-2 text-[#8ec8ff]">冰 {formatRange(breakdown.cold)}</span>
          <span className="ml-2 text-[#ffe566]">电 {formatRange(breakdown.lightning)}</span>
        </p>
        <p className="mt-1 text-sm text-[#cfc3a6]">
          均伤 {avg.toFixed(1)} · {breakdown.aps.toFixed(2)} 击/秒 · DPS {(avg * breakdown.aps).toFixed(1)}
        </p>
        <p className="mt-1 text-sm text-[#cfc3a6]">
          对木桩命中率 {cth.toFixed(1)}%（准确 {ar} vs 防御 {dummyDefense}，等级 {character.level}/{dummyLevel}）
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onSwing}>
          挥击一次
        </Button>
        <Button type="button" variant={auto ? "secondary" : "outline"} onClick={onToggleAuto}>
          {auto ? "停止自动挥击" : "自动挥击"}
        </Button>
      </div>

      {last ? (
        <p className="text-sm text-[#f0ead8]">
          {last.hit ? (
            <>
              命中 {last.total}
              {last.crit ? " · 致命一击" : last.deadly ? " · 死伤" : ""}
              <span className="text-[#cfc3a6]">
                {" "}
                （物 {last.physical}
                {last.fire ? ` 火 ${last.fire}` : ""}
                {last.cold ? ` 冰 ${last.cold}` : ""}
                {last.lightning ? ` 电 ${last.lightning}` : ""}
                {last.poison ? ` 毒 ${last.poison}` : ""}）
              </span>
            </>
          ) : (
            <span className="text-[#c07070]">未命中</span>
          )}
        </p>
      ) : (
        <p className="text-sm text-[#8a7a5a]">还没有挥击。每次命中会在物理最小–最大之间重新掷骰。</p>
      )}

      <div>
        <p className="text-xs tracking-[0.2em] text-[#c7a24a]">公式拆解</p>
        <ul className="mt-2 space-y-1 text-[12px] leading-5 text-[#cfc3a6]">
          {breakdownText(breakdown).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      {hits.length > 0 ? (
        <div>
          <p className="text-xs tracking-[0.2em] text-[#c7a24a]">最近掷骰</p>
          <ul className="mt-1 max-h-28 overflow-auto font-mono text-[11px] text-[#8a7a5a]">
            {hits.slice(0, 12).map((hit, index) => (
              <li key={`${hit.total}-${index}`}>
                {hit.hit
                  ? `${hit.total} 物${hit.physical}${hit.crit ? " 致命" : hit.deadly ? " 死伤" : ""}`
                  : "未命中"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-[#8a7a5a]">{label}</span>
      <span>{value}</span>
    </div>
  );
}
