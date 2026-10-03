/**
 * 飘字池的护栏测试：固定池长、覆盖最老、同点合并、重叠上推、寿命回收。
 * 全用真 Floaters（纯逻辑，不碰 canvas），喷字位置/时刻都自己给，完全可复现。
 */
import { describe, expect, it } from "vitest";
import {
  createFloaters,
  DEFAULT_AMOUNT_FORMAT,
  GRAVITY,
  LIFE,
  MAX_FLOATERS,
  MAX_PUSH,
  MERGE_RADIUS,
  MERGE_WINDOW,
  POP_TIME,
  PUSH_STEP,
  RISE_SPEED,
  type Floater,
  type Floaters,
} from "./floaters";

const alive = (f: Floaters) => f.list.filter((x) => x.alive);

/** 绕开合并/规避，只为了把池子灌满：位置彼此拉开 100px，中间推进一点点时间 */
function fill(f: Floaters, n: number, dt = 0.02) {
  for (let i = 0; i < n; i++) {
    f.spawn({ x: 100 + i * 100, y: 200, color: "#ffffff", kind: "label", text: `t${i}` });
    f.update(dt);
  }
}

describe("飘字池：固定大小，满了覆盖最老的", () => {
  it(`list.length 恒为 ${MAX_FLOATERS}，喷多少都不增长`, () => {
    const f = createFloaters();
    const pool = f.list;
    expect(pool).toHaveLength(MAX_FLOATERS);
    fill(f, MAX_FLOATERS * 3);
    expect(f.list).toBe(pool); // 同一个数组：不许换数组、不许 splice
    expect(f.list).toHaveLength(MAX_FLOATERS);
    expect(alive(f).length).toBe(MAX_FLOATERS);
  });

  it("池满时覆盖最老的，而不是丢掉最新的", () => {
    const f = createFloaters();
    fill(f, MAX_FLOATERS); // 槽位 0..MAX-1 各有主，年龄递增
    const oldest = f.list[0];
    expect(oldest.text).toBe("t0");

    const fresh = f.spawn({ x: 2500, y: 200, color: "#ffffff", kind: "label", text: "新的" });

    expect(fresh).toBe(oldest); // 复用最老的槽位（覆盖，不是新增）
    expect(fresh.text).toBe("新的");
    expect(f.list.some((x) => x.text === "t0")).toBe(false);
    expect(alive(f).length).toBe(MAX_FLOATERS);
  });
});

describe("飘字池：同点合并（HitTicker 第二条）", () => {
  it("amount 类同点合并且 count 累加、text 用 format 重算、pop 重放、age 不重置", () => {
    const f = createFloaters();
    const a = f.spawn({ x: 100, y: 200, color: "#ffd98a", kind: "amount", amount: 3, format: (n) => `＋${n} 金币` });
    expect(a.text).toBe("＋3 金币");
    expect(a.count).toBe(3);

    f.update(0.1); // 还在合并窗口内
    const before = a.age;
    const b = f.spawn({ x: 108, y: 203, color: "#ffd98a", kind: "amount", amount: 2, format: (n) => `＋${n} 金币` });

    expect(b).toBe(a); // 合并到原来那个身上，没有新占槽位
    expect(a.count).toBe(5);
    expect(a.text).toBe("＋5 金币");
    expect(a.pop).toBe(0); // 重放弹出动画
    expect(a.age).toBeCloseTo(before, 6); // 寿命照旧走
    expect(alive(f).length).toBe(1);
  });

  it("label 类同点直接用新文本覆盖", () => {
    const f = createFloaters();
    const a = f.spawn({ x: 200, y: 210, color: "#6f8fff", kind: "label", text: "魔法 短剑" });
    f.spawn({ x: 200, y: 210, color: "#c7a24a", kind: "label", text: "暗金 乔丹之石" });

    expect(a.text).toBe("暗金 乔丹之石");
    expect(alive(f).length).toBe(1);
  });

  it(`超过 MERGE_WINDOW（${MERGE_WINDOW}s）不再合并`, () => {
    const f = createFloaters();
    const a = f.spawn({ x: 300, y: 200, color: "#ffd98a", kind: "amount", amount: 1 });
    f.update(MERGE_WINDOW + 0.01);
    const b = f.spawn({ x: 300, y: 200, color: "#ffd98a", kind: "amount", amount: 1 });

    expect(b).not.toBe(a);
    expect(alive(f).length).toBe(2);
  });

  it(`超过 MERGE_RADIUS（${MERGE_RADIUS}px）不合并：同 kind 也不并`, () => {
    const f = createFloaters();
    const a = f.spawn({ x: 400, y: 200, color: "#ffd98a", kind: "amount", amount: 1 });
    const b = f.spawn({ x: 400 + MERGE_RADIUS + 2, y: 200, color: "#ffd98a", kind: "amount", amount: 1 });

    expect(b).not.toBe(a);
    expect(alive(f).length).toBe(2);
  });

  it("不同 kind 即使同点也不合并（名字和数字各飘各的）", () => {
    const f = createFloaters();
    const a = f.spawn({ x: 500, y: 200, color: "#c7a24a", kind: "label", text: "暗金 索命之刃" });
    const b = f.spawn({ x: 500, y: 200, color: "#ffd98a", kind: "amount", amount: 9 });

    expect(b).not.toBe(a);
    expect(a.text).toBe("暗金 索命之刃");
    expect(b.text).toBe("+9");
    expect(alive(f).length).toBe(2);
  });
});

