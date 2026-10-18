import { semanticTextFromContent } from '../../../domain/content'
import { useState, useEffect, useRef, type FC } from 'react'
import {
  projectChapterSequence,
  type PositionedChapter,
} from '../../../domain/chapter/chapterSequence'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import type {
  ClueItem,
  ClueCognitionRecord,
  EpistemicState,
  GodViewViolation,
  InformationAdvantage,
} from '../types'
import { clueWeaverEngine } from '../engine/ClueWeaverEngine'
import { indexedDbClueWeaverRepository } from '../../../adapters/indexedDbClueWeaverRepository'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { usePluginAiTask } from '../../../core/usePluginAiTask'
import { PluginAiTaskPanel } from '../../../components/plugins/PluginAiTaskPanel'
import {
  Network,
  Plus,
  Trash2,
  AlertTriangle,
  Users,
  Search,
  CheckCircle2,
  Bot,
} from 'lucide-react'
import { ScoreProvenanceBadge } from '../../../ui/atoms'
import { Select, Tooltip } from '../../../ui/primitives'

export const ClueWeaverMasterView: FC<DesktopPluginViewProps> = (props) => (
  <ClueWeaverProjectView key={props.projectId} {...props} />
)

const ClueWeaverProjectView: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const hostContext = useOptionalPluginHostContext()
  const [clues, setClues] = useState<ClueItem[]>([])
  const [cognitions, setCognitions] = useState<ClueCognitionRecord[]>([])
  const [characters, setCharacters] = useState<Array<{ id: string; name: string }>>([])
  const [chapters, setChapters] = useState<PositionedChapter[]>([])
  const [selectedChapterId, setSelectedChapterId] = useState<string>('all')

  // 新建线索表单
  const [newTitle, setNewTitle] = useState('')
  const [newCategory, setNewCategory] = useState<ClueItem['category']>('conspiracy')
  const [newKeywords, setNewKeywords] = useState('')

  // 视角泄露扫描
  const [scanText, setScanText] = useState('')
  const [manualChapter, setManualChapter] = useState('')
  const [error, setError] = useState('')
  const active = useRef(true)
  const [report, setReport] = useState<{ scope: string; violations: GodViewViolation[] } | null>(
    null,
  )
  const scanScope = JSON.stringify([
    scanText,
    selectedChapterId,
    manualChapter,
    clues,
    cognitions,
    chapters,
  ])
  const violations = report?.scope === scanScope ? report.violations : null

  // 信息优势比对
  const [charA, setCharA] = useState('')
  const [charB, setCharB] = useState('')
  const [advantage, setAdvantage] = useState<InformationAdvantage | null>(null)
  const aiTask = usePluginAiTask('clue-weaver', [
    projectId,
    scanText,
    clues,
    cognitions,
    selectedChapterId,
    chapters,
  ])

  const loadAll = async () => {
    try {
      const [allClues, allCogs, allCodex, allChapters, volumes] = await Promise.all([
        indexedDbClueWeaverRepository.getAllClues(projectId),
        indexedDbClueWeaverRepository.getAllCognitions(projectId),
        indexedDbCodexEntityRepository.getAll(),
        indexedDbProjectRepository.getChaptersByProject(projectId),
        indexedDbProjectRepository.getVolumesByProject(projectId),
      ])
      if (!active.current) return
      setClues(allClues)
      setCognitions(allCogs)

      setChapters(projectChapterSequence(projectId, allChapters, volumes))

      const chars = allCodex
        .filter((e) => e.projectId === projectId && e.category === 'character')
        .map((e) => ({ id: e.id, name: e.name }))

      setCharacters(chars)
      if (!charA && chars.length > 0) setCharA(chars[0].name)
      if (!charB && chars.length > 1) setCharB(chars[1].name)
    } catch (e) {
      if (active.current) setError('线索档案加载失败，请重试。')
    }
  }

  const handleSelectChapter = (chapId: string) => {
    setSelectedChapterId(chapId)
  }

  useEffect(() => {
    if (selectedChapterId === 'manual') return
    const selected =
      selectedChapterId === 'all' ? chapters : chapters.filter((c) => c.id === selectedChapterId)
    setScanText(
      selected.map((c) => semanticTextFromContent(c.id, c.content, c.revision)).join('\n\n'),
    )
  }, [chapters, selectedChapterId])

  // AI 深度推演：检查全书信息差悬念与视点越权
  const handleAiDeepLeakAudit = async () => {
    if (!scanText.trim()) return
    const analysisInput = {
      clues,
      cognitions,
      characters,
      chapterSources:
        selectedChapterId === 'manual'
          ? []
          : chapters
              .filter((c) => selectedChapterId === 'all' || c.id === selectedChapterId)
              .map((c) => ({
                id: c.id,
                chapterNumber: c.chapterNumber,
                revision: c.revision,
                text: semanticTextFromContent(c.id, c.content, c.revision),
              })),
      manualChapter: selectedChapterId === 'manual' ? manualChapter : null,
      text: semanticTextFromContent(selectedChapterId, scanText, 0),
    }

    await aiTask.run(analysisInput)
  }

  useEffect(() => {
    active.current = true
    loadAll()
    return () => {
      active.current = false
    }
  }, [projectId])

  const persist = async (operation: () => Promise<void>) => {
    setError('')
    try {
      await operation()
      await loadAll()
    } catch {
      if (active.current) setError('保存失败，修改尚未写入。请重试。')
    }
  }

  const handleCreateClue = async () => {
    if (!newTitle.trim()) return
    const now = clock.now()
    const kwList = newKeywords
      .split(/[,，、\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)

    const item: ClueItem = {
      id: idGenerator.generate('clue'),
      projectId,
      title: newTitle.trim(),
      category: newCategory,
      description: '',
      keywords: kwList.length > 0 ? kwList : [newTitle.trim()],
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }

    await persist(async () => {
      await indexedDbClueWeaverRepository.saveClue(item)
      setNewTitle('')
      setNewKeywords('')
    })
  }

  const handleDeleteClue = async (id: string) => {
    await persist(() => indexedDbClueWeaverRepository.deleteClue(id))
  }

  const handleToggleState = async (charId: string, charName: string, clueId: string) => {
    const existing = cognitions.find(
      (c) => c.clueId === clueId && (c.characterId === charId || c.characterName === charName),
    )

    let nextState: EpistemicState = 'known'
    if (existing) {
      if (existing.epistemicState === 'blind') nextState = 'suspected'
      else if (existing.epistemicState === 'suspected') nextState = 'known'
      else nextState = 'blind'
    }

    const rec: ClueCognitionRecord = {
      ...(existing ?? {}),
      id: existing ? existing.id : idGenerator.generate('cog'),
      projectId,
      clueId,
      characterId: charId,
      characterName: charName,
      epistemicState: nextState,
      updatedAt: clock.now(),
    }

    await persist(() => indexedDbClueWeaverRepository.saveCognition(rec))
  }

  const handleKnowledgeDetails = async (
    record: ClueCognitionRecord,
    field: 'learnedAtChapter' | 'notes',
    value: string,
  ) => {
    const chapter = value.trim() ? Number(value) : undefined
    if (
      field === 'learnedAtChapter' &&
      chapter !== undefined &&
      (!Number.isSafeInteger(chapter) || chapter < 1)
    ) {
      setError('获知章节须为正整数，留空表示未登记。')
      return
    }
    await persist(() =>
      indexedDbClueWeaverRepository.saveCognition({
        ...record,
        [field]: field === 'notes' ? value : chapter,
        updatedAt: clock.now(),
      }),
    )
  }

  const handleScanText = () => {
    if (selectedChapterId === 'manual') {
      const chapter = manualChapter.trim() ? Number(manualChapter) : undefined
      if (chapter !== undefined && (!Number.isSafeInteger(chapter) || chapter < 1)) {
        setError('片段章节须为正整数。')
        return
      }
      setReport({
        scope: scanScope,
        violations: clueWeaverEngine.scanGodViewLeakage(scanText, clues, cognitions, chapter),
      })
    } else {
      let offset = 0
      const found = chapters
        .filter((c) => selectedChapterId === 'all' || c.id === selectedChapterId)
        .flatMap((c) => {
          const text = semanticTextFromContent(c.id, c.content, c.revision)
          const matches = clueWeaverEngine
            .scanGodViewLeakage(text, clues, cognitions, c.chapterNumber ?? undefined)
            .map((v) => ({
              ...v,
              chapterNumber: c.chapterNumber ?? undefined,
              startOffset: v.startOffset + offset,
              endOffset: v.endOffset + offset,
            }))
          offset += text.length + 2
          return matches
        })
      setReport({ scope: scanScope, violations: found })
    }
  }

  const handleCalcAdvantage = () => {
    if (!charA || !charB || charA === charB) return
    const aObj = characters.find((c) => c.name === charA)
    const bObj = characters.find((c) => c.name === charB)
    const res = clueWeaverEngine.computeAdvantage(
      aObj?.id || charA,
      charA,
      bObj?.id || charB,
      charB,
      clues,
      cognitions,
    )
    setAdvantage(res)
  }

  const matrix = clueWeaverEngine.getCognitionMatrix(characters, clues, cognitions)

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-canvas)] text-[var(--ink-text)] overflow-hidden">
      {/* 顶栏 */}
      <div className="border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4 shrink-0 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight">信息差与认知织机</h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-500 font-medium">
              线索掌握状态与信息差检查
            </span>
          </div>
          <p className="text-xs text-[var(--ink-text-muted)] mt-0.5">
            记录角色掌握的线索，并按收录与回收条目展示信息差。结果需要作者复核。
          </p>
          <ScoreProvenanceBadge source="rule" detail="按线索条目的收录与回收计数推算" />
        </div>
      </div>

      {/* 主体滚动区 */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {error && <p role="alert">{error}</p>}
        {/* 顶部录入栏 */}
        <div className="p-4 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] flex items-center gap-3 text-xs">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="登记核心情报/线索（如：太上长老其实死于中毒）..."
            className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none"
          />
          <Select
            aria-label="线索分类"
            value={newCategory}
            onValueChange={(v) => setNewCategory(v as any)}
            size="sm"
          >
            <option value="conspiracy">阴谋真相</option>
            <option value="murder">凶案疑云</option>
            <option value="identity">真实身份</option>
            <option value="treasure">至宝密藏</option>
            <option value="secret">宗门秘辛</option>
          </Select>
          <input
            type="text"
            value={newKeywords}
            onChange={(e) => setNewKeywords(e.target.value)}
            placeholder="关键词（逗号分隔，如：九幽冥毒, 中毒）"
            className="w-64 px-3 py-1.5 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none"
          />
          <button
            onClick={handleCreateClue}
            className="px-3 py-1.5 rounded-lg bg-[var(--ink-accent)] text-white font-medium hover:opacity-90 flex items-center gap-1 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> 登记线索
          </button>
        </div>

        {/* 2D 认知矩阵网格 (Who Knows What) */}
        <div className="p-4 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--ink-text)] flex items-center gap-1.5">
              <Network className="w-3.5 h-3.5 text-[var(--ink-accent)]" />
              多视角认知矩阵 (Who Knows What)
            </span>
            <div className="flex items-center gap-3 text-[11px] text-[var(--ink-text-muted)]">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> 确知 (Known)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> 怀疑 (Suspected)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> 盲区 (Blind)
              </span>
              <span className="text-[10px] text-[var(--ink-text-muted)]">
                （点击单元格切换认知）
              </span>
            </div>
          </div>

          {characters.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--ink-text-muted)]">
              请先在活体世界观中添加角色，再记录每个角色掌握的线索。
            </div>
          ) : clues.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--ink-text-muted)]">
              暂无已录入线索。在上方登记线索后，将在此生成多视角认知矩阵。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--ink-border)] bg-[var(--ink-bg-elevated)]">
                    <th className="p-2.5 text-left font-medium text-[var(--ink-text-muted)] w-36">
                      角色 \ 线索
                    </th>
                    {clues.map((c) => (
                      <th
                        key={c.id}
                        className="p-2.5 text-center font-medium text-[var(--ink-text)] min-w-[140px]"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <Tooltip content={c.title}>
                            <span className="truncate">{c.title}</span>
                          </Tooltip>
                          <Tooltip content="删除线索">
                            <button
                              onClick={() => handleDeleteClue(c.id)}
                              className="text-[var(--ink-text-muted)] hover:text-rose-500 p-0.5"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </Tooltip>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row) => (
                    <tr
                      key={row.character.id}
                      className="border-b border-[var(--ink-border)]/50 hover:bg-[var(--ink-bg-hover)]/30"
                    >
                      <td className="p-2.5 font-medium text-[var(--ink-text)] flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-[var(--ink-text-muted)]" />
                        {row.character.name}
                      </td>
                      {row.clueStates.map((cs) => {
                        const st = cs.state
                        const record = cognitions.find(
                          (c) => c.clueId === cs.clueId && c.characterId === row.character.id,
                        )
                        return (
                          <td key={cs.clueId} className="p-2 text-center">
                            <button
                              onClick={() =>
                                handleToggleState(row.character.id, row.character.name, cs.clueId)
                              }
                              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                                st === 'known'
                                  ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                                  : st === 'suspected'
                                    ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                                    : 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                              }`}
                            >
                              {st === 'known'
                                ? '🟢 确知'
                                : st === 'suspected'
                                  ? '🟡 怀疑'
                                  : st === 'blind'
                                    ? '🔴 盲区'
                                    : '未登记'}
                            </button>
                            {record && (
                              <div className="space-y-1 mt-1">
                                <input
                                  key={`chapter-${record.updatedAt}`}
                                  aria-label={`${row.character.name} 获知 ${cs.clueId} 的章节`}
                                  defaultValue={record.learnedAtChapter ?? ''}
                                  placeholder="获知章节"
                                  onBlur={(e) => {
                                    if (e.target.value !== String(record.learnedAtChapter ?? ''))
                                      void handleKnowledgeDetails(
                                        record,
                                        'learnedAtChapter',
                                        e.target.value,
                                      )
                                  }}
                                  className="w-24 bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] p-1"
                                />
                                <input
                                  key={`notes-${record.updatedAt}`}
                                  aria-label={`${row.character.name} 获知 ${cs.clueId} 的来源`}
                                  defaultValue={record.notes ?? ''}
                                  placeholder="获知来源"
                                  onBlur={(e) => {
                                    if (e.target.value !== (record.notes ?? ''))
                                      void handleKnowledgeDetails(record, 'notes', e.target.value)
                                  }}
                                  className="w-32 bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] p-1"
                                />
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 底部两栏：视角泄露扫描器 (7列) + 信息优势比对 (5列) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 左栏：天降全知巡检 */}
          <div className="lg:col-span-7 p-4 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--ink-text)] flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-rose-500" />
                天降全知实时巡检 (God-view Leakage Scan)
              </span>
              <div className="flex items-center gap-2">
                {chapters.length > 0 && (
                  <Select
                    aria-label="筛选章节"
                    value={selectedChapterId}
                    onValueChange={(v) => handleSelectChapter(v)}
                    size="sm"
                  >
                    <option value="all">全书章节采样</option>
                    <option value="manual">手动片段</option>
                    {chapters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.chapterNumber == null ? '位置未知' : `第 ${c.chapterNumber} 章`} ·{' '}
                        {c.title || '无题'}
                      </option>
                    ))}
                  </Select>
                )}
                <button
                  onClick={handleScanText}
                  className="px-2.5 py-1 rounded-md bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] text-xs font-medium hover:border-[var(--ink-accent)] cursor-pointer"
                >
                  规则扫描
                </button>
                {hostContext?.aiAssistant?.isAvailable && (
                  <button
                    disabled={aiTask.isRunning}
                    onClick={handleAiDeepLeakAudit}
                    className="px-2.5 py-1 rounded-md bg-[var(--ink-accent)] text-white text-xs font-medium hover:opacity-90 flex items-center gap-1 cursor-pointer"
                  >
                    <Bot className="w-3 h-3" />
                    AI 信息差深查
                  </button>
                )}
                <PluginAiTaskPanel view={aiTask.view} onRetry={aiTask.retry} />
              </div>
            </div>

            <textarea
              rows={3}
              value={scanText}
              onChange={(e) => {
                setSelectedChapterId('manual')
                setScanText(e.target.value)
              }}
              placeholder="自动从所选章节同步，编辑后按手动片段检查..."
              className="w-full p-2.5 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)] resize-none focus:outline-none"
            />
            {selectedChapterId === 'manual' && (
              <label className="block text-xs">
                片段所属章节（留空时不检查获知时间）
                <input
                  aria-label="片段所属章节"
                  value={manualChapter}
                  onChange={(e) => setManualChapter(e.target.value)}
                  className="ml-2 w-20 border border-[var(--ink-border)] bg-[var(--ink-bg-canvas)]"
                />
              </label>
            )}

            {!scanText.trim() ? (
              <div className="p-3 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] text-[var(--ink-text-muted)] text-xs">
                输入正文或选择章节后开始扫描。
              </div>
            ) : violations === null ? (
              <p className="text-xs">正文或档案已变化，请运行检查。</p>
            ) : violations.length === 0 ? (
              <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-emerald-600 text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>未找到匹配候选。未登记知识、未识别的说话人和语义越权仍需作者检查。</span>
              </div>
            ) : (
              <div className="space-y-2">
                {violations.map((v, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs text-rose-500 space-y-1"
                  >
                    <div className="flex items-center gap-1.5 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>
                        待复核：{v.characterName} 的台词提及 {v.clueTitle}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--ink-text)] opacity-90">{v.reason}</p>
                    <p className="text-[10px] text-[var(--ink-text-muted)] italic">
                      {v.chapterNumber ? `第 ${v.chapterNumber} 章；` : ''}原文 [{v.startOffset},{' '}
                      {v.endOffset})：{v.snippet}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 右栏：情报差优势决斗 */}
          <div className="lg:col-span-5 p-4 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] space-y-3">
            <span className="text-xs font-semibold text-[var(--ink-text)] block">
              已登记知情集合对比
            </span>
            <div className="flex items-center gap-2 text-xs">
              <Select
                aria-label="对比角色 A"
                value={charA}
                onValueChange={(v) => setCharA(v)}
                className="flex-1"
                size="sm"
              >
                <option value="" disabled>
                  选择角色
                </option>
                {characters.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <span className="text-[var(--ink-text-muted)]">VS</span>
              <Select
                aria-label="对比角色 B"
                value={charB}
                onValueChange={(v) => setCharB(v)}
                className="flex-1"
                size="sm"
              >
                <option value="" disabled>
                  选择角色
                </option>
                {characters.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <button
                onClick={handleCalcAdvantage}
                disabled={!charA || !charB || charA === charB}
                className="px-3 py-1.5 rounded-md bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] text-xs font-medium hover:border-[var(--ink-accent)]"
              >
                对决比对
              </button>
            </div>

            {advantage && (
              <div className="p-3 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] text-xs space-y-2">
                <div className="flex items-center justify-between font-semibold">
                  <span>已知集合差值占比:</span>
                  <span
                    className={
                      (advantage.advantageScore ?? 0) > 0
                        ? 'text-emerald-500'
                        : (advantage.advantageScore ?? 0) < 0
                          ? 'text-rose-500'
                          : 'text-amber-500'
                    }
                  >
                    {advantage.advantageScore === null
                      ? '记录不足，无法计算'
                      : advantage.advantageScore}
                  </span>
                </div>
                <div className="text-[11px] text-[var(--ink-text-muted)] space-y-1">
                  <p>
                    • {advantage.characterA} 独占线索: {advantage.knownByAOnly.length} 条
                  </p>
                  <p>
                    • {advantage.characterB} 独占线索: {advantage.knownByBOnly.length} 条
                  </p>
                  <p>• 双方共有线索: {advantage.mutualKnown.length} 条</p>
                  <p>
                    • 未登记的角色与线索组合: {advantage.unrecordedPairs}；数量差不代表战术优势。
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
