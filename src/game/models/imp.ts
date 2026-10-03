/**
 * 小怪（imp）—— 近战/远程共用一张外观，用 params 区分：
 *   variant 0|1|2 配色档位
 *   rank    0|1|2 体型倍率（1 / 1.35 / 1.9），精英与首领看这个
 *   kindNum 0=近战 1=远程（远程手里多个法球）
 *   hit     1=受击闪白
 */
import type { ModelDef } from "../types";

const PALETTES = [
  { body: "#8f5a3c", dark: "#5c3524", eye: "#ffd76a" },
  { body: "#6f7f4a", dark: "#44502c", eye: "#e8ff9a" },
  { body: "#7a4a6e", dark: "#4b2b44", eye: "#ffb1e6" },
];

const model: ModelDef = {
  id: "imp",
  size: { w: 26, h: 34 },
  collider: { shape: "box", w: 20, h: 30 },
  anchor: { x: 0.5, y: 1 },

  draw(ctx, t, p) {
    const rank = Math.round(p.rank ?? 0);
    const size = [1, 1.35, 1.9][Math.max(0, Math.min(2, rank))];
    const pal = PALETTES[Math.max(0, Math.min(2, Math.round(p.variant ?? 0)))];
    const hit = p.hit ? 1 : 0;
    const ranged = (p.kindNum ?? 0) > 0;

    ctx.save();
    ctx.scale(size, size);
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(0, 1, 12, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 呼吸 + 跳跃感
    const hop = Math.abs(Math.sin(t * 4.6)) * 2.4;
    ctx.translate(0, -hop);

    const body = hit ? "#ffecec" : pal.body;
    const dark = hit ? "#ffd5d5" : pal.dark;

    // 角
    ctx.fillStyle = dark;
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx * 5, -22);
      ctx.lineTo(sx * 9, -31);
      ctx.lineTo(sx * 3, -25);
      ctx.closePath();
      ctx.fill();
    }

    // 身体（梨形）
    const g = ctx.createLinearGradient(0, -26, 0, 0);
    g.addColorStop(0, body);
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-9, -4);
    ctx.quadraticCurveTo(-12, -22, 0, -24);
    ctx.quadraticCurveTo(12, -22, 9, -4);
    ctx.quadraticCurveTo(0, 2, -9, -4);
    ctx.closePath();
    ctx.fill();

    // 腿
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-4, -3);
    ctx.lineTo(-5, 0);
    ctx.moveTo(4, -3);
    ctx.lineTo(5, 0);
    ctx.stroke();

    // 眼
    ctx.fillStyle = pal.eye;
    ctx.beginPath();
    ctx.ellipse(-3, -15, 2.1, 2.5, 0, 0, Math.PI * 2);
    ctx.ellipse(3, -15, 2.1, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1b0d0d";
    ctx.fillRect(-3.4, -15.6, 1.2, 1.6);
    ctx.fillRect(2.6, -15.6, 1.2, 1.6);

    // 尖牙
    ctx.fillStyle = "#f4f0e6";
    ctx.beginPath();
    ctx.moveTo(-2, -10);
    ctx.lineTo(-1, -7.5);
    ctx.lineTo(0, -10);
    ctx.closePath();
    ctx.fill();

    // 远程怪：手举法球
    if (ranged) {
      const glow = 0.55 + Math.sin(t * 5.5) * 0.45;
      const gg = ctx.createRadialGradient(9, -16, 0, 9, -16, 7);
      gg.addColorStop(0, `rgba(255,190,120,${glow})`);
      gg.addColorStop(1, "rgba(255,140,60,0)");
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(9, -16, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },
};

export default model;
