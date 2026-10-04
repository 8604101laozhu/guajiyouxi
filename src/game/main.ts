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
import { enemySpawnX, heroPostX } from "./stage";
import { SAVE_DEFAULTS, createSave, deserialize, serialize } from "./save";
import { computeOffline, formatDuration, type OfflineResult } from "./offline";
import { loadRaw, pickStorage, saveRaw } from "./save-store";
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
  /**
   * 本次开机的离线结算结果（没存档 / 不值得报就是 null）。
   * 自检（DESK_OFFLINE_CHECK）读它验「补发金额 / 是否被上限截断」。
   */
  offline: OfflineResult | null;
  /** 立刻把进度落盘，返回是否写成功（自检 / 退出时用） */
  persist: () => boolean;
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

/** 存档落盘间隔（秒）：同类项目都是「定时 + 页面退出/隐藏」两条腿 */
export const AUTOSAVE_SECONDS = 10;

/**
 * 「欢迎回来」这条提示在本页面最近一次的内容（30 秒内有效）。
 * 为什么需要它：开发模式下 React 会把 boot 跑两次 —— 第二次读到的存档是第一次 stop() 写回去的，
 * 离线时长≈0，于是第一次刚弹出来的提示会被第二次的空状态**直接擦掉**（用户根本看不到）。
 * 奖励只在真正算出来的那一次发（不会重复给），这里只管「别把提示擦掉」。
 */
let pendingBanner: { text: string; gold: number; at: number } | null = null;

/**
 * @param opts.fresh 忽略上次的存档（自检/冒烟用：保证每个探针从干净状态开始）
 */
