#!/usr/bin/env node
/**
 * 把 next/font/google 拉下来的字体「固化」进仓库，之后彻底不依赖外网。
 *
 * 原理：next/font/google 在有一次成功联网的编译后，会把 Google 的按 unicode-range
 * 切片好的 woff2 落到 .next/**\/static/media/，并在
 * [next]_internal_font_google_*_module_css_*.single.css 里生成对应的 @font-face。
 * 本脚本把这些块抽出来、URL 改写成 /fonts/…、文件拷进 public/fonts/，
 * 产出 src/app/fonts.css（layout.tsx 直接 import 它）。
 *
 * 什么时候重跑：想换字重/字体，或首次搭建时（那次编译必须能联网，例如挂代理）。
 *   node scripts/selfhost-fonts.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const NEXT_DIR = path.join(ROOT, ".next");
const OUT_CSS = path.join(ROOT, "src", "app", "fonts.css");
const OUT_FONTS_DIR = path.join(ROOT, "public", "fonts");

/** 从文件名里取字体 slug： [next]_internal_font_google_noto_serif_sc_71357647_… → noto-serif-sc */
function slugOf(file) {
  const m = file.match(/internal_font_google_(.+?)_[0-9a-f]{6,}/);
  return m ? m[1].replace(/_/g, "-") : "unknown";
}

/** 找 .next 下所有 next/font 生成的 css */
function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else if (/internal_font_google_.*_module_css_.*\.css$/.test(entry.name)) acc.push(p);
  }
  return acc;
}

/** 在 .next 里按 basename 找 woff2（相对路径各环境不一样，直接按名字找最稳）
 *  注意：.next 里有 symlink/junction，必须跳过，否则递归会绕圈爆栈。 */
function findMedia(fileName, acc = [], dir = NEXT_DIR, depth = 0) {
  if (depth > 8 || !fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "cache") continue;
      findMedia(fileName, acc, p, depth + 1);
    } else if (entry.name === fileName) acc.push(p);
  }
  return acc;
}

const cssFiles = walk(NEXT_DIR);
if (!cssFiles.length) {
  console.error("没找到 next/font 生成的 css。先跑一次能联通的编译（next dev / next build），再执行本脚本。");
  process.exit(1);
}

const blocks = [];
const seen = new Set();
let copied = 0;
let bytes = 0;

for (const cssFile of cssFiles) {
  const slug = slugOf(path.basename(cssFile));
  const css = fs.readFileSync(cssFile, "utf8");
  for (const m of css.matchAll(/@font-face\s*\{([\s\S]*?)\}/g)) {
    const body = m[1];
    const url = body.match(/url\(\s*"?(?:\.\.\/)?media\/([^")]+\.woff2)"?\s*\)/);
    if (!url) continue; // 只有 local() 的 fallback 块，丢掉
    const fileName = url[1];
    const key = `${slug}/${fileName}/${(body.match(/font-weight:\s*([^;]+)/) || [])[1] || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const src = findMedia(fileName)[0];
    if (!src) {
      console.warn(`跳过 ${fileName}：.next 里找不到文件`);
      continue;
    }
    const destDir = path.join(OUT_FONTS_DIR, slug);
    fs.mkdirSync(destDir, { recursive: true });
    const dest = path.join(destDir, fileName);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
      copied++;
      bytes += fs.statSync(dest).size;
    }

    const rewritten = m[0].replace(/url\(\s*"?(?:\.\.\/)?media\/[^")]+"?\s*\)/, `url("/fonts/${slug}/${fileName}")`);
    blocks.push(rewritten.replace(/[ \t]+\n/g, "\n").trim());
  }
}

if (!blocks.length) {
  console.error("没有可固化的 @font-face 块。");
  process.exit(1);
}

const header = `/* 自动生成：node scripts/selfhost-fonts.mjs —— 别手改
 * 来源：next/font/google 成功联网编译后落在 .next 里的 woff2（Google 按 unicode-range 切片）
 * 字体文件：public/fonts/<family>/  ·  共 ${blocks.length} 个 @font-face 块
 * 好处：不再依赖 fonts.googleapis.com / fonts.gstatic.com，断网也能起
 */

:root {
  /* 给 globals.css 的 @theme inline 用，替换掉原来 next/font 注入的变量 */
  --font-sans: "Noto Serif SC", "Source Han Serif SC", "Songti SC", "SimSun", ui-serif, Georgia, serif;
  --font-geist-mono: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, "Courier New", monospace;
}

`;

fs.writeFileSync(OUT_CSS, header + blocks.join("\n\n") + "\n");

const bySlug = {};
for (const b of blocks) {
  const slug = (b.match(/url\("\/fonts\/([^/]+)\//) || [])[1] || "?";
  bySlug[slug] = (bySlug[slug] || 0) + 1;
}
console.log(`@font-face 块 ${blocks.length} 个 → src/app/fonts.css`);
for (const [slug, n] of Object.entries(bySlug)) console.log(`  ${slug}: ${n} 块`);
console.log(`新拷贝 ${copied} 个文件（${(bytes / 1048576).toFixed(2)} MB）到 public/fonts/`);
