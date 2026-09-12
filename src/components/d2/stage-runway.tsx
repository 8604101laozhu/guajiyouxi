"use client";

import {
  BACKGROUND_SPEC,
  BG_LAYER_SPEED,
  backgroundClip,
  backgroundThemePrompt,
  classifyBackgroundFrames,
  stageRunSeconds,
  type BgLayerId,
} from "@/lib/sprites/backgrounds";
import { layeredClips, type CosmeticName } from "@/lib/sprites/catalog";
import { MAGE_WALK_CLIP } from "@/lib/sprites/clip";
import { monsterChapterClip, monsterClip } from "@/lib/sprites/monsters";
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
      const path = clip as string;
      const first = await fetch(`/api/sprites?clip=${encodeURIComponent(path)}`)
        .then((res) => res.json() as Promise<SpriteIndex>)
        .catch(() => ({ clip: path, frames: [] as string[] }));
      if (cancelled) return;
      if (first.frames.length > 0 || !fallback || fallback === path) {
        setIndex({ clip: first.clip || path, frames: first.frames ?? [] });
        return;
      }
      const second = await fetch(`/api/sprites?clip=${encodeURIComponent(fallback)}`)
        .then((res) => res.json() as Promise<SpriteIndex>)
        .catch(() => ({ clip: fallback, frames: [] as string[] }));
      if (!cancelled) setIndex({ clip: second.clip || fallback, frames: second.frames ?? [] });
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
      <div className="absolute inset-x-0 bottom-0 h-[22%] bg-[#1a120c]" />
    </div>
  );
}

