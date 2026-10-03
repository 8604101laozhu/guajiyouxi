/**
 * 置顶开关：状态 + 保持器 + 偏好读写。
 *
 * 为什么要「保持器」：Windows 的 topmost 是个位，别的 topmost 窗口（播放器、启动器、
 * 各种游戏工具）出现时会把我们顶下去，而 Electron 不会自己恢复。
 * 常见做法是定期重新确认，但**每次调用 setAlwaysOnTop 都可能引起闪烁/抢焦点**，
 * 所以这里是「检查—只在真的丢了才补一次」的心跳（check-then-fix），不是无脑重设。
 *
 * level 参数只有 macOS 认（"screen-saver" 能盖住全屏应用）；
 * Windows/Linux 会忽略它，写进去只为跨平台一致。
 * 参考：electron#10078（全屏应用之上的限制）、electron#5124（alwaysOnTop 与透明窗口的交互）。
 */
const TOP_LEVEL = "screen-saver";
/** 心跳间隔：太密是浪费，太疏会明显被顶下去 */
const CHECK_MS = 2000;

/**
 * @param {object} o
 * @param {() => any} o.getWindow 取当前窗口（可能为 null / 已销毁）
 * @param {number} [o.intervalMs]
 * @param {(fn: () => void, ms: number) => any} [o.setIntervalFn] 便于测试注入
 * @param {(t: any) => void} [o.clearIntervalFn]
 */
function createOnTopKeeper({ getWindow, intervalMs = CHECK_MS, setIntervalFn = setInterval, clearIntervalFn = clearInterval }) {
  let enabled = false;
  let timer = null;

  function live() {
    const win = getWindow();
    if (!win || (typeof win.isDestroyed === "function" && win.isDestroyed())) return null;
    return win;
  }

  function stopTimer() {
    if (timer !== null) {
      clearIntervalFn(timer);
      timer = null;
    }
  }

  /** 心跳：只有「开着但已经不是置顶」时才补一次，避免无谓的窗口操作引起闪烁 */
  function ensure() {
    if (!enabled) return false;
    const win = live();
    if (!win) return false;
    if (win.isAlwaysOnTop()) return false;
    win.setAlwaysOnTop(true, TOP_LEVEL);
    return true;
  }

  function set(on) {
    const next = !!on;
    enabled = next;
    stopTimer();
    const win = live();
    // 窗口不在（已销毁/还没建）：不应用也不起心跳 —— 心跳是为「这个窗口被顶掉」服务的，
    // 没有窗口就没有意义（keeper 是每窗口一个；窗口重建时会重新 set）
    if (!win) return next;
    win.setAlwaysOnTop(next, TOP_LEVEL);
    if (next && intervalMs > 0) timer = setIntervalFn(ensure, intervalMs);
    return next;
  }

  return {
    set,
    toggle: () => set(!enabled),
    ensure,
    enabled: () => enabled,
    stop: () => {
      stopTimer();
    },
    /** 测试用：心跳是否在跑 */
    ticking: () => timer !== null,
  };
}

/** 从窗口状态文件里读「是否置顶」，没存过或坏掉就返回默认值 */
function readOnTopPref(file, fsImpl, fallback = true) {
  try {
    const raw = fsImpl.readFileSync(file, "utf8");
    const obj = JSON.parse(raw);
    return typeof obj.alwaysOnTop === "boolean" ? obj.alwaysOnTop : fallback;
  } catch {
    return fallback;
  }
}

/** 把「是否置顶」并进窗口状态文件（保留位置等其它字段） */
function writeOnTopPref(file, fsImpl, on) {
  let obj = {};
  try {
    obj = JSON.parse(fsImpl.readFileSync(file, "utf8")) || {};
  } catch {
    obj = {};
  }
  obj.alwaysOnTop = !!on;
  fsImpl.writeFileSync(file, JSON.stringify(obj, null, 2));
  return obj;
}

module.exports = { createOnTopKeeper, readOnTopPref, writeOnTopPref, TOP_LEVEL, CHECK_MS };
