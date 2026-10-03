/**
 * 拖窗数学：纯函数，不依赖 electron，方便单测。
 *
 * 三种坐标要分清：
 *  - 光标：主进程 screen.getCursorScreenPoint() → 物理像素 + 虚拟屏坐标（多屏可能为负）
 *  - 窗口：win.getPosition() → 同一个虚拟屏坐标系
 *  - 显示器工作区：display.workArea → 扣掉任务栏之后的可用区
 */

/** 拖动中：窗口新位置 = 起始窗口位置 + 光标位移 */
function computeDragPos(startWin, startCursor, cursor) {
  return {
    x: Math.round(startWin.x + cursor.x - startCursor.x),
    y: Math.round(startWin.y + cursor.y - startCursor.y),
  };
}

/**
 * 把窗口夹进工作区，保证它**整个可见**。
 * 窗口比工作区还大时，贴住工作区左上角（宁可右/下溢出，也别让它跑到左上角外面）。
 */
function clampToWorkArea(pos, size, workArea) {
  const maxX = workArea.x + Math.max(0, workArea.width - size.width);
  const maxY = workArea.y + Math.max(0, workArea.height - size.height);
  return {
    x: Math.round(Math.min(Math.max(pos.x, workArea.x), maxX)),
    y: Math.round(Math.min(Math.max(pos.y, workArea.y), maxY)),
  };
}

/** 复位：贴在工作区底部居中（Deskrawl 的回弹落点） */
function bottomRestingPos(size, workArea, margin = 0) {
  return {
    x: Math.round(workArea.x + Math.max(0, (workArea.width - size.width) / 2)),
    y: Math.round(workArea.y + Math.max(0, workArea.height - size.height - margin)),
  };
}

module.exports = { computeDragPos, clampToWorkArea, bottomRestingPos };
