/**
 * 存档格式（纯逻辑，不碰 DOM / localStorage）。
 *
 * 为什么把「格式」和「落盘」拆成两个文件：本文件只认识 JSON 文本，读写介质全在 save-store.ts。
 * 于是单测不需要 window，主循环也不怕 localStorage 被隐私模式 / 磁盘满 / 企业策略禁用。
 *
 * 为什么 items 声明成 unknown[]：存档模块一旦认识 d2 的 Item 形状，就捅破了
 * 「唯一认识 src/lib/d2 的文件必须是 d2-bridge.ts」这条铁律。战利品原样进、原样出，
 * 「是不是合法 Item」交给接线方判。
 *
 * 降级铁律：存档可能来自旧版本、被人手改、被磁盘写坏。这里每一步都只降级、不 throw ——
 * 最坏也就是丢一份进度，绝不能让挂机主循环停下来。
 */
import { MAX_CAP_MINUTES } from "./offline";

export const SAVE_VERSION = 1;
export const SAVE_KEY = "guajiyouxi-save-v1";

export type SaveData = {
  version: number;
  /** 存档时刻（毫秒）。离线收益就靠它（同类项目 deskbound-heroes 也是把 now 直接打存档里） */
  now: number;
  wave: number;
  kills: number;
  gold: number;
  missTotal: number;
  /** 战利品袋。故意声明成 unknown[]：存档模块不该认识 d2 的 Item 形状（铁律） */
  items: unknown[];
  lootCount: Record<string, number>;
  /** 药水槽剩余数 */
  potions: number[];
  lastDrop: { text: string; color: string } | null;
  /** 离线收益上限（分钟）。同类项目把它做成「解锁项」，这里先固定默认 20 分钟 */
  offlineCapMinutes: number;
  /**
   * 上次会话实测的收益速率（每分钟）。离线收益按它结算 ——
   * 没有速率（老存档 / 第一次玩）就按 0 算，也就是不给奖励：**绝不编造收益**。
   */
  goldPerMinute: number;
  killsPerMinute: number;
};

export type LoadResult =
  | { ok: true; data: SaveData; migrated: boolean }
  | { ok: false; reason: "empty" | "corrupt" | "version"; data: null };

export const SAVE_DEFAULTS = { offlineCapMinutes: 20, goldPerMinute: 0, killsPerMinute: 0 } as const;

/** 只认「普通对象」：null 的 typeof 也是 object，数组是列表不是记录 —— 两者都当不成存档根 */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** 时间戳：有限且 > 0，否则 0（0 = 不知道什么时候存的，离线收益会跳过） */
function timestampOr(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
}

/** 非负整数：小数向下取整；NaN / 字符串 / null / 负数一律 0 */
function nonNegativeInt(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  const n = Math.floor(v);
  return n >= 0 ? n : 0;
}

/** 波次：必须是「有限且 ≥1 的整数」；被改成 0 / 负数 / 4.5 就退回第 1 波重来 */
function normalizeWave(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && Number.isInteger(v) && v >= 1 ? v : 1;
}

/** 战利品条目：null 的 typeof 也是 object，必须显式排除；数组不是一件装备 */
function isLootItem(v: unknown): boolean {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** 速率（每分钟）：非负有限数才认，坏值归 0（真正的上限由 offline.ts 夹） */
function normalizeRate(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
}

const LOOT_KEYS = ["normal", "magic", "rare", "unique"] as const;
/** 只保留四个品质键，负值 / 非数字归 0；四个键一个不少 —— 缺键会让 HUD 的 Record<Quality, number> 显示 undefined */
function normalizeLootCount(v: unknown): Record<string, number> {
  const src = isPlainObject(v) ? v : {};
  const out: Record<string, number> = {};
  for (const k of LOOT_KEYS) out[k] = nonNegativeInt(src[k]);
  return out;
}

/** 药水槽：只留「≥0 的有限数」；NaN / Infinity / 负数 / 字符串丢掉（槽位数量由 potions.ts 决定，这里不补） */
function normalizePotions(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return v.filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0);
}

/** 最近掉落：必须两个字符串字段都在；缺一个就当作「没有最近掉落」 */
function normalizeLastDrop(v: unknown): { text: string; color: string } | null {
  if (!isPlainObject(v)) return null;
  const { text, color } = v;
  if (typeof text !== "string" || typeof color !== "string") return null;
  // 只抄这两个字段：存档里被塞进来的额外键不跟着跑，免得下游误以为还有别的信息
  return { text, color };
}

