"use client";

import {
  BG_LAYER_SPEED,
  backgroundClip,
  backgroundThemePrompt,
  classifyBackgroundFrames,
  stageRunSeconds,
  type BgLayerId,
} from "@/lib/sprites/backgrounds";
import { layeredClips, type CosmeticName } from "@/lib/sprites/catalog";
import { MAGE_WALK_CLIP } from "@/lib/sprites/clip";
import { combatPower, getStage, kindLabel, type Character, type DifficultyId } from "@/lib/d2";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

type SpriteIndex = { clip: string; frames: string[] };

function useClip(clip: string | null, fallback = "") {
  const [index, setIndex] = useState<SpriteIndex>({ clip: "", frames: [] });
  useEffect(() => {
    if (!clip) {
      setIndex({ clip: "", frames: [] });
      return;
    }
    let cancelled = false;
    async function load() {
      const first = await fetch(`/api/sprites?clip=${encodeURIComponent(clip)}`)
        .then((res) => res.json() as Promise<SpriteIndex>)
        .catch(() => ({ clip, frames: [] as string[] }));
      if (cancelled) return;
      if (first.frames.length > 0 || !fallback || fallback === clip) {
        setIndex(first);
        return;
      }
      const second = await fetch(`/api/sprites?clip=${encodeURIComponent(fallback)}`)
        .then((res) => res.json() as Promise<SpriteIndex>)
        .catch(() => ({ clip: fallback, frames: [] as string[] }));
      if (!cancelled) setIndex(second);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [clip, fallback]);
  return index;
}

function FallbackStrip({ chapter }: { chapter: number }) {
  const hue = 12 + ((chapter - 1) * 17) % 50;
  return (
    <div
      className="relative h-full w-full shrink-0 overflow-hidden"
      style={{
        background: `linear-gradient(180deg, hsl(${hue} 18% 12%) 0%, hsl(${hue} 22% 18%) 42%, hsl(${hue} 16% 10%) 42%, hsl(${hue} 28% 8%) 78%, hsl(${hue} 20% 6%) 78%, hsl(${hue} 14% 5%) 100%)`,
      }}
    >
      <div
        className="absolute inset-x-0 top-[18%] h-10 opacity-40"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, transparent 0 90px, rgba(255,220,160,0.08) 90px 220px, transparent 220px 340px)",
        }}
      />
      <div
        className="absolute inset-x-0 bottom-[22%] h-16 opacity-50"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(40,28,16,0.9) 0 48px, rgba(70,48,24,0.55) 48px 86px, rgba(30,20,12,0.9) 86px 140px)",
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-[22%] bg-[#1a120c]" />
    </div>
  );
}

