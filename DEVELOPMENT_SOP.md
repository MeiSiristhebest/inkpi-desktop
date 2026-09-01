# InkPi Desktop Development Standard Operating Procedure (SOP)

This document establishes the engineering standards, architectural invariants, and workflow procedures for the InkPi Desktop repository.

---

## 🏛️ 1. Core Architectural Invariants

1. **Standalone Sidecar Daemon Isolation**:
   - The desktop wrapper packages `inkpi.exe` as an `externalBin` sidecar compiled via Bun.
   - The desktop runtime operates without a Node.js prerequisite on end-user machines.
   - IPC communication strictly uses JSON-RPC 2.0 over WebSocket (`ws://127.0.0.1:8849`).
2. **Offline-First Storage Resilience**:
   - Local state, draft saves, and graph entities persist into IndexedDB (`inkpi-desktop-db`) with automatic debounce write-back.
   - Editor states remain recoverable across application restarts even without active daemon connection.
3. **Single-Defect Atomic Focus (RFC-100)**:
   - PRs and commits must remain small, focused, and atomic. Packaged commits with unrelated multi-bug fixes are strictly prohibited.
4. **Quality Gate Thresholds**:
   - Component and core engine test coverage must strictly satisfy: Lines $\ge 85\%$, Branches $\ge 80\%$.
   - Every bug fix or feature must include dedicated Vitest unit/integration tests with `@testing-library/react`.

---

## 🚀 2. Local Development Workflow

### 1. Dependency Installation
```bash
npm install
```

### 2. Typecheck & Build
```bash
npm run build
```

### 3. Verification & Coverage Check
```bash
npm run test:coverage
```

### 4. Desktop Development Harness
```bash
# Syncs daemon sidecar and launches Tauri 2 dev runner
npm run tauri:dev
```

### 5. Desktop NSIS Release Package Build
```bash
npm run tauri:build
```

---

## 📦 3. Directory Layout Reference

- `src/core/`: Desktop editor core harness and state synchronization engine.
- `src/components/editor/`: Tiptap / Novel rich-text editor components and action bars.
- `src/plugins/living-codex/`: Entity graph engine, Aho-Corasick automaton keyword matcher, and drawer UI.
- `src/db/`: Offline-first IndexedDB storage driver with transactional integrity.
- `src-tauri/`: Tauri 2 Rust desktop wrapper, sidecar lifecycle management, and window configuration.
- `scripts/`: Build tooling, sidecar synchronization, and packaging scripts.
