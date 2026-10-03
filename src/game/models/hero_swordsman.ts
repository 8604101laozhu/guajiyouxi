/**
 * 剑士 —— 近战英雄，全程序绘制。默认朝右（渲染层按 facing 翻转）。
 * params: hit 1=受击闪白, down 1=倒地, flash 0~1 受击强度
 */
import type { ModelDef } from "../types";

const model: ModelDef = {
  id: "hero_swordsman",
  size: { w: 26, h: 54 },
  collider: { shape: "box", w: 18, h: 50 },
  anchor: { x: 0.5, y: 1 },

  draw(ctx, t, p) {
    const down = p.down ? 1 : 0;
    const hit = p.hit ? 1 : 0;
    const bob = down ? 0 : Math.sin(t * 3.2) * 1.2;

    ctx.save();
    // 影子
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(0, 1, 13, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (down) {
      // 倒地：躺平的简化剪影
      ctx.translate(0, -8);
      ctx.rotate(-Math.PI / 2.4);
    }
    ctx.translate(0, bob);

    const armor = hit ? "#ffe9e9" : "#5b6b8c";
    const cloth = hit ? "#ffdede" : "#8c3b3b";
    const skin = hit ? "#ffffff" : "#d9a97c";
    const metal = hit ? "#ffffff" : "#c9d4e3";

    // 腿
    ctx.strokeStyle = cloth;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    const step = down ? 0 : Math.sin(t * 6.4) * 3;
    ctx.beginPath();
    ctx.moveTo(-2, -20);
    ctx.lineTo(-3 + step, -2);
    ctx.moveTo(3, -20);
    ctx.lineTo(4 - step, -2);
    ctx.stroke();

    // 躯干
    ctx.fillStyle = armor;
    ctx.beginPath();
    ctx.moveTo(-8, -20);
    ctx.lineTo(-9, -42);
    ctx.lineTo(9, -42);
    ctx.lineTo(8, -20);
    ctx.closePath();
    ctx.fill();
    // 披风/腰带
    ctx.fillStyle = cloth;
    ctx.fillRect(-9, -26, 18, 5);

    // 头 + 头盔
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(0, -48, 6.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = metal;
    ctx.beginPath();
    ctx.arc(0, -49, 7, Math.PI, Math.PI * 2);
    ctx.fill();
    // 面甲缝
    ctx.strokeStyle = "#2b3242";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-5.5, -47);
    ctx.lineTo(6.5, -47);
    ctx.stroke();

    // 剑：挥砍时由 slash 特效表现，这里只画持剑姿态
    const swing = Math.sin(t * 2.1) * 0.16;
    ctx.save();
    ctx.translate(8, -30);
    ctx.rotate(-0.5 + swing);
    ctx.fillStyle = metal;
    ctx.fillRect(0, -2, 22, 3.4);
    ctx.fillStyle = "#6b4a2a";
    ctx.fillRect(-4, -3, 5, 5.5);
    ctx.restore();

    ctx.restore();
  },
};

export default model;
