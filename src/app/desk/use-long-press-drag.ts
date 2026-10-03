"use client";

/**
 * 长按拖动整个窗口（桌面条）。
 *
 * 判定规则（照搬桌宠类应用的通行做法，Deskrawl 也是「原生搬窗 + 工作区夹取」）：
 *   - **按下就直接移动 → 立刻进入拖动**（人手不会在按下后先定住 350ms；只等长按会「拖不动」）
 *   - 按下不动满 350ms → 也进入拖动（慢出手的人照样能拖）
 *   - 按下后位移 < 6px 就松手 → 算点击，不搬窗（游戏本身没有鼠标输入，所以不冲突）
 *   - 拖动期间**由主进程轮询光标**搬窗：DOM 坐标会跟着窗口漂，鼠标划出窗口还会丢事件
 *   - 松手 / 取消 / 按 Esc / 窗口失焦 → 退出拖动
 *
 * 在浏览器里（没有 Electron 的 window.deskBar）该功能自动静默关闭，不影响页面本身。
 */
import { useEffect, useMemo, useRef, useState } from "react";

const HOLD_MS = 350;
/** 按下后的位移超过这个像素就算「要拖窗口」；小于它松手算点击 */
const MOVE_TOLERANCE = 6;

export type DeskState = { dragging: boolean; clickThrough: boolean; alwaysOnTop: boolean };

type DeskBarApi = {
  dragStart(): Promise<{ ok: boolean; state?: DeskState }>;
  dragEnd(): Promise<{ moved: boolean; pos: { x: number; y: number } | null }>;
  resetToBottom(): Promise<{ x: number; y: number } | null>;
  getState(): Promise<DeskState>;
  onState(cb: (s: DeskState) => void): () => void;
};

function deskBarApi(): DeskBarApi | null {
  if (typeof window === "undefined") return null;
  const api = (window as unknown as { deskBar?: DeskBarApi }).deskBar;
  return api ?? null;
}

export function useLongPressDrag(target: React.RefObject<HTMLElement | null>) {
  /** 长按计时中（还没进入拖动）：给个"再按一会就能拖"的反馈 */
  const [arming, setArming] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [clickThrough, setClickThrough] = useState(false);
  /**
   * 有没有 Electron 壳（纯浏览器里就没有）。
   * 不用 state：只在副作用里用，不进渲染输出，免得 effect 里同步 setState。
   */
  const supported = useMemo(() => !!deskBarApi(), []);
  /** 刚拖动过：这一次的 click 不该被当成游戏点击 */
  const suppressClick = useRef(false);

  useEffect(() => {
    const api = deskBarApi();
    if (!api) return;
    let alive = true;
    api.getState().then((s) => {
      if (alive) setClickThrough(s.clickThrough);
    }).catch(() => {});
    const off = api.onState((s) => {
      if (alive) setClickThrough(s.clickThrough);
    });
    return () => {
      alive = false;
      off();
    };
  }, []);

  useEffect(() => {
    const el = target.current;
    const api = deskBarApi();
    if (!el || !api) return;

    let timer: number | null = null;
    let armed = false;
    let origin = { x: 0, y: 0 };

    const clearTimer = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    const cancel = (endDrag: boolean) => {
      clearTimer();
      if (armed && endDrag) {
        void api.dragEnd();
        suppressClick.current = true;
      }
      armed = false;
      setArming(false);
      setDragging(false);
    };

    /** 进入拖动：长按到点、或者按下后移动出容差，都走这里 */
    const beginDrag = async () => {
      if (armed) return;
      clearTimer();
      armed = true;
      setArming(false);
      setDragging(true);
      const res = await api.dragStart().catch(() => ({ ok: false }));
      if (!res.ok) cancel(false);
    };

    const onPointerDown = (ev: PointerEvent) => {
      if (ev.button !== 0) return;
      origin = { x: ev.clientX, y: ev.clientY };
      suppressClick.current = false;
      clearTimer();
      setArming(true);
      timer = window.setTimeout(() => {
        timer = null;
        void beginDrag();
      }, HOLD_MS);
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (armed) return; // 拖动中：位置由主进程算，这里不参与
      if (timer === null) return; // 没按下，不管移动
      const far =
        Math.abs(ev.clientX - origin.x) > MOVE_TOLERANCE || Math.abs(ev.clientY - origin.y) > MOVE_TOLERANCE;
      // 按下就拖：一移动出容差立刻搬窗，不等长按（否则人手正常拖动永远触发不了）
      if (far) void beginDrag();
    };

    const onPointerUp = () => cancel(true);
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") cancel(true);
    };

    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("blur", onPointerUp);
    window.addEventListener("keydown", onKeyDown);
    // 自检用：监听真的挂上了（did-finish-load 早于 React effect，冒烟脚本不能抢跑）
    (window as unknown as { __deskDragReady?: boolean }).__deskDragReady = true;
    return () => {
      cancel(true);
      (window as unknown as { __deskDragReady?: boolean }).__deskDragReady = false;
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("blur", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [target]);

  const resetToBottom = async () => {
    const api = deskBarApi();
    if (api) await api.resetToBottom().catch(() => null);
  };

  return { arming, dragging, clickThrough, supported, resetToBottom, suppressClick };
}
