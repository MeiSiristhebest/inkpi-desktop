<!-- 
  Designed & Built with ❤️ by MeiSiristhebest (https://github.com/MeiSiristhebest)
  如果本项目的架构设计、工程实现或工具链对你的学习或工作有所启发，欢迎点亮右上角的 ⭐ Star！
-->
<h1 align="center">🖋️ InkPi Desktop</h1>

<p align="center">
  <b><a href="./README.md">English</a> | 简体中文</b>
</p>

> [!TIP]
> 💡 **如果本项目的架构设计、工程实现或工具链对你的学习或工作有所启发，欢迎点亮右上角的 ⭐ Star！**
> 📚 深入探索系统技术架构蓝图：[ARCHITECTURE.md](./ARCHITECTURE.md)

<p align="center">
  <b>基于 Tauri 2 + React 构建的跨平台 AI 智能写作桌面工作台</b>
</p>

<p align="center">
  <a href="https://v2.tauri.app/"><img src="https://img.shields.io/badge/Tauri-v2-blue.svg?style=flat" alt="Tauri v2" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61dafb.svg?style=flat" alt="React 19" /></a>
  <a href="https://tiptap.dev/"><img src="https://img.shields.io/badge/Tiptap-Novel-black.svg?style=flat" alt="Tiptap Novel" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat" alt="License: MIT" /></a>
</p>

<p align="center">
  <em>一个模块化、工业级的桌面创作工作台，为创作者与开发者提供高度解耦的工程原语：Tauri 2 (Rust) 原生外壳、React 19 + Tiptap / Novel 富文本编辑器、Living Codex Aho-Corasick 世界观知识图谱引擎、离线优先 IndexedDB 事务持久化，以及随包内置的 Bun 单文件 InkPi Daemon 守护进程 sidecar。</em>
</p>

---

## 📑 目录

- [💡 项目概述](#-项目概述)
  - [什么是 InkPi Desktop？](#什么是-inkpi-desktop)
  - [InkPi Desktop 不是什么](#inkpi-desktop-不是什么)
  - [架构与进程拓扑](#架构与进程拓扑)
- [✨ 核心特性](#-核心特性)
  - [1. 独立 Sidecar 守护进程隔离](#1-独立-sidecar-守护进程隔离)
  - [2. 沉浸式写作流与幽灵补全](#2-沉浸式写作流与幽灵补全)
  - [3. Living Codex 设定集图谱与 AC 自动机](#3-living-codex-设定集图谱与-ac-自动机)
  - [4. Local-First 本地离线优先 (IndexedDB)](#4-local-first-本地离线优先-indexeddb)
  - [5. 纯净进程生命周期管控与端口即时释放](#5-纯净进程生命周期管控与端口即时释放)
- [⚙️ 环境依赖](#️-环境依赖)
- [📦 安装与配置](#-安装与配置)
- [🚀 快速上手](#-快速上手)
  - [1. 统一开发指令集](#1-统一开发指令集)
  - [2. 运行全量测试与覆盖率门禁](#2-运行全量测试与覆盖率门禁)
  - [3. 桌面独立安装包打包](#3-桌面独立安装包打包)
- [🛡️ 五大绝对工程不变量](#️-五大绝对工程不变量)
- [🤝 参与贡献](#-参与贡献)
- [📜 开源许可证](#-开源许可证)
- [⭐ Star 与支持](#star-history)

---

## 💡 项目概述

### 什么是 InkPi Desktop？

InkPi Desktop 是 **InkPi** 的官方桌面工作台客户端。它将高性能的 **Vite + React 19 + Tiptap / Novel** 编辑器应用封装在轻量级 **Tauri 2 (Rust)** 容器内，通过类型安全的 WebSocket JSON-RPC 2.0 与随包内置的 **InkPi Daemon Sidecar** 守护进程通信。

### InkPi Desktop 不是什么

- **不是臃肿的 Electron 外壳**：采用 Tauri 2 和系统原生 Webview2/WebKit 构建，内存与磁盘占用极小。
- **不是依赖云端的在线编辑器**：内置完整的 Local-First IndexedDB 离线持久化引擎，即使完全断网也能顺畅起草、保存与维护世界观图谱。

### 架构与进程拓扑

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

> [!NOTE]
> **前端分层（端口与适配器）**：React SPA 采用六边形架构——`components/`、`domain/`、`core/`、`hooks/`、`plugins/**/components/` 仅依赖 `src/ports/` 抽象端口与 `src/adapters/` 适配器，绝不直接 `import` `db`、`window.confirm`、`navigator.clipboard` 或 `URL.createObjectURL`；该依赖方向由 `src/architecture.test.ts` 在构建期强制守卫。`RichEditor` 已重构为被动视图（`useChapterEditorModel` + `useChapterAutosave`），种子数据 ID 不再硬编码。详见 [ARCHITECTURE.md](./ARCHITECTURE.md)。

---

## ✨ 核心特性

### 1. 独立 Sidecar 守护进程隔离
后端守护进程由 [Bun](https://bun.sh) 编译为单个独立的二进制文件（`inkpi.exe`）。终端用户运行桌面端**完全免装 Node.js、pnpm 或额外运行时环境**。

### 2. 沉浸式写作流与幽灵补全
基于 Tiptap 与 Novel 深度定制，支持 AI 实时幽灵补全提示（`session.ghost.suggest`）、行内润色、实时字数统计与中文排版格式化。

### 3. Living Codex 设定集图谱与 AC 自动机
- $O(N+M)$ Aho-Corasick 多模式串匹配引擎，毫秒级扫描数千个世界观词条。
- 动态 1-hop 拓扑能量扩散模型与 0-1 背包 Token 预算上下文切片。
- 交互式侧边抽屉，正文写作时随动高亮并支持即时检索设定档案。

### 4. Local-First 本地离线优先 (IndexedDB)
本地状态、章节草稿与实体关联全部事务化写入浏览器 IndexedDB（`inkpi-desktop-db`），配合防抖自动保存机制，断网环境数据零丢失。

### 5. 纯净进程生命周期管控与端口即时释放
Rust 外壳负责拉起 Daemon 子进程，并在窗口关闭时严格回收进程，彻底杜绝孤儿进程与端口占用。

---

## ⚙️ 环境依赖

| 工具 | 作用 | 阶段 |
|---|---|---|
| **Node.js**: $\ge 22.0.0$ | 前端 SPA 构建与测试运行 | 开发 / CI |
| **npm** / **pnpm** | 依赖包管理 | 开发 / CI |
| **Rust (MinGW-w64 GNU / MSVC)** | Tauri 2 原生外壳编译 | 桌面打包 |
| **Bun** | 上游 Daemon 独立单文件构建 | InkPi Monorepo |

---

## 📦 安装与配置

```bash
# 1. 克隆代码仓库
git clone https://github.com/MeiSiristhebest/inkpi-desktop.git
cd inkpi-desktop

# 2. 安装项目依赖
npm install

# 3. 验证 TypeScript 构建
npm run build
```

---

## 🚀 快速上手

### 1. 统一开发指令集

| 指令 | 动作 | 示例 |
| :--- | :--- | :--- |
| `npm run dev` | 启动 Vite React SPA 本地开发服务器 | `npm run dev` |
| `npm run tauri:dev` | 同步 sidecar 并启动 Tauri 2 桌面原生调试外壳 | `npm run tauri:dev` |
| `npm run build` | 使用 `tsc -b` 进行类型检查并通过 Vite 打包 SPA | `npm run build` |
| `npm run lint` | 使用超高速 Oxlint 检查全库源码风格 | `npm run lint` |
| `npm run test` | 运行 Vitest 单元与集成测试套件 | `npm run test` |
| `npm run test:coverage` | 运行测试套件并验证 V8 覆盖率质量门禁 | `npm run test:coverage` |
| `npm run tauri:build` | 编译生成 Windows NSIS 桌面独立安装包 | `npm run tauri:build` |

### 2. 运行全量测试与覆盖率门禁

```bash
npm run test:coverage
```

### 3. 桌面独立安装包打包

```bash
npm run tauri:build
```
安装包构建产物位于：`src-tauri/target/x86_64-pc-windows-gnu/release/bundle/nsis/`。

---

## 🛡️ 五大绝对工程不变量

1. **终端用户零环境前置要求**：独立打包完整可执行文件，无需安装任何开发工具；
2. **离线优先数据完整性**：所有草稿、实体与配置均通过事务写入 IndexedDB，数据资产安全可靠；
3. **严格质量门禁（$\ge 85\%$ 行，$\ge 80\%$ 分支）**：所有代码提交均需通过严格的单测覆盖率校验；
4. **纯净进程与通信解耦**：Tauri Rust 容器与后台进程完全通过类型化 JSON-RPC 2.0 WebSocket 帧通信；
5. **供应链依赖精确锁定**：所有依赖项均严格锁定确定版本，确保可复现构建。

---

## 🤝 参与贡献

欢迎参与贡献！提交 Pull Request 前请阅读 [`CONTRIBUTING.md`](./CONTRIBUTING.md) 与 [`DEVELOPMENT_SOP.md`](./DEVELOPMENT_SOP.md)。

---

## 📜 开源许可证

本项目遵循 [MIT License](./LICENSE) 开源协议。Copyright (c) 2026 InkPi Contributors.

---

## Star History

<a href="https://www.star-history.com/?repos=MeiSiristhebest%2Finkpi-desktop&type=date&legend=bottom-right">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=MeiSiristhebest/inkpi-desktop&type=date&theme=dark&legend=bottom-right&sealed_token=fw4uQNigmISCXcdUHho6rq5smpyrxKbwy5S1ZECqDTgTqst9KXiETBJ9kH5YB-ZJJUUJSsFrdft2TQjQA8w-5khguCk8CzjEwNmr1dzKLvM7sltFy2jWfA" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=MeiSiristhebest/inkpi-desktop&type=date&legend=bottom-right&sealed_token=fw4uQNigmISCXcdUHho6rq5smpyrxKbwy5S1ZECqDTgTqst9KXiETBJ9kH5YB-ZJJUUJSsFrdft2TQjQA8w-5khguCk8CzjEwNmr1dzKLvM7sltFy2jWfA" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=MeiSiristhebest/inkpi-desktop&type=date&legend=bottom-right&sealed_token=fw4uQNigmISCXcdUHho6rq5smpyrxKbwy5S1ZECqDTgTqst9KXiETBJ9kH5YB-ZJJUUJSsFrdft2TQjQA8w-5khguCk8CzjEwNmr1dzKLvM7sltFy2jWfA" />
 </picture>
</a>

### 🤝 Contributors
<a href="https://github.com/MeiSiristhebest/inkpi-desktop/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=MeiSiristhebest/inkpi-desktop" alt="Contributors" />
</a>
