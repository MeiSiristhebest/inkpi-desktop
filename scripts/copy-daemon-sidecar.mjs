#!/usr/bin/env node
/**
 * 将 inkpi 仓库编译好的单文件独立二进制复制为 Tauri externalBin sidecar。
 *
 * Tauri 2 的 externalBin 要求文件按构建 target triple 命名，
 * 本机使用 MinGW-w64 (x86_64-pc-windows-gnu) 目标，故命名为 inkpi-x86_64-pc-windows-gnu.exe。
 * 修改构建目标（如切换到 msvc）时，请同步更新下面的 TRIPLE。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const TRIPLE = 'x86_64-pc-windows-gnu';

const src = path.resolve('..', 'inkpi', 'dist-bin', 'inkpi.exe');
const outDir = path.resolve('src-tauri', 'binaries');
const out = path.join(outDir, `inkpi-${TRIPLE}.exe`);

if (!fs.existsSync(src)) {
  console.error(
    `[copy-daemon-sidecar] 未找到编译好的 inkpi 二进制: ${src}\n` +
      `请先在 inkpi 仓库运行: pnpm build:binaries`
  );
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(src, out);
const sizeMB = (fs.statSync(out).size / 1024 / 1024).toFixed(1);
console.log(`[copy-daemon-sidecar] 已复制 sidecar -> ${out} (${sizeMB} MB)`);
