"use client";

import { MAGE_WALK_CLIP, sliceDirection } from "@/lib/sprites/clip";
import {
  ANIMATION_LABEL,
  COSMETIC_LABEL,
  layeredClips,
  type AnimationName,
  type CosmeticName,
} from "@/lib/sprites/catalog";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

type SpriteIndex = {
  clip: string;
  frames: string[];
  dir: string;
};

function useClip(clip: string | null, fallback = "") {
  const [index, setIndex] = useState<SpriteIndex | null>(null);

  useEffect(() => {
    if (!clip) {
      setIndex({ clip: "", frames: [], dir: "" });
      return;
    }
    const path = clip;
    let cancelled = false;
    async function load() {
      const first = await fetch(`/api/sprites?clip=${encodeURIComponent(path)}`)
        .then((res) => res.json() as Promise<SpriteIndex>)
        .catch(() => ({ clip: path, frames: [] as string[], dir: `public/sprites/${path}` }));
      if (cancelled) return;
      if (first.frames.length > 0 || !fallback || fallback === path) {
        setIndex(first);
        return;
      }
      const second = await fetch(`/api/sprites?clip=${encodeURIComponent(fallback)}`)
        .then((res) => res.json() as Promise<SpriteIndex>)
        .catch(() => ({ clip: fallback, frames: [] as string[], dir: `public/sprites/${fallback}` }));
      if (!cancelled) setIndex(second);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [clip, fallback]);

  return index;
}

export function SpriteWalkPreview({
  animation,
  cosmetic,
}: {
  animation: AnimationName;
  cosmetic: CosmeticName;
}) {
  const layers = layeredClips(animation, cosmetic);
  const fallback = animation === "walking" ? MAGE_WALK_CLIP : "";
  const bodyIndex = useClip(layers.body, fallback);
  const weaponIndex = useClip(layers.weapon);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [fps, setFps] = useState(8);
  const [framesPerDir, setFramesPerDir] = useState(0);

  useEffect(() => {
    setFrame(0);
  }, [animation, cosmetic]);

  const clipFrames = useMemo(() => {
    const all = bodyIndex?.frames ?? [];
    return sliceDirection(all, framesPerDir, 0);
  }, [bodyIndex?.frames, framesPerDir]);

  const weaponFrames = useMemo(() => {
    const all = weaponIndex?.frames ?? [];
    return sliceDirection(all, framesPerDir, 0);
  }, [weaponIndex?.frames, framesPerDir]);

  useEffect(() => {
    if (!playing || clipFrames.length < 2) return;
    const id = window.setInterval(() => {
      setFrame((n) => (n + 1) % clipFrames.length);
    }, Math.max(40, 1000 / fps));
    return () => window.clearInterval(id);
  }, [playing, clipFrames.length, fps]);

  const current = clipFrames[Math.min(frame, Math.max(0, clipFrames.length - 1))];
  const weapon =
    weaponFrames.length > 0
      ? weaponFrames[Math.min(frame, Math.max(0, weaponFrames.length - 1))]
      : undefined;
  const usingFallback = (bodyIndex?.clip ?? "") === MAGE_WALK_CLIP;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs tracking-[0.2em] text-[#c7a24a]">
        {ANIMATION_LABEL[animation]} · {COSMETIC_LABEL[cosmetic]}
      </p>
      <div
        className="relative flex min-h-96 items-center justify-center border border-[#3a2a18] bg-[#0c0a08]"
        style={{
          backgroundImage:
            "linear-gradient(45deg,#1a140c 25%,transparent 25%),linear-gradient(-45deg,#1a140c 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#1a140c 75%),linear-gradient(-45deg,transparent 75%,#1a140c 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
          backgroundColor: "#120e0a",
        }}
      >
        {current ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current} alt={`${animation} ${frame}`} className="max-h-96 max-w-full object-contain" />
            {weapon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={weapon}
                alt={`${cosmetic} ${frame}`}
                className="pointer-events-none absolute inset-0 m-auto max-h-96 max-w-full object-contain"
              />
            ) : null}
          </>
        ) : (
          <p className="max-w-[18rem] px-3 text-center text-[12px] leading-5 text-[#8a7a5a]">
            还没有 W2 身体帧。放到
            <br />
            {`public/sprites/inbox/base_animations/${animation}/`}
            {cosmetic !== "unarmed" ? (
              <>
                <br />
                {`武器层以后放 cosmetics/${cosmetic}/${animation}/`}
              </>
            ) : null}
          </p>
        )}
      </div>
      {clipFrames.length > 0 ? (
        <div className="grid grid-cols-4 gap-1">
          {clipFrames.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => {
                setPlaying(false);
                setFrame(i);
              }}
              className={cn(
                "border bg-[#0c0a08] p-0.5",
                i === frame ? "border-[#c7a24a]" : "border-[#3a2a18]",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`帧 ${i}`} className="h-12 w-full object-contain" />
            </button>
          ))}
        </div>
      ) : null}
      <p className="text-[11px] text-[#8a7a5a]">
        {clipFrames.length
          ? `${clipFrames.length} 帧身体 · 武器层 ${weaponFrames.length || "未到"} · 当前 ${frame + 1}/${clipFrames.length}${
              usingFallback ? " · 现在还是同姿态试色" : ""
            }`
          : "等待 W2 身体帧"}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={cn(
            "h-7 border px-2 text-xs",
            playing ? "border-[#c7a24a] text-[#c7a24a]" : "border-[#6a5428] text-[#cfc3a6]",
          )}
          onClick={() => setPlaying((v) => !v)}
        >
          {playing ? "暂停" : "播放"}
        </button>
        <label className="flex items-center gap-1 text-[11px] text-[#8a7a5a]">
          {fps} fps
          <input
            type="range"
            min={4}
            max={16}
            value={fps}
            onChange={(event) => setFps(Number(event.target.value))}
            className="w-20 accent-[#c7a24a]"
          />
        </label>
        <label className="flex items-center gap-1 text-[11px] text-[#8a7a5a]">
          每向帧
          <select
            value={framesPerDir}
            onChange={(event) => {
              setFramesPerDir(Number(event.target.value));
              setFrame(0);
            }}
            className="h-7 border border-[#6a5428] bg-[#0c0a08] px-1 text-[#cfc3a6]"
          >
            <option value={0}>整段循环</option>
            <option value={4}>4</option>
            <option value={6}>6</option>
            <option value={8}>8</option>
          </select>
        </label>
      </div>
    </div>
  );
}
