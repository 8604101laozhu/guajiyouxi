/**
 * 石头 —— 静态碰撞物样例（场景里 collision:true 的物件）。
 * params: variant 0|1|2 形状档位
 */
import type { ModelDef } from "../types";

const model: ModelDef = {
  id: "rock",
  size: { w: 56, h: 34 },
  collider: { shape: "box", w: 52, h: 30 },
  anchor: { x: 0.5, y: 1 },

  draw(ctx, t, p) {
    const v = Math.max(0, Math.min(2, Math.round(p.variant ?? 0)));
    const w = [26, 32, 22][v];
    const h = [16, 20, 13][v];
    void t;

    ctx.save();
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(0, 1, w * 1.1, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    const g = ctx.createLinearGradient(0, -h * 2, 0, 0);
    g.addColorStop(0, "#6b6675");
    g.addColorStop(1, "#2e2a35");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-w, 0);
    ctx.lineTo(-w * 0.72, -h * 1.25);
    ctx.lineTo(-w * 0.1, -h * 1.7);
    ctx.lineTo(w * 0.62, -h * 1.1);
    ctx.lineTo(w, 0);
    ctx.closePath();
    ctx.fill();

    // 顶部一点点苔
    ctx.fillStyle = "rgba(120,150,90,0.5)";
    ctx.beginPath();
    ctx.ellipse(-w * 0.1, -h * 1.6, w * 0.42, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // 裂纹
    ctx.strokeStyle = "rgba(20,18,24,0.7)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-w * 0.35, -h * 0.5);
    ctx.lineTo(-w * 0.05, -h * 0.95);
    ctx.lineTo(w * 0.3, -h * 0.4);
    ctx.stroke();
    ctx.restore();
  },
};

export default model;
