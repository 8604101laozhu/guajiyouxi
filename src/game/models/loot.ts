/**
 * 地上的掉落物 —— 一面小盾牌图标，全程序绘制，零贴图。
 * 只描述外观与数据；落地/吸附/拾取的行为全部在 loot.ts。
 *
 * params：
 *   quality  0|1|2|3 品质档位（0 白板 1 魔法 2 稀有 3 暗金），配色由它决定
 *   born     落地后秒数（可选）：用于落地瞬间的压扁回弹
 *   grounded 0|1 是否已落地（可选）：空中不浮动、不压扁
 *
 * 注意：模型不认识 d2，也不认识 DropPayload —— 品质色只用于"图标本体"，
 * 名字那行彩色标签由 render/renderer.ts 按 e.drop.color 画。
 */
import type { ModelDef } from "../types";

/** 四档品质配色（与 d2-bridge 的 qualityColor 同色系：白 / 蓝 / 黄 / 暗金） */
const PALETTES = [
  { edge: "#cfc3a6", mid: "#9c927a", dark: "#4f4a3d", shine: "#f6efdc" },
  { edge: "#6f8fff", mid: "#4a68d8", dark: "#22307a", shine: "#d6e2ff" },
  { edge: "#ffe066", mid: "#d8ad2c", dark: "#7a5c12", shine: "#fff6cc" },
  { edge: "#c7a24a", mid: "#96742c", dark: "#4d3a14", shine: "#ffe9b0" },
];

/** 落地压扁回弹的时长（秒） */
const LAND_SQUASH_TIME = 0.32;
/** 浮动振幅（像素） */
const BOB_AMPLITUDE = 2.2;

const model: ModelDef = {
  id: "loot",
  size: { w: 18, h: 18 },
  collider: { shape: "box", w: 18, h: 16 },
  anchor: { x: 0.5, y: 1 },

  draw(ctx, t, p) {
    const quality = Math.min(PALETTES.length - 1, Math.max(0, Math.round(p.quality ?? 0)));
    const pal = PALETTES[quality];
    const grounded = (p.grounded ?? 0) > 0;
    const born = Math.max(0, p.born ?? 0);

    // 落地回弹：刚落地时横向拉宽、纵向压扁，0.32 秒内回到原样
    const hit = grounded ? Math.max(0, 1 - born / LAND_SQUASH_TIME) : 0;
    const sx = 1 + hit * 0.35;
    const sy = 1 - hit * 0.3;
    // 上下浮动：落地后才浮，空中老老实实往下掉
    const bob = grounded ? Math.sin(t * 2.6) * BOB_AMPLITUDE : 0;

    ctx.save();

    // 落地阴影：浮得越高影子越淡越小（这里只做落地后的静态投影）
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(0, 0.5, 6.6, 2.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 图标本体：一面小盾牌，锚点在脚底，所以往上画
    const cy = -9.5 + bob;
    const w = 6.4;
    const h = 7.2;

    ctx.translate(0, cy);
    ctx.scale(sx, sy);

    const grad = ctx.createLinearGradient(0, -h, 0, h);
    grad.addColorStop(0, pal.shine);
    grad.addColorStop(0.45, pal.mid);
    grad.addColorStop(1, pal.dark);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-w, -h);
    ctx.lineTo(w, -h);
    ctx.lineTo(w, h * 0.1);
    ctx.quadraticCurveTo(w, h, 0, h);
    ctx.quadraticCurveTo(-w, h, -w, h * 0.1);
    ctx.closePath();
    ctx.fill();

    // 描边：品质色本身，暗金/稀有会更亮一点
    ctx.strokeStyle = pal.edge;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 高光：让 18px 的小图标也能看出是块金属
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = pal.shine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-w * 0.45, -h * 0.62);
    ctx.lineTo(w * 0.45, -h * 0.62);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 暗金档加一点闪，挂机时一眼能看见值钱的东西
    if (quality === 3) {
      const spark = 0.5 + 0.5 * Math.sin(t * 5);
      ctx.globalAlpha = 0.35 + spark * 0.45;
      ctx.fillStyle = pal.shine;
      ctx.beginPath();
      ctx.arc(w * 0.55, -h * 0.15, 1.3 + spark, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  },
};

export default model;
