// 全局配置常量集中收口，消除散落在各业务模块中的魔法字符串 / 魔法 URL。
//
// 任何需要被多模块共享、且属于「环境 / 部署契约」的常量都应落在这里，而非硬编码在
// 业务模块中（否则会出现同一魔法串在 3+ 处复制、改一处漏两处的脆弱局面）。

/** InkPi Daemon 默认 WebSocket 地址（Tauri sidecar 监听端口） */
export const DEFAULT_DAEMON_URL = 'ws://127.0.0.1:8849'

/** 旧版本遗留的单项目 ID（首次启动自动迁移为可显式项目） */
export const LEGACY_PROJECT_ID = 'inkpi-default'

/** 桌面壳内 daemon 冷启动慢，连接超时给足耐心（毫秒） */
export const CONNECT_TIMEOUT_MS = 5000

/** 纯网页内没有 Tauri 拉起 daemon，仅快速探活一次（毫秒） */
export const WEB_CONNECT_TIMEOUT_MS = 3000
