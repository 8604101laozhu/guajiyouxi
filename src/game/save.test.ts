/**
 * 存档格式的测试：版本判定顺序、字段夹取、坏条目丢弃、round-trip。
 * 全是纯函数，不需要 localStorage（落盘是 save-store 的事）。
 */
import { describe, expect, it } from "vitest";
import {
  SAVE_DEFAULTS,
  SAVE_VERSION,
  createSave,
  deserialize,
  migrate,
  serialize,
  type SaveData,
} from "./save";

const AT = 1_700_000_000_000;

/** 一份「每个字段都有值」的合法存档，当 round-trip 的基准 */
function fullSave(over: Partial<SaveData> = {}): SaveData {
  return createSave({
    now: AT,
    wave: 7,
    kills: 42,
    gold: 1234,
    missTotal: 5,
    items: [{ name: "乔丹之石" }],
    lootCount: { normal: 1, magic: 2, rare: 3, unique: 4 },
    potions: [5, 4, 0, 0],
    lastDrop: { text: "暗金 乔丹之石", color: "#c7a24a" },
    offlineCapMinutes: 30,
    ...over,
  });
}

/** 从原始 JSON 文本读一次并保证 ok（脏值测试都走这条真路径，而不是手塞对象） */
function readOk(json: unknown): SaveData {
  const result = deserialize(JSON.stringify(json));
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("测试用例本身构造错了：期望 ok:true");
  return result.data;
}

