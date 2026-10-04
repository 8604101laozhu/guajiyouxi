"use client";

/**
 * 右上角的「音量开关」。
 *
 * 静音能力本来就在音频层里（`AudioHandle.setMuted`，动的是 master.gain），
 * 这里只是给它一个看得见的入口 —— 挂机条挂在桌面角落，没人会去开控制台。
 *
 * 音频句柄怎么拿：游戏内核由 `page.tsx` 启动，句柄挂在 `window.__game`（自检探针走的就是这条路）。
 * 之所以不改成「page.tsx 把 audio 当 prop 传下来」：page.tsx 现在有别的改动在并行进行，
 * 少碰一次少一分打架的机会；而且它的设计意图是「一帧都不走 React」，不该为了一个按钮引入 state。
 * 代价是这里依赖一个原本标着「调试用」的全局 —— 要正式化的话，正解是 page.tsx 传 prop。
 *
 * 首屏按「开」显示，不做浏览器状态预判：
 *   - 音频层的 `muted` 初值就是 false（audio.ts 里 `let muted = false`）；
 *   - 更重要的是 SSR 和客户端首屏必须一致，渲染时读 `window` 会触发 hydration mismatch
 *     （旁边 close-chip 刚踩过，见 docs/踩坑记录.md 第 17 条）。
 */
import { useCallback, useState } from "react";
import type { AudioHandle } from "@/game/audio";

function gameAudio(): AudioHandle | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { __game?: { audio?: AudioHandle } }).__game?.audio ?? null;
}

export function MuteChip() {
  /** null = 还没点过（按「开」显示）；点过之后以音频层的实际返回值为准 */
  const [muted, setMuted] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const toggle = useCallback(() => {
    const a = gameAudio();
    if (!a) {
      // 内核还没启动完（或启动失败）：说出来，别让用户觉得点了没反应
      setErr("未就绪");
      console.error("[desk] 拿不到音频句柄：游戏内核还没启动完");
      return;
    }
    a.setMuted(!a.muted);
    setErr(null);
    setMuted(a.muted);
  }, []);

  const off = muted === true;

  return (
    <button
      type="button"
      data-mute={off ? "off" : "on"}
      onClick={toggle}
      title={err ? `音量开关出错：${err}` : off ? "当前静音，点击恢复声音" : "点击静音（挂机时不想听）"}
      className={`fixed right-2 top-14 rounded border px-2 py-0.5 text-[10px] tracking-wider transition-colors ${
        err
          ? "border-[#a04040]/80 bg-black/70 text-[#ffb0b0]"
          : off
            ? "border-[#5a5a5a]/70 bg-black/50 text-[#9a9a9a] hover:bg-black/70"
            : "border-[#c7a24a]/70 bg-black/60 text-[#e8d9a8] hover:bg-black/80"
      }`}
    >
      {off ? "🔇 声音：关" : "🔊 声音：开"}
      {err ? ` ⚠ ${err}` : ""}
    </button>
  );
}
