/* eslint-disable @typescript-eslint/no-require-imports -- Electron 主进程必须用 CommonJS */
/**
 * 系统托盘图标 —— 本工程唯一的**常驻入口**。
 *
 * 为什么要它
 * ----------
 * 桌面条是 `skipTaskbar: true` 的透明贴边条，**收起来之后没有任何入口**，
 * 想再看到它只能去双击 `打开游戏.cmd`。托盘补的就是这个洞：
 * 条收起来之后仍在隐藏区留一个图标，右键「显示游戏条」就能把它叫回来。
 *
 * 为什么只挂菜单、不依赖 click 事件
 * --------------------------------
 * Electron 官方明确说过：Linux 的 StatusNotifierItem 规范**没有定义哪个动作算「激活」**
 * （有的桌面环境是单击，有的是双击）。跨平台一致的做法是**始终附上 context menu**。
 * 本工程只跑 Windows，但没理由反着来 —— 菜单也正好能一次放下所有开关。
 *
 * 为什么不传 guid
 * --------------
 * `new Tray(image, guid)` 能让 Windows 记住图标在隐藏区里的摆放位置，但官方**强烈建议
 * 只配合「已代码签名」的可执行文件**使用。本工程没有签名，传了反而可能出怪事。
 *
 * 为什么菜单里没有「声音」
 * ----------------------
 * 静音状态活在**渲染进程**（`src/game/audio.ts` 里的 `muted`），主进程没有可靠路径读它，
 * 菜单项就画不出正确的勾。要做得对得再加一条**反向 IPC**（主进程 → 渲染的事件通道）
 * 和渲染侧监听 —— 那是独立的一件事，先不做。条上的音量 chip 在条可见时仍然可用。
 *
 * 可测试性：Tray / Menu / nativeImage 都从参数注入，单测塞假实现即可
 * （本工程连 canvas 都用 Proxy 假 ctx）。
 */
const electron = require("electron");

let current = null;

/**
 * @param {object} o
 * @param {string} o.iconPath              .ico 路径（Windows 上官方建议用 ICO，视觉最佳）
 * @param {() => any} o.getWindow          取当前窗口（可能为 null / 已销毁）
 * @param {() => void} o.onQuit            真正退出（走 app.quit()，和 Ctrl+Alt+Q 同一条路）
 * @param {() => void} o.onShow            把条显示出来
 * @param {() => void} o.onHide            把条收起来
 * @param {() => boolean} o.isOnTop        读当前置顶状态（画菜单勾）
 * @param {() => void} o.toggleOnTop       切置顶
 * @param {typeof electron.Tray} [o.Tray]            注入（测试用）
 * @param {typeof electron.Menu} [o.Menu]            注入（测试用）
 * @param {typeof electron.nativeImage} [o.nativeImage] 注入（测试用）
 */
function createTray(o) {
  const TrayCls = o.Tray ?? electron.Tray;
  const MenuCls = o.Menu ?? electron.Menu;
  const imageLib = o.nativeImage ?? electron.nativeImage;

  // 单实例：重复创建先销毁旧的，否则隐藏区会堆一排点不动的图标
  destroyTray();

  const icon = imageLib.createFromPath(o.iconPath);
  if (icon.isEmpty()) {
    // 图标读不出来不该把整个应用带崩（本工程铁律：加载失败只记账不崩）——
    // 退化成「没有托盘」：条照常显示，只是收起来之后得靠 打开游戏.cmd 叫回来。
    console.error(`[tray] 图标读不出来，本次不创建托盘：${o.iconPath}`);
    return null;
  }

  const tray = new TrayCls(icon);

  /** 窗口在且可见 —— 菜单第一项要按这个决定写「显示」还是「收起」 */
  function windowVisible() {
    const w = o.getWindow();
    if (!w) return false;
    if (typeof w.isDestroyed === "function" && w.isDestroyed()) return false;
    return typeof w.isVisible === "function" ? w.isVisible() : true;
  }

  function buildMenu() {
    const visible = windowVisible();
    return MenuCls.buildFromTemplate([
      // 第一项永远是最常用的那个动作（同类项目都这么排）
      {
        label: visible ? "收起到托盘" : "显示游戏条",
        click: () => (windowVisible() ? o.onHide() : o.onShow()),
      },
      { type: "separator" },
      {
        label: "📌 置顶",
        type: "checkbox",
        checked: o.isOnTop(),
        click: () => {
          o.toggleOnTop();
          refresh();
        },
      },
      { type: "separator" },
      { label: "退出", click: () => o.onQuit() },
    ]);
  }

  /** 菜单的勾是按「构建那一刻」的状态画的，所以状态一变就得重挂一次 */
  function refresh() {
    if (tray.isDestroyed()) return;
    tray.setContextMenu(buildMenu());
  }

  tray.setToolTip("挂机游戏 · 右键菜单");
  tray.setContextMenu(buildMenu());

  // Windows 的习惯：双击托盘图标 = 显示/收起。单击留给菜单。
  tray.on("double-click", () => (windowVisible() ? o.onHide() : o.onShow()));

  current = { tray, refresh, destroy: () => tray.destroy() };
  return current;
}

function destroyTray() {
  if (!current) return;
  try {
    if (!current.tray.isDestroyed()) current.tray.destroy();
  } catch {
    /* 已经没了就算了 */
  }
  current = null;
}

/** 给外面用的：状态变了（置顶 / 窗口显隐）让菜单重画一遍勾 */
function refreshTray() {
  if (current) current.refresh();
}

module.exports = { createTray, destroyTray, refreshTray };
