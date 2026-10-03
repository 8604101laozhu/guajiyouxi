/**
 * 游戏内核的公共契约。
 * 改契约 = 改这里；模型文件只依赖本文件的类型。
 */

export type Vec2 = { x: number; y: number };

/** 碰撞盒：圆 / 矩形（局部坐标，原点在锚点） */
export type Collider =
  | { shape: "circle"; r: number; ox?: number; oy?: number }
  | { shape: "box"; w: number; h: number; ox?: number; oy?: number };

/**
 * 模型 = 外观 + 数据，**不含行为**。
 * draw() 被调用时坐标系已经 translate 到锚点、并应用了 rot/scale，
 * 所以模型只管在 (0,0) 附近画自己，不用关心世界坐标。
 */
export type ModelDef = {
  id: string;
  /** 逻辑尺寸（像素，未缩放） */
  size: { w: number; h: number };
  /** 缺省用 size 推一个矩形盒 */
  collider?: Collider;
  /** 绘制原点在尺寸框内的比例，默认 [0.5, 1]（脚底居中） */
  anchor?: Vec2;
  /** t = 该实体存活秒数；p = 场景布局里给该实例的 params */
  draw(ctx: CanvasRenderingContext2D, t: number, p: Record<string, number>): void;
};

/** scene.json 里的一条对象 */
export type LayoutObject = {
  id: string;
  model: string;
  x: number;
  y: number;
  rot?: number;
  scale?: number;
  layer?: string;
  /** 静态碰撞：true 时会被玩家/子弹挡住 */
  collision?: boolean;
  params?: Record<string, number>;
};

export type SceneLayout = {
  version: number;
  name: string;
  bounds: { w: number; h: number; groundY: number };
  layers: string[];
  objects: LayoutObject[];
};

/**
 * 掉落物品质档位：0 白板 / 1 魔法 / 2 稀有 / 3 暗金。
 * 内核只认这个数字，d2 的 Quality 字符串由 d2-bridge / main 转换。
 */
export type DropQuality = 0 | 1 | 2 | 3;

/**
 * 地上那件掉落物的全部可见信息。
 * `item` 是不透明载荷：只有 main / d2-bridge 知道它到底是什么，内核保持 d2 无关。
 */
export type DropPayload = {
  /** 原始物品数据：只有 main / d2-bridge 知道它到底是什么（内核保持 d2 无关） */
  item: unknown;
  /** 已经算好的显示名（含品质前缀），渲染层直接用 */
  label: string;
  /** 品质配色，渲染层直接用 */
  color: string;
  quality: DropQuality;
};

/** 运行时实体 */
export type Entity = {
  id: string;
  modelId: string;
  model: ModelDef;
  pos: Vec2;
  rot: number;
  scale: number;
  layer: number;
  layerName: string;
  collision: boolean;
  params: Record<string, number>;
  age: number;
  dead: boolean;
  /** 加载失败被顶替成占位方块时为 true */
  broken: boolean;
  /** 战斗单位（静态物件没有；见 combat/units.ts） */
  unit?: import("./units").Unit;
  /** 掉落载荷（只有地上的掉落物有；行为见 loot.ts，画法见 models/loot.ts） */
  drop?: DropPayload;
};

/** 一个错误只需记「谁 + 为什么」，UI 自己排版 */
export type GameError = { scope: string; id: string; message: string };
