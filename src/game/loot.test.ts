/**
 * 掉落物行为的测试：生成落地、边界夹取、拾取延迟、范围拾取、吸附不漏、全灭不动、超量回收。
 * 全部用真 World + 真模型（纯数据 + 纯绘制，不碰 DOM），不 mock。
 */
import { describe, expect, it } from "vitest";
import { World } from "./world";
import { makeUnit } from "./units";
import {
  DROP_EDGE_MARGIN,
  DROP_LAUNCH_HEIGHT,
  MAGNET_AFTER,
  MAX_DROPS,
  PICK_DELAY,
  PICK_RADIUS,
  spawnDrop,
  updateDrops,
  type DropHooks,
} from "./loot";
import type { DropPayload, DropQuality, Entity } from "./types";
import loot from "./models/loot";
import heroSwordsman from "./models/hero_swordsman";

const BOUNDS = { w: 2560, groundY: 206 };
const GROUND = BOUNDS.groundY;
const DT = 1 / 60;

function addHero(world: World, x: number, hp = 200): Entity {
  return world.spawn({
    id: `hero_${x}`,
    model: heroSwordsman,
    pos: { x, y: GROUND },
    unit: makeUnit({ team: "hero", kind: "melee", hp, damage: 20 }),
  });
}

function addDrop(
  world: World,
  x: number,
  over: Partial<{ y: number; quality: DropQuality; item: unknown; label: string; color: string }> = {},
): Entity {
  return spawnDrop({
    world,
    model: loot,
    layer: 4,
    id: `drop_${x}_${over.label ?? "x"}`,
    x,
    y: over.y ?? GROUND,
    quality: over.quality ?? 1,
    item: over.item ?? { name: "短剑" },
    label: over.label ?? "魔法 短剑",
    color: over.color ?? "#6f8fff",
  });
}

function hooks(world: World, heroes: Entity[], over: Partial<DropHooks> = {}): DropHooks & { heroes: Entity[] } {
  return { world, model: loot, groundY: GROUND, boundsW: BOUNDS.w, heroes, ...over };
}

/** 跑 seconds 秒（60fps，每帧都走 world.tick，和主循环一样） */
function run(world: World, heroes: Entity[], seconds: number, over: Partial<DropHooks> = {}) {
  const picked: DropPayload[] = [];
  let magnetized = 0;
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    const tick = updateDrops(world, DT, hooks(world, heroes, over));
    picked.push(...tick.picked);
    magnetized += tick.magnetized;
    world.tick(DT);
  }
  return { picked, magnetized };
}

describe("掉落落地", () => {
  it("生成即落地参数正确：品质写进 params，born 从 0 开始，比传入的 y 高 26px 起跳", () => {
    const world = new World();
    const e = addDrop(world, 600, { quality: 3 });

    expect(e.modelId).toBe("loot");
    expect(e.params.quality).toBe(3);
    expect(e.params.born).toBe(0);
    expect(e.params.grounded).toBe(0);
    expect(e.pos.y).toBeCloseTo(GROUND - DROP_LAUNCH_HEIGHT, 6);
    expect(e.drop?.quality).toBe(3);

    // 抛出去：第一帧是往上走的（不是直接贴地出现）
    updateDrops(world, DT, hooks(world, []));
    expect(e.pos.y).toBeLessThan(GROUND - DROP_LAUNCH_HEIGHT);

    // 自己走重力落地：停在地面、速度归零、grounded 置 1
    for (let i = 0; i < 120 && e.params.grounded !== 1; i++) updateDrops(world, DT, hooks(world, []));
    expect(e.params.grounded).toBe(1);
    expect(e.pos.y).toBeCloseTo(GROUND, 6);
    expect(e.params.vy).toBe(0);
  });

  it("左右边界：抛到场景外也会被拉回 [12, boundsW-12]", () => {
    const world = new World();
    const left = addDrop(world, -400);
    const right = addDrop(world, 9999);

    updateDrops(world, DT, hooks(world, []));

    expect(left.pos.x).toBe(DROP_EDGE_MARGIN);
    expect(right.pos.x).toBe(BOUNDS.w - DROP_EDGE_MARGIN);
  });
});

