/**
 * 存档的落盘适配器：全工程唯一碰 localStorage 的文件。
 *
 * 为什么不让 save.ts 直接读写 localStorage：Node / vitest 没有 window，隐私模式、磁盘满、
 * 企业策略禁用存储都会让 localStorage 抛异常 —— 这类环境问题不能污染纯逻辑，
 * 更不能让挂机主循环因为「存不上」停下来（本工程铁律：任何模块失败都不影响主循环）。
 * save.ts 只认 JSON 文本，怎么存、存哪儿全由这里决定。
 *
 * 读 / 写 / 清一律 try/catch：拿不到真盘就用内存盘，游戏照跑，只是关掉窗口就没了。
 */
import { SAVE_KEY } from "./save";

export type StorageLike = {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
};

/** 内存存储：测试用；也当 localStorage 不可用时的降级（游戏照跑，只是不落盘） */
export function memoryStorage(): StorageLike {
  const mem = new Map<string, string>();
  return {
    getItem(k) {
      const v = mem.get(k);
      return v === undefined ? null : v;
    },
    setItem(k, v) {
      // 和 localStorage 一样强制转字符串：别让调用方传进来的非字符串改变取值形状
      mem.set(k, String(v));
    },
    removeItem(k) {
      mem.delete(k);
    },
  };
}

/**
 * pickStorage 的内存兜底要复用同一个实例：否则每次取都换一份「盘」，
 * 本次会话刚存的东西下一次就读不到了（挂机条一局可能存好几次）。
 */
let fallback: StorageLike | null = null;

function memoryFallback(): StorageLike {
  if (!fallback) fallback = memoryStorage();
  return fallback;
}

/** 能拿到 localStorage 就给它，否则退回内存（隐私模式 / 磁盘满 → 静默降级） */
export function pickStorage(): StorageLike {
  try {
    const ls = (globalThis as { localStorage?: StorageLike }).localStorage;
    if (ls) {
      // 不能只看「有没有」：隐私模式下可能读得到、写不了，真正拍板的是写一次
      const probe = `${SAVE_KEY}__probe`;
      ls.setItem(probe, "1");
      try {
        ls.removeItem(probe);
      } catch {
        // 删不掉最多留一个探针键，不影响存档读写
      }
      return ls;
    }
  } catch {
    // setItem 抛了（隐私模式 / 磁盘满 / 被策略禁用）：静默降级，别让存档把游戏拖下水
  }
  return memoryFallback();
}

export function loadRaw(store?: StorageLike): string | null {
  try {
    const raw = (store ?? pickStorage()).getItem(SAVE_KEY);
    // 只认字符串：假存储返回数字 / 对象时按「没存过」处理，交给 deserialize 兜
    return typeof raw === "string" ? raw : null;
  } catch {
    return null;
  }
}

/** 写失败返回 false（调用方可以记一笔「这次没落盘」），永不 throw */
export function saveRaw(text: string, store?: StorageLike): boolean {
  try {
    (store ?? pickStorage()).setItem(SAVE_KEY, text);
    return true;
  } catch {
    return false;
  }
}

export function clearRaw(store?: StorageLike): void {
  try {
    (store ?? pickStorage()).removeItem(SAVE_KEY);
  } catch {
    // 清不掉就清不掉：下一次覆盖写会把它盖掉
  }
}
