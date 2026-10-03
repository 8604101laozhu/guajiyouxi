/**
 * 场景布局：读 scene.json → 校验 → 生成实体。
 *
 * 铁律：单条坏数据只跳过它自己，绝不抛异常出去。
 */
import type { LayoutObject, ModelDef, SceneLayout } from "./types";
import { ErrorLedger } from "./errors";
import { World } from "./world";

export const DEFAULT_LAYERS = ["sky", "mid", "ground", "entity", "fx", "ui"];

type ParseResult = { scene: SceneLayout | null; errors: string[] };

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** 纯函数，方便单测：任何输入都不许 throw */
export function parseScene(raw: unknown): ParseResult {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") return { scene: null, errors: ["根节点不是对象"] };
  const r = raw as Record<string, unknown>;

  if (num(r.version, 0) !== 1) errors.push(`version 必须是 1，现在是 ${String(r.version)}`);
  const b = (r.bounds ?? {}) as Record<string, unknown>;
  const bounds = { w: num(b.w, 1920), h: num(b.h, 720), groundY: num(b.groundY, 560) };
  if (bounds.w <= 0 || bounds.h <= 0) errors.push("bounds.w/h 必须为正");
  if (bounds.groundY <= 0 || bounds.groundY >= bounds.h) errors.push(`bounds.groundY=${bounds.groundY} 不在 (0,${bounds.h}) 内`);

  const layers = Array.isArray(r.layers) && r.layers.length
    ? r.layers.filter((l): l is string => typeof l === "string")
    : DEFAULT_LAYERS;

  const out: LayoutObject[] = [];
  const rawObjects = Array.isArray(r.objects) ? r.objects : [];
  if (!Array.isArray(r.objects)) errors.push("objects 必须是数组");

  rawObjects.forEach((o, i) => {
    if (!o || typeof o !== "object") {
      errors.push(`objects[${i}] 不是对象，已跳过`);
      return;
    }
    const it = o as Record<string, unknown>;
    const id = typeof it.id === "string" && it.id ? it.id : `obj_${i}`;
    if (typeof it.model !== "string" || !it.model) {
      errors.push(`objects[${i}] (${id}) 缺 model 字段，已跳过`);
      return;
    }
    if (typeof it.x !== "number" || typeof it.y !== "number") {
      errors.push(`objects[${i}] (${id}) x/y 必须是数字，已跳过`);
      return;
    }
    const params: Record<string, number> = {};
    if (it.params && typeof it.params === "object") {
      for (const [k, v] of Object.entries(it.params as Record<string, unknown>)) {
        if (typeof v === "number" && Number.isFinite(v)) params[k] = v;
        else errors.push(`objects[${i}] (${id}) params.${k} 不是数字，已忽略该参数`);
      }
    }
    if (it.layer !== undefined && typeof it.layer !== "string") errors.push(`objects[${i}] (${id}) layer 不是字符串，用默认层`);
    if (it.collision !== undefined && typeof it.collision !== "boolean") errors.push(`objects[${i}] (${id}) collision 不是布尔，按 false`);

    out.push({
      id,
      model: it.model,
      x: it.x,
      y: it.y,
      rot: num(it.rot, 0),
      scale: num(it.scale, 1),
      layer: typeof it.layer === "string" ? it.layer : "entity",
      collision: it.collision === true,
      params,
    });
  });

  const scene: SceneLayout = { version: 1, name: typeof r.name === "string" ? r.name : "untitled", bounds, layers, objects: out };
  return { scene, errors };
}

/** 从网上取 scene.json；取不到就返回 null（主程序继续跑空场景） */
export async function fetchScene(url: string, ledger: ErrorLedger): Promise<SceneLayout | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    const { scene, errors } = parseScene(raw);
    // 每条解析错误单独记（id 带序号，否则会被账本按 (scope,id) 去重合并掉）
    errors.forEach((e, i) => ledger.add("scene.json", `${url}#${i}`, e));
    if (!scene) ledger.add("scene.json", url, "解析失败，场景为空");
    return scene;
  } catch (err) {
    ledger.add("scene.json", url, err instanceof Error ? err.message : String(err));
    return null;
  }
}

/** 把布局灌进世界：模型缺失 → 占位方块顶替 + 记账 */
export function buildScene(
  scene: SceneLayout,
  models: Map<string, ModelDef>,
  placeholder: (id: string, why: string) => ModelDef,
  ledger: ErrorLedger,
  world: World,
): { staticColliders: number } {
  let colliders = 0;
  for (const o of scene.objects) {
    const model = models.get(o.model);
    if (!model) {
      ledger.add("scene.json", o.id, `引用了不存在的模型 "${o.model}"，已用占位方块顶替`);
      world.spawn({
        id: o.id,
        model: placeholder(o.model, "missing from registry"),
        pos: { x: o.x, y: o.y },
        layer: scene.layers.indexOf(o.layer ?? "entity"),
        layerName: o.layer,
        rot: o.rot,
        scale: o.scale,
        collision: o.collision,
        params: o.params,
        broken: true,
      });
      continue;
    }
    if (o.layer && !scene.layers.includes(o.layer)) {
      ledger.add("scene.json", o.id, `layer "${o.layer}" 不在 layers 里，按 entity 处理`);
    }
    if (o.collision) colliders++;
    world.spawn({
      id: o.id,
      model,
      pos: { x: o.x, y: o.y },
      layer: Math.max(0, scene.layers.indexOf(o.layer ?? "entity")),
      layerName: o.layer,
      rot: o.rot,
      scale: o.scale,
      collision: o.collision,
      params: o.params,
    });
  }
  return { staticColliders: colliders };
}
