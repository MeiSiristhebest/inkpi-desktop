import {
  useState,
  useEffect,
  useCallback,
  useContext,
  createContext,
  type FC,
  type ReactNode,
} from 'react'
import { DEFAULT_DAEMON_URL } from '../config'
import type { SettingsRepository } from '../ports/settingsRepository'
import { indexedDbSettingsRepository } from '../adapters/indexedDbSettingsRepository'
import { localStorageSettingsRepository } from '../adapters/localStorageSettingsRepository'
import { withMirror } from '../adapters/mirroringSettingsRepository'

// ─────────────────────────────────────────────────────────────
// 统一应用设置中心
//
// 收拢原本散落在编辑器内联弹层、env 变量、插件管理器里的各种配置：
//   - 外观（主题 / 字体 / 字号 / 行距）
//   - 自定义 AI 模型（完全对齐 @inkpi/ai 的 ModelConfig，暴露 daemon 端全部能力）
//   - 连接（Daemon WebSocket 地址）
//   - 编辑器偏好（核心写作偏好，非插件）
//
// 架构变更（依赖倒置 + 副作用隔离）：
//   - 持久化经 SettingsRepository 端口（withMirror 装饰器：localStorage 即时写 + IndexedDB 镜像）
//     完成，本模块不直接依赖 db 单例，双写策略封装在适配器内（§8.2）；
//   - 主题 DOM 写入已剥离到独立的 <ThemeController/>，本模块不再触碰 document；
//   - 共享状态改为 React Context（SettingsProvider），为唯一来源；useSettings 必须在 Provider
//     内使用（§12.3，已删除过渡期模块级回退，测试改用 <SettingsProvider> 包裹）。
// ─────────────────────────────────────────────────────────────

export type ThemeMode = 'light' | 'dark' | 'system'
export type FontKind = 'serif' | 'sans' | 'mono' | 'wenkai' | 'kaiti' | 'fangsong'
export type ThemeSkin = 'default' | 'youth' | 'ink' | 'forest'

/**
 * 完全对齐 @inkpi/ai / @inkpi/protocol 的 ProviderType。
 * 这是 daemon 端 streamAi 实际支持的 provider 全集——UI 不做删减。
 */
export type ProviderType =
  | 'openai'
  | 'deepseek'
  | 'claude'
  | 'gemini'
  | 'xai'
  | 'moonshot'
  | 'zhipu'
  | 'minimax'
  | 'doubao'
  | 'qwen'
  | 'siliconflow'
  | 'ollama'
  | 'openrouter'
  | 'groq'
  | 'mistral'
  | 'azure'
  | 'bedrock'
  | 'custom'
  | 'faux'

/**
 * 完全对齐 @inkpi/ai 的 ModelConfig —— daemon 端 streamAi(model, ...) 接收的全部字段。
 * 自定义 AI 界面把这些字段全盘暴露给用户配置。
 */
export interface ModelConfig {
  id: string
  name: string
  provider: ProviderType
  baseUrl?: string
  apiKey?: string
  maxTokens?: number
  temperature?: number
  topP?: number
  presencePenalty?: number
  frequencyPenalty?: number
  thinkingBudget?: number
  supportsThinking?: boolean
  supportsPromptCache?: boolean
}

/** 段落首行缩进方式：none=不缩进 / full=全角空格 / space2=两个半角空格 */
export type ParagraphIndent = 'none' | 'full' | 'space2'

// ── 接口隔离（ISP）：把巨型 AppSettings 按内聚拆分为可独立消费的切片 ──
export interface AppearanceSettings {
  themeMode: ThemeMode
  themeSkin: ThemeSkin
  fontFamily: FontKind
  fontSize: number
  lineHeight: string
  /** 段落间距倍数（0.0~1.0，默认 0.25） */
  paragraphSpacing?: number
  /** 界面 UI 字号缩放比例（12px~16px，默认 13px） */
  uiFontSize?: number
}

export interface AiModelSettings {
  /** 自定义 AI 模型（null = 未配置，AI 走离线回显） */
  aiModel: ModelConfig | null
  /** 多供应商列表（参考 cc-switch 架构，支持保存多个服务商并随时一键切换） */
  savedAiModels?: ModelConfig[]
}

export interface ConnectionSettings {
  /** Daemon WebSocket 地址 */
  daemonWsUrl: string
}

export interface EditorPreferences {
  paragraphIndent: ParagraphIndent
  autoSave: boolean
  autoSaveDelay: number // 毫秒
  wordTarget: number // 每章字数目标
  normalizePunctuationOnFormat: boolean // 一键排版时顺带标点中文化
  defaultTypewriter: boolean // 默认打字机视口（光标垂直居中）
  showStatsBar: boolean // 底部状态栏（字数/编码/存储）
}

/** 对外暴露的完整设置 = 各切片组合；调用方仍可按需只取自己关心的切片 */
export interface AppSettings
  extends AppearanceSettings, AiModelSettings, ConnectionSettings, EditorPreferences {}

/** 每个 provider 的展示信息与 daemon 端默认值（对齐 @inkpi/ai 的 DEFAULT_BASE_URLS / PROVIDER_API_KEY_ENV） */
export const PROVIDER_META: Record<
  ProviderType,
  {
    label: string
    defaultBaseUrl?: string
    apiKeyEnv?: string
    streamKind: 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'faux'
  }
