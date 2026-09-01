/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      include: [
        'src/db/**/*.ts',
        'src/components/editor/WriterDesk.tsx',
        'src/components/ai/**/*.tsx',
        'src/core/**/*.tsx',
        'src/plugins/living-codex/engine/**/*.ts',
      ],
      thresholds: {
        lines: 85,
        branches: 80,
        statements: 85,
        functions: 85,
      },
      reporter: ['text', 'text-summary', 'lcov'],
    },
  },
})
