/**
 * 浮动文字（拾取到的装备名 / 进账的金币数）。
 *
 * 这个文件只负责：飘字池、寿命曲线、同点合并、重叠规避 —— 纯逻辑，不碰 canvas，可单测。
 * 画法在 render/renderer.ts 的 drawFloaters；**文本与颜色都是调用方算好的**（这里不认识 d2）。
 *
 * 设计抄 UE 插件 HitTicker 的四条（见 docs/选型-飘字与音效.md）：
 *   1) 固定大小环形池：一次性分配、永不增长，满了**覆盖最老的**（不是丢掉最新的）；
 *   2) 同一目标连续命中合并：「一个数字往上跳」，弹出动画每次重放；
 *   3) 屏幕空间重叠规避：粗粒度占用格 + 冲突往上推（不做 n² 两两比较）；
 *   4) 样式数据化：颜色 / 寿命 / 弹出曲线都从参数来。
 *
 * 池是**平行数组**：拍平的对象池 + 一个只存格式化函数的旁路数组（Floater 契约里没有 format 字段），
 * 所以合并时能拿回「原来那个飘字」的显示口径，也不会每帧 splice 数组。
 */

/** 环形池容量：一次分配，永不增长 */
export const MAX_FLOATERS = 24;
/** 同点合并窗口（秒）：比这还老的飘字不再接受合并 */
export const MERGE_WINDOW = 0.25;
/** 同点判定半径（像素） */
export const MERGE_RADIUS = 34;
/** 寿命（秒） */
export const LIFE = 1.1;
/** 上浮初速（px/s） */
export const RISE_SPEED = 46;
/** 上浮阻尼（px/s²）：让飘字停住再落 */
export const GRAVITY = 120;
/** 重叠规避占用格边长（像素） */
export const GRID_CELL = 48;
/** 重叠最多往上推几次 */
export const MAX_PUSH = 3;
/** 每次上推的像素数 */
export const PUSH_STEP = 14;
/** 弹出动画时长（秒）：pop 从 0 涨到 1 */
export const POP_TIME = 0.18;
/** kind="amount" 的默认显示：+n（调用方要「＋3 金币」这类自己传 format） */
export const DEFAULT_AMOUNT_FORMAT = (n: number) => `+${n}`;

export type FloaterKind = "amount" | "label";

export type Floater = {
  /** false = 槽位空闲，可以被复用 */
  alive: boolean;
  kind: FloaterKind;
  text: string;
  color: string;
  x: number;
  y: number;
  /** 存活秒数（寿命到了就回收） */
  age: number;
  /** 当前上浮速度（px/s，向上为正） */
  vy: number;
  /** 弹出动画进度 0~1（渲染层用它放大字号） */
  pop: number;
  /** kind="amount" 时累计的数量 */
  count: number;
};

export type FloaterSpawn = {
  x: number;
  y: number;
  color: string;
  kind: FloaterKind;
  /** kind="amount" 时的增量（默认 1） */
  amount?: number;
  /** kind="amount" 时怎么显示，默认 (n) => "+" + n */
  format?: (n: number) => string;
  /** kind="label" 时的文本 */
  text?: string;
};

export type Floaters = {
  /** 长度恒为 MAX_FLOATERS（固定池，别当普通数组增删） */
  readonly list: Floater[];
  spawn(s: FloaterSpawn): Floater;
  update(dt: number): void;
};

function makeFloater(): Floater {
  return { alive: false, kind: "label", text: "", color: "#ffffff", x: 0, y: 0, age: 0, vy: 0, pop: 0, count: 0 };
}

export function createFloaters(): Floaters {
  const list: Floater[] = [];
  for (let i = 0; i < MAX_FLOATERS; i++) list.push(makeFloater());
  /** 每个槽的格式化函数（Floater 契约里没有这个字段，用平行数组存） */
  const formats: ((n: number) => string)[] = [];
  for (let i = 0; i < MAX_FLOATERS; i++) formats.push(DEFAULT_AMOUNT_FORMAT);
  /** 粗粒度占用格：键 "gx,gy" → 到期时刻（秒，本模块内部时钟口径） */
  const occupied = new Map<string, number>();
  /** 内部时钟：只有 update(dt) 会推进，单测因此完全可复现 */
  let clock = 0;

  const cellKey = (x: number, y: number) => `${Math.floor(x / GRID_CELL)},${Math.floor(y / GRID_CELL)}`;
  const isFree = (x: number, y: number) => {
    const until = occupied.get(cellKey(x, y));
    return until === undefined || until <= clock;
  };

  function spawn(s: FloaterSpawn): Floater {
    const amount = s.amount ?? 1;
    const format = s.format ?? DEFAULT_AMOUNT_FORMAT;

    // 1) 同点合并：同 kind + 够新 + 在半径内。合并只动文本/计数，age 不重置（寿命照旧走）
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (!f.alive || f.kind !== s.kind || f.age >= MERGE_WINDOW) continue;
      if (Math.hypot(f.x - s.x, f.y - s.y) > MERGE_RADIUS) continue;
      if (f.kind === "amount") {
        f.count += amount;
        f.text = formats[i](f.count);
      } else {
        f.text = s.text ?? "";
      }
      // 颜色也要跟着最新的走：连续爆两件不同品质时，飘字不能还挂着旧颜色（这是给玩家看品质的）
      f.color = s.color;
      f.pop = 0; // 重放弹出动画：连续命中时数字要「跳一下」
      return f;
    }

    // 2) 取槽位：先找空槽，池满就覆盖最老的（HitTicker 的第一条）
    let slot = -1;
    for (let i = 0; i < list.length; i++) {
      if (!list[i].alive) {
        slot = i;
        break;
      }
    }
    if (slot < 0) {
      slot = 0;
      for (let i = 1; i < list.length; i++) if (list[i].age > list[slot].age) slot = i;
    }

    // 3) 重叠规避：目标格被占就往上推，最多 MAX_PUSH 次
    let y = s.y;
    for (let push = 0; push < MAX_PUSH && !isFree(s.x, y); push++) y -= PUSH_STEP;
    occupied.set(cellKey(s.x, y), clock + LIFE);

    const f = list[slot];
    f.alive = true;
    f.kind = s.kind;
    f.color = s.color;
    f.x = s.x;
    f.y = y;
    f.age = 0;
    f.vy = RISE_SPEED;
    f.pop = 0;
    if (s.kind === "amount") {
      f.count = amount;
      f.text = format(amount);
      formats[slot] = format;
    } else {
      f.count = 1;
      f.text = s.text ?? "";
    }
    return f;
  }

  function update(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    clock += dt;
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (!f.alive) continue;
      f.age += dt;
      if (f.age >= LIFE) {
        f.alive = false; // 回收：槽位留给下一次 spawn（数组长度不变）
        continue;
      }
      // 上浮阻尼：vy 递减到 0 就停住（不再上升），y 也不再变
      f.vy = Math.max(0, f.vy - GRAVITY * dt);
      f.y -= f.vy * dt;
      f.pop = Math.min(1, f.pop + dt / POP_TIME);
    }
    // 过期占用格要删掉：Map 不许无限长
    for (const [key, until] of occupied) if (until <= clock) occupied.delete(key);
  }

  return { list, spawn, update };
}
