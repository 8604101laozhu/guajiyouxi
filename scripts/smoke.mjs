#!/usr/bin/env node
/**
 * 冒烟矩阵 —— 改完任何功能跑这一个命令，别靠记忆挑测试。
 *
 *   npm run smoke                 跑全部（静态项 + 真窗口项，约 2~3 分钟）
 *   npm run smoke -- --fast       只跑静态项（vitest/tsc/eslint/build，约 1 分钟）
 *   npm run smoke -- --only=拖动   只跑名字里含「拖动」的项
 *   npm run smoke -- --list       只列出有哪些项
 *
 * 判定一律看**子进程出口码**（每个探针自己 app.exit(0/1)），不去 grep 日志文字 —— 文字会改，出口码不会。
 * 有一项失败就以非零码退出，所以子代理/CI 都能直接拿它当验收门。
 *
 * 每一项对应一个功能，功能改了就把对应项补上/改掉，别让矩阵烂掉。
 */
import { spawnSync } from "node:child_process";
import { connect as netConnect } from "node:net";
import { mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEV_URL = process.env.DESK_DEV_URL || "http://127.0.0.1:45231";
const SHOT_DIR = "temp/smoke";
/**
 * 所有子进程共用一个「测试专用」的 userData 目录（通过 DESK_USER_DATA 注入）。
 * 理由：自检会真的拖窗口、真的切置顶，共用用户的 userData 会把用户记住的位置/偏好写坏
 * （真踩过：条被挪到两块屏之间的死区 x=2560，用户根本看不见它了）。
 */
const SMOKE_USER_DATA = path.join(
  // 不能放仓库里（G 盘那个目录 Chromium 挪缓存会报「拒绝访问 0x5」，和 dsh 的 ACL 坑同源）
  process.env.LOCALAPPDATA || process.env.TEMP || path.join(ROOT, "temp"),
  "guajiyouxi-smoke",
  "userdata",
);
const IS_WIN = process.platform === "win32";

/**
 * 一定要用 bash 跑子进程：窗口项靠 `VAR=值 命令` 注入环境变量。
 * Windows 上 `shell: true` 走的是 cmd.exe，那句语法直接报「不是内部或外部命令」（踩过）。
 */
const BASH = process.env.SHELL || (IS_WIN ? "bash" : "/bin/bash");
const hasBash = (() => {
  try {
    const r = spawnSync(BASH, ["-c", "echo smoke-bash-ok"], { encoding: "utf8", timeout: 15000 });
    return r.status === 0 && String(r.stdout || "").includes("smoke-bash-ok");
  } catch {
    return false;
  }
})();

const args = process.argv.slice(2);
const FAST = args.includes("--fast");
const LIST = args.includes("--list");
const ONLY = (args.find((a) => a.startsWith("--only=")) || "").split("=")[1] || "";

/**
 * 每项：name 功能名 / cmd 命令 / env 环境变量 / timeout 秒
 * fast=true 的项不需要窗口（不依赖 dev server）
 */
const CHECKS = [
  { name: "单元测试 vitest", cmd: "npx vitest run", fast: true, timeout: 300 },
  { name: "类型检查 tsc", cmd: "npx tsc -p tsconfig.json --noEmit", fast: true, timeout: 300 },
  { name: "代码规范 eslint", cmd: "npx eslint src/game src/app/desk electron", fast: true, timeout: 300 },
  { name: "生产构建 build", cmd: "npm run build", fast: true, timeout: 420 },
  {
    name: "场景渲染与截图",
    cmd: `DESK_SHOT=${SHOT_DIR}/render.png DESK_SHOT_AFTER=3000 DESK_FORGET_POS=1 npm run desk`,
    timeout: 120,
    expect: "已截图",
  },
  {
    name: "容错：坏模型/坏场景不崩",
    cmd: `GAME_URL="${DEV_URL}/desk?scene=/scenes/_selftest.json" DESK_ERR_CHECK=1 DESK_FORGET_POS=1 npm run desk`,
    timeout: 120,
    expect: "容错自检：通过",
  },
  {
    name: "窗口拖动（长按）",
    cmd: `DESK_SMOKE=1 DESK_DRAG_FIXED_CURSOR="600,900" DESK_FORGET_POS=1 npm run desk`,
    timeout: 120,
    expect: "拖动自检：通过",
  },
  {
    name: "窗口拖动（按下即拖手势）",
    cmd: "DESK_SMOKE=move DESK_FORGET_POS=1 npm run desk",
    timeout: 120,
    expect: "手势自检：通过",
  },
  {
    name: "透明度方向键 + 提示条",
    cmd: `DESK_SMOKE=keys DESK_SHOT=${SHOT_DIR}/key-toast.png DESK_FORGET_POS=1 npm run desk`,
    timeout: 120,
    expect: "方向键自检：通过",
  },
  {
    name: "背景半透明 alpha",
    cmd: "DESK_ALPHA_CHECK=1 DESK_FORGET_POS=1 npm run desk",
    timeout: 150,
    expect: "背景半透明自检：通过",
  },
  {
    name: "自动战斗 + 掉落",
    cmd: "DESK_COMBAT_CHECK=25000 DESK_FORGET_POS=1 npm run desk",
    timeout: 180,
    expect: "战斗自检：通过",
  },
  { name: "掉落物落地 + 挂机拾取", cmd: `DESK_LOOT_CHECK=25000 DESK_LOOT_SHOT=${SHOT_DIR}/loot.png DESK_FORGET_POS=1 npm run desk`, timeout: 180, expect: "掉落自检：通过" },
  {
    name: "掉落物外观（名字标签像素）",
    cmd: `DESK_LOOT_INJECT=1 DESK_SHOT=${SHOT_DIR}/loot-label.png DESK_FORGET_POS=1 npm run desk`,
    timeout: 120,
    expect: "标签像素自检：通过",
  },
  {
    name: "拾取飘字（像素 + 居中）",
    cmd: `DESK_FLOAT_CHECK=1 DESK_SHOT=${SHOT_DIR}/floater.png DESK_FORGET_POS=1 npm run desk`,
    timeout: 120,
    expect: "飘字像素自检：通过",
  },
  {
    name: "音效（AudioContext + 电平峰值）",
    cmd: "DESK_SFX_CHECK=1 DESK_FORGET_POS=1 npm run desk",
    timeout: 120,
    expect: "音效自检：通过",
  },
  {
    name: "置顶开关（关/开/透明没坏/心跳补回）",
    cmd: `DESK_ONTOP_CHECK=1 DESK_FORGET_POS=1 npm run desk`,
    timeout: 120,
    expect: "置顶开关自检：通过",
  },
  {
    name: "离线收益 + 存档（种一份 3 小时前的存档）",
    cmd: `DESK_FRESH=0 DESK_OFFLINE_CHECK=1 DESK_FORGET_POS=1 npm run desk`,
    timeout: 120,
    expect: "离线收益自检：通过",
  },
  {
    name: "拖动控制器（真窗口）",
    cmd: "./node_modules/.bin/electron temp/drag-probe.cjs",
    timeout: 120,
    expect: "拖动自检：全部通过",
  },
];

if (LIST) {
  for (const c of CHECKS) console.log(`${c.fast ? "静态" : "窗口"}  ${c.name}`);
  process.exit(0);
}

const want = (c) => (!FAST || c.fast) && (!ONLY || c.name.includes(ONLY));
const selected = CHECKS.filter(want);
if (selected.length === 0) {
  console.error(`没有匹配的检查项（--only=${ONLY}）。用 --list 看有哪些。`);
  process.exit(2);
}

// ---------- dev server 准备（窗口项要它） ----------
const needServer = selected.some((c) => !c.fast);
let server = null;

async function reachable() {
  try {
    const res = await fetch(`${DEV_URL}/desk`, { signal: AbortSignal.timeout(2500) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * 端口有没有人在监听（TCP 能不能连上）。
 * 用来区分两种「起不来」：端口空着 = 真没起（可以自己拉一个）；
 * 端口在监听但 HTTP 不响应 = **卡死的 dev server**（真踩过：每项干等 120s 超时，
 * 看起来像「代码挂了」，实际白等 7 分钟）。
 */
function portListening(url) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const s = netConnect({ host: u.hostname, port: Number(u.port) || 80 });
      const done = (v) => {
        try {
          s.destroy();
        } catch {
          /* ignore */
        }
        resolve(v);
      };
      s.setTimeout(1500);
      s.once("connect", () => done(true));
      s.once("error", () => done(false));
      s.once("timeout", () => done(false));
    } catch {
      resolve(false);
    }
  });
}

async function ensureServer() {
  if (!needServer) return true;
  if (await reachable()) {
    console.log(`dev 服务器已在 ${DEV_URL}`);
    return true;
  }
  if (await portListening(DEV_URL)) {
    console.error(`⚠ ${DEV_URL} 端口有人在监听，但 HTTP 不响应 —— 这是个「卡死」的 dev server。`);
    console.error("  它会让每个窗口项都干等到超时（看起来像代码挂了）。先杀掉它再重跑：");
    console.error(
      '  powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 45231 | Select-Object -First 1 OwningProcess | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"',
    );
    return false;
  }
  console.log(`dev 服务器没起，自动开一个（${DEV_URL}）…`);
  server = spawnSync("cmd", ["/c", "start", "/min", '"guajiyouxi-smoke"', "cmd", "/c", "node_modules\\.bin\\next.cmd dev --port 45231 --hostname 127.0.0.1"], {
    cwd: ROOT,
    shell: false,
    stdio: "ignore",
  });
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    if (await reachable()) {
      console.log(`dev 服务器就绪（等了 ${((i + 1) * 1.5).toFixed(1)}s）`);
      return true;
    }
  }
  console.error("dev 服务器起不来：手动跑 `node_modules\\.bin\\next.cmd dev --port 45231 --hostname 127.0.0.1` 再重试。");
  return false;
}

