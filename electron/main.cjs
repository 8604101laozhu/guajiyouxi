/* eslint-disable @typescript-eslint/no-require-imports -- Electron 主进程必须用 CommonJS */
/**
 * 桌面底部条窗口（Electron 壳）。
 *  - 透明 + 无边框 + 置顶 + 不占任务栏
 *  - 默认吸附主显示器底部，**长按画面可拖动整个窗口**（拖动由主进程轮询光标驱动）
 *  - 松手记住位置，下次启动回到原位；Ctrl+Alt+S 复位回底部
 *  - Ctrl+Alt+D 切换点击穿透，Ctrl+Alt+T 切换置顶，Ctrl+Alt+R 重载，Ctrl+Alt+Q 退出
 * 用法：先起 next dev（或双击 打开游戏.cmd），再 `npm run desk`
 */
const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { createDragController } = require("./drag.cjs");
const { clampToWorkArea, bottomRestingPos } = require("./drag-math.cjs");
const { createOnTopKeeper, readOnTopPref, writeOnTopPref } = require("./ontop.cjs");

/**
 * 桌面条是"没人点过"的窗口：Chromium 的自动播放策略会把 AudioContext 一直挂在 suspended，
 * 于是音效全哑（electron#13525）。必须在 whenReady 之前放开这个开关。
 * 代码里仍保留"首次按键/点击时 resume()"的兜底（见 src/game/audio.ts 的 unlock()）。
 */
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

/** DESK_BG_ALPHA=0~1 → 天空不透明度（含远山；默认 0.62，游戏内 [ / ] 可调） */
const BG_ALPHA = process.env.DESK_BG_ALPHA;
/** DESK_GROUND_ALPHA=0~1 → 地面不透明度（地平线以下；默认 0.62，游戏内 , / . 可调） */
const GROUND_ALPHA = process.env.DESK_GROUND_ALPHA;
/** DESK_ALPHA_CHECK=1 → 载入后采样画面像素的 alpha，验证背景真的是半透明 */
const ALPHA_CHECK = process.env.DESK_ALPHA_CHECK === "1";
/** DESK_ERR_CHECK=1 → 用坏场景（?scene=/scenes/_selftest.json）验「加载失败不崩」 */
const ERR_CHECK = process.env.DESK_ERR_CHECK === "1";
/** DESK_ONTOP_CHECK=1 → 验置顶开关：关得掉 / 开得回 / 关了透明没坏 / 偏好落盘 / 被顶掉能自己补回来 */
const ONTOP_CHECK = process.env.DESK_ONTOP_CHECK === "1";
const GAME_URL = (() => {
  const base = process.env.GAME_URL || "http://127.0.0.1:45231/desk";
  if (BG_ALPHA === undefined && GROUND_ALPHA === undefined) return base;
  const u = new URL(base);
  if (BG_ALPHA !== undefined) u.searchParams.set("bgAlpha", BG_ALPHA);
  if (GROUND_ALPHA !== undefined) u.searchParams.set("groundAlpha", GROUND_ALPHA);
  return u.toString();
})();
const HEIGHT = Number(process.env.DESK_HEIGHT || 260);
const BOTTOM_MARGIN = Number(process.env.DESK_BOTTOM || 0);
/** DESK_SHOT=路径 → 载入后自动截图并退出（CI / 无人值守自检用） */
const SHOT = process.env.DESK_SHOT || "";
/** DESK_SHOT_AFTER=毫秒 → 等多久再截图（战斗类截图要等打起来） */
const SHOT_AFTER = Number(process.env.DESK_SHOT_AFTER || 2500);
/** DESK_FORGET_POS=1 → 忽略上次记住的位置，从底部重新开始 */
const FORGET_POS = process.env.DESK_FORGET_POS === "1";
/** DESK_SMOKE=1 → 载入后自动模拟一次「长按→拖动→松手」，打印结果并退出（冒烟自检用） */
/** DESK_SMOKE=move → 模拟「按下就立刻移动」的真实手势（手势自检用） */
/** DESK_SMOKE=keys → 模拟按方向键调透明度，验证快捷键真的接上了（可配 DESK_SHOT 截提示条） */
const SMOKE = !!process.env.DESK_SMOKE;
const SMOKE_MOVE = process.env.DESK_SMOKE === "move";
const SMOKE_KEYS = process.env.DESK_SMOKE === "keys";
/** DESK_COMBAT_CHECK=毫秒 → 采样这么久的战斗数据后打印汇总并退出（自动战斗自检） */
const COMBAT_CHECK = Number(process.env.DESK_COMBAT_CHECK || 0);
/** DESK_LOOT_CHECK=毫秒 → 采样掉落物：必须真的落在地上、看得见、并最终被挂机捡走 */
const LOOT_CHECK = Number(process.env.DESK_LOOT_CHECK || 0);
/** DESK_LOOT_INJECT=1 → 在固定位置注入一个暗金掉落物再截图（验外观，位置可控好裁图） */
const LOOT_INJECT = process.env.DESK_LOOT_INJECT === "1";
/** DESK_SFX_CHECK=1 → 验音效真的出声：AudioContext 状态 + 峰值电平（静音时峰值恒 0） */
const SFX_CHECK = process.env.DESK_SFX_CHECK === "1";
/** DESK_FLOAT_CHECK=1 → 注入一个飘字再数像素（验飘字画出来了） */
const FLOAT_CHECK = process.env.DESK_FLOAT_CHECK === "1";
/** DESK_DRAG_FIXED_CURSOR="x,y" → 拖动时用固定光标点（自检用，否则会跟着真实鼠标走） */
const FIXED_CURSOR = (() => {
  const raw = process.env.DESK_DRAG_FIXED_CURSOR;
  if (!raw) return null;
  const [x, y] = raw.split(",").map(Number);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
})();

let win = null;
let clickThrough = false;
let drag = null;
/** 置顶保持器（被别的 topmost 窗口顶掉时自己补回来） */
let keeper = null;

const posFile = () => path.join(app.getPath("userData"), "desk-window.json");

function loadSavedPos() {
  if (FORGET_POS) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(posFile(), "utf8"));
    if (typeof raw?.x === "number" && typeof raw?.y === "number") return { x: raw.x, y: raw.y };
  } catch {
    /* 第一次跑或文件坏了：忽略 */
  }
  return null;
}

function savePos(pos) {
  try {
    fs.mkdirSync(path.dirname(posFile()), { recursive: true });
    fs.writeFileSync(posFile(), JSON.stringify(pos));
  } catch (err) {
    console.error("[desk] 记不住位置：", err.message);
  }
}

function windowSize() {
  if (!win || win.isDestroyed()) return { width: 0, height: HEIGHT };
  const b = win.getBounds();
  return { width: b.width, height: b.height };
}

