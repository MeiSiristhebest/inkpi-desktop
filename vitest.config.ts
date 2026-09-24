/// <reference types="vitest" />
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
    },
  },
  test: {
    env: {
      NODE_ENV: 'test',
    },
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: [
        'src/db/**/*.ts',
        'src/domain/**/*.ts',
        'src/services/**/*.ts',
        'src/ai/**/*.ts',
        'src/components/editor/RichEditor.tsx',
        'src/components/editor/richEditorUtils.ts',
        'src/components/ai/**/*.tsx',
        'src/core/engine.tsx',
        'src/core/pluginRegistry.tsx',
        'src/core/RootErrorBoundary.tsx',
        'src/core/components/**/*.tsx',
        'src/plugins/living-codex/engine/**/*.ts',
      ],
      thresholds: {
        lines: 80,
        branches: 70,
        statements: 75,
        functions: 75,
      },
      reporter: ['text', 'text-summary', 'lcov'],
    },
  },
})