describe("飘字池：重叠规避（粗粒度占用格）", () => {
  it(`同一格被占就往上推，最多推 ${MAX_PUSH} 次`, () => {
    const f = createFloaters();
    const y0 = 200;
    const a = f.spawn({ x: 100, y: y0, color: "#ffffff", kind: "label", text: "a" });
    expect(a.y).toBe(y0);

    // 拉开时间超过合并窗口 → 不合并，但占用格还在（寿命 1.1s）
    f.update(0.3);
    const b = f.spawn({ x: 100, y: y0, color: "#ffffff", kind: "label", text: "b" });
    expect(b.y).toBe(y0 - PUSH_STEP); // 推一格

    f.update(0.3);
    const c = f.spawn({ x: 100, y: y0, color: "#ffffff", kind: "label", text: "c" });
    expect(c.y).toBe(y0 - PUSH_STEP * MAX_PUSH); // 推满 MAX_PUSH 次就认了，不会无限往上跑
    const cY = c.y;

    f.update(0.3);
    const d = f.spawn({ x: 100, y: y0, color: "#ffffff", kind: "label", text: "d" });
    expect(d.y).toBe(cY); // 还是从同一个起点推 MAX_PUSH 次，不会多推
  });
});

describe("飘字池：寿命与上浮曲线", () => {
  it(`age >= LIFE（${LIFE}s）就回收，槽位能被下一次 spawn 复用`, () => {
    const f = createFloaters();
    const a = f.spawn({ x: 600, y: 200, color: "#ffffff", kind: "label", text: "老" });
    f.update(LIFE);

    expect(a.alive).toBe(false);
    expect(alive(f).length).toBe(0);

    const again = f.spawn({ x: 600, y: 200, color: "#ffffff", kind: "label", text: "新" });
    expect(again).toBe(a); // 空槽就是刚才那个
    expect(again.alive).toBe(true);
    expect(again.text).toBe("新");
    expect(again.age).toBe(0);
    expect(f.list).toHaveLength(MAX_FLOATERS);
  });

  it("上浮：vy 从初速被阻尼拉到 0 后就停住不再上升；pop 到 1 就停", () => {
    const f = createFloaters();
    const a = f.spawn({ x: 700, y: 200, color: "#ffffff", kind: "label", text: "飘" });
    expect(a.vy).toBe(RISE_SPEED);

    f.update(POP_TIME);
    expect(a.pop).toBe(1);
    expect(a.y).toBeLessThan(200); // 真的往上飘了
    expect(a.vy).toBeCloseTo(RISE_SPEED - GRAVITY * POP_TIME, 6);
    const mid = a.y;

    f.update(0.5); // dt 一大，vy 直接被钳到 0
    expect(a.vy).toBe(0);
    expect(a.y).toBeCloseTo(mid, 6);

    const top = a.y;
    f.update(0.3); // 停住之后 y 不许再变
    expect(a.y).toBeCloseTo(top, 6);
    expect(a.age).toBeLessThan(LIFE);
    expect(a.alive).toBe(true);
  });
});

describe("飘字池：默认显示", () => {
  it(`amount 不传 format 时默认是 ${DEFAULT_AMOUNT_FORMAT(1)} 这种 +n`, () => {
    const f = createFloaters();
    const a = f.spawn({ x: 800, y: 200, color: "#ffffff", kind: "amount", amount: 7 });
    expect(a.text).toBe("+7");
    expect(DEFAULT_AMOUNT_FORMAT(7)).toBe("+7");

    // 没传 amount 就是 1（增量默认值）
    const one = f.spawn({ x: 900, y: 200, color: "#ffffff", kind: "amount" });
    expect(one.text).toBe("+1");
  });

  it("label 不传 text 时是空串，不会崩", () => {
    const f = createFloaters();
    const a: Floater = f.spawn({ x: 1000, y: 200, color: "#ffffff", kind: "label" });
    expect(a.text).toBe("");
    expect(a.alive).toBe(true);
  });
});
