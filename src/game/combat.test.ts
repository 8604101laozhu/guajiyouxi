/**
 * 自动战斗内核的测试：索敌、走位、近战、远程弹道、死亡与复活、波次节拍。
 * 全部走真实模型（它们是纯数据 + 纯绘制，不碰 DOM），不 mock。
 */
import { describe, expect, it } from "vitest";
import { World } from "./world";
import { makeUnit } from "./units";
import { updateUnits } from "./ai";
import { applyDamage, nearestOpponent, spawnProjectile, updateProjectiles, updateTransient } from "./combat";
import { createWaveState, enemyCountForWave, updateWaves } from "./waves";
import type { ModelDef, SceneLayout } from "./types";
import imp from "./models/imp";
import bolt from "./models/bolt";
import slash from "./models/slash";
import heroMage from "./models/hero_mage";
import heroSwordsman from "./models/hero_swordsman";

const BOUNDS: SceneLayout["bounds"] = { w: 2560, h: 260, groundY: 206 };
const MODELS = new Map<string, ModelDef>([
  ["imp", imp],
  ["bolt", bolt],
  ["slash", slash],
  ["hero_mage", heroMage],
  ["hero_swordsman", heroSwordsman],
]);
const GROUND = BOUNDS.groundY;

function hero(world: World, x: number, kind: "melee" | "ranged", hp = 200) {
  return world.spawn({
    id: `hero_${kind}`,
    model: kind === "melee" ? heroSwordsman : heroMage,
    pos: { x, y: GROUND },
    unit: makeUnit({ team: "hero", kind, hp, damage: 20 }),
  });
}

function enemy(world: World, x: number, kind: "melee" | "ranged" = "melee", opts: { hp?: number; speed?: number } = {}) {
  return world.spawn({
    id: `enemy_${x}_${kind}`,
    model: imp,
    pos: { x, y: GROUND },
    unit: makeUnit({ team: "enemy", kind, hp: opts.hp ?? 60, speed: opts.speed ?? 0, damage: 7 }),
  });
}

const ctx = { bounds: BOUNDS, models: MODELS, advance: true };

describe("单位数值", () => {
  it("数值由调用方给全，makeUnit 不再二次放大（放大倍率在 d2 的关卡表里）", () => {
    const m0 = makeUnit({ team: "enemy", kind: "melee", hp: 100, damage: 10, rank: 0 });
    const m2 = makeUnit({ team: "enemy", kind: "melee", hp: 100, damage: 10, rank: 2 });
    expect([m0.maxHp, m2.maxHp]).toEqual([100, 100]);
    expect([m0.damage, m2.damage]).toEqual([10, 10]);
    expect(m2.rank).toBe(2); // rank 只是标签（外观/名字），不再改数值
  });

  it("扩展字段必须透传（漏了会静默降级：spec 一丢掉落就恒为 0）", () => {
    const spec = { defense: 42, mlvl: 17, picks: 2, noDrop: 30, tcLevel: 12 } as never;
    const u = makeUnit({ team: "enemy", kind: "melee", hp: 50, damage: 5, defense: 42, mlvl: 17, spec });
    expect(u.defense).toBe(42);
    expect(u.mlvl).toBe(17);
    expect(u.spec).toBe(spec);
  });

  it("speed 传 0 就真的是 0（不能用 || 兜底，否则会变默认值）", () => {
    expect(makeUnit({ team: "enemy", kind: "melee", speed: 0 }).speed).toBe(0);
  });

  it("近战/远程的缺省攻击距离与冷却不同", () => {
    const melee = makeUnit({ team: "enemy", kind: "melee" });
    const ranged = makeUnit({ team: "enemy", kind: "ranged" });
    expect(melee.range).toBeLessThan(ranged.range);
    expect(melee.cdTime).toBeLessThan(ranged.cdTime);
  });
});

describe("索敌", () => {
  it("挑最近的敌对单位，同阵营与异层都不算", () => {
    const world = new World();
    const h = hero(world, 100, "melee");
    const far = enemy(world, 400);
    const near = enemy(world, 260);
    enemy(world, 300).pos.y = GROUND - 200; // 另一层（空中），不该被选中
    expect(nearestOpponent(world, h)?.id).toBe(near.id);
    expect(nearestOpponent(world, near)?.id).toBe(h.id);
    expect(nearestOpponent(world, far)?.id).toBe(h.id);
  });
});

