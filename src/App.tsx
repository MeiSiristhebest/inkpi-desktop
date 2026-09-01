import React, { useState, useEffect, useRef } from 'react'
import {
  Plus,
  Search,
  Download,
  Sparkles,
  Maximize2,
  Minimize2,
  WifiOff,
  RefreshCw,
  Bold,
  Italic,
  Wand2,
  AlignLeft,
  Type,
  PanelLeft,
  PenLine,
  Sun,
  Moon,
  Monitor,
  ChevronRight,
  X,
} from 'lucide-react'

import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import CharacterCount from '@tiptap/extension-character-count'
import Placeholder from '@tiptap/extension-placeholder'
import { InkRpcClient } from '@inkpi/client'

import {
  GhostText,
  setGhostText as showGhostText,
  clearGhostText as hideGhostText,
} from './extensions/ghost-text'

import { Engine } from './core/engine'
import { db } from './db/indexedDB'
import type { VolumeRecord, ChapterRecord } from './types'
import { AiAssistantPanel } from './components/ai/AiAssistantPanel'

// InkPi Daemon WebSocket 入口 (可用 .env 里 VITE_INKPI_WS_URL 覆盖)
const DAEMON_WS_URL = (import.meta as any).env?.VITE_INKPI_WS_URL || 'ws://127.0.0.1:8849'

  // 写作台使用的本地项目标识（IndexedDB 按 projectId 隔离数据）
const PROJECT_ID = 'inkpi-default'

const htmlToPlain = (html: string) =>
  new DOMParser().parseFromString(html, 'text/html').body.textContent || ''

const messageToText = (msg: any): string => {
  if (!msg) return ''
  if (typeof msg.content === 'string') return msg.content
  if (Array.isArray(msg.content)) return msg.content.map((b: any) => b?.text ?? '').join('')
  return ''
}

type ThemeMode = 'light' | 'dark' | 'system'
type FontKind = 'serif' | 'sans' | 'mono'

const initialVolumes: VolumeRecord[] = [
  { id: 'vol-1', projectId: PROJECT_ID, title: '第一卷 · 苍云初醒', order: 1, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'vol-2', projectId: PROJECT_ID, title: '第二卷 · 星罗万象', order: 2, createdAt: Date.now(), updatedAt: Date.now() },
]

