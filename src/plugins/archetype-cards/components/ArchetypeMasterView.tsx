import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { useEffect, useState, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { ArchetypeEngine } from '../engine/ArchetypeEngine'
import type { ArchetypeCategory, NarrativeArchetypeRecord } from '../types'
import { usePluginAiTask } from '../../../core/usePluginAiTask'
import { PluginAiTaskPanel } from '../../../components/plugins/PluginAiTaskPanel'
import { indexedDbArchetypeRepository } from '../../../adapters/indexedDbArchetypeRepository'
import { clipboardWriter } from '../../../adapters/clipboardWriter'
import { idGenerator } from '../../../adapters/idGenerator'
import { clock } from '../../../adapters/clock'
import { semanticTextFromContent } from '../../../domain/content'
import { PersonalityInspirationCards } from './PersonalityInspirationCards'

export const ArchetypeMasterView: FC<DesktopPluginViewProps> = (props) => (
  <ArchetypeSession key={props.projectId} {...props} />
)
const ArchetypeSession: FC<DesktopPluginViewProps> = ({ projectId, onStats }) => {
  const host = useOptionalPluginHostContext()
  const [engine] = useState(() => new ArchetypeEngine())
  const [category, setCategory] = useState<ArchetypeCategory>('character_archetype_36')
  const [cards, setCards] = useState<NarrativeArchetypeRecord[]>([])
  const [materials, setMaterials] = useState<NarrativeArchetypeRecord[]>([])
  const [context, setContext] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const ai = usePluginAiTask('archetype-cards', [projectId, cards, context])
  useEffect(() => {
    let stale = false
    indexedDbArchetypeRepository
      .getAll()
      .then((all) => {
        if (!stale) setMaterials(all.filter((c) => c.projectId === projectId))
      })
      .catch((cause) => {
        if (!stale) setError(String(cause))
      })
    return () => {
      stale = true
    }
  }, [projectId, attempt])
  useEffect(() => {
    onStats?.({ title: '原型创作素材', wordCount: 0, updatedAt: clock.now() })
  }, [onStats])
  const presets = ArchetypeEngine.getPresetArchetypes()
  const chemistry =
    cards.length >= 2 ? ArchetypeEngine.calculateChemistry(cards[0], cards[1]) : null
  const semanticContext = semanticTextFromContent(`archetype-context-${projectId}`, context)
  const semanticMaterials = cards.map((card) => ({
    ...card,
    name: semanticTextFromContent(`${card.id}-name`, card.name),
    coreDesire: semanticTextFromContent(`${card.id}-desire`, card.coreDesire),
    fatalFlaw: semanticTextFromContent(`${card.id}-flaw`, card.fatalFlaw),
    typicalBehaviors: card.typicalBehaviors.map((behavior, index) =>
      semanticTextFromContent(`${card.id}-behavior-${index}`, behavior),
    ),
    conflictPrompt: semanticTextFromContent(`${card.id}-conflict`, card.conflictPrompt),
  }))
  const draw = () => {
    try {
      setCards(engine.drawCards(category, 2))
      setNotice(null)
      setError(null)
    } catch (cause) {
      setError(String(cause))
    }
  }
  const save = async (card: NarrativeArchetypeRecord) => {
    try {
      const record = { ...card, id: idGenerator.generate('material'), projectId }
      await indexedDbArchetypeRepository.save(record)
      setMaterials((current) => [...current, record])
      setNotice('作者素材已保存。')
      setError(null)
    } catch (cause) {
      setError('保存失败：' + String(cause))
    }
  }
  const copy = async (card: NarrativeArchetypeRecord) => {
    try {
      await clipboardWriter.writeText(
        [
          card.name,
          '目标：' + card.coreDesire,
          '可能限制：' + card.fatalFlaw,
          card.conflictPrompt,
        ].join('\n'),
      )
      setNotice('素材已复制。')
    } catch (cause) {
      setError('复制失败：' + String(cause))
    }
  }
  return (
    <div className="plugin-workspace-page p-6 space-y-4 h-full overflow-y-auto">
      <h2>人格原型素材库与叙事母题卡牌 (ArchetypeCards)</h2>
      <p>
        36 项人物创作素材、16 个可选 MBTI 标签、12 项叙事母题及 8
        项冲突题目。属于创作参考；标签不能证明人格、冲突程度或行为。
      </p>
      <details className="rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-3">
        <summary className="cursor-pointer text-sm font-medium">经典人物性格原型（6 张）</summary>
        <div className="mt-3">
          <PersonalityInspirationCards />
        </div>
      </details>
      <select
        aria-label="角色原型分类"
        value={category}
        onChange={(e) => {
          setCategory(e.target.value as ArchetypeCategory)
          setCards([])
        }}
      >
        <option value="character_archetype_36">人物创作素材</option>
        <option value="mbti_matrix">MBTI 创作标签</option>
        <option value="narrative_motif_12">叙事母题</option>
        <option value="conflict_deck">冲突题目</option>
      </select>
      <p>
        本类预设 {presets.filter((c) => c.category === category).length} 项；已保存作者素材{' '}
        {materials.length} 项。
      </p>
      <button data-variant="primary" onClick={draw}>
        随机抽取双卡对垒
      </button>
      <select
        aria-label="选择已有作者素材"
        value=""
        onChange={(e) => {
          const card = materials.find((c) => c.id === e.target.value)
          if (card) setCards((current) => [...current.slice(-1), structuredClone(card)])
        }}
      >
        <option value="">选择已有作者素材</option>
        {materials.map((c) => (
          <option value={c.id} key={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert">
          {error}
          <button onClick={() => setAttempt((n) => n + 1)}>重新读取素材</button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!cards.length && <p>选择或抽取素材，再按本书人物修改目标与限制。</p>}
      {cards.map((card, i) => (
        <article className="border rounded p-3 space-y-2" key={i}>
          <input
            aria-label={'素材名 ' + (i + 1)}
            value={card.name}
            onChange={(e) =>
              setCards((current) =>
                current.map((c, index) => (index === i ? { ...c, name: e.target.value } : c)),
              )
            }
          />
          <label>
            具体人物目标
            <input
              aria-label={'目标 ' + (i + 1)}
              value={card.coreDesire}
              onChange={(e) =>
                setCards((current) =>
                  current.map((c, index) =>
                    index === i ? { ...c, coreDesire: e.target.value } : c,
                  ),
                )
              }
            />
          </label>
          <label>
            可能限制或缺点
            <input
              aria-label={'限制 ' + (i + 1)}
              value={card.fatalFlaw}
              onChange={(e) =>
                setCards((current) =>
                  current.map((c, index) =>
                    index === i ? { ...c, fatalFlaw: e.target.value } : c,
                  ),
                )
              }
            />
          </label>
          <p>{card.typicalBehaviors.join('；')}</p>
          <p>{card.conflictPrompt}</p>
          <button onClick={() => void save(card)}>保存作者素材</button>
          <button onClick={() => void copy(card)}>复制素材</button>
        </article>
      ))}
      {chemistry && (
        <article className="border p-3">
          <h3>对手戏设计问题</h3>
          <p>{chemistry.coreEthicalConflict}</p>
          <p>{chemistry.dramaticPrompt}</p>
        </article>
      )}
      <textarea
        aria-label="实际场景与人物限制"
        placeholder="填写实际场景、人物关系、已有行为与不能改变的条件"
        value={context}
        onChange={(e) => setContext(e.target.value)}
      />
      {host?.aiAssistant?.isAvailable && (
        <button
          disabled={cards.length < 2 || !semanticContext.trim() || ai.isRunning}
          onClick={() =>
            void ai.run({
              materials: semanticMaterials,
              actualSceneAndConstraints: semanticContext,
            })
          }
        >
          AI 对手戏方案复核
        </button>
      )}
      <PluginAiTaskPanel view={ai.view} onRetry={ai.retry} />
    </div>
  )
}
