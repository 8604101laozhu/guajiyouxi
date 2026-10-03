/**
 * 法师 —— 远程英雄，全程序绘制。默认朝右。
 * params: hit 1=受击闪白, down 1=倒地
 */
import type { ModelDef } from "../types";

const model: ModelDef = {
  id: "hero_mage",
  size: { w: 26, h: 54 },
  collider: { shape: "box", w: 18, h: 50 },
  anchor: { x: 0.5, y: 1 },

  draw(ctx, t, p) {
    const hit = p.hit ? 1 : 0;
    const down = p.down ? 1 : 0;
    const breathe = down ? 0 : Math.sin(t * 2.6) * 1.4;

    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(0, 1, 14, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (down) {
      ctx.translate(0, -8);
      ctx.rotate(-Math.PI / 2.4);
    }
    ctx.translate(0, breathe);

    const robe = hit ? "#ffe6f2" : "#4a3670";
    const trim = hit ? "#ffffff" : "#c7a24a";
    const skin = hit ? "#ffffff" : "#e4bd93";

    // 长袍（下摆随呼吸摆）
    const sway = down ? 0 : Math.sin(t * 1.8) * 2.2;
    ctx.fillStyle = robe;
    ctx.beginPath();
    ctx.moveTo(-9, -6);
    ctx.quadraticCurveTo(-11 + sway, -26, -7, -44);
    ctx.lineTo(7, -44);
    ctx.quadraticCurveTo(11 + sway, -26, 9, -6);
    ctx.closePath();
    ctx.fill();
    // 金边
    ctx.strokeStyle = trim;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-8.4, -8);
    ctx.quadraticCurveTo(-10 + sway, -26, -6.6, -42);
    ctx.stroke();

    // 头 + 帽檐
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(0, -48, 6.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = robe;
    ctx.beginPath();
    ctx.moveTo(-9, -50);
    ctx.lineTo(9, -50);
    ctx.lineTo(2, -58);
    ctx.lineTo(-2, -58);
    ctx.closePath();
    ctx.fill();
    // 眼睛
    ctx.fillStyle = "#241233";
    ctx.fillRect(2, -49, 2, 1.8);

    // 法杖 + 顶端光球（呼吸时明暗变化）
    ctx.strokeStyle = "#6b4a2a";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(10, -4);
    ctx.lineTo(12, -46);
    ctx.stroke();
    const glow = 0.6 + Math.sin(t * 4.2) * 0.4;
    const g = ctx.createRadialGradient(12, -48, 0, 12, -48, 9);
    g.addColorStop(0, `rgba(180,220,255,${0.95 * glow})`);
    g.addColorStop(0.5, `rgba(90,150,255,${0.5 * glow})`);
    g.addColorStop(1, "rgba(60,110,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(12, -48, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#eaf4ff";
    ctx.beginPath();
    ctx.arc(12, -48, 2.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },
};

export default model;
