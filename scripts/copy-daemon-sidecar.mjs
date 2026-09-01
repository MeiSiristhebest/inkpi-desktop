#!/usr/bin/env node
/**
 * 将 inkpi 仓库编译好的单文件独立二进制复制为 Tauri externalBin sidecar。
 *
 * Tauri 2 的 externalBin 要求文件按构建 target triple 命名。
 * 支持环境变量 TARGET_TRIPLE，或者默认同时生成 GNU 和 MSVC 两个三元组副本。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const src = path.resolve('..', 'inkpi', 'dist-bin', 'inkpi.exe');
const outDir = path.resolve('src-tauri', 'binaries');

if (!fs.existsSync(src)) {
  console.error(
    `[copy-daemon-sidecar] 未找到编译好的 inkpi 二进制: ${src}\n` +
      `请先在 inkpi 仓库运行: pnpm build:binaries`
  );
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

const targetTriples = process.env.TARGET_TRIPLE
  ? [process.env.TARGET_TRIPLE]
  : ['x86_64-pc-windows-gnu', 'x86_64-pc-windows-msvc'];

for (const triple of targetTriples) {
  const out = path.join(outDir, `inkpi-${triple}.exe`);
  fs.copyFileSync(src, out);
  const sizeMB = (fs.statSync(out).size / 1024 / 1024).toFixed(1);
  console.log(`[copy-daemon-sidecar] 已复制 sidecar -> ${out} (${sizeMB} MB)`);
}
