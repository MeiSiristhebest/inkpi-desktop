<!-- 
  Designed & Built with ❤️ by MeiSiristhebest (https://github.com/MeiSiristhebest)
  If this repository helps your learning or engineering, please consider dropping a ⭐ Star!
-->
<h1 align="center">🖋️ InkPi Desktop</h1>

<p align="center">
  <b>English | <a href="./README_zh.md">简体中文</a></b>
</p>

> [!TIP]
> 💡 **If this architecture, engineering implementation, or toolchain helps your learning or workflow, please drop a ⭐ Star!**
> 📚 Explore the technical blueprint: [ARCHITECTURE.md](./ARCHITECTURE.md)

<p align="center">
  <b>Cross-Platform AI-Powered Creative Writing Workstation built with Tauri 2 and React</b>
</p>

<p align="center">
  <a href="https://v2.tauri.app/"><img src="https://img.shields.io/badge/Tauri-v2-blue.svg?style=flat" alt="Tauri v2" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61dafb.svg?style=flat" alt="React 19" /></a>
  <a href="https://tiptap.dev/"><img src="https://img.shields.io/badge/Tiptap-Novel-black.svg?style=flat" alt="Tiptap Novel" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat" alt="License: MIT" /></a>
</p>

<p align="center">
  <em>A modular, industrial-grade desktop workstation shell providing creative writers and developers with discrete engineering primitives: Tauri 2 (Rust) host, React 19 + Tiptap / Novel rich text editor, Living Codex Aho-Corasick knowledge graph engine, offline-first IndexedDB persistence, and an embedded Bun single-file InkPi Daemon sidecar.</em>
</p>

---

## 📑 Table of Contents

- [💡 Overview](#-overview)
  - [What is InkPi Desktop?](#what-is-inkpi-desktop)
  - [What InkPi Desktop is NOT](#what-inkpi-desktop-is-not)
  - [Architecture & Process Topology](#architecture--process-topology)
- [✨ Key Capabilities](#-key-capabilities)
  - [1. Standalone Sidecar Daemon Isolation](#1-standalone-sidecar-daemon-isolation)
  - [2. Intelligent Flow Editor & Ghost Text](#2-intelligent-flow-editor--ghost-text)
  - [3. Living Codex Knowledge Graph & AC Automaton](#3-living-codex-knowledge-graph--ac-automaton)
  - [4. Local-First Offline Resilience (IndexedDB)](#4-local-first-offline-resilience-indexeddb)
  - [5. Clean Process Lifecycle & Port Release](#5-clean-process-lifecycle--port-release)
- [⚙️ Requirements](#️-requirements)
- [📦 Installation & Setup](#-installation--setup)
- [🚀 Quick Start](#-quick-start)
  - [1. Unified Development Commands](#1-unified-development-commands)
  - [2. Run Complete Test Suite & Coverage Gate](#2-run-complete-test-suite--coverage-gate)
  - [3. Desktop Package Build](#3-desktop-package-build)
- [🛡️ The 5 Absolute Engineering Invariants](#️-the-5-absolute-engineering-invariants)
- [🤝 Contributing](#-contributing)
- [📜 License](#-license)
- [⭐ Star & Support](#star-history)

---

## 💡 Overview

### What is InkPi Desktop?

InkPi Desktop is the native desktop workstation client for **InkPi**. It packages a high-performance **Vite + React 19 + Tiptap / Novel** editor application inside a lightweight **Tauri 2 (Rust)** container, communicating over typed WebSocket JSON-RPC 2.0 with an embedded **InkPi Daemon Sidecar**.

### What InkPi Desktop is NOT

- **NOT a Heavy Electron Wrapper**: Built with Tauri 2 and native Webview2/WebKit, consuming minimal RAM and disk space.
- **NOT an Online-Only Cloud Editor**: Full local-first IndexedDB engine ensures that drafting, saving, and entity management work seamlessly without network connectivity.

### Architecture & Process Topology

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

## ✨ Key Capabilities

### 1. Standalone Sidecar Daemon Isolation
The backend daemon is compiled by [Bun](https://bun.sh) into a single standalone binary (`inkpi.exe`). The end-user desktop runtime **operates without Node.js, pnpm, or external runtime installations**.

### 2. Intelligent Flow Editor & Ghost Text
Built on Tiptap and Novel, featuring real-time AI ghost text suggestions (`session.ghost.suggest`), inline polish, word count metrics, and Chinese typography formatting.

### 3. Living Codex Knowledge Graph & AC Automaton
- $O(N+M)$ Aho-Corasick multi-pattern string matcher scans thousands of entity keywords in milliseconds.
- Dynamic 1-hop spreading activation topology model with 0-1 knapsack token budget context slicing.
- Interactive slide-over drawer for entity inspection and instant lore referencing.

### 4. Local-First Offline Resilience (IndexedDB)
Local state, drafts, and entity relations are transactionally persisted into browser IndexedDB (`inkpi-desktop-db`) with debounced auto-save write-back.

### 5. Clean Process Lifecycle & Port Release
Rust host orchestrates daemon spawn and guarantees immediate process cleanup upon window close, preventing orphan processes and port leaks.

---

## ⚙️ Requirements

| Tool | Purpose | Phase |
|---|---|---|
| **Node.js**: $\ge 22.0.0$ | Frontend SPA build & test execution | Dev / CI |
| **npm** / **pnpm** | Package management | Dev / CI |
| **Rust (MinGW-w64 GNU / MSVC)** | Tauri 2 native shell compilation | Packaging |
| **Bun** | Upstream daemon standalone binary build | InkPi Monorepo |

---

## 📦 Installation & Setup

```bash
# 1. Clone repository
git clone https://github.com/MeiSiristhebest/inkpi-desktop.git
cd inkpi-desktop

# 2. Install dependencies
npm install

# 3. Verify TypeScript build
npm run build
```

---

## 🚀 Quick Start

### 1. Unified Development Commands

| Command | Action | Example |
| :--- | :--- | :--- |
| `npm run dev` | Launch Vite React SPA development server | `npm run dev` |
| `npm run tauri:dev` | Sync daemon sidecar and launch Tauri 2 desktop app | `npm run tauri:dev` |
| `npm run build` | Typecheck with `tsc -b` and bundle SPA via Vite | `npm run build` |
| `npm run lint` | Run ultra-fast Oxlint across all source files | `npm run lint` |
| `npm run test` | Run Vitest unit & integration test suite | `npm run test` |
| `npm run test:coverage` | Run test suite with V8 coverage & quality thresholds | `npm run test:coverage` |
| `npm run tauri:build` | Compile and package Windows NSIS release installer | `npm run tauri:build` |

### 2. Run Complete Test Suite & Coverage Gate

```bash
npm run test:coverage
```

### 3. Desktop Package Build

```bash
npm run tauri:build
```
Installer outputs are generated into `src-tauri/target/x86_64-pc-windows-gnu/release/bundle/nsis/`.

---

## 🛡️ The 5 Absolute Engineering Invariants

1. **Zero Client Runtime Prerequisites**: The standalone executable packages everything required; end users need zero developer tooling.
2. **Offline-First Storage Integrity**: All drafts, entities, and settings persist into IndexedDB with transactional consistency.
3. **Strict Quality Gate ($\ge 85\%$ Lines, $\ge 80\%$ Branches)**: All code commits must satisfy rigorous branch and line test coverage.
4. **Clean Process Decoupling**: Tauri Rust container communicates exclusively over typed JSON-RPC 2.0 WebSocket frames.
5. **Exact Supply-Chain Pinning**: Dependencies are strictly versioned for deterministic reproducibility.

---

## 🤝 Contributing

Contributions are welcome! Please read [`CONTRIBUTING.md`](./CONTRIBUTING.md) and [`DEVELOPMENT_SOP.md`](./DEVELOPMENT_SOP.md) before submitting pull requests.

---

## 📜 License

Distributed under the [MIT License](./LICENSE). Copyright (c) 2026 InkPi Contributors.

---

## Star History

<a href="https://www.star-history.com/?repos=MeiSiristhebest%2Finkpi-desktop&type=date&legend=bottom-right">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=MeiSiristhebest/inkpi-desktop&type=date&theme=dark&legend=bottom-right" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=MeiSiristhebest/inkpi-desktop&type=date&legend=bottom-right" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=MeiSiristhebest/inkpi-desktop&type=date&legend=bottom-right" />
 </picture>
</a>

### 🤝 Contributors
<a href="https://github.com/MeiSiristhebest/inkpi-desktop/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=MeiSiristhebest/inkpi-desktop" alt="Contributors" />
</a>
