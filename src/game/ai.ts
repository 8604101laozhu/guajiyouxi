/**
 * 单位行为：索敌 → 走位 → 攻击；外加「英雄倒下自动复活」和「死亡结算」。
 *
 * 挂机游戏的核：**没有玩家输入**。写在这里的每一项都是自动决策。
 * 该不该打决定了「谁动」，打得中打不中在 combat.ts。
 */
import type { Entity, ModelDef, SceneLayout } from "./types";
import { World } from "./world";
import {
  applyDamage,
  meleeSwing,
  nearestOpponent,
  spawnFx,
  spawnProjectile,
  unitAlive,
} from "./combat";

export type AiContext = {
  bounds: SceneLayout["bounds"];
  models: Map<string, ModelDef>;
  /** 英雄没目标时继续向右推图（挂机时的「自动前进」开关） */
  advance: boolean;
  /** 复活等待秒数 */
  reviveDelay?: number;
  /**
   * 命中/伤害掷骰。给了就走 d2 的规则（命中率、致命一击、元素伤害）；
   * 不给就退回单位的固定伤害（单测里省事）。
   */
  rolls?: {
    hero: (target: Entity) => { damage: number; crit: boolean; miss: boolean };
    monster: (attacker: Entity, target: Entity) => { damage: number; crit: boolean; miss: boolean };
  };
};

export type AiResult = {
  kills: number;
  meleeSwings: number;
  shots: number;
  misses: number;
  heroDown: boolean;
  /** 本帧确认死亡的敌方实体（掉落结算要用） */
  killed: Entity[];
};

/** 走位：带静态碰撞检测的平移，返回是否真的挪动了 */
function step(world: World, e: Entity, dir: number, dx: number, bounds: SceneLayout["bounds"]): boolean {
  const next = { x: Math.min(bounds.w - 24, Math.max(24, e.pos.x + dir * dx)), y: e.pos.y };
  if (next.x === e.pos.x) return false;
  if (world.overlaps(next, 12, e)) return false;
  e.pos.x = next.x;
  return true;
}

/** 被挡多久就放行：挂机游戏里单位卡在石头上等于游戏停摆 */
export const UNSTUCK_AFTER = 1.5;
/** 放行窗口：这段时间内忽略静态碰撞，够它穿过一块石头 */
const UNSTUCK_WINDOW = 1.5;

/** 朝目标挪一步；被静态碰撞挡太久就从石头里「挤」过去 */
function advance(world: World, e: Entity, dir: number, dx: number, dt: number, bounds: SceneLayout["bounds"]): void {
  const unit = e.unit!;
  const clampX = (x: number) => Math.min(bounds.w - 24, Math.max(24, x));

  // 挤过去窗口内：不看碰撞，直接挪
  if (unit.unstuckFor && unit.unstuckFor > 0) {
    unit.unstuckFor = Math.max(0, unit.unstuckFor - dt);
    const next = clampX(e.pos.x + dir * dx);
    if (next !== e.pos.x) e.pos.x = next;
    return;
  }

  if (step(world, e, dir, dx, bounds)) {
    unit.blockedFor = 0;
    return;
  }
  unit.blockedFor = (unit.blockedFor ?? 0) + dt;
  if (unit.blockedFor >= UNSTUCK_AFTER) {
    unit.blockedFor = 0;
    unit.unstuckFor = UNSTUCK_WINDOW;
  }
}

export function updateUnits(world: World, dt: number, ctx: AiContext): AiResult {
  const result: AiResult = { kills: 0, meleeSwings: 0, shots: 0, misses: 0, heroDown: false, killed: [] };
  if (!world.entities.some((e) => e.unit)) return result;

  for (const e of world.entities) {
    const unit = e.unit;
    if (!unit || e.dead) continue;

    unit.cd = Math.max(0, unit.cd - dt);
    unit.hitFlash = Math.max(0, unit.hitFlash - dt);

    // 英雄倒下 → 读秒复活（挂机不能因为一次失手就停摆）
    if (unit.hp <= 0) {
      if (unit.team !== "hero") continue;
      result.heroDown = true;
      unit.reviveIn = (unit.reviveIn ?? ctx.reviveDelay ?? 3) - dt;
      if (unit.reviveIn <= 0) {
        unit.hp = unit.maxHp;
        unit.reviveIn = undefined;
        spawnFx(world, ctx.models.get("slash") ?? e.model, { x: e.pos.x, y: e.pos.y - 30 }, { dir: 1, ttl: 0.4, revive: 1 });
      }
      continue;
    }

    const target = nearestOpponent(world, e);

    if (!target) {
      // 没敌人：英雄继续推图，怪站着（怪的推进由刷怪器负责）
      if (unit.team === "hero" && ctx.advance) {
        unit.facing = 1;
        advance(world, e, 1, unit.speed * 0.55 * dt, dt, boundsOr(ctx));
      }
      continue;
    }

    const dx = target.pos.x - e.pos.x;
    unit.facing = dx >= 0 ? 1 : -1;
    const dist = Math.abs(dx);

    if (dist > unit.range) {
      // 贴近到「够得着 + 一点余量」，别贴在对方脸上抖
      const gap = unit.range * 0.9;
      if (dist - gap > 2) advance(world, e, unit.facing, unit.speed * dt, dt, boundsOr(ctx));
      continue;
    }

    if (unit.cd > 0) continue;
    unit.cd = unit.cdTime;

    // 命中掷骰：给了 rolls 就走 d2 那套（命中率 / 致命一击 / 元素伤害）
    const strike = ctx.rolls ? (unit.team === "hero" ? ctx.rolls.hero(target) : ctx.rolls.monster(e, target)) : null;
    if (strike?.miss) {
      result.misses++;
      const slash = ctx.models.get("slash");
      if (slash) spawnFx(world, slash, { x: e.pos.x + unit.facing * 18, y: e.pos.y - 26 }, { dir: unit.facing, ttl: 0.16, miss: 1 });
      continue;
    }
    const damage = strike ? strike.damage : unit.damage;

    if (unit.kind === "melee") {
      meleeSwing(world, e, target, { slash: ctx.models.get("slash"), damage, crit: strike?.crit });
      result.meleeSwings++;
    } else {
      if (spawnProjectile(world, ctx.models.get("bolt") ?? e.model, e, target.pos, damage)) result.shots++;
    }
  }

  // 死亡结算：所有 hp 归零的单位在这里统一处理（近战/弹道都走这条）
  for (const e of world.entities) {
    if (!e.unit || e.dead || e.unit.hp > 0) continue;
    if (e.unit.team === "hero") continue; // 英雄走复活逻辑
    e.dead = true;
    result.kills++;
    result.killed.push(e);
    spawnFx(world, ctx.models.get("slash") ?? e.model, { x: e.pos.x, y: e.pos.y - 20 }, { dir: 0, ttl: 0.3, death: 1 });
  }

  return result;
}

function boundsOr(ctx: AiContext): SceneLayout["bounds"] {
  return ctx.bounds;
}

export { applyDamage, unitAlive };