function ParallaxLayer({
  src,
  speed,
  offset,
  className,
}: {
  src: string;
  speed: number;
  offset: number;
  className?: string;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [width, setWidth] = useState(0);

  function measure() {
    const img = imgRef.current;
    if (!img) return;
    setWidth(img.getBoundingClientRect().width);
  }

  const shift = width > 0 ? -((offset * speed) % width) : 0;

  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      <div className="flex h-full w-max" style={{ transform: `translateX(${shift}px)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imgRef} src={src} alt="" className="h-full w-auto max-w-none select-none" onLoad={measure} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="h-full w-auto max-w-none select-none" />
      </div>
    </div>
  );
}

export function StageRunway({
  chapter,
  stage,
  difficulty,
  character,
  cosmetic,
  startToken,
  onComplete,
}: {
  chapter: number;
  stage: number;
  difficulty: DifficultyId;
  character: Character;
  cosmetic: CosmeticName;
  startToken: number;
  onComplete: () => void;
}) {
  const monster = getStage(chapter, stage, difficulty);
  const power = combatPower(character);
  const ratio = power / monster.recommendedPower;
  const willFail = ratio < 0.55;
  const bg = useClip(backgroundClip(chapter));
  const walk = useClip(layeredClips("walking", "unarmed").body, MAGE_WALK_CLIP);
  const attack = useClip(layeredClips("attack", cosmetic).body);
  const death = useClip(layeredClips("death", "unarmed").body);
  const layers = classifyBackgroundFrames(bg.frames);

  const [mode, setMode] = useState<"idle" | "running" | "cleared" | "failed">("idle");
  const [hp, setHp] = useState(1);
  const [offset, setOffset] = useState(0);
  const [frame, setFrame] = useState(0);
  const [copied, setCopied] = useState(false);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const startedFor = useRef(0);
  const finished = useRef(false);
  const stageBox = useRef<HTMLDivElement>(null);
  const [viewW, setViewW] = useState(800);

  useEffect(() => {
    const box = stageBox.current;
    if (!box) return;
    const apply = () => setViewW(box.clientWidth || 800);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setMode("idle");
    setHp(1);
    setOffset(0);
  }, [chapter, stage, difficulty]);

  useEffect(() => {
    if (!startToken || startToken === startedFor.current) return;
    if (mode === "running") return;
    startedFor.current = startToken;
    finished.current = false;
    setMode("running");
    setHp(1);
  }, [startToken, mode]);

  useEffect(() => {
    if (mode !== "running") return;
    const duration = stageRunSeconds(monster.kind, ratio);
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / (duration * 1000));
      setHp(1 - t);
      setOffset((n) => n + 2.4);
      if (t >= 1) {
        setHp(0);
        setMode(willFail ? "failed" : "cleared");
        if (!finished.current) {
          finished.current = true;
          completeRef.current();
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode, monster.kind, ratio, willFail]);

  const actionFrames =
    mode === "failed" && death.frames.length
      ? death.frames
      : mode === "running" && hp < 0.35 && attack.frames.length
        ? attack.frames
        : walk.frames;
  const playing = mode === "running" && actionFrames.length > 1;

  useEffect(() => {
    setFrame(0);
  }, [actionFrames]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setFrame((n) => (n + 1) % actionFrames.length);
    }, 120);
    return () => window.clearInterval(id);
  }, [playing, actionFrames.length]);

  const sprite = actionFrames[Math.min(frame, Math.max(0, actionFrames.length - 1))];
  const prompt = backgroundThemePrompt(chapter);
  const scrolling = mode === "running";

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="flex flex-col gap-2 border border-[#6a5428] bg-[#120e0a] p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs tracking-[0.2em] text-[#c7a24a]">横板闯关</p>
          <p className="mt-1 text-sm text-[#f0ead8] sm:text-base">
            {monster.name} · {kindLabel(monster.kind)}
            {mode === "running" ? " · 行进中" : mode === "cleared" ? " · 关卡结束" : mode === "failed" ? " · 清剿失败" : " · 待命"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void copyPrompt()}
          className="h-8 border border-[#6a5428] px-2 text-xs text-[#c7a24a]"
        >
          {copied ? "已复制出图提示" : "复制本章背景提示词"}
        </button>
      </div>

      <div ref={stageBox} className="relative h-52 overflow-hidden border border-[#3a2a18] sm:h-72 md:h-80">
        {layers.length === 0 ? (
          <div className="absolute inset-0 overflow-hidden">
            <div
              className="flex h-full"
              style={{
                width: viewW * 2,
                transform: scrolling ? `translateX(${-(offset % viewW)}px)` : undefined,
              }}
            >
              <div className="h-full shrink-0" style={{ width: viewW }}>
                <FallbackStrip chapter={chapter} />
              </div>
              <div className="h-full shrink-0" style={{ width: viewW }}>
                <FallbackStrip chapter={chapter} />
              </div>
            </div>
          </div>
        ) : (
          layers.map((layer) => (
            <ParallaxLayer
              key={`${layer.id}-${layer.src}`}
              src={layer.src}
              speed={BG_LAYER_SPEED[layer.id as BgLayerId]}
              offset={scrolling ? offset : Math.floor(offset)}
            />
          ))
        )}

        <div className="absolute inset-x-3 top-3 z-10">
          <div className="mb-1 flex justify-between text-[11px] text-[#f0ead8]">
            <span>{kindLabel(monster.kind)}生命</span>
            <span>{Math.round(hp * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden border border-[#6a5428] bg-[#1a1008]">
            <div
              className={cn("h-full", willFail && mode !== "idle" ? "bg-[#c07070]" : "bg-[#c7a24a]")}
              style={{ width: `${Math.max(0, hp) * 100}%` }}
            />
          </div>
        </div>

        {sprite ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sprite}
            alt=""
            className="absolute bottom-[6%] left-[8%] z-10 h-[78%] w-auto max-w-[38%] object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,0.55)] sm:left-[12%]"
          />
        ) : (
          <div className="absolute bottom-[8%] left-[12%] z-10 h-[70%] w-16 rounded-sm bg-[#2a1c10]" />
        )}

        {mode === "cleared" ? (
          <p className="absolute inset-0 z-20 flex items-center justify-center bg-[#0c0a08]/45 text-lg tracking-[0.3em] text-[#c7a24a]">
            关卡结束
          </p>
        ) : null}
        {mode === "failed" ? (
          <p className="absolute inset-0 z-20 flex items-center justify-center bg-[#0c0a08]/55 text-lg tracking-[0.3em] text-[#c07070]">
            清剿失败
          </p>
        ) : null}
        {layers.length === 0 && mode === "idle" ? (
          <p className="absolute right-3 bottom-3 z-10 max-w-[14rem] text-right text-[11px] leading-4 text-[#cfc3a6]/80">
            还没有本章背景。3840×720 无缝横条丢进 drop/背景/{chapter}/ ，文件名 loop.png
          </p>
        ) : null}
      </div>

      <p className="text-[12px] leading-5 text-[#8a7a5a]">
        点「清剿本关」后背景循环滚动，直到把{monster.kind === "boss" ? "首领" : "本关怪物"}打完。一章共用一张循环条，不必每小关重画。
        左右边缘必须能接上；不要画人物。
      </p>
    </section>
  );
}
