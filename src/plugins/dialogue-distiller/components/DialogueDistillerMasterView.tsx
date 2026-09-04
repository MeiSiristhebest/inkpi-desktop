import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import type { CharacterVoiceprint, SimilarityPair } from '../types'
import { dialogueDistillerEngine } from '../engine/DialogueDistillerEngine'
import { indexedDbDialogueVoiceprintRepository } from '../../../adapters/indexedDbDialogueVoiceprintRepository'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'
import {
  Mic,
  Users,
  Search,
  Zap,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'

const DEMO_EXTRACT_TEXT = `陆沉冷笑道：“师兄，你当真以为九品金丹是那么好拿的吗？！受死吧！”
林夕叹道：“师弟，你着相了。老夫纵横三千载，尔等所求，不过是过眼云烟罢了。”
王铁柱吼道：“少废话！老子今天就要砍了你这厮！看刀！”`

export const DialogueDistillerMasterView: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const [characterNames, setCharacterNames] = useState<string[]>([])
  const [voiceprints, setVoiceprints] = useState<CharacterVoiceprint[]>([])
  const [extractText, setExtractText] = useState(DEMO_EXTRACT_TEXT)
  const [charA, setCharA] = useState('')
  const [charB, setCharB] = useState('')
  const [comparison, setComparison] = useState<SimilarityPair | null>(null)

  const presets = dialogueDistillerEngine.getPresets()

  const loadAll = async () => {
    try {
      const [allCodex, allVps] = await Promise.all([
        indexedDbCodexEntityRepository.getAll(),
        indexedDbDialogueVoiceprintRepository.getAll(projectId),
      ])

      const chars = allCodex
        .filter((e) => e.projectId === projectId && e.category === 'character')
        .map((e) => e.name)

      const finalNames = chars.length > 0 ? chars : ['陆沉', '林夕', '王铁柱']
      setCharacterNames(finalNames)
      setVoiceprints(allVps)

      if (finalNames.length >= 2) {
        setCharA(finalNames[0])
        setCharB(finalNames[1])
      }
    } catch (e) {
      console.error('Failed to load dialogue distiller data:', e)
    }
  }

  useEffect(() => {
    loadAll()
  }, [projectId])

  const handleExtractFromText = () => {
    const quotes = dialogueDistillerEngine.extractCharacterQuotes(extractText, characterNames)
    const newVps: CharacterVoiceprint[] = []

    for (const name of characterNames) {
      const charQuotes = quotes[name] || []
      if (charQuotes.length > 0) {
        const vp = dialogueDistillerEngine.computeVoiceprint(name, charQuotes, projectId)
        newVps.push(vp)
      }
    }

    if (newVps.length > 0) {
      setVoiceprints(newVps)
      // 若当前比对角色存在于抽取结果中，自动触发比对
      if (charA && charB) {
        triggerCompare(charA, charB, newVps)
      }
    }
  }

  const triggerCompare = (nameA: string, nameB: string, currentVps = voiceprints) => {
    const vpA = currentVps.find((v) => v.characterName === nameA)
    const vpB = currentVps.find((v) => v.characterName === nameB)

    const vecA = vpA
      ? {
          asl: vpA.averageSentenceLength,
          questionRatio: vpA.questionRatio,
          exclamationRatio: vpA.exclamationRatio,
          archaicRatio: vpA.toneStyle === 'archaic' ? 0.35 : 0.05,
          colloquialRatio: vpA.toneStyle === 'colloquial' ? 0.35 : 0.05,
        }
      : { asl: 12, questionRatio: 0.2, exclamationRatio: 0.2, archaicRatio: 0.1, colloquialRatio: 0.1 }

    const vecB = vpB
      ? {
          asl: vpB.averageSentenceLength,
          questionRatio: vpB.questionRatio,
          exclamationRatio: vpB.exclamationRatio,
          archaicRatio: vpB.toneStyle === 'archaic' ? 0.35 : 0.05,
          colloquialRatio: vpB.toneStyle === 'colloquial' ? 0.35 : 0.05,
        }
      : { asl: 12, questionRatio: 0.2, exclamationRatio: 0.2, archaicRatio: 0.1, colloquialRatio: 0.1 }

    const res = dialogueDistillerEngine.comparePair(nameA, vecA, nameB, vecB)
    setComparison(res)
  }

  const handleCompareClick = () => {
    if (!charA || !charB) return
    triggerCompare(charA, charB)
  }

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-canvas)] text-[var(--ink-text)] overflow-hidden">
      {/* 顶栏 */}
      <div className="border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4 shrink-0 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight">角色对白声纹分析仪</h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-500 font-medium">
              言语风格测度学 · 去“千人一面”
            </span>
          </div>
          <p className="text-xs text-[var(--ink-text-muted)] mt-0.5">
            提取多角色台词指纹，计算平均句长与语气特征，拦截角色语言同质化硬伤
          </p>
        </div>
      </div>

      {/* 主体滚动区 */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* 台词自动抽取与解析条 */}
        <div className="p-4 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--ink-text)] flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-pink-500" />
              正文多角色台词快速抽取与声纹测算
            </span>
            <button
              onClick={handleExtractFromText}
              className="px-3 py-1 rounded-md bg-[var(--ink-accent)] text-white text-xs font-medium hover:opacity-90 flex items-center gap-1"
            >
              <Zap className="w-3 h-3" />
              提取并解析声纹
            </button>
          </div>

          <textarea
            rows={3}
            value={extractText}
            onChange={(e) => setExtractText(e.target.value)}
            placeholder="粘贴含有角色对白的章节段落（如：陆沉冷笑道：“...”）..."
            className="w-full p-2.5 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)] resize-none focus:outline-none"
          />
        </div>

        {/* 核心双栏：已解析声纹卡片 (7 列) + 声纹余弦比对仪 (5 列) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 左栏：角色声纹卡片列表 */}
          <div className="lg:col-span-7 space-y-3">
            <span className="text-xs font-semibold text-[var(--ink-text)] flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5 text-pink-500" />
              当前角色言语风格特征表 ({characterNames.length} 位角色)
            </span>

            {voiceprints.length === 0 ? (
              <div className="p-8 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] text-center text-xs text-[var(--ink-text-muted)]">
                在上方粘贴正文并点击「提取并解析声纹」，或使用下方声纹预设建立角色语言模型。
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {voiceprints.map((vp) => (
                  <div
                    key={vp.characterName}
                    className="p-3.5 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm flex items-center gap-1 text-[var(--ink-text)]">
                        <Users className="w-3.5 h-3.5 text-pink-500" />
                        {vp.characterName}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 font-medium">
                        {vp.toneStyle === 'archaic'
                          ? '古雅沉缓'
                          : vp.toneStyle === 'aggressive'
                            ? '压迫跋扈'
                            : vp.toneStyle === 'laconic'
                              ? '简明清冷'
                              : '直率口语'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[11px] pt-1">
                      <div className="p-1.5 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)]/50 text-center">
                        <span className="text-[10px] text-[var(--ink-text-muted)] block">平均句长</span>
                        <span className="font-bold text-[var(--ink-text)]">{vp.averageSentenceLength} 字</span>
                      </div>
                      <div className="p-1.5 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)]/50 text-center">
                        <span className="text-[10px] text-[var(--ink-text-muted)] block">反问诘问率</span>
                        <span className="font-bold text-amber-500">{(vp.questionRatio * 100).toFixed(0)}%</span>
                      </div>
                      <div className="p-1.5 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)]/50 text-center">
                        <span className="text-[10px] text-[var(--ink-text-muted)] block">感叹祈使率</span>
                        <span className="font-bold text-rose-500">{(vp.exclamationRatio * 100).toFixed(0)}%</span>
                      </div>
                    </div>

                    <span className="text-[10px] text-[var(--ink-text-muted)] block pt-1">
                      样本台词：{vp.sampleDialogueCount} 句
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 右栏：双角色同质化比对与告警 */}
          <div className="lg:col-span-5 p-4 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] space-y-3">
            <span className="text-xs font-semibold text-[var(--ink-text)] block">
              角色声纹余弦相似度比对
            </span>

            <div className="flex items-center gap-2 text-xs">
              <select
                value={charA}
                onChange={(e) => setCharA(e.target.value)}
                className="flex-1 px-2.5 py-1.5 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)]"
              >
                {characterNames.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span className="text-[var(--ink-text-muted)]">VS</span>
              <select
                value={charB}
                onChange={(e) => setCharB(e.target.value)}
                className="flex-1 px-2.5 py-1.5 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)]"
              >
                {characterNames.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <button
                onClick={handleCompareClick}
                className="px-3 py-1.5 rounded-md bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] text-xs font-medium hover:border-[var(--ink-accent)]"
              >
                比对
              </button>
            </div>

            {comparison ? (
              <div className="p-3.5 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">余弦相似度:</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-base font-bold ${
                        comparison.isHomogeneous ? 'text-rose-500' : 'text-emerald-500'
                      }`}
                    >
                      {Math.round(comparison.similarity * 100)}%
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        comparison.isHomogeneous
                          ? 'bg-rose-500/15 text-rose-500'
                          : 'bg-emerald-500/15 text-emerald-500'
                      }`}
                    >
                      {comparison.isHomogeneous ? '严重同质化' : '声纹差异鲜明'}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-1.5 text-[11px] leading-relaxed pt-1 border-t border-[var(--ink-border)]/50">
                  {comparison.isHomogeneous ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  )}
                  <p className="text-[var(--ink-text)]">{comparison.advice}</p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-canvas)] text-center text-xs text-[var(--ink-text-muted)]">
                选择两位角色点击「比对」进行声纹重合度检测。
              </div>
            )}

            {/* 经典声纹预设库 */}
            <div className="space-y-2 pt-2 border-t border-[var(--ink-border)]">
              <span className="text-[11px] font-semibold text-[var(--ink-text-muted)] flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                经典角色语言风格指纹对照：
              </span>
              <div className="space-y-1.5">
                {presets.map((p) => (
                  <div
                    key={p.id}
                    className="p-2 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)]/50 text-[11px] space-y-1"
                  >
                    <div className="flex items-center justify-between font-semibold text-[var(--ink-text)]">
                      <span>{p.name}</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-pink-500/10 text-pink-400">
                        {p.toneStyle}
                      </span>
                    </div>
                    <p className="text-[10px] text-[var(--ink-text-muted)] italic">
                      “{p.sampleSnippet}”
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
