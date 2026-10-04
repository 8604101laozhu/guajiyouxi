/* eslint-disable @typescript-eslint/no-require-imports -- preload 必须用 CommonJS */
/**
 * 只暴露「窗口壳」相关的接口给页面，别无其它。
 * 渲染进程里用 window.deskBar.xxx 调。
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("deskBar", {
  /** 开始拖窗（长按由页面判定，判定通过才调这里） */
  dragStart: () => ipcRenderer.invoke("desk:drag-start"),
  /** 松手：返回 { moved, pos } */
  dragEnd: () => ipcRenderer.invoke("desk:drag-end"),
  /** 复位到底部居中 */
  resetToBottom: () => ipcRenderer.invoke("desk:reset"),
  getState: () => ipcRenderer.invoke("desk:get-state"),
  /** 置顶开关（开关量）：不传就是翻转；返回切换后的状态 */
  setOnTop: (on) => ipcRenderer.invoke("desk:set-on-top", on),
  /** 收起桌面条（**不是退出**）：窗口藏起来，进程和托盘图标留着，从托盘菜单「显示游戏条」叫回来 */
  hide: () => ipcRenderer.invoke("desk:hide"),
  /** 真退出（和快捷键 Ctrl+Alt+Q 同一条路）。界面上的按钮已经不调它了，留给自检用 */
  close: () => ipcRenderer.invoke("desk:close"),
  /** 订阅窗口状态（拖动中 / 点击穿透 / 置顶），返回取消订阅函数 */
  onState: (cb) => {
    const handler = (_event, s) => cb(s);
    ipcRenderer.on("desk:state", handler);
    return () => ipcRenderer.removeListener("desk:state", handler);
  },
});
