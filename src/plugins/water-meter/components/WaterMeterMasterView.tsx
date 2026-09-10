import { semanticTextFromContent } from '../../../domain/content'
import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import type { WaterAuditReport } from '../types'
import { waterMeterEngine } from '../engine/WaterMeterEngine'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { Zap, BookOpen, Bot, Scissors, FileText, Sparkles, Droplet } from 'lucide-react'

export const WaterMeterMasterView: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const hostContext = useOptionalPluginHostContext()
  const [chapters, setChapters] = useState<any[]>([])
  const [selectedChapterId, setSelectedChapterId] = useState<string>('all')
  const [inputText, setInputText] = useState('')
  const [report, setReport] = useState<WaterAuditReport>(() => waterMeterEngine.auditText(''))

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
      const text = semanticTextFromContent(defaultChap.id, defaultChap.content || '', defaultChap.revision)
          setInputText(text)
          setReport(waterMeterEngine.auditText(text))
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
      setInputText(full.slice(0, 15000))
      setReport(waterMeterEngine.auditText(full.slice(0, 15000)))
    } else {
      const chap = chapters.find((c) => c.id === chapId)
      const text = chap?.content || ''
      setInputText(text)
      setReport(waterMeterEngine.auditText(text))
    }
  }

  const handleAudit = () => {
    setReport(waterMeterEngine.auditText(inputText))
  }

  // AI 深度叙事密度排查
  const handleAiDeepWaterAudit = () => {
    if (!inputText.trim()) return
    const chap = chapters.find((c) => c.id === selectedChapterId)
    const analysisInput = {
      chapter: chap ? { id: chap.id, order: chap.order, title: chap.title } : undefined,
      text: inputText.slice(0, 2500),
    }

    if (hostContext?.aiAssistant?.runPluginTask) {
      void hostContext.aiAssistant.runPluginTask('water-meter', analysisInput)
    }
  }

  const handleApplyClean = () => {
    let cleaned = inputText
    for (const item of report.bloatItems) {
      cleaned = cleaned.replaceAll(item.text, '')
    }
    cleaned = cleaned.replace(/\n\s*\n/g, '\n').trim()
    setInputText(cleaned)
    setReport(waterMeterEngine.auditText(cleaned))
  }

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-canvas)] text-[var(--ink-text)] overflow-hidden font-sans">
      {/* 顶栏 */}
      <div className="border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4 shrink-0 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight">信息熵与水分压缩计</h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-500 font-medium">
              叙事动能分析 · 假动作套话排查
            </span>
          </div>
          <p className="text-xs text-[var(--ink-text-muted)] mt-0.5">
            直连全书真实章节，扫描无意义震惊复读与套话水文，提升单章信息密度
          </p>
        </div>

        <div className="flex items-center gap-2">
          {chapters.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--ink-text-muted)]">
              <BookOpen className="w-3.5 h-3.5" />
              <select
                value={selectedChapterId}
                onChange={(e) => handleSelectChapter(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-md bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] text-[var(--ink-text)]"
              >
                <option value="all">全书章节采样</option>
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    第 {c.order} 章 · {c.title || '无题'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={handleAudit}
            className="px-3 py-1 rounded-md bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] hover:border-[var(--ink-accent)] text-xs font-medium flex items-center gap-1 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>深度脱水体检</span>
          </button>

          {hostContext?.aiAssistant?.isAvailable && (
            <button
              onClick={handleAiDeepWaterAudit}
              className="px-3 py-1 rounded-md bg-[var(--ink-accent)] text-white text-xs font-medium hover:opacity-90 flex items-center gap-1 cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>AI 剧情动能深度诊断</span>
            </button>
          )}
        </div>
      </div>

      {/* 主体滚动区 */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* 指标看板 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          <div className="p-3 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)]">
            <span className="text-[11px] text-[var(--ink-text-muted)] block">水分综合评分</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span
                className={`text-xl font-bold ${
                  report.waterScore > 50
                    ? 'text-rose-500'
                    : report.waterScore > 25
                      ? 'text-amber-500'
                      : 'text-emerald-500'
                }`}
              >
                {report.waterScore}
              </span>
              <span className="text-[10px] text-[var(--ink-text-muted)]">
                {report.waterLevel === 'flooded'
                  ? '重度注水'
                  : report.waterLevel === 'watery'
                    ? '明显偏水'
                    : report.waterLevel === 'normal'
                      ? '平稳正常'
                      : '精炼高能'}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)]">
            <span className="text-[11px] text-[var(--ink-text-muted)] block">香农信息熵 (0-8)</span>
            <span className="text-xl font-bold text-blue-400 mt-1 block">
              {report.entropyScore}
            </span>
          </div>

          <div className="p-3 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)]">
            <span className="text-[11px] text-[var(--ink-text-muted)] block">
              动作动词密度 (AVR)
            </span>
            <span className="text-xl font-bold text-indigo-400 mt-1 block">
              {(report.actionVerbRatio * 100).toFixed(1)}%
            </span>
          </div>

          <div className="p-3 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)]">
            <span className="text-[11px] text-[var(--ink-text-muted)] block">套话假动作占比</span>
            <span
              className={`text-xl font-bold mt-1 block ${
                report.clicheRatio > 0.05 ? 'text-rose-500' : 'text-emerald-500'
              }`}
            >
              {(report.clicheRatio * 100).toFixed(1)}%
            </span>
          </div>

          <div className="p-3 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)]">
            <span className="text-[11px] text-[var(--ink-text-muted)] block">预估脱水字数</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-bold text-emerald-500">
                {report.estimatedLeanWordCount}
              </span>
              <span className="text-[10px] text-[var(--ink-text-muted)]">
                (-{report.dehydrationRate}%)
              </span>
            </div>
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
              <button
                onClick={handleApplyClean}
                className="px-2.5 py-1 rounded bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] hover:border-emerald-500 text-emerald-500 text-xs font-medium flex items-center gap-1"
                title="自动剔除已识别出的所有假动作套话"
              >
                <Scissors className="w-3 h-3" />
                一键剔除水词
              </button>
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
                去水提纯优化建议：
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
                抓捕到的冗余水词 ({report.bloatItems.length})
              </span>
            </div>

            {report.bloatItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--ink-text-muted)]">
                暂未发现明显的灌水套话，正文叙事纯度极高！
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
