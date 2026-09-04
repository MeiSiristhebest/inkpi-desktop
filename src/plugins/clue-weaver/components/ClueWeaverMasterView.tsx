import { useState, useEffect, type FC } from 'react'
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
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import {
  Network,
  Plus,
  Trash2,
  AlertTriangle,
  Users,
  Search,
  CheckCircle2,
} from 'lucide-react'

export const ClueWeaverMasterView: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const [clues, setClues] = useState<ClueItem[]>([])
  const [cognitions, setCognitions] = useState<ClueCognitionRecord[]>([])
  const [characters, setCharacters] = useState<Array<{ id: string; name: string }>>([])

  // 新建线索表单
  const [newTitle, setNewTitle] = useState('')
  const [newCategory, setNewCategory] = useState<ClueItem['category']>('conspiracy')
  const [newKeywords, setNewKeywords] = useState('')

  // 视角泄露扫描
  const [scanText, setScanText] = useState(
    '陆沉冷笑道：“师兄，你当真以为太上长老是走火入魔？那分明是中了九幽冥毒！”'
  )
  const [violations, setViolations] = useState<GodViewViolation[]>([])

  // 信息优势比对
  const [charA, setCharA] = useState('')
  const [charB, setCharB] = useState('')
  const [advantage, setAdvantage] = useState<InformationAdvantage | null>(null)

  const loadAll = async () => {
    try {
      const [allClues, allCogs, allCodex] = await Promise.all([
        indexedDbClueWeaverRepository.getAllClues(projectId),
        indexedDbClueWeaverRepository.getAllCognitions(projectId),
        indexedDbCodexEntityRepository.getAll(),
      ])
      setClues(allClues)
      setCognitions(allCogs)

      const chars = allCodex
        .filter((e) => (!e.projectId || e.projectId === projectId) && e.category === 'character')
        .map((e) => ({ id: e.id, name: e.name }))

      // 若世界观无角色，补充默认两位演示
      if (chars.length === 0) {
        chars.push({ id: 'c-demo-1', name: '陆沉' }, { id: 'c-demo-2', name: '林夕' })
      }
      setCharacters(chars)
      if (!charA && chars.length > 0) setCharA(chars[0].name)
      if (!charB && chars.length > 1) setCharB(chars[1].name)
    } catch (e) {
      console.error('Failed to load clue weaver data:', e)
    }
  }

  useEffect(() => {
    loadAll()
  }, [projectId])

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

    await indexedDbClueWeaverRepository.saveClue(item)
    setNewTitle('')
    setNewKeywords('')
    await loadAll()
  }

  const handleDeleteClue = async (id: string) => {
    await indexedDbClueWeaverRepository.deleteClue(id)
    await loadAll()
  }

  const handleToggleState = async (charId: string, charName: string, clueId: string) => {
    const existing = cognitions.find(
      (c) => c.clueId === clueId && (c.characterId === charId || c.characterName === charName)
    )

    let nextState: EpistemicState = 'known'
    if (existing) {
      if (existing.epistemicState === 'blind') nextState = 'suspected'
      else if (existing.epistemicState === 'suspected') nextState = 'known'
      else nextState = 'blind'
    }

    const rec: ClueCognitionRecord = {
      id: existing ? existing.id : idGenerator.generate('cog'),
      projectId,
      clueId,
      characterId: charId,
      characterName: charName,
      epistemicState: nextState,
      updatedAt: clock.now(),
    }

    await indexedDbClueWeaverRepository.saveCognition(rec)
    await loadAll()
  }

  const handleScanText = () => {
    const found = clueWeaverEngine.scanGodViewLeakage(scanText, clues, cognitions)
    setViolations(found)
  }

  const handleCalcAdvantage = () => {
    if (!charA || !charB) return
    const aObj = characters.find((c) => c.name === charA)
    const bObj = characters.find((c) => c.name === charB)
    const res = clueWeaverEngine.computeAdvantage(
      aObj?.id || charA,
      charA,
      bObj?.id || charB,
      charB,
      clues,
      cognitions
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
              认识论模态逻辑 · 天降全知巡检
            </span>
          </div>
          <p className="text-xs text-[var(--ink-text-muted)] mt-0.5">
            掌控“谁知道什么”，杜绝全知视角泄露，精准量化多角色情报博弈优势差
          </p>
        </div>
      </div>

      {/* 主体滚动区 */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* 顶部录入栏 */}
        <div className="p-4 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] flex items-center gap-3 text-xs">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="登记核心情报/线索（如：太上长老其实死于中毒）..."
            className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none"
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as any)}
            className="px-2 py-1.5 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)]"
          >
            <option value="conspiracy">阴谋真相</option>
            <option value="murder">凶案疑云</option>
            <option value="identity">真实身份</option>
            <option value="treasure">至宝密藏</option>
            <option value="secret">宗门秘辛</option>
          </select>
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
              <span className="text-[10px] text-[var(--ink-text-muted)]">（点击单元格切换认知）</span>
            </div>
          </div>

          {clues.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--ink-text-muted)]">
              暂无已录入线索。在上方登记线索后，将在此生成多视角认知矩阵。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--ink-border)] bg-[var(--ink-bg-elevated)]">
                    <th className="p-2.5 text-left font-medium text-[var(--ink-text-muted)] w-36">角色 \ 线索</th>
                    {clues.map((c) => (
                      <th key={c.id} className="p-2.5 text-center font-medium text-[var(--ink-text)] min-w-[140px]">
                        <div className="flex items-center justify-center gap-1">
                          <span className="truncate" title={c.title}>{c.title}</span>
                          <button
                            onClick={() => handleDeleteClue(c.id)}
                            className="text-[var(--ink-text-muted)] hover:text-rose-500 p-0.5"
                            title="删除线索"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row) => (
                    <tr key={row.character.id} className="border-b border-[var(--ink-border)]/50 hover:bg-[var(--ink-bg-hover)]/30">
                      <td className="p-2.5 font-medium text-[var(--ink-text)] flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-[var(--ink-text-muted)]" />
                        {row.character.name}
                      </td>
                      {row.clueStates.map((cs) => {
                        const st = cs.state
                        return (
                          <td key={cs.clueId} className="p-2 text-center">
                            <button
                              onClick={() => handleToggleState(row.character.id, row.character.name, cs.clueId)}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                                st === 'known'
                                  ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                                  : st === 'suspected'
                                    ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                                    : 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                              }`}
                            >
                              {st === 'known' ? '🟢 确知' : st === 'suspected' ? '🟡 怀疑' : '🔴 盲区'}
                            </button>
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
              <button
                onClick={handleScanText}
                className="px-3 py-1 rounded-md bg-[var(--ink-accent)] text-white text-xs font-medium hover:opacity-90"
              >
                扫描台词
              </button>
            </div>

            <textarea
              rows={3}
              value={scanText}
              onChange={(e) => setScanText(e.target.value)}
              placeholder="输入含有对白的章节文本（如：某某冷笑道：“...”）..."
              className="w-full p-2.5 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)] resize-none focus:outline-none"
            />

            {violations.length === 0 ? (
              <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-emerald-600 text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>无视角泄露。角色所言皆在认知档案授权范围内。</span>
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
                      <span>【全知泄露】角色“{v.characterName}”提前知道“{v.clueTitle}”！</span>
                    </div>
                    <p className="text-[11px] text-[var(--ink-text)] opacity-90">{v.reason}</p>
                    <p className="text-[10px] text-[var(--ink-text-muted)] italic">抓取台词：{v.snippet}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 右栏：情报差优势决斗 */}
          <div className="lg:col-span-5 p-4 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] space-y-3">
            <span className="text-xs font-semibold text-[var(--ink-text)] block">
              情报不对称优势量化 (IAI)
            </span>
            <div className="flex items-center gap-2 text-xs">
              <select
                value={charA}
                onChange={(e) => setCharA(e.target.value)}
                className="flex-1 px-2 py-1.5 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)]"
              >
                {characters.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
              <span className="text-[var(--ink-text-muted)]">VS</span>
              <select
                value={charB}
                onChange={(e) => setCharB(e.target.value)}
                className="flex-1 px-2 py-1.5 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)]"
              >
                {characters.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
              <button
                onClick={handleCalcAdvantage}
                className="px-3 py-1.5 rounded-md bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] text-xs font-medium hover:border-[var(--ink-accent)]"
              >
                对决比对
              </button>
            </div>

            {advantage && (
              <div className="p-3 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] text-xs space-y-2">
                <div className="flex items-center justify-between font-semibold">
                  <span>情报优势指数:</span>
                  <span className={advantage.advantageScore > 0 ? 'text-emerald-500' : advantage.advantageScore < 0 ? 'text-rose-500' : 'text-amber-500'}>
                    {advantage.advantageScore > 0
                      ? `${advantage.characterA} 压制 +${advantage.advantageScore}`
                      : advantage.advantageScore < 0
                        ? `${advantage.characterB} 压制 ${advantage.advantageScore}`
                        : '势均力敌 0.0'}
                  </span>
                </div>
                <div className="text-[11px] text-[var(--ink-text-muted)] space-y-1">
                  <p>• {advantage.characterA} 独占线索: {advantage.knownByAOnly.length} 条</p>
                  <p>• {advantage.characterB} 独占线索: {advantage.knownByBOnly.length} 条</p>
                  <p>• 双方共有线索: {advantage.mutualKnown.length} 条</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
