/**
 * 掉落物的行为：从怪身上抛出来 → 落地 → 等一会儿 → 吸附 → 进圈拾取。
 *
 * 这个文件只负责「地上的东西什么时候、被谁捡走」——纯逻辑，不碰 canvas，可单测。
 * 掉落内容（item / label / color / quality）由调用方（main.ts 走 d2-bridge）算好塞进 DropPayload，
 * 内核保持 d2 无关；画法在 models/loot.ts，名字标签在 render/renderer.ts。
 *
 * 挂机的底线：**掉落不许留在身后**。所以 pickDelay 之后进圈就捡，magnetAfter 之后
 * 主动朝最近的英雄飞过去 —— 英雄跑远了也会自己追上来。
 */
import type { DropPayload, DropQuality, Entity, ModelDef } from "./types";
import type { World } from "./world";

/** 落地重力（px/s²） */
export const DROP_GRAVITY = 900;
/** 生成时比传入的 y 高多少像素：先起跳再落下，别直接贴地出现 */
export const DROP_LAUNCH_HEIGHT = 26;
/** 起跳初速度（px/s，向上为负） */
export const DROP_TOSS_SPEED = 60;
/** 左右边界内缩：掉落别贴着场景边缘站着 */
export const DROP_EDGE_MARGIN = 12;
/** 落地后多久才能被捡（秒）—— 太短看不清 */
export const PICK_DELAY = 0.45;
/** 拾取半径（像素，按水平距离算） */
export const PICK_RADIUS = 52;
/** 落地后多久开始吸附（秒）—— 挂机不许把掉落留在身后 */
export const MAGNET_AFTER = 3;
/** 吸附飞行速度（px/s，匀速） */
export const MAGNET_SPEED = 240;
/** 场上掉落物上限：超了就把最老的按已拾取回收，防止实体无限堆积 */
export const MAX_DROPS = 40;

export type DropHooks = {
  world: World;
  /** 掉落物模型（models.get("loot")） */
  model: ModelDef;
  /** 场景高度，用于夹住落地位置 */
  groundY: number;
  boundsW: number;
  /** 拾取半径（像素） */
  pickRadius?: number;
  /** 落地后多久才能被捡（秒），太短看不清 */
  pickDelay?: number;
  /** 落地后多久开始「吸附」飞向英雄（秒）—— 挂机不许把掉落留在身后 */
  magnetAfter?: number;
};

export type DropTick = {
  /** 本帧拾到的载荷（含超量回收的） */
  picked: DropPayload[];
  /** 本帧正在吸附飞行的掉落数（调试/HUD 用） */
  magnetized: number;
  /** 本帧刚落地的掉落物（落地音效/特效挂在它上面；主程序拿去播一声即可） */
  landed: Entity[];
};

/** 夹在场景左右边界内 */
function clampX(x: number, boundsW: number): number {
  const max = Math.max(DROP_EDGE_MARGIN, boundsW - DROP_EDGE_MARGIN);
  return Math.min(max, Math.max(DROP_EDGE_MARGIN, x));
}

/** 水平最近的英雄 */
function nearestHero(heroes: Entity[], x: number): Entity {
  let best = heroes[0];
  let bestD = Math.abs(best.pos.x - x);
  for (const h of heroes) {
    const d = Math.abs(h.pos.x - x);
    if (d < bestD) {
      bestD = d;
      best = h;
    }
  }
  return best;
}

