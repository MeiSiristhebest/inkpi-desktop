# 🖋️ InkPi Desktop 桌面创作工作台

<div align="center">

**基于 Tauri 2 + React 19 + Tiptap 的新一代 AI 智能写作桌面客户端**

[English](./README.md) | [中文文档](./README_zh.md) | [开发 SOP](./DEVELOPMENT_SOP.md)

</div>

---

## 📖 项目简介

**InkPi Desktop** 是专为创作者与开发者打造的跨平台 AI 写作工作台桌面客户端。原生外壳采用 **Tauri 2 (Rust)** 构建，内置高性能 **Vite + React 19 + Tiptap / Novel** 富文本编辑器，并通过 WebSocket JSON-RPC 2.0 协议直连随包分发的 **InkPi Daemon** 独立守护进程。

无论是长篇小说创作、世界观设定集构建（Living Codex），还是 AI 行内沉浸式幽灵补全（Ghost Text），InkPi Desktop 均提供轻量、快速、零冗余的本地离线优先体验。

---

## 🏛️ 系统架构与进程拓扑

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

## ✨ 核心特性概览

| 模块名称 | 核心职责与技术实现 | 优势亮点 |
| :--- | :--- | :--- |
| **独立 Sidecar 架构** | 由 Bun 编译为独立 `inkpi.exe` 单文件，随桌面外壳分发 | **用户端完全免装 Node.js** 与第三方运行时 |
| **沉浸式 AI 写作流** | Tiptap / Novel 深度定制，支持幽灵补全（Ghost Text）与快捷排版 | 毫秒级防抖触发，行内无感续写与润色 |
| **Living Codex 设定集** | 世界观知识图谱 + $O(N+M)$ Aho-Corasick 多模关键词自动匹配 | 自动识别正文实体并唤起右侧关联抽屉与上下文切片 |
| **Local-First 本地优先** | 基于 IndexedDB (`inkpi-desktop-db`) 实现全量事务化持久存储 | 断网或离线环境下无感自动保存，毫秒级冷启动 |
| **进程生命周期管控** | Tauri Rust 主进程自动拉起并监听 Daemon 子进程生命周期 | 窗口关闭时即刻回收子进程，彻底消除孤儿进程与端口泄漏 |

---

## ⚡ 快速上手

### 依赖环境要求
- **Node.js**: $\ge 22.0.0$
- **包管理器**: `npm` 或 `pnpm`
- **Rust**: MinGW-w64 GNU 或 MSVC 目标（仅桌面打包期需要）

### 1. 源码克隆与依赖安装

```bash
# 克隆仓库
git clone https://github.com/MeiSiristhebest/inkpi-desktop.git
cd inkpi-desktop

# 安装依赖
npm install
```

### 2. 统一开发指令集

| 指令 | 描述 | 示例 |
| :--- | :--- | :--- |
| `npm run dev` | 启动 Web SPA 开发热重载服务器 | `npm run dev` |
| `npm run tauri:dev` | 自动同步 sidecar 并启动 Tauri 2 桌面原生调试外壳 | `npm run tauri:dev` |
| `npm run build` | 执行 TypeScript 类型检查与 Vite 生产打包 | `npm run build` |
| `npm run lint` | 运行 Oxlint 超高速代码风格检查 | `npm run lint` |
| `npm run test` | 运行 Vitest 单元与集成测试套件 | `npm run test` |
| `npm run test:coverage` | 运行全量测试套件并校验覆盖率质量门禁 | `npm run test:coverage` |
| `npm run tauri:build` | 编译生成 Windows NSIS 桌面独立安装包 | `npm run tauri:build` |

### 3. 运行全量测试与覆盖率门禁

```bash
# 运行 9 个测试套件，65 个用例（行覆盖率 >= 85%, 分支覆盖率 >= 80%）
npm run test:coverage
```

### 4. 编译独立安装包

```bash
npm run tauri:build
```
安装包产物位于：`src-tauri/target/x86_64-pc-windows-gnu/release/bundle/nsis/`。

---

## 🛡️ 质量保证与工程规范

1. **零运行时前提（Zero Prerequisites）**：终端打包完整独立二进制，免除终端用户环境负担；
2. **离线优先数据完整性**：IndexedDB 事务化自动持久化，保障创作者资产零丢失；
3. **严格测试门禁（Coverage Gate）**：全库单测覆盖率严格满足 Lines $\ge 85\%$, Branches $\ge 80\%$；
4. **强类型 RPC 通信**：前端与守护进程完全遵循 JSON-RPC 2.0 契约；
5. **供应链精确锁定**：依赖项全部采用精确版本锁定，杜绝漂移风险。

---

## 📄 开源许可证

本项目遵循 [MIT License](./LICENSE) 开源协议。Copyright (c) 2026 InkPi Contributors.

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
