"use client";

import { SpriteWalkPreview } from "./sprite-walk";
import {
  ANIMATION_LABEL,
  ANIMATION_NAMES,
  COSMETIC_LABEL,
  COSMETIC_NAMES,
  type AnimationName,
  type CosmeticName,
} from "@/lib/sprites/catalog";
import { OPENPOSE_LIMB_COLORS, OPENPOSE_LIMBS, cycleSkeleton } from "@/lib/sprites/openpose";
import {
  DEFAULT_SECONDARY,
  fillW2Prompt,
  genderLabel,
  w2DriverKnobs,
  type GenderId,
} from "@/lib/sprites/pipeline";
import { chestSecondary, hairSecondary, strandPoints } from "@/lib/sprites/secondary";
import { weaponPolyline } from "@/lib/sprites/weapon";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";

const TEXTURE = "/sprites/mage/rig/texture.png";

export function MageWalkStudio({
  cosmetic,
  onCosmetic,
}: {
  cosmetic: CosmeticName;
  onCosmetic: (cosmetic: CosmeticName) => void;
}) {
  const [mode, setMode] = useState<"cycle" | "stills">("cycle");
  const [animation, setAnimation] = useState<AnimationName>("walking");
  const [gender, setGender] = useState<GenderId>("female");
  const [playing, setPlaying] = useState(true);
  const [fps, setFps] = useState(10);
  const [phase, setPhase] = useState(0);
  const [hairAmt, setHairAmt] = useState(DEFAULT_SECONDARY.female.hair);
  const [chestAmt, setChestAmt] = useState(DEFAULT_SECONDARY.female.chest);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textureRef = useRef<HTMLImageElement | null>(null);
  const [ready, setReady] = useState(0);

  const w2Prompt = useMemo(() => {
    const slots =
      gender === "female" && chestAmt <= 0.05
        ? { CHEST: "- no chest bounce; keep the bust locked to the torso" }
        : undefined;
    return `${w2DriverKnobs(animation)}\n\n${fillW2Prompt(gender, animation, slots)}`;
  }, [gender, chestAmt, animation]);

  useEffect(() => {
    const defaults = DEFAULT_SECONDARY[gender];
    setHairAmt(defaults.hair);
    setChestAmt(defaults.chest);
  }, [gender]);

  useEffect(() => {
    const img = new Image();
    img.src = TEXTURE;
    img.onload = () => {
      textureRef.current = img;
      setReady((n) => n + 1);
    };
  }, []);

  useEffect(() => {
    if (!playing || mode !== "cycle") return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setPhase((p) => (p + dt * fps) % 8);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, fps, mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const tex = textureRef.current;
    let ox = 0;
    let oy = 0;
    let sw = w;
    let sh = h;
    if (tex) {
      const scale = Math.min((w * 0.92) / tex.width, (h * 0.92) / tex.height);
      sw = tex.width * scale;
      sh = tex.height * scale;
      ox = (w - sw) / 2;
      oy = (h - sh) / 2;
      ctx.globalAlpha = 0.88;
      ctx.drawImage(tex, ox, oy, sw, sh);
      ctx.globalAlpha = 1;
    }

    const t = phase / 8;
    const joints = cycleSkeleton(animation, t, sw, sh).map((p) => ({ x: p.x + ox, y: p.y + oy }));
    ctx.lineCap = "round";
    ctx.lineWidth = 6;
    OPENPOSE_LIMBS.forEach(([a, b], i) => {
      const pa = joints[a];
      const pb = joints[b];
      ctx.strokeStyle = OPENPOSE_LIMB_COLORS[i];
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    });
    joints.forEach((p, i) => {
      ctx.fillStyle = OPENPOSE_LIMB_COLORS[i % OPENPOSE_LIMB_COLORS.length];
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    const glyph = weaponPolyline(cosmetic, joints[4], joints[3]);
    if (glyph) {
      ctx.strokeStyle = cosmetic === "staff" ? "#c7a24a" : "#d8d0c0";
      ctx.lineWidth = cosmetic === "staff" ? 4 : 3;
      ctx.beginPath();
      ctx.moveTo(glyph[0].x, glyph[0].y);
      ctx.lineTo(glyph[1].x, glyph[1].y);
      ctx.stroke();
      if (cosmetic === "staff") {
        ctx.fillStyle = "#c7a24a";
        ctx.beginPath();
        ctx.arc(glyph[1].x, glyph[1].y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const hair = hairSecondary(t, animation === "death" ? hairAmt * 0.4 : hairAmt);
    const neck = joints[1];
    const roots = [
      { x: neck.x + 10, y: neck.y - 28, len: 92, sign: 1 },
      { x: neck.x + 22, y: neck.y - 12, len: 110, sign: 1 },
      { x: neck.x - 6, y: neck.y - 18, len: 70, sign: 0.55 },
    ];
    ctx.strokeStyle = "rgba(232, 196, 92, 0.95)";
    ctx.lineWidth = 3;
    for (const root of roots) {
      const pts = strandPoints(root, hair, root.len, root.sign);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.quadraticCurveTo(pts[1].x, pts[1].y, pts[2].x, pts[2].y);
      ctx.stroke();
    }

    const chest = chestSecondary(t, gender === "female" && animation === "walking" ? chestAmt : 0);
    if (gender === "female" && chestAmt > 0.05 && animation === "walking") {
      const mid = {
        x: (joints[2].x + joints[5].x) / 2 + 2,
        y: (joints[2].y + joints[5].y) / 2 + 34 + chest.y,
      };
      const rw = 16;
      const rh = 11 * chest.scaleY;
      ctx.fillStyle = "rgba(232, 168, 140, 0.45)";
      ctx.strokeStyle = "rgba(232, 168, 140, 0.95)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(mid.x - 9, mid.y, rw * 0.55, rh, -0.15, 0, Math.PI * 2);
      ctx.ellipse(mid.x + 8, mid.y, rw * 0.55, rh, 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }, [phase, ready, hairAmt, chestAmt, gender, animation, cosmetic]);

  return (
    <div className="flex flex-col gap-2">
      <ModeToggle mode={mode} onMode={setMode} />
      <p className="text-xs tracking-[0.2em] text-[#c7a24a]">
        动作循环 · {genderLabel(gender)} · {ANIMATION_LABEL[animation]} · {COSMETIC_LABEL[cosmetic]}
      </p>
      <div className="flex gap-1">
        {(["female", "male"] as const).map((id) => (
          <button
            key={id}
            type="button"
            className={cn(
              "h-7 border px-2 text-[11px]",
              gender === id ? "border-[#c7a24a] text-[#c7a24a]" : "border-[#3a2a18] text-[#8a7a5a]",
            )}
            onClick={() => setGender(id)}
          >
            {genderLabel(id)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {ANIMATION_NAMES.map((id) => (
          <button
            key={id}
            type="button"
            className={cn(
              "h-7 border px-2 text-[11px]",
              animation === id ? "border-[#c7a24a] text-[#c7a24a]" : "border-[#3a2a18] text-[#8a7a5a]",
            )}
            onClick={() => setAnimation(id)}
          >
            {ANIMATION_LABEL[id]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {COSMETIC_NAMES.map((id) => (
          <button
            key={id}
            type="button"
            className={cn(
              "h-7 border px-2 text-[11px]",
              cosmetic === id ? "border-[#c7a24a] text-[#c7a24a]" : "border-[#3a2a18] text-[#8a7a5a]",
            )}
            onClick={() => onCosmetic(id)}
          >
            {COSMETIC_LABEL[id]}
          </button>
        ))}
      </div>
      <p className="text-[11px] leading-5 text-[#8a7a5a]">
        走路 / 攻击 / 死亡共用一条 W2，只换 <span className="text-[#cfc3a6]">ANIMATION_NAME</span>
        。换武器走 W4/W5 的 <span className="text-[#cfc3a6]">COSMETIC_NAME</span>
        ，只换武器层，不重出身体。16GB 先跑空手身体；武器目录已经建成{" "}
        <span className="text-[#cfc3a6]">cosmetics/{"{staff|sword}"}/{"{walking|attack|death}"}/</span>
        ，以后有显存再跑 W4。
      </p>
      {mode === "stills" ? (
        <SpriteWalkPreview animation={animation} cosmetic={cosmetic} />
      ) : (
        <>
          <div className="border border-[#3a2a18] bg-[#0c0a08]">
            <canvas ref={canvasRef} width={360} height={480} className="mx-auto block h-auto w-full max-h-[28rem]" />
          </div>
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
            <span className="text-[11px] text-[#8a7a5a]">帧 {Math.floor(phase) + 1}/8</span>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-[#8a7a5a]">
            头发 {Math.round(hairAmt * 100)}
            <input
              type="range"
              min={0}
              max={120}
              value={Math.round(hairAmt * 100)}
              onChange={(event) => setHairAmt(Number(event.target.value) / 100)}
              className="w-28 accent-[#c7a24a]"
            />
          </label>
          <label className={cn("flex items-center gap-2 text-[11px]", gender === "male" ? "text-[#5a4e3a]" : "text-[#8a7a5a]")}>
            胸部 {gender === "male" ? "男管线关闭" : Math.round(chestAmt * 100)}
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(chestAmt * 100)}
              disabled={gender === "male"}
              onChange={(event) => setChestAmt(Number(event.target.value) / 100)}
              className="w-28 accent-[#c7a24a]"
            />
          </label>
        </>
      )}
      <button
        type="button"
        className="h-7 self-start border border-[#6a5428] px-2 text-[11px] text-[#cfc3a6]"
        onClick={async () => {
          await navigator.clipboard.writeText(w2Prompt);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        }}
      >
        {copied ? "已复制 W2 提示词" : `复制 W2 · ${ANIMATION_LABEL[animation]}`}
      </button>
      <pre className="max-h-28 overflow-auto whitespace-pre-wrap border border-[#3a2a18] bg-[#0c0a08] p-2 text-[10px] leading-4 text-[#8a7a5a]">
        {w2Prompt}
      </pre>
      <DropHint />
    </div>
  );
}

function DropHint() {
  const [info, setInfo] = useState<{ dropDir: string; command: string; folders: { folder: string; files: number }[] } | null>(
    null,
  );
  const [copiedCmd, setCopied] = useState(false);

  useEffect(() => {
    void fetch("/api/sprites/drop")
      .then((res) => res.json())
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);

  const waiting = info?.folders.filter((slot) => slot.files > 0) ?? [];

  return (
    <div className="border border-[#3a2a18] bg-[#0c0a08] p-2 text-[11px] leading-5 text-[#8a7a5a]">
      <p className="text-[10px] tracking-[0.2em] text-[#c7a24a]">怎么把图给我</p>
      <p className="mt-1">
        你在自己电脑炼丹，我看不见 D 盘。把工程放到炼丹这台电脑后：打开{" "}
        <span className="text-[#cfc3a6]">drop\走路</span>，把 png 丢进去，再双击{" "}
        <span className="text-[#cfc3a6]">投放.cmd</span>。完了跟我说「图放好了」。
      </p>
      <p className="mt-1 text-[#cfc3a6]">{info?.dropDir ?? "drop/"}</p>
      <button
        type="button"
        className="mt-1 h-7 border border-[#6a5428] px-2 text-[11px] text-[#cfc3a6]"
        onClick={async () => {
          await navigator.clipboard.writeText(info?.command ?? "npm run drop:watch -- --push");
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        }}
      >
        {copiedCmd ? "已复制命令" : "复制监视命令"}
      </button>
      {waiting.length ? (
        <p className="mt-1">投放里待收：{waiting.map((slot) => `${slot.folder} ${slot.files}`).join(" · ")}</p>
      ) : (
        <p className="mt-1">投放夹目前是空的。</p>
      )}
    </div>
  );
}

function ModeToggle({ mode, onMode }: { mode: "cycle" | "stills"; onMode: (mode: "cycle" | "stills") => void }) {
  return (
    <div className="flex gap-1">
      <button
        type="button"
        className={cn("h-7 border px-2 text-[11px]", mode === "cycle" ? "border-[#c7a24a] text-[#c7a24a]" : "border-[#3a2a18] text-[#8a7a5a]")}
        onClick={() => onMode("cycle")}
      >
        动作循环
      </button>
      <button
        type="button"
        className={cn("h-7 border px-2 text-[11px]", mode === "stills" ? "border-[#c7a24a] text-[#c7a24a]" : "border-[#3a2a18] text-[#8a7a5a]")}
        onClick={() => onMode("stills")}
      >
        炼丹产出
      </button>
    </div>
  );
}
