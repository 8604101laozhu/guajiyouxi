/**
 * 离线收益：把「上次存档到现在」的时间换算成一份补给。
 *
 * 为什么单独成文件：这是一段纯函数，游戏没跑的时候它也在「算」。塞进主循环会同时缠上存档、
 * 飘字和音效，既测不动，也容易把两条底线绕过去 —— 这里用一次性的纯函数把它们锁死：
 *
 *  1) 时钟被改回去（nowMs < savedAtMs）→ 一个铜板都不给，绝不允许负数把金币洗没；
 *  2) 存档没记时间（savedAtMs <= 0）→ 当没离线过；
 *  3) 时长与速率都有上限，存档被手改成天文数字也吃不出暴富。
 *
 * 所有输入都可能是 undefined / NaN（存档是外部文本），一律当 0，永不 throw。
 */

/** 少于 1 分钟不值得报「欢迎回来」 */
export const MIN_MINUTES = 1;
/** 上限的合理范围（防存档被改出天文数字） */
export const MAX_CAP_MINUTES = 24 * 60;
/** 速率上限（防测量异常 / 存档被改） */
export const MAX_GOLD_PER_MINUTE = 2000;

export type OfflineInput = {
  savedAtMs: number;
  nowMs: number;
  /** 本次会话实测速率（来自主循环的 stats） */
  goldPerMinute: number;
  killsPerMinute: number;
  capMinutes: number;
};

export type OfflineResult = {
  /** 真实离开了多少分钟 */
  rawMinutes: number;
  /** 实际结算的分钟（已夹到上限） */
  minutes: number;
  /** 是否被上限截断 */
  capped: boolean;
  gold: number;
  kills: number;
  /** 值不值得弹「欢迎回来」 */
  worthShowing: boolean;
};

/** 把来路不明的值当 0：NaN / null / 字符串 / undefined 在离线结算里都没有意义 */
function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** 每次都给一份新对象：调用方随手改返回值不该污染下一次结算 */
function zeroResult(): OfflineResult {
  return { rawMinutes: 0, minutes: 0, capped: false, gold: 0, kills: 0, worthShowing: false };
}

export function computeOffline(input: OfflineInput): OfflineResult {
  // 类型上是必填，运行时仍可能是 undefined（存档接线没接好）—— 铁律要求这里也不能 throw
  if (!input) return zeroResult();

  const savedAtMs = num(input.savedAtMs);
  const nowMs = num(input.nowMs);
  // 存档没记时间，或者电脑时钟被拨回去了：都没有「离线了多久」可言，更不能给负奖励
  if (savedAtMs <= 0 || nowMs < savedAtMs) return zeroResult();

  const rawMinutes = Math.floor((nowMs - savedAtMs) / 60000);
  const cap = Math.min(MAX_CAP_MINUTES, Math.max(0, num(input.capMinutes)));
  const minutes = Math.min(rawMinutes, cap);
  const goldRate = Math.min(MAX_GOLD_PER_MINUTE, Math.max(0, num(input.goldPerMinute)));
  // kills「同理」：同一个速率上限，否则改存档就能把击杀数刷到离谱
  const killRate = Math.min(MAX_GOLD_PER_MINUTE, Math.max(0, num(input.killsPerMinute)));
  const gold = Math.floor(goldRate * minutes);
  const kills = Math.floor(killRate * minutes);

  return {
    rawMinutes,
    minutes,
    capped: rawMinutes > minutes,
    gold,
    kills,
    // 1 分钟以内、或者算出来是空气（速率为 0）：不值得用弹窗打断玩家
    worthShowing: minutes >= MIN_MINUTES && (gold > 0 || kills > 0),
  };
}

/** 312 → "5 小时 12 分"；45 → "45 分钟"；120 → "2 小时" */
export function formatDuration(minutes: number): string {
  // 负数 / NaN 一律显示 0 分钟：文案层也不许因为脏数据变成 "NaN 分钟"
  const total = Math.max(0, Math.floor(num(minutes)));
  if (total < 60) return `${total} 分钟`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest > 0 ? `${hours} 小时 ${rest} 分` : `${hours} 小时`;
}
