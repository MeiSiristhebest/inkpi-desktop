import { useEffect, useMemo, useState, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import type { CharacterVoiceprint } from '../types'
import { dialogueDistillerEngine } from '../engine/DialogueDistillerEngine'
import { indexedDbDialogueVoiceprintRepository } from '../../../adapters/indexedDbDialogueVoiceprintRepository'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { semanticTextFromContent } from '../../../domain/content'
import {
  projectChapterSequence,
  type PositionedChapter,
} from '../../../domain/chapter/chapterSequence'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { usePluginAiTask } from '../../../core/usePluginAiTask'
import { PluginAiTaskPanel } from '../../../components/plugins/PluginAiTaskPanel'
import { clock } from '../../../adapters/clock'
import { Select } from '../../../ui/primitives'
export const DialogueDistillerMasterView: FC<DesktopPluginViewProps> = (props) => (
  <DialogueWorkspace key={props.projectId} {...props} />
)
function DialogueWorkspace({ projectId }: DesktopPluginViewProps) {
  const host = useOptionalPluginHostContext()
  const [chapters, setChapters] = useState<PositionedChapter[]>([])
  const [selected, setSelected] = useState('all')
  const [text, setText] = useState('')
  const [namesInput, setNamesInput] = useState('')
  const [intent, setIntent] = useState('')
  const [archives, setArchives] = useState<CharacterVoiceprint[]>([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [charA, setCharA] = useState('')
  const [charB, setCharB] = useState('')
  const [comparedScope, setComparedScope] = useState('')
  const names = useMemo(
    () => [...new Set(namesInput.split(/[,，、\s]+/).filter(Boolean))],
    [namesInput],
  )
  const semanticText = semanticTextFromContent('manual-dialogue', text, 0)
  const quotes = useMemo(
    () => dialogueDistillerEngine.extractQuoteEvidence(semanticText, names),
    [semanticText, names],
  )
  const profiles = useMemo(
    () =>
      names.map((name) =>
        dialogueDistillerEngine.computeVoiceprint(
          name,
          quotes.filter((q) => q.characterName === name).map((q) => q.quote),
          projectId,
        ),
      ),
    [names, quotes, projectId],
  )
  const scope = JSON.stringify([text, names, charA, charB])
  const a = profiles.find((p) => p.characterName === charA),
    b = profiles.find((p) => p.characterName === charB)
  const comparison =
    comparedScope === scope && charA !== charB && a?.sampleDialogueCount && b?.sampleDialogueCount
      ? dialogueDistillerEngine.comparePair(charA, a.vector, charB, b.vector)
      : null
  const ai = usePluginAiTask('dialogue-distiller', [
    projectId,
    selected,
    text,
    names,
    intent,
    charA,
    charB,
  ])
  useEffect(() => {
    let disposed = false
    Promise.all([
      indexedDbProjectRepository.getChaptersByProject(projectId),
      indexedDbProjectRepository.getVolumesByProject(projectId),
      indexedDbCodexEntityRepository.getAll(),
      indexedDbDialogueVoiceprintRepository.getAll(projectId),
    ])
      .then(([all, volumes, entities, records]) => {
        if (disposed) return
        const ordered = projectChapterSequence(projectId, all, volumes)
        const realNames = [
          ...new Set(
            entities
              .filter(
                (e) => e.projectId === projectId && e.category === 'character' && e.name.trim(),
              )
              .map((e) => e.name),
          ),
        ]
        setChapters(ordered)
        setNamesInput(realNames.join('，'))
        setCharA(realNames[0] ?? '')
        setCharB(realNames[1] ?? '')
        setArchives(records.filter((r) => r.projectId === projectId))
        setText(
          ordered.map((c) => semanticTextFromContent(c.id, c.content, c.revision)).join('\n\n'),
        )
      })
      .catch((cause) => {
        if (!disposed) setError(String(cause))
      })
    return () => {
      disposed = true
    }
  }, [projectId])
  const save = async () => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const records = profiles
        .filter((p) => p.sampleDialogueCount)
        .map((p) => ({
          ...p,
          sourceText: text,
          quoteEvidence: quotes.filter((q) => q.characterName === p.characterName),
          updatedAt: clock.now(),
        }))
      for (const record of records) await indexedDbDialogueVoiceprintRepository.save(record)
      setArchives((previous) => [
        ...previous.filter((old) => !records.some((r) => r.id === old.id)),
        ...records,
      ])
      setMessage('已保存 ' + records.length + ' 名角色的对白样本与测量。')
    } catch (cause) {
      setError(String(cause))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="p-6 space-y-4 h-full overflow-y-auto">
      <h2>角色对白样本分析</h2>
      <p>
        定位明确姓名和说话动词关联的引语；无法确定的说话人保留未知。句长不含空白和句末标点，问号与感叹号按实际标点统计。
      </p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <Select
        aria-label="文本来源章节"
        value={selected}
        onValueChange={(id) => {
          setSelected(id)
          setMessage('')
          const chosen = id === 'all' ? chapters : chapters.filter((c) => c.id === id)
          setText(
            chosen.map((c) => semanticTextFromContent(c.id, c.content, c.revision)).join('\n\n'),
          )
        }}
      >
        <option value="all">全书保存正文</option>
        {chapters.map((c) => (
          <option key={c.id} value={c.id}>
            {c.chapterNumber ? '第 ' + c.chapterNumber + ' 章' : '位置未知'} · {c.title}
          </option>
        ))}
      </Select>
      <input
        aria-label="目标角色列表"
        value={namesInput}
        onChange={(e) => setNamesInput(e.target.value)}
        placeholder="输入实际角色名，以逗号分隔"
        className="w-full border rounded p-2"
      />
      <textarea
        aria-label="待分析对白正文"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setMessage('')
        }}
        placeholder="粘贴含有角色对白的章节段落"
        rows={6}
        className="w-full border rounded p-3"
      />
      <textarea
        aria-label="人物口吻约束"
        value={intent}
        onChange={(e) => setIntent(e.target.value)}
        placeholder="人物目标、关系、情境和作者希望保留的语言特征"
        className="w-full border rounded p-2"
      />
      {!quotes.length && <p>没有可归属的对白，不能比较人物口吻。</p>}
      {profiles.map((profile) => (
        <section key={profile.id} className="border rounded p-3">
          <h3>{profile.characterName}</h3>
          <p>
            {profile.sampleDialogueCount} 段引语；{profile.sentenceCount} 个句段。
          </p>
          {profile.sampleDialogueCount > 0 ? (
            <p>
              平均句长 {profile.averageSentenceLength.toFixed(2)} 字符；问号句段{' '}
              {(profile.questionRatio * 100).toFixed(1)}%；感叹号句段{' '}
              {(profile.exclamationRatio * 100).toFixed(1)}%。
            </p>
          ) : (
            <p>样本缺失。</p>
          )}
          {quotes
            .filter((q) => q.characterName === profile.characterName)
            .map((q) => (
              <p key={q.start}>
                {q.attribution} — [{q.start}, {q.end})「{q.quote}」
              </p>
            ))}
        </section>
      ))}
      <Select aria-label="对比角色 A" value={charA} onValueChange={setCharA}>
        <option value="">选择角色</option>
        {names.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </Select>
      <Select aria-label="对比角色 B" value={charB} onValueChange={setCharB}>
        <option value="">选择角色</option>
        {names.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </Select>
      <button
        disabled={!a?.sampleDialogueCount || !b?.sampleDialogueCount || charA === charB}
        onClick={() => setComparedScope(scope)}
      >
        比对
      </button>
      {comparison && (
        <section>
          <p>
            A 减 B：平均句长差 {comparison.differences.averageSentenceLength.toFixed(2)}；问号比例差{' '}
            {(comparison.differences.questionRatio * 100).toFixed(1)} 个百分点；感叹号比例差{' '}
            {(comparison.differences.exclamationRatio * 100).toFixed(1)} 个百分点。
          </p>
          <p>{comparison.advice}</p>
        </section>
      )}
      <button disabled={busy || !quotes.length} onClick={save}>
        保存当前对白样本
      </button>
      {host?.aiAssistant?.isAvailable && (
        <button
          disabled={ai.isRunning || !text.trim() || !names.length}
          onClick={() =>
            ai.run({
              text: semanticTextFromContent('manual-dialogue', text, 0),
              characters: names,
              quoteAttributionCandidates: quotes,
              authorConstraints: semanticTextFromContent('manual-constraints', intent, 0),
              compare: charA && charB ? [charA, charB] : [],
            })
          }
        >
          AI 对白语境复核
        </button>
      )}
      <PluginAiTaskPanel view={ai.view} onRetry={ai.retry} />
      <h3>已保存样本 ({archives.length})</h3>
      {archives.map((record) => (
        <p key={record.id}>
          {record.characterName}：{record.sampleDialogueCount} 段；
          {record.sourceText === undefined
            ? '旧记录未绑定原文，不能用于当前比较。'
            : '保存样本，请重新载入文本后再比较。'}
        </p>
      ))}
      <h3>可选措辞示例</h3>
      {dialogueDistillerEngine.getPresets().map((p) => (
        <p key={p.id}>
          {p.name}：{p.sampleSnippet}
        </p>
      ))}
    </div>
  )
}
