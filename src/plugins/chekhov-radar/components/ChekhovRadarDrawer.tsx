import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { ChekhovRadarEngine } from '../engine/ChekhovRadarEngine'
import type { ChekhovGunRecord } from '../../../ports/chekhovGunRepository'
import { indexedDbChekhovGunRepository } from '../../../adapters/indexedDbChekhovGunRepository'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import { Crosshair, Sparkles, CheckCircle2, Flame, Plus } from 'lucide-react'

export const ChekhovRadarDrawer: FC<DesktopPluginDrawerProps> = (props) => (
  <ProjectRadarDrawer key={props.projectId} {...props} />
)
const ProjectRadarDrawer: FC<DesktopPluginDrawerProps> = ({
  projectId,
  currentText,
  currentChapterNumber,
}) => {
  const [guns, setGuns] = useState<ChekhovGunRecord[]>([])
  const [justPlanted, setJustPlanted] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [quote, setQuote] = useState('')
  useEffect(() => {
    setNote('')
    setQuote('')
    setJustPlanted(null)
  }, [currentText, currentChapterNumber])
  const chapter =
    currentChapterNumber != null &&
    Number.isSafeInteger(currentChapterNumber) &&
    currentChapterNumber > 0
      ? currentChapterNumber
      : null

  const loadGuns = async () => {
    const all = await indexedDbChekhovGunRepository.getAll(projectId)
    setGuns(all)
  }

  useEffect(() => {
    void loadGuns().catch(() => setError('伏笔档案加载失败。'))
  }, [projectId])

  const mentionedGuns = ChekhovRadarEngine.checkMentionedGuns(guns, currentText || '')
  const detectedSuggestions = ChekhovRadarEngine.detectPotentialGuns(currentText || '').filter(
    (suggestion) => !guns.some((gun) => gun.gunName === suggestion.gunName),
  )

  const handleQuickPlant = async (
    name: string,
    category: ChekhovGunRecord['category'],
    snippet: string,
  ) => {
    if (chapter === null || !currentText.includes(snippet)) return
    const newRecord: ChekhovGunRecord = {
      id: idGenerator.generate('gun'),
      projectId,
      gunName: name,
      category,
      status: 'dormant',
      plantChapterOrder: chapter,
      plantSnippet: snippet,
      rustingDistance: 0,
      isRustingAlert: false,
      updatedAt: clock.now(),
    }
    try {
      await indexedDbChekhovGunRepository.save(newRecord)
    } catch {
      setError('保存失败，伏笔尚未登记。')
      return
    }
    setJustPlanted(name)
    await loadGuns().catch(() => setError('保存成功，重新加载失败。'))
  }

  const handleQuickFire = async (gun: ChekhovGunRecord) => {
    if (chapter === null || !note.trim() || !quote.trim() || !currentText.includes(quote)) return
    const updated: ChekhovGunRecord = {
      ...gun,
      status: 'fired',
      actualFiredChapterOrder: chapter,
      firedSnippet: quote,
      notes: [gun.notes, `作者兑现说明：${note.trim()}`].filter(Boolean).join('\n'),
      updatedAt: clock.now(),
    }
    try {
      await indexedDbChekhovGunRepository.save(updated)
      setNote('')
      setQuote('')
      await loadGuns()
    } catch {
      setError('兑现记录保存失败，请重试。')
    }
  }

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-panel)] text-[var(--ink-text)] overflow-y-auto p-4 space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-[var(--ink-border)] pb-2">
        <span className="font-semibold text-sm flex items-center gap-1.5 text-rose-500">
          <Crosshair className="w-4 h-4" /> 契诃夫伏笔随动感知
        </span>
        <span className="text-[10px] text-[var(--ink-text-muted)]">{guns.length} 柄伏笔枪在册</span>
      </div>
      {error && <p role="alert">{error}</p>}
      <p>
        {chapter === null ? '当前章节未提供，不能登记位置。' : `当前第 ${chapter} 章。`}
        提及不等于兑现。
      </p>
      <label className="block">
        兑现说明
        <input
          aria-label="伏笔兑现说明"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full p-1 bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)]"
        />
      </label>
      <label className="block">
        兑现原文
        <textarea
          aria-label="伏笔兑现原文"
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          className="w-full p-1 bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)]"
        />
      </label>

      {justPlanted && (
        <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded text-[11px] flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> 已成功登记伏笔：“{justPlanted}”
        </div>
      )}

      {/* 本文提及的待引爆伏笔 */}
      {mentionedGuns.length > 0 && (
        <div className="space-y-1.5">
          <div className="font-semibold text-[11px] text-amber-500 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5" /> 本段正文提及了以下在册伏笔：
          </div>
          <div className="space-y-1.5">
            {mentionedGuns.map((gun) => (
              <div
                key={gun.id}
                className="p-2 rounded bg-[var(--ink-bg-canvas)] border border-amber-500/30 flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-[11px] text-[var(--ink-text)]">
                    {gun.gunName}
                  </div>
                  <div className="text-[9px] text-[var(--ink-text-muted)]">
                    第 {gun.plantChapterOrder} 章埋下 (跨度 {gun.rustingDistance} 章)
                  </div>
                </div>
                <button
                  onClick={() => handleQuickFire(gun)}
                  disabled={
                    chapter === null ||
                    !note.trim() ||
                    !quote.trim() ||
                    !currentText.includes(quote)
                  }
                  className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-medium transition"
                >
                  确认引爆
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 智能识别到的待埋伏笔 */}
      {detectedSuggestions.length > 0 && (
        <div className="space-y-1.5">
          <div className="font-semibold text-[11px] text-[var(--ink-text-muted)] flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" /> 文本特征自动捕捉到的潜在伏笔：
          </div>
          <div className="space-y-1.5">
            {detectedSuggestions.map((sug, idx) => (
              <div
                key={idx}
                className="p-2 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[11px] text-[var(--ink-text)]">
                    {sug.gunName}
                  </span>
                  <button
                    onClick={() => handleQuickPlant(sug.gunName, sug.category, sug.snippet)}
                    disabled={chapter === null}
                    className="p-1 rounded bg-rose-500 hover:bg-rose-600 text-white text-[10px] flex items-center gap-0.5 transition"
                  >
                    <Plus className="w-3 h-3" /> 建立伏笔
                  </button>
                </div>
                <p className="text-[10px] text-[var(--ink-text-muted)]">{sug.reason}</p>
                <p>
                  原文 [{sug.startOffset}, {sug.endOffset})：{sug.snippet}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {mentionedGuns.length === 0 && detectedSuggestions.length === 0 && (
        <div className="py-6 text-center text-[var(--ink-text-muted)] text-[11px]">
          未找到匹配词项。其他伏笔仍需结合语境检查。
        </div>
      )}
    </div>
  )
}
