/**
 * 模型注册表。
 *
 * 新增一个模型 = 建 models/<名字>.ts（默认导出 ModelDef）+ 在下面两处各加一行。
 * 每个模型独立校验：坏的那个变成洋红占位方块，其它照常加载。
 */
import type { ModelDef } from "../types";
import { ErrorLedger, placeholderModel, validateModel } from "../errors";

import bolt from "./bolt";
import hero_mage from "./hero_mage";
import hero_swordsman from "./hero_swordsman";
import imp from "./imp";
import loot from "./loot";
import rock from "./rock";
import slash from "./slash";
import slime from "./slime";

/** ★ 每加一个模型，只改这一行 */
const RAW_MODELS: unknown[] = [
  slime, // 装饰 / 早期样例
  hero_swordsman, // 近战英雄
  hero_mage, // 远程英雄
  imp, // 小怪（近战/远程共用外观）
  bolt, // 弹道
  slash, // 挥砍弧 / 死亡烟 / 复活环
  rock, // 静态碰撞物样例
  loot, // 地上的掉落物（品质配色 + 落地压扁）
];

/** 注册表声明的 id → 文件，用于校验 id 是否写错 */
const EXPECTED: Record<string, unknown> = {
  slime,
  hero_swordsman,
  hero_mage,
  imp,
  bolt,
  slash,
  rock,
  loot,
};

export type ModelLoadResult = { models: Map<string, ModelDef>; failed: string[] };

export function loadModels(ledger: ErrorLedger): ModelLoadResult {
  const models = new Map<string, ModelDef>();
  const failed: string[] = [];

  for (const [id, raw] of Object.entries(EXPECTED)) {
    const check = validateModel(raw, id);
    if (check.ok) {
      models.set(id, check.model);
      continue;
    }
    failed.push(id);
    ledger.add("models", id, check.why);
    models.set(id, placeholderModel(id, check.why)); // 占位，但**不**算加载成功
  }

  // 顺手报「写了文件但忘了注册」的情况
  for (const raw of RAW_MODELS) {
    const id = (raw as { id?: unknown })?.id;
    if (typeof id === "string" && !EXPECTED[id]) ledger.add("models", id, "在 RAW_MODELS 里但不在 EXPECTED 里，未加载");
  }

  return { models, failed };
}

/** 供调试面板列出所有模型 */
export function modelIds(): string[] {
  return Object.keys(EXPECTED);
}