/** 造一个落地物：从 (x,y) 向上抛一下再落地，返回实体 */
export function spawnDrop(opts: {
  world: World;
  model: ModelDef;
  layer: number;
  id: string;
  x: number;
  y: number;
  quality: DropQuality;
  item: unknown;
  label: string;
  color: string;
}): Entity {
  const e = opts.world.spawn({
    id: opts.id,
    model: opts.model,
    pos: { x: opts.x, y: opts.y - DROP_LAUNCH_HEIGHT },
    layer: opts.layer,
    layerName: "fx",
    params: {
      quality: opts.quality,
      /** 落地后秒数：落地那一刻从 0 开始累计 */
      born: 0,
      /** 自己算重力，落地的判定也在本文件里 */
      vy: -DROP_TOSS_SPEED,
      grounded: 0,
    },
    // 载荷直接交给 spawn 透传（world.ts 的 ...input），别在 spawn 之后再手挂：
    // 手挂能绕过「逐字段手抄吞字段」的坑，但会把坑留着，下一个字段照样中招
    drop: { item: opts.item, label: opts.label, color: opts.color, quality: opts.quality },
  });
  return e;
}

/** 每帧结算：到时间就飞向最近的英雄，进圈就拾取；返回本帧拾到的载荷 */
export function updateDrops(world: World, dt: number, hooks: DropHooks & { heroes: Entity[] }): DropTick {
  const out: DropTick = { picked: [], magnetized: 0, landed: [] };
  const pickRadius = hooks.pickRadius ?? PICK_RADIUS;
  const pickDelay = hooks.pickDelay ?? PICK_DELAY;
  const magnetAfter = hooks.magnetAfter ?? MAGNET_AFTER;
  // 只有活着的英雄能捡东西（全灭时掉落原地等复活）
  const heroes = hooks.heroes.filter((h) => !h.dead && !!h.unit && h.unit.hp > 0);

  const drops: Entity[] = [];
  for (const e of world.entities) {
    if (e.dead || !e.drop) continue;
    drops.push(e);

    // a) 边界：无论空中还是地上都夹住
    e.pos.x = clampX(e.pos.x, hooks.boundsW);

    // b) 空中：自己走重力，落地就停住并开始计时
    if (e.params.grounded !== 1) {
      e.params.vy += DROP_GRAVITY * dt;
      e.pos.y += e.params.vy * dt;
      if (e.pos.y >= hooks.groundY) {
        e.pos.y = hooks.groundY;
        e.params.vy = 0;
        e.params.grounded = 1;
        out.landed.push(e); // 落地只发生一次（grounded 置 1 后就走不到这里）
      }
      continue; // 没落地：不许被捡
    }
    e.params.born += dt;
  }

  for (const e of drops) {
    if (e.dead) continue;
    const payload = e.drop;
    if (!payload) continue;
    // 没有英雄（全灭）：掉落留在原地不动，不吸附也不消失
    if (!heroes.length) continue;
    if (e.params.grounded !== 1) continue;

    const hero = nearestHero(heroes, e.pos.x);
    const dx = hero.pos.x - e.pos.x;
    const dy = hero.pos.y - e.pos.y;
    const dist = Math.hypot(dx, dy);

    // c) 过犹豫期 + 英雄进圈 → 直接拾取
    if (e.params.born >= pickDelay && Math.abs(dx) <= pickRadius) {
      e.dead = true;
      out.picked.push(payload);
      continue;
    }

    // d) 到点吸附：朝英雄匀速飞，进圈即拾取（挂机时保证一件都不漏）
    if (e.params.born >= magnetAfter) {
      out.magnetized++;
      const step = MAGNET_SPEED * dt;
      if (dist <= step) {
        e.pos.x = hero.pos.x;
        e.pos.y = hero.pos.y;
      } else {
        e.pos.x += (dx / dist) * step;
        e.pos.y += (dy / dist) * step;
      }
      if (Math.hypot(hero.pos.x - e.pos.x, hero.pos.y - e.pos.y) <= pickRadius) {
        e.dead = true;
        out.picked.push(payload);
      }
    }
  }

  // e) 上限兜底：最老的按已拾取回收（挂久了地上不会堆成一座山）
  const alive = drops.filter((e) => !e.dead);
  const overflow = alive.length - MAX_DROPS;
  if (overflow > 0) {
    for (const e of alive.slice(0, overflow)) {
      e.dead = true;
      if (e.drop) out.picked.push(e.drop);
    }
  }

  return out;
}
