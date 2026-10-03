/**
 * 战斗结算：伤害、近战挥砍、远程弹道、瞬态特效。
 * 这里只回答「打得中吗、掉多少血」，不管「该不该打」——那是 ai.ts 的事。
 */
import type { Entity, ModelDef, SceneLayout } from "./types";
import type { Team } from "./units";
import { World } from "./world";

/** 同一条横版上的判定容差（避免上下层物件误命中） */
export const LANE_TOLERANCE = 48;

export function isOpposing(a: Team, b: Team) {
  return a !== b;
}

export function unitAlive(e: Entity): boolean {
  return !!e.unit && !e.dead && e.unit.hp > 0;
}

/** 最近的敌对单位（横版：只看水平距离，纵向在容差内） */
export function nearestOpponent(world: World, self: Entity, tolerance = LANE_TOLERANCE): Entity | null {
  if (!self.unit) return null;
  let best: Entity | null = null;
  let bestDist = Infinity;
  for (const other of world.entities) {
    if (other === self || !unitAlive(other) || !other.unit) continue;
    if (!isOpposing(self.unit.team, other.unit.team)) continue;
    if (Math.abs(other.pos.y - self.pos.y) > tolerance) continue;
    const d = Math.abs(other.pos.x - self.pos.x);
    if (d < bestDist) {
      bestDist = d;
      best = other;
    }
  }
  return best;
}

/** 扣血；返回是否这一下打死了 */
export function applyDamage(target: Entity, amount: number): boolean {
  if (!target.unit) return false;
  target.unit.hp = Math.max(0, target.unit.hp - Math.max(0, Math.round(amount)));
  target.unit.hitFlash = 0.18;
  return target.unit.hp <= 0;
}

/** 瞬态实体（挥砍弧、命中火花、死亡烟）：params.ttl 到点就回收 */
export function spawnFx(
  world: World,
  model: ModelDef,
  pos: { x: number; y: number },
  params: Record<string, number>,
  layerName = "fx",
  layer = 4,
): Entity {
  return world.spawn({
    id: `fx_${model.id}_${Math.round(pos.x)}_${Math.random().toString(36).slice(2, 6)}`,
    model,
    pos,
    layer,
    layerName,
    params: { ttl: 0.25, ...params },
  });
}

/** 每帧推进瞬态实体；返回本帧清掉的数量 */
export function updateTransient(world: World, dt: number): number {
  let removed = 0;
  for (const e of world.entities) {
    if (e.dead || e.params.ttl === undefined) continue;
    e.params.ttl -= dt;
    if (e.params.ttl <= 0) {
      e.dead = true;
      removed++;
    }
  }
  return removed;
}

/** 近战：够得着就砍，带一点前冲表现。damage 不给就用单位自身伤害 */
export function meleeSwing(
  world: World,
  attacker: Entity,
  target: Entity,
  fx: { slash?: ModelDef; damage?: number; crit?: boolean },
): boolean {
  if (!attacker.unit || !unitAlive(target)) return false;
  const dir = target.pos.x >= attacker.pos.x ? 1 : -1;
  const killed = applyDamage(target, fx.damage ?? attacker.unit.damage);
  if (fx.slash) {
    spawnFx(
      world,
      fx.slash,
      { x: attacker.pos.x + dir * 18, y: attacker.pos.y - 26 },
      { dir, ttl: fx.crit ? 0.26 : 0.18, crit: fx.crit ? 1 : 0 },
    );
  }
  return killed;
}

/** 远程：生成一发弹道（伤害在开火时就已经掷好） */
export function spawnProjectile(
  world: World,
  model: ModelDef,
  shooter: Entity,
  target: { x: number; y: number },
  damage?: number,
): Entity | null {
  if (!shooter.unit) return null;
  const dir = target.x >= shooter.pos.x ? 1 : -1;
  const speed = 420;
  return world.spawn({
    id: `bolt_${Math.round(shooter.pos.x)}_${Math.random().toString(36).slice(2, 6)}`,
    model,
    pos: { x: shooter.pos.x + dir * 16, y: shooter.pos.y - 26 },
    layer: 3,
    layerName: "fx",
    params: {
      dir,
      speed,
      damage: damage ?? shooter.unit.damage,
      /** 0 = hero 阵营，1 = enemy 阵营（params 只能放数字） */
      team: shooter.unit.team === "hero" ? 0 : 1,
      ttl: 2.5,
    },
  });
}

export type ProjectileTick = { hits: number; killed: number; blocked: number };

/** 推进所有弹道：撞静态碰撞 → 消失；撞敌对单位 → 结算伤害并消失 */
export function updateProjectiles(world: World, dt: number, bounds: SceneLayout["bounds"]): ProjectileTick {
  const out: ProjectileTick = { hits: 0, killed: 0, blocked: 0 };
  for (const p of world.entities) {
    if (p.dead || p.modelId !== "bolt") continue;
    p.pos.x += p.params.dir * p.params.speed * dt;
    p.rot = p.params.dir > 0 ? 0 : Math.PI;
    if (p.pos.x < -40 || p.pos.x > bounds.w + 40 || p.params.ttl <= 0) {
      p.dead = true;
      continue;
    }
    // 打到墙就停
    if (world.overlaps({ x: p.pos.x, y: p.pos.y }, 3)) {
      p.dead = true;
      out.blocked++;
      continue;
    }
    const team: Team = p.params.team === 0 ? "hero" : "enemy";
    let hit: Entity | null = null;
    for (const e of world.entities) {
      if (e === p || !unitAlive(e) || !e.unit || e.unit.team === team) continue;
      if (Math.abs(e.pos.x - p.pos.x) > 14) continue;
      if (Math.abs(e.pos.y - p.model.size.h - p.pos.y) > LANE_TOLERANCE) continue;
      hit = e;
      break;
    }
    if (hit) {
      const damage = p.params.damage;
      p.dead = true;
      if (damage > 0) {
        const killed = applyDamage(hit, damage);
        out.hits++;
        if (killed) out.killed++;
      }
    }
  }
  return out;
}
