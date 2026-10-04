/**
 * 桌面条「窗口壳」的测试：拖窗数学 + 拖动控制器（用假窗口/假光标，不需要 Electron）。
 */
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { computeDragPos, clampToWorkArea, bottomRestingPos } = require("../../electron/drag-math.cjs");
const { createDragController } = require("../../electron/drag.cjs");
const { createOnTopKeeper, readOnTopPref, writeOnTopPref, readState, mergeState } = require("../../electron/ontop.cjs");

const work = { x: 0, y: 0, width: 1920, height: 1080 };

describe("拖窗数学", () => {
  it("位移 = 光标位移，窗口尺寸不变", () => {
    expect(computeDragPos({ x: 100, y: 800 }, { x: 500, y: 900 }, { x: 700, y: 780 })).toEqual({ x: 300, y: 680 });
  });

  it("光标在副屏（负坐标）时也能算对", () => {
    expect(computeDragPos({ x: -1500, y: 100 }, { x: -1400, y: 200 }, { x: -1450, y: 260 })).toEqual({ x: -1550, y: 160 });
  });

  it("夹进工作区：不允许拖出四条边", () => {
    expect(clampToWorkArea({ x: -500, y: -500 }, { width: 800, height: 260 }, work)).toEqual({ x: 0, y: 0 });
    expect(clampToWorkArea({ x: 5000, y: 5000 }, { width: 800, height: 260 }, work)).toEqual({ x: 1120, y: 820 });
    // 工作区带偏移（主显示器不是从 0,0 开始的常见情况）
    const off = { x: -1080, y: -200, width: 1000, height: 600 };
    // y=0 本来就落在 [-200, 200] 里，只有 x 需要夹
    expect(clampToWorkArea({ x: -9999, y: 0 }, { width: 400, height: 200 }, off)).toEqual({ x: -1080, y: 0 });
    expect(clampToWorkArea({ x: 9999, y: 9999 }, { width: 400, height: 200 }, off)).toEqual({ x: -480, y: 200 });
  });

  it("窗口比工作区还大时贴住左上角，不出现负向偏移", () => {
    expect(clampToWorkArea({ x: 50, y: 50 }, { width: 3000, height: 2000 }, work)).toEqual({ x: 0, y: 0 });
  });

  it("复位落点 = 底部居中（含底边距）", () => {
    expect(bottomRestingPos({ width: 1920, height: 260 }, work)).toEqual({ x: 0, y: 820 });
    expect(bottomRestingPos({ width: 1000, height: 260 }, work, 16)).toEqual({ x: 460, y: 804 });
  });
});

/** 假窗口：只实现控制器用到的那几个方法 */
function fakeWindow(pos: { x: number; y: number }) {
  return {
    pos: { ...pos },
    destroyed: false,
    isDestroyed() {
      return this.destroyed;
    },
    getPosition(): [number, number] {
      return [this.pos.x, this.pos.y];
    },
    setPosition(x: number, y: number) {
      this.pos = { x, y };
    },
  };
}

