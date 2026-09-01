import { useState, useEffect, useRef, type FC } from 'react'
import type { VolumeRecord, ChapterRecord } from '../../types'
import { db, uid } from '../../db/indexedDB'
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Save,
  BookOpen,
  AlignLeft,
  Layers,
} from 'lucide-react'
import { CodexWriterDrawer } from '../../plugins/living-codex/components/CodexWriterDrawer'

interface WriterDeskProps {
  projectId: string
  isTypewriter?: boolean
  onStats?: (stats: { title?: string; wordCount: number; updatedAt?: number }) => void
}

const FONT_MIN = 12
const FONT_MAX = 24
const AUTOSAVE_MS = 800

// 汉字去空白实时字数统计：剔除所有空格与换行后的纯文本长度
export const countWords = (content: string): number => content.replace(/\s+/g, '').length

// 中文段落一键格式化缩进：去首尾空白 → 清除空行 → 段前加全角空格 → 段间空行
export const formatChineseParagraphs = (content: string): string =>
  content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `　　${line}`)
    .join('\n\n')

// 纯正文写作台：分卷/章节目录树 + 排版控制 + 实时字数 + 生命周期/存盘 + 状态栏
export const WriterDesk: FC<WriterDeskProps> = ({ projectId, isTypewriter = false, onStats }) => {
  const [volumes, setVolumes] = useState<VolumeRecord[]>([])
  const [chapters, setChapters] = useState<ChapterRecord[]>([])
  const [activeChapterId, setActiveChapterId] = useState<string>('')
  const [activeChapter, setActiveChapter] = useState<ChapterRecord | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  // 编辑区样式状态
  const [fontSize, setFontSize] = useState<number>(16)
  const [lineHeight, setLineHeight] = useState<string>('1.8')
  const [isSaved, setIsSaved] = useState<boolean>(true)
  const [drawerOpen, setDrawerOpen] = useState<boolean>(true)

  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ── 数据加载 ─────────────────────────────────────────── */
  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  const loadData = async () => {
    const [allVols, allChs] = await Promise.all([
      db.getAll<VolumeRecord>('volumes'),
      db.getAll<ChapterRecord>('chapters'),
    ])
    const projVols = allVols
      .filter((v) => v.projectId === projectId)
      .sort((a, b) => a.order - b.order)
    const projChs = allChs
      .filter((c) => c.projectId === projectId)
      .sort((a, b) => a.order - b.order)
    setVolumes(projVols)
    setChapters(projChs)
    const init: Record<string, boolean> = {}
    projVols.forEach((v) => (init[v.id] = true))
    setExpanded(init)
    if (projChs.length > 0) {
      setActiveChapterId(projChs[0].id)
      setActiveChapter(projChs[0])
    }
  }

  /* ── 卷章树交互 ───────────────────────────────────────── */
  const toggleVolume = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))

  const handleSelectChapter = (ch: ChapterRecord) => {
    setActiveChapterId(ch.id)
    setActiveChapter(ch)
    setIsSaved(true)
  }

  // 新建章节：无分卷时先建默认卷，再在其下追加章节
  const handleNewChapter = async () => {
    let volId = volumes[0]?.id
    if (!volId) {
      const vol: VolumeRecord = {
        id: uid('vol'),
        projectId,
        title: '第一卷',
        order: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.put('volumes', vol)
      setVolumes((prev) => [...prev, vol])
      setExpanded((prev) => ({ ...prev, [vol.id]: true }))
      volId = vol.id
    }
    const order = chapters.filter((c) => c.volumeId === volId).length
    const ch: ChapterRecord = {
      id: uid('ch'),
      projectId,
      volumeId: volId,
      title: `第${String(order + 1).padStart(3, '0')}章 未命名`,
      content: '',
      wordCount: 0,
      order,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await db.put('chapters', ch)
    setChapters((prev) => [...prev, ch])
    setActiveChapterId(ch.id)
    setActiveChapter(ch)
    setIsSaved(true)
  }

  /* ── 正文受控绑定 / 防抖存盘 ───────────────────────────── */
  const handleContentChange = (newContent: string) => {
    if (!activeChapter) return
    const updated: ChapterRecord = {
      ...activeChapter,
      content: newContent,
      wordCount: countWords(newContent),
      updatedAt: Date.now(),
    }
    setActiveChapter(updated)
    setIsSaved(false)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => flushSave(updated), AUTOSAVE_MS)
  }

  const flushSave = async (ch?: ChapterRecord) => {
    const target = ch ?? activeChapter
    if (!target) return
    await db.put('chapters', target)
    setIsSaved(true)
  }

  const handleSave = () => flushSave()

  /* ── 中文段落一键缩进格式化 ────────────────────────────── */
  const handleAutoFormat = () => {
    if (!activeChapter) return
    handleContentChange(formatChineseParagraphs(activeChapter.content))
  }

  /* ── 打字机视口：保持光标垂直居中 ──────────────────────── */
  useEffect(() => {
    if (!isTypewriter || !textareaRef.current) return
    const ta = textareaRef.current
    const lh = parseFloat(getComputedStyle(ta).lineHeight) || fontSize * Number(lineHeight)
    const pos = ta.selectionStart
    const linesBefore = ta.value.slice(0, pos).split('\n').length
    ta.scrollTop = Math.max(0, linesBefore * lh - ta.clientHeight / 2)
  }, [activeChapter?.content, isTypewriter, fontSize, lineHeight])

  /* ── 上报统计给外层引擎（右侧信息栏） ──────────────────── */
  useEffect(() => {
    onStats?.({
      title: activeChapter?.title,
      wordCount: activeChapter?.wordCount ?? 0,
      updatedAt: activeChapter?.updatedAt,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChapter])

  return (
    <div className="flex-1 h-full flex min-h-0 bg-[var(--ink-bg)] text-[var(--ink-text)] overflow-hidden">
      {/* 列 1：分卷/章节目录树 */}
      <div className="w-64 shrink-0 border-r border-[var(--ink-border)] bg-[var(--ink-bg-sidebar)] flex flex-col">
        <div className="h-11 shrink-0 flex items-center justify-between px-3 border-b border-[var(--ink-border)]">
          <div className="flex items-center gap-1.5 text-[13px] font-medium">
            <BookOpen className="w-4 h-4 text-[var(--ink-accent)]" />
            <span>章节目录</span>
          </div>
          <button
            onClick={handleNewChapter}
            title="新建章节"
            className="p-1 rounded-md text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)] transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
          {volumes.length === 0 && (
            <button
              onClick={handleNewChapter}
              className="w-full text-left px-2 py-2 rounded-md text-[12px] text-[var(--ink-text-faint)] hover:bg-[var(--ink-bg-hover)]"
            >
              还没有分卷，点击右上角 + 新建第一章
            </button>
          )}
          {volumes.map((vol) => {
            const volChs = chapters
              .filter((c) => c.volumeId === vol.id)
              .sort((a, b) => a.order - b.order)
            const isOpen = expanded[vol.id] !== false
            return (
              <div key={vol.id}>
                <button
                  onClick={() => toggleVolume(vol.id)}
                  className="w-full flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[var(--ink-text-faint)] hover:text-[var(--ink-text)]"
                >
                  {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  <span className="truncate">{vol.title}</span>
                  <span className="ml-auto text-[10px] font-normal">{volChs.length}章</span>
                </button>
                {isOpen && (
                  <div className="space-y-px mt-0.5">
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
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 列 2：写作区（工具栏 + 正文 + 状态栏） */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* 微工具栏：排版 / 字号 / 行距 / 保存 */}
        <div className="h-11 shrink-0 flex items-center justify-between gap-3 px-4 border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[13px] font-medium truncate">
              {activeChapter?.title || '未选择章节'}
            </span>
            <span
              className={`text-[11px] px-2 py-0.5 rounded border ${
                isSaved
                  ? 'bg-[var(--ink-bg-hover)] text-[var(--ink-text-faint)] border-transparent'
                  : 'bg-[var(--ink-accent-soft)] text-[var(--ink-accent)] border-[var(--ink-accent)]/20'
              }`}
            >
              {isSaved ? '已保存' : '未保存'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleAutoFormat}
              title="一键排版缩进"
              className="px-2 py-1 rounded-md text-[11px] bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] hover:bg-[var(--ink-bg-hover)] flex items-center gap-1 text-[var(--ink-text-muted)]"
            >
              <AlignLeft className="w-3 h-3" /> 排版
            </button>

            <div className="flex items-center border border-[var(--ink-border)] rounded-md bg-[var(--ink-bg-elevated)]">
              <button
                onClick={() => setFontSize((s) => Math.max(FONT_MIN, s - 1))}
                className="px-2 py-0.5 text-[11px] hover:bg-[var(--ink-bg-hover)] rounded-l-md"
              >
                A-
              </button>
              <span className="px-1.5 text-[10px] tabular-nums">{fontSize}px</span>
              <button
                onClick={() => setFontSize((s) => Math.min(FONT_MAX, s + 1))}
                className="px-2 py-0.5 text-[11px] hover:bg-[var(--ink-bg-hover)] rounded-r-md"
              >
                A+
              </button>
            </div>

            <select
              value={lineHeight}
              onChange={(e) => setLineHeight(e.target.value)}
              className="px-2 py-1 rounded-md text-[11px] bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] text-[var(--ink-text-muted)]"
            >
              <option value="1.5">1.5x 行距</option>
              <option value="1.8">1.8x 行距</option>
              <option value="2.2">2.2x 行距</option>
            </select>

            <button
              onClick={handleSave}
              className={`px-3 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
                isSaved
                  ? 'bg-[var(--ink-bg-hover)] text-[var(--ink-text-muted)]'
                  : 'bg-[var(--ink-accent)] text-white'
              }`}
            >
              <Save className="w-3 h-3" /> 保存
            </button>

            <button
              onClick={() => setDrawerOpen((o) => !o)}
              title="切换活体世界观随动抽屉"
              className={`px-2 py-1 rounded-md text-[11px] border flex items-center gap-1 transition-colors ${
                drawerOpen
                  ? 'bg-[var(--ink-accent)]/10 text-[var(--ink-accent)] border-[var(--ink-accent)]/30'
                  : 'bg-[var(--ink-bg-elevated)] text-[var(--ink-text-muted)] border-[var(--ink-border)] hover:bg-[var(--ink-bg-hover)]'
              }`}
            >
              <Layers className="w-3 h-3" /> 世界观
            </button>
          </div>
        </div>

        {/* 正文编辑主体区 (中间编辑区 + 右侧随动抽屉) */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* 正文编辑区（纯文本 textarea 双向受控） */}
          <div className={`flex-1 min-h-0 overflow-y-auto ${isTypewriter ? 'flex items-center' : ''}`}>
            <div className={`mx-auto w-full ${isTypewriter ? 'max-w-2xl' : 'max-w-3xl'} px-8 py-8`}>
              <textarea
                ref={textareaRef}
                value={activeChapter?.content || ''}
                onChange={(e) => handleContentChange(e.target.value)}
                style={{
                  fontSize: `${fontSize}px`,
                  lineHeight: lineHeight,
                  fontFamily: 'var(--ink-font-serif)',
                }}
                className="w-full h-full min-h-[60vh] bg-transparent border-0 resize-none focus:outline-none text-[var(--ink-text)] tracking-wide"
                placeholder="在此处挥洒你的灵感与笔墨…"
              />
            </div>
          </div>

          {/* 右侧活体世界观随动抽屉 */}
          {drawerOpen && (
            <div className="w-72 shrink-0 border-l border-[var(--ink-border)] bg-[var(--ink-bg-sidebar)]/30 flex flex-col h-full overflow-hidden">
              <CodexWriterDrawer
                projectId={projectId}
                currentText={activeChapter?.content || ''}
              />
            </div>
          )}
        </div>

        {/* 底部状态栏：编码 / 存储 / 最后更新 */}
        <div className="h-8 shrink-0 flex items-center justify-between px-4 border-t border-[var(--ink-border)] bg-[var(--ink-bg-panel)] text-[11px] text-[var(--ink-text-faint)]">
          <div className="flex items-center gap-4">
            <span>字数：{activeChapter?.wordCount || 0} 字</span>
            <span>编码：UTF-8</span>
            <span>存储：Local IndexedDB</span>
          </div>
          <div>
            最后更新：
            {activeChapter?.updatedAt
              ? new Date(activeChapter.updatedAt).toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })
              : '-'}
          </div>
        </div>
      </div>
    </div>
  )
}
