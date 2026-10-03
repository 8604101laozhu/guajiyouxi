/**
 * 分层渲染：天空 → 远景 → 地面 → 实体（按 layer 排序）→ 光影 → 调试叠加。
 * 只负责画，不含任何玩法逻辑。
 */
import type { Entity, SceneLayout } from "../types";
import { ErrorLedger } from "../errors";
import { LightingPass } from "./lighting";
import type { Light } from "./lighting";
import { TOAST_SECONDS, type DebugState } from "../debug";
import { LIFE, type Floater } from "../floaters";

/** 飘字字号（px，弹出缩放之前） */
export const FLOATER_FONT_SIZE = 12;
/** 弹出时最多放大多少：scale = 1 + FLOATER_POP_SCALE * (1 - pop) */
export const FLOATER_POP_SCALE = 0.35;
/** 淡入时长（秒） */
export const FLOATER_FADE_IN = 0.12;
/** 淡出起点（寿命的比例） */
export const FLOATER_FADE_OUT_AT = 0.65;
/** 描边宽度与颜色：和掉落物标签同一套（浅色字压在壁纸上才读得清） */
export const FLOATER_STROKE_WIDTH = 3;
export const FLOATER_STROKE_COLOR = "rgba(0,0,0,0.75)";

/** 飘字透明度：开头淡入、尾段淡出，中间是实的 */
export function floaterAlpha(age: number): number {
  if (age < FLOATER_FADE_IN) return clamp01(age / FLOATER_FADE_IN);
  const fadeFrom = LIFE * FLOATER_FADE_OUT_AT;
  const tail = LIFE - fadeFrom;
  if (age > fadeFrom && tail > 0) return clamp01(1 - (age - fadeFrom) / tail);
  return 1;
}

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
}

