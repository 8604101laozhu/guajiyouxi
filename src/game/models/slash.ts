/**
 * 瞬态特效：挥砍弧 / 死亡烟 / 复活金环。一张外观，用 params 切换。
 *   dir   1/-1 挥砍朝向（0 = 不用弧）
 *   death 1 → 画黑烟
 *   revive 1 → 画金环
 * ttl 由 combat.spawnFx 控制存活时间，模型只管画。
 */
import type { ModelDef } from "../types";

const model: ModelDef = {
  id: "slash",
  size: { w: 40, h: 40 },
  anchor: { x: 0.5, y: 0.5 },

  draw(ctx, t, p) {
    const ttl = p.ttl ?? 0.2;
    // 生命期内的进度：0 → 1
    const life = Math.max(0, Math.min(1, 1 - ttl / 0.4));
    const fade = 1 - life;

    if (p.death) {
      ctx.globalAlpha = 0.55 * fade;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + t * 2;
        const r = 6 + life * 16;
        ctx.fillStyle = "#2a2230";
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 0.6, -10 + Math.sin(a) * r * 0.4 - life * 6, 3 + fade * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      return;
    }

    if (p.revive) {
      ctx.globalAlpha = 0.9 * fade;
      ctx.strokeStyle = "#ffe6a6";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(0, -4, 10 + life * 16, 5 + life * 8, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }

    // 挥砍弧
    const dir = p.dir === 0 ? 1 : p.dir;
    ctx.save();
    ctx.scale(dir, 1);
    ctx.globalAlpha = 0.85 * fade;
    ctx.strokeStyle = "#ffffff";
    ctx.lineCap = "round";
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.arc(0, 0, 16, -1.15 + life * 0.5, 0.55 + life * 0.5);
    ctx.stroke();
    ctx.globalAlpha = 0.45 * fade;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, 21, -1.05 + life * 0.5, 0.5 + life * 0.5);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  },
};

export default model;