// ---------- 跑 ----------
mkdirSync(path.join(ROOT, SHOT_DIR), { recursive: true });

/**
 * 互斥锁：两次冒烟并行会让 Electron 抢同一份 userData 缓存（报 "disk_cache 拒绝访问"），
 * 拖动那种靠窗口位置的自检会假红。所以同一时刻只允许一次。
 */
const LOCK = path.join(ROOT, SHOT_DIR, ".lock");
/** 锁最多算多久有效：一次冒烟最长两分多钟，超过这么久必然是上次被杀留下的死锁 */
const LOCK_STALE_MS = 20 * 60 * 1000;
function acquireLock() {
  try {
    const st = statSync(LOCK);
    if (Date.now() - st.mtimeMs > LOCK_STALE_MS) {
      console.log("发现一个 20 分钟以上的陈旧锁（上次可能是被杀掉的），直接接管。");
    } else {
      const pid = Number(readFileSync(LOCK, "utf8").trim());
      if (pid > 0) {
        try {
          process.kill(pid, 0); // 还活着 → 真有人在跑
          console.error(`另一次冒烟还在跑（pid ${pid}）。Electron 缓存会互相打架，等它结束再来。`);
          process.exit(2);
        } catch {
          /* 进程没了 → 陈旧锁，直接覆盖 */
        }
      }
    }
  } catch {
    /* 没有锁文件 → 正常 */
  }
  writeFileSync(LOCK, String(process.pid));
}
function releaseLock() {
  try {
    unlinkSync(LOCK);
  } catch {
    /* 已经没了就算了 */
  }
}
acquireLock();
process.on("exit", releaseLock);
process.on("SIGINT", () => {
  releaseLock();
  process.exit(130);
});

