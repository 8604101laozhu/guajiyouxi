"use client";

/**
 * 置顶开关的「遥控器」：只做读状态、点一下切换、把当前状态写在脸上。
 * 真正的开关在主进程（electron/ontop.cjs）：界面 / Ctrl+Alt+T / 自检都走同一条路。
 *
 * 注意：点击穿透开着的时候鼠标事件到不了页面，这个按钮就点不动（先用 Ctrl+Alt+D 关穿透），
 * 所以 Ctrl+Alt+T 是永远可用的那条路。
 */
import { useCallback, useEffect, useState } from "react";

type DeskState = { alwaysOnTop: boolean };
type DeskBarApi = {
  getState(): Promise<DeskState>;
  onState(cb: (s: DeskState) => void): () => void;
  setOnTop(on?: boolean): Promise<boolean>;
};

function api(): DeskBarApi | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { deskBar?: DeskBarApi }).deskBar ?? null;
}

export function OnTopChip() {
  /** null = 还没拿到状态（纯浏览器里就是 null，那就不显示） */
  const [on, setOn] = useState<boolean | null>(null);

  useEffect(() => {
    const a = api();
    if (!a) return;
    let alive = true;
    a.getState()
      .then((s) => {
        if (alive) setOn(!!s.alwaysOnTop);
      })
      .catch(() => {});
    // 快捷键改了也要跟着变（主进程会广播状态）
    const off = a.onState((s) => setOn(!!s.alwaysOnTop));
    return () => {
      alive = false;
      off();
    };
  }, []);

  const toggle = useCallback(() => {
    const a = api();
    if (!a) return;
    // 把目标状态显式传过去：不要依赖主进程「翻转」，避免界面与主进程状态不一致时反向
    void a.setOnTop(!(on ?? true)).catch(() => {});
  }, [on]);

  if (on === null) return null;

  return (
    <button
      type="button"
      data-ontop={on ? "on" : "off"}
      onClick={toggle}
      title="保持游戏条在所有窗口最上层（快捷键 Ctrl+Alt+T）"
      className={`fixed right-2 top-8 rounded border px-2 py-0.5 text-[10px] tracking-wider transition-colors ${
        on
          ? "border-[#c7a24a]/70 bg-black/60 text-[#e8d9a8] hover:bg-black/80"
          : "border-[#5a5a5a]/70 bg-black/50 text-[#9a9a9a] hover:bg-black/70"
      }`}
    >
      {on ? "📌 置顶：开" : "置顶：关"}
    </button>
  );
}
