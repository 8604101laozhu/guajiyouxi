/**
 * 离线收益的测试：时长换算、上限截断、时钟回拨、值不值得弹窗、文案格式。
 * 全纯函数，喂脏输入（NaN / {}）也必须不抛。
 */
import { describe, expect, it } from "vitest";
import {
  MAX_CAP_MINUTES,
  MAX_GOLD_PER_MINUTE,
  computeOffline,
  formatDuration,
  type OfflineInput,
} from "./offline";

const MIN = 60_000;
const BASE = 1_700_000_000_000;

/** 默认：离线 3 小时，实测 100 金/分、5 杀/分，上限 300 分钟 */
function input(over: Partial<OfflineInput> = {}): OfflineInput {
  return {
    savedAtMs: BASE,
    nowMs: BASE + 180 * MIN,
    goldPerMinute: 100,
    killsPerMinute: 5,
    capMinutes: 300,
    ...over,
  };
}

const ZERO = { rawMinutes: 0, minutes: 0, capped: false, gold: 0, kills: 0, worthShowing: false };

describe("computeOffline", () => {
  it("正常离线 3 小时：按实测速率结算，未被上限截断", () => {
    const r = computeOffline(input());
    expect(r.rawMinutes).toBe(180);
    expect(r.minutes).toBe(180);
    expect(r.capped).toBe(false);
    expect(r.gold).toBe(18000);
    expect(r.kills).toBe(900);
    expect(r.worthShowing).toBe(true);
  });

  it("超过上限：minutes 夹到 cap、capped:true，rawMinutes 保留真实值", () => {
    const r = computeOffline(input({ capMinutes: 60 }));
    expect(r.rawMinutes).toBe(180);
    expect(r.minutes).toBe(60);
    expect(r.capped).toBe(true);
    expect(r.gold).toBe(6000);
    expect(r.kills).toBe(300);
  });

  it("时钟被改回去 → 全 0、worthShowing:false（绝不给负奖励）", () => {
    expect(computeOffline(input({ nowMs: BASE - 10 * MIN }))).toEqual(ZERO);
    expect(computeOffline(input({ nowMs: BASE - 1 }))).toEqual(ZERO);
  });

  it("存档没记时间（savedAtMs <= 0）→ 全 0", () => {
    expect(computeOffline(input({ savedAtMs: 0 }))).toEqual(ZERO);
    expect(computeOffline(input({ savedAtMs: -1 }))).toEqual(ZERO);
  });

  it("rawMinutes 向下取整：59 秒不算 1 分钟，满 60 秒才算", () => {
    expect(computeOffline(input({ nowMs: BASE + 59_000 })).rawMinutes).toBe(0);
    expect(computeOffline(input({ nowMs: BASE + 60_000 })).rawMinutes).toBe(1);
  });

  it("worthShowing 三态：不足 1 分钟 false / 速率为 0 false / 正常 true", () => {
    // 30 秒：连 1 分钟都不到，弹窗只会打扰人
    const tooShort = computeOffline(input({ nowMs: BASE + 30_000 }));
    expect(tooShort.minutes).toBe(0);
    expect(tooShort.worthShowing).toBe(false);
    // 离线 10 分钟，但本次会话没测出速率 → 结算出来是 0，不值得弹
    const noRate = computeOffline(input({ nowMs: BASE + 10 * MIN, goldPerMinute: 0, killsPerMinute: 0 }));
    expect(noRate.minutes).toBe(10);
    expect(noRate.worthShowing).toBe(false);
    // 有速率、够时长 → 该弹
    expect(computeOffline(input()).worthShowing).toBe(true);
  });

  it("速率被 MAX_GOLD_PER_MINUTE 夹住（改存档也吃不出暴富）", () => {
    const r = computeOffline(
      input({ goldPerMinute: 999_999, killsPerMinute: 999_999, capMinutes: 10, nowMs: BASE + 10 * MIN }),
    );
    expect(r.gold).toBe(MAX_GOLD_PER_MINUTE * 10);
    expect(r.kills).toBe(MAX_GOLD_PER_MINUTE * 10); // kills「同理」用同一个速率上限
  });

  it("cap 被 MAX_CAP_MINUTES 夹住（离线 10 天也只结算 24 小时）", () => {
    const r = computeOffline(input({ capMinutes: 999_999, nowMs: BASE + 10 * 24 * 60 * MIN }));
    expect(r.rawMinutes).toBe(10 * 24 * 60);
    expect(r.minutes).toBe(MAX_CAP_MINUTES);
    expect(r.capped).toBe(true);
  });

  it("负数速率 / 负数 cap 夹到 0，不产生负收益", () => {
    const r = computeOffline(input({ goldPerMinute: -100, killsPerMinute: -5, capMinutes: -30 }));
    expect(r.minutes).toBe(0);
    expect(r.gold).toBe(0);
    expect(r.kills).toBe(0);
    expect(r.worthShowing).toBe(false);
  });

  it("NaN / 空对象输入一律当 0，不抛", () => {
    // nowMs 是 NaN → 连「离线了多久」都算不出来，整份归零
    expect(computeOffline(input({ nowMs: Number.NaN }))).toEqual(ZERO);
    // cap 是 NaN → 当 0 分钟上限：真实时长还在，只是结算 0 分钟（capped:true）
    expect(computeOffline(input({ capMinutes: Number.NaN }))).toEqual({
      rawMinutes: 180,
      minutes: 0,
      capped: true,
      gold: 0,
      kills: 0,
      worthShowing: false,
    });
    expect(() => computeOffline({} as OfflineInput)).not.toThrow();
    expect(computeOffline({} as OfflineInput)).toEqual(ZERO);
  });
});

describe("formatDuration", () => {
  it("三个分支：纯分钟 / 整小时 / 小时+分", () => {
    expect(formatDuration(45)).toBe("45 分钟");
    expect(formatDuration(120)).toBe("2 小时");
    expect(formatDuration(312)).toBe("5 小时 12 分");
  });

  it("边界与脏值：0 / 59 / 60 / 61、负数与 NaN 都落在 0 分钟", () => {
    expect(formatDuration(0)).toBe("0 分钟");
    expect(formatDuration(59)).toBe("59 分钟");
    expect(formatDuration(60)).toBe("1 小时");
    expect(formatDuration(61)).toBe("1 小时 1 分");
    expect(formatDuration(-10)).toBe("0 分钟");
    expect(formatDuration(Number.NaN)).toBe("0 分钟");
  });
});