describe("近战", () => {
  it("够得着就砍，砍完进冷却；打死会被回收并记一次击杀", () => {
    const world = new World();
    const h = hero(world, 100, "melee");
    const e = enemy(world, 118, "ranged", { hp: 30 }); // 远程怪不会近战，避免把挥砍数算重
    const r1 = updateUnits(world, 1 / 60, ctx);
    expect(r1.meleeSwings).toBe(1);
    expect(e.unit!.hp).toBe(10);
    expect(h.unit!.cd).toBeGreaterThan(0);

    // 冷却没好，不再挥砍
    const r2 = updateUnits(world, 1 / 60, ctx);
    expect(r2.meleeSwings).toBe(0);

    // 冷却走完再砍 → 打死
    for (let i = 0; i < 70; i++) updateUnits(world, 1 / 60, ctx);
    expect(e.unit!.hp).toBe(0);
    expect(world.entities.some((x) => x.id === e.id)).toBe(true); // 还等 tick 回收
    world.tick(1 / 60);
    expect(world.entities.some((x) => x.id === e.id)).toBe(false);
  });

  it("够不着会自己走过去（挂机不需要人操作）", () => {
    const world = new World();
    const h = hero(world, 100, "melee");
    enemy(world, 400, "melee");
    const before = h.pos.x;
    for (let i = 0; i < 60; i++) updateUnits(world, 1 / 60, ctx);
    expect(h.pos.x).toBeGreaterThan(before + 30);
    expect(h.unit!.facing).toBe(1);
  });

  it("被石头挡住不会永久卡死：先卡住，超过阈值后挤过去继续打（挂机不能停摆）", () => {
    const world = new World();
    const h = hero(world, 100, "melee");
    const e = enemy(world, 400, "melee", { speed: 0, hp: 40 });
    world.spawn({ id: "wall", model: imp, pos: { x: 200, y: GROUND }, collision: true });

    // 1.2 秒内被挡住，摸不到怪
    for (let i = 0; i < 72; i++) updateUnits(world, 1 / 60, ctx);
    expect(h.pos.x).toBeLessThan(200);
    expect(e.unit!.hp).toBe(40);

    // 超过阈值进入「挤过去」窗口，最终打到怪
    for (let i = 0; i < 900 && e.unit!.hp === 40; i++) updateUnits(world, 1 / 60, ctx);
    expect(h.pos.x).toBeGreaterThan(200);
    expect(e.unit!.hp).toBeLessThan(40);
  });
});

describe("远程弹道", () => {
  it("弹道飞行并命中敌方，扣血；命中后就消失", () => {
    const world = new World();
    const mage = hero(world, 100, "ranged");
    const e = enemy(world, 300, "melee", { hp: 100 });
    const r1 = updateUnits(world, 1 / 60, ctx);
    expect(r1.shots).toBe(1);
    const p = world.entities.find((x) => x.modelId === "bolt")!;
    expect(p.params.team).toBe(0); // 我方弹

    for (let i = 0; i < 120 && e.unit!.hp === 100; i++) updateProjectiles(world, 1 / 60, BOUNDS);
    expect(e.unit!.hp).toBe(80);
    expect(p.dead).toBe(true);
    void mage;
  });

  it("弹道撞到静态碰撞物会被吃掉", () => {
    const world = new World();
    const mage = hero(world, 100, "ranged");
    world.spawn({ id: "wall", model: imp, pos: { x: 200, y: GROUND }, collision: true });
    spawnProjectile(world, bolt, mage, { x: 400, y: GROUND });
    const tick = { hits: 0, killed: 0, blocked: 0 };
    for (let i = 0; i < 60 && tick.blocked === 0; i++) {
      const t = updateProjectiles(world, 1 / 60, BOUNDS);
      tick.blocked += t.blocked;
    }
    expect(tick.blocked).toBe(1);
  });

  it("敌方的弹道只打我方的单位", () => {
    const world = new World();
    const h = hero(world, 100, "melee", 200);
    const shooter = enemy(world, 500, "ranged");
    spawnProjectile(world, bolt, shooter, { x: h.pos.x, y: h.pos.y });
    for (let i = 0; i < 200 && h.unit!.hp === 200; i++) updateProjectiles(world, 1 / 60, BOUNDS);
    expect(h.unit!.hp).toBe(193); // 小怪伤害 7
  });

  it("飞出场景边界会被回收", () => {
    const world = new World();
    const mage = hero(world, 100, "ranged");
    const p = spawnProjectile(world, bolt, mage, { x: 300, y: GROUND })!;
    p.params.dir = -1;
    for (let i = 0; i < 60; i++) updateProjectiles(world, 1 / 60, BOUNDS);
    expect(p.dead).toBe(true);
  });
});

