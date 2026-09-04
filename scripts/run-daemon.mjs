// 一键启动 InkPi daemon（供网页版使用：桌面版由 Tauri sidecar 自动拉起，无需手动）。
// 用法：在 inkpi-desktop 目录下 `npm run daemon`，保持终端开启即可。
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

// 当前仅随仓库附带 Windows x86_64 (GNU) 二进制；如需其它平台，在此按
// process.platform / process.arch 选择对应 sidecar 文件。
const BINARY = join(root, 'src-tauri', 'binaries', 'inkpi-x86_64-pc-windows-gnu.exe')

const child = spawn(BINARY, ['daemon'], {
  stdio: 'inherit',
  windowsHide: false,
})

console.log('InkPi daemon 启动中… 监听 ws://127.0.0.1:8849（TCP 8848）')
console.log('保持此终端开启；按 Ctrl+C 停止。')

const shutdown = (sig) => {
  console.log(`\n收到 ${sig}，正在停止 daemon…`)
  child.kill(sig)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

child.on('exit', (code) => {
  console.log(`daemon 已退出 (code=${code ?? 0})`)
  process.exit(code ?? 0)
})

child.on('error', (err) => {
  console.error('无法启动 daemon，请确认 sidecar 二进制存在：', BINARY)
  console.error(err.message)
  process.exit(1)
})