const initialChapters: ChapterRecord[] = [
  {
    id: 'ch-1',
    projectId: PROJECT_ID,
    volumeId: 'vol-1',
    title: '第001章 寒潭惊变',
    content:
      '<p>　　夜幕低垂，寒风卷着碎雪拍打在窗棂上，发出刺耳的呜咽声。</p><p>　　少年盘膝坐在冰冷的青石地面上，周身三尺之内，隐隐泛起微弱的淡青色毫光。他下意识地握紧了手中的断剑，感知着丹田深处那一缕若有若无的清凉灵气。</p><p>　　“三年了。”少年低声呢喃，眸子深处掠过一丝冷冽，“沧澜宗欠我的，也该一笔笔算回来了。”</p>',
    wordCount: 156,
    order: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'ch-2',
    projectId: PROJECT_ID,
    volumeId: 'vol-1',
    title: '第002章 锈剑之鸣',
    content: '<p>　　更深露重，窗外的风声渐渐平息。</p>',
    wordCount: 16,
    order: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'ch-3',
    projectId: PROJECT_ID,
    volumeId: 'vol-1',
    title: '第003章 破局斩妄',
    content: '<p>　　天色将明未明之际，院外传来了急促的脚步声。</p>',
    wordCount: 22,
    order: 2,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
]

// 通用图标按钮样式：默认低调，悬浮才显形（Notion / macOS 的惯用处理）
const iconBtn =
  'p-1.5 rounded-md text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)] transition-colors duration-150'

export const App: React.FC = () => {
  const [volumes] = useState<VolumeRecord[]>(initialVolumes)
  const [chapters, setChapters] = useState<ChapterRecord[]>(initialChapters)

  const [activeChapterId, setActiveChapterId] = useState<string>('ch-1')
  const [activeChapter, setActiveChapter] = useState<ChapterRecord | null>(initialChapters[0])

  // 主界面模式：'doc' 为现有笔记编辑器，'write' 为正文写作台（Engine）
  // 默认进入正文写作台，确保补齐的功能直接可见
  const [mode, setMode] = useState<'doc' | 'write'>('write')

  // RPC 连接状态
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false)
  const clientRef = useRef<InkRpcClient | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  // 组件是否仍挂载：用于中断连接重试循环（避免卸载后继续 setState）
  const mountedRef = useRef<boolean>(false)
  const ghostTextRef = useRef<string>('')
  const ghostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // AI 副驾驶面板状态
  const [aiPanelOpen, setAiPanelOpen] = useState<boolean>(true)
  const [aiMessages, setAiMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([])
  const [aiInput, setAiInput] = useState<string>('')
  const [aiBusy, setAiBusy] = useState<boolean>(false)

  // 排版与界面参数
  const [fontSize, setFontSize] = useState<number>(18)
  const [lineHeight, setLineHeight] = useState<string>('2.0')
  const [fontFamily, setFontFamily] = useState<FontKind>('serif')
  const [themeMode, setThemeMode] = useState<ThemeMode>('system')
  const [isSaved, setIsSaved] = useState<boolean>(true)
  const [isZenMode, setIsZenMode] = useState<boolean>(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true)
  const [showFindReplace, setShowFindReplace] = useState<boolean>(false)
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false)
  const [findText, setFindText] = useState<string>('')
  const [replaceText, setReplaceText] = useState<string>('')
  const [targetWordCount] = useState<number>(3000)
  const [sessionWordDelta, setSessionWordDelta] = useState<number>(0)
  const [ghostText, setGhostText] = useState<string>('')

  const settingsRef = useRef<HTMLDivElement>(null)

  // 应用外观：默认跟随系统，允许手动覆盖
  useEffect(() => {
    const root = document.documentElement
    if (themeMode === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', themeMode)
  }, [themeMode])

  // 首次启动时把旧版硬编码的初始卷章数据迁移到 IndexedDB，
  // 这样默认进入 WriterDesk 后用户能直接看到已有章节，而不是空白。
  useEffect(() => {
    const seed = async () => {
      const [vols, chs] = await Promise.all([
        db.getAll<VolumeRecord>('volumes'),
        db.getAll<ChapterRecord>('chapters'),
      ])
      const hasProjectVols = vols.some((v) => v.projectId === PROJECT_ID)
      const hasProjectChs = chs.some((c) => c.projectId === PROJECT_ID)
      if (hasProjectVols || hasProjectChs) return

      const now = Date.now()
      for (const v of initialVolumes) {
        await db.put('volumes', {
          ...v,
          projectId: PROJECT_ID,
          createdAt: now,
          updatedAt: now,
        })
      }
      for (const c of initialChapters) {
        const plain = htmlToPlain(c.content)
        await db.put('chapters', {
          ...c,
          projectId: PROJECT_ID,
          content: plain,
          wordCount: plain.replace(/\s+/g, '').length,
          createdAt: now,
          updatedAt: now,
        })
      }
    }
    seed()
  }, [])

  // 初始化 TipTap 编辑器内核
  const editor = useEditor({
    extensions: [
      StarterKit,
      CharacterCount,
      Placeholder.configure({
        placeholder: '在此处挥洒你的灵感与笔墨……',
      }),
      GhostText,
    ],
    content: activeChapter?.content || '',
    editorProps: {
      handleKeyDown: (view, event) => {
        // Tab 键采纳光标后的内联 Ghost Text 补全
        if (event.key === 'Tab' && ghostTextRef.current) {
          const ghost = ghostTextRef.current
          ghostTextRef.current = ''
          setGhostText('')
          view.dispatch(view.state.tr.insertText(ghost))
          return true
        }
        return false
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (!activeChapter) return
      const html = ed.getHTML()
      const text = ed.getText()
      const newWordCount = text.replace(/\s+/g, '').length
      const diff = newWordCount - activeChapter.wordCount
      if (diff > 0) setSessionWordDelta((prev) => prev + diff)

      const updated: ChapterRecord = {
        ...activeChapter,
        content: html,
        wordCount: newWordCount,
        updatedAt: Date.now(),
      }
      setActiveChapter(updated)
      setChapters((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      setIsSaved(false)

      // 若连通 Daemon，防抖请求会话级 Ghost Text 补全 (session.ghost.suggest)
      if (ghostTimerRef.current) clearTimeout(ghostTimerRef.current)
      if (clientRef.current && sessionIdRef.current && text.length > 5) {
        const tail = text.slice(-200)
        const sessionId = sessionIdRef.current
        ghostTimerRef.current = setTimeout(() => {
          clientRef.current!
            .request<{ text?: string; ghostText?: string }>('session.ghost.suggest', {
              sessionId,
              text: tail,
            })
            .then((res: any) => {
              const suggestion = res?.text || res?.ghostText
              if (suggestion) {
                setGhostText(suggestion)
                ghostTextRef.current = suggestion
                showGhostText(ed, suggestion)
              }
            })
            .catch(() => {})
        }, 600)
      }
    },
  })

  /**
   * 连接 InkPi 守护进程 (WebSocket JSON-RPC)。
   *
   * daemon 由 Tauri 作为 externalBin sidecar 拉起，是 Bun 编译的单文件二进制，
   * 冷启动实测需要 4~6 秒才开始接受连接。SPA 挂载时 daemon 通常尚未就绪，
   * 因此这里必须自动重试，否则每次打开应用都会误判为「离线沙盒」。
   */
  const initConnection = async (maxAttempts = 15, retryDelayMs = 1000) => {
    setIsReconnecting(true)

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (!mountedRef.current) return

      try {
        const client = await InkRpcClient.connectWebSocket(DAEMON_WS_URL)
        // 等待期间组件可能已卸载
        if (!mountedRef.current) {
          client.close().catch(() => {})
          return
        }
        clientRef.current = client

        const status = await client.request<{ running: boolean }>('daemon.status')
        if (!status?.running) throw new Error('daemon not running')

        // 为当前章节创建 daemon 会话 (重连时幂等)
        const sessionId = `desk-${activeChapterId}`
        try {
          await client.request('session.create', {
            sessionId,
            initialText: htmlToPlain(activeChapter?.content || ''),
          })
        } catch (e: any) {
          if (!String(e?.message || e).includes('already exists')) throw e
        }
        if (!mountedRef.current) return

        sessionIdRef.current = sessionId
        setIsConnected(true)
        setIsReconnecting(false)
        console.log(
          `[InkPi Desktop] Connected: ${DAEMON_WS_URL} (session: ${sessionId}, attempt: ${attempt + 1})`
        )
        return
      } catch (err) {
        // 还有余量就退避重试，最后一次才判定离线
        if (attempt === maxAttempts - 1) {
          console.warn(
            `[InkPi Desktop] Daemon 连接失败（已重试 ${maxAttempts} 次），进入离线沙盒模式:`,
            err
          )
          setIsConnected(false)
          setIsReconnecting(false)
          return
        }
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
        if (!mountedRef.current) return
      }
    }
  }

  useEffect(() => {
    // StrictMode 下会 mount → unmount → mount，故挂载时重新置位
    mountedRef.current = true
    initConnection()

    return () => {
      mountedRef.current = false
      if (clientRef.current) {
        clientRef.current.close().catch(() => {})
      }
    }
  }, [])

  const handleSelectChapter = (ch: ChapterRecord) => {
    setActiveChapterId(ch.id)
    setActiveChapter(ch)
    ghostTextRef.current = ''
    setGhostText('')
    if (editor) {
      editor.commands.setContent(ch.content)
      hideGhostText(editor)
    }
  }

  const handleSave = async () => {
    if (!activeChapter) return
    setIsSaved(true)
    // TODO(阶段三): 通过 daemon 的 journal/snapshot RPC 持久化到 SQLite
  }

  // 1. 中文首行双全角空格规范排版 (TipTap AST 级别规整)
  const handleAutoFormat = () => {
    if (!editor) return
    const text = editor.getText()
    const formatted = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => `<p>　　${line}</p>`)
      .join('')
    editor.commands.setContent(formatted)
    setIsSaved(false)
  }

  // 2. 标点符号中文化清洗
  const handlePunctuationFix = () => {
    if (!editor) return
    let text = editor.getText()
    text = text.replace(/,/g, '，').replace(/:/g, '：').replace(/;/g, '；').replace(/\?/g, '？').replace(/!/g, '！')
    text = text.replace(/\.\.\./g, '……').replace(/--/g, '——')
    const formatted = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => `<p>${line.startsWith('　　') ? line : '　　' + line}</p>`)
      .join('')
    editor.commands.setContent(formatted)
    setIsSaved(false)
  }

  // 3. 全局查找与替换
  const handleExecuteReplace = () => {
    if (!editor || !findText) return
    const currentHtml = editor.getHTML()
    const regex = new RegExp(findText, 'g')
    const replaced = currentHtml.replace(regex, replaceText)
    editor.commands.setContent(replaced)
    setIsSaved(false)
  }

  // 4. 导出当前章节
  const handleExportChapter = (format: 'txt' | 'md') => {
    if (!activeChapter || !editor) return
    const output = format === 'txt' ? editor.getText() : editor.getHTML()
    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeChapter.title}.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 5. 采纳 Ghost Text（点击状态栏提示或按 Tab）
  const handleAcceptGhostText = () => {
    if (editor && ghostText) {
      editor.commands.insertContent(ghostText)
      setGhostText('')
      ghostTextRef.current = ''
    }
  }

  // 6. AI 副驾驶：走 daemon 的 session.prompt RPC (未配模型时 daemon 返回离线回显)
  const handleAiPrompt = async (prompt: string) => {
    const trimmed = prompt.trim()
    if (!trimmed || aiBusy) return

    setAiMessages((prev) => [...prev, { role: 'user', text: trimmed }])
    setAiInput('')

    if (!clientRef.current || !sessionIdRef.current || !isConnected) {
      setAiMessages((prev) => [
        ...prev,
        { role: 'assistant', text: '（离线沙盒模式：请先启动 `inkpi daemon` 并点击左下角重连后再使用 AI 功能）' },
      ])
      return
    }

    setAiBusy(true)
    try {
      const res = await clientRef.current.request<{ lastMessage?: any }>('session.prompt', {
        sessionId: sessionIdRef.current,
        prompt: trimmed,
      })
      const text = messageToText(res?.lastMessage) || JSON.stringify(res)
      setAiMessages((prev) => [...prev, { role: 'assistant', text }])
    } catch (err: any) {
      setAiMessages((prev) => [
        ...prev,
        { role: 'assistant', text: `⚠️ RPC 错误：${err?.message || err}` },
      ])
    } finally {
      setAiBusy(false)
    }
  }

  // 点击外部收起设置面板
  useEffect(() => {
    if (!settingsOpen) return
    const onDown = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [settingsOpen])

  // 快捷键：Esc 退出沉浸/浮层，Cmd+S 保存，Cmd+F 查找，Cmd+B 折叠侧栏
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isZenMode) setIsZenMode(false)
        if (showFindReplace) setShowFindReplace(false)
        if (settingsOpen) setSettingsOpen(false)
        return
      }
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const k = e.key.toLowerCase()
      if (k === 's') {
        e.preventDefault()
        handleSave()
      } else if (k === 'f') {
        e.preventDefault()
        setShowFindReplace((v) => !v)
      } else if (k === 'b') {
        e.preventDefault()
        setIsSidebarOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isZenMode, showFindReplace, settingsOpen, activeChapter])

  const fontStack =
    fontFamily === 'serif' ? 'var(--ink-font-serif)' : fontFamily === 'mono' ? 'var(--ink-font-mono)' : 'var(--ink-font-sans)'

  const totalWords = chapters.reduce((acc, c) => acc + c.wordCount, 0)
  const chapterWords = activeChapter?.wordCount || 0

  // 写作台模式：挂载 Engine（独立的正文写作工作区），与笔记编辑器隔离
  if (mode === 'write') {
    return (
      <Engine
        projectId={PROJECT_ID}
        onBack={() => setMode('doc')}
        onOpenAssistant={() => setAiPanelOpen(true)}
        rightPanel={
          aiPanelOpen ? (
            <AiAssistantPanel
              messages={aiMessages}
              input={aiInput}
              busy={aiBusy}
              connected={isConnected}
              onInputChange={setAiInput}
              onSend={() => handleAiPrompt(aiInput)}
              onClose={() => setAiPanelOpen(false)}
            />
          ) : null
        }
      />
    )
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[var(--ink-bg)] text-[var(--ink-text)] transition-colors duration-300">
      {/* ── 侧栏：卷章目录 ───────────────────────────────── */}
      {isSidebarOpen && !isZenMode && (
        <aside className="w-[248px] shrink-0 flex flex-col border-r border-[var(--ink-border)] bg-[var(--ink-bg-sidebar)]">
          {/* 工作区标识 */}
          <div className="h-11 shrink-0 flex items-center gap-2 px-3">
            <div className="w-[22px] h-[22px] rounded-md bg-[var(--ink-accent)] text-white flex items-center justify-center text-[11px] shrink-0">
              墨
            </div>
            <span className="text-[13px] font-medium truncate">苍云纪</span>
          </div>

          {/* 卷章树 */}
          <div className="flex-1 overflow-y-auto px-2 pb-2">
            {volumes.map((vol) => {
              const volChs = chapters.filter((c) => c.volumeId === vol.id)
              return (
                <div key={vol.id} className="mb-1">
                  <div className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[var(--ink-text-faint)]">
                    <ChevronRight className="w-3 h-3" />
                    <span className="truncate">{vol.title}</span>
                  </div>

                  <div className="space-y-px">
                    {volChs.map((ch) => {
                      const isSelected = ch.id === activeChapterId
                      return (
                        <button
                          key={ch.id}
                          onClick={() => handleSelectChapter(ch)}
                          className={`w-full flex items-center justify-between gap-2 px-2 py-[5px] rounded-md text-[13px] text-left transition-colors duration-150 ${
                            isSelected
                              ? 'bg-[var(--ink-bg-active)] font-medium'
                              : 'text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)]'
                          }`}
                        >
                          <span className="truncate">{ch.title}</span>
                          <span className="text-[10px] text-[var(--ink-text-faint)] shrink-0 tabular-nums">
                            {ch.wordCount}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* 底部：新建 + 连接状态 */}
          <div className="shrink-0 border-t border-[var(--ink-border)] px-2 py-2 space-y-1">
            <button
              onClick={() => {
                const order = chapters.filter((c) => c.volumeId === 'vol-1').length
                const newCh: ChapterRecord = {
                  id: `ch-${Date.now()}`,
                  projectId: PROJECT_ID,
                  volumeId: 'vol-1',
                  title: `第${String(order + 1).padStart(3, '0')}章 未命名`,
                  content: '<p>　　</p>',
                  wordCount: 0,
                  order,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                }
                setChapters((prev) => [...prev, newCh])
                setActiveChapterId(newCh.id)
                setActiveChapter(newCh)
                if (editor) editor.commands.setContent(newCh.content)
              }}
              className="w-full flex items-center gap-2 px-2 py-[5px] rounded-md text-[13px] text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] transition-colors duration-150"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>新建章节</span>
            </button>

            <div className="flex items-center justify-between px-2 py-1 text-[11px] text-[var(--ink-text-faint)]">
              <span className="flex items-center gap-1.5">
                {isConnected ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--ink-success)]" />
                    <span>Daemon 已连接</span>
                  </>
                ) : isReconnecting ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>连接中…</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3" />
                    <span>离线沙盒</span>
                  </>
                )}
              </span>
              <button
                onClick={() => initConnection()}
                disabled={isReconnecting}
                title="重连 InkPi Daemon"
                className={iconBtn}
              >
                <RefreshCw className={`w-3 h-3 ${isReconnecting ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* ── 主区 ─────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* 顶栏 */}
        {!isZenMode && (
          <header className="h-11 shrink-0 flex items-center justify-between gap-3 px-3 border-b border-[var(--ink-border)]">
            <div className="flex items-center gap-1 min-w-0">
              <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} title="折叠/展开目录 (⌘B)" className={iconBtn}>
                <PanelLeft className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={activeChapter?.title || ''}
                onChange={(e) => {
                  if (!activeChapter) return
                  const updated = { ...activeChapter, title: e.target.value }
                  setActiveChapter(updated)
                  setChapters((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
                  setIsSaved(false)
                }}
                className="min-w-0 flex-1 bg-transparent text-[13px] font-medium px-1.5 py-0.5 rounded-md hover:bg-[var(--ink-bg-hover)] focus:bg-[var(--ink-bg-hover)] focus:outline-none truncate"
                placeholder="无标题"
              />
            </div>

            <div className="flex items-center gap-0.5 shrink-0 relative">
              <button onClick={() => setShowFindReplace(!showFindReplace)} title="查找替换 (⌘F)" className={iconBtn}>
                <Search className="w-4 h-4" />
              </button>

              <button onClick={handleAutoFormat} title="一键首行缩进排版" className={iconBtn}>
                <AlignLeft className="w-4 h-4" />
              </button>

              {/* 排版设置：字体 / 字号 / 行距 / 外观 */}
              <button
                onClick={() => setSettingsOpen(!settingsOpen)}
                title="排版与外观"
                className={`${iconBtn} ${settingsOpen ? 'bg-[var(--ink-bg-hover)] text-[var(--ink-text)]' : ''}`}
              >
                <Type className="w-4 h-4" />
              </button>

              {settingsOpen && (
                <div
                  ref={settingsRef}
                  className="absolute top-10 right-0 z-30 w-[248px] p-3 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] shadow-[var(--ink-shadow-lg)] space-y-3"
                >
                  {/* 字体 */}
                  <div>
                    <div className="text-[11px] font-medium text-[var(--ink-text-faint)] mb-1.5">正文字体</div>
                    <div className="flex gap-1">
                      {([
                        ['serif', '衬线'],
                        ['sans', '黑体'],
                        ['mono', '等宽'],
                      ] as [FontKind, string][]).map(([v, label]) => (
                        <button
                          key={v}
                          onClick={() => setFontFamily(v)}
                          className={`flex-1 px-2 py-1 rounded-md text-[12px] transition-colors duration-150 ${
                            fontFamily === v
                              ? 'bg-[var(--ink-accent)] text-white'
                              : 'bg-[var(--ink-bg-hover)] text-[var(--ink-text-muted)] hover:text-[var(--ink-text)]'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 字号 */}
                  <div>
                    <div className="text-[11px] font-medium text-[var(--ink-text-faint)] mb-1.5">
                      字号 · {fontSize}px
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setFontSize((s) => Math.max(14, s - 1))}
                        className="px-2 py-1 rounded-md text-[12px] bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)] transition-colors"
                      >
                        A−
                      </button>
                      <input
                        type="range"
                        min={14}
                        max={28}
                        value={fontSize}
                        onChange={(e) => setFontSize(Number(e.target.value))}
                        className="flex-1 accent-[var(--ink-accent)]"
                      />
                      <button
                        onClick={() => setFontSize((s) => Math.min(28, s + 1))}
                        className="px-2 py-1 rounded-md text-[12px] bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)] transition-colors"
                      >
                        A+
                      </button>
                    </div>
                  </div>

                  {/* 行距 */}
                  <div>
                    <div className="text-[11px] font-medium text-[var(--ink-text-faint)] mb-1.5">行距</div>
                    <div className="flex gap-1">
                      {['1.6', '1.8', '2.0', '2.4'].map((v) => (
                        <button
                          key={v}
                          onClick={() => setLineHeight(v)}
                          className={`flex-1 px-1 py-1 rounded-md text-[12px] transition-colors duration-150 ${
                            lineHeight === v
                              ? 'bg-[var(--ink-accent)] text-white'
                              : 'bg-[var(--ink-bg-hover)] text-[var(--ink-text-muted)] hover:text-[var(--ink-text)]'
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 外观 */}
                  <div>
                    <div className="text-[11px] font-medium text-[var(--ink-text-faint)] mb-1.5">外观</div>
                    <div className="flex gap-1">
                      {([
                        ['light', Sun, '浅色'],
                        ['dark', Moon, '深色'],
                        ['system', Monitor, '跟随系统'],
                      ] as [ThemeMode, any, string][]).map(([v, Icon, label]) => (
                        <button
                          key={v}
                          onClick={() => setThemeMode(v)}
                          className={`flex-1 flex flex-col items-center gap-1 py-1.5 rounded-md text-[11px] transition-colors duration-150 ${
                            themeMode === v
                              ? 'bg-[var(--ink-accent)] text-white'
                              : 'bg-[var(--ink-bg-hover)] text-[var(--ink-text-muted)] hover:text-[var(--ink-text)]'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 文本工具：顶栏只保留常用图标，低频操作收在这里 */}
                  <div>
                    <div className="text-[11px] font-medium text-[var(--ink-text-faint)] mb-1.5">文本工具</div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          handleAutoFormat()
                          setSettingsOpen(false)
                        }}
                        className="flex-1 px-2 py-1.5 rounded-md text-[12px] bg-[var(--ink-bg-hover)] text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] transition-colors duration-150"
                      >
                        首行缩进
                      </button>
                      <button
                        onClick={() => {
                          handlePunctuationFix()
                          setSettingsOpen(false)
                        }}
                        className="flex-1 px-2 py-1.5 rounded-md text-[12px] bg-[var(--ink-bg-hover)] text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] transition-colors duration-150"
                      >
                        标点规整
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="w-px h-4 bg-[var(--ink-border)] mx-1" />

              <button onClick={() => handleExportChapter('txt')} title="导出为 TXT" className={iconBtn}>
                <Download className="w-4 h-4" />
              </button>

              <button
                onClick={() => setAiPanelOpen(!aiPanelOpen)}
                title="AI 副驾驶"
                className={`${iconBtn} ${aiPanelOpen ? 'text-[var(--ink-accent)]' : ''}`}
              >
                <Sparkles className="w-4 h-4" />
              </button>

              <button onClick={() => setMode('write')} title="进入正文写作台" className={iconBtn}>
                <PenLine className="w-4 h-4" />
              </button>

              <button onClick={() => setIsZenMode(true)} title="沉浸模式" className={iconBtn}>
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </header>
        )}

        {/* 查找与替换浮条 */}
        {showFindReplace && !isZenMode && (
          <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)]">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <input
                type="text"
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                placeholder="查找"
                className="min-w-0 flex-1 px-2.5 py-1 rounded-md text-[12px] bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] focus:outline-none focus:border-[var(--ink-accent)]"
              />
              <input
                type="text"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                placeholder="替换为"
                className="min-w-0 flex-1 px-2.5 py-1 rounded-md text-[12px] bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] focus:outline-none focus:border-[var(--ink-accent)]"
              />
            </div>
            <button
              onClick={handleExecuteReplace}
              className="px-3 py-1 rounded-md text-[12px] bg-[var(--ink-accent)] text-white hover:bg-[var(--ink-accent-hover)] transition-colors duration-150"
            >
              全部替换
            </button>
            <button onClick={() => setShowFindReplace(false)} title="关闭" className={iconBtn}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 写作画布 */}
        <div className="flex-1 overflow-y-auto relative">
          {isZenMode && (
            <button
              onClick={() => setIsZenMode(false)}
              title="退出沉浸模式 (Esc)"
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-[var(--ink-bg-hover)] text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] opacity-50 hover:opacity-100 transition-all duration-200"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          )}

          <div className={`mx-auto px-10 py-12 ${isZenMode ? 'max-w-[42rem]' : 'max-w-[46rem]'}`}>
            {!isZenMode && (
              <h1 className="text-[26px] font-medium tracking-tight mb-6 leading-snug" style={{ fontFamily: fontStack }}>
                {activeChapter?.title || '无标题'}
              </h1>
            )}

            {editor && (
              <BubbleMenu editor={editor} tippyOptions={{ duration: 120 }} className="ink-bubble">
                <button
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  className={`p-1.5 rounded-md hover:bg-[var(--ink-bg-hover)] ${
                    editor.isActive('bold') ? 'text-[var(--ink-accent)]' : ''
                  }`}
                  title="加粗"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  className={`p-1.5 rounded-md hover:bg-[var(--ink-bg-hover)] ${
                    editor.isActive('italic') ? 'text-[var(--ink-accent)]' : ''
                  }`}
                  title="斜体"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <div className="w-px h-4 bg-[var(--ink-border)] mx-0.5" />
                <button
                  onClick={() => {
                    const text = editor.state.doc.textBetween(
                      editor.state.selection.from,
                      editor.state.selection.to,
                      ' '
                    )
                    if (text) {
                      handleAiPrompt(`请润色以下小说段落：\n${text}`)
                      setAiPanelOpen(true)
                    }
                  }}
                  className="px-2 py-1 rounded-md text-[12px] flex items-center gap-1 text-[var(--ink-accent)] hover:bg-[var(--ink-accent-soft)] transition-colors duration-150"
                  title="调用 InkPi AI 划词润色"
                >
                  <Wand2 className="w-3 h-3" />
                  <span>AI 润色</span>
                </button>
              </BubbleMenu>
            )}

            <div
              className="ink-editor"
              style={{ fontSize: `${fontSize}px`, lineHeight, fontFamily: fontStack }}
            >
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>

        {/* 底部状态栏 */}
        {!isZenMode && (
          <footer className="h-7 shrink-0 flex items-center justify-between px-4 text-[11px] text-[var(--ink-text-faint)] border-t border-[var(--ink-border)]">
            <div className="flex items-center gap-3">
              <span className="tabular-nums">
                {chapterWords.toLocaleString()} / {targetWordCount.toLocaleString()} 字
              </span>
              <span className="tabular-nums">全书 {totalWords.toLocaleString()} 字</span>
              {sessionWordDelta > 0 && (
                <span className="tabular-nums text-[var(--ink-success)]">本次 +{sessionWordDelta}</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {ghostText && (
                <button
                  onClick={handleAcceptGhostText}
                  className="flex items-center gap-1 text-[var(--ink-accent)] hover:underline"
                  title="采纳续写建议"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Tab 采纳续写</span>
                </button>
              )}
              <span
                className={isSaved ? '' : 'text-[var(--ink-text-muted)]'}
                title="⌘S 保存"
              >
                {isSaved ? '已保存' : '未保存'}
              </span>
            </div>
          </footer>
        )}
      </main>

      {/* ── AI 副驾驶面板 ─────────────────────────────────── */}
      {aiPanelOpen && !isZenMode && (
        <AiAssistantPanel
          messages={aiMessages}
          input={aiInput}
          busy={aiBusy}
          connected={isConnected}
          onInputChange={setAiInput}
          onSend={() => handleAiPrompt(aiInput)}
          onClose={() => setAiPanelOpen(false)}
        />
      )}
    </div>
  )
}

export default App
