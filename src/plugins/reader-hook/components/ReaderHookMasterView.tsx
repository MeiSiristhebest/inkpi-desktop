import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import type { HookAnalysisResult, ReaderHookRecord, HookTemplate } from '../types'
import { readerHookEngine } from '../engine/ReaderHookEngine'
import { indexedDbReaderHookRepository } from '../../../adapters/indexedDbReaderHookRepository'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import { clipboardWriter } from '../../../adapters/clipboardWriter'
import {
  Anchor,
  Copy,
  Check,
  Plus,
  Trash2,
  Sparkles,
  Zap,
} from 'lucide-react'

export const ReaderHookMasterView: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const [testText, setTestText] = useState(
    '玉简上的倒计时只剩最后三息，血色巨眼猛然睁开，虚空瞬间撕裂！'
  )
  const [analysis, setAnalysis] = useState<HookAnalysisResult>(() =>
    readerHookEngine.analyzeEnding(testText)
  )
  const [savedHooks, setSavedHooks] = useState<ReaderHookRecord[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [newChapterNum, setNewChapterNum] = useState(1)

  const templates = readerHookEngine.getTemplates()

  const loadSavedHooks = async () => {
    try {
      const all = await indexedDbReaderHookRepository.getAll()
      const filtered = all.filter((h) => !h.projectId || h.projectId === projectId)
      setSavedHooks(filtered)
    } catch (e) {
      console.error('Failed to load reader hooks:', e)
    }
  }

  useEffect(() => {
    loadSavedHooks()
  }, [projectId])

  const handleAudit = () => {
    setAnalysis(readerHookEngine.analyzeEnding(testText))
  }

  const handleSaveHook = async () => {
    if (!testText.trim()) return
    const now = clock.now()
    const record: ReaderHookRecord = {
      id: idGenerator.generate('hook'),
      projectId,
      chapterNumber: Number(newChapterNum),
      hookText: testText.trim(),
      hookType: analysis.hookType,
      tensionScore: analysis.tensionScore,
      analysisAdvice: analysis.feedback,
      createdAt: now,
      updatedAt: now,
    }
    await indexedDbReaderHookRepository.save(record)
    await loadSavedHooks()
  }

  const handleDeleteHook = async (id: string) => {
    await indexedDbReaderHookRepository.delete(id)
    await loadSavedHooks()
  }

  const handleCopy = async (id: string, text: string) => {
    await clipboardWriter.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const handleApplyTemplate = (tpl: HookTemplate) => {
    setTestText(tpl.example)
    setAnalysis(readerHookEngine.analyzeEnding(tpl.example))
  }

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-canvas)] text-[var(--ink-text)] overflow-hidden">
      {/* 顶栏 */}
      <div className="border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4 shrink-0 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight">断章钩子与追读率工坊</h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 font-medium">
              Zeigarnik 效应 · CTI 张力模型
            </span>
          </div>
          <p className="text-xs text-[var(--ink-text-muted)] mt-0.5">
            诊断章尾 300 字悬念张力，避免平淡结章流失读者，掌握网文工业级追更断章技术
          </p>
        </div>
      </div>

      {/* 主体左右分区 */}
      <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左侧：测试与诊断区 (7 列) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-4 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--ink-text)] flex items-center gap-1.5">
                <Anchor className="w-3.5 h-3.5 text-[var(--ink-accent)]" />
                章尾 300 字实时张力推演
              </span>
              <button
                onClick={handleAudit}
                className="px-3 py-1 rounded-md bg-[var(--ink-accent)] text-white text-xs font-medium hover:opacity-90 flex items-center gap-1"
              >
                <Zap className="w-3 h-3" />
                测算 CTI 张力
              </button>
            </div>

            <textarea
              rows={4}
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="在此粘贴或撰写本章尾部文本..."
              className="w-full p-3 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)] resize-none focus:outline-none"
            />

            {/* 诊断看板 */}
            <div className="p-3.5 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">断章张力指数 (CTI):</span>
                  <span
                    className={`text-base font-bold ${
                      analysis.tensionScore >= 85
                        ? 'text-rose-500'
                        : analysis.tensionScore >= 70
                          ? 'text-amber-500'
                          : 'text-[var(--ink-text-muted)]'
                    }`}
                  >
                    {analysis.tensionScore} 分
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      analysis.rating === 'god_tier'
                        ? 'bg-rose-500/20 text-rose-500'
                        : analysis.rating === 'cliffhanger'
                          ? 'bg-amber-500/20 text-amber-500'
                          : 'bg-[var(--ink-bg-canvas)] text-[var(--ink-text-muted)]'
                    }`}
                  >
                    {analysis.rating === 'god_tier'
                      ? '顶级断章狗'
                      : analysis.rating === 'cliffhanger'
                        ? '合格断章'
                        : analysis.rating === 'moderate'
                          ? '平稳留白'
                          : '平淡收场'}
                  </span>
                </div>
                <span className="text-[11px] text-[var(--ink-text-muted)]">
                  分类：{analysis.hookType}
                </span>
              </div>

              <p className="text-xs text-[var(--ink-text)]">{analysis.feedback}</p>

              {analysis.detectedKeywords.length > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--ink-text-muted)] pt-1">
                  <span>抓取关键词：</span>
                  {analysis.detectedKeywords.map((kw, i) => (
                    <span
                      key={i}
                      className="px-1.5 py-0.5 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-amber-500"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              )}

              <div className="pt-2 border-t border-[var(--ink-border)]/50 text-[11px] text-[var(--ink-text-muted)] space-y-1">
                <span className="font-medium text-[var(--ink-text)] block">追读改稿建议：</span>
                {analysis.suggestions.map((sug, i) => (
                  <p key={i} className="flex items-start gap-1">
                    <span className="text-[var(--ink-accent)]">•</span>
                    <span>{sug}</span>
                  </p>
                ))}
              </div>
            </div>

            {/* 保存到钩子库条 */}
            <div className="flex items-center gap-2 pt-2 text-xs">
              <span className="text-[var(--ink-text-muted)]">目标章节号:</span>
              <input
                type="number"
                min="1"
                value={newChapterNum}
                onChange={(e) => setNewChapterNum(Number(e.target.value))}
                className="w-16 px-2 py-1 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)]"
              />
              <button
                onClick={handleSaveHook}
                className="px-3 py-1 rounded-md bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] hover:border-[var(--ink-accent)] text-xs font-medium flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5 text-[var(--ink-accent)]" />
                入库本章断章
              </button>
            </div>
          </div>

          {/* 已归档钩子列表 */}
          <div className="p-4 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] space-y-3">
            <h3 className="text-xs font-semibold text-[var(--ink-text)]">全书已入库断章记录 ({savedHooks.length})</h3>
            {savedHooks.length === 0 ? (
              <p className="text-xs text-[var(--ink-text-muted)]">暂无入库断章。将满意的断章结语保存以便前后审视。</p>
            ) : (
              <div className="space-y-2">
                {savedHooks.map((h) => (
                  <div
                    key={h.id}
                    className="p-2.5 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-canvas)] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-[var(--ink-accent)]">第 {h.chapterNumber || 1} 章</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-500">
                          {h.hookType}
                        </span>
                        <span className="text-[11px] text-[var(--ink-text-muted)]">CTI: {h.tensionScore} 分</span>
                      </div>
                      <p className="text-[11px] text-[var(--ink-text)] truncate">{h.hookText}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteHook(h.id)}
                      className="text-[var(--ink-text-muted)] hover:text-rose-500 p-1"
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 右侧：6 大范式模板库 (5 列) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-text)]">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>网文 6 大高张力断章范式</span>
          </div>

          <div className="space-y-3">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="p-3.5 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] space-y-2 text-xs hover:border-[var(--ink-accent)]/50 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--ink-text)]">{tpl.name}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleApplyTemplate(tpl)}
                      className="px-2 py-0.5 rounded bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] hover:bg-[var(--ink-bg-hover)] text-[11px] text-[var(--ink-text)]"
                    >
                      载入测算
                    </button>
                    <button
                      onClick={() => handleCopy(tpl.id, tpl.example)}
                      className="p-1 rounded text-[var(--ink-text-muted)] hover:text-[var(--ink-text)]"
                      title="复制例句"
                    >
                      {copiedId === tpl.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-[var(--ink-text-muted)]">{tpl.description}</p>
                <div className="p-2 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)]/60 text-[11px] italic text-[var(--ink-text)] leading-relaxed">
                  “{tpl.example}”
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
