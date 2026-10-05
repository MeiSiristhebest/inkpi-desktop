#!/usr/bin/env node
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const isAscii = (value) => [...value].every((character) => character.charCodeAt(0) < 128);
const projectTarget = path.resolve('src-tauri', 'target');
const env = { ...process.env };

// GNU ld opens @response files with the ANSI CRT, so a non-ASCII target directory breaks
// linking — but only when the active rustc host is windows-gnu. MSVC link.exe is UTF-16.
const hostIsGnu = (() => {
  if (process.platform !== 'win32') return false;
  const probe = spawnSync('rustc', ['-vV'], { encoding: 'utf8' });
  return probe.status === 0 && /host:\s*x86_64-pc-windows-gnu/.test(probe.stdout);
})();

if (process.platform === 'win32' && hostIsGnu && !env.CARGO_TARGET_DIR && !isAscii(projectTarget)) {
  const candidates = [
    path.join(os.tmpdir(), 'inkpi-tauri-target'),
    path.win32.join('C:\\Windows\\Temp', 'inkpi-tauri-target'),
    path.win32.join('C:\\Temp', 'inkpi-tauri-target'),
  ];
  const asciiTarget = candidates.find(isAscii);
  if (asciiTarget) {
    env.CARGO_TARGET_DIR = asciiTarget;
    console.log(`[run-tauri-build] Using ASCII Cargo target directory: ${asciiTarget}`);
  } else {
    console.warn(
      '[run-tauri-build] Could not find an ASCII Cargo target directory; the MinGW linker may reject this path.'
    );
  }
}

const command = process.platform === 'win32' ? 'tauri.cmd' : 'tauri';
const result = spawnSync(command, ['build'], {
  env,
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

if (result.error) {
  console.error(`[run-tauri-build] Failed to start ${command}: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
