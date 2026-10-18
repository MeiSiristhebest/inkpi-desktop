# Desktop Web 与 Runtime 补充验收（2026-10-13）

## 环境

- 使用隔离 Edge profile、Vite `http://127.0.0.1:4175/`、Runtime TCP `8848` / WebSocket `8849` 和独立 SQLite 文件。测试只写入合成作品。
- 没有调用真实模型或外部服务。
- Runtime `dist-bin/inkpi.exe` 与 Desktop 的 GNU/MSVC sidecar SHA-256 均为 `2AE39F58D0CA8AB3792390BD0EA265979E355ED2B67D8FF4574CBD2C6D567ED3`。从 NSIS 包提取的两个 sidecar 均通过 `runtime.handshake`，并报告与 `runtime.lock.json` 一致的 commit、skill manifest hash 和 storage schema version。Desktop pin 是 `9d6dbe93e5b10f5d6447dee70815e194fbc9ec66`，当前 Runtime `HEAD` 是 `cc1c69de5b51919586a3a4f0c05d314eb4abf7eb`；握手确认二进制报告的身份，不是独立的源码构建证明。

## 结果

| 检查 | 结果 | 限制 |
| --- | --- | --- |
| 保存和并发统计 | 旧版双标签检查：两章保存后重载均恢复正文；编辑器“今日新增”分别显示 23、28。此次隔离 Edge + Vite Preview 检查：tab 0 保存后，tab 1 的写作面板“今日产出”无需重载便从 30 更新到 32。 | 23/28 属于 localStorage 中的编辑器手打统计，不是 IndexedDB `dailyStats`。10/13 已为“今日新增”增加项目/日期 storage 事件刷新，定向测试 1/1；修复后未重跑双标签浏览器。并行输入、Tauri 原生双窗口与关闭/崩溃恢复仍未验收。此次实时验证覆盖顺序保存。 |
| 视口和缩放 | CSS 视口宽度 768、900、1024、1280、1366、1440、1920 均无横向溢出；DPR 1、1.25、1.5 的浏览器仿真也无溢出。返回、AI、插件入口均在视口内。 | 浏览器 DPR 仿真不等同于实际 Windows 缩放；原生 IME、完整读屏流程、其他 portal 组合和长时间编辑未测。 |
| 插件抽屉 | 44 个插件开关的启用状态重载后保留；25 个关闭操作均生效；43/43 个抽屉可以打开。打开期间编辑器仍可见，没有页面 alert、控制台错误或外部请求。 | 这是界面冒烟，没有运行 AI，也没有完成逐插件七类生产验收或领域结果检查。 |
| 备份导入 | 从书架导出 4,531 字节合成完整备份，再通过文件选择器导入；书架出现第二个项目条目，后续打开的项目恢复两章正文。无页面 alert。 | 仅覆盖合成数据和正常导入，不覆盖损坏文件、真实作品或崩溃恢复。 |
| 作品卡片可访问名称 | “更多操作”按钮增加稳定名称和菜单状态语义，完整备份按钮增加稳定名称；Bookshelf 测试 13/13、Desktop `tsc -b` 和两个改动文件的 Oxlint 通过，Prettier 已运行。 | 完整键盘和屏幕阅读器流程未测。 |
| Tauri 构建 | `pnpm run tauri:build` 通过：sidecar 刷新、TypeScript、Vite、前端 parity、Rust release 和 NSIS。 | 生成 `src-tauri/target/release/bundle/nsis/InkPi Desktop_0.1.0_x64-setup.exe`，38,287,764 字节，SHA-256 `D3EBCFCF173A7C1EDEE6E7886DF5F7C7BD80493D978C87DB2F29317E446770A1`。没有执行安装后的手动 GUI 验收。 |
| 打包 sidecar 验收 | 从 NSIS 产物提取的两个 daemon 均通过严格握手、能力检查和锁定身份检查；RPC、技能发现、隔离 SQLite 与重启恢复测试共 3 项通过。 | 另有 1 项手动 GUI 验收跳过；使用 mock model。锁定身份握手不证明二进制由声称的源码提交构建。 |

依赖准备：`pnpm install --offline --frozen-lockfile --ignore-scripts` 成功，使用本机缓存补入一个包，未修改 package manifest 或 lockfile。`npm ci --offline --dry-run` 仍显示会新增 187 个包、移除 2 个并变更 38 个，其中当前 Runtime 本地 `@inkpi/protocol` 2.0.0 会按 NPM lock 变为 1.0.0；没有执行该安装。

## 未闭合项

- 真实模型请求、作者盲评和长篇写作质量仍未验收。
- Windows 原生 IME、实际显示缩放、屏幕阅读器、插件领域结果、Runtime 终端验收仍未完成。
- 已生成 NSIS bundle，尚未安装后手动验收；sidecar 握手报告与 Desktop pin 一致，源码构建来源仍未证明。
- 两个标签页的统计值只在重载后收敛。是否要求即时刷新需要作为单独产品行为处理。

## 清理状态

测试端口已关闭；本次 Runtime 进程、SQLite 文件和日志已删除。Playwright CLI 报告两个隔离会话均未打开，但 Windows 仍锁定 `D:\develop\cache\tmp\inkpi-continue-20261013\edge-profile` 中的 Edge 缓存文件，剩余约 2.2 MB。没有停止无法确认归属的 Edge 进程。
