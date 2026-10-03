import { describe, expect, it, afterEach } from "vitest";
import { Renderer, type CombatHud, type RenderContext } from "./renderer";
import { LightingPass } from "./lighting";
import type { SceneLayout } from "../types";
import { ErrorLedger } from "../errors";
import { DEFAULT_BG_ALPHA, DEFAULT_GROUND_ALPHA } from "../debug";

/**
 * 用 Proxy 假造一个 2D context：所有方法都记下来，属性赋值也记下来。
 * 有了它，就能对「背景到底画成什么透明度」做单元测试 —— 不用开窗口、不用截图。
 */
function stubCtx() {
  const calls: { op: string; args: unknown[] }[] = [];
  /** 每个渐变都记下类型/参数/色标：测试按参数找，不靠创建顺序（顺序会随实现变） */
  const gradients: { type: string; args: unknown[]; stops: [number, string][] }[] = [];
  const newGradient = (type: string, args: unknown[]) => {
    const g = {
      type,
      args,
      stops: [] as [number, string][],
      addColorStop: (o: number, c: string) => g.stops.push([o, c]),
    };
    gradients.push(g);
    return g;
  };
  const props: Record<string, unknown> = {};
  const ctx = new Proxy(
    {},
    {
      get(_t, key: string) {
        if (key in props) return props[key];
        if (key === "measureText") return () => ({ width: 40 });
        if (key === "createLinearGradient" || key === "createRadialGradient") {
          return (...args: unknown[]) => {
            calls.push({ op: key, args });
            return newGradient(key === "createLinearGradient" ? "linear" : "radial", args);
          };
        }
        return (...args: unknown[]) => calls.push({ op: key, args });
      },
      set(_t, key: string, value: unknown) {
        props[key] = value;
        calls.push({ op: `set:${key}`, args: [value] });
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, calls, gradients, props };
}

type Grad = { type: string; args: unknown[]; stops: [number, string][] };

/** 按 createLinearGradient 的参数找渐变（天空 = (0,0,0,h)，地面 = (0,gy,0,h)） */
function linear(gradients: Grad[], args: number[]): Grad {
  const hit = gradients.find((g) => g.type === "linear" && String(g.args) === String(args));
  if (!hit) throw new Error(`没找到参数为 (${args.join(",")}) 的 linearGradient`);
  return hit;
}

/** 所有 set:fillStyle 的值 */
function fillStyles(calls: { op: string; args: unknown[] }[]): string[] {
  return calls.filter((c) => c.op === "set:fillStyle").map((c) => String(c.args[0]));
}

/** 覆盖整块画布的填充是否用了不透明的纯色（半透明背景的底线） */
function opaqueFullCanvasFill(calls: { op: string; args: unknown[] }[]): string | null {
  let style = "";
  for (const c of calls) {
    if (c.op === "set:fillStyle") style = String(c.args[0]);
    if (c.op !== "fillRect") continue;
    const [, , , hgt] = c.args as number[];
    if (hgt < 260) continue;
    if (style.startsWith("rgb(") || /^#[0-9a-f]{3,8}$/i.test(style)) return style;
    if (style.startsWith("rgba(") && alphaOf(style) >= 0.95) return style;
  }
  return null;
}

const SCENE: SceneLayout = {
  version: 1,
  name: "test",
  bounds: { w: 1280, h: 260, groundY: 210 },
  layers: ["sky", "mid", "ground", "entity", "fx", "ui"],
  objects: [],
};

const STATS: CombatHud = {
  wave: 1,
  stageLabel: "第1章 1-1 普通",
  kills: 0,
  killsPerMin: 0,
  enemies: 0,
  heroHp: 10,
  heroMaxHp: 10,
  heroDamage: 1,
  heroDefense: 1,
  heroAps: 1,
  heroDown: false,
  reviveIn: 0,
  odds: { unique: "-", rare: "-", magic: "-" },
  loot: { normal: 0, magic: 0, rare: 0, unique: 0 },
  lastDrop: null,
  gold: 0,
  misses: 0,
  potions: 0,
};

function drawOnce(over: { bgAlpha?: number; groundAlpha?: number; lighting?: boolean; panel?: boolean }) {
  const { ctx, calls, gradients } = stubCtx();
  const renderer = new Renderer();
  renderer.lighting.enabled = over.lighting ?? false; // 光影要 document，单独测
  const r: RenderContext = {
    ctx,
    width: 1280,
    height: 260,
    dpr: 1,
    camX: 0,
    scene: SCENE,
    entities: [],
    lights: [],
    ledger: new ErrorLedger(),
    fps: 60,
    time: 1,
    stats: STATS,
    debug: {
      panel: over.panel ?? false,
      showColliders: false,
      showGrid: false,
      bgAlpha: over.bgAlpha ?? DEFAULT_BG_ALPHA,
      groundAlpha: over.groundAlpha ?? DEFAULT_GROUND_ALPHA,
      lastAction: "",
      lastActionAt: 0,
    },
  };
  renderer.draw(r);
  return { calls, gradients };
}

/** 把 "rgba(27,35,64,0.62)" 里的 alpha 抠出来 */
function alphaOf(color: string): number {
  const m = /rgba\([^)]*,\s*([\d.]+)\)/.exec(color);
  if (!m) throw new Error(`不是 rgba：${color}`);
  return Number(m[1]);
}

describe("背景半透明化：天空与地面是两个独立旋钮", () => {
  it("天空渐变的每个色标都带上天空不透明度（之前写成不透明 hex，桌面被糊住）", () => {
    const { gradients } = drawOnce({ bgAlpha: 0.5 });
    const sky = linear(gradients, [0, 0, 0, 260]);
    expect(sky.stops).toHaveLength(3);
    for (const [, c] of sky.stops) expect(alphaOf(c)).toBeCloseTo(0.5, 5);
  });

  it("地面渐变吃的是地面不透明度，不再由天空推导（本轮修的就是这个）", () => {
    const { gradients } = drawOnce({ bgAlpha: 0.62, groundAlpha: 0.2 });
    const ground = linear(gradients, [0, 210, 0, 260]); // createLinearGradient(0, groundY, 0, h)
    expect(ground.stops).toHaveLength(2);
    for (const [, c] of ground.stops) expect(alphaOf(c)).toBeCloseTo(0.2, 5);
    // 天空还是自己的值，没被地面影响
    for (const [, c] of linear(gradients, [0, 0, 0, 260]).stops) expect(alphaOf(c)).toBeCloseTo(0.62, 5);
  });

  it("远山是纯色填充，且比天空更透（叠两层会把壁纸压掉）", () => {
    const { calls } = drawOnce({ bgAlpha: 0.6 });
    // 远山第一层的颜色 #241f3a → rgba(36,31,58,0.6×0.7)
    const hills = fillStyles(calls).filter((s) => s.includes("36,31,58"));
    expect(hills.length).toBeGreaterThan(0);
    for (const s of hills) expect(alphaOf(s)).toBeCloseTo(0.6 * 0.7, 5);
  });

  it("天地都拉到 0 时不会画成不透明（0 是合法值，别用 || 兜底）", () => {
    const { gradients } = drawOnce({ bgAlpha: 0, groundAlpha: 0 });
    for (const [, c] of linear(gradients, [0, 0, 0, 260]).stops) expect(alphaOf(c)).toBe(0);
    for (const [, c] of linear(gradients, [0, 210, 0, 260]).stops) expect(alphaOf(c)).toBe(0);
  });

  it("天空只铺到地平线（铺满整块画布会和地面叠成不透明），且没有任何不透明填充盖满整块画布", () => {
    const { calls } = drawOnce({});
    // 天空的 fillRect 高度 = groundY（210）
    expect(calls.some((c) => c.op === "fillRect" && c.args[3] === 210), "天空没铺到 groundY").toBe(true);
    // 唯一盖满画布的填充必须是半透明渐变（暗角），不能是纯色
    expect(opaqueFullCanvasFill(calls)).toBeNull();
  });
});

describe("暗角：只压暗颜色，不许抬透明度", () => {
  it("暗角用 source-atop 画（用 source-over 会给边缘加 alpha，壁纸被压出暗带）", () => {
    const { calls, gradients } = drawOnce({ bgAlpha: 0.62 });
    // 暗角是最后一次 radial gradient
    const radialIdx = calls.map((c) => c.op).lastIndexOf("createRadialGradient");
    expect(radialIdx).toBeGreaterThan(-1);
    const after = calls.slice(radialIdx);
    expect(after).toContainEqual({ op: "set:globalCompositeOperation", args: ["source-atop"] });
    // 而且暗角最黑的 alpha 跟着背景透明度一起减
    const vignette = gradients.filter((g) => g.type === "radial").pop()!;
    const darkest = Math.max(...vignette.stops.map(([, c]) => (c.includes("rgba(0,0,0,") ? alphaOf(c) : 0)));
    expect(darkest).toBeLessThanOrEqual(0.45 * 0.62 + 1e-6);
    expect(darkest).toBeGreaterThan(0.1); // 也别调没了
  });
});

describe("调试提示条：按了键要看得见", () => {
  it("没有操作时不画提示", () => {
    const { calls } = drawOnce({ panel: false });
    expect(calls.some((c) => c.op === "fillText" && String(c.args[0]).includes("不透明度"))).toBe(false);
  });

  it("刚改过设置就画一行提示（数值 + 方向说明）", () => {
    const { ctx, calls } = stubCtx();
    const renderer = new Renderer();
    renderer.lighting.enabled = false;
    const r: RenderContext = {
      ctx,
      width: 1280,
      height: 260,
      dpr: 1,
      camX: 0,
      scene: SCENE,
      entities: [],
      lights: [],
      ledger: new ErrorLedger(),
      fps: 60,
      time: 1,
      stats: STATS,
      debug: {
        panel: false,
        showColliders: false,
        showGrid: false,
        bgAlpha: 0.54,
        groundAlpha: 0.62,
        lastAction: "天空不透明度 54%（↑更实 ↓更透）",
        lastActionAt: (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000,
      },
    };
    renderer.draw(r);
    expect(calls.some((c) => c.op === "fillText" && String(c.args[0]).includes("天空不透明度 54%"))).toBe(true);
  });

  it("过期的提示不再画（1.8 秒后自己消失）", () => {
    const { ctx, calls } = stubCtx();
    const renderer = new Renderer();
    renderer.lighting.enabled = false;
    const nowSec = (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
    renderer.draw({
      ctx,
      width: 1280,
      height: 260,
      dpr: 1,
      camX: 0,
      scene: SCENE,
      entities: [],
      lights: [],
      ledger: new ErrorLedger(),
      fps: 60,
      time: 1,
      stats: STATS,
      debug: {
        panel: false,
        showColliders: false,
        showGrid: false,
        bgAlpha: 0.54,
        groundAlpha: 0.62,
        lastAction: "天空不透明度 54%（↑更实 ↓更透）",
        lastActionAt: nowSec - 10,
      },
    });
    expect(calls.some((c) => c.op === "fillText" && String(c.args[0]).includes("不透明度"))).toBe(false);
  });
});

describe("地面掉落物：图标 + 品质色名字标签", () => {
  const dropEntity = {
    id: "drop_1",
    modelId: "loot",
    model: {
      id: "loot",
      size: { w: 18, h: 18 },
      draw: () => {},
    },
    pos: { x: 600, y: 206 },
    layer: 2,
    layerName: "ground",
    params: { quality: 3 },
    age: 0,
    dead: false,
    drop: { item: { probe: true }, label: "★★ 索命之刃", color: "#c7a24a", quality: 3 as const },
  };

  it("有 drop 的实体必须把 label 画在物品上方，颜色用 drop.color", () => {
    const { ctx, calls } = stubCtx();
    const renderer = new Renderer();
    renderer.lighting.enabled = false;
    renderer.draw({
      ctx,
      width: 1280,
      height: 260,
      dpr: 1,
      camX: 0,
      scene: SCENE,
      entities: [dropEntity as unknown as RenderContext["entities"][number]],
      lights: [],
      ledger: new ErrorLedger(),
      fps: 60,
      time: 1,
      stats: STATS,
      debug: {
        panel: false,
        showColliders: false,
        showGrid: false,
        bgAlpha: 0.62,
        groundAlpha: 0.62,
        lastAction: "",
        lastActionAt: 0,
      },
    });
    const textCalls = calls.filter((c) => c.op === "fillText" && String(c.args[0]).includes("索命之刃"));
    expect(textCalls, "掉落物标签没画 —— 检查 dropLabels 是否被调用/是否被后面的绘制盖住").toHaveLength(1);
    // 位置：物品上方（y 比 pos.y 小），x 跟着相机
    const [, tx, ty] = textCalls[0].args as [string, number, number];
    expect(tx).toBeCloseTo(600, 5);
    expect(ty).toBeLessThan(206);
    // 颜色用的是 drop.color
    const styles = calls.filter((c) => c.op === "set:fillStyle").map((c) => String(c.args[0]));
    expect(styles).toContain("#c7a24a");
  });

  it("没有 drop 的实体不画标签", () => {
    const { calls } = drawOnce({});
    expect(calls.some((c) => c.op === "fillText" && String(c.args[0]).includes("★★"))).toBe(false);
  });
});

describe("光影：回贴方式决定背景还能不能透", () => {
  const realDocument = (globalThis as { document?: unknown }).document;
  afterEach(() => {
    (globalThis as { document?: unknown }).document = realDocument;
  });

  it("用 source-atop 回贴，绝不能用 multiply（multiply 的 αo 恒为 1，会把半透明糊掉）", () => {
    const off = stubCtx();
    (globalThis as { document?: unknown }).document = {
      createElement: () => ({ width: 0, height: 0, getContext: () => off.ctx }),
    };
    const target = stubCtx();
    const lighting = new LightingPass();
    lighting.ambient = 0.5;
    lighting.draw(target.ctx, 1280, 260, 1, 0, [{ x: 320, y: 172, r: 210, color: "#ffca7a", intensity: 1, flicker: 0 }], 0.5);

    const ops = target.calls.filter((c) => c.op === "set:globalCompositeOperation").map((c) => c.args[0]);
    expect(ops).toContain("source-atop");
    expect(ops).not.toContain("multiply");
    // 离屏那层：先铺黑色暗色，再用 destination-out 抠出灯
    const offOps = off.calls.filter((c) => c.op === "set:globalCompositeOperation").map((c) => c.args[0]);
    expect(offOps).toContain("destination-out");
    expect(off.calls.some((c) => c.op === "set:fillStyle" && String(c.args[0]).startsWith("rgba(0,0,0"))).toBe(true);
  });

  it("关掉光影就不碰主画布（别偷偷加一层）", () => {
    const target = stubCtx();
    const lighting = new LightingPass();
    lighting.enabled = false;
    lighting.draw(target.ctx, 1280, 260, 1, 0, [], 0);
    expect(target.calls.filter((c) => c.op === "set:globalCompositeOperation")).toHaveLength(0);
  });
});
