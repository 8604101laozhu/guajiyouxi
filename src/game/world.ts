/**
 * 实体注册表（世界）。
 * 行为逻辑不在这里 —— 这里只管：谁活着、在哪、有没有撞上。
 */
import type { Collider, DropPayload, Entity, ModelDef, Vec2 } from "./types";
import type { Unit } from "./units";

/** 缺省碰撞盒：按模型 size 推矩形，脚底居中 */
export function colliderOf(model: ModelDef): Collider {
  if (model.collider) return model.collider;
  return { shape: "box", w: model.size.w, h: model.size.h };
}

export type SpawnInput = {
  id: string;
  model: ModelDef;
  pos: Vec2;
  layer?: number;
  layerName?: string;
  rot?: number;
  scale?: number;
  collision?: boolean;
  params?: Record<string, number>;
  broken?: boolean;
  /** 战斗单位（可选；静态物件/特效不传） */
  unit?: Unit;
  /** 掉落物载荷（可选；只有掉落物传） */
  drop?: DropPayload;
};

export class World {
  readonly entities: Entity[] = [];
  private seq = 0;

  /**
   * 造实体。
   *
   * **`...input` 必须放最前面**：这个函数曾经逐字段手抄，于是新增的 `drop` 载荷被静默吞掉 ——
   * 掉落图标会画、名字标签却永远不出现（而且不报错）。给 Entity 加字段时这里不用改，但要补一条透传测试。
   */
  spawn(input: SpawnInput): Entity {
    const e: Entity = {
      ...input,
      id: input.id ?? `e${this.seq++}`,
      modelId: input.model.id,
      model: input.model,
      pos: { x: input.pos.x, y: input.pos.y },
      rot: input.rot ?? 0,
      scale: input.scale ?? 1,
      layer: input.layer ?? 0,
      layerName: input.layerName ?? "entity",
      collision: input.collision ?? false,
      params: input.params ?? {},
      age: 0,
      dead: false,
      broken: input.broken ?? false,
      unit: input.unit,
      drop: input.drop,
    };
    this.entities.push(e);
    return e;
  }

  /** 每帧推进年龄；行为在主程序里做 */
  tick(dt: number) {
    for (const e of this.entities) e.age += dt;
    if (this.entities.some((e) => e.dead)) {
      for (let i = this.entities.length - 1; i >= 0; i--) {
        if (this.entities[i].dead) this.entities.splice(i, 1);
      }
    }
  }

  byLayer() {
    return [...this.entities].sort((a, b) => a.layer - b.layer);
  }

  /** 世界坐标 → 实体局部坐标（考虑 rot/scale/anchor） */
  worldCollider(e: Entity): { shape: "circle" | "box"; cx: number; cy: number; r?: number; w?: number; h?: number } {
    const c = colliderOf(e.model);
    const anchor = e.model.anchor ?? { x: 0.5, y: 1 };
    const ox = (c.shape === "box" ? (c.ox ?? 0) : (c.ox ?? 0)) * e.scale;
    const oy = (c.shape === "box" ? (c.oy ?? 0) : (c.oy ?? 0)) * e.scale;
    const localX = (c.shape === "box" ? c.w / 2 : c.r) + ox;
    const localY = (c.shape === "box" ? c.h / 2 : c.r) + oy;
    // 局部盒中心相对锚点的高度：默认盒底贴锚点
    const cxLocal = localX;
    const cyLocal = -localY - (1 - anchor.y) * e.model.size.h * e.scale * 0;
    const cos = Math.cos(e.rot);
    const sin = Math.sin(e.rot);
    const cx = e.pos.x + (cxLocal * cos - cyLocal * sin) * 1;
    const cy = e.pos.y + (cxLocal * sin + cyLocal * cos) * 1;
    return c.shape === "circle"
      ? { shape: "circle", cx, cy, r: c.r * e.scale }
      : { shape: "box", cx, cy, w: c.w * e.scale, h: c.h * e.scale };
  }

  /** 点是否落在某个实体碰撞盒内（射击/点击用） */
  hitTest(point: Vec2): Entity | null {
    for (const e of this.byLayer().reverse()) {
      const c = this.worldCollider(e);
      if (c.shape === "circle") {
        if (Math.hypot(point.x - c.cx, point.y - c.cy) <= c.r!) return e;
      } else {
        if (Math.abs(point.x - c.cx) <= c.w! / 2 && Math.abs(point.y - c.cy) <= c.h! / 2) return e;
      }
    }
    return null;
  }

  /** 圆 vs 圆/盒 的粗判，供移动与子弹用 */
  overlaps(pos: Vec2, radius: number, skip?: Entity): Entity | null {
    for (const e of this.entities) {
      if (!e.collision || e === skip) continue;
      const c = this.worldCollider(e);
      if (c.shape === "circle") {
        if (Math.hypot(pos.x - c.cx, pos.y - c.cy) <= c.r! + radius) return e;
      } else {
        const nx = Math.max(c.cx - c.w! / 2, Math.min(pos.x, c.cx + c.w! / 2));
        const ny = Math.max(c.cy - c.h! / 2, Math.min(pos.y, c.cy + c.h! / 2));
        if (Math.hypot(pos.x - nx, pos.y - ny) <= radius) return e;
      }
    }
    return null;
  }

  clear() {
    this.entities.length = 0;
  }
}
