/**
 * 弹道（bolt）—— 远程攻击的飞行物。
 * params: dir 1/-1 朝向，team 0=我方 1=敌方（决定配色）
 */
import type { ModelDef } from "../types";

const model: ModelDef = {
  id: "bolt",
  size: { w: 18, h: 10 },
  collider: { shape: "circle", r: 4 },
  anchor: { x: 0.5, y: 0.5 },

  draw(ctx, t, p) {
    const mine = (p.team ?? 0) === 0;
    const core = mine ? "#dfefff" : "#ffe0b0";
    const mid = mine ? "rgba(120,180,255,0.85)" : "rgba(255,150,70,0.85)";
    const tail = mine ? "rgba(60,110,255,0)" : "rgba(220,90,30,0)";
    const flick = 0.85 + Math.sin(t * 30) * 0.15;

    // 拖尾
    const g = ctx.createLinearGradient(-26, 0, 4, 0);
    g.addColorStop(0, tail);
    g.addColorStop(0.6, mid);
    g.addColorStop(1, core);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-26, 0);
    ctx.lineTo(2, -4.2 * flick);
    ctx.lineTo(4, 0);
    ctx.lineTo(2, 4.2 * flick);
    ctx.closePath();
    ctx.fill();

    // 核心
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.ellipse(2, 0, 4.6 * flick, 3.2 * flick, 0, 0, Math.PI * 2);
    ctx.fill();

    // 外发光
    const glow = ctx.createRadialGradient(2, 0, 0, 2, 0, 11);
    glow.addColorStop(0, mine ? "rgba(150,200,255,0.55)" : "rgba(255,170,90,0.55)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(2, 0, 11, 0, Math.PI * 2);
    ctx.fill();
  },
};

export default model;
