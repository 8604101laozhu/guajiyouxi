#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- Electron 脚本必须用 CommonJS */
/**
 * 把一张 PNG 转成 Windows 托盘/窗口要用的**多尺寸 ICO**。
 *
 * 为什么用 electron 跑而不是 node：
 *   缩放图片需要图像库，而 node 没有内置的。与其引 sharp（原生模块，跨机编译麻烦）
 *   或 png-to-ico（多一个依赖），不如用 Electron 自带的 `nativeImage` —— 它本来就能
 *   `resize()` / `crop()` / `toBitmap()`，本工程又一定装着 Electron。**零新增依赖。**
 *
 * 为什么每条目用 BMP(DIB) 而不是 PNG：
 *   ICO 容器里每个尺寸可以塞 PNG（Vista 起支持）或老式 BMP。看着 PNG 更省空间，
 *   但实测 **.NET 的 `System.Drawing.Icon` 解不出 PNG 条目**（报「参数的范围必须扩展到…的结尾」）——
 *   于是「转换脚本能不能被验证」这件事就没了手段：产物对不对只能靠肉眼在托盘上看。
 *   全用 BMP 之后，PowerShell 一行就能把每一档解回来核对，兼容性也比 PNG 条目好。
 *   代价只是文件大一点（5 档约 34KB），对图标来说无所谓。
 *
 * 为什么多尺寸：Windows 按 DPI 和显示位置自己挑最合适的一档 —— 只给一个 32×32，
 *   在 125%/150% 缩放和高 DPI 屏上会被拉抻成糊的。官方建议 Windows 用 ICO 就是这个原因。
 *
 * 用法：
 *   npm run make:tray-icon                                  # 用默认源图 drop/图标/tray.png
 *   electron scripts/make-tray-icon.cjs --src <png 路径>
 *   electron scripts/make-tray-icon.cjs --src a.png --out electron/assets/tray.ico
 *   electron scripts/make-tray-icon.cjs --sizes 16,24,32,48,64    # 自定义档位
 */
const { app, nativeImage } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const DEFAULT_SRC = path.join(ROOT, "drop", "图标", "tray.png");
const DEFAULT_OUT = path.join(ROOT, "electron", "assets", "tray.ico");
/** 16 是标准托盘；20/24 对应 125%/150% 缩放；32/48/64 给高 DPI 与任务栏预览 */
const DEFAULT_SIZES = [16, 24, 32, 48, 64];

function parseArgs(argv) {
  const out = { src: DEFAULT_SRC, out: DEFAULT_OUT, sizes: DEFAULT_SIZES };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--src") out.src = path.resolve(argv[++i]);
    else if (a === "--out") out.out = path.resolve(argv[++i]);
    else if (a === "--sizes") out.sizes = argv[++i].split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => n > 0 && n <= 256);
  }
  return out;
}

/**
 * 把一张 NativeImage 编成 ICO 里用的 BMP(DIB) 条目。
 *
 * 结构与 .bmp 文件几乎一样，只少了「BM」文件头（ICO 里靠目录项定位，不需要）：
 *   BITMAPINFOHEADER(40) + 像素(BGRA, 自下而上) + AND 掩码(1bpp)
 *
 * 两个必须踩准的点：
 *   ① `biHeight` 要写 **高度的 2 倍** —— 老规矩，这个值把 AND 掩码也算进去了。
 *   ② 像素必须 **bottom-up**，而 `nativeImage.toBitmap()` 给的是 top-down，得逐行翻过来。
 * 掩码在 32 位图里用于 1 位透明（老系统），现代系统走 alpha 通道，全 0 即可，但不能省 ——
 * 少了它整张图会错位。
 */
function toDib(img) {
  const { width: w, height: h } = img.getSize();
  const bgra = img.toBitmap(); // Electron 明确是 BGRA，正好是 DIB 要的顺序
  const stride = w * 4;
  const flipped = Buffer.alloc(bgra.length);
  for (let y = 0; y < h; y++) {
    bgra.copy(flipped, (h - 1 - y) * stride, y * stride, y * stride + stride);
  }

  const maskStride = Math.ceil(w / 32) * 4; // 1bpp 每行按 4 字节对齐
  const mask = Buffer.alloc(maskStride * h, 0);

  const ih = Buffer.alloc(40);
  ih.writeUInt32LE(40, 0); // biSize
  ih.writeInt32LE(w, 4); // biWidth
  ih.writeInt32LE(h * 2, 8); // biHeight —— 含掩码，所以是 2 倍
  ih.writeUInt16LE(1, 12); // biPlanes
  ih.writeUInt16LE(32, 14); // biBitCount
  ih.writeUInt32LE(0, 16); // biCompression = BI_RGB
  ih.writeUInt32LE(flipped.length + mask.length, 20); // biSizeImage

  return Buffer.concat([ih, flipped, mask]);
}

/**
 * 按 ICO 容器格式打包：6 字节头 + 每张 16 字节目录项 + 各自的图像数据。
 * 约定：宽高字节写 0 表示 256（一个字节装不下 256）。
 */
function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(entries.length, 4);

  let offset = 6 + entries.length * 16;
  const dirs = [];
  for (const e of entries) {
    const d = Buffer.alloc(16);
    d.writeUInt8(e.size >= 256 ? 0 : e.size, 0); // width
    d.writeUInt8(e.size >= 256 ? 0 : e.size, 1); // height
    d.writeUInt8(0, 2); // 调色板数（真彩为 0）
    d.writeUInt8(0, 3); // reserved
    d.writeUInt16LE(1, 4); // color planes
    d.writeUInt16LE(32, 6); // bits per pixel
    d.writeUInt32LE(e.data.length, 8); // 本张数据大小
    d.writeUInt32LE(offset, 12); // 本张数据偏移
    offset += e.data.length;
    dirs.push(d);
  }

  return Buffer.concat([header, ...dirs, ...entries.map((e) => e.data)]);
}

app.whenReady().then(() => {
  const opts = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(opts.src)) {
    console.error(`找不到源图：${opts.src}`);
    console.error("");
    console.error("把一张**正方形** PNG（建议 ≥ 256×256、主体居中、别太细碎）放到：");
    console.error(`  ${DEFAULT_SRC}`);
    console.error("或者用 --src 指定别处。");
    app.exit(1);
    return;
  }

  const base = nativeImage.createFromPath(opts.src);
  if (base.isEmpty()) {
    console.error(`读不出这张图（不是 PNG/JPEG，或者文件坏了）：${opts.src}`);
    app.exit(1);
    return;
  }

  const { width, height } = base.getSize();
  const square = Math.min(width, height);
  if (width !== height) {
    console.warn(`⚠ 源图是 ${width}×${height}，不是正方形 —— 按短边居中裁成正方形再缩。`);
  }
  // 先裁成正方形：非正方形直接 resize 会把图标压扁
  const cropped = width === height
    ? base
    : base.crop({
        x: Math.floor((width - square) / 2),
        y: Math.floor((height - square) / 2),
        width: square,
        height: square,
      });

  const entries = opts.sizes.map((size) => ({
    size,
    data: toDib(cropped.resize({ width: size, height: size, quality: "best" })),
  }));

  fs.mkdirSync(path.dirname(opts.out), { recursive: true });
  fs.writeFileSync(opts.out, buildIco(entries));

  console.log(`源图   : ${opts.src}  (${width}×${height}${width !== height ? " → 居中裁方" : ""})`);
  console.log(`档位   : ${opts.sizes.join(", ")}  (BMP 条目)`);
  console.log(`输出   : ${opts.out}  (${fs.statSync(opts.out).size} 字节)`);
  app.exit(0);
});