const results = [];
function runCheck(c, index, total) {
  const started = Date.now();
  process.stdout.write(`[${String(index).padStart(2)}/${total}] ${c.name} … `);
  const r = hasBash
    ? spawnSync(BASH, ["-c", c.cmd], {
        cwd: ROOT,
        encoding: "utf8",
        timeout: c.timeout * 1000,
        env: { ...process.env, FORCE_COLOR: "0", DESK_USER_DATA: SMOKE_USER_DATA, DESK_FRESH: "1" },
        maxBuffer: 32 * 1024 * 1024,
      })
    : spawnSync(c.cmd, {
        cwd: ROOT,
        shell: true,
        encoding: "utf8",
        timeout: c.timeout * 1000,
        env: { ...process.env, FORCE_COLOR: "0", DESK_USER_DATA: SMOKE_USER_DATA, DESK_FRESH: "1" },
        maxBuffer: 32 * 1024 * 1024,
      });
  const secs = (Date.now() - started) / 1000;
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  /**
   * 判定 = 出口码 0 **且**出现成功哨兵行。
   * 只看出口码不够：主进程 app.quit() 也是 0，探针可能压根没跑到断言（踩过，假绿）。
   */
  const exitOk = r.status === 0;
  const sentinelOk = !c.expect || out.includes(c.expect);
  const ok = exitOk && sentinelOk;
  const why = exitOk ? (sentinelOk ? "" : `缺哨兵行「${c.expect}」`) : `exit=${r.status}`;
  // 每项的完整输出落盘：失败时只打印尾巴，细节靠 temp/smoke/*.log 复盘
  try {
    writeFileSync(path.join(ROOT, SHOT_DIR, `${c.name.replace(/[^\w\u4e00-\u9fa5]+/g, "_")}.log`), out);
  } catch {
    /* 落盘失败不影响判定 */
  }
  console.log(`${ok ? "PASS" : "FAIL"}  ${secs.toFixed(1)}s`);
  results.push({ ...c, ok, secs, out, status: r.status, why });
  return ok;
}

