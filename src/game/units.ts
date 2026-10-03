/**
 * 战斗单位（挂在 Entity 上的纯数据）+ 造单位。
 * 规则数值集中在这里；行为在 ai.ts，结算在 combat.ts。
 *
 * 这是**挂机**游戏：没有玩家输入。角色自己索敌、自己走位、自己开火。
 */

export type Team = "hero" | "enemy";
export type AttackKind = "melee" | "ranged";

export type Unit = {
  team: Team;
  kind: AttackKind;
  hp: number;
  maxHp: number;
  /** 水平移动速度 px/s */
  speed: number;
  /** 攻击距离（近战=挥砍够得着的距离，远程=放弹的距离） */
  range: number;
  /** 冷却中剩余秒数 */
  cd: number;
  /** 冷却总时长 */
  cdTime: number;
  damage: number;
  /** 朝向：1 向右，-1 向左 */
  facing: 1 | -1;
  /** 受击闪白剩余秒数（纯表现） */
  hitFlash: number;
  /** 这一波是精英/首领（只影响数值与外观档位） */
  rank: 0 | 1 | 2;
  /** 英雄倒下后的复活倒计时（>0 表示正在读秒） */
  reviveIn?: number;
  /** 被静态碰撞挡住的累计秒数：超过阈值就进入「挤过去」窗口 */
  blockedFor?: number;
  /** 挤过去窗口剩余秒数（>0 时忽略静态碰撞） */
  unstuckFor?: number;
  /** 防御值（d2 数据：决定对方命中率） */
  defense?: number;
  /** 等级（d2 数据：命中判定用） */
  mlvl?: number;
  /** 这只怪的 d2 参数（掉落/命中结算用；英雄没有） */
  spec?: EnemySpec;
};

/**
 * 怪的一整套参数：数值来自 d2 的关卡表，外观档位来自这里。
 * `waves.ts` 只管节拍，具体造什么怪由 d2-bridge 决定。
 */
export type EnemySpec = {
  kind: AttackKind;
  /** 0 小怪 / 1 精英 / 2 首领 */
  rank: 0 | 1 | 2;
  hp: number;
  damage: number;
  speed: number;
  /** 外观档位（交给模型 params） */
  variant: number;
  defense: number;
  mlvl: number;
  tcLevel: number;
  picks: number;
  noDrop: number;
  uber: boolean;
  jewelryChance: number;
  gold: number;
  /** 显示名（HUD / 掉落日志） */
  name: string;
};

export type UnitSpec = Partial<Omit<Unit, "team" | "kind">> & {
  team: Team;
  kind: AttackKind;
};

/**
 * 造单位。
 *
 * **契约：数值由调用方给全**（现在全都来自 d2 的关卡表），makeUnit 只补默认值、不再二次放大。
 * `...spec` 必须放最前面：漏透传扩展字段会「静默降级」——曾经漏掉 spec，掉落就恒为 0，还不报错。
 */
export function makeUnit(spec: UnitSpec): Unit {
  const rank = (spec.rank ?? 0) as 0 | 1 | 2;
  const maxHp = Math.max(1, Math.round(spec.hp ?? (spec.team === "hero" ? 120 : 60)));
  return {
    ...spec,
    team: spec.team,
    kind: spec.kind,
    hp: maxHp,
    maxHp,
    speed: spec.speed ?? (spec.kind === "melee" ? 58 : 34),
    range: spec.range ?? (spec.kind === "melee" ? 26 : 220),
    cd: spec.cd ?? 0,
    cdTime: spec.cdTime ?? (spec.kind === "melee" ? 0.75 : 1.4),
    damage: Math.max(1, Math.round(spec.damage ?? (spec.team === "hero" ? 12 : 7))),
    facing: spec.facing ?? (spec.team === "hero" ? 1 : -1),
    hitFlash: 0,
    rank,
  };
}

export function isAlive(e: { unit?: Unit; dead: boolean }): boolean {
  return !!e.unit && !e.dead && e.unit.hp > 0;
}
