# InkPi Desktop

<p align="center">
  <strong>基于 Tauri 2 + React 的新一代 AI 智能写作桌面工作台</strong>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
  <a href="https://github.com/MeiSiristhebest/inkpi-desktop"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome"></a>
  <a href="https://github.com/MeiSiristhebest/inkpi-desktop/actions"><img src="https://img.shields.io/badge/CI-passing-green.svg" alt="CI Status"></a>
</p>

---

## 📖 简介

**InkPi Desktop** 是专为创作者与开发者打造的跨平台 AI 写作工作台。原生外壳采用 **Tauri 2 (Rust)** 构建，内置高性能 **Vite + React 19 + Tiptap / Novel** 富文本编辑器，并通过 WebSocket JSON-RPC 2.0 协议直连随包分发的 **InkPi Daemon** 独立守护进程。

```
┌─────────────────────────────────────────────────────────┐
│  inkpi-desktop.exe (Tauri 2 原生窗口)                    │
│                                                           │
│   ┌────────────────────┐        ws://127.0.0.1:8849      │
│   │  Vite + React SPA   │ ───────────────────────────┐    │
│   │  (Tiptap 编辑器)    │                            │    │
│   └────────────────────┘                            ▼    │
│                                              ┌──────────────┐ │
│  启动期拉起 externalBin sidecar:             │ inkpi.exe     │ │
│   inkpi.exe daemon --port 8848  ──────────▶ │ (InkPiDaemon) │ │
│                                              │ TCP 8848      │ │
│                                              │ WS  8849      │ │
│                                              └──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## ✨ 核心特性

- 🚀 **独立二进制 Sidecar 架构**：Daemon 由 [Bun](https://bun.sh) 编译为独立 `inkpi.exe` 单文件，**用户端运行无需安装 Node.js 或额外环境**。
- ✍️ **沉浸式 AI 写作体验**：基于 Tiptap 与 Novel 深度定制，支持实时幽灵补全（Ghost Text Suggestion）、智能行内续写与章节润色。
- 🧠 **Living Codex 实体设定集**：内置世界观实体知识图谱与 $O(N+M)$ Aho-Corasick 高性能多模式串关键词自动高亮与关联抽屉。
- 💾 **Local-First 离线持久化**：全面基于 IndexedDB 实现无感自动保存与草稿快照，断网或离线场景稳定可靠。
- 🛡️ **优雅的生命周期管控**：主应用关闭时 Rust 侧自动回收 Daemon 子进程，彻底杜绝孤儿进程与端口占用。

---

## 📂 仓库目录结构

```
inkpi-desktop/
├── src/                          # 前端 SPA (React 19 + Tiptap + Tailwind CSS)
│   ├── components/editor/        # 富文本编辑器核心组件与工具栏
│   ├── plugins/living-codex/     # 世界观知识图谱与 AC 自动机多模匹配引擎
│   ├── db/                       # IndexedDB 本地持久化驱动
│   └── core/                     # 编辑器状态机与调度中心
├── src-tauri/                    # Tauri 2 原生桌面端外壳 (Rust)
│   ├── src/main.rs               # 窗口管理与 sidecar 生命周期守护
│   ├── tauri.conf.json           # externalBin 与安装包资源配置
│   └── dlls/                     # 运行期 DLL 快照 (MinGW-w64 GNU 构建必须)
├── scripts/                      # 构建工具与 sidecar 复制脚本
├── .github/                      # CI/CD 工作流与 Issue/PR 模板
├── ARCHITECTURE.md               # 系统架构详细设计蓝图
├── DEVELOPMENT_SOP.md            # 开发标准操作程序与质量门禁
└── package.json                  # 项目依赖与构建指令
```

---

## 🛠️ 环境准备与构建

### 1. 前置环境要求

| 工具 | 作用 | 阶段 |
|---|---|---|
| Node.js 22+ & npm | 前端编译与构建脚本 | 开发 / 构建期 |
| Rust (MinGW-w64 GNU) | Tauri 2 原生外壳编译 | 桌面打包期 |
| [Bun](https://bun.sh) | 编译 inkpi standalone 二进制 | 上游 inkpi 仓库构建期 |

### 2. 快速开始

```bash
# 安装依赖
npm install

# 运行单元测试与覆盖率检查 (门禁要求 >= 85%)
npm run test:coverage

# 启动本地桌面开发环境 (自动同步 sidecar 并启动热重载)
npm run tauri:dev
```

### 3. 打包分发

```bash
# 编译并生成 NSIS Windows 安装程序
npm run tauri:build
```

构建生成的安装包位于：`src-tauri/target/x86_64-pc-windows-gnu/release/bundle/nsis/`。

---

## 🤝 贡献指南

请参考 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详细的开发规范与质量门禁要求。

---

## 📄 开源许可

本项目遵循 [MIT License](LICENSE) 开源协议。