const startedAll = Date.now();
if (!hasBash) {
  console.log(`⚠ 没找到可用的 bash（试过 ${BASH}）。窗口项需要它注入环境变量：请在 Git Bash 里跑 npm run smoke。`);
}
const serverOk = await ensureServer();
if (!serverOk) {
  // 不硬跑：窗口项会一个接一个干等到超时（真踩过，白等 7 分钟还看不出原因）。
  // 直接退出，把怎么修写清楚。exit 钩子会释放互斥锁。
  console.error("dev 服务器不可用 → 窗口项无法验证，直接退出（不硬跑到超时）。");
  process.exit(2);
}

let i = 0;
for (const c of selected) {
  i++;
  if ((!c.fast && !serverOk) || (!c.fast && !hasBash)) {
    const why = !serverOk ? "dev 服务器不可用" : "没有 bash";
    results.push({ ...c, ok: false, secs: 0, out: why, status: null });
    console.log(`[${String(i).padStart(2)}/${selected.length}] ${c.name} … SKIP（${why}）`);
    continue;
  }
  runCheck(c, i, selected.length);
}

// ---------- 汇总 ----------
const failed = results.filter((r) => !r.ok);
console.log("\n================ 冒烟汇总 ================");
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}  ${r.secs.toFixed(1)}s`);
}
if (failed.length) {
  for (const r of failed) {
    console.log(`\n---- ${r.name} 失败（${r.why || `exit=${r.status}`}）最近 20 行 ----`);
    console.log(r.out.split("\n").slice(-21).join("\n"));
  }
}
const total = ((Date.now() - startedAll) / 1000).toFixed(1);
console.log(
  `\n冒烟：${results.length - failed.length}/${results.length} 通过，用时 ${total}s` +
    (failed.length ? `（失败：${failed.map((f) => f.name).join("、")}）` : ""),
);
console.log(`每项完整输出在 ${SHOT_DIR}/*.log`);
if (server && server.pid) {
  spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
}
releaseLock();
process.exit(failed.length ? 1 : 0);