/** "#rrggbb" + 透明度 → "rgba(...)"（背景半透明化就靠它，别写死 hex） */
function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${clamp01(alpha)})`;
}

export type CombatHud = {
  wave: number;
  /** 关卡标签，如「第1章 血污小径 1-1 普通」 */
  stageLabel: string;
  kills: number;
  killsPerMin: number;
  enemies: number;
  heroHp: number;
  heroMaxHp: number;
  heroDamage: number;
  heroDefense: number;
  heroAps: number;
  heroDown: boolean;
  reviveIn: number;
  /** 掉率文案（1/xxx），来自 d2 的 ItemRatio */
  odds: { unique: string; rare: string; magic: string };
  /** 累计掉落按稀有度计数 */
  loot: { normal: number; magic: number; rare: number; unique: number };
  /** 最近一件掉落（文字 + 颜色由 main 决定，渲染层不认识 d2） */
  lastDrop: { text: string; color: string } | null;
  gold: number;
  misses: number;
  /** 药水剩余总瓶数（4 槽合计） */
  potions: number;
};

export type RenderContext = {
  ctx: CanvasRenderingContext2D;
  /** CSS 像素宽高（不是 canvas.width） */
  width: number;
  height: number;
  dpr: number;
  camX: number;
  scene: SceneLayout;
  entities: Entity[];
  lights: Light[];
  ledger: ErrorLedger;
  fps: number;
  time: number;
  stats: CombatHud;
  /**
   * 飘字池（floaters.list）。
   * **可选**：老的 RenderContext 字面量（含既有测试）不带它也能画，缺省当空池。
   * 文本与颜色都是调用方算好的（这里不认识 d2）。
   */
  floaters?: Floater[];
  /** 调试状态（含透明度旋钮与"刚改了什么"的提示信息） */
  debug: DebugState;
};

export class Renderer {
  readonly lighting = new LightingPass();
  draw(r: RenderContext) {
    const { ctx, width, height, scene, camX, dpr } = r;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // 背景半透明化：桌面条挂在壁纸上，天空/远山/地面都必须透出桌面
    // （参考游戏 Deskrawl 也是真透明窗口 + FakeDesktop/CombatBackground，不让游戏挡掉壁纸）
    // 天空和地面是**两个独立的旋钮**：`[`/`]` 调天空，`,`/`.` 调地面
    const bg = clamp01(r.debug.bgAlpha);
    const ground = clamp01(r.debug.groundAlpha);
    this.sky(ctx, width, height, r.time, bg, scene.bounds.groundY);
    this.hills(ctx, width, height, camX, r.time, bg, scene.bounds.groundY);
    this.ground(ctx, width, height, scene, camX, ground);
    ctx.globalAlpha = 1;
    if (r.debug.showGrid) this.grid(ctx, width, height, camX, scene);

    for (const e of r.entities) this.entity(ctx, e, camX, r.time);

    this.lighting.draw(ctx, width, height, dpr, camX, r.lights, r.time);

    // 掉落物标签、血条、飘字与战斗 HUD 画在光影之后：读得清，不受夜里压暗影响
    this.dropLabels(ctx, r);
    this.bars(ctx, r);
    this.drawFloaters(ctx, r);
    this.combatHud(ctx, r);
    if (r.debug.showColliders) this.colliders(ctx, r);
    this.vignette(ctx, width, height, clamp01(r.debug.bgAlpha));
    this.hud(ctx, r);
    this.toast(ctx, r);
  }

  /**
   * 调试提示：改了设置就在画面上方弹一行字（1.8 秒后淡出）。
   * 没有这个，用户按了键只能靠 F1 面板上的百分比猜自己按对了没有。
   */
  private toast(ctx: CanvasRenderingContext2D, r: RenderContext) {
    const text = r.debug.lastAction;
    if (!text) return;
    const nowSec = (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
    const age = nowSec - r.debug.lastActionAt;
    if (age < 0 || age > TOAST_SECONDS) return;
    const fade = age > TOAST_SECONDS - 0.5 ? Math.max(0, (TOAST_SECONDS - age) / 0.5) : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.font = "13px monospace";
    ctx.textAlign = "center";
    const w = ctx.measureText(text).width + 30;
    const x = r.width / 2 - w / 2;
    ctx.fillStyle = "rgba(0,0,0,0.74)";
    ctx.fillRect(x, 10, w, 27);
    ctx.strokeStyle = "rgba(199,162,74,0.6)";
    ctx.strokeRect(x + 0.5, 10.5, w - 1, 26);
    ctx.fillStyle = "#ffe9b0";
    ctx.fillText(text, r.width / 2, 29);
    ctx.restore();
  }

  private sky(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, alpha: number, groundY: number) {
    // 用 rgba 而不是 globalAlpha：月亮/星星要在这个基础上再叠自己的透明度
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, rgba("#1b2340", alpha));
    g.addColorStop(0.55, rgba("#3b3560", alpha));
    g.addColorStop(1, rgba("#6b4a58", alpha));
    ctx.fillStyle = g;
    // 只铺到地平线：铺满整块画布的话会和地面叠成两层，地面就接近不透了
    ctx.fillRect(0, 0, w, groundY);

    // 月亮 + 星：纯程序生成，位置固定，轻微闪烁
    ctx.globalAlpha = 0.85 * alpha;
    ctx.fillStyle = "#f4e9c8";
    ctx.beginPath();
    ctx.arc(w * 0.82, h * 0.24, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    for (let i = 0; i < 40; i++) {
      const x = ((i * 137.5) % w) | 0;
      const y = ((i * 61.7) % (h * 0.45)) | 0;
      const a = 0.25 + 0.25 * Math.sin(t * 2 + i);
      ctx.globalAlpha = a * alpha;
      ctx.fillStyle = "#fff";
      ctx.fillRect(x, y, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;
  }

  private hills(ctx: CanvasRenderingContext2D, w: number, h: number, camX: number, t: number, alpha: number, groundY: number) {
    const layers = [
      { p: 0.18, c: "#241f3a", off: 0, amp: 42 },
      { p: 0.34, c: "#1d2136", off: 120, amp: 62 },
    ];
    for (const l of layers) {
      ctx.fillStyle = rgba(l.c, alpha * 0.7); // 叠在天空上：太实会把壁纸压掉
      ctx.beginPath();
      // 只填到地平线为止：填到画布底部会和地面叠两层，透明度累加到接近不透明
      ctx.moveTo(0, groundY);
      const base = h * 0.72;
      for (let x = 0; x <= w; x += 16) {
        const wx = (x + camX * l.p + l.off) * 0.004;
        const y = base - Math.sin(wx) * l.amp - Math.sin(wx * 2.3 + 1.2) * l.amp * 0.4 + Math.sin(t * 0.2 + l.off) * 2;
        ctx.lineTo(x, Math.min(groundY, y));
      }
      ctx.lineTo(w, groundY);
      ctx.closePath();
      ctx.fill();
    }
  }

  private ground(ctx: CanvasRenderingContext2D, w: number, h: number, scene: SceneLayout, camX: number, alpha: number) {
    const gy = scene.bounds.groundY;
    const g = ctx.createLinearGradient(0, gy, 0, h);
    g.addColorStop(0, rgba("#3a2b30", alpha));
    g.addColorStop(1, rgba("#141018", alpha));
    ctx.fillStyle = g;
    ctx.fillRect(0, gy, w, h - gy);
    ctx.strokeStyle = "rgba(255,214,150,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, gy + 0.5);
    ctx.lineTo(w, gy + 0.5);
    ctx.stroke();

    // 地面刻度：每 64 世界像素一根，顺便当"世界在滚"的视觉参考
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    for (let x = Math.floor(camX / 64) * 64; x < camX + w + 64; x += 64) {
      const sx = x - camX;
      ctx.beginPath();
      ctx.moveTo(sx, gy);
      ctx.lineTo(sx - 18, h);
      ctx.stroke();
    }
  }

  private grid(ctx: CanvasRenderingContext2D, w: number, h: number, camX: number, scene: SceneLayout) {
    ctx.strokeStyle = "rgba(0,255,200,0.14)";
    ctx.lineWidth = 1;
    for (let x = Math.floor(camX / 64) * 64; x < camX + w + 64; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x - camX, 0);
      ctx.lineTo(x - camX, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(0,255,200,0.5)";
    ctx.font = "10px monospace";
    ctx.fillText(`groundY ${scene.bounds.groundY}`, 4, scene.bounds.groundY - 4);
  }

  private entity(ctx: CanvasRenderingContext2D, e: Entity, camX: number, t: number) {
    ctx.save();
    ctx.translate(e.pos.x - camX, e.pos.y);
    if (e.rot) ctx.rotate(e.rot);
    if (e.scale !== 1) ctx.scale(e.scale, e.scale);
    // 朝左的单位：绕锚点镜像（模型一律按朝右画）
    if (e.unit && e.unit.facing === -1) ctx.scale(-1, 1);
    const anchor = e.model.anchor ?? { x: 0.5, y: 1 };
    ctx.translate(-anchor.x * e.model.size.w, -anchor.y * e.model.size.h + e.model.size.h);
    try {
      e.model.draw(ctx, e.age, e.params);
    } catch (err) {
      // 单个模型画崩了也不许带塌主循环
      ctx.fillStyle = "#ff00ff";
      ctx.fillRect(-8, -8, 16, 16);
      void err;
      void t;
    }
    ctx.restore();
  }

  /**
   * 掉落物标签：在物品上方补一行品质色的名字。
   * 文字和颜色都在 e.drop 里（DropPayload），渲染层不认识 d2，也不做任何换算。
   */
  private dropLabels(ctx: CanvasRenderingContext2D, r: RenderContext) {
    ctx.save();
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    for (const e of r.entities) {
      if (!e.drop) continue;
      const x = e.pos.x - r.camX;
      const y = e.pos.y - e.model.size.h - 14;
      // 先描一层深色边再填色：挂机条背景是壁纸透出来的，没有描边时浅色名字会糊进背景（踩过：看着像"没画"）
      ctx.strokeStyle = "rgba(0,0,0,0.75)";
      ctx.strokeText(e.drop.label, x, y);
      ctx.fillStyle = e.drop.color;
      ctx.fillText(e.drop.label, x, y);
    }
    ctx.restore();
  }

  /** 血条：英雄常驻，怪只在掉血后显示 */
  private bars(ctx: CanvasRenderingContext2D, r: RenderContext) {
    ctx.save();
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    for (const e of r.entities) {
      const u = e.unit;
      if (!u) continue;
      const isHero = u.team === "hero";
      if (!isHero && u.hp >= u.maxHp) continue;
      const w = e.model.size.w + 8;
      const x = e.pos.x - r.camX - w / 2;
      const y = e.pos.y - e.model.size.h - 9;
      const hpRatio = Math.max(0, u.hp / u.maxHp);
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(x - 1, y - 1, w + 2, 5);
      ctx.fillStyle = isHero ? "#6ee7a8" : u.rank === 2 ? "#ff6b6b" : u.rank === 1 ? "#ffb454" : "#e05f5f";
      ctx.fillRect(x, y, w * hpRatio, 3);
      if (u.hitFlash > 0) {
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillRect(x, y, w * hpRatio, 3);
      }
      if (isHero && u.hp <= 0) {
        ctx.fillStyle = "#ffd0d0";
        const left = Math.max(0, u.reviveIn ?? 0);
        ctx.fillText(`${left.toFixed(1)}s 复活`, e.pos.x - r.camX, y - 4);
      }
    }
    ctx.restore();
  }

  /**
   * 飘字：拾取到的装备名（品质色）与进账的金币数（金色）。
   * 同 `dropLabels` 的做法：先描深色边再填色 —— 挂机条背景是壁纸，没有描边时浅色字会糊进背景。
   * 弹出靠字号缩放（pop 越小字越大），淡入淡出靠 globalAlpha；只画 alive 的。
   */
  private drawFloaters(ctx: CanvasRenderingContext2D, r: RenderContext) {
    const list = r.floaters;
    if (!list || !list.length) return;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = FLOATER_STROKE_WIDTH;
    ctx.strokeStyle = FLOATER_STROKE_COLOR;
    for (const f of list) {
      if (!f.alive) continue;
      const scale = 1 + FLOATER_POP_SCALE * (1 - f.pop);
      ctx.font = `bold ${(FLOATER_FONT_SIZE * scale).toFixed(2)}px monospace`;
      ctx.globalAlpha = floaterAlpha(f.age);
      const x = f.x - r.camX;
      ctx.strokeText(f.text, x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, x, f.y);
    }
    ctx.restore();
  }

  /** 战斗 HUD：关卡 / 英雄面板 / 掉率 / 掉落计数 */
  private combatHud(ctx: CanvasRenderingContext2D, r: RenderContext) {
    const s = r.stats;
    const lines: { text: string; color: string }[] = [
      {
        text: `第 ${s.wave} 波 · ${s.stageLabel} · 敌方 ${s.enemies} · 杀 ${s.kills} (${s.killsPerMin.toFixed(0)}/min)`,
        color: "#f0ead8",
      },
      s.heroDown
        ? { text: `英雄倒下 · ${Math.max(0, s.reviveIn).toFixed(1)}s 后复活（挂机不会停）`, color: "#ff9a9a" }
        : {
            text: `英雄 ${Math.round(s.heroHp)}/${s.heroMaxHp} · 伤害 ${s.heroDamage} · 防御 ${s.heroDefense} · 攻速 ${s.heroAps} · 金币 ${s.gold}`,
            color: "#c8ffe8",
          },
      { text: `药水 ${s.potions}/20`, color: "#7affc8" },
      {
        text: `掉率 暗金 ${s.odds.unique}  稀有 ${s.odds.rare}  魔法 ${s.odds.magic}   挥空 ${s.misses}`,
        color: "#c7a24a",
      },
      {
        text: `掉落 白${s.loot.normal} 魔${s.loot.magic} 稀${s.loot.rare} 暗${s.loot.unique}`,
        color: "#8a7a5a",
      },
    ];
    if (s.lastDrop) lines.push({ text: `最近：${s.lastDrop.text}`, color: s.lastDrop.color });

    ctx.save();
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    const w = 470;
    const h = 12 + lines.length * 14;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(8, r.height - h - 10, w, h);
    ctx.strokeStyle = "rgba(199,162,74,0.35)";
    ctx.strokeRect(8.5, r.height - h - 9.5, w - 1, h - 1);
    lines.forEach((l, i) => {
      ctx.fillStyle = l.color;
      ctx.fillText(l.text, 16, r.height - h + 4 + i * 14);
    });
    ctx.restore();
  }

  private colliders(ctx: CanvasRenderingContext2D, r: RenderContext) {
    ctx.save();
    ctx.setLineDash([4, 3]);
    for (const e of r.entities) {
      const model = e.model;
      const c = model.collider ?? { shape: "box" as const, w: model.size.w, h: model.size.h };
      const w = (c.shape === "box" ? c.w : c.r * 2) * e.scale;
      const h = (c.shape === "box" ? c.h : c.r * 2) * e.scale;
      ctx.strokeStyle = e.broken ? "#ff00ff" : e.collision ? "#ff6b6b" : "#4ade80";
      ctx.lineWidth = 1;
      if (c.shape === "circle") {
        ctx.beginPath();
        ctx.arc(e.pos.x - r.camX, e.pos.y - h / 2, h / 2, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeRect(e.pos.x - r.camX - w / 2, e.pos.y - h, w, h);
      }
    }
    ctx.restore();
  }

  private vignette(ctx: CanvasRenderingContext2D, w: number, h: number, bg: number) {
    // 暗角跟着背景透明度一起减（背景透得越狠，边上越不该压黑）
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 1.1);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${(0.45 * bg).toFixed(3)})`);
    // source-atop：αo = αb。用 source-over 会往边缘**加**透明度（把壁纸压暗），
    // 桌面条挂壁纸上，边缘必须和中间一样透
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  /** 常驻 HUD：错误角标（有失败就一直是红的）+ fps */
  private hud(ctx: CanvasRenderingContext2D, r: RenderContext) {
    const { ctx: c, width, height } = r;
    c.save();
    c.font = "11px monospace";
    c.textAlign = "right";
    c.fillStyle = "rgba(255,255,255,0.45)";
    c.fillText(`${r.fps.toFixed(0)} fps`, width - 8, height - 8);

    if (r.ledger.count > 0) {
      const label = `⚠ ${r.ledger.count} 个模块失败`;
      const tw = c.measureText(label).width + 16;
      c.fillStyle = "rgba(140,0,0,0.82)";
      c.fillRect(width - tw - 8, 8, tw, 20);
      c.strokeStyle = "#ff5c5c";
      c.strokeRect(width - tw - 7.5, 8.5, tw - 1, 19);
      c.fillStyle = "#ffdada";
      c.textAlign = "center";
      c.fillText(label, width - tw / 2 - 8, 22);
    }
    c.restore();

    if (r.debug.panel) this.debugPanel(c, r);
  }

  private debugPanel(ctx: CanvasRenderingContext2D, r: RenderContext) {
    const lines = [
      `F1 调试 | 场景 ${r.scene.name} ${r.scene.bounds.w}×${r.scene.bounds.h}`,
      `实体 ${r.entities.length} | 相机 ${r.camX.toFixed(0)} | t ${r.time.toFixed(1)}s`,
      `1 碰撞盒:${r.debug.showColliders ? "开" : "关"}  2 网格:${r.debug.showGrid ? "开" : "关"}  3 光影:${this.lighting.enabled ? "开" : "关"}`,
      `↑/↓ 天空 ${(r.debug.bgAlpha * 100).toFixed(0)}%   →/← 地面 ${(r.debug.groundAlpha * 100).toFixed(0)}%   （更实/更透）`,
      `+/- 时间倍速  0 复位`,
      "",
      r.ledger.count ? `—— 失败模块 ${r.ledger.count} ——` : "—— 无失败模块 ——",
      ...r.ledger.lines().slice(0, 10),
    ];
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.62)";
    ctx.fillRect(8, 8, 520, 22 + lines.length * 15);
    ctx.strokeStyle = "rgba(120,255,200,0.35)";
    ctx.strokeRect(8.5, 8.5, 519, 21 + lines.length * 15);
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#c8ffe8";
    lines.forEach((l, i) => ctx.fillText(l, 16, 26 + i * 15));
    ctx.restore();
  }
}
