import { defineConfig } from "vitest/config";
import path from "path";

/**
 * 去掉 shebang（`#!/usr/bin/env node`）。
 * scripts/*.mjs 都能直接执行（有 shebang），但 vite/vitest 的 SSR 变换不会剥掉它，
 * 于是 V8 看到 `#!` 直接 SyntaxError: Invalid or unexpected token ——
 * 而且报错位置会指到「import 它的那个测试文件」，很容易查错方向。
 * node 与 esbuild 自己都会剥 shebang，所以只有 vitest 这条路径会炸。
 */
const stripShebang = {
  name: "guajiyouxi:strip-shebang",
  enforce: "pre" as const,
  transform(code: string) {
    if (code.startsWith("#!")) return code.replace(/^#![^\n]*\r?\n/, "");
    return null;
  },
};

export default defineConfig({
  plugins: [stripShebang],
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
