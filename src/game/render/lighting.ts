/**
 * 光影 Pass：离屏 canvas 先铺"该压多黑"，再用 destination-out 把光斑位置抠亮、
 * 叠一层带颜色的辉光，最后以 **source-atop** 压回主画布 —— 亮处回来、暗处压下去。
 *
 * 为什么不是 multiply：`multiply` 的 alpha 是 `αo = αs + αb(1-αs)`，源不透明时结果恒为 1，
 * 会把背景的半透明（桌面条要透出壁纸）一次性糊成不透明。
 * `source-atop` 的 alpha 是 `αo = αb`：只作用在已有像素上，且**不动桌面的透明度**。
 *
 * 注意单位：离屏画布是设备像素（CSS 像素 × dpr），回贴时必须按 CSS 尺寸缩放，
 * 否则会被 dpr 再放大一次（光斑位置全错）。
 *
 * 以后要换 WebGL/法线光，只改这个文件。
 */
export type Light = { x: number; y: number; r: number; color: string; intensity: number; flicker: number };

/** 光斑中心最多能"抠掉"多少暗色（越接近 1 越像自发光） */
const LIGHT_REVEAL = 0.92;
/** 光斑带颜色的辉光强度（纯压暗会显得脏，给一点色偏才像灯） */
const LIGHT_TINT = 0.22;

export class LightingPass {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  enabled = true;
  /** 环境亮度 0~1，0 是全黑 */
  ambient = 0.5;

  private ensure(w: number, h: number) {
    if (!this.canvas) {
      this.canvas = document.createElement("canvas");
      this.ctx = this.canvas.getContext("2d");
    }
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    return this.ctx!;
  }

  /**
   * @param cssW/cssH 画布 CSS 尺寸（主 ctx 已经 setTransform(dpr…) 后使用的坐标系）
   */
  draw(
    target: CanvasRenderingContext2D,
    cssW: number,
    cssH: number,
    dpr: number,
    camX: number,
    lights: Light[],
    t: number,
  ) {
    if (!this.enabled) return;
    const devW = Math.max(1, Math.round(cssW * dpr));
    const devH = Math.max(1, Math.round(cssH * dpr));
    const ctx = this.ensure(devW, devH);

    // 屏外光源直接跳过（每帧都可能算，省一点）
    const visible: { x: number; y: number; r: number; color: string; intensity: number }[] = [];
    for (const l of lights) {
      const x = (l.x - camX) * dpr;
      const y = l.y * dpr;
      const rr = l.r * dpr;
      if (x < -rr || x > devW + rr) continue;
      const jitter = l.flicker ? Math.sin(t * 7.3 + l.x) * l.flicker + Math.sin(t * 17.1 + l.y) * l.flicker * 0.4 : 0;
      visible.push({ x, y, r: Math.max(4, rr * (1 + jitter)), color: l.color, intensity: Math.min(1, l.intensity) });
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, devW, devH);
    // 1) 暗色层：纯黑，alpha = 1 - 环境亮度
    ctx.fillStyle = `rgba(0,0,0,${Math.max(0, Math.min(1, 1 - this.ambient)).toFixed(3)})`;
    ctx.fillRect(0, 0, devW, devH);

    // 2) 灯把暗色抠掉（destination-out：alpha 相乘，暗处变亮）
    ctx.globalCompositeOperation = "destination-out";
    for (const l of visible) {
      const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      g.addColorStop(0, `rgba(0,0,0,${(LIGHT_REVEAL * l.intensity).toFixed(3)})`);
      g.addColorStop(0.45, `rgba(0,0,0,${(LIGHT_REVEAL * l.intensity * 0.45).toFixed(3)})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3) 再叠一层带颜色的辉光（否则只有"变亮"没有"灯的颜色"）
    ctx.globalCompositeOperation = "source-over";
    for (const l of visible) {
      const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      g.addColorStop(0, this.withAlpha(l.color, LIGHT_TINT * l.intensity));
      g.addColorStop(0.5, this.withAlpha(l.color, LIGHT_TINT * l.intensity * 0.4));
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    target.save();
    // source-atop：αo = αb —— 保住背景的半透明，桌面条才真的透出壁纸
    target.globalCompositeOperation = "source-atop";
    // 按 CSS 尺寸回贴：主 ctx 的 dpr 变换会把设备像素图正确缩回去
    target.drawImage(this.canvas!, 0, 0, cssW, cssH);
    target.restore();
  }

  private withAlpha(color: string, a: number) {
    if (color.startsWith("#") && (color.length === 7 || color.length === 4)) {
      const hex = color.length === 4 ? color.slice(1).split("").map((c) => c + c).join("") : color.slice(1);
      const n = parseInt(hex, 16);
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    }
    if (color.startsWith("rgb")) return color.replace("rgb(", "rgba(").replace(")", `,${a})`);
    return color;
  }
}
