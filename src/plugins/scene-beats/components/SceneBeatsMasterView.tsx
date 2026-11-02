import { useEffect, useRef, useState, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import type { ChapterBeatPlan, SceneBeatItem, BeatType } from '../types'
import { sceneBeatsEngine } from '../engine/SceneBeatsEngine'
import { indexedDbSceneBeatRepository } from '../../../adapters/indexedDbSceneBeatRepository'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import {
  projectChapterSequence,
  type PositionedChapter,
} from '../../../domain/chapter/chapterSequence'
import { semanticTextFromContent } from '../../../domain/content'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { usePluginAiTask } from '../../../core/usePluginAiTask'
import { PluginAiTaskPanel } from '../../../components/plugins/PluginAiTaskPanel'
import { Select } from '../../../ui/primitives'
export const SceneBeatsMasterView: FC<DesktopPluginViewProps> = (props) => (
  <SceneWorkspace key={props.projectId} {...props} />
)
function SceneWorkspace({ projectId }: DesktopPluginViewProps) {
  const host = useOptionalPluginHostContext()
  const [chapters, setChapters] = useState<PositionedChapter[]>([])
  const [plans, setPlans] = useState<ChapterBeatPlan[]>([])
  const [draft, setDraft] = useState<ChapterBeatPlan | null>(null)
  const [target, setTarget] = useState('')
  const [chapterId, setChapterId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    let disposed = false
    Promise.all([
      indexedDbSceneBeatRepository.getAll(),
      indexedDbProjectRepository.getChaptersByProject(projectId),
      indexedDbProjectRepository.getVolumesByProject(projectId),
    ])
      .then(([all, chapters, volumes]) => {
        if (disposed) return
        const actual = projectChapterSequence(projectId, chapters, volumes)
        const own = all.filter((p) => p.projectId === projectId)
        setChapters(actual)
        setPlans(own)
        setChapterId(actual[0]?.id ?? '')
        if (own[0]) {
          setDraft(structuredClone(own[0]))
          setChapterId(own[0].chapterId)
          setTarget(String(own[0].targetWordCount))
        }
      })
      .catch((cause) => {
        if (!disposed) setError(String(cause))
      })
    return () => {
      disposed = true
    }
  }, [projectId])
  const plan = draft ? { ...draft, targetWordCount: Number(target) } : null
  const chapter = chapters.find((c) => c.id === plan?.chapterId)
  const text = chapter ? semanticTextFromContent(chapter.id, chapter.content, chapter.revision) : ''
  const semanticPlan = plan
    ? {
        ...plan,
        beats: plan.beats.map((beat) => ({
          ...beat,
          title: semanticTextFromContent(`${beat.id}-title`, beat.title),
          goalOrConflict: semanticTextFromContent(`${beat.id}-goal`, beat.goalOrConflict),
          notes:
            beat.notes === undefined
              ? undefined
              : semanticTextFromContent(`${beat.id}-notes`, beat.notes),
        })),
      }
    : null
  const errors = plan ? sceneBeatsEngine.validatePlan(plan) : []
  const arc = plan ? sceneBeatsEngine.evaluateDramaticArc(plan.beats) : null
  const progress =
    plan && chapter && !errors.length
      ? sceneBeatsEngine.calculatePacingStatus(plan, Array.from(text.replace(/\s/g, '')).length)
      : null
  const ai = usePluginAiTask('scene-beats', [projectId, plan, chapters])
  const newDraft = (template: 'climax_burst' | 'investigation' | 'transition') => {
    const id = idGenerator.generate('plan'),
      now = clock.now()
    const actualChapter = chapters.some((c) => c.id === chapterId) ? chapterId : 'manual:' + id
    setDraft({
      id,
      projectId,
      chapterId: actualChapter,
      targetWordCount: 0,
      beats: sceneBeatsEngine.generatePresetPlan(template, actualChapter),
      createdAt: now,
      updatedAt: now,
    })
    setTarget('')
    setMessage('新模板仅是草稿；填写目标、冲突与预算后保存。')
    setError('')
  }
  const changeBeat = (id: string, changes: Partial<SceneBeatItem>) =>
    setDraft((previous) =>
      previous
        ? {
            ...previous,
            beats: previous.beats.map((b) => (b.id === id ? { ...b, ...changes } : b)),
          }
        : previous,
    )
  const editingScope = JSON.stringify([plan, target, chapterId])
  const editingScopeRef = useRef(editingScope)
  editingScopeRef.current = editingScope
  const save = async () => {
    const submittedScope = editingScope
    if (!plan) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      if (errors.length) throw new Error(errors.join(' '))
      const record = { ...plan, updatedAt: clock.now() }
      await indexedDbSceneBeatRepository.save(record)
      setPlans((previous) => [...previous.filter((p) => p.id !== record.id), record])
      if (editingScopeRef.current === submittedScope) setDraft(record)
      setMessage(
        editingScopeRef.current === submittedScope
          ? '已保存作者细纲与预算。'
          : '已保存先前细纲快照；后续编辑仍未保存。',
      )
    } catch (cause) {
      setError(String(cause))
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="plugin-workspace-page p-6 space-y-4 h-full overflow-y-auto">
      <h2>场景目标与节拍预算</h2>
      <p>模板是可选规划结构。篇幅仅用于预算区间比较；剧情完成由作者标记，情绪值仅是作者注记。</p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <Select
        aria-label="绑定保存章节"
        value={chapterId}
        onValueChange={(id) => {
          setChapterId(id)
          setDraft((previous) =>
            previous
              ? {
                  ...previous,
                  chapterId: id || 'manual:' + previous.id,
                  beats: previous.beats.map((b) => ({
                    ...b,
                    chapterId: id || 'manual:' + previous.id,
                  })),
                }
              : previous,
          )
        }}
      >
        <option value="">独立细纲，章节位置未知</option>
        {chapters.map((c) => (
          <option key={c.id} value={c.id}>
            {c.chapterNumber ? '第 ' + c.chapterNumber + ' 章' : '位置未知'} · {c.title}
          </option>
        ))}
      </Select>
      <button onClick={() => newDraft('climax_burst')}>新建目标与选择模板</button>
      <button onClick={() => newDraft('investigation')}>新建调查模板</button>
      <button onClick={() => newDraft('transition')}>新建过渡模板</button>
      <Select
        aria-label="已保存细纲"
        value={draft && plans.some((p) => p.id === draft.id) ? draft.id : ''}
        onValueChange={(id) => {
          const p = plans.find((p) => p.id === id)
          if (p) {
            setDraft(structuredClone(p))
            setChapterId(p.chapterId)
            setTarget(String(p.targetWordCount))
            setMessage('')
          }
        }}
      >
        <option value="">未保存草稿</option>
        {plans.map((p) => (
          <option key={p.id} value={p.id}>
            {chapters.find((c) => c.id === p.chapterId)?.title ?? '未挂章细纲'} · {p.id}
          </option>
        ))}
      </Select>
      {!draft ? (
        <p>选择实际章节或独立细纲，创建一份作者计划。</p>
      ) : (
        <>
          <label>
            非空白字符预算
            <input
              aria-label="细纲总字符预算"
              type="number"
              min="1"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </label>
          {errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
          {progress ? (
            <p>
              保存正文 {progress.currentWords} 字符 / 作者预算 {progress.targetTotalWords}；预算比{' '}
              {progress.progressPct.toFixed(1)}%。剧情完成状态不由字符数推断。
            </p>
          ) : (
            <p>章节或预算未确定，正文进度未知。</p>
          )}
          {draft.beats.map((beat) => (
            <section key={beat.id} className="border rounded p-3 space-y-2">
              <input
                aria-label={'节拍标题 ' + beat.order}
                value={beat.title}
                onChange={(e) => changeBeat(beat.id, { title: e.target.value })}
              />
              <Select
                aria-label={'节拍类型 ' + beat.order}
                value={beat.beatType}
                onValueChange={(value) => changeBeat(beat.id, { beatType: value as BeatType })}
              >
                <option value="goal">目标</option>
                <option value="conflict">阻碍</option>
                <option value="turning_point">变化</option>
                <option value="climax">关键选择</option>
                <option value="cliffhanger">承接</option>
              </Select>
              <textarea
                aria-label={'节拍目标或冲突 ' + beat.order}
                value={beat.goalOrConflict}
                onChange={(e) => changeBeat(beat.id, { goalOrConflict: e.target.value })}
                placeholder="填写实际人物目标、阻碍或后果"
              />
              <label>
                预算占比
                <input
                  aria-label={'节拍预算占比 ' + beat.order}
                  type="number"
                  min="0"
                  max="1"
                  step="any"
                  value={beat.budgetWordRatio}
                  onChange={(e) => changeBeat(beat.id, { budgetWordRatio: Number(e.target.value) })}
                />
              </label>
              <label>
                作者情绪起点
                <input
                  aria-label={'节拍情绪起点 ' + beat.order}
                  type="number"
                  min="-1"
                  max="1"
                  step="any"
                  value={beat.emotionalIn ?? ''}
                  onChange={(e) =>
                    changeBeat(beat.id, {
                      emotionalIn: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                作者情绪终点
                <input
                  aria-label={'节拍情绪终点 ' + beat.order}
                  type="number"
                  min="-1"
                  max="1"
                  step="any"
                  value={beat.emotionalOut ?? ''}
                  onChange={(e) =>
                    changeBeat(beat.id, {
                      emotionalOut: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                作者确认此节拍完成
                <input
                  type="checkbox"
                  checked={beat.isCompleted}
                  onChange={(e) => changeBeat(beat.id, { isCompleted: e.target.checked })}
                />
              </label>
              <button
                onClick={() =>
                  setDraft((previous) =>
                    previous
                      ? {
                          ...previous,
                          beats: previous.beats
                            .filter((b) => b.id !== beat.id)
                            .map((b, order) => ({ ...b, order })),
                        }
                      : previous,
                  )
                }
              >
                删除此节拍
              </button>
            </section>
          ))}
          <p>
            作者已填写的情绪变化量：{arc?.totalAnnotationChange ?? '标注不完整'}
            。此数值不判断张力或质量。
          </p>
          {arc?.discontinuities.map((g) => (
            <p key={g.afterBeatId}>
              相邻作者标注不连续：{g.previousOut} → {g.nextIn}；请核对是否有意安排。
            </p>
          ))}
          <button
            onClick={() =>
              setDraft((previous) =>
                previous
                  ? {
                      ...previous,
                      beats: [
                        ...previous.beats,
                        {
                          id: idGenerator.generate('beat'),
                          chapterId: previous.chapterId,
                          order: previous.beats.length,
                          beatType: 'goal',
                          title: '',
                          goalOrConflict: '',
                          budgetWordRatio: 0,
                          isCompleted: false,
                        },
                      ],
                    }
                  : previous,
              )
            }
          >
            添加空节拍
          </button>
          <button data-variant="primary" disabled={saving} onClick={save}>
            保存作者细纲
          </button>
          {host?.aiAssistant?.isAvailable && (
            <button
              disabled={ai.isRunning}
              onClick={() =>
                ai.run({
                  authorPlan: semanticPlan,
                  chapterSource: chapter
                    ? {
                        id: chapter.id,
                        chapterNumber: chapter.chapterNumber,
                        revision: chapter.revision,
                        text,
                      }
                    : null,
                  missingContext: chapter ? '' : '独立细纲尚未绑定章节，不得假定已有剧情',
                })
              }
            >
              AI 场景目标与后果复核
            </button>
          )}
          <PluginAiTaskPanel view={ai.view} onRetry={ai.retry} />
        </>
      )}
    </div>
  )
}