> = {
  openai: {
    label: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    apiKeyEnv: 'OPENAI_API_KEY',
    streamKind: 'openai',
  },
  deepseek: {
    label: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    streamKind: 'openai',
  },
  openrouter: {
    label: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    streamKind: 'openai',
  },
  groq: { label: 'Groq', defaultBaseUrl: 'https://api.groq.com/openai/v1', streamKind: 'openai' },
  mistral: { label: 'Mistral', defaultBaseUrl: 'https://api.mistral.ai/v1', streamKind: 'openai' },
  xai: { label: 'xAI', defaultBaseUrl: 'https://api.x.ai/v1', streamKind: 'openai' },
  siliconflow: {
    label: '硅基流动',
    defaultBaseUrl: 'https://api.siliconflow.cn/v1',
    streamKind: 'openai',
  },
  qwen: {
    label: '通义千问',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKeyEnv: 'DASHSCOPE_API_KEY',
    streamKind: 'openai',
  },
  azure: {
    label: 'Azure OpenAI',
    defaultBaseUrl: 'https://{your-resource}.openai.azure.com/openai/deployments/{deployment-id}',
    streamKind: 'openai',
  },
  claude: {
    label: 'Anthropic (Claude)',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    streamKind: 'anthropic',
  },
  bedrock: {
    label: 'AWS Bedrock',
    defaultBaseUrl: 'https://bedrock-runtime.us-east-1.amazonaws.com',
    streamKind: 'anthropic',
  },
  gemini: {
    label: 'Google (Gemini)',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    apiKeyEnv: 'GEMINI_API_KEY',
    streamKind: 'gemini',
  },
  ollama: {
    label: 'Ollama (本地)',
    defaultBaseUrl: 'http://localhost:11434',
    streamKind: 'ollama',
  },
  moonshot: {
    label: '月之暗面 (Moonshot)',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    apiKeyEnv: 'MOONSHOT_API_KEY',
    streamKind: 'openai',
  },
  zhipu: {
    label: '智谱 AI (Zhipu)',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    apiKeyEnv: 'ZHIPU_API_KEY',
    streamKind: 'openai',
  },
  minimax: {
    label: 'MiniMax',
    defaultBaseUrl: 'https://api.minimax.chat/v1',
    apiKeyEnv: 'MINIMAX_API_KEY',
    streamKind: 'openai',
  },
  doubao: {
    label: '火山引擎 (字节豆包)',
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    streamKind: 'openai',
  },
  custom: {
    label: '自定义厂商 (OpenAI 兼容)',
    defaultBaseUrl: '',
    streamKind: 'openai',
  },
  faux: { label: 'Faux (测试夹具)', streamKind: 'faux' },
}

const DEFAULT_SETTINGS: AppSettings = {
  themeMode: 'system',
  themeSkin: 'default',
  fontFamily: 'serif',
  fontSize: 18,
  lineHeight: '2.0',
  paragraphSpacing: 0.25,
  uiFontSize: 13,
  aiModel: null,
  daemonWsUrl: import.meta.env.VITE_INKPI_WS_URL || DEFAULT_DAEMON_URL,
  // 编辑器默认值
  paragraphIndent: 'full',
  autoSave: true,
  autoSaveDelay: 800,
  wordTarget: 3000,
  normalizePunctuationOnFormat: true,
  defaultTypewriter: false,
  showStatsBar: true,
}

// ── 持久化（依赖倒置 + 双写装饰器，§6.3 / §8.2）──
// 默认组合：localStorage 即时写为主存储，IndexedDB 异步镜像；模块级常量，无可变单例 / setter。
// 双写策略（即时写 + 镜像）全部封装在 withMirror 装饰器内，业务层无感知。
const settingsRepo: SettingsRepository = withMirror(
  localStorageSettingsRepository,
  indexedDbSettingsRepository,
)

const mergeSettings = (partial: Partial<AppSettings> | null): AppSettings => ({
  ...DEFAULT_SETTINGS,
  ...(partial ?? {}),
})

/** 同步快速路径（useState 初始化器要求同步）：仓储适配器同步读 + 默认回退 */
export function loadSettings(): AppSettings {
  const loaded = localStorageSettingsRepository.loadSync()
  if (loaded) return mergeSettings(loaded)
  return { ...DEFAULT_SETTINGS }
}

/** 双写：localStorage 即时写 + IndexedDB 镜像（由 withMirror 装饰器实现，§8.2） */
export function saveSettings(s: AppSettings): void {
  settingsRepo.save(s).catch(() => {})
}

/** 启动时从镜像（IndexedDB）回读，与主存储（localStorage）对齐（§8.2） */
export function loadSettingsFromIDB(): Promise<AppSettings | null> {
  return settingsRepo.load().then((rec) => (rec ? mergeSettings(rec) : null))
}

// ── React Context（共享状态单一来源）──
type SettingsTuple = readonly [AppSettings, (patch: Partial<AppSettings>) => void]
const SettingsContext = createContext<SettingsTuple | null>(null)

export const SettingsProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(loadSettings)

  // mount 后从 IndexedDB 镜像兜底（localStorage 不可用时）
  useEffect(() => {
    loadSettingsFromIDB().then((fromIDB) => {
      if (fromIDB && JSON.stringify(fromIDB) !== JSON.stringify(settings)) {
        setSettings(fromIDB)
        saveSettings(fromIDB)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      saveSettings(next)
      return next
    })
  }, [])

  return <SettingsContext.Provider value={[settings, update]}>{children}</SettingsContext.Provider>
}

/**
 * 读取并更新统一设置。生产环境须由 <SettingsProvider> 包裹（单一来源、可注入）；
 * 未被包裹时显式报错，避免维护两套实现（§12.3）。测试请使用 <SettingsProvider> 包裹。
 */
export function useSettings(): SettingsTuple {
  const ctx = useContext(SettingsContext)
  if (!ctx) {
    throw new Error('useSettings 必须在 <SettingsProvider> 内使用')
  }
  return ctx
}
