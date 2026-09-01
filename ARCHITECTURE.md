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

## 🛡️ 3. Quality Invariants

- **Zero Node.js Runtime Requirement**: The end-user installer packages everything required.
- **High Test Coverage**: Core state logic and components maintain $\ge 85\%$ line coverage and $\ge 80\%$ branch coverage.
- **Strict Error Handling**: UI gracefully recovers if daemon is offline, falling back to local editing with IndexedDB persistence.
