/**
 * 存储适配器的测试：内存盘、写失败 / 读失败降级、没有 localStorage 的 node 环境自动兜底。
 * 关键是「存储抛异常时游戏照跑」——saveRaw 回 false、loadRaw 回 null，一律不抛。
 */
import { describe, expect, it } from "vitest";
import { SAVE_KEY } from "./save";
import { clearRaw, loadRaw, memoryStorage, pickStorage, saveRaw, type StorageLike } from "./save-store";

describe("memoryStorage", () => {
  it("读写清：没存过是 null，写后能读回、能覆盖，清掉又变 null", () => {
    const s = memoryStorage();
    expect(s.getItem("k")).toBeNull();
    s.setItem("k", "v");
    expect(s.getItem("k")).toBe("v");
    s.setItem("k", "v2");
    expect(s.getItem("k")).toBe("v2");
    s.removeItem("k");
    expect(s.getItem("k")).toBeNull();
  });

  it("两份 memoryStorage 互不影响（测试之间不会串数据）", () => {
    const a = memoryStorage();
    const b = memoryStorage();
    a.setItem("k", "a");
    expect(b.getItem("k")).toBeNull();
  });
});

describe("失败降级（存储抛异常也不许影响主循环）", () => {
  it("saveRaw：setItem 抛异常时返回 false 且不抛", () => {
    const boom: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error("磁盘满");
      },
      removeItem: () => {},
    };
    expect(() => saveRaw("{}", boom)).not.toThrow();
    expect(saveRaw("{}", boom)).toBe(false);
  });

  it("loadRaw：getItem 抛异常时返回 null 且不抛", () => {
    const boom: StorageLike = {
      getItem: () => {
        throw new Error("隐私模式");
      },
      setItem: () => {},
      removeItem: () => {},
    };
    expect(() => loadRaw(boom)).not.toThrow();
    expect(loadRaw(boom)).toBeNull();
  });

  it("clearRaw：removeItem 抛异常时静默吞掉", () => {
    const boom: StorageLike = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {
        throw new Error("不给删");
      },
    };
    expect(() => clearRaw(boom)).not.toThrow();
  });

  it("loadRaw：假存储返回非字符串也按「没存过」处理", () => {
    const weird = { getItem: () => 42, setItem: () => {}, removeItem: () => {} } as unknown as StorageLike;
    expect(loadRaw(weird)).toBeNull();
  });

  it("读写清走同一把 SAVE_KEY", () => {
    const s = memoryStorage();
    expect(saveRaw("存档文本", s)).toBe(true);
    expect(s.getItem(SAVE_KEY)).toBe("存档文本");
    expect(loadRaw(s)).toBe("存档文本");
    clearRaw(s);
    expect(loadRaw(s)).toBeNull();
  });
});

describe("pickStorage", () => {
  it("node 环境没有 localStorage 时也能拿到可用存储（读写清正常）", () => {
    const s = pickStorage();
    const k = `${SAVE_KEY}__pick-probe`;
    expect(s.getItem(k)).toBeNull();
    s.setItem(k, "1");
    expect(s.getItem(k)).toBe("1");
    s.removeItem(k);
    expect(s.getItem(k)).toBeNull();
  });

  it("没有 localStorage 时多次 pick 拿到同一份内存盘（本次会话的存档读得回来）", () => {
    const k = `${SAVE_KEY}__same-store`;
    pickStorage().setItem(k, "x");
    expect(pickStorage().getItem(k)).toBe("x");
    pickStorage().removeItem(k);
  });
});
