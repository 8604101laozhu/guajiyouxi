/**
 * 错误账本 + 载入失败兜底。
 *
 * 铁律：任何模块加载失败都不许中断主程序 —— 只记账 + 用占位方块顶替。
 */
import type { GameError, ModelDef } from "./types";

export class ErrorLedger {
  readonly items: GameError[] = [];

  add(scope: string, id: string, message: string) {
    // 同一个 (scope,id) 只留第一条，避免刷屏
    if (this.items.some((e) => e.scope === scope && e.id === id)) return;
    this.items.push({ scope, id, message });
  }

  get count() {
    return this.items.length;
  }

  clear() {
    this.items.length = 0;
  }

  /** 给调试面板用的一行行文本 */
  lines(): string[] {
    return this.items.map((e) => `${e.scope} · ${e.id} — ${e.message}`);
  }
}

/** 校验一个来路不明的对象是不是合法 ModelDef */
export function validateModel(raw: unknown, expectId: string): { ok: true; model: ModelDef } | { ok: false; why: string } {
  if (!raw || typeof raw !== "object") return { ok: false, why: "导出不是对象（默认导出写错？）" };
  const m = raw as Partial<ModelDef>;
  if (typeof m.id !== "string" || !m.id) return { ok: false, why: "缺少 id" };
  if (m.id !== expectId) return { ok: false, why: `id 不一致：文件是 "${m.id}"，注册表写的是 "${expectId}"` };
  if (!m.size || typeof m.size.w !== "number" || typeof m.size.h !== "number") return { ok: false, why: "size 必须是 {w:number,h:number}" };
  if (m.size.w <= 0 || m.size.h <= 0) return { ok: false, why: `size 必须是正数，现在是 ${m.size.w}×${m.size.h}` };
  if (typeof m.draw !== "function") return { ok: false, why: "缺少 draw()" };
  return { ok: true, model: m as ModelDef };
}

/** 载入失败时的替身：洋红方块 + 叉，一眼能看出是哪一条挂了 */
export function placeholderModel(id: string, why: string): ModelDef {
  return {
    id,
    size: { w: 32, h: 32 },
    collider: { shape: "box", w: 32, h: 32 },
    draw(ctx, t, p) {
      const s = 32;
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "#ff00ff";
      ctx.fillRect(-s / 2, -s, s, s);
      ctx.strokeStyle = "#1a001a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-s / 2, -s);
      ctx.lineTo(s / 2, 0);
      ctx.moveTo(s / 2, -s);
      ctx.lineTo(-s / 2, 0);
      ctx.stroke();
      ctx.fillStyle = "#1a001a";
      ctx.font = "8px monospace";
      ctx.textAlign = "center";
      ctx.fillText(id.slice(0, 10), 0, -s - 4 + Math.sin(t * 4) * 1.5);
      ctx.restore();
      void why;
      void p;
    },
  };
}