function primaryWorkArea() {
  return screen.getPrimaryDisplay().workArea;
}

/** 起始位置：记住过就用记住的（夹回工作区），否则贴底居中 */
function initialPos() {
  const size = windowSize();
  const work = primaryWorkArea();
  const saved = loadSavedPos();
  if (saved) return clampToWorkArea(saved, size, work);
  return bottomRestingPos(size, work, BOTTOM_MARGIN);
}

function createWindow() {
  const work = primaryWorkArea();
  const size = { width: Math.round(work.width), height: HEIGHT };

  win = new BrowserWindow({
    width: size.width,
    height: size.height,
    transparent: true,
    backgroundColor: "#00000000",
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: readOnTopPref(posFile(), fs, true),
    hasShadow: false,
    focusable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      backgroundThrottling: false, // 后台不许把渲染节流，挂机要一直在跑
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 位置必须等窗口建好再算：initialPos() 要用真实窗口尺寸（否则宽按 0 算，会跑到屏幕中间）
  const pos = initialPos();
  win.setPosition(pos.x, pos.y);

  // 置顶：初始值取上次记忆（关掉过就保持关着），keeper 负责被别的 topmost 窗口顶掉时补回来
  keeper = createOnTopKeeper({ getWindow: () => win });
  keeper.set(readOnTopPref(posFile(), fs, true));
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  drag = createDragController({
    getWindow: () => win,
    getCursor: () => FIXED_CURSOR ?? screen.getCursorScreenPoint(),
    getBounds: windowSize,
    getWorkArea: (pt) => screen.getDisplayNearestPoint(pt).workArea,
  });

  win.loadURL(GAME_URL);
  win.once("ready-to-show", () => win.show());

  win.webContents.on("did-fail-load", (_e, code, desc, url) => {
    console.error(`[desk] 载入失败 ${code} ${desc} → ${url}`);
    console.error("[desk] 开发时请确认 next dev 已经在跑（双击 打开游戏.cmd，或 npm run dev）");
  });
  win.webContents.on("did-finish-load", () => console.log(`[desk] 已载入 ${GAME_URL}，${size.width}×${size.height} @ (${pos.x}, ${pos.y})`));
  // 把渲染进程的 console 转发到终端，免得挂机时出问题看不见
  // Electron 新版把参数收进事件对象，这里两种形态都兼容
  win.webContents.on("console-message", (...args) => {
    const ev = args[0] && typeof args[0] === "object" && "message" in args[0] ? args[0] : null;
    const msg = String(ev ? ev.message : args[2] ?? "");
    const lvl = ev ? ev.level : args[1];
    const isErr = lvl === "error" || lvl === 3 || lvl === 2;
    if (isErr || /^\[(game|desk)\]/.test(msg)) {
      console.log(`[renderer${isErr ? ":ERR" : ""}] ${msg}`);
    }
  });
  // 注意：注入块/飘字块自己会截图 + 退出，别让这个自动截图块（2.5s 就 app.quit）抢跑
  if (SHOT && !LOOT_INJECT && !FLOAT_CHECK) {
    win.webContents.once("did-finish-load", () => {
      setTimeout(async () => {
        // DESK_SHOT_FX=1：截图前注入一发弹道 + 一个挥砍弧（0.18s 的特效，等不到，只能造）
        if (process.env.DESK_SHOT_FX === "1") {
          try {
            await win.webContents.executeJavaScript(`(() => {
              const g = window.__game;
              if (!g) return false;
              const hero = g.world.entities.find((e) => e.unit && e.unit.team === "hero");
              const x = hero ? hero.pos.x : 300;
              const y = g.scene.bounds.groundY;
              g.world.spawn({ id: "shot_bolt", model: g.models.get("bolt"), pos: { x: x + 150, y: y - 26 }, layer: 3, params: { dir: 1, speed: 0, damage: 0, team: 0, ttl: 30 } });
              g.world.spawn({ id: "shot_slash", model: g.models.get("slash"), pos: { x: x + 30, y: y - 30 }, layer: 4, params: { dir: 1, ttl: 30 } });
              g.world.spawn({ id: "shot_bolt2", model: g.models.get("bolt"), pos: { x: x + 420, y: y - 26 }, layer: 3, params: { dir: -1, speed: 0, damage: 0, team: 1, ttl: 30 } });
              return true;
            })()`);
          } catch (err) {
            console.error("[desk] 注入特效失败：", err.message);
          }
          await new Promise((r) => setTimeout(r, 120));
        }
        const img = await win.webContents.capturePage();
        fs.writeFileSync(SHOT, img.toPNG());
        console.log(`[desk] 已截图 → ${SHOT}`);
        app.quit();
      }, SHOT_AFTER);
    });
  }
  if (ALPHA_CHECK) {
    win.webContents.once("did-finish-load", async () => {
      await new Promise((r) => setTimeout(r, Number(process.env.DESK_ALPHA_CHECK_AFTER || 3500)));
      // 直接读画布像素的 alpha：这是渲染层真实的透明度（窗口级 alpha 会被系统合成干扰）
      const probe = `(() => {
        const g = window.__game;
        const c = document.querySelector("canvas");
        if (!c) return null;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        const band = (yFrac) => {
          const y = Math.min(c.height - 1, Math.max(0, Math.round(c.height * yFrac)));
          const row = ctx.getImageData(0, y, c.width, 1).data;
          let sum = 0, n = 0, min = 255, max = 0;
          for (let x = 0; x < c.width; x += 11) {
            const a = row[x * 4 + 3];
            sum += a; n++; if (a < min) min = a; if (a > max) max = a;
          }
          return { avg: sum / Math.max(1, n), min, max };
        };
        return { bgAlpha: g ? g.bgAlpha : null, groundAlpha: g ? g.groundAlpha : null, sky: band(0.12), mid: band(0.5), ground: band(0.88), w: c.width, h: c.height };
      })()`;
      try {
        const p = await win.webContents.executeJavaScript(probe);
        if (!p) throw new Error("拿不到画布");
        const expectSky = Math.round(p.bgAlpha * 255);
        const expectGround = Math.round(p.groundAlpha * 255);
        const f = (v) => v.toFixed(1);
        console.log(`[desk] 背景 alpha 采样（天空=${p.bgAlpha} 地面=${p.groundAlpha}，画布 ${p.w}×${p.h}）：`);
        console.log(`[desk]   天空带 avg=${f(p.sky.avg)} (${p.sky.min}~${p.sky.max})  期望≈${expectSky}`);
        console.log(`[desk]   中部带 avg=${f(p.mid.avg)} (${p.mid.min}~${p.mid.max})`);
        console.log(`[desk]   地面带 avg=${f(p.ground.avg)} (${p.ground.min}~${p.ground.max})  期望≈${expectGround}`);
        // 判据：两带各自都真的半透明（不是 255 全实、也不是看不见），且与各自设定吻合
        const semi = (r) => r.avg > 15 && r.avg < 250;
        const skyOk = semi(p.sky) && Math.abs(p.sky.avg - expectSky) <= 45;
        const groundOk = semi(p.ground) && Math.abs(p.ground.avg - expectGround) <= 60;
        const ok = skyOk && groundOk;
        console.log(
          `[desk] 背景半透明自检：${ok ? "通过" : "失败"}（天空 ${skyOk ? "OK" : "不符"} / 地面 ${groundOk ? "OK" : "不符"}）`,
        );

        // DESK_COMPOSITE=路径 → 把这一帧叠在「假壁纸」上导出，肉眼确认半透明效果
        const compositePath = process.env.DESK_COMPOSITE;
        if (compositePath) {
          const comp = `(() => {
            const c = document.querySelector("canvas");
            const W = c.width, H = c.height;
            const out = document.createElement("canvas");
            out.width = W; out.height = H;
            const o = out.getContext("2d");
            const g = o.createLinearGradient(0, 0, W, H);
            g.addColorStop(0, "#ffd9a0"); g.addColorStop(0.5, "#ff9e7a"); g.addColorStop(1, "#7a4bd0");
            o.fillStyle = g; o.fillRect(0, 0, W, H);
            o.fillStyle = "rgba(255,255,255,0.85)";
            for (let i = 0; i < 9; i++) { o.beginPath(); o.roundRect(60 + i * 300, 28, 140, 140, 18); o.fill(); }
            o.fillStyle = "#101018"; o.fillRect(0, H - 52, W, 52);
            o.fillStyle = "#ffd9a0"; o.font = "24px sans-serif";
            for (let i = 0; i < 8; i++) o.fillText("▣", 30 + i * 70, H - 16);
            o.drawImage(c, 0, 0);
            return out.toDataURL("image/png");
          })()`;
          const dataUrl = await win.webContents.executeJavaScript(comp);
          fs.writeFileSync(compositePath, Buffer.from(String(dataUrl).split(",")[1] || "", "base64"));
          console.log(`[desk] 已导出「叠在假壁纸上」的合成图 → ${compositePath}`);
        }
        app.exit(ok ? 0 : 1);
      } catch (err) {
        console.error("[desk] 背景半透明自检失败：", err.message);
        app.exit(1);
      }
    });
  }
  if (ONTOP_CHECK) {
    win.webContents.once("did-finish-load", async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      await sleep(Number(process.env.DESK_ONTOP_AFTER || 3000));
      // 采样两带像素 alpha：置顶开关动过之后透明不能坏（electron#5124 就是这个坑）
      const alphaProbe = `(() => {
        const c = document.querySelector("canvas");
        if (!c) return null;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        const band = (yFrac) => {
          const y = Math.min(c.height - 1, Math.max(0, Math.round(c.height * yFrac)));
          const row = ctx.getImageData(0, y, c.width, 1).data;
          let sum = 0, n = 0;
          for (let x = 0; x < c.width; x += 11) { sum += row[x * 4 + 3]; n++; }
          return sum / Math.max(1, n);
        };
        return { sky: band(0.12), ground: band(0.88) };
      })()`;
      try {
        // 界面上那个开关按钮（data-ontop）也得跟着变，不然就是「主进程真的切了、界面还是旧字」
        const chipProbe = `(() => {
          const b = document.querySelector("[data-ontop]");
          return b ? { attr: b.getAttribute("data-ontop"), text: b.textContent } : null;
        })()`;
        const chipBefore = await win.webContents.executeJavaScript(chipProbe);
        // 启动时必须按「上次的记忆」来（用户上次关掉过就保持关着），所以这里不硬性要求初始是开
        const prefBefore = readOnTopPref(posFile(), fs, true);
        const before = { onTop: win.isAlwaysOnTop(), alpha: await win.webContents.executeJavaScript(alphaProbe) };
        // ① 走界面真正用的那条路（IPC）关掉 —— 验的是「开关」不是「直接调 win 的方法」
        const offReturn = await win.webContents.executeJavaScript(`window.deskBar.setOnTop(false)`);
        await sleep(600);
        const afterOff = { onTop: win.isAlwaysOnTop(), alpha: await win.webContents.executeJavaScript(alphaProbe) };
        const prefAfterOff = readOnTopPref(posFile(), fs, true);
        const chipOff = await win.webContents.executeJavaScript(chipProbe);
        // ② 再开回来
        await win.webContents.executeJavaScript(`window.deskBar.setOnTop(true)`);
        await sleep(600);
        const afterOn = win.isAlwaysOnTop();
        const chipOn = await win.webContents.executeJavaScript(chipProbe);
        // ③ 心跳：绕过 keeper 直接把它顶下去（模拟被别的 topmost 窗口抢占），看它自己补不补
        win.setAlwaysOnTop(false, "screen-saver");
        const stolenAt = Date.now();
        while (Date.now() - stolenAt < 5000 && !win.isAlwaysOnTop()) await sleep(150);
        const restored = win.isAlwaysOnTop();
        const restoreMs = Date.now() - stolenAt;
        // ④ 自检完把用户的偏好还原（别让一次冒烟改了人家记住的设置）
        setOnTop(prefBefore, "自检还原");

        const close = (a, b) => Math.abs((a ?? -999) - (b ?? -999)) <= 8;
        const alphaOk = !!before.alpha && !!afterOff.alpha && close(before.alpha.sky, afterOff.alpha.sky) && close(before.alpha.ground, afterOff.alpha.ground);
        const offOk = offReturn === false && afterOff.onTop === false;
        const onOk = afterOn === true;
        const prefOk = prefAfterOff === false;
        // 启动时按记忆来（初始状态 == 文件里存的偏好）
        const memoryOk = before.onTop === prefBefore;
        // 按钮文字要跟着翻转（开→关→开），否则就是「状态切了、界面没跟」
        const chipOk = !!chipBefore && chipBefore.attr === "on" && !!chipOff && chipOff.attr === "off" && !!chipOn && chipOn.attr === "on";
        const f = (v) => (v === null || v === undefined ? "n/a" : v.toFixed(1));
        console.log(
          `[desk] 置顶开关：初始 ${before.onTop ? "开" : "关"} → 关（IPC 返回 ${offReturn}，实际 ${afterOff.onTop ? "开" : "关"}）→ 开（实际 ${afterOn ? "开" : "关"}）`,
        );
        console.log(
          `[desk] 透明对比：关之前 天空 ${f(before.alpha?.sky)} 地面 ${f(before.alpha?.ground)} / 关之后 天空 ${f(afterOff.alpha?.sky)} 地面 ${f(afterOff.alpha?.ground)}（允许 ±8）`,
        );
        console.log(`[desk] 偏好落盘：关掉后文件里 alwaysOnTop=${prefAfterOff}；被顶掉 ${restoreMs}ms 后自己补回来=${restored}`);
        console.log(`[desk] 界面按钮：「${chipBefore?.text ?? "无"}」→「${chipOff?.text ?? "无"}」→「${chipOn?.text ?? "无"}」`);
        const ok = memoryOk && offOk && onOk && prefOk && alphaOk && chipOk && restored && restoreMs <= 5000;
        console.log(
          `[desk] 置顶开关自检：${ok ? "通过" : "失败"}（按记忆启动=${memoryOk} 关得掉=${offOk} 开得回=${onOk} 按钮跟着翻=${chipOk} 偏好落盘=${prefOk} 关了透明没坏=${alphaOk} 被顶掉能补回=${restored} 已还原偏好=${prefBefore}）`,
        );
        app.exit(ok ? 0 : 1);
      } catch (err) {
        console.error("[desk] 置顶开关自检出错：", err.message);
        app.exit(1);
      }
    });
  }
  if (ERR_CHECK) {
    win.webContents.once("did-finish-load", async () => {
      await new Promise((r) => setTimeout(r, Number(process.env.DESK_ERR_CHECK_AFTER || 2600)));
      const probe = `(() => {
        const g = window.__game;
        if (!g) return null;
        const ents = g.world.entities;
        return {
          errors: g.ledger.count,
          lines: g.ledger.lines(),
          placeholders: ents.filter((e) => !g.models.has(e.modelId)).length,
          entities: ents.length,
          time: g.loop.time,
          fps: g.loop.fps,
        };
      })()`;
      try {
        const p = await win.webContents.executeJavaScript(probe);
        if (!p) throw new Error("拿不到 __game（主程序没起来就是真崩了）");
        console.log(`[desk] 容错采样：错误账本 ${p.errors} 条，占位实体 ${p.placeholders}/${p.entities} 个，t=${p.time.toFixed(1)}s fps=${p.fps.toFixed(0)}`);
        for (const line of p.lines) console.log(`[desk]   - ${line}`);
        // 判据：坏的被记账 + 用占位方块顶替 + 主循环照转（这就是"加载失败不影响主程序"）
        const recorded = p.errors >= 1;
        const substituted = p.placeholders >= 1;
        const alive = p.time > 1 && p.fps > 0;
        const ok = recorded && substituted && alive;
        console.log(
          `[desk] 容错自检：${ok ? "通过" : "失败"}（记账=${recorded} 占位顶替=${substituted} 主循环在转=${alive}）`,
        );
        app.exit(ok ? 0 : 1);
      } catch (err) {
        console.error("[desk] 容错自检失败：", err.message);
        app.exit(1);
      }
    });
  }
  if (SMOKE) {
    win.webContents.once("did-finish-load", async () => {
      // DESK_SMOKE=keys → 方向键调透明度（↑↓ 天空 / →← 地面），顺带截图看提示条
      if (SMOKE_KEYS) {
        const run = `(async () => {
          for (let i = 0; i < 80 && !window.__game; i++) await new Promise((r) => setTimeout(r, 50));
          const g = window.__game;
          if (!g) return { ok: false, why: "no __game" };
          const before = { bg: g.bgAlpha, ground: g.groundAlpha };
          for (const key of ["ArrowDown", "ArrowDown", "ArrowLeft"]) {
            window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
            await new Promise((r) => setTimeout(r, 130));
          }
          return { ok: true, before, bg: g.bgAlpha, ground: g.groundAlpha, action: g.models ? document.title : "" };
        })()`;
        try {
          const r = await win.webContents.executeJavaScript(run);
          if (!r?.ok) throw new Error(r?.why || "探针失败");
          const shot = process.env.DESK_SHOT;
          if (shot) {
            const img = await win.webContents.capturePage();
            fs.writeFileSync(shot, img.toPNG());
            console.log(`[desk] 已截图（含按键提示条）→ ${shot}`);
          }
          const okSky = Math.abs(r.bg - (r.before.bg - 0.16)) < 1e-9;
          const okGround = Math.abs(r.ground - (r.before.ground - 0.08)) < 1e-9;
          console.log(
            `[desk] 方向键自检：天空 ${r.before.bg} → ${r.bg}（↓↓ 各 -8%） 地面 ${r.before.ground} → ${r.ground}（← -8%）`,
          );
          console.log(okSky && okGround ? "[desk] 方向键自检：通过" : "[desk] 方向键自检：失败");
          app.exit(okSky && okGround ? 0 : 1);
          return;
        } catch (err) {
          console.error("[desk] 方向键自检失败：", err.message);
          app.exit(1);
          return;
        }
      }
      // DESK_SMOKE=move → 复现真实手势：按下后立刻移动（而不是先按住不动 350ms）
      if (SMOKE_MOVE) {
        const run = `(async () => {
          for (let i = 0; i < 60 && !window.__deskDragReady; i++) await new Promise((r) => setTimeout(r, 50));
          const canvas = document.querySelector("canvas");
          if (!canvas || !window.deskBar) return { ok: false, why: "no canvas/api" };
          let x = 400, y = 120;
          const opts = () => ({ bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y, pointerId: 1, isPrimary: true, pointerType: "mouse" });
          canvas.dispatchEvent(new PointerEvent("pointerdown", opts()));
          // 人手按下后不会定住：40ms 内已经移出 6px 容差
          await new Promise((r) => setTimeout(r, 40));
          for (const step of [3, 6, 10, 16, 24]) {
            x = 400 + step;
            window.dispatchEvent(new PointerEvent("pointermove", opts()));
            await new Promise((r) => setTimeout(r, 25));
          }
          const st = await window.deskBar.getState();
          const dragging = st.dragging;
          window.dispatchEvent(new PointerEvent("pointerup", opts()));
          await new Promise((r) => setTimeout(r, 120));
          const after = await window.deskBar.getState();
          return { ok: true, dragging, draggingAfterRelease: after.dragging, movedPx: x - 400 };
        })()`;
        try {
          const r = await win.webContents.executeJavaScript(run);
          console.log(`[desk] 手势自检（按下即移动 ${r?.movedPx}px）：拖动中 dragging=${r?.dragging} 松手后 dragging=${r?.draggingAfterRelease}`);
          const ok = r?.ok && r.dragging === true && r.draggingAfterRelease === false;
          console.log(ok ? "[desk] 手势自检：通过" : "[desk] 手势自检：失败（按下就移动无法拖动窗口）");
          app.exit(ok ? 0 : 1);
          return;
        } catch (err) {
          console.error("[desk] 手势自检失败：", err.message);
          app.exit(1);
          return;
        }
      }
      const before = win.getPosition();
      const shotPath = process.env.DESK_SMOKE_SHOT || "temp/desk-dragging.png";
      const press = `(async () => {
        // 等 React effect 把监听挂上（did-finish-load 会早于它）
        for (let i = 0; i < 60 && !window.__deskDragReady; i++) await new Promise((r) => setTimeout(r, 50));
        const canvas = document.querySelector("canvas");
        if (!canvas || !window.deskBar) return false;
        const opts = { bubbles: true, cancelable: true, button: 0, clientX: 400, clientY: 120, pointerId: 1, isPrimary: true, pointerType: "mouse" };
        canvas.dispatchEvent(new PointerEvent("pointerdown", opts));
        window.__deskOpts = opts;
        return true;
      })()`;
      try {
        // 走完整链路：页面长按判定 → preload → ipcMain → 拖动控制器 → 状态回推
        const hasApi = await win.webContents.executeJavaScript(press);
        await new Promise((r) => setTimeout(r, 500));
        const holding = await win.webContents.executeJavaScript("window.deskBar.getState()");
        const img = await win.webContents.capturePage();
        fs.writeFileSync(shotPath, img.toPNG());
        const released = await win.webContents
          .executeJavaScript('window.dispatchEvent(new PointerEvent("pointerup", window.__deskOpts)), true')
          .then(() => new Promise((r) => setTimeout(r, 150)))
          .then(() => win.webContents.executeJavaScript("window.deskBar.getState()"));
        const after = win.getPosition();
        const posMoved = after[0] !== before[0] || after[1] !== before[1];
        console.log(`[desk] 拖动自检：hasApi=${hasApi} 按住中 dragging=${holding.dragging} 松手后 dragging=${released.dragging}`);
        console.log(
          `[desk] 窗口位置 前→后：${before} → ${after}` +
            (FIXED_CURSOR ? "（固定光标，位置必须不变）" : "（真实光标可能在动，仅供参考）"),
        );
        console.log(`[desk] 拖动中的截图 → ${shotPath}`);
        const posOk = FIXED_CURSOR ? !posMoved : true;
        if (!hasApi || !holding.dragging || released.dragging || !posOk) {
          console.error("[desk] 拖动自检：失败");
          app.exit(1);
          return;
        }
        console.log("[desk] 拖动自检：通过");
      } catch (err) {
        console.error("[desk] 拖动自检失败：", err.message);
        app.exit(1);
        return;
      }
      app.quit();
    });
  }
  if (LOOT_INJECT) {
    win.webContents.once("did-finish-load", async () => {
      await new Promise((r) => setTimeout(r, Number(process.env.DESK_LOOT_INJECT_AFTER || 4000)));
      // 用游戏自己的 world.spawn + models.get("loot") 在固定位置造一个暗金掉落物：
      // 这样截图位置可控，能精确裁图确认「掉落图标 + 品质色名字标签」真的画出来了。
      // born 给个大负数 → 永远不到拾取/吸附时间，掉落物留在原地（不然几百毫秒就被捡走，扫不到标签）
      const inject = `(() => {
        const g = window.__game;
        if (!g) return { ok: false, why: "no __game" };
        const model = g.models.get("loot");
        if (!model) return { ok: false, why: "没有 loot 模型" };
        const x = Number(${JSON.stringify(process.env.DESK_LOOT_INJECT_X || "600")});
        const e = g.world.spawn({
          id: "probe_drop",
          model,
          pos: { x, y: g.scene.bounds.groundY },
          layer: 2,
          layerName: "ground",
          params: { quality: 3, born: -1000000, grounded: 1, vy: 0 },
          drop: { item: { probe: true }, label: "★★ 索命之刃（注入）", color: "#ff00ff", quality: 3 },
        });
        return { ok: true, x, y: g.scene.bounds.groundY, id: e.id, modelId: e.modelId, modelH: model.size.h, hasDrop: !!e.drop, dropLabel: e.drop ? e.drop.label : null };
      })()`;
      try {
        const r = await win.webContents.executeJavaScript(inject);
        if (!r?.ok) throw new Error(r?.why || "注入失败");
        console.log(`[desk] 已注入掉落物 @(${r.x}, ${r.y})，模型 ${r.modelId}，载荷 ${r.hasDrop ? `「${r.dropLabel}」` : "被吞了！"}`);
        // 关掉光影，让标签颜色不被压暗；然后用「不可能撞色的青色」数像素（标签专用标记色）
        await win.webContents.executeJavaScript(
          'window.dispatchEvent(new KeyboardEvent("keydown", { key: "3", bubbles: true, cancelable: true })), true',
        );
        await new Promise((res) => setTimeout(res, 400));

        // 像素级验标签：只数「地平线以上」的洋红像素（左下角 HUD 会显示最近掉落物，颜色一样，别混进来）
        const labelProbe = `(() => {
          try {
            const g = window.__game;
            const c = document.querySelector("canvas");
            const ctx = c.getContext("2d", { willReadFrequently: true });
            const dpr = c.width / (c.clientWidth || c.width);
            const d = ctx.getImageData(0, 0, c.width, c.height).data;
            const yMaxDev = Math.round(${r.y} * dpr); // 锚点所在的设备像素行：标签必须在这之上
            let count = 0, minX = 1e9, maxX = -1, minY = 1e9, maxY = -1, belowCount = 0;
            for (let i = 0; i < d.length; i += 4) {
              if (d[i] > 180 && d[i + 1] < 100 && d[i + 2] > 180) {
                const px = (i / 4) % c.width, py = Math.floor(i / 4 / c.width);
                if (py > yMaxDev) { belowCount++; continue; }
                count++;
                if (px < minX) minX = px; if (px > maxX) maxX = px;
                if (py < minY) minY = py; if (py > maxY) maxY = py;
              }
            }
            const still = g ? g.world.entities.some((e) => e.id === "probe_drop") : null;
            return { ok: true, count, belowCount, still, dpr, box: count ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : null };
          } catch (e) {
            return { ok: false, err: String(e) };
          }
        })()`;
        const p = await win.webContents.executeJavaScript(labelProbe);
        if (!p?.ok) throw new Error(`像素探针报错：${p?.err}`);
        const boxCss = p.box
          ? {
              x: Math.round(p.box.x / p.dpr),
              y: Math.round(p.box.y / p.dpr),
              w: Math.round(p.box.w / p.dpr),
              h: Math.round(p.box.h / p.dpr),
            }
          : null;
        console.log(
          `[desk] 地平线以上洋红像素 ${p.count} 个${boxCss ? `，包围盒 CSS(${boxCss.x},${boxCss.y}) ${boxCss.w}×${boxCss.h}` : ""}` +
            `；地平线以下 ${p.belowCount} 个（HUD 那行，不算）；掉落物还在场上 ${p.still}（锚点 y=${r.y}）`,
        );
        // 判据：标签画出来了、在锚点上方、而且不是靠 HUD 那行蒙的
        const labelDrawn = p.still === true && p.count >= 20 && !!boxCss && boxCss.y + boxCss.h <= r.y;
        console.log(`[desk] 标签像素自检：${labelDrawn ? "通过" : "失败（标签没画、画错位置，或掉落已被捡走）"}`);

        // 再把光影打开，量同一个框里的标签亮度：标签要是画在光影之前，会被环境光一起压暗（读不清）
        if (boxCss) {
          await win.webContents.executeJavaScript(
            'window.dispatchEvent(new KeyboardEvent("keydown", { key: "3", bubbles: true, cancelable: true })), true',
          );
          await new Promise((res) => setTimeout(res, 350));
          const lumaProbe = `(() => {
            const c = document.querySelector("canvas");
            const ctx = c.getContext("2d", { willReadFrequently: true });
            const dpr = c.width / (c.clientWidth || c.width);
            const x = Math.max(0, Math.round(${boxCss.x - 6} * dpr));
            const y = Math.max(0, Math.round(${boxCss.y - 4} * dpr));
            const w = Math.max(1, Math.round(${boxCss.w + 12} * dpr));
            const h = Math.max(1, Math.round(${boxCss.h + 8} * dpr));
            const d = ctx.getImageData(x, y, w, h).data;
            let max = 0, sum = 0, n = 0, warm = 0;
            for (let i = 0; i < d.length; i += 4) {
              const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
              n++; sum += l; if (l > max) max = l;
              if (d[i] > 120 && d[i + 2] > 120 && d[i + 1] < 110) warm++;
            }
            return { max: Math.round(max), avg: Math.round(sum / Math.max(1, n)), warm };
          })()`;
          const l = await win.webContents.executeJavaScript(lumaProbe);
          console.log(`[desk] 光影打开后同一框内标签：最亮 ${l.max} 均值 ${l.avg} 洋红像素 ${l.warm}`);
        }
        if (SHOT) {
          const img = await win.webContents.capturePage();
          fs.writeFileSync(SHOT, img.toPNG());
          console.log(`[desk] 已截图 → ${SHOT}`);
        }
        app.exit(labelDrawn ? 0 : 1);
      } catch (err) {
        console.error("[desk] 掉落物注入自检失败：", err.message);
        app.exit(1);
      }
    });
  }
  if (SFX_CHECK) {
    win.webContents.once("did-finish-load", async () => {
      await new Promise((r) => setTimeout(r, Number(process.env.DESK_SFX_AFTER || 4000)));
      // 音频没法"看"，只能量：AudioContext 是否 running + 播放后 AnalyserNode 的时域峰值
      const probe = `(async () => {
        const g = window.__game;
        if (!g) return { ok: false, why: "拿不到 __game" };
        if (!g.audio) return { ok: false, why: "handle 没暴露 audio（main.ts 要把 createAudio() 挂到返回值上）" };
        const a = g.audio;
        const stateBefore = a.state;
        a.unlock();
        const results = [];
        for (const name of ["pickup", "drop", "unique", "coin"]) {
          const played = a.play(name);
          await new Promise((r) => setTimeout(r, 160));
          results.push({ name, played, peak: Math.round(a.lastPeak * 1000) / 1000 });
        }
        const twice = a.play("pickup") && a.play("pickup"); // 第二次应被 60ms 限流挡掉
        await new Promise((r) => setTimeout(r, 120));
        a.setMuted(true);
        const afterMute = a.play("pickup");
        a.setMuted(false);
        return { ok: true, stateBefore, state: a.state, muted: a.muted, results, twice, afterMute };
      })()`;
      try {
        const r = await win.webContents.executeJavaScript(probe);
        if (!r?.ok) throw new Error(r?.why);
        console.log(`[desk] 音频状态：载入后 ${r.stateBefore} → 播放后 ${r.state}（静音开关 ${r.muted}）`);
        for (const x of r.results) console.log(`[desk]   ${x.name}: played=${x.played} 峰值=${x.peak}`);
        console.log(`[desk] 限流：连播两次 pickup → ${r.twice}（期望 false）；静音后播放 → ${r.afterMute}（期望 false）`);
        const running = r.state === "running";
        const audible = r.results.filter((x) => x.played === true && x.peak > 0.01).length;
        const allPlayed = r.results.every((x) => x.played === true);
        // 第一次播放也必须出声（冷启动被吞是老坑：audio.ts 里靠 warmUp 顶设备）
        const firstAudible = r.results[0].played === true && r.results[0].peak > 0.01;
        const ok = running && allPlayed && audible >= 3 && firstAudible && r.twice === false && r.afterMute === false;
        console.log(
          `[desk] 音效自检：${ok ? "通过" : "失败"}（音频在跑=${running} 四个音效都播了=${allPlayed} 有电平的=${audible}/4 第一声也出声=${firstAudible} 限流生效=${r.twice === false} 静音生效=${r.afterMute === false}）`,
        );
        app.exit(ok ? 0 : 1);
      } catch (err) {
        console.error("[desk] 音效自检失败：", err.message);
        app.exit(1);
      }
    });
  }
  if (FLOAT_CHECK) {
    win.webContents.once("did-finish-load", async () => {
      await new Promise((r) => setTimeout(r, Number(process.env.DESK_FLOAT_AFTER || 4000)));
      // 注入一个洋红飘字（洋红不会和场景撞色），再数像素 + 给包围盒
      const inject = `(() => {
        const g = window.__game;
        if (!g) return { ok: false, why: "拿不到 __game" };
        if (!g.floaters) return { ok: false, why: "handle 没暴露 floaters（main.ts 要把 createFloaters() 挂上去）" };
        const hero = g.world.entities.find((e) => e.unit && e.unit.team === "hero");
        const x = hero ? Math.round(hero.pos.x) : 600;
        const y = (hero ? hero.pos.y : g.scene.bounds.groundY) - 46;
        const f = g.floaters.spawn({ x, y, color: "#ff00ff", kind: "label", text: "测试飘字（注入）" });
        return { ok: true, x, y, alive: !!f && f.alive === true, text: f ? f.text : null };
      })()`;
      try {
        const r = await win.webContents.executeJavaScript(inject);
        if (!r?.ok) throw new Error(r?.why);
        console.log(`[desk] 已注入飘字 @(${r.x}, ${r.y})：「${r.text}」`);
        await new Promise((res) => setTimeout(res, 250));
        const scan = `(() => {
          const c = document.querySelector("canvas");
          const ctx = c.getContext("2d", { willReadFrequently: true });
          const dpr = c.width / (c.clientWidth || c.width);
          const d = ctx.getImageData(0, 0, c.width, c.height).data;
          let count = 0, minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
          for (let i = 0; i < d.length; i += 4) {
            if (d[i] > 180 && d[i + 1] < 100 && d[i + 2] > 180) {
              const px = (i / 4) % c.width, py = Math.floor(i / 4 / c.width);
              count++;
              if (px < minX) minX = px; if (px > maxX) maxX = px;
              if (py < minY) minY = py; if (py > maxY) maxY = py;
            }
          }
          return { count, dpr, box: count ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : null };
        })()`;
        const p = await win.webContents.executeJavaScript(scan);
        const box = p.box
          ? { x: Math.round(p.box.x / p.dpr), y: Math.round(p.box.y / p.dpr), w: Math.round(p.box.w / p.dpr), h: Math.round(p.box.h / p.dpr) }
          : null;
        const camX = await win.webContents.executeJavaScript(
          "((g) => (g.scene.bounds.w - window.innerWidth) / 2)(window.__game)",
        );
        console.log(`[desk] 飘字洋红像素 ${p.count} 个${box ? `，包围盒 CSS(${box.x},${box.y}) ${box.w}×${box.h}` : ""}（相机 ${camX}）`);
        // 世界坐标 → 屏幕坐标要减相机：只比世界 x 会在非 2560 宽的显示器上假红
        const screenX = r.x - camX;
        const near = box ? Math.abs(box.x + box.w / 2 - screenX) <= 30 : false;
        const ok = p.count >= 20 && near;
        console.log(`[desk] 飘字像素自检：${ok ? "通过" : "失败"}（像素=${p.count >= 20} 居中在英雄上方=${near}）`);
        if (SHOT) {
          const img = await win.webContents.capturePage();
          fs.writeFileSync(SHOT, img.toPNG());
          console.log(`[desk] 已截图 → ${SHOT}`);
        }
        app.exit(ok ? 0 : 1);
      } catch (err) {
        console.error("[desk] 飘字自检失败：", err.message);
        app.exit(1);
      }
    });
  }
  if (LOOT_CHECK) {
    win.webContents.once("did-finish-load", async () => {
      const sample = `(() => {
        const g = window.__game;
        if (!g) return null;
        const drops = g.world.entities.filter((e) => e.drop);
        return {
          t: Math.round(g.loop.time * 10) / 10,
          kills: g.stats.kills,
          onGround: drops.length,
          labelled: drops.filter((d) => d.drop && typeof d.drop.label === "string" && d.drop.label.length > 0).length,
          grounded: drops.filter((d) => d.params && d.params.grounded === 1).length,
          bag: g.lootBag.length,
          floaters: g.floaters ? g.floaters.list.filter((f) => f.alive).length : null,
          loot: g.stats.loot,
          lastDrop: g.stats.lastDrop ? g.stats.lastDrop.text : null,
          errors: g.ledger.count,
        };
      })()`;
      const seen = { maxOnGround: 0, maxLabelled: 0, maxGrounded: 0, maxFloaters: 0, samples: 0, last: null };
      let captured = false;
      let capturedFloat = false;
      const until = Date.now() + LOOT_CHECK;
      while (Date.now() < until) {
        try {
          const s = await win.webContents.executeJavaScript(sample);
          if (s) {
            seen.samples++;
            seen.maxOnGround = Math.max(seen.maxOnGround, s.onGround);
            seen.maxLabelled = Math.max(seen.maxLabelled, s.labelled);
            seen.maxGrounded = Math.max(seen.maxGrounded, s.grounded);
            if (typeof s.floaters === "number") seen.maxFloaters = Math.max(seen.maxFloaters, s.floaters);
            seen.last = s;
            // 掉落物落地的时间窗很短（默认 ~0.45s 就被捡走），所以趁它在地上那一下截图
            // 注意用专用变量：DESK_SHOT 会触发自动截图块并 app.quit()，断言就没机会跑了（假绿的坑）
            const lootShot = process.env.DESK_LOOT_SHOT;
            if (!captured && s.onGround >= 1 && lootShot) {
              captured = true;
              const img = await win.webContents.capturePage();
              fs.writeFileSync(lootShot, img.toPNG());
              console.log(`[desk] 抓到地上的掉落物（${s.onGround} 个）→ ${lootShot}`);
            }
            // 真实飘字（拾取/金币）只活 1.1s，也趁它出现那一下抓一张
            const floatShot = process.env.DESK_LOOT_FLOAT_SHOT;
            if (!capturedFloat && typeof s.floaters === "number" && s.floaters >= 1 && floatShot) {
              capturedFloat = true;
              const img = await win.webContents.capturePage();
              fs.writeFileSync(floatShot, img.toPNG());
              console.log(`[desk] 抓到真实飘字（同时 ${s.floaters} 个）→ ${floatShot}`);
            }
          }
        } catch (err) {
          console.error("[desk] 掉落采样出错：", err.message);
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      const s = seen.last;
      const dropped = s ? s.loot.normal + s.loot.magic + s.loot.rare + s.loot.unique : 0;
      console.log(`[desk] 掉落采样 ${seen.samples} 次 / ${LOOT_CHECK}ms`);
      console.log(`[desk] 末次：${JSON.stringify(s)}`);
      console.log(`[desk] 峰值：地上 ${seen.maxOnGround} 个（其中已落地 ${seen.maxGrounded}、带名字标签 ${seen.maxLabelled}），同时活着飘字 ${seen.maxFloaters}`);
      // 判据：真的掉在地上过（不是直接进袋）、落地过、带标签、最终被捡走、拾取时飘字出现过、零报错
      const ok =
        !!s &&
        s.kills >= 3 &&
        seen.maxOnGround >= 1 &&
        seen.maxGrounded >= 1 &&
        seen.maxLabelled >= 1 &&
        seen.maxFloaters >= 1 &&
        dropped >= 1 &&
        s.errors === 0;
      console.log(`[desk] 结算：击杀 ${s?.kills} / 累计掉落 ${dropped} 件 / 战利品袋 ${s?.bag} / 最近 ${s?.lastDrop}`);
      console.log(
        `[desk] 掉落自检：${ok ? "通过" : "失败"}（地上出现过=${seen.maxOnGround >= 1} 落地动画=${seen.maxGrounded >= 1} 标签=${seen.maxLabelled >= 1} 拾取飘字出现过=${seen.maxFloaters >= 1} 已入袋=${!!s && s.bag >= 1} 零报错=${!!s && s.errors === 0}）`,
      );
      app.exit(ok ? 0 : 1);
    });
  }
  if (COMBAT_CHECK) {
    win.webContents.once("did-finish-load", async () => {
      const sample = `(() => {
        const g = window.__game;
        if (!g) return null;
        const units = g.world.entities.filter((e) => e.unit);
        return {
          t: Math.round(g.loop.time * 10) / 10,
          wave: g.stats.wave,
          kills: g.stats.kills,
          enemies: g.stats.enemies,
          heroHp: g.stats.heroHp,
          heroDown: g.stats.heroDown,
          bolts: g.world.entities.filter((e) => e.modelId === "bolt").length,
          fx: g.world.entities.filter((e) => e.modelId === "slash").length,
          heroUnits: units.filter((e) => e.unit.team === "hero").length,
          enemyUnits: units.filter((e) => e.unit.team === "enemy").length,
          errors: g.ledger.count,
          stage: g.stats.stageLabel,
          loot: g.stats.loot,
          lootBag: g.lootBag.length,
          gold: g.stats.gold,
          misses: g.stats.misses,
          lastDrop: g.stats.lastDrop ? g.stats.lastDrop.text : null,
          detail: units.slice(0, 6).map((e) => e.unit.team + "/" + e.unit.kind + " x" + Math.round(e.pos.x) + " hp" + e.unit.hp + " cd" + e.unit.cd.toFixed(2) + " r" + e.unit.range),
        };
      })()`;
      const seen = { maxBolts: 0, maxFx: 0, maxEnemyUnits: 0, samples: 0, last: null, maxLootBag: 0 };
      const until = Date.now() + COMBAT_CHECK;
      while (Date.now() < until) {
        try {
          const s = await win.webContents.executeJavaScript(sample);
          if (s) {
            seen.samples++;
            seen.maxBolts = Math.max(seen.maxBolts, s.bolts);
            seen.maxFx = Math.max(seen.maxFx, s.fx);
            seen.maxEnemyUnits = Math.max(seen.maxEnemyUnits, s.enemyUnits);
            seen.maxLootBag = Math.max(seen.maxLootBag, s.lootBag);
            seen.last = s;
          }
        } catch (err) {
          console.error("[desk] 采样失败：", err.message);
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      const s = seen.last;
      console.log(`[desk] 战斗采样 ${seen.samples} 次 / ${COMBAT_CHECK}ms`);
      console.log(`[desk] 末次：${JSON.stringify(s)}`);
      if (s?.detail) console.log(`[desk] 单位：${s.detail.join(" | ")}`);
      console.log(`[desk] 峰值：弹道 ${seen.maxBolts} 个，特效 ${seen.maxFx} 个，场上敌单位 ${seen.maxEnemyUnits}，战利品袋 ${seen.maxLootBag}`);
      // 掉落必须真的发生（挂机的正反馈），且全程零报错
      const dropped = s ? s.loot.normal + s.loot.magic + s.loot.rare + s.loot.unique : 0;
      const ok =
        !!s &&
        s.kills >= 3 &&
        s.wave >= 1 &&
        seen.maxBolts >= 1 &&
        seen.maxFx >= 1 &&
        seen.maxEnemyUnits >= 2 &&
        seen.maxLootBag >= 1 &&
        s.gold > 0 &&
        s.errors === 0;
      console.log(`[desk] 结算：击杀 ${s?.kills} / 掉落 ${dropped} 件 / 金币 ${s?.gold} / 关卡 ${s?.stage}`);
      console.log(ok ? "[desk] 战斗自检：通过" : "[desk] 战斗自检：失败");
      app.exit(ok ? 0 : 1);
    });
  }
  win.on("closed", () => {
    if (drag) drag.stopDrag();
    win = null;
  });
}

function setClickThrough(on) {
  clickThrough = on;
  if (win) win.setIgnoreMouseEvents(on, { forward: true });
  sendState();
  console.log(`[desk] 点击穿透 ${on ? "开（鼠标穿过去）" : "关（可以点）"}`);
}

/**
 * 置顶开关的唯一入口：界面点击 / 快捷键 / 自检都走这里。
 * 三件事必须一起发生：① keeper 应用并管心跳 ② 落盘记住 ③ 广播给界面。
 * @param {boolean} on
 * @param {string} why 谁触发的（日志用）
 */
function setOnTop(on, why = "界面") {
  const v = keeper ? keeper.set(on) : false;
  writeOnTopPref(posFile(), fs, v);
  sendState();
  console.log(`[desk] 置顶 ${v ? "开" : "关"}（${why}）`);
  return v;
}

function state() {
  return {
    dragging: !!(drag && drag.active()),
    clickThrough,
    alwaysOnTop: win ? win.isAlwaysOnTop() : false,
    pos: win && !win.isDestroyed() ? { x: win.getPosition()[0], y: win.getPosition()[1] } : null,
  };
}

function sendState() {
  if (win && !win.isDestroyed()) win.webContents.send("desk:state", state());
}

function resetToBottom() {
  if (!win || win.isDestroyed()) return null;
  const pos = bottomRestingPos(windowSize(), primaryWorkArea(), BOTTOM_MARGIN);
  win.setPosition(pos.x, pos.y);
  savePos(pos);
  sendState();
  console.log(`[desk] 已复位到底部 (${pos.x}, ${pos.y})`);
  return pos;
}

// ---- 渲染进程要的接口（长按拖动）----
ipcMain.handle("desk:drag-start", () => {
  if (!win || win.isDestroyed()) return { ok: false };
  // 点击穿透开着的话收不到鼠标事件，先摘掉；松手时由 renderer 决定要不要装回去
  if (clickThrough) setClickThrough(false);
  const ok = drag.startDrag();
  sendState();
  return { ok, state: state() };
});
ipcMain.handle("desk:drag-end", () => {
  const r = drag.stopDrag();
  if (r && r.moved) savePos(r.pos);
  sendState();
  return r ?? { moved: false, pos: null };
});
ipcMain.handle("desk:reset", () => resetToBottom());
ipcMain.handle("desk:get-state", () => state());
// 置顶开关：界面点/快捷键/自检都走 setOnTop，保证「状态 + 落盘 + 广播」一起发生
ipcMain.handle("desk:set-on-top", (_e, on) => setOnTop(typeof on === "boolean" ? on : !(keeper && keeper.enabled()), "界面"));

app.whenReady().then(() => {
  createWindow();

  globalShortcut.register("Control+Alt+D", () => setClickThrough(!clickThrough));
  globalShortcut.register("Control+Alt+T", () => setOnTop(!(keeper && keeper.enabled()), "快捷键"));
  globalShortcut.register("Control+Alt+S", () => resetToBottom());
  globalShortcut.register("Control+Alt+R", () => win && win.reload());
  globalShortcut.register("Control+Alt+Q", () => app.quit());

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => app.quit());
