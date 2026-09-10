"use client";

import { sliceDirection } from "@/lib/sprites/clip";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

type SpriteIndex = {
  clip: string;
  frames: string[];
  dir: string;
};

export function SpriteWalkPreview({ clip = "mage/walk" }: { clip?: string }) {
  const [index, setIndex] = useState<SpriteIndex | null>(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [fps, setFps] = useState(8);
  const [framesPerDir, setFramesPerDir] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sprites?clip=${encodeURIComponent(clip)}`)
      .then((res) => res.json() as Promise<SpriteIndex>)
      .then((data) => {
        if (!cancelled) {
          setIndex(data);
          setFrame(0);
        }
      })
      .catch(() => {
        if (!cancelled) setIndex({ clip, frames: [], dir: `public/sprites/${clip}` });
      });
    return () => {
      cancelled = true;
    };
  }, [clip]);

  const clipFrames = useMemo(() => {
    const all = index?.frames ?? [];
    return sliceDirection(all, framesPerDir, 0);
  }, [index?.frames, framesPerDir]);

  useEffect(() => {
    if (!playing || clipFrames.length < 2) return;
    const id = window.setInterval(() => {
      setFrame((n) => (n + 1) % clipFrames.length);
    }, Math.max(40, 1000 / fps));
    return () => window.clearInterval(id);
  }, [playing, clipFrames.length, fps]);

  const current = clipFrames[Math.min(frame, Math.max(0, clipFrames.length - 1))];

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs tracking-[0.2em] text-[#c7a24a]">法师走路</p>
      <div
        className="flex min-h-72 items-center justify-center border border-[#3a2a18] bg-[#0c0a08]"
        style={{
          backgroundImage:
            "linear-gradient(45deg,#1a140c 25%,transparent 25%),linear-gradient(-45deg,#1a140c 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#1a140c 75%),linear-gradient(-45deg,transparent 75%,#1a140c 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
          backgroundColor: "#120e0a",
        }}
      >
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current}
            alt={`walk ${frame}`}
            className="max-h-72 max-w-full object-contain"
          />
        ) : (
          <p className="max-w-[16rem] px-3 text-center text-[12px] leading-5 text-[#8a7a5a]">
            还没有帧。把本机
            <br />
            `法师/sprites/walk` 里纯数字 png
            <br />
            拷到 `public/sprites/mage/walk/`
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
        {index?.frames.length
          ? `${index.frames.length} 帧 · 当前 ${frame + 1}/${clipFrames.length} · 目前是同姿态试色，不是步态循环`
          : "等待关键帧"}
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