function LoopLayer({
  src,
  speed,
  offset,
}: {
  src: string;
  speed: number;
  offset: number;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [width, setWidth] = useState(0);

  function measure() {
    const img = imgRef.current;
    if (!img) return;
    setWidth(img.getBoundingClientRect().width);
  }

  useEffect(() => {
    measure();
  }, [src]);

  const tile = width > 0 ? width : 1;
  const shift = -((offset * speed) % tile);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="flex h-full w-max will-change-transform" style={{ transform: `translate3d(${shift}px,0,0)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt=""
          className="h-full w-auto max-w-none select-none"
          draggable={false}
          onLoad={measure}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="h-full w-auto max-w-none select-none" draggable={false} />
        {/* third copy avoids gaps when tile is shorter than viewport after cover-like height fit */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="h-full w-auto max-w-none select-none" draggable={false} />
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
  const ratio = power / Math.max(1, monster.recommendedPower);
  const willFail = ratio < 0.55;

  const bg = useClip(backgroundClip(chapter));
  const walk = useClip(layeredClips("walking", cosmetic).body, MAGE_WALK_CLIP);
  const attack = useClip(layeredClips("attack", cosmetic).body);
  const death = useClip(layeredClips("death", cosmetic).body);
  const mobWalk = useClip(
    monsterChapterClip(chapter, monster.kind, "walking"),
    monsterClip(monster.kind, "walking"),
  );
  const mobAttack = useClip(
    monsterChapterClip(chapter, monster.kind, "attack"),
    monsterClip(monster.kind, "attack"),
  );
  const mobDeath = useClip(
    monsterChapterClip(chapter, monster.kind, "death"),
    monsterClip(monster.kind, "death"),
  );
  const layers = classifyBackgroundFrames(bg.frames);
  const hasBg = layers.length > 0;

  /** preview = infinite loop; running = clear-stage fight; cleared/failed = fight end */
  const [mode, setMode] = useState<"preview" | "running" | "cleared" | "failed">("preview");
  const [hp, setHp] = useState(1);
  const [offset, setOffset] = useState(0);
  const [frame, setFrame] = useState(0);
  const [mobFrame, setMobFrame] = useState(0);
  const [copied, setCopied] = useState(false);
  const [previewOn, setPreviewOn] = useState(true);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const startedFor = useRef(0);
  const finished = useRef(false);
  const stageBox = useRef<HTMLDivElement>(null);
  const [viewW, setViewW] = useState(800);

  const groundBottomPct = (1 - BACKGROUND_SPEC.groundY) * 100;

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
    setMode("preview");
    setHp(1);
    setOffset(0);
    setPreviewOn(true);
    finished.current = false;
  }, [chapter, stage, difficulty]);

  useEffect(() => {
    if (!startToken || startToken === startedFor.current) return;
    if (mode === "running") return;
    startedFor.current = startToken;
    finished.current = false;
    setPreviewOn(false);
    setMode("running");
    setHp(1);
  }, [startToken, mode]);

  const scrolling = mode === "running" || (mode === "preview" && previewOn);

  useEffect(() => {
    if (!scrolling) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // ~140 px/s feels like a walk on a 720p strip
      setOffset((n) => n + dt * 140);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scrolling]);

  useEffect(() => {
    if (mode !== "running") return;
    const duration = stageRunSeconds(monster.kind, ratio);
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / (duration * 1000));
      setHp(1 - t);
      if (t >= 1) {
        setHp(0);
        setMode(willFail ? "failed" : "cleared");
        setPreviewOn(true);
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
  const animating = scrolling && actionFrames.length > 1;

  const mobActionFrames =
    mode === "cleared" && mobDeath.frames.length
      ? mobDeath.frames
      : mode === "running" && hp < 0.4 && mobAttack.frames.length
        ? mobAttack.frames
        : mobWalk.frames;
  const mobAnimating =
    mode !== "cleared" && scrolling && mobActionFrames.length > 1;

  useEffect(() => {
    setFrame(0);
  }, [actionFrames]);

  useEffect(() => {
    setMobFrame(0);
  }, [mobActionFrames]);

  useEffect(() => {
    if (!animating) return;
    const id = window.setInterval(() => {
      setFrame((n) => (n + 1) % actionFrames.length);
    }, 110);
    return () => window.clearInterval(id);
  }, [animating, actionFrames.length]);

  useEffect(() => {
    if (!mobAnimating) return;
    const id = window.setInterval(() => {
      setMobFrame((n) => (n + 1) % mobActionFrames.length);
    }, 120);
    return () => window.clearInterval(id);
  }, [mobAnimating, mobActionFrames.length]);

  const sprite = actionFrames[Math.min(frame, Math.max(0, actionFrames.length - 1))];
  const mobSprite =
    mode === "cleared" && !mobDeath.frames.length
      ? null
      : mobActionFrames[Math.min(mobFrame, Math.max(0, mobActionFrames.length - 1))];
  const prompt = backgroundThemePrompt(chapter);
  const hasMob = mobWalk.frames.length > 0 || mobAttack.frames.length > 0 || mobDeath.frames.length > 0;

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  function togglePreview() {
    if (mode === "running") return;
    setMode("preview");
    setPreviewOn((v) => !v);
  }

  return (
    <section className="flex flex-col gap-2 border border-[#6a5428] bg-[#120e0a] p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs tracking-[0.2em] text-[#c7a24a]">横板闯关</p>
          <p className="mt-1 text-sm text-[#f0ead8] sm:text-base">
            {monster.name} · {kindLabel(monster.kind)}
            {mode === "running"
              ? " · 清剿中"
              : mode === "cleared"
                ? " · 关卡结束"
                : mode === "failed"
                  ? " · 清剿失败"
                  : previewOn
                    ? " · 循环预览"
                    : " · 已暂停"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={togglePreview}
            disabled={mode === "running"}
            className="h-8 border border-[#6a5428] px-2 text-xs text-[#c7a24a] disabled:opacity-40"
          >
            {previewOn && mode !== "running" ? "暂停循环" : "无限循环预览"}
          </button>
          <button
            type="button"
            onClick={() => void copyPrompt()}
            className="h-8 border border-[#6a5428] px-2 text-xs text-[#c7a24a]"
          >
            {copied ? "已复制提示词" : "复制背景提示词"}
          </button>
        </div>
      </div>

      <div
        ref={stageBox}
        className="relative h-52 overflow-hidden border border-[#3a2a18] sm:h-72 md:h-[22rem]"
      >
        {hasBg ? (
          layers.map((layer) => (
            <LoopLayer
              key={`${layer.id}-${layer.src}`}
              src={layer.src}
              speed={BG_LAYER_SPEED[layer.id as BgLayerId] ?? BG_LAYER_SPEED.loop}
              offset={offset}
            />
          ))
        ) : (
          <div className="absolute inset-0 overflow-hidden">
            <div
              className="flex h-full will-change-transform"
              style={{
                width: viewW * 2,
                transform: `translate3d(${-(offset % viewW)}px,0,0)`,
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
        )}

        {/* ground guide — 78% line */}
        <div
          className="pointer-events-none absolute inset-x-0 z-[5] border-t border-dashed border-[#c7a24a]/35"
          style={{ top: `${BACKGROUND_SPEC.groundY * 100}%` }}
          title="地面线 78%"
        />

        {mode === "running" ? (
          <div className="absolute inset-x-3 top-3 z-10">
            <div className="mb-1 flex justify-between text-[11px] text-[#f0ead8]">
              <span>{kindLabel(monster.kind)}生命</span>
              <span>{Math.round(hp * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden border border-[#6a5428] bg-[#1a1008]">
              <div
                className={cn("h-full", willFail ? "bg-[#c07070]" : "bg-[#c7a24a]")}
                style={{ width: `${Math.max(0, hp) * 100}%` }}
              />
            </div>
          </div>
        ) : null}

        {sprite ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sprite}
            alt=""
            className="absolute left-[10%] z-10 h-[70%] w-auto max-w-[36%] object-contain object-bottom drop-shadow-[0_8px_12px_rgba(0,0,0,0.55)] sm:left-[14%]"
            style={{ bottom: `${groundBottomPct}%`, transform: "scaleX(-1)", transformOrigin: "bottom center" }}
            draggable={false}
          />
        ) : (
          <div
            className="absolute left-[14%] z-10 h-[60%] w-14 bg-[#2a1c10]"
            style={{ bottom: `${groundBottomPct}%` }}
          />
        )}

        {mobSprite ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mobSprite}
            alt=""
            className={cn(
              "absolute right-[8%] z-10 w-auto max-w-[40%] object-contain object-bottom drop-shadow-[0_8px_12px_rgba(0,0,0,0.55)] sm:right-[12%]",
              monster.kind === "boss" ? "h-[78%]" : monster.kind === "champion" ? "h-[72%]" : "h-[62%]",
              mode === "cleared" && "opacity-70",
            )}
            style={{ bottom: `${groundBottomPct}%`, transformOrigin: "bottom center" }}
            draggable={false}
          />
        ) : !hasMob ? (
          <div
            className={cn(
              "absolute right-[12%] z-10 border border-dashed border-[#6a5428]/50 bg-[#1a1008]/70",
              monster.kind === "boss" ? "h-[55%] w-16" : "h-[45%] w-12",
            )}
            style={{ bottom: `${groundBottomPct}%` }}
            title={`投放怪物：drop/mob/${monster.kind}/walking/`}
          />
        ) : null}

        {mode === "cleared" ? (
          <p className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[#0c0a08]/35 text-lg tracking-[0.3em] text-[#c7a24a]">
            关卡结束
          </p>
        ) : null}
        {mode === "failed" ? (
          <p className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[#0c0a08]/45 text-lg tracking-[0.3em] text-[#c07070]">
            清剿失败
          </p>
        ) : null}
        {!hasBg ? (
          <p className="absolute right-3 bottom-3 z-10 max-w-[14rem] text-right text-[11px] leading-4 text-[#cfc3a6]/80">
            还没有本章背景。把 loop.png 放到 drop/bg/{chapter}/
          </p>
        ) : !hasMob ? (
          <p className="absolute right-3 bottom-3 z-10 max-w-[14rem] text-right text-[11px] leading-4 text-[#cfc3a6]/80">
            还没有{kindLabel(monster.kind)}图。放到 drop/mob/{monster.kind}/walking/
          </p>
        ) : null}
      </div>

      <p className="text-[12px] leading-5 text-[#8a7a5a]">
        默认无限循环预览：人物踩在 78% 地面线上，背景无缝横滚；右侧是本关怪物。点「清剿本关」会进入战斗结算；虚线是地面参考线。
      </p>
    </section>
  );
}