describe("deserialize 判定顺序", () => {
  it("round-trip：serialize → deserialize 还原同一份存档", () => {
    const data = fullSave();
    const result = deserialize(serialize(data));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.migrated).toBe(false);
    expect(result.data).toEqual(data);
  });

  it("空串 / null / undefined 一律 empty（且不抛）", () => {
    expect(deserialize("")).toEqual({ ok: false, reason: "empty", data: null });
    expect(() => deserialize(null)).not.toThrow();
    expect(deserialize(null)).toEqual({ ok: false, reason: "empty", data: null });
    expect(deserialize(undefined)).toEqual({ ok: false, reason: "empty", data: null });
  });

  it("坏 JSON → corrupt", () => {
    expect(deserialize("{坏掉的 json")).toEqual({ ok: false, reason: "corrupt", data: null });
    expect(deserialize("几乎是文件但不是")).toEqual({ ok: false, reason: "corrupt", data: null });
  });

  it("顶层不是普通对象（数组 / 数字 / 字符串 / null / true）→ corrupt", () => {
    for (const raw of ["[]", "123", '"一件装备"', "null", "true"]) {
      expect(deserialize(raw), raw).toEqual({ ok: false, reason: "corrupt", data: null });
    }
  });

  it("比本程序新的版本（999）→ version，不猜", () => {
    expect(deserialize(JSON.stringify({ version: 999, now: AT }))).toEqual({
      ok: false,
      reason: "version",
      data: null,
    });
  });

  it("version 不是数字（字符串 / 缺失 / JSON 化后的 NaN）→ version", () => {
    expect(deserialize(JSON.stringify({ version: "1", now: AT }))).toEqual({ ok: false, reason: "version", data: null });
    expect(deserialize(JSON.stringify({ now: AT }))).toEqual({ ok: false, reason: "version", data: null });
    // NaN 过 JSON.stringify 会变 null，同样不是数字
    expect(deserialize(JSON.stringify({ version: Number.NaN }))).toEqual({ ok: false, reason: "version", data: null });
  });

  it("版本 0（老档）→ migrated:true，缺的字段补默认值", () => {
    const result = deserialize(JSON.stringify({ version: 0, now: AT, wave: 3 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.migrated).toBe(true);
    expect(result.data.version).toBe(SAVE_VERSION);
    expect(result.data.now).toBe(AT);
    expect(result.data.wave).toBe(3);
    expect(result.data.kills).toBe(0);
    expect(result.data.gold).toBe(0);
    expect(result.data.missTotal).toBe(0);
    expect(result.data.items).toEqual([]);
    expect(result.data.lootCount).toEqual({ normal: 0, magic: 0, rare: 0, unique: 0 });
    expect(result.data.potions).toEqual([]);
    expect(result.data.lastDrop).toBeNull();
    expect(result.data.offlineCapMinutes).toBe(SAVE_DEFAULTS.offlineCapMinutes);
  });

  it("migrate：垃圾（null / 只有版本号）也补成完整存档，不抛", () => {
    const expected = createSave({ now: 0 });
    expect(migrate({ version: 0 })).toEqual({ data: expected, migrated: true });
    expect(migrate(null)).toEqual({ data: expected, migrated: true });
    expect(migrate(createSave({ now: AT }))).toEqual({ data: createSave({ now: AT }), migrated: false });
  });
});

describe("字段夹取", () => {
  it("负数 / NaN / 非数字夹到 0；wave 非正整数退回 1", () => {
    const data = createSave({ now: AT, kills: -3, missTotal: Number.NaN, gold: -0.5, wave: -9 });
    expect(data.kills).toBe(0);
    expect(data.missTotal).toBe(0);
    expect(data.gold).toBe(0);
    expect(data.wave).toBe(1);
  });

  it("小数取整：kills / gold / lootCount 向下取整", () => {
    const data = createSave({
      now: AT,
      kills: 3.9,
      gold: 12.9,
      lootCount: { normal: 2.9, magic: 0, rare: 0, unique: 0 },
    });
    expect(data.kills).toBe(3);
    expect(data.gold).toBe(12);
    expect(data.lootCount.normal).toBe(2);
  });

  it("items：坏条目（null / 数字 / 字符串 / 数组）丢掉，好对象按原引用保留", () => {
    const good = { name: "好剑" };
    const data = createSave({ now: AT, items: [null, 42, "剑", [1, 2], good, { name: "好甲" }, undefined] });
    expect(data.items).toEqual([good, { name: "好甲" }]);
    expect(data.items[0]).toBe(good);
  });

  it("items 不是数组 → 空袋子（不让整份存档作废）", () => {
    const data = readOk({ version: 1, now: AT, items: "被手改坏了", wave: 5 });
    expect(data.items).toEqual([]);
    expect(data.wave).toBe(5);
  });

  it("lootCount：多余键丢掉、负值 / 非数字归 0，四个品质键一个不少", () => {
    const data = createSave({
      now: AT,
      lootCount: { normal: 2.9, magic: -4, rare: Number.NaN, unique: 0, gold: 999 },
    });
    expect(data.lootCount).toEqual({ normal: 2, magic: 0, rare: 0, unique: 0 });
  });

  it("lootCount 不是对象 → 四个键全 0", () => {
    expect(readOk({ version: 1, now: AT, lootCount: 7 }).lootCount).toEqual({
      normal: 0,
      magic: 0,
      rare: 0,
      unique: 0,
    });
  });

  it("lastDrop：形状不对（缺 color / 不是对象 / 类型错）→ null，对的保留", () => {
    expect(readOk({ version: 1, now: AT, lastDrop: { text: "只有一半" } }).lastDrop).toBeNull();
    expect(readOk({ version: 1, now: AT, lastDrop: "暗金 剑" }).lastDrop).toBeNull();
    expect(readOk({ version: 1, now: AT, lastDrop: { text: 1, color: 2 } }).lastDrop).toBeNull();
    const good = createSave({ now: AT, lastDrop: { text: "暗金 剑", color: "#c7a24a" } });
    expect(good.lastDrop).toEqual({ text: "暗金 剑", color: "#c7a24a" });
  });

  it("potions：只留 ≥0 的有限数，NaN / Infinity / 负数被过滤", () => {
    const data = createSave({
      now: AT,
      potions: [5, 0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 2.5],
    });
    expect(data.potions).toEqual([5, 0, 2.5]);
  });

  it("offlineCapMinutes 越界回落默认 20；0 是合法值（等于关掉离线收益）", () => {
    expect(createSave({ now: AT, offlineCapMinutes: 2000 }).offlineCapMinutes).toBe(SAVE_DEFAULTS.offlineCapMinutes);
    expect(createSave({ now: AT, offlineCapMinutes: -1 }).offlineCapMinutes).toBe(SAVE_DEFAULTS.offlineCapMinutes);
    expect(createSave({ now: AT, offlineCapMinutes: 0 }).offlineCapMinutes).toBe(0);
    expect(createSave({ now: AT, offlineCapMinutes: 1440 }).offlineCapMinutes).toBe(1440);
  });

  it("now：非有限 / 非正数 → 0（离线收益那边会跳过）", () => {
    expect(createSave({ now: Number.NaN }).now).toBe(0);
    expect(createSave({ now: 0 }).now).toBe(0);
    expect(createSave({ now: -5 }).now).toBe(0);
    expect(createSave({ now: AT }).now).toBe(AT);
  });

  it("createSave 一律盖成当前版本（存档里写不出未来版本）", () => {
    expect(createSave({ now: AT, version: 0 }).version).toBe(SAVE_VERSION);
    expect(createSave({ now: AT, version: 999 }).version).toBe(SAVE_VERSION);
  });

  it("未知顶层键（实测速率）不丢：主循环靠它算下次开机的离线收益", () => {
    // 主循环把「本次会话实测速率」也塞进存档（不在 SaveData 显式字段里，靠 normalize 透传）
    const partial = { now: AT, wave: 2, goldPerMinute: 321, killsPerMinute: 7 } as Parameters<typeof createSave>[0];
    const data = createSave(partial);
    expect(JSON.parse(serialize(data)).goldPerMinute).toBe(321);

    const result = deserialize(serialize(data));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const back = JSON.parse(serialize(result.data)) as { goldPerMinute?: number; killsPerMinute?: number };
    expect(back.goldPerMinute).toBe(321);
    expect(back.killsPerMinute).toBe(7);
  });
});
