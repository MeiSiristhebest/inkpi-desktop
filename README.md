# InkPi Desktop

<p align="center">
  <strong>Cross-Platform AI-Powered Creative Writing Workstation built with Tauri 2 and React</strong>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
  <a href="https://github.com/MeiSiristhebest/inkpi-desktop"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome"></a>
  <a href="https://github.com/MeiSiristhebest/inkpi-desktop/actions"><img src="https://img.shields.io/badge/CI-passing-green.svg" alt="CI Status"></a>
  <a href="README_zh.md"><img src="https://img.shields.io/badge/Docs-%E4%B8%AD%E6%96%87-red.svg" alt="Chinese Documentation"></a>
</p>

---

## 📖 Overview

**InkPi Desktop** is the native desktop client for the InkPi creative agent workstation. Built with **Tauri 2 (Rust)** and a **Vite + React 19 (Tiptap / Novel)** single-page application, it connects via WebSocket JSON-RPC 2.0 to an embedded, standalone **InkPi Daemon Sidecar**.

```text
┌─────────────────────────────────────────────────────────┐
│  inkpi-desktop.exe (Tauri 2 Native Window)              │
│                                                         │
│   ┌────────────────────┐        ws://127.0.0.1:8849    │
│   │  Vite + React SPA   │ ───────────────────────────┐  │
│   │  (Tiptap Editor)    │                            │  │
│   └────────────────────┘                            ▼  │
│                                              ┌──────────────┐
│  Spawn externalBin sidecar on startup:       │ inkpi.exe    │
│   inkpi.exe daemon --port 8848  ──────────▶  │ (InkPiDaemon)│
│                                              │ TCP 8848     │
│                                              │ WS  8849     │
│                                              └──────────────┘
└─────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

- 🚀 **Zero-Prerequisite Sidecar Distribution**: The daemon is compiled by [Bun](https://bun.sh) into a single standalone binary `inkpi.exe`. **No Node.js or global runtime required on client machines**.
- ✍️ **Intelligent Flow Editor**: Built on Tiptap & Novel, featuring real-time AI ghost text completions, inline drafting, and markdown exports.
- 🧠 **Living Codex Entity Graph**: Worldbuilding knowledge graph with an $O(N+M)$ Aho-Corasick automaton keyword matcher for instant entity drawers and relationship tracking.
- 💾 **Offline-First Resilience**: IndexedDB transactional storage with debounced auto-save ensures uninterrupted writing even when offline.
- 🛡️ **Clean Process Lifecycle**: Tauri cleans up the daemon child process on exit with zero dangling processes or port leaks.

---

## 📦 Project Layout

```text
inkpi-desktop/
├── src/                          # React 19 Frontend SPA
│   ├── components/editor/        # Rich text editor & toolbar
│   ├── plugins/living-codex/     # Knowledge graph & Aho-Corasick engine
│   ├── db/                       # IndexedDB persistence layer
│   └── core/                     # State engine & sync coordinator
├── src-tauri/                    # Tauri 2 Desktop Shell (Rust)
│   ├── src/main.rs               # Window & sidecar lifecycle management
│   ├── tauri.conf.json           # externalBin & bundle resource config
│   └── dlls/                     # Bundled runtime DLL snapshots
├── scripts/                      # Build & sidecar sync automation
├── .github/                      # CI/CD workflows and issue/PR templates
├── ARCHITECTURE.md               # Detailed architectural blueprint
├── DEVELOPMENT_SOP.md            # Development standard operating procedure
└── package.json                  # Package configuration & scripts
```

---

## 🛠️ Getting Started

### Prerequisites

| Tool | Purpose | Phase |
|---|---|---|
| Node.js 22+ & npm | Frontend SPA build & test scripts | Dev / Build |
| Rust (MinGW-w64 GNU) | Tauri 2 desktop shell compilation | Desktop Build |
| [Bun](https://bun.sh) | Compiling inkpi standalone binary | Upstream inkpi repo build |

### Installation & Verification

```bash
# 1. Install dependencies
npm install

# 2. Run unit test suite & coverage gate (threshold >= 85%)
npm run test:coverage

# 3. Launch desktop development harness
npm run tauri:dev
```

### Packaging & Distribution

```bash
# Compile and build Windows NSIS installer
npm run tauri:build
```

Installer output is located at: `src-tauri/target/x86_64-pc-windows-gnu/release/bundle/nsis/`.

---

## 🤝 Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) and [DEVELOPMENT_SOP.md](DEVELOPMENT_SOP.md) for contribution rules and quality invariants.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
