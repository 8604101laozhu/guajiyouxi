/**
 * 调试模式（F1）：开关项 + 快捷键。
 * 属于主程序，不碰模型；模型只管画自己。
 *
 *   F1 面板   1 碰撞盒   2 网格   3 光影   4 刷一个实体
 *   ↑ / ↓ 天空不透明度（更实 / 更透）   → / ← 地面不透明度（更实 / 更透）
 *   （`[` `]` 和 `,` `.` 是同样的两个旋钮，留着给习惯打符号的人）
 *   + / - 时间倍速   0 复位倍速
 *
 * 每次改动都会记一条 lastAction，渲染层拿它弹一行提示（否则按了没反馈，等于不知道按哪个键）。
 */
export type DebugState = {
  panel: boolean;
  showColliders: boolean;
  showGrid: boolean;
  /** 背景不透明度：天空（含远山）。0=全透出桌面 1=完全盖住 */
  bgAlpha: number;
  /** 地面（地平线以下）的不透明度，和天空分开调 */
  groundAlpha: number;
  /** 最近一次调试操作 + 发生时刻（秒，performance.now 口径），渲染层用来弹提示 */
  lastAction: string;
  lastActionAt: number;
};

export type DebugHooks = {
  onSpawn: () => void;
  onToggleLighting: () => boolean;
  onTimescaleDelta: (delta: number) => number;
  onTimescaleReset: () => number;
};

/** 透明度的默认值与调整步长（0 = 全透出桌面，1 = 完全盖住） */
export const DEFAULT_BG_ALPHA = 0.62;
export const DEFAULT_GROUND_ALPHA = 0.62;
const ALPHA_STEP = 0.08;
/** 提示停留多久（秒） */
export const TOAST_SECONDS = 1.8;

function stepAlpha(v: number, delta: number): number {
  return Math.min(1, Math.max(0, Math.round((v + delta) * 100) / 100));
}

export function createDebug(hooks: DebugHooks, initial?: { bgAlpha?: number; groundAlpha?: number }) {
  const state: DebugState = {
    panel: true,
    showColliders: false,
    showGrid: false,
    bgAlpha: initial?.bgAlpha ?? DEFAULT_BG_ALPHA,
    groundAlpha: initial?.groundAlpha ?? DEFAULT_GROUND_ALPHA,
    lastAction: "",
    lastActionAt: 0,
  };
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
  const note = (text: string) => {
    state.lastAction = text;
    state.lastActionAt = now();
  };

  const onKey = (ev: KeyboardEvent) => {
    const k = ev.key;
    if (k === "F1") {
      ev.preventDefault();
      state.panel = !state.panel;
      return;
    }
    if (state.showColliders === undefined) return;
    switch (k) {
      case "1":
        state.showColliders = !state.showColliders;
        note(`碰撞盒 ${state.showColliders ? "开" : "关"}`);
        break;
      case "2":
        state.showGrid = !state.showGrid;
        note(`网格 ${state.showGrid ? "开" : "关"}`);
        break;
      case "3":
        note(`光影 ${hooks.onToggleLighting() ? "开" : "关"}`);
        break;
      case "4":
        hooks.onSpawn();
        note("刷了一个实体");
        break;
      // 天空：↑ 更实 / ↓ 更透（`[` `]` 是同一件事的别名）
      case "ArrowUp":
      case "]": {
        ev.preventDefault();
        state.bgAlpha = stepAlpha(state.bgAlpha, ALPHA_STEP);
        note(`天空不透明度 ${(state.bgAlpha * 100).toFixed(0)}%（↑更实 ↓更透）`);
        break;
      }
      case "ArrowDown":
      case "[": {
        ev.preventDefault();
        state.bgAlpha = stepAlpha(state.bgAlpha, -ALPHA_STEP);
        note(`天空不透明度 ${(state.bgAlpha * 100).toFixed(0)}%（↑更实 ↓更透）`);
        break;
      }
      // 地面：→ 更实 / ← 更透（`,` `.` 是同一件事的别名）
      case "ArrowRight":
      case ".": {
        ev.preventDefault();
        state.groundAlpha = stepAlpha(state.groundAlpha, ALPHA_STEP);
        note(`地面不透明度 ${(state.groundAlpha * 100).toFixed(0)}%（→更实 ←更透）`);
        break;
      }
      case "ArrowLeft":
      case ",": {
        ev.preventDefault();
        state.groundAlpha = stepAlpha(state.groundAlpha, -ALPHA_STEP);
        note(`地面不透明度 ${(state.groundAlpha * 100).toFixed(0)}%（→更实 ←更透）`);
        break;
      }
      case "+":
      case "=":
        note(`时间倍速 ×${hooks.onTimescaleDelta(0.5).toFixed(1)}`);
        break;
      case "-":
      case "_":
        note(`时间倍速 ×${hooks.onTimescaleDelta(-0.5).toFixed(1)}`);
        break;
      case "0":
        note(`时间倍速 ×${hooks.onTimescaleReset().toFixed(1)}`);
        break;
      default:
        return;
    }
  };

  return {
    state,
    get lastAction() {
      return state.lastAction;
    },
    attach(target: Window = window) {
      target.addEventListener("keydown", onKey);
      return () => target.removeEventListener("keydown", onKey);
    },
  };
}

export type Debug = ReturnType<typeof createDebug>;
