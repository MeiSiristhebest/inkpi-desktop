import { semanticTextFromContent } from '../../../domain/content'
import { useState, useEffect, useMemo, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import type { WaterBloatItem } from '../types'
import { waterMeterEngine } from '../engine/WaterMeterEngine'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { usePluginAiTask } from '../../../core/usePluginAiTask'
import { PluginAiTaskPanel } from '../../../components/plugins/PluginAiTaskPanel'
import { Zap, BookOpen, Bot, FileText, Sparkles, Droplet } from 'lucide-react'
import { ScoreProvenanceBadge } from '../../../ui/atoms'
import { Select } from '../../../ui/primitives'

export const WaterMeterMasterView: FC<DesktopPluginViewProps> = (props) => (
  <WaterMeterWorkspaceView key={props.projectId} {...props} />
)
const WaterMeterWorkspaceView: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const hostContext = useOptionalPluginHostContext()
  const [chapters, setChapters] = useState<any[]>([])
  const [selectedChapterId, setSelectedChapterId] = useState<string>('all')
  const [inputText, setInputText] = useState('')
  const report = useMemo(() => waterMeterEngine.auditText(inputText), [inputText])
  const aiTask = usePluginAiTask('water-meter', [selectedChapterId, inputText])

  useEffect(() => {
    const load = async () => {
      try {
        const list = await indexedDbProjectRepository.getChaptersByProject(projectId)
        list.sort((a, b) => a.order - b.order)
        setChapters(list)
        if (list.length > 0) {
          const defaultChap = hostContext?.activeChapter
            ? list.find((c) => c.id === hostContext.activeChapter?.id) || list[0]
            : list[0]
          setSelectedChapterId(defaultChap.id)
          const text = semanticTextFromContent(
            defaultChap.id,
            defaultChap.content || '',
            defaultChap.revision,
          )
          setInputText(text)
        }
      } catch (e) {
        console.error('Failed to load chapters in water meter:', e)
      }
    }
    load()
  }, [projectId, hostContext?.activeChapter?.id])

  const handleSelectChapter = (chapId: string) => {
    setSelectedChapterId(chapId)
    if (chapId === 'all') {
      const full = chapters
        .map((c) => semanticTextFromContent(c.id, c.content || '', c.revision))
        .join('\n\n')
      setInputText(full)
    } else {
      const chap = chapters.find((c) => c.id === chapId)
      const text = chap ? semanticTextFromContent(chap.id, chap.content || '', chap.revision) : ''
      setInputText(text)
    }
  }

  const handleAudit = () => {
    waterMeterEngine.auditText(
      inputText,
      selectedChapterId === 'all' ? undefined : { projectId, chapterId: selectedChapterId },
    )
  }

  // AI 深度叙事密度排查
  const handleAiDeepWaterAudit = async () => {
    if (!inputText.trim()) return
    const chap = chapters.find((c) => c.id === selectedChapterId)
    const analysisInput = {
      chapter: chap ? { id: chap.id, order: chap.order, title: chap.title } : undefined,
      text: semanticTextFromContent(chap?.id ?? selectedChapterId, inputText, chap?.revision ?? 0),
    }

    await aiTask.run(analysisInput)
  }

  const handleRemoveItem = (item: WaterBloatItem) => {
    if (
      typeof item.start !== 'number' ||
      typeof item.end !== 'number' ||
      inputText.slice(item.start, item.end) !== item.text
    )
      return
    setInputText(inputText.slice(0, item.start) + inputText.slice(item.end))
  }

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-canvas)] text-[var(--ink-text)] overflow-hidden font-sans">
      {/* 顶栏 */}
      <div className="border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4 shrink-0 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight">文本统计与词项复核</h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-500 font-medium">
              字符统计 · 原文词项定位
            </span>
          </div>
          <p className="text-xs text-[var(--ink-text-muted)] mt-0.5">
            查看原文统计和词表命中；是否修改由语境和作者目标决定
          </p>
          <ScoreProvenanceBadge source="rule" detail="字符频率与词表覆盖率，不是文学质量评分" />
        </div>

        <div className="flex items-center gap-2">
          {chapters.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--ink-text-muted)]">
              <BookOpen className="w-3.5 h-3.5" />
              <Select
                aria-label="筛选章节"
                value={selectedChapterId}
                onValueChange={(v) => handleSelectChapter(v)}
                size="sm"
              >
                <option value="all">全书章节采样</option>
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    第 {c.order} 章 · {c.title || '无题'}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <button
            onClick={handleAudit}
            className="px-3 py-1 rounded-md bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] hover:border-[var(--ink-accent)] text-xs font-medium flex items-center gap-1 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>重新计算文本统计</span>
          </button>

          {hostContext?.aiAssistant?.isAvailable && (
            <button
              disabled={aiTask.isRunning}
              onClick={handleAiDeepWaterAudit}
              className="px-3 py-1 rounded-md bg-[var(--ink-accent)] text-white text-xs font-medium hover:opacity-90 flex items-center gap-1 cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>AI 剧情动能深度诊断</span>
            </button>
          )}
          <PluginAiTaskPanel view={aiTask.view} onRetry={aiTask.retry} />
        </div>
      </div>

      {/* 主体滚动区 */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* 指标看板 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl border border-[var(--ink-border)]">
            <span>非空白字符数</span>
            <p>{report.totalWordCount}</p>
          </div>
          <div className="p-3 rounded-xl border border-[var(--ink-border)]">
            <span>字符频率熵（bit/字符）</span>
            <p>{report.entropyScore}</p>
          </div>
          <div className="p-3 rounded-xl border border-[var(--ink-border)]">
            <span>词项覆盖（重叠不重复计算）</span>
            <p>
              {report.matchedCharacters} 字符 · {(report.clicheRatio * 100).toFixed(1)}%
            </p>
          </div>
          <div className="p-3 rounded-xl border border-[var(--ink-border)]">
            <span>动作词表字符占比</span>
            <p>{(report.actionVerbRatio * 100).toFixed(1)}%</p>
          </div>
        </div>

        {/* 文本输入与脱水区 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 左栏：文本输入 (7 列) */}
          <div className="lg:col-span-7 p-4 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--ink-text)] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[var(--ink-accent)]" />
                正文待审段落（当前字数：{report.totalWordCount}）
              </span>
              <span className="text-[11px] text-[var(--ink-text-muted)]">
                逐处预览修改，不按词表批量删字。
              </span>
            </div>

            <textarea
              rows={10}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="在此粘贴本章全文或段落..."
              className="w-full p-3 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)] leading-relaxed resize-none focus:outline-none"
            />

            {/* 写作建议 */}
            <div className="p-3 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] space-y-1 text-xs">
              <span className="font-semibold text-[var(--ink-text)] flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                原文复核：
              </span>
              {report.advice.map((adv, i) => (
                <p
                  key={i}
                  className="text-[11px] text-[var(--ink-text-muted)] flex items-start gap-1"
                >
                  <span className="text-[var(--ink-accent)]">•</span>
                  <span>{adv}</span>
                </p>
              ))}
            </div>
          </div>

          {/* 右栏：抓捕到的水文列表 (5 列) */}
          <div className="lg:col-span-5 p-4 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--ink-text)] flex items-center gap-1.5">
                <Droplet className="w-3.5 h-3.5 text-cyan-500" />
                可定位的词项 ({report.bloatItems.length})
              </span>
            </div>

            {report.bloatItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--ink-text-muted)]">
                词表没有命中；这不能判断文本质量或叙事作用。
              </div>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {report.bloatItems.map((item, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-canvas)] text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-rose-400">“{item.text}”</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-500">
                        {item.type === 'phantom'
                          ? '假动作套话'
                          : item.type === 'recap'
                            ? '设定重述'
                            : '修饰堆叠'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item)}
                      className="text-xs text-[var(--ink-accent)]"
                    >
                      移除该处词项（预览）
                    </button>
                    <p className="text-[11px] text-[var(--ink-text-muted)] leading-tight">
                      {item.reason}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