describe("死亡与复活（挂机不能停摆）", () => {
  it("英雄被打倒后读秒，到点满血站起", () => {
    const world = new World();
    const h = hero(world, 100, "melee", 30);
    enemy(world, 400, "melee", { speed: 0 }); // 站着别动，免得复活瞬间又挨一下
    applyDamage(h, 999);
    expect(h.unit!.hp).toBe(0);

    let r = updateUnits(world, 0.5, ctx);
    expect(r.heroDown).toBe(true);
    expect(h.unit!.reviveIn).toBeGreaterThan(0);

    // 复活前英雄不能再被当怪清掉
    expect(world.entities.some((x) => x.id === h.id)).toBe(true);

    for (let i = 0; i < 12 && h.unit!.hp === 0; i++) r = updateUnits(world, 0.5, ctx);
    expect(h.unit!.hp).toBe(h.unit!.maxHp);
    expect(h.unit!.reviveIn).toBeUndefined();
    expect(r.kills).toBe(0); // 英雄不会被当怪清掉
    expect(world.entities.some((x) => x.id === h.id)).toBe(true);
  });

  it("怪死了会被清掉并计入击杀", () => {
    const world = new World();
    const e = enemy(world, 400);
    applyDamage(e, 999);
    const r = updateUnits(world, 1 / 60, ctx);
    expect(r.kills).toBe(1);
    expect(e.dead).toBe(true);
  });
});

describe("瞬态特效", () => {
  it("ttl 到点自动回收", () => {
    const world = new World();
    world.spawn({ id: "fx", model: slash, pos: { x: 0, y: 0 }, params: { ttl: 0.2 } });
    expect(updateTransient(world, 0.1)).toBe(0);
    expect(updateTransient(world, 0.15)).toBe(1);
    expect(world.entities[0].dead).toBe(true);
  });
});

describe("波次", () => {
  it("每波数量递增并封顶", () => {
    expect(enemyCountForWave(1)).toBe(4);
    expect(enemyCountForWave(3)).toBe(6);
    expect(enemyCountForWave(50)).toBe(12);
  });

  it("流程：休息 → 一波刷完 → 等清场 → 休息 → 下一波", () => {
    const state = createWaveState();
    const spawned: string[] = [];
    const hooks = (alive: number) => ({
      spawn: (index: number, total: number) => spawned.push(`${index}/${total}`),
      aliveEnemies: alive,
    });

    // 休息 1.2s 后开波（停在刚开波那一刻，还没开始刷怪）
    for (let i = 0; i < 80 && state.wave === 0; i++) updateWaves(state, 1 / 60, hooks(0));
    expect(state.wave).toBe(1);
    expect(state.spawnLeft).toBe(enemyCountForWave(1));
    expect(spawned).toHaveLength(0);

    // 按 0.9s 的间隔刷完这一波
    for (let i = 0; i < 600 && state.spawnLeft > 0; i++) updateWaves(state, 1 / 60, hooks(0));
    expect(state.spawnLeft).toBe(0);
    expect(spawned).toHaveLength(enemyCountForWave(1));

    // 场上还有活着的怪 → 不开新波
    for (let i = 0; i < 300; i++) updateWaves(state, 1 / 60, hooks(10));
    expect(state.wave).toBe(1);

    // 清场 + 休息结束 → 第 2 波
    for (let i = 0; i < 300; i++) updateWaves(state, 1 / 60, hooks(0));
    expect(state.wave).toBe(2);
  });
});

describe("固定舞台：英雄守桩，怪从右边走过来", () => {
  it("holdPost：够不着也不追（怪自己走过来）—— 交战点才不会漂", () => {
    const world = new World();
    const h = hero(world, 1150, "melee");
    const e = enemy(world, 2500, "melee", { speed: 60, hp: 9999 });
    updateUnits(world, 1, { ...ctx, holdPost: true });
    expect(h.pos.x).toBe(1150); // 英雄一动不动
    expect(e.pos.x).toBeLessThan(2500); // 怪在朝英雄走
    expect(e.unit!.facing).toBe(-1); // 面朝左（从右边走进来的样子）
  });

  it("holdPost：场上没敌人也不推图（固定舞台不往右漂）", () => {
    const world = new World();
    const h = hero(world, 1150, "melee");
    updateUnits(world, 1, { ...ctx, advance: true, holdPost: true });
    expect(h.pos.x).toBe(1150);
  });

  it("没开 holdPost 时英雄照旧推图/追人（旧行为不变）", () => {
    const world = new World();
    const h = hero(world, 100, "melee");
    updateUnits(world, 1, ctx); // ctx 里 advance: true
    expect(h.pos.x).toBeGreaterThan(100);
  });

  it("怪在远处用赶路速度进场，进入交战距离后回自己的速度", () => {
    const far = new World();
    hero(far, 1150, "melee");
    const eFar = enemy(far, 2450, "melee", { speed: 60, hp: 9999 }); // 距离 1300 → 赶路
    updateUnits(far, 1, { ...ctx, holdPost: true });
    const farStep = 2450 - eFar.pos.x;

    const near = new World();
    hero(near, 1150, "melee");
    const eNear = enemy(near, 1400, "melee", { speed: 60, hp: 9999 }); // 距离 250 → 自己的速度
    updateUnits(near, 1, { ...ctx, holdPost: true });
    const nearStep = 1400 - eNear.pos.x;

    expect(nearStep).toBeCloseTo(60, 5); // 60 px/s × 1s
    expect(farStep).toBeGreaterThan(nearStep * 3); // 远处明显更快（不然挂机干等）
  });
});
