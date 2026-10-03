/**
 * 主程序。
 * 这里只有：装配（读场景 → 载模型 → 生成实体 → 给单位装上战斗数值）与主循环（自动战斗的行为与结算）。
 * 一切"长什么样"都在 models/*.ts，"放在哪"都在 public/scenes/*.json，"数值是多少"都在 src/lib/d2 + d2-bridge.ts。
 *
 * 注意：这是**挂机**游戏，没有玩家输入。角色自己索敌、自己走位、自己开火。
 * 这一层不认识 d2：所有 d2 的换算都走 ./d2-bridge。
 */
import { ErrorLedger, placeholderModel } from "./errors";
import { loadModels } from "./models";
import { createLoop, type GameLoop } from "./loop";
import { buildScene, fetchScene } from "./scene";
import { World } from "./world";
import { Renderer, type CombatHud } from "./render/renderer";
import type { Light } from "./render/lighting";
import { createDebug, DEFAULT_BG_ALPHA, DEFAULT_GROUND_ALPHA } from "./debug";
import type { DropPayload, DropQuality, Entity, ModelDef, SceneLayout } from "./types";
import { makeUnit } from "./units";
import { updateUnits } from "./ai";
import { updateProjectiles, updateTransient } from "./combat";
import { spawnDrop, updateDrops } from "./loot";
import { createWaveState, noteKill, updateWaves, type WaveState } from "./waves";
import { createFloaters, type Floaters } from "./floaters";
import { createAudio, type AudioHandle } from "./audio";
import { createPotions, potionsLeft, updatePotions, type PotionState } from "./potions";
import {
  heroStats,
  heroStrike,
  magicFindOf,
  monsterForWave,
  monsterStrike,
  newRng,
  oddsFor,
  QUALITY_ORDER,
  qualityColor,
  qualityLabel,
  rollLoot,
  startingCharacter,
  stageLabelFor,
  enemyFromMonster,
  type Rng,
} from "./d2-bridge";
import type { Character, Item, Quality } from "@/lib/d2/types";

export type GameHandle = {
  loop: GameLoop;
  ledger: ErrorLedger;
  world: World;
  scene: SceneLayout;
  waves: WaveState;
  stats: CombatHud;
  /** 已加载的模型表（自检/调试用：可以手动注入实体试外观） */
  models: Map<string, ModelDef>;
  /** 玩家角色（数值来源）与战利品袋（下一步做拾取/背包用） */
  character: Character;
  lootBag: Item[];
  /** 飘字池与音效（自检用：DESK_FLOAT_CHECK 往池里注飘字，DESK_SFX_CHECK 读 state / lastPeak） */
  floaters: Floaters;
  audio: AudioHandle;
  potions: PotionState;
  /** 背景不透明度（天空 / 地面两个独立旋钮），自检与调试用 */
  get bgAlpha(): number;
  get groundAlpha(): number;
  start: () => void;
  stop: () => void;
};

/**
 * 透明度：`?bgAlpha=0.5&groundAlpha=0.7` 覆盖默认值（Electron 用 DESK_BG_ALPHA / DESK_GROUND_ALPHA 注入）。
 * 游戏内用 `[` / `]` 调天空、`,` / `.` 调地面，F1 面板会显示当前值。
 */
function readAlpha(params: URLSearchParams, key: string, fallback: number): number {
  const raw = params.get(key);
  if (raw === null) return fallback;
  const v = Number(raw);
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
}

function initialAlphas(): { bgAlpha: number; groundAlpha: number } {
  if (typeof window === "undefined") return { bgAlpha: DEFAULT_BG_ALPHA, groundAlpha: DEFAULT_GROUND_ALPHA };
  const params = new URLSearchParams(window.location.search);
  return {
    bgAlpha: readAlpha(params, "bgAlpha", DEFAULT_BG_ALPHA),
    groundAlpha: readAlpha(params, "groundAlpha", DEFAULT_GROUND_ALPHA),
  };
}

/** 随机种子：固定住，自检才可复现 */
const SEED = 20261002;

/** 场景里固定的三盏灯：位置写死，纯程序光，和模型无关 */
const LIGHTS: Light[] = [
  { x: 320, y: 172, r: 210, color: "#ffca7a", intensity: 1.0, flicker: 0.05 },
  { x: 1180, y: 166, r: 230, color: "#8fb8ff", intensity: 0.85, flicker: 0.02 },
  { x: 2050, y: 174, r: 200, color: "#ffb3c8", intensity: 0.9, flicker: 0.04 },
];

const FALLBACK_SCENE: SceneLayout = {
  version: 1,
  name: "fallback",
  bounds: { w: 1280, h: 260, groundY: 210 },
  layers: ["sky", "mid", "ground", "entity", "fx", "ui"],
  objects: [],
};