describe("拾取", () => {
  it("pickDelay 之前不许被捡（刚落地就看不清）", () => {
    const world = new World();
    const hero = addHero(world, 400);
    const e = addDrop(world, 400);

    // 这 0.45 秒里连落地都还没走完，更不该被捡走
    const early = run(world, [hero], PICK_DELAY);
    expect(early.picked).toHaveLength(0);
    expect(e.dead).toBe(false);

    // 过了犹豫期，英雄就站在旁边 → 捡走
    const late = run(world, [hero], 1);
    expect(late.picked.map((p) => p.label)).toEqual(["魔法 短剑"]);
    expect(e.dead).toBe(true);
  });

  it("英雄进圈（水平 ≤ pickRadius）就捡，圈外的不捡", () => {
    const world = new World();
    const hero = addHero(world, 500);
    const near = addDrop(world, 540, { label: "近" });
    const edge = addDrop(world, 500 - PICK_RADIUS, { label: "贴着半径" });
    const far = addDrop(world, 500 + PICK_RADIUS + 20, { label: "远" });

    const { picked } = run(world, [hero], 1.2);

    expect(picked.map((p) => p.label).sort()).toEqual(["贴着半径", "近"]);
    expect(near.dead).toBe(true);
    expect(edge.dead).toBe(true);
    expect(far.dead).toBe(false);
    expect(far.pos.x).toBe(500 + PICK_RADIUS + 20); // 圈外原地不动
  });

  it("超过 magnetAfter 会朝英雄飞，最终一定捡到（挂机不漏掉落）", () => {
    const world = new World();
    const hero = addHero(world, 200);
    const e = addDrop(world, 900); // 700px 外：进圈之前吸不到
    const before = e.pos.x;

    const flying = run(world, [hero], MAGNET_AFTER + 0.8);
    expect(flying.magnetized).toBeGreaterThan(0);
    expect(e.pos.x).toBeLessThan(before); // 已经在飞向英雄
    expect(flying.picked).toHaveLength(0); // 还没进圈

    const done = run(world, [hero], 4);
    expect(done.picked.map((p) => p.label)).toEqual(["魔法 短剑"]);
    expect(e.dead).toBe(true);
  });

  it("拾到的载荷与传入的 item / label / color / quality 完全一致（原引用）", () => {
    const world = new World();
    const hero = addHero(world, 300);
    const item = { name: "乔丹之石", kind: "ring" };
    const e = addDrop(world, 320, { quality: 3, item, label: "暗金 乔丹之石", color: "#c7a24a" });

    const { picked } = run(world, [hero], 1);

    expect(picked).toHaveLength(1);
    expect(picked[0]).toEqual({ item, label: "暗金 乔丹之石", color: "#c7a24a", quality: 3 });
    expect(picked[0].item).toBe(item);
    // 捡完就被主循环回收，地上不留尸体
    expect(world.entities.some((x) => x.id === e.id)).toBe(false);
  });
});

describe("兜底", () => {
  it("没有英雄（空场或全灭）时掉落留在原地：不吸附、不消失", () => {
    const world = new World();
    const e = addDrop(world, 700);
    run(world, [], MAGNET_AFTER + 3);
    expect(e.pos.x).toBe(700);
    expect(e.pos.y).toBeCloseTo(GROUND, 6);
    expect(e.params.grounded).toBe(1);
    expect(e.dead).toBe(false);

    // 英雄全灭（血量 0）也算「没有英雄」
    const downed = addHero(world, 700, 1);
    downed.unit!.hp = 0;
    const rest = run(world, [downed], MAGNET_AFTER + 3);
    expect(rest.picked).toHaveLength(0);
    expect(e.dead).toBe(false);
    expect(e.pos.x).toBe(700);
  });

  it(`场上超过 ${MAX_DROPS} 个时，最老的按已拾取回收`, () => {
    const world = new World();
    const drops: Entity[] = [];
    for (let i = 0; i < MAX_DROPS + 3; i++) drops.push(addDrop(world, 100 + i * 10, { label: `第${i}件` }));

    const { picked } = run(world, [], DT);

    expect(picked.map((p) => p.label)).toEqual(["第0件", "第1件", "第2件"]);
    expect(drops.slice(0, 3).every((d) => d.dead)).toBe(true);
    expect(drops[3].dead).toBe(false);
    expect(world.entities.filter((e) => !e.dead && e.drop)).toHaveLength(MAX_DROPS);
  });

  it("载荷必须由 World.spawn 透传，不是 spawn 之后再手挂（逐字段手抄会静默吞掉它）", () => {
    const world = new World();
    const payload = { item: { probe: 1 }, label: "★★ 透传之刃", color: "#c7a24a", quality: 3 as const };
    const e = world.spawn({ id: "d_t", model: loot, pos: { x: 10, y: GROUND }, drop: payload });
    expect(e.drop, "spawn 把 drop 吞了：掉落图标会画、名字标签永远不出现，而且不报错").toBe(payload);
    // 而且是同一个引用，别悄悄复制一份（将来加字段时看不出被改过）
    expect(e.drop).toBe(payload);
    // spawnDrop 走的就是这条路径
    const viaApi = addDrop(world, 200, { label: "稀有 雷霆之锤", color: "#ffe066", quality: 2, item: { n: 1 } });
    expect(viaApi.drop?.label).toBe("稀有 雷霆之锤");
    expect(viaApi.drop?.color).toBe("#ffe066");
    expect(viaApi.drop?.quality).toBe(2);
  });
});
