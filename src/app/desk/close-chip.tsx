"use client";

/**
 * 右上角的「关闭条」按钮。
 *
 * 为什么要有它：退出本来只有 Ctrl+Alt+Q 一条路，鼠标用户要么不知道、要么记不住。
 * 但它只是**看得见的备用路** —— 点击穿透开着的时候鼠标事件根本到不了页面，
 * 这时候只有快捷键那条还能用（和置顶按钮是同一个道理）。
 *
 * 为什么**不**在渲染时预判「通道在不在」：
 *   - 惰性初始化 `useState(() => typeof api()?.close === "function" ? ...)`：
 *     SSR 没有 window → 算出来是「需重启条」；客户端 hydration 又算成 null。
 *     两边属性不一致，React 报 hydration mismatch（踩过，冒烟窗口日志里抓到的）。
 *     on-top-chip 用同样写法却没事，只因为它在拿到状态前 `return null`、整个组件不渲染；
 *     这个按钮要一直可见，藏不住。
 *   - 改在 effect 里补判：撞 `react-hooks/set-state-in-effect`（同步 setState 会引发级联渲染）。
 * 所以这里**不预判**：初始恒为 null，只有用户真点了、发现通道不在，才把话说出来。
 * setState 发生在事件处理器里 —— 上述两条规则都不碰。
 */
import { useCallback, useState } from "react";

type DeskBarApi = {
  /** 老版本 preload 里没有这个 —— 调用前必须判存在 */
  close?: () => Promise<boolean>;
};

function api(): DeskBarApi | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { deskBar?: DeskBarApi }).deskBar ?? null;
}

export function CloseChip() {
  /** 只在「点了但没有通道」或「关闭调用失败」时才有值 —— 初始 null 让 SSR 与客户端首屏一致 */
  const [err, setErr] = useState<string | null>(null);

  const close = useCallback(() => {
    const a = api();
    if (!a) return; // 纯浏览器里没有 deskBar：点了不动，也不报错
    if (typeof a.close !== "function") {
      // 条是这次改动之前启动的：preload 是旧版，通道压根没注册。
      // 必须说出来 —— 静默无反应是最糟的（置顶按钮刚踩过这个坑：.catch(()=>{}) 把 TypeError 吞了）。
      setErr("需重启条");
      console.error("[desk] 关闭通道不可用：这个桌面条是改动之前启动的，先 Ctrl+Alt+Q 退出再重新打开");
      return;
    }
    void a.close().catch((e: unknown) => {
      setErr("关闭失败");
      console.error("[desk] 关闭失败：", e);
    });
  }, []);

  return (
    <button
      type="button"
      data-close
      onClick={close}
      title={err ? `关闭按钮出错：${err}（可先用 Ctrl+Alt+Q 退出）` : "关闭游戏条（快捷键 Ctrl+Alt+Q）"}
      className={`fixed right-2 top-2 rounded border px-2 py-0.5 text-[10px] tracking-wider transition-colors ${
        err
          ? "border-[#a04040]/80 bg-black/70 text-[#ffb0b0]"
          : "border-[#7a3a3a]/70 bg-black/60 text-[#d8a0a0] hover:bg-black/80 hover:text-[#ffc8c8]"
      }`}
    >
      ✕ 关闭
      {err ? ` ⚠ ${err}` : ""}
    </button>
  );
}
