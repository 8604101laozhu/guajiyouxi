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
  /** 老版本 preload 里没有这个（条是在改动之前启动的）——所以调用前必须判存在 */
  setOnTop?(on?: boolean): Promise<boolean>;
};

function api(): DeskBarApi | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { deskBar?: DeskBarApi }).deskBar ?? null;
}

export function OnTopChip() {
  /** null = 还没拿到状态（纯浏览器里就是 null，那就不显示） */
  const [on, setOn] = useState<boolean | null>(null);
  /**
   * 出错要写在脸上：静默无反应是最糟的（用户只会觉得「点了没反应」）。
   * 初始值就用惰性初始化算出「通道在不在」—— preload 是旧版（条在改动前启动的）就立刻标出来，
   * 而不是等用户点了才说；也不能写在 effect 里同步 setState（React 规则不允许）。
   */
  const [err, setErr] = useState<string | null>(() => (typeof api()?.setOnTop === "function" ? null : "需重启条"));

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
    // preload 是旧版（条在这次改动之前就启动了）：通道压根不存在。
    // 这种情况必须说出来 —— 之前这里用 .catch(()=>{}) 把 TypeError 吞了，表现就是「点了没反应」。
    if (typeof a.setOnTop !== "function") {
      setErr("需重启条");
      console.error("[desk] 置顶通道不可用：这个桌面条是改动之前启动的，先 Ctrl+Alt+Q 退出再重新打开");
      return;
    }
    // 把目标状态显式传过去：不要依赖主进程「翻转」，避免界面与主进程状态不一致时反向
    a.setOnTop(!(on ?? true))
      .then((v) => {
        setErr(null);
        setOn(!!v);
      })
      .catch((e: unknown) => {
        setErr("切换失败");
        console.error("[desk] 置顶切换失败：", e);
      });
  }, [on]);

  if (on === null) return null;

  return (
    <button
      type="button"
      data-ontop={on ? "on" : "off"}
      onClick={toggle}
      title={err ? `置顶开关出错：${err}（Ctrl+Alt+Q 退出后重新打开桌面条）` : "保持游戏条在所有窗口最上层（快捷键 Ctrl+Alt+T）"}
      className={`fixed right-2 top-8 rounded border px-2 py-0.5 text-[10px] tracking-wider transition-colors ${
        err
          ? "border-[#a04040]/80 bg-black/70 text-[#ffb0b0]"
          : on
            ? "border-[#c7a24a]/70 bg-black/60 text-[#e8d9a8] hover:bg-black/80"
            : "border-[#5a5a5a]/70 bg-black/50 text-[#9a9a9a] hover:bg-black/70"
      }`}
    >
      {on ? "📌 置顶：开" : "置顶：关"}
      {err ? ` ⚠ ${err}` : ""}
    </button>
  );
}