export async function boot(
  canvas: HTMLCanvasElement,
  sceneUrl = "/scenes/chapter-1.json",
  opts: { fresh?: boolean } = {},
): Promise<GameHandle> {
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

  // ---- 固定舞台（见 src/game/stage.ts）----
  // 英雄钉在画面偏中间的位置、不再推图；怪从画面右侧走进来。于是交战点永远在画面中间，
  // 不会像推图那样一路往右漂。以场景里第一个英雄为桩，其余人保持和它的相对间距（法师自然落在后面）。
  const stageHeroes = world.entities.filter((e) => e.unit?.team === "hero");
  const stageAnchorX = hero ? hero.pos.x : 0;
  const stageOffsets = stageHeroes.map((e) => e.pos.x - stageAnchorX);

  /** 当前视口宽（CSS 像素）—— 桩位和刷怪点都要按屏幕算，不能写死世界坐标 */
  function viewportW(): number {
    const dpr = canvas.width / (canvas.clientWidth || canvas.width || 1);
    return canvas.width / dpr;
  }

  /** 每个英雄的桩位（世界坐标）：主英雄在画面 45%，其余保持和它的相对间距（法师落在后面） */
  function heroPosts(viewW: number): number[] {
    const postX = heroPostX(cameraX(viewW), viewW);
    return stageOffsets.map((o) => postX + o);
  }

  /**
   * 开机把英雄摆到桩位上：主循环第一帧之前它们还在场景 json 的坐标上（340 = 画面 13% 处），
   * 会闪一下再跳到中间。
   */
  function placeHeroes(viewW: number) {
    if (!(viewW > 0)) return;
    const posts = heroPosts(viewW);
    stageHeroes.forEach((e, i) => {
      e.pos.x = posts[i];
      if (e.unit) e.unit.postX = posts[i];
    });
  }

  /**
   * 每帧只更新「桩位坐标」，**不强行钉住英雄的位置** —— 走位交给 AI：
   * ① 站在射程外打你的**远程怪**，英雄要自己走过去清掉（否则这一波清不完，下一波也就开不出来）；
   * ② 场上没敌人时走回桩位，所以交战点仍然围绕画面中间，不会一路往右漂。
   */
  function updateHeroPosts(viewW: number) {
    if (!(viewW > 0)) return;
    const posts = heroPosts(viewW);
    stageHeroes.forEach((e, i) => {
      if (e.unit) e.unit.postX = posts[i];
    });
  }

  placeHeroes(viewportW());

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

  // ---- 存档 + 离线收益 ----
  // 开局读一次：进度（关卡/金币/战利品/药水）要留住，顺便结算「离开这段时间」的收益。
  // ?fresh=1 是「干净会话」：忽略存档 **且不落盘**（自检用 —— 探针不该改持久状态，
  // 否则上一项留下的存档会污染下一项，甚至把种好的存档冲掉）。
  const canSave = !opts.fresh;
  const store = pickStorage();
  const loaded = opts.fresh ? { ok: false as const, reason: "empty" as const, data: null } : deserialize(loadRaw(store));
  let offline: OfflineResult | null = null;
  /** 上次会话实测的收益速率（存档里带着），离线收益按它结算 */
  let rateGoldPerMin = 0;
  let rateKillsPerMin = 0;

  if (loaded.ok && loaded.data) {
    const d = loaded.data;
    // 关卡进度：波次和累计击杀留住（其余计时器保持全新状态，让它正常开下一波）
    waves.wave = Math.max(1, d.wave);
    waves.kills = d.kills;
    gold = d.gold;
    missTotal = d.missTotal;
    lastDrop = d.lastDrop;
    // 战利品袋：存档模块故意不认识 d2 的 Item（它只保证是对象数组），这里回铸成 Item[]
    lootBag.push(...(d.items as Item[]));
    for (const q of Object.keys(lootCount) as Quality[]) {
      if (typeof d.lootCount[q] === "number") lootCount[q] = d.lootCount[q];
    }
    // 药水槽：逐个对齐（存档里的槽位更少就保持默认）
    d.potions.forEach((n, i) => {
      if (i < potions.slots.length) potions.slots[i] = n;
    });
    rateGoldPerMin = d.goldPerMinute;
    rateKillsPerMin = d.killsPerMinute;
    offline = computeOffline({
      savedAtMs: d.now,
      nowMs: Date.now(),
      goldPerMinute: rateGoldPerMin,
      killsPerMinute: rateKillsPerMin,
      capMinutes: d.offlineCapMinutes,
    });
    if (offline.worthShowing) {
      gold += offline.gold;
      waves.kills += offline.kills;
      const line =
        `离开 ${formatDuration(offline.rawMinutes)}` +
        (offline.capped ? `（按上限 ${formatDuration(offline.minutes)} 结算）` : "") +
        ` → +${offline.gold} 金币`;
      pendingBanner = { text: line, gold: offline.gold, at: Date.now() };
      console.info(
        `[game] 离线结算：离开 ${formatDuration(offline.rawMinutes)}` +
          (offline.capped ? `（上限 ${formatDuration(offline.minutes)}）` : "") +
          ` → +${offline.gold} 金币 / +${offline.kills} 击杀`,
      );
    }
  } else if (loaded.reason !== "empty") {
    // 存档读不出来只能从头开始，但要说清楚（静默归零最讨厌）
    console.warn(`[game] 存档没读出来（${loaded.reason}），本次从头开始`);
  }

  /** 把当前进度打成存档文本（含「上次会话实测速率」，下次开机算离线收益用） */
  function currentSave(): string {
    return serialize(
      createSave({
        now: Date.now(),
        wave: waves.wave,
        kills: waves.kills,
        gold,
        missTotal,
        items: lootBag,
        lootCount,
        potions: potions.slots,
        lastDrop,
        offlineCapMinutes: SAVE_DEFAULTS.offlineCapMinutes,
        // 速率也存下来：下次开机算离线收益就靠它
        goldPerMinute: rateGoldPerMin,
        killsPerMinute: rateKillsPerMin,
      }),
    );
  }

  /**
   * 落盘。每 10 秒一次 + 页面隐藏/关闭时各一次（同类项目的通行做法）。
   * `fresh` 会话（自检/冒烟）**完全不许写盘**：探针改动了持久状态，下一项就不干净了
   * —— 这条是真踩出来的（种好的存档被页面的 pagehide 存档冲掉，自检读到的是上一项留下的旧档）。
   */
  function persist(): boolean {
    if (!canSave) return false;
    rateGoldPerMin = stats.killsPerMin > 0 ? (stats.gold / Math.max(1, loop.time)) * 60 : rateGoldPerMin;
    rateKillsPerMin = stats.killsPerMin > 0 ? stats.killsPerMin : rateKillsPerMin;
    return saveRaw(currentSave(), store);
  }

  /** 一波 = 一个关卡：怪的数值来自 d2 的关卡表，进场点由这里决定 */
  function spawnEnemy(index: number, total: number) {
    const spec = enemyFromMonster(monsterForWave(Math.max(1, waves.wave)), index, total);
    const model: ModelDef = models.get("imp") ?? placeholderModel("imp", "missing from registry");
    // 进场点：**画面右边缘**（固定舞台 —— 怪从右边走进来，交战点始终在画面中间）。
    // 注意：d2 给的移动速度很慢（远程 30 / 近战 52~70 px/s），全靠 ai.ts 的「赶路速度」把这段路
    // 压到 ~6 秒，否则挂机就是干等。
    const viewW = viewportW();
    const x = enemySpawnX({ camX: cameraX(viewW), viewW, boundsW: scene.bounds.w, index });
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
      //    固定舞台：桩位先算好（英雄打完一波会走回去）；holdPost 让它不主动追近战怪，
      //    但射程外打它的远程怪必须走过去清掉（见 ai.ts 的 outranged）
      updateHeroPosts(viewportW());
      const ai = updateUnits(world, dt, {
        bounds: scene.bounds,
        models,
        advance: false,
        holdPost: true,
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

  const autosave = canSave ? setInterval(() => persist(), AUTOSAVE_SECONDS * 1000) : null;
  const persistOnHide = () => persist();
  window.addEventListener("pagehide", persistOnHide);
  const onVisibility = () => {
    if (document.visibilityState === "hidden") persist();
  };
  document.addEventListener("visibilitychange", onVisibility);

  // 欢迎回来：弹提示条 + 英雄头顶飘一笔金币（30 秒内重新 boot 也不丢，见 pendingBanner 的注释）
  let remindTimer: ReturnType<typeof setInterval> | null = null;
  const banner = pendingBanner && Date.now() - pendingBanner.at < 30_000 ? pendingBanner : null;
  if (banner) {
    const line = banner.text;
    let left = 3;
    const show = () => {
      debugRef.state.lastAction = line;
      debugRef.state.lastActionAt = (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
      if (--left <= 0 && remindTimer) clearInterval(remindTimer);
    };
    show();
    remindTimer = setInterval(show, 2500);
    // 顺带在英雄头上飘一笔金币（和游戏里其它金币反馈同一套）
    if (hero) {
      floaters.spawn({
        x: hero.pos.x,
        y: scene.bounds.groundY - 70,
        color: "#ffd98a",
        kind: "amount",
        amount: banner.gold,
        format: (n) => `＋${n} 金币`,
      });
    }
  }

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
    /** 本次开机的离线结算结果（没存档/不值得报就是 null）—— 自检读它 */
    offline,
    /** 立刻落盘（自检/退出时用） */
    persist,
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
      if (autosave) clearInterval(autosave);
      if (remindTimer) clearInterval(remindTimer);
      window.removeEventListener("pagehide", persistOnHide);
      document.removeEventListener("visibilitychange", onVisibility);
      persist(); // 关条/热重载前存一次，别丢进度（fresh 会话里是空操作）
    },
  };
}
