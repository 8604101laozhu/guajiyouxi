"use client";

/**
 * 右上角的「收起」按钮。
 *
 * 加了托盘之后它的语义变了：以前点是 `app.quit()`（真退出），现在**只是把条藏起来** ——
 * 进程和托盘图标都活着，右键托盘图标「显示游戏条」就能叫回来。
 * 真退出只有两条路：托盘菜单「退出」、Ctrl+Alt+Q。
 *
 * 所以配色也从「危险红」换成了中性灰：收起不再是破坏性操作。
 *
 * 为什么初始恒为 null、只在事件处理器里判通道在不在：
 *   渲染时读浏览器状态 → SSR 与客户端首屏不一致 → React 报 hydration mismatch；
 *   改在 effect 里补判 → `react-hooks/set-state-in-effect` 会拦。两条路都堵死，
 *   正解就是「不预判」。（详见 docs/踩坑记录.md 第 17 条，close-chip 那一版踩过。）
 */
import { useCallback, useState } from "react";

type DeskBarApi = {
  /** 老版本 preload 里没有这个 —— 调用前必须判存在 */
  hide?: () => Promise<boolean>;
};

function api(): DeskBarApi | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { deskBar?: DeskBarApi }).deskBar ?? null;
}

export function HideChip() {
  /** 只在「点了但没有通道」或「收起失败」时才有值 —— 初始 null 让 SSR 与客户端首屏一致 */
  const [err, setErr] = useState<string | null>(null);

  const hide = useCallback(() => {
    const a = api();
    if (!a) return; // 纯浏览器里没有 deskBar：点了不动，也不报错
    if (typeof a.hide !== "function") {
      // 条是在这次改动之前启动的：preload 是旧版，通道压根没注册。说出来，别让它静默无反应。
      setErr("需重启条");
      console.error("[desk] 收起通道不可用：这个桌面条是旧版启动的，先 Ctrl+Alt+Q 退出再重新打开");
      return;
    }
    void a.hide().catch((e: unknown) => {
      setErr("收起失败");
      console.error("[desk] 收起失败：", e);
    });
  }, []);

  return (
    <button
      type="button"
      data-hide
      onClick={hide}
      title={
        err
          ? `收起按钮出错：${err}（可先用 Ctrl+Alt+Q 退出）`
          : "收起游戏条（进程还在，右键托盘图标「显示游戏条」叫回来；真退出用 Ctrl+Alt+Q）"
      }
      className={`fixed right-2 top-2 rounded border px-2 py-0.5 text-[10px] tracking-wider transition-colors ${
        err
          ? "border-[#a04040]/80 bg-black/70 text-[#ffb0b0]"
          : "border-[#5a5a5a]/70 bg-black/50 text-[#c8c8c8] hover:bg-black/70 hover:text-[#f0ead8]"
      }`}
    >
      ✕ 收起
      {err ? ` ⚠ ${err}` : ""}
    </button>
  );
}