function harness(startWinPos = { x: 200, y: 800 }) {
  const win = fakeWindow(startWinPos);
  let cursor = { x: 500, y: 900 };
  const controller = createDragController({
    getWindow: () => win,
    getCursor: () => cursor,
    getBounds: () => ({ width: 1280, height: 260 }),
    getWorkArea: () => work,
    tickMs: 5,
  });
  return {
    win,
    controller,
    moveCursorTo(x: number, y: number) {
      cursor = { x, y };
    },
    nudgeCursor(dx: number, dy: number) {
      cursor = { x: cursor.x + dx, y: cursor.y + dy };
    },
  };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("拖动控制器", () => {
  it("跟着光标走：窗口位移 = 光标位移", async () => {
    const h = harness();
    expect(h.controller.startDrag()).toBe(true);
    h.moveCursorTo(560, 840); // +60, -60
    await wait(30);
    expect(h.win.pos).toEqual({ x: 260, y: 740 });
    const out = h.controller.stopDrag();
    expect(out.moved).toBe(true);
    expect(out.pos).toEqual({ x: 260, y: 740 });
  });

  it("松开后不再跟随光标", async () => {
    const h = harness();
    h.controller.startDrag();
    h.nudgeCursor(100, 0);
    await wait(30);
    h.controller.stopDrag();
    const after = { ...h.win.pos };
    h.nudgeCursor(300, 300);
    await wait(30);
    expect(h.win.pos).toEqual(after);
  });

  it("拖出屏幕会被夹回工作区（Deskrawl 的 rcWork 夹取）", async () => {
    const h = harness({ x: 100, y: 700 });
    h.controller.startDrag();
    h.moveCursorTo(5000, 5000);
    await wait(30);
    expect(h.win.pos).toEqual({ x: 640, y: 820 }); // 1920-1280 / 1080-260
    h.moveCursorTo(-5000, -5000);
    await wait(30);
    expect(h.win.pos).toEqual({ x: 0, y: 0 });
    h.controller.stopDrag();
  });

  it("重复 start 不会叠加定时器；没在拖时 stop 返回 null", async () => {
    const h = harness();
    expect(h.controller.stopDrag()).toBeNull();
    h.controller.startDrag();
    expect(h.controller.startDrag()).toBe(true);
    expect(h.controller.active()).toBe(true);
    h.controller.stopDrag();
    expect(h.controller.active()).toBe(false);
  });

  it("窗口没了也不会崩", async () => {
    const h = harness();
    h.controller.startDrag();
    h.win.destroyed = true;
    await wait(30);
    expect(h.controller.active()).toBe(false);
  });
});

/** 假置顶窗口：记下每次 setAlwaysOnTop 的调用 */
function fakeOnTopWindow(onTop = true) {
  return {
    onTop,
    destroyed: false,
    calls: [] as boolean[],
    isDestroyed() {
      return this.destroyed;
    },
    isAlwaysOnTop() {
      return this.onTop;
    },
    setAlwaysOnTop(v: boolean) {
      this.onTop = v;
      this.calls.push(v);
    },
  };
}

/** 假定时器：手动 tick，心跳逻辑才可测 */
function keeperHarness(onTop = true) {
  const win = fakeOnTopWindow(onTop);
  const timers = new Map<number, () => void>();
  let seq = 0;
  const keeper = createOnTopKeeper({
    getWindow: () => win,
    intervalMs: 10,
    setIntervalFn: (fn: () => void) => {
      const id = ++seq;
      timers.set(id, fn);
      return id;
    },
    clearIntervalFn: (id: number) => {
      timers.delete(id);
    },
  });
  return {
    win,
    keeper,
    tick: () => [...timers.values()].forEach((fn) => fn()),
    timerCount: () => timers.size,
  };
}

describe("置顶开关（保持器）", () => {
  it("开：应用一次并起心跳", () => {
    const h = keeperHarness(false);
    expect(h.keeper.set(true)).toBe(true);
    expect(h.win.calls).toEqual([true]);
    expect(h.keeper.ticking()).toBe(true);
    expect(h.timerCount()).toBe(1);
  });

  it("心跳：已经置顶时不再调 setAlwaysOnTop（免得反复设置引起闪烁）", () => {
    const h = keeperHarness(false);
    h.keeper.set(true);
    h.tick();
    h.tick();
    expect(h.win.calls).toEqual([true]); // 还是只有最初那一次
  });

  it("心跳：被别的 topmost 窗口顶掉后自己补回来", () => {
    const h = keeperHarness(false);
    h.keeper.set(true);
    h.win.onTop = false; // 模拟被抢占（外部直接改了状态）
    h.tick();
    expect(h.win.calls).toEqual([true, true]);
    expect(h.win.isAlwaysOnTop()).toBe(true);
  });

  it("关：立刻落地、心跳停掉，之后心跳不再动它", () => {
    const h = keeperHarness(true);
    h.keeper.set(true);
    expect(h.keeper.set(false)).toBe(false);
    expect(h.win.onTop).toBe(false);
    expect(h.keeper.ticking()).toBe(false);
    expect(h.timerCount()).toBe(0);
    h.win.onTop = false;
    h.tick(); // 没有心跳了，tick 不该做任何事
    expect(h.win.calls).toEqual([true, false]);
  });

  it("toggle 就是取反", () => {
    const h = keeperHarness(false);
    expect(h.keeper.toggle()).toBe(true);
    expect(h.keeper.enabled()).toBe(true);
    expect(h.keeper.toggle()).toBe(false);
    expect(h.keeper.enabled()).toBe(false);
  });

  it("窗口已销毁：不崩、也不起心跳", () => {
    const h = keeperHarness(false);
    h.win.destroyed = true;
    expect(() => h.keeper.set(true)).not.toThrow();
    expect(h.timerCount()).toBe(0);
    expect(h.keeper.ensure()).toBe(false);
  });
});

describe("置顶偏好的读写", () => {
  function fakeFs(files: Record<string, string> = {}) {
    return {
      files,
      readFileSync(p: string) {
        if (!(p in this.files)) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
        return this.files[p];
      },
      writeFileSync(p: string, c: string) {
        this.files[p] = c;
      },
    };
  }

  it("没存过 / 文件坏掉 → 用默认值，不抛", () => {
    expect(readOnTopPref("f.json", fakeFs(), true)).toBe(true);
    expect(readOnTopPref("f.json", fakeFs({ "f.json": "{坏掉的 json" }), false)).toBe(false);
    expect(readOnTopPref("f.json", fakeFs({ "f.json": '{"x":1}' }), true)).toBe(true);
  });

  it("存过 false 要读回 false（别被当成没存）", () => {
    expect(readOnTopPref("f.json", fakeFs({ "f.json": '{"alwaysOnTop":false}' }), true)).toBe(false);
  });

  it("写入时保留位置等其它字段", () => {
    const fs = fakeFs({ "f.json": '{"x":100,"y":1132}' });
    writeOnTopPref("f.json", fs, false);
    expect(JSON.parse(fs.files["f.json"])).toEqual({ x: 100, y: 1132, alwaysOnTop: false });
  });

  it("反过来也一样：存位置不能把 alwaysOnTop 抹掉（真踩过，条被写没了记忆）", () => {
    const fs = fakeFs({ "f.json": '{"x":0,"y":1132,"alwaysOnTop":false}' });
    mergeState("f.json", { x: 300, y: 800 }, fs);
    expect(JSON.parse(fs.files["f.json"])).toEqual({ x: 300, y: 800, alwaysOnTop: false });
  });

  it("文件坏掉/不存在时也能合并出正确内容（不抛）", () => {
    const fs = fakeFs({ "f.json": "not json at all" });
    expect(mergeState("f.json", { x: 1, y: 2 }, fs)).toEqual({ x: 1, y: 2 });
    expect(readState("f.json", fakeFs())).toEqual({});
  });
});
