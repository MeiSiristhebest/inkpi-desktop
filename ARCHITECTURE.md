# InkPi Desktop Technical Architecture Blueprint

This document details the system design, communication protocols, process topology, and component boundaries of **InkPi Desktop**.

---

## 🏛️ 1. Process & Topology Overview

InkPi Desktop is structured as a dual-process architecture combining a lightweight **Tauri 2 (Rust)** desktop shell and a standalone **InkPi Daemon Sidecar**:

```text
┌───────────────────────────────────────────────────────────────────────────┐
│                     InkPi Desktop App (Tauri 2 Native Window)             │
│                                                                           │
│   ┌──────────────────────────────────┐                                    │
│   │       Vite + React 19 SPA        │                                    │
│   │                                  │                                    │
│   │  • Tiptap / Novel Editor Core    │                                    │
│   │  • Living Codex (Entity Graph)   │                                    │
│   │  • Aho-Corasick Keyword Engine   │                                    │
│   │  • IndexedDB Local Persistence   │                                    │
│   └─────────────────┬────────────────┘                                    │
│                     │                                                     │
│                     │ WebSocket JSON-RPC 2.0 (ws://127.0.0.1:8849)        │
│                     ▼                                                     │
│   ┌──────────────────────────────────┐                                    │
│   │     Tauri Rust Runtime Host      │                                    │
│   │                                  │                                    │
│   │  • ExternalBin Sidecar Manager   │                                    │
│   │  • Process Lifecycle & Cleanup   │                                    │
│   │  • Native Window & System Menu   │                                    │
│   └─────────────────┬────────────────┘                                    │
│                     │                                                     │
│                     │ Child Process Spawn (inkpi.exe daemon --port 8848)  │
│                     ▼                                                     │
│   ┌──────────────────────────────────┐                                    │
│   │   InkPi Standalone Daemon        │                                    │
│   │   (Bun Single-File Binary)       │                                    │
│   │                                  │                                    │
│   │  • AgentEngine Reasoning Loop    │                                    │
│   │  • Prompt Cache & LLM Providers  │                                    │
│   │  • SQLite & Session Storage      │                                    │
│   └──────────────────────────────────┘                                    │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 2. Subsystem Architecture

### 1. Tauri 2 Desktop Shell (`src-tauri/`)
- Manages the native operating system window, menus, and DPI scaling.
- Launches `inkpi.exe` as an `externalBin` sidecar on app launch and gracefully terminates the child process on exit, ensuring zero orphaned processes and immediate port release.
- Provides fallback to developer-specified `INKPI_DAEMON_SCRIPT` for seamless local debugging.

### 2. Frontend Application SPA (`src/`)
- **Editor Desk (`src/components/editor/`)**: Built on Tiptap and Novel with custom Markdown extensions, ghost text completion, word count, and export adapters.
- **Living Codex Plugin (`src/plugins/living-codex/`)**: Dynamic worldbuilding entity graph system backed by an Aho-Corasick automaton matcher ($O(N+M)$ multi-pattern matching across rich text).
- **Offline Storage (`src/db/`)**: IndexedDB wrapper for instant offline document storage, auto-save debounce timers, and entity graph transactions.

### 3. Protocol & Client SDK
- Uses `@inkpi/protocol` for TypeBox JSON-RPC 2.0 schema validation.
- Uses `@inkpi/client` for WebSocket communication with `InkPiDaemon`.

---

## 🧩 3. Frontend Layering (Hexagonal / Ports & Adapters)

The React SPA follows a hexagonal architecture so that business logic never depends on infrastructure.

- **`src/ports/`** — abstract ports (interfaces) the application depends on: `IdGenerator`, `Clock`, `RandomSource`, `KeyValueStore`, `ConfirmDialog`, `ClipboardWriter`, `FileDownloader`, `AiGateway` (connection) + `AiAssistant` (semantic RPC: `openSession` / `suggestContinuation` / `prompt`), and the repository ports (`ProjectRepository` with per-project queries `getVolumesByProject` / `getChaptersByProject`, `ChapterRepository`, `CardRecordRepository`, `TableRecordRepository`, `FormDataRepository`, `CodexEntityRepository`, `SettingsRepository`).
- **`src/adapters/`** — the only layer permitted to touch infrastructure: the `db` IndexedDB singleton, `localStorage`, `navigator.clipboard`, `window.confirm`, `URL.createObjectURL`, and HTML rendering. Concrete implementations include `indexedDbProjectRepository`, `indexedDbCodexEntityRepository`, `indexedDbKeyValueStore`, `indexedDbSettingsRepository`, `idGenerator`, `clock`, `randomSource`, `clipboardWriter`, `confirmDialog`, `blobFileDownloader`, `inkpiDaemonGateway`, `daemonAiAssistant`, `htmlChapterRenderer`.
- **Dependency direction (enforced by `src/architecture.test.ts`)**: `components/`, `domain/`, `core/`, `hooks/`, `plugins/**/components/` may import from `ports/` and `adapters/` only. They must **never** import `db/indexedDB`, nor call `window.confirm`, `navigator.clipboard`, `URL.createObjectURL`, `Date.now()`, or `Math.random()` directly. Non-determinism is injected via `Clock` / `IdGenerator` / `RandomSource` ports.

### Editor decomposition (passive view + atomic design)
`RichEditor` is a passive view that owns no business state. Its former 32 `useState` calls are collapsed into a single `useReducer` inside `src/components/editor/hooks/useChapterEditorModel.ts`; the autosave timer is isolated in `useChapterAutosave`; the component only consumes `state` and dispatches `actions`. The large presentational blocks are extracted into `src/components/editor/organisms/` (`ChapterTree`, `EditorToolbar`, `FindReplaceBar`, `StatusFooter`, `EditorCanvas`, `GlobalSearchPopup`, `ChapterContextMenu`, `RenameChapterDialog`, `DeleteChapterDialog`), and shared modal chrome into `src/components/ui/molecules/Modal.tsx`. The component is ~334 lines (down from 1128).

### Seed data (no hardcoded IDs)
`domain/seed.ts` derives volume/chapter IDs from the injected `IdGenerator` and timestamps from `Clock`; it never hardcodes `'vol-1'` / `'ch-1'`. `RichEditor` threads the first seeded volume id into `buildSeedChapters` so every chapter always attaches to its volume.

### Domain rules live in `domain/` (not in components)
Business rules are kept as pure, environment-free functions so they are unit-testable without jsdom/IndexedDB:
- `domain/moderation/healthCheck.ts` — `findDuplicateCodes` / `findMissingDisplayNames` (extracted from `CheckTools`, review §2.3).
- `domain/chapter/chapterNaming.ts` (`composeChapterTitle`) + `domain/chapter/blankContent.ts` (`blankChapterContent`) — chapter defaults (review §1.6).
- `domain/project/projectDefaults.ts` (`defaultGenreFor`) — project genre default (review §1.6).
- `plugins/living-codex/engine/Adapters.ts` — `CodexAdapters` class replaced by pure functions; category mapping and summary formatting are now table-driven (`TAB_CATEGORY_MAP` / `SUMMARIZERS`) instead of `switch` chains (review §3.2).

## 🛡️ 4. Quality Invariants

- **Zero Node.js Runtime Requirement**: The end-user installer packages everything required.
- **High Test Coverage**: Core state logic and components maintain $\ge 85\%$ line coverage and $\ge 80\%$ branch coverage.
- **Strict Error Handling**: UI gracefully recovers if daemon is offline, falling back to local editing with IndexedDB persistence.
- **Unified Check Gate**: `npm run check` runs `tsc -b && oxlint && vitest run` in one command; CI also runs `test:coverage`. Prettier (`.prettierrc.json`) standardizes formatting via `npm run format`.
- **Architecture Guard**: `src/architecture.test.ts` fails the build on any forbidden-layer import of `db/indexedDB`, `window.confirm`, `navigator.clipboard`, `URL.createObjectURL`, `Date.now()`, or `Math.random()`.
