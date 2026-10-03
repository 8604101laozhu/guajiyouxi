/* eslint-disable @typescript-eslint/no-require-imports -- Electron 主进程侧必须用 CommonJS */
/**
 * 拖动控制器：只管「什么时候在拖、拖到哪」，不碰 UI、不碰 IPC。
 *
 * 为什么由**主进程**轮询光标，而不是跟着 renderer 的 mousemove：
 *  1. 窗口自己在动，DOM 的坐标会跟着窗口一起漂，越拖越飘；
 *  2. 鼠标划出窗口边界 DOM 就收不到事件了，而 screen.getCursorScreenPoint() 一直有效。
 * 这是桌宠类应用的通行做法，Deskrawl 也是走原生 GetCursorPos。
 */
const { computeDragPos, clampToWorkArea } = require("./drag-math.cjs");

function createDragController(options) {
  const {
    getWindow,
    getCursor,
    getBounds,
    getWorkArea,
    tickMs = 16,
  } = options;

  let timer = null;
  let start = null;
  let moved = false;

  const active = () => timer !== null;

  function startDrag() {
    if (timer) return true;
    const win = getWindow();
    if (!win || win.isDestroyed()) return false;
    const pos = win.getPosition();
    start = { win: { x: pos[0], y: pos[1] }, cursor: getCursor() };
    moved = false;
    timer = setInterval(tick, tickMs);
    if (typeof timer.unref === "function") timer.unref();
    return true;
  }

  function tick() {
    const win = getWindow();
    if (!win || win.isDestroyed()) return stopDrag();
    const cursor = getCursor();
    const raw = computeDragPos(start.win, start.cursor, cursor);
    const size = getBounds();
    const next = clampToWorkArea(raw, size, getWorkArea(cursor));
    if (next.x !== raw.x || next.y !== raw.y) moved = true;
    if (Math.abs(next.x - start.win.x) > 2 || Math.abs(next.y - start.win.y) > 2) moved = true;
    const pos = win.getPosition();
    if (pos[0] !== next.x || pos[1] !== next.y) win.setPosition(next.x, next.y);
  }

  /** @returns {{moved:boolean, pos:{x:number,y:number}}|null} */
  function stopDrag() {
    if (!timer) return null;
    clearInterval(timer);
    timer = null;
    const win = getWindow();
    const pos = win && !win.isDestroyed() ? win.getPosition() : [0, 0];
    const out = { moved, pos: { x: pos[0], y: pos[1] } };
    start = null;
    return out;
  }

  return { startDrag, stopDrag, active, get moved() {
    return moved;
  } };
}

module.exports = { createDragController };
