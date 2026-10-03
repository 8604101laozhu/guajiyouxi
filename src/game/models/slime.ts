/**
 * 史莱姆 —— 全程序绘制，零贴图。
 * 只描述外观与数据；掉血/移动/攻击全部由主程序负责。
 *
 * params（场景布局里可覆盖）：
 *   color 0|1|2  配色档位（0 绿 1 紫 2 蓝）
 *   big   0|1    体型倍率 1 或 1.6
 */
import type { ModelDef } from "../types";

const PALETTES = [
  { body: "#5fd07a", dark: "#2f8f52", shine: "#d9ffe4", eye: "#123122" },
  { body: "#a97ae0", dark: "#6b46a0", shine: "#efe0ff", eye: "#291543" },
  { body: "#67b6e8", dark: "#2f6f9c", shine: "#dff2ff", eye: "#13293c" },
];

const model: ModelDef = {
  id: "slime",
  size: { w: 44, h: 34 },
  collider: { shape: "circle", r: 15 },
  anchor: { x: 0.5, y: 1 },

  draw(ctx, t, p) {
    const pal = PALETTES[Math.min(PALETTES.length - 1, Math.max(0, Math.round(p.color ?? 0)))];
    const scale = p.big ? 1.6 : 1;
    const w = 22 * scale;
    const h = 17 * scale;

    // 呼吸：2.2 秒一轮挤压拉伸
    const phase = (t * (p.big ? 1.5 : 2.2)) % (Math.PI * 2);
    const squash = 1 + Math.sin(phase) * 0.08;
    const stretch = 1 - Math.sin(phase) * 0.06;

    ctx.save();
    // 影子
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(0, 1, w * 0.95, h * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 身体：半圆 + 底边，果冻感靠两段贝塞尔
    ctx.translate(0, -h * 0.06);
    ctx.scale(squash, stretch);
    const grad = ctx.createLinearGradient(0, -h * 1.9, 0, 0);
    grad.addColorStop(0, pal.shine);
    grad.addColorStop(0.45, pal.body);
    grad.addColorStop(1, pal.dark);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-w, 0);
    ctx.bezierCurveTo(-w * 1.02, -h * 1.5, -w * 0.5, -h * 2, 0, -h * 2);
    ctx.bezierCurveTo(w * 0.5, -h * 2, w * 1.02, -h * 1.5, w, 0);
    ctx.closePath();
    ctx.fill();

    // 顶部高光
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = pal.shine;
    ctx.beginPath();
    ctx.ellipse(-w * 0.32, -h * 1.5, w * 0.22, h * 0.16, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 眼睛：每 3.4 秒眨一次
    const blink = (t % 3.4) > 3.2 ? 0.15 : 1;
    ctx.fillStyle = pal.eye;
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(sx * w * 0.34, -h * 1.05, w * 0.1, h * 0.2 * blink * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // 嘴角
    ctx.strokeStyle = pal.eye;
    ctx.globalAlpha = 0.65;
    ctx.lineWidth = 1.4 * scale;
    ctx.beginPath();
    ctx.arc(0, -h * 0.62, w * 0.22, 0.25 * Math.PI, 0.75 * Math.PI);
    ctx.stroke();
    ctx.restore();
  },
};

export default model;
