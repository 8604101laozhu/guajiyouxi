"use client";

/**
 * 桌面条宿主页：只负责「挂一块 canvas + 启停内核 + 长按拖动窗口」。
 * 一帧都不走 React —— 状态全在 src/game 里，避免 setState 每帧重渲染。
 */
import { useEffect, useRef } from "react";
import { boot, type GameHandle } from "@/game/main";
import { useLongPressDrag } from "./use-long-press-drag";
import { OnTopChip } from "./on-top-chip";
import { HideChip } from "./hide-chip";
import { MuteChip } from "./mute-chip";

export default function DeskPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useLongPressDrag(canvasRef);

  useEffect(() => {
    // 透明窗口：把 html/body 底色洗掉，Electron 才能透出桌面
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.background;
    const prevBody = body.style.background;
    html.style.background = "transparent";
    body.style.background = "transparent";

    const canvas = canvasRef.current!;
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    };
    fit();
    window.addEventListener("resize", fit);

    let game: GameHandle | null = null;
    let disposed = false;
    /** 首次交互解锁音频的监听（卸载时摘掉） */
    let detachUnlock: (() => void) | null = null;
    // 支持 ?scene=/scenes/xxx.json 换场景，方便对比不同布局与自检
    // ?fresh=1 忽略存档（自检用：每个探针都要从干净状态开始）
    const params = new URLSearchParams(window.location.search);
    const sceneUrl = params.get("scene") ?? undefined;
    const fresh = params.get("fresh") === "1";
    boot(canvas, sceneUrl, { fresh })
      .then((g) => {
        if (disposed) {
          g.stop();
          return;
        }
        game = g;
        g.start();
        // 首次按键/点击时解锁 AudioContext（Electron 已放开自动播放策略，这里只是兜底）
        const unlock = () => g.audio.unlock();
        window.addEventListener("pointerdown", unlock, { once: true, passive: true });
        window.addEventListener("keydown", unlock, { once: true });
        detachUnlock = () => {
          window.removeEventListener("pointerdown", unlock);
          window.removeEventListener("keydown", unlock);
        };
        // 调试/自检用：把内核句柄挂到 window（探针靠它取实时数据）
        (window as unknown as { __game?: GameHandle }).__game = g;
        console.info("[desk] 场景已载入：", g.scene.name, "实体", g.world.entities.length, "错误", g.ledger.count);
      })
      .catch((err) => {
        // 连内核都起不来：把原因画在屏幕上，别白屏
        console.error("[desk] 启动失败", err);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#2b0b0b";
          ctx.fillRect(0, 0, canvas.width, 80);
          ctx.fillStyle = "#ffd0d0";
          ctx.font = "14px monospace";
          ctx.fillText(`游戏内核启动失败：${err instanceof Error ? err.message : String(err)}`, 16, 44);
        }
      });

    return () => {
      disposed = true;
      window.removeEventListener("resize", fit);
      detachUnlock?.();
      game?.stop();
      delete (window as unknown as { __game?: GameHandle }).__game;
      html.style.background = prevHtml;
      body.style.background = prevBody;
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="block h-screen w-screen bg-transparent"
        style={{ cursor: drag.dragging ? "grabbing" : drag.arming ? "grab" : "default" }}
      />
      {(drag.arming || drag.dragging) && (
        <div className="pointer-events-none fixed left-1/2 top-2 -translate-x-1/2 rounded border border-[#c7a24a]/60 bg-black/70 px-3 py-1 text-[11px] tracking-wider text-[#f0ead8]">
          {drag.dragging ? "拖动中 · 松手放下 · Esc 取消 · Ctrl+Alt+S 回底部" : "按住直接拖就能搬动整条"}
        </div>
      )}
      {drag.clickThrough && !drag.dragging && (
        <div className="pointer-events-none fixed right-2 top-20 rounded border border-[#6a5428] bg-black/60 px-2 py-0.5 text-[10px] tracking-wider text-[#8a7a5a]">
          点击穿透中 · Ctrl+Alt+D 关
        </div>
      )}
      {/* 右上角一列（自上而下）：收起 top-2 → 置顶 top-8 → 音量 top-14 → 穿透提示 top-20，互不遮挡 */}
      <HideChip />
      <OnTopChip />
      <MuteChip />
    </>
  );
}