/** 离线收益上限：0~MAX_CAP_MINUTES 的整数，越界回默认 20（0 是合法值：等于关掉离线收益） */
function normalizeCapMinutes(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return SAVE_DEFAULTS.offlineCapMinutes;
  const n = Math.floor(v);
  return n >= 0 && n <= MAX_CAP_MINUTES ? n : SAVE_DEFAULTS.offlineCapMinutes;
}

/**
 * createSave 与 migrate 共用的归一化：缺字段走默认、脏字段夹回合法范围。
 * 版本一律盖成当前版本 —— 补完就是新档，免得读进来还是旧版本号又被反复迁移。
 */
function normalize(raw: unknown): SaveData {
  const src = isPlainObject(raw) ? raw : {};
  return {
    // 未知顶层键原样带上：主循环把本次会话实测速率（goldPerMinute / killsPerMinute）也塞进存档，
    // 下次开机算离线收益要用；它们不是 SaveData 的显式字段，但也不该在归一化时被无声吃掉。
    // 用展开而不是逐键赋值：JSON 里的 "__proto__" 也是普通 own 键，展开走 CreateDataProperty，改不到原型。
    ...(src as Partial<SaveData>),
    version: SAVE_VERSION,
    now: timestampOr(src.now),
    wave: normalizeWave(src.wave),
    kills: nonNegativeInt(src.kills),
    gold: nonNegativeInt(src.gold),
    missTotal: nonNegativeInt(src.missTotal),
    // 坏条目只丢自己，别让整份存档作废（挂机几百小时的进度比一件坏装备值钱）
    items: Array.isArray(src.items) ? src.items.filter(isLootItem) : [],
    lootCount: normalizeLootCount(src.lootCount),
    potions: normalizePotions(src.potions),
    lastDrop: normalizeLastDrop(src.lastDrop),
    offlineCapMinutes: normalizeCapMinutes(src.offlineCapMinutes),
    // 速率：非负有限数，坏值归 0（离线那边还会再夹一次上限）
    goldPerMinute: normalizeRate(src.goldPerMinute),
    killsPerMinute: normalizeRate(src.killsPerMinute),
  };
}

/** 用 partial 补全成完整存档（缺的走默认值），并把每个字段夹到合法范围 */
export function createSave(partial: Partial<SaveData> & { now: number }): SaveData {
  return normalize(partial);
}

export function serialize(data: SaveData): string {
  try {
    const text = JSON.stringify(data);
    // 正常情况下 data 是 SaveData，stringify 必给字符串；多这一层是给「永不 throw」兜底
    return typeof text === "string" ? text : JSON.stringify({ version: SAVE_VERSION });
  } catch {
    // 循环引用 / 混进了 BigInt：宁可写一份「只有版本号」的档，也别把主循环炸了
    return JSON.stringify({ version: SAVE_VERSION });
  }
}

/** 永不 throw。判定顺序：empty → corrupt → version → 迁移老档 → 当前档 */
export function deserialize(raw: string | null | undefined): LoadResult {
  // 1) 没存过
  if (raw === null || raw === undefined || raw === "") return { ok: false, reason: "empty", data: null };

  // 2) 文本坏了 / 顶层不是记录（数组、数字、字符串、null）：和「没存过」分开，调用方好决定要不要备份
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "corrupt", data: null };
  }
  if (!isPlainObject(parsed)) return { ok: false, reason: "corrupt", data: null };

  // 3) 版本：比本程序还新的档不猜（猜错会把新字段当垃圾清掉）
  const version = parsed.version;
  if (typeof version !== "number" || !Number.isFinite(version) || version > SAVE_VERSION) {
    return { ok: false, reason: "version", data: null };
  }

  // 4) 老档补齐；5) 当前版本也要过一遍 normalize —— 字段照样可能被人手改成脏值
  const { data } = migrate(parsed);
  return { ok: true, data, migrated: version < SAVE_VERSION };
}

/** 把老存档补齐成当前版本（逐字段 ?? 默认，抄 deskbound 的 migrateGame） */
export function migrate(parsed: unknown): { data: SaveData; migrated: boolean } {
  const version =
    isPlainObject(parsed) && typeof parsed.version === "number" && Number.isFinite(parsed.version) ? parsed.version : 0;
  return { data: normalize(parsed), migrated: version < SAVE_VERSION };
}
