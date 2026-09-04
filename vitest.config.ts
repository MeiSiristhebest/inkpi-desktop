/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    env: {
      NODE_ENV: 'test',
    },
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      include: [
        'src/db/**/*.ts',
        'src/components/editor/RichEditor.tsx',
        'src/components/editor/richEditorUtils.ts',
        'src/components/ai/**/*.tsx',
        'src/core/**/*.tsx',
        'src/plugins/living-codex/engine/**/*.ts',
      ],
      thresholds: {
        lines: 85,
        branches: 75,
        statements: 80,
        functions: 80,
      },
      reporter: ['text', 'text-summary', 'lcov'],
    },
  },
})

