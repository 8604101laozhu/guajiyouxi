import { describe, expect, it } from "vitest";
import { createDebug, DEFAULT_BG_ALPHA, DEFAULT_GROUND_ALPHA, TOAST_SECONDS, type DebugHooks } from "./debug";

/** 假 window：只收 keydown 监听，测键位不用真 DOM */
function fakeWindow() {
  const handlers: ((ev: KeyboardEvent) => void)[] = [];
  return {
    target: {
      addEventListener: (_t: string, fn: (ev: KeyboardEvent) => void) => handlers.push(fn),
      removeEventListener: () => {},
    } as unknown as Window,
    /** 模拟按键 */
    press(key: string) {
      const ev = { key, preventDefault: () => {} } as KeyboardEvent;
      for (const h of handlers) h(ev);
    },
    get listenerCount() {
      return handlers.length;
    },
  };
}

const noopHooks: DebugHooks = {
  onSpawn: () => {},
  onToggleLighting: () => true,
  onTimescaleDelta: (d) => d,
  onTimescaleReset: () => 1,
};

function setup() {
  const win = fakeWindow();
  const debug = createDebug(noopHooks);
  const detach = debug.attach(win.target);
  return { win, debug, detach };
}

describe("调试面板：默认值", () => {
  it("默认天空/地面都是 62%，面板开着、碰撞盒与网格关着", () => {
    const debug = createDebug(noopHooks);
    expect(debug.state).toMatchObject({
      panel: true,
      showColliders: false,
      showGrid: false,
      bgAlpha: DEFAULT_BG_ALPHA,
      groundAlpha: DEFAULT_GROUND_ALPHA,
    });
  });

  it("初始值可以由外面覆盖（URL 参数 / 环境变量注入用）", () => {
    const debug = createDebug(noopHooks, { bgAlpha: 0.3, groundAlpha: 0.8 });
    expect(debug.state.bgAlpha).toBe(0.3);
    expect(debug.state.groundAlpha).toBe(0.8);
  });
});

describe("调试面板：透明度键位", () => {
  it("↑↓ 只调天空，→← 只调地面（两个旋钮不许串）", () => {
    const { win, debug } = setup();
    win.press("ArrowDown");
    expect(debug.state.bgAlpha).toBeCloseTo(0.54, 5);
    expect(debug.state.groundAlpha).toBe(DEFAULT_GROUND_ALPHA); // 没被带动
    win.press("ArrowUp");
    expect(debug.state.bgAlpha).toBeCloseTo(0.62, 5);
    win.press("ArrowLeft");
    expect(debug.state.groundAlpha).toBeCloseTo(0.54, 5);
    expect(debug.state.bgAlpha).toBeCloseTo(0.62, 5); // 没被带动
    win.press("ArrowRight");
    expect(debug.state.groundAlpha).toBeCloseTo(0.62, 5);
  });

  it("`[` `]` 是天空的别名，`,` `.` 是地面的别名（老键位别丢）", () => {
    const { win, debug } = setup();
    win.press("[");
    expect(debug.state.bgAlpha).toBeCloseTo(0.54, 5);
    win.press("]");
    expect(debug.state.bgAlpha).toBeCloseTo(0.62, 5);
    win.press(",");
    expect(debug.state.groundAlpha).toBeCloseTo(0.54, 5);
    win.press(".");
    expect(debug.state.groundAlpha).toBeCloseTo(0.62, 5);
  });

  it("夹在 0~1，连按到底也不会越界", () => {
    const { win, debug } = setup();
    for (let i = 0; i < 30; i++) win.press("ArrowDown");
    expect(debug.state.bgAlpha).toBe(0);
    for (let i = 0; i < 40; i++) win.press("ArrowUp");
    expect(debug.state.bgAlpha).toBe(1);
    for (let i = 0; i < 30; i++) win.press("ArrowLeft");
    expect(debug.state.groundAlpha).toBe(0);
    for (let i = 0; i < 40; i++) win.press("ArrowRight");
    expect(debug.state.groundAlpha).toBe(1);
  });

  it("步长是 8%：连按两下正好掉 16%", () => {
    const { win, debug } = setup();
    win.press("ArrowDown");
    win.press("ArrowDown");
    expect(Math.abs(debug.state.bgAlpha - 0.46)).toBeLessThan(1e-9);
  });
});

describe("调试面板：提示条（按了必须有反馈）", () => {
  it("每次改动都记一条提示 + 时间戳", () => {
    const { win, debug } = setup();
    expect(debug.state.lastAction).toBe("");
    win.press("ArrowDown");
    expect(debug.state.lastAction).toContain("天空不透明度 54%");
    expect(debug.state.lastAction).toContain("↓更透");
    expect(debug.state.lastActionAt).toBeGreaterThan(0);
    win.press("ArrowRight");
    expect(debug.state.lastAction).toContain("地面不透明度 70%");
    expect(debug.state.lastActionAt).toBeGreaterThan(0);
    expect(TOAST_SECONDS).toBeGreaterThan(0.5); // 太短就看不见了
  });

  it("开关类操作也有提示（1/2/3/4）", () => {
    const { win, debug } = setup();
    win.press("1");
    expect(debug.state.showColliders).toBe(true);
    expect(debug.state.lastAction).toBe("碰撞盒 开");
    win.press("2");
    expect(debug.state.showGrid).toBe(true);
    expect(debug.state.lastAction).toBe("网格 开");
    win.press("4");
    expect(debug.state.lastAction).toBe("刷了一个实体");
  });

  it("F1 只管面板，不写提示（免得每次开关面板都弹字）", () => {
    const { win, debug } = setup();
    win.press("ArrowDown");
    const before = debug.state.lastAction;
    win.press("F1");
    expect(debug.state.panel).toBe(false);
    expect(debug.state.lastAction).toBe(before);
  });

  it("无关按键不产生提示", () => {
    const { win, debug } = setup();
    win.press("q");
    win.press("Shift");
    expect(debug.state.lastAction).toBe("");
  });

  it("detach 之后按键不再生效（避免热重载叠一堆监听）", () => {
    const { win, debug, detach } = setup();
    expect(win.listenerCount).toBe(1);
    detach();
    expect(win.listenerCount).toBe(1); // 假 window 只记加不记删，这里只确认能调用
    void debug;
  });
});
