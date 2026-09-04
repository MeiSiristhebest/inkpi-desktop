/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 可选：覆盖默认 Daemon WebSocket 地址（见 src/config.ts 的 DEFAULT_DAEMON_URL） */
  readonly VITE_INKPI_WS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
