import { useEffect, useState, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { SubtextCompilerEngine } from '../engine/SubtextCompilerEngine'
import type { AuthorEmotion, SubtextDialogueRecord } from '../types'
import { indexedDbSubtextRepository } from '../../../adapters/indexedDbSubtextRepository'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { usePluginAiTask } from '../../../core/usePluginAiTask'
import { PluginAiTaskPanel } from '../../../components/plugins/PluginAiTaskPanel'
import { semanticTextFromContent } from '../../../domain/content'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import { Select } from '../../../ui/primitives'
export const SubtextMasterView: FC<DesktopPluginViewProps> = (props) => (
  <SubtextWorkspace key={props.projectId} {...props} />
)
function SubtextWorkspace({ projectId }: DesktopPluginViewProps) {
  const host = useOptionalPluginHostContext()
  const [spoken, setSpoken] = useState('')
  const [speaker, setSpeaker] = useState('')
  const [emotion, setEmotion] = useState<AuthorEmotion | ''>('')
  const [goal, setGoal] = useState('')
  const [meaning, setMeaning] = useState('')
  const [action, setAction] = useState('')
  const [relationship, setRelationship] = useState('')
  const [whyHidden, setWhyHidden] = useState('')
  const [context, setContext] = useState('')
  const [saved, setSaved] = useState<SubtextDialogueRecord[]>([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const ai = usePluginAiTask('subtext-compiler', [
    projectId,
    spoken,
    speaker,
    emotion,
    goal,
    meaning,
    action,
    relationship,
    whyHidden,
    context,
  ])
  useEffect(() => {
    let disposed = false
    indexedDbSubtextRepository
      .getAll(projectId)
      .then((records) => {
        if (!disposed) setSaved(records.filter((r) => r.projectId === projectId))
      })
      .catch((cause) => {
        if (!disposed) setError(String(cause))
      })
    return () => {
      disposed = true
    }
  }, [projectId])
  const compiled =
    spoken.trim() && speaker.trim()
      ? SubtextCompilerEngine.compile(spoken, speaker, emotion || undefined, {
          goal,
          intendedMeaning: meaning,
          action,
          relationship,
          whyHidden,
        })
      : null
  const save = async () => {
    if (!compiled) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const record: SubtextDialogueRecord = {
        id: idGenerator.generate('subtext'),
        projectId,
        chapterId: host?.projectId === projectId ? (host.activeChapter?.id ?? 'manual') : 'manual',
        speakerName: compiled.speakerName,
        spoken: compiled.spoken,
        subtext: compiled.subtext,
        beatAction: compiled.beatAction,
        goal: compiled.goal,
        authorEmotion: compiled.authorEmotion,
        relationship,
        whyHidden,
        surroundingText: context,
        status: compiled.status,
        updatedAt: clock.now(),
      }
      await indexedDbSubtextRepository.save(record)
      setSaved((previous) => [...previous, record])
      setMessage('已保存作者对白草稿。')
    } catch (cause) {
      setError(String(cause))
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="p-6 space-y-4 h-full overflow-y-auto">
      <h2>潜台词与对白草稿</h2>
      <p>
        分别记录表层台词、说话目标、隐藏含义和作者选择的动作。缺失信息保留未知；情绪选项不推断心理机制。
      </p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <input
        aria-label="说话角色名"
        value={speaker}
        onChange={(e) => setSpeaker(e.target.value)}
        placeholder="填写角色名"
      />
      <textarea
        aria-label="表面台词"
        value={spoken}
        onChange={(e) => setSpoken(e.target.value)}
        placeholder="填写需要分析的对白"
        className="w-full border rounded p-2"
      />
      <input
        aria-label="说话目标"
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        placeholder="人物希望对方做什么"
      />
      <textarea
        aria-label="作者设定的潜台词"
        value={meaning}
        onChange={(e) => setMeaning(e.target.value)}
        placeholder="作者设定的隐藏含义"
      />
      <textarea
        aria-label="隐藏原因"
        value={whyHidden}
        onChange={(e) => setWhyHidden(e.target.value)}
        placeholder="为何不直接说，能透露到哪一步"
      />
      <input
        aria-label="人物关系"
        value={relationship}
        onChange={(e) => setRelationship(e.target.value)}
        placeholder="对方是谁，人物关系和当前处境"
      />
      <Select
        aria-label="作者设定情绪"
        value={emotion}
        onValueChange={(value) => setEmotion(value as AuthorEmotion | '')}
      >
        <option value="">尚未设定</option>
        <option value="anger">愤怒</option>
        <option value="fear">恐惧</option>
        <option value="pride">自尊</option>
        <option value="affection">关心</option>
        <option value="jealousy">嫉妒</option>
        <option value="guilt">内疚</option>
      </Select>
      <textarea
        aria-label="作者选择的伴随动作"
        value={action}
        onChange={(e) => setAction(e.target.value)}
        placeholder="可选动作，不填则不添加动作"
      />
      <textarea
        aria-label="对白前后语境"
        value={context}
        onChange={(e) => setContext(e.target.value)}
        placeholder="提供人物当时知道的信息和对白前后正文"
        className="w-full border rounded p-2"
      />
      {host?.activeChapter && (
        <button
          onClick={() =>
            setContext(
              semanticTextFromContent(
                host.activeChapter!.id,
                host.activeChapter!.content,
                host.activeChapter!.revision,
              ),
            )
          }
        >
          载入当前章节作为语境
        </button>
      )}
      {compiled ? (
        <section className="border rounded p-3 space-y-2">
          <p>说话目标：{compiled.goal || '尚未填写'}</p>
          <p>隐藏含义：{compiled.subtext || '尚未填写'}</p>
          <p>伴随动作：{compiled.beatAction || '作者未添加'}</p>
          <p>
            {compiled.status === 'needs_context'
              ? '目标或隐藏含义缺失，暂不能判断表达关系。'
              : '作者草稿，尚未验证实际阅读效果。'}
          </p>
          <pre className="whitespace-pre-wrap">
            {SubtextCompilerEngine.renderNovelParagraph(compiled)}
          </pre>
        </section>
      ) : (
        <p role="status">填写角色名和实际台词后预览。</p>
      )}
      <button disabled={!compiled || saving} onClick={save}>
        归档此对白草稿
      </button>
      {host?.aiAssistant?.isAvailable && (
        <button
          disabled={ai.isRunning || !compiled}
          onClick={() =>
            ai.run({
              speaker,
              spoken: semanticTextFromContent('manual-spoken', spoken, 0),
              authorEmotion: emotion || null,
              authorGoal: goal,
              intendedMeaning: meaning,
              relationship,
              whyHidden,
              authorAction: action,
              surroundingText: semanticTextFromContent('manual-context', context, 0),
            })
          }
        >
          AI 潜台词方案复核
        </button>
      )}
      <PluginAiTaskPanel view={ai.view} onRetry={ai.retry} />
      <h3>已保存对白 ({saved.length})</h3>
      {saved.map((record) => (
        <article key={record.id} className="border rounded p-3">
          <p>
            {record.speakerName}：「{record.spoken}」
          </p>
          <p>{record.subtext}</p>
          {!record.status && <p>旧模板推演，尚未验证隐藏含义或心理解释。</p>}
        </article>
      ))}
    </div>
  )
}
