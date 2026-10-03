/**
 * 内核护栏测试：场景脏数据、模型加载失败、碰撞判定 —— 都不许把主程序搞崩。
 */
import { describe, expect, it } from "vitest";
import { ErrorLedger, placeholderModel, validateModel } from "./errors";
import { buildScene, parseScene } from "./scene";
import { World } from "./world";
import type { ModelDef } from "./types";
import slime from "./models/slime";

const fakeModel: ModelDef = {
  id: "fake",
  size: { w: 20, h: 20 },
  collider: { shape: "circle", r: 10 },
  draw() {},
};

describe("models 契约", () => {
  it("史莱姆模型符合契约", () => {
    const r = validateModel(slime, "slime");
    expect(r.ok).toBe(true);
  });

  it("缺 draw / size 非法 / id 不一致 都会被判废，且不抛异常", () => {
    expect(validateModel({ id: "a", size: { w: 1, h: 1 } }, "a").ok).toBe(false);
    expect(validateModel({ id: "a", size: { w: 0, h: 1 }, draw() {} }, "a").ok).toBe(false);
    expect(validateModel({ id: "b", size: { w: 1, h: 1 }, draw() {} }, "a").ok).toBe(false);
    expect(validateModel(null, "a").ok).toBe(false);
    expect(validateModel("nope", "a").ok).toBe(false);
  });

  it("占位模型能顶上：id 保留、能绘制（不依赖真 canvas 尺寸）", () => {
    const p = placeholderModel("ghost", "missing");
    expect(p.id).toBe("ghost");
    const calls: string[] = [];
    const stub = {
      save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
      fillRect() {}, fillText() {}, fill() {}, arc() {},
      set fillStyle(_v: string) { calls.push("fillStyle"); },
      set strokeStyle(_v: string) {}, set lineWidth(_v: number) {},
      set font(_v: string) {}, set textAlign(_v: string) {}, set globalAlpha(_v: number) {},
    } as unknown as CanvasRenderingContext2D;
    expect(() => p.draw(stub, 0, {})).not.toThrow();
  });

  it("错误账本对同一 (scope,id) 去重", () => {
    const l = new ErrorLedger();
    l.add("models", "x", "boom");
    l.add("models", "x", "boom again");
    l.add("models", "y", "other");
    expect(l.count).toBe(2);
  });
});

describe("scene.json 校验", () => {
  it("正常场景解析通过", () => {
    const { scene, errors } = parseScene({
      version: 1,
      bounds: { w: 2560, h: 260, groundY: 206 },
      layers: ["sky", "mid", "ground", "entity", "fx", "ui"],
      objects: [{ id: "a", model: "slime", x: 10, y: 20, params: { color: 1 } }],
    });
    expect(errors).toEqual([]);
    expect(scene?.objects).toHaveLength(1);
    const first = scene?.objects[0];
    expect(first?.params?.color).toBe(1);
  });

  it("脏数据只跳过坏条目并记账，不抛", () => {
    const { scene, errors } = parseScene({
      version: 2,
      bounds: { w: 0, h: 260, groundY: 999 },
      objects: [
        { id: "ok", model: "slime", x: 1, y: 2 },
        { id: "no_model", x: 1, y: 2 },
        { id: "bad_xy", model: "slime", x: "1", y: 2 },
        null,
        { id: "bad_param", model: "slime", x: 3, y: 4, params: { color: "red", size: 2 } },
      ],
    });
    expect(scene?.objects.map((o) => o.id)).toEqual(["ok", "bad_param"]);
    expect(scene?.objects[1]!.params).toEqual({ size: 2 });
    expect(errors.length).toBeGreaterThanOrEqual(4);
  });

  it("非对象输入返回 null 而不是抛异常", () => {
    expect(parseScene(undefined).scene).toBeNull();
    expect(parseScene("{}").scene).toBeNull();
  });
});

describe("buildScene：模型缺失 → 占位不崩", () => {
  it("引用不存在的模型时生成占位实体并记账", () => {
    const ledger = new ErrorLedger();
    const world = new World();
    const models = new Map<string, ModelDef>([["slime", slime]]);
    const { staticColliders } = buildScene(
      {
        version: 1,
        name: "t",
        bounds: { w: 100, h: 100, groundY: 80 },
        layers: ["sky", "mid", "ground", "entity", "fx", "ui"],
        objects: [
          { id: "good", model: "slime", x: 10, y: 80, collision: true },
          { id: "bad_layer", model: "slime", x: 15, y: 80, layer: "nope" },
          { id: "bad", model: "ghost", x: 20, y: 80 },
        ],
      },
      models,
      placeholderModel,
      ledger,
      world,
    );
    expect(world.entities).toHaveLength(3);
    expect(world.entities[2].broken).toBe(true);
    expect(staticColliders).toBe(1);
    expect(ledger.count).toBe(2); // layer 不存在 + 缺模型
  });
});

describe("World 碰撞", () => {
  it("重叠命中静态碰撞体，跳过被排除的实体", () => {
    const world = new World();
    const wall = world.spawn({ id: "wall", model: fakeModel, pos: { x: 100, y: 100 }, collision: true });
    expect(world.overlaps({ x: 104, y: 100 }, 8)).toBe(wall);
    expect(world.overlaps({ x: 104, y: 100 }, 8, wall)).toBeNull();
    expect(world.overlaps({ x: 300, y: 100 }, 8)).toBeNull();
  });

  it("hitTest 命中最后绘制的那个（上层优先）", () => {
    const world = new World();
    world.spawn({ id: "low", model: fakeModel, pos: { x: 50, y: 50 }, layer: 1 });
    world.spawn({ id: "high", model: fakeModel, pos: { x: 50, y: 50 }, layer: 5 });
    expect(world.hitTest({ x: 50, y: 40 })?.id).toBe("high");
  });

  it("tick 会清掉 dead 实体并累加 age", () => {
    const world = new World();
    const a = world.spawn({ id: "a", model: fakeModel, pos: { x: 0, y: 0 } });
    const b = world.spawn({ id: "b", model: fakeModel, pos: { x: 0, y: 0 } });
    b.dead = true;
    world.tick(0.5);
    expect(world.entities).toHaveLength(1);
    expect(a.age).toBeCloseTo(0.5);
  });
});
