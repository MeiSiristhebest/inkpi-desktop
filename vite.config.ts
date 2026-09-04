import { fileURLToPath } from 'node:url'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// 直接指向 inkpi monorepo 的 TS 源码，绕开 file: 依赖的陈旧快照
// (inkpi 用 pnpm isolated linker，dist 构建产物与 node_modules 拷贝可能不同步)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const inkpiRoot = path.resolve(__dirname, '../inkpi')

// https://vite.dev/config/
export default defineConfig({
  // Tauri 打包后用 file:// 加载，资源必须用相对路径
  base: './',
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@inkpi/client': path.resolve(inkpiRoot, 'packages/client/src/index.ts'),
      '@inkpi/protocol': path.resolve(inkpiRoot, 'packages/protocol/src/index.ts'),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // 代码分割：把体积大的第三方依赖拆成独立 chunk，消除 500KB 单包体积警告
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react-vendor'
          if (/[\\/]node_modules[\\/]@?tiptap|[\\/]node_modules[\\/]prosemirror-|[\\/]node_modules[\\/]tippy/.test(id)) return 'editor-vendor'
          return 'vendor'
        },
      },
    },
  },
})
