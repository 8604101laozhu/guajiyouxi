#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDropTree, ingestDrop, loadDropConfig } from "../src/lib/sprites/drop.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inboxRoot = path.join(repoRoot, "public", "sprites");

function args() {
  const watchMode = process.argv.includes("--watch");
  const pushFlag = process.argv.includes("--push");
  const dropArg = process.argv.find((item) => item.startsWith("--drop="));
  return { watchMode, pushFlag, dropDir: dropArg ? dropArg.slice("--drop=".length) : undefined };
}

function gitPush(copied) {
  if (!copied.length) return;
  const add = spawnSync("git", ["add", "--", "public/sprites/inbox"], { cwd: repoRoot, encoding: "utf8" });
  if (add.status !== 0) {
    console.error(add.stderr || add.stdout);
    return;
  }
  const status = spawnSync("git", ["status", "--porcelain", "--", "public/sprites/inbox"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (!status.stdout.trim()) {
    console.log("没有新的帧要提交。");
    return;
  }
  const commit = spawnSync("git", ["commit", "-m", "Add sprite frames from the local drop folder."], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (commit.status !== 0) {
    console.error(commit.stderr || commit.stdout);
    console.error("提交失败：本机 git 需要 user.name / user.email。");
    return;
  }
  const push = spawnSync("git", ["push"], { cwd: repoRoot, encoding: "utf8" });
  if (push.status !== 0) {
    console.error(push.stderr || push.stdout);
    console.error("推送失败：先在网页点 Create repo，本机 git remote 指向那个仓库。");
    return;
  }
  console.log("已推到仓库。回来跟我说「图放好了」。");
}

async function run(dropDir, push) {
  await ensureDropTree(dropDir);
  const copied = await ingestDrop(dropDir, inboxRoot);
  if (!copied.length) {
    console.log(`投放文件夹是空的：${dropDir}`);
    console.log("生成的 png 直接扔进这个文件夹就行，不用分类。");
    return copied;
  }
  for (const item of copied) {
    console.log(`${item.from} → public/sprites/${item.to}`);
  }
  if (push) gitPush(copied);
  return copied;
}

const flags = args();
const config = await loadDropConfig(repoRoot);
const dropDir = flags.dropDir || config.dropDir;
const push = flags.pushFlag || config.push;

await ensureDropTree(dropDir);
console.log(`投放文件夹：${dropDir}`);

if (flags.watchMode) {
  let timer;
  const kick = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      void run(dropDir, push).catch((error) => console.error(error));
    }, 500);
  };
  watch(dropDir, { recursive: true }, kick);
  console.log("正在监视。生成图直接扔进来就会上传" + (push ? "。" : "。加 --push 会提交到仓库。"));
  kick();
} else {
  await run(dropDir, push);
}
