"use client";

import { Button } from "@/components/ui/button";
import {
  CHAPTERS,
  DIFFICULTIES,
  STAGES_PER_CHAPTER,
  chapterName,
  combatPower,
  formatCompact,
  getStage,
  kindLabel,
  stageOdds,
  type Character,
  type DifficultyId,
  type FarmResult,
} from "@/lib/d2";
import { cn } from "@/lib/utils";

export function CampaignBench({
  character,
  gearMf,
  extraMf,
  onExtraMf,
  chapter,
  stage,
  difficulty,
  gold,
  lastFarm,
  onChapter,
  onStage,
  onDifficulty,
  onFarm,
  onFarmMany,
}: {
  character: Character;
  gearMf: number;
  extraMf: number;
  onExtraMf: (n: number) => void;
  chapter: number;
  stage: number;
  difficulty: DifficultyId;
  gold: number;
  lastFarm: FarmResult | null;
  onChapter: (n: number) => void;
  onStage: (n: number) => void;
  onDifficulty: (d: DifficultyId) => void;
  onFarm: () => void;
  onFarmMany: () => void;
}) {
  const monster = getStage(chapter, stage, difficulty);
  const power = combatPower(character);
  const ratio = power / monster.recommendedPower;
  const odds = stageOdds(monster, extraMf + gearMf);

  return (
    <section className="flex flex-col gap-4 border border-[#6a5428] bg-[#140f0a] p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.2em] text-[#c7a24a]">挂机关卡</p>
          <p className="mt-1 text-lg text-[#f0ead8]">
            {chapterName(chapter)} · {chapter}-{stage} {kindLabel(monster.kind)}
          </p>
        </div>
        <p className="text-sm text-[#c7a24a]">金币 {formatCompact(gold)}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {DIFFICULTIES.map((d) => (
          <Button
            key={d.id}
            type="button"
            size="sm"
            variant={difficulty === d.id ? "default" : "outline"}
            onClick={() => onDifficulty(d.id)}
          >
            {d.name}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={chapter}
          onChange={(event) => onChapter(Number(event.target.value))}
          className="h-8 border border-[#6a5428] bg-[#0c0a08] px-2 text-sm text-[#f0ead8]"
        >
          {CHAPTERS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.act} {c.name}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: STAGES_PER_CHAPTER }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onStage(n)}
              className={cn(
                "h-8 min-w-8 border px-2 text-sm",
                n === stage ? "border-[#c7a24a] bg-[#2a1c10] text-[#c7a24a]" : "border-[#3a2a18] text-[#cfc3a6]",
                n === 10 && "text-[#ffb070]",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2 text-sm text-[#cfc3a6] sm:grid-cols-2 lg:grid-cols-4">
        <span>怪物等级 {monster.mlvl}</span>
        <span>生命 {formatCompact(monster.hp)}</span>
        <span>防御 {formatCompact(monster.defense)}</span>
        <span>抽装 {monster.picks} 次 · 空箱 {monster.noDrop}%</span>
        <span>TC {monster.tcLevel}{monster.uber ? " · Uber 品质行" : ""}</span>
        <span>
          推荐战力 {formatCompact(monster.recommendedPower)} / 当前 {formatCompact(power)}
        </span>
        <span className={ratio < 0.55 ? "text-[#c07070]" : ratio >= 1.35 ? "text-[#7dff7d]" : "text-[#c7a24a]"}>
          {ratio < 0.55 ? "战力不足" : ratio >= 1.35 ? "可碾压" : ratio >= 1 ? "可清剿" : "勉强可打"}
        </span>
        <span>额外 MF {extraMf}%（装备 {gearMf}%）</span>
      </div>

      <label className="flex max-w-md flex-col gap-2 text-xs text-[#cfc3a6]">
        额外 MF {extraMf}%
        <input
          type="range"
          min={0}
          max={400}
          value={extraMf}
          onChange={(event) => onExtraMf(Number(event.target.value))}
          className="w-full accent-[#c7a24a]"
        />
      </label>

      <p className="text-[12px] leading-5 text-[#8a7a5a]">
        单件品质按暗黑 2 ItemRatio：暗金 → 套装（目前空表，成功则落到稀有）→ 稀有 → 魔法 → 白板。MF 暗金衰减 250、稀有 600，魔法不衰减。
        关卡血量、抽次、空箱率和 TC 按手游章节难度抬。本关大约 暗金 {odds.unique} · 稀有 {odds.rare} · 魔法 {odds.magic}（按 TC 中位 qlvl 估算）。
      </p>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onFarm}>
          清剿本关
        </Button>
        <Button type="button" variant="outline" onClick={onFarmMany}>
          挂机 10 波
        </Button>
      </div>

      {lastFarm ? (
        <p className="text-sm text-[#f0ead8]">
          {lastFarm.ok ? (
            <>
              {lastFarm.reason} · 金币 +{formatCompact(lastFarm.gold)} · 掉落 {lastFarm.items.length} / 抽 {lastFarm.picks}
              {lastFarm.noDrops ? ` · 空箱 ${lastFarm.noDrops}` : ""}
              {lastFarm.items[0] ? ` · 首件 ${lastFarm.items[0].name}` : ""}
            </>
          ) : (
            <span className="text-[#c07070]">{lastFarm.reason}</span>
          )}
        </p>
      ) : (
        <p className="text-sm text-[#8a7a5a]">选难度和关卡后清剿。空箱是暗黑 2 的 NoDrop；地狱和首领会多抽几次。</p>
      )}
    </section>
  );
}
