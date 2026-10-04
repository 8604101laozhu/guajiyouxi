/* eslint-disable @typescript-eslint/no-require-imports -- Electron 主进程/预加载必须用 CommonJS */
/**
 * 窗口状态文件（`%APPDATA%\<app>\desk-window.json`）的读写。
 *
 * 存在这个模块的唯一理由：**这个文件有多个写入方**（拖动存位置、置顶开关存偏好），
 * 谁都不能整份覆盖 —— 否则「拖一下窗口」会把置顶偏好抹掉（真踩过：
 * `savePos()` 只写 {x,y}，把 alwaysOnTop 字段直接写没了，用户关了置顶下次启动又被打开）。
 *
 * 所以规矩是：**读-改-写**，只动自己要动的字段，其余原样保留；文件坏了当空的，绝不抛。
 */
const fsDefault = require("node:fs");

/** 读成对象；文件不存在/坏掉 → {}（绝不让状态文件坏了把主程序带崩） */
function readState(file, fsImpl = fsDefault) {
  try {
    const obj = JSON.parse(fsImpl.readFileSync(file, "utf8"));
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
  } catch {
    return {};
  }
}

/**
 * 把 patch 合进状态文件（读-改-写），返回合并后的完整对象。
 * @param {string} file
 * @param {object} patch 只放要改的字段
 * @param {object} [fsImpl] 便于测试注入
 */
function mergeState(file, patch, fsImpl = fsDefault) {
  const merged = { ...readState(file, fsImpl), ...patch };
  try {
    fsImpl.writeFileSync(file, JSON.stringify(merged, null, 2));
  } catch {
    /* 盘写不进去也不影响本次会话（位置/偏好下次启动会回到默认值） */
  }
  return merged;
}

module.exports = { readState, mergeState };
