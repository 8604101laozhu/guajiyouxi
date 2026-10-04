/**
 * 固定舞台的测试：英雄站在画面中间、怪从画面右侧进场、赶路速度够快（挂机不能干等）。
 * 这一组数字直接决定「交战点在不在画面中间」，改坏了肉眼看得出来，所以钉死。
 */
import { describe, expect, it } from "vitest";
import { HERO_SCREEN_FRAC, TRAVEL_DISTANCE, enemySpawnX, heroPostX, travelSpeed } from "./stage";

const W = 2560;

describe("英雄站位（固定舞台）", () => {
  it("站在画面 45% 处 —— 略偏左，右边留给走进来的怪", () => {
    expect(heroPostX(0, W)).toBeCloseTo(W * HERO_SCREEN_FRAC, 5);
    expect(HERO_SCREEN_FRAC).toBeGreaterThan(0.3);
    expect(HERO_SCREEN_FRAC).toBeLessThan(0.5);
  });

  it("换窗口宽度也钉在同一屏幕位置（相机有偏移时也一样）", () => {
    for (const viewW of [1280, 1920, 2560]) {
      const camX = (W - viewW) / 2;
      expect((heroPostX(camX, viewW) - camX) / viewW).toBeCloseTo(HERO_SCREEN_FRAC, 5);
    }
  });
});

describe("怪的进场点", () => {
  it("在画面右边缘（不是贴世界边界），且一定在英雄右边", () => {
    const x = enemySpawnX({ camX: 0, viewW: W, boundsW: W, index: 0 });
    expect(x).toBe(W - 36);
    expect(x / W).toBeGreaterThan(0.95);
    expect(x).toBeLessThanOrEqual(W - 24); // 不越界（step 的夹取上限）
    expect(x).toBeGreaterThan(heroPostX(0, W));
  });

  it("同一波怪依次错开（别叠在一起进场），且都还在英雄右边", () => {
    const xs = [0, 1, 2, 3, 4].map((index) => enemySpawnX({ camX: 0, viewW: W, boundsW: W, index }));
    expect(xs[0]).toBeGreaterThan(xs[1]);
    expect(xs[1]).toBeGreaterThan(xs[2]);
    expect(xs[4]).toBe(xs[0]); // index % 4 循环
    expect(Math.min(...xs)).toBeGreaterThan(heroPostX(0, W));
  });

  it("视口比世界窄时按画面算，并夹在世界范围内", () => {
    const camX = (W - 1280) / 2;
    const x = enemySpawnX({ camX, viewW: 1280, boundsW: W, index: 0 });
    expect((x - camX) / 1280).toBeGreaterThan(0.95); // 仍在画面右边缘
    expect(x).toBeLessThanOrEqual(W - 24);
  });
});

describe("赶路速度", () => {
  it("远处用进场速度，进入交战距离就回自己的速度", () => {
    expect(travelSpeed(60, TRAVEL_DISTANCE + 1)).toBeGreaterThan(60);
    expect(travelSpeed(60, TRAVEL_DISTANCE)).toBe(60);
    expect(travelSpeed(60, 40)).toBe(60);
  });

  it("本身很慢的怪有速度下限（远程怪 30 px/s 光乘倍率还是太慢）", () => {
    expect(travelSpeed(30, 1400)).toBeGreaterThanOrEqual(200);
  });

  it("右边缘到中间这段路要压进 10 秒（否则挂机看着像干等）", () => {
    const dist = enemySpawnX({ camX: 0, viewW: W, boundsW: W, index: 0 }) - heroPostX(0, W);
    expect(dist).toBeGreaterThan(1000); // 真的是「横穿半个画面」
    expect(dist / travelSpeed(52, dist)).toBeLessThan(10); // 近战最慢一档
    expect(dist / travelSpeed(30, dist)).toBeLessThan(12); // 远程一档
  });
});