const MAX_LOOT_BAG = 400;

/** 飘字高度：拾取压在英雄头顶、金币压在怪头顶（两类错开）；金币飘字用金色 */
export const PICKUP_FLOAT_DY = 46;
export const GOLD_FLOAT_DY = 60;
export const GOLD_FLOAT_COLOR = "#ffd98a";
export const POTION_FLOAT_DY = 54;
export const POTION_FLOAT_COLOR = "#7affc8";

/**
 * d2 的 Quality → 内核的掉落档位（0 白板 1 魔法 2 稀有 3 暗金）。
 * 顺序就是 d2-bridge 的 QUALITY_ORDER，模型只认这个 0~3 的数字。
 */
function dropTierOf(quality: Item["quality"]): DropQuality {
  return Math.max(0, Math.min(3, QUALITY_ORDER.indexOf(quality))) as DropQuality;
}

export async function boot(canvas: HTMLCanvasElement, sceneUrl = "/scenes/chapter-1.json"): Promise<GameHandle> {
  const ledger = new ErrorLedger();
  const world = new World();

  // 1) 模型：坏的只顶替自己
  const { models, failed } = loadModels(ledger);
  if (failed.length) console.warn("[game] 模型加载失败：", failed.join(", "));

  // 2) 场景布局：取不到就空场跑，主循环照转
  const fetched = await fetchScene(sceneUrl, ledger);
  const scene = fetched ?? FALLBACK_SCENE;
  buildScene(scene, models, placeholderModel, ledger, world);

  const layerOf = (name: string) => Math.max(0, scene.layers.indexOf(name));

  // 掉落物模型：取不到就不落地（铁律：加载失败只记账，主循环照转）
  const lootModel = models.get("loot") ?? null;
  if (!lootModel) ledger.add("models", "loot", "掉落物模型缺失：装备掉落不会出现在地上");

  // 3) 玩家角色：数值全来自 d2（装备 → 生命/伤害/命中/防御/MF）
  const rng: Rng = newRng(SEED);
  const character = startingCharacter(SEED);
  const heroData = heroStats(character);
  const magicFind = magicFindOf(character);

  // 场景里 params.unit = 1 的实体就是英雄：位置/模型/手感参数来自场景，数值来自 d2
  let hero: Entity | null = null;
  for (const e of world.entities) {
    if (e.params.unit !== 1) continue;
    e.unit = makeUnit({
      team: "hero",
      kind: (e.params.kind ?? 0) > 0 ? "ranged" : "melee",
      hp: heroData.life,
      damage: heroData.damage,
      speed: e.params.speed,
      range: e.params.range,
      cdTime: e.params.cd,
      defense: heroData.defense,
      mlvl: character.level,
    });
    if (!hero) hero = e;
  }
  if (!hero) ledger.add("scene.json", sceneUrl, "场景里没有 params.unit=1 的英雄，挂机不会发生");

  // 4) 主循环：自动战斗 + 刷怪 + 掉落结算
  const renderer = new Renderer();
  // 拾取反馈：飘字池 + 音效。两个模块拿不到资源都会自己降级，绝不许影响主循环（铁律）
  const floaters = createFloaters();
  const audio = createAudio();
  // 挂机条没人点：开机就预热音频设备（Electron 侧已放开自动播放策略），
  // 否则开局第一声拾取会被设备冷启动吃掉
  audio.unlock();
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("拿不到 2d context");

  const waves = createWaveState();
  const potions = createPotions();
  const stats: CombatHud = {
    wave: 0,
    stageLabel: "",
    kills: 0,
    killsPerMin: 0,
    enemies: 0,
    heroHp: 0,
    heroMaxHp: 0,
    heroDamage: Math.round(heroData.damage),
    heroDefense: heroData.defense,
    heroAps: heroData.aps,
    heroDown: false,
    reviveIn: 0,
    odds: { unique: "-", rare: "-", magic: "-" },
    loot: { normal: 0, magic: 0, rare: 0, unique: 0 },
    lastDrop: null,
    gold: 0,
    misses: 0,
    potions: potionsLeft(potions),
  };

  let spawnSeq = 0;
  let dropSeq = 0;
  let gold = 0;
  let missTotal = 0;
  let oddsWave = -1;
  const lootBag: Item[] = [];
  const lootCount: Record<Quality, number> = { normal: 0, magic: 0, rare: 0, unique: 0 };
  let lastDrop: { text: string; color: string } | null = null;

  /** 一波 = 一个关卡：怪的数值来自 d2 的关卡表，进场点由这里决定 */
  function spawnEnemy(index: number, total: number) {
    const spec = enemyFromMonster(monsterForWave(Math.max(1, waves.wave)), index, total);
    const model: ModelDef = models.get("imp") ?? placeholderModel("imp", "missing from registry");
    // 进场点：英雄前方一点（而不是屏幕最右边）—— 2560 宽的条上从最右边走过来要 20 多秒，挂机会「干等」
    const heroX = hero && !hero.dead ? hero.pos.x : 200;
    const x = Math.min(scene.bounds.w - 24, Math.max(80, heroX + 380 + (index % 4) * 70));
    world.spawn({
      id: `enemy_${++spawnSeq}`,
      model,
      pos: { x, y: scene.bounds.groundY },
      layer: layerOf("entity"),
      layerName: "entity",
      params: { variant: spec.variant, rank: spec.rank, kindNum: spec.kind === "ranged" ? 1 : 0 },
      unit: makeUnit({
        team: "enemy",
        kind: spec.kind,
        hp: spec.hp,
        damage: spec.damage,
        speed: spec.speed,
        rank: spec.rank,
        defense: spec.defense,
        mlvl: spec.mlvl,
        spec,
      }),
    });
  }

  const aliveEnemies = () => world.entities.filter((e) => e.unit?.team === "enemy" && e.unit.hp > 0).length;

  /**
   * 击杀结算：按 d2 的 TC/picks/noDrop 抽装备，命中 d2 的 ItemRatio。
   * 金币立刻进账；**装备改成落地**（死在哪儿掉在哪儿），拾取时才进 lootBag。
   */
  function settleKill(dead: Entity) {
    const spec = dead.unit?.spec;
    if (!spec) return;
    const roll = rollLoot(rng, spec, magicFind);
    gold += roll.gold;
    // 金币入账：在怪头顶飘一行金色数字（装备名留给拾取那一刻再飘；同格连杀会被池子合并成一个数字）
    floaters.spawn({
      x: dead.pos.x,
      y: scene.bounds.groundY - GOLD_FLOAT_DY,
      color: GOLD_FLOAT_COLOR,
      kind: "amount",
      amount: roll.gold,
      format: (n) => `＋${n} 金币`,
    });
    for (const item of roll.items) {
      if (!lootModel) continue; // 没模型就不落地，但别崩
      spawnDrop({
        world,
        model: lootModel,
        layer: layerOf("fx"),
        id: `drop_${++dropSeq}`,
        x: dead.pos.x,
        y: dead.pos.y,
        quality: dropTierOf(item.quality),
        item,
        label: `${qualityLabel(item.quality)} ${item.name}`,
        color: qualityColor(item.quality),
      });
    }
  }

  /** 拾到一件：进袋子 + 计数 + 更新「最近掉落」+ 即时反馈（头顶飘字 + 音效） */
  function collectDrop(payload: DropPayload) {
    const item = payload.item as Item;
    if (lootBag.length < MAX_LOOT_BAG) lootBag.push(item);
    lootCount[item.quality]++;
    lastDrop = { text: payload.label, color: payload.color };
    // 拾取反馈：英雄头顶飘一行品质色的名字；暗金再多一声（音效限流在 audio 内部兜）
    floaters.spawn({
      x: hero && !hero.dead ? hero.pos.x : scene.bounds.w / 2,
      y: scene.bounds.groundY - PICKUP_FLOAT_DY,
      color: payload.color,
      kind: "label",
      text: payload.label,
    });
    audio.play("pickup");
    if (payload.quality === 3) audio.play("unique");
  }

  const loop = createLoop({
    update(dt) {
      // a) 单位行为：索敌 → 走位 → 攻击（命中/伤害走 d2 的掷骰）
      const ai = updateUnits(world, dt, {
        bounds: scene.bounds,
        models,
        advance: true,
        rolls: {
          hero: (target) =>
            heroStrike(rng, character, { defense: target.unit?.defense ?? 0, mlvl: target.unit?.mlvl ?? 1 }),
          monster: (attacker, target) =>
            monsterStrike(
              rng,
              { damage: attacker.unit?.damage ?? 1, mlvl: attacker.unit?.mlvl ?? 1 },
              { defense: target.unit?.defense ?? 0, level: target.unit?.mlvl ?? 1 },
            ),
        },
      });
      missTotal += ai.misses;
      // b) 击杀 → 掉落结算（挂机游戏的正反馈就在这一行）
      for (const dead of ai.killed) settleKill(dead);
      // c) 弹道飞行与命中、瞬态特效回收
      updateProjectiles(world, dt, scene.bounds);
      updateTransient(world, dt);
      // c2) 掉落物：抛下 → 落地 → 吸附 → 拾取（挂机时不许把掉落留在身后）
      if (lootModel) {
        const dropTick = updateDrops(world, dt, {
          world,
          model: lootModel,
          groundY: scene.bounds.groundY,
          boundsW: scene.bounds.w,
          heroes: world.entities.filter((e) => e.unit?.team === "hero" && !e.dead && e.unit.hp > 0),
        });
        for (const payload of dropTick.picked) collectDrop(payload);
        if (dropTick.landed.length) audio.play("drop"); // 落地音效：一帧多件也只响一声（限流在 audio 内部）
      }
      floaters.update(dt); // c3) 飘字：推进寿命并回收（固定池，不 splice 数组）
      // d) 波次：清完就歇一会儿再来一波（一波 = 一个关卡，越往后越硬）
      updateWaves(waves, dt, {
        spawn: spawnEnemy,
        aliveEnemies: aliveEnemies(),
        onWaveStart: (w) => console.info(`[game] 第 ${w} 波开始 → ${stageLabelFor(w)}`),
      });
      if (ai.kills) noteKill(waves, ai.kills);
      // e) 把单位状态同步成模型参数（模型只认 params，不认识 Unit）
      for (const e of world.entities) {
        if (!e.unit) continue;
        e.params.hit = e.unit.hitFlash > 0 ? 1 : 0;
        e.params.down = e.unit.hp <= 0 ? 1 : 0;
      }
      world.tick(dt);

      // 自动喝药：阈值与冷却在 potions.ts，这里只加血与反馈
      if (hero && !hero.dead && hero.unit && hero.unit.hp > 0) {
        const u = hero.unit;
        const tick = updatePotions(potions, dt, u.hp, u.maxHp);
        if (tick.drank) {
          u.hp = Math.min(u.maxHp, u.hp + tick.heal);
          floaters.spawn({
            x: hero.pos.x,
            y: scene.bounds.groundY - POTION_FLOAT_DY,
            color: POTION_FLOAT_COLOR,
            kind: "label",
            text: `＋${tick.heal} 药水`,
          });
          audio.play("pickup");
        }
      }

      // f) 统计
      const h = hero && !hero.dead ? hero.unit : null;
      const wave = Math.max(1, waves.wave);
      if (oddsWave !== wave) {
        oddsWave = wave;
        stats.odds = oddsFor(monsterForWave(wave), magicFind);
      }
      stats.wave = waves.wave;
      stats.stageLabel = stageLabelFor(wave);
      stats.kills = waves.kills;
      stats.enemies = aliveEnemies();
      stats.heroHp = h?.hp ?? 0;
      stats.heroMaxHp = h?.maxHp ?? 0;
      stats.heroDown = !!h && h.hp <= 0;
      stats.reviveIn = h?.reviveIn ?? 0;
      stats.killsPerMin = loop.time > 1 ? (waves.kills / loop.time) * 60 : 0;
      stats.loot = lootCount;
      stats.lastDrop = lastDrop;
      stats.gold = gold;
      stats.misses = missTotal;
      stats.potions = potionsLeft(potions);
    },
    render(alpha, dt) {
      void alpha;
      void dt;
      const dpr = canvas.width / (canvas.clientWidth || canvas.width || 1);
      const viewW = canvas.width / dpr;
      const viewH = canvas.height / dpr;
      renderer.draw({
        ctx,
        width: viewW,
        height: viewH,
        dpr,
        camX: cameraX(viewW),
        scene,
        entities: world.byLayer(),
        lights: LIGHTS,
        ledger,
        fps: loop.fps,
        time: loop.time,
        stats,
        floaters: floaters.list,
        debug: debugRef.state,
      });
    },
  });

  /** 视口比场景宽就把场景居中，否则夹在场景范围内 */
  function cameraX(viewW: number) {
    return (scene.bounds.w - viewW) / 2;
  }

  const debugRef = createDebug(
    {
      onSpawn() {
        // 手动补一波怪，方便盯着看 AI
        const n = 3;
        const wave = Math.max(1, waves.wave);
        for (let i = 0; i < n; i++) spawnEnemy(i, n);
        console.info(`[game] 调试：手动刷了 ${n} 个敌人（第 ${wave} 波档位）`);
      },
      onToggleLighting() {
        renderer.lighting.enabled = !renderer.lighting.enabled;
        return renderer.lighting.enabled;
      },
      onTimescaleDelta(d) {
        loop.timescale = loop.timescale + d;
        return loop.timescale;
      },
      onTimescaleReset() {
        loop.timescale = 1;
        return loop.timescale;
      },
    },
    { ...initialAlphas() },
  );

  const detachKeys = debugRef.attach();

  return {
    loop,
    ledger,
    world,
    scene,
    waves,
    stats,
    models,
    character,
    lootBag,
    floaters,
    audio,
    potions,
    get bgAlpha() {
      return debugRef.state.bgAlpha;
    },
    get groundAlpha() {
      return debugRef.state.groundAlpha;
    },
    start: () => loop.start(),
    stop: () => {
      loop.stop();
      detachKeys();
    },
  };
}
