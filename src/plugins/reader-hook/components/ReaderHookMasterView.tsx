import { useEffect, useMemo, useState, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import type { ReaderHookRecord, ReaderHookType } from '../types'
import { readerHookEngine } from '../engine/ReaderHookEngine'
import { indexedDbReaderHookRepository } from '../../../adapters/indexedDbReaderHookRepository'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import { clipboardWriter } from '../../../adapters/clipboardWriter'
import { semanticTextFromContent } from '../../../domain/content'
import {
  projectChapterSequence,
  type PositionedChapter,
} from '../../../domain/chapter/chapterSequence'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { usePluginAiTask } from '../../../core/usePluginAiTask'
import { PluginAiTaskPanel } from '../../../components/plugins/PluginAiTaskPanel'
import { EndingEvidence } from '../../../components/plugins/EndingEvidence'
import { Select } from '../../../ui/primitives'

export const ReaderHookMasterView: FC<DesktopPluginViewProps> = (props) => (
  <ReaderHookWorkspace key={props.projectId} {...props} />
)
function ReaderHookWorkspace({ projectId }: DesktopPluginViewProps) {
  const host = useOptionalPluginHostContext()
  const [chapters, setChapters] = useState<PositionedChapter[]>([])
  const [selected, setSelected] = useState('')
  const [text, setText] = useState('')
  const [intent, setIntent] = useState('')
  const [kind, setKind] = useState<ReaderHookType>('unclassified')
  const [saved, setSaved] = useState<ReaderHookRecord[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const report = useMemo(() => readerHookEngine.analyzeEnding(text), [text])
  const ai = usePluginAiTask('reader-hook', [projectId, selected, text, intent, kind])
  useEffect(() => {
    let disposed = false
    Promise.all([
      indexedDbProjectRepository.getChaptersByProject(projectId),
      indexedDbProjectRepository.getVolumesByProject(projectId),
      indexedDbReaderHookRepository.getAll(projectId),
    ])
      .then(([all, volumes, records]) => {
        if (disposed) return
        const ordered = projectChapterSequence(projectId, all, volumes)
        setChapters(ordered)
        setSaved(records.filter((record) => record.projectId === projectId))
        const chapter = ordered.find((c) => c.id === host?.activeChapter?.id) ?? ordered[0]
        if (chapter) {
          setSelected(chapter.id)
          setText(semanticTextFromContent(chapter.id, chapter.content, chapter.revision))
        }
      })
      .catch((cause) => {
        if (!disposed) setError(String(cause))
      })
    return () => {
      disposed = true
    }
  }, [projectId])
  const chapter = chapters.find((c) => c.id === selected)
  const action = async (operation: () => Promise<void>) => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await operation()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }
  const save = () =>
    action(async () => {
      const now = clock.now()
      const record: ReaderHookRecord = {
        id: idGenerator.generate('hook'),
        projectId,
        chapterId: chapter?.id,
        chapterNumber: chapter?.chapterNumber ?? undefined,
        hookText: text,
        hookType: kind,
        authorIntent: intent,
        sourceRevision: chapter?.revision,
        observations: report.observations,
        coverage: report.coverage,
        createdAt: now,
        updatedAt: now,
      }
      await indexedDbReaderHookRepository.save(record)
      setSaved((previous) => [...previous, record])
      setMessage('已保存当前章尾复核记录。')
    })
  return (
    <div className="h-full overflow-y-auto p-6 space-y-4 text-[var(--ink-text)]">
      <h2>章尾钩子复核工坊</h2>
      <p>检查未解问题、人物利害与下一章承接；示例是可选素材。正文初次载入所选保存章节。</p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <Select
        aria-label="当前章节"
        value={selected}
        onValueChange={(id) => {
          setSelected(id)
          const c = chapters.find((item) => item.id === id)
          setText(c ? semanticTextFromContent(c.id, c.content, c.revision) : '')
          setMessage('')
        }}
      >
        <option value="">手动文本</option>
        {chapters.map((c) => (
          <option key={c.id} value={c.id}>
            {c.chapterNumber ? '第 ' + c.chapterNumber + ' 章' : '位置未知'} · {c.title}
          </option>
        ))}
      </Select>
      <textarea
        aria-label="待审章节正文"
        rows={6}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setMessage('')
        }}
        placeholder="粘贴正文或编辑载入的保存章节"
        className="w-full border rounded p-3"
      />
      <textarea
        aria-label="章尾目标与承接约束"
        value={intent}
        onChange={(e) => setIntent(e.target.value)}
        placeholder="作者目标、仍未回答的问题、下一章需要承接的行动"
        className="w-full border rounded p-3"
      />
      <EndingEvidence report={report} />
      <Select
        aria-label="作者选定钩子类别"
        value={kind}
        onValueChange={(value) => setKind(value as ReaderHookType)}
      >
        <option value="unclassified">尚未分类</option>
        {readerHookEngine.getTemplates().map((t) => (
          <option key={t.id} value={t.type}>
            {t.name}
          </option>
        ))}
      </Select>
      {host?.aiAssistant?.isAvailable && (
        <button
          disabled={ai.isRunning || !text.trim()}
          onClick={() =>
            (() => {
              const nextChapter = chapters[chapters.findIndex((c) => c.id === selected) + 1]
              return ai.run({
                chapter: chapter
                  ? {
                      id: chapter.id,
                      chapterNumber: chapter.chapterNumber,
                      revision: chapter.revision,
                    }
                  : { source: 'manual' },
                endingText: semanticTextFromContent(
                  chapter?.id ?? 'manual-ending',
                  text,
                  chapter?.revision ?? 0,
                ),
                authorIntent: semanticTextFromContent('manual-intent', intent, 0),
                authorSelectedKind: kind,
                nextChapter: semanticTextFromContent(
                  nextChapter?.id ?? 'next-chapter',
                  nextChapter?.content ?? '',
                  nextChapter?.revision ?? 0,
                ),
              })
            })()
          }
        >
          AI 深度审读
        </button>
      )}
      <PluginAiTaskPanel view={ai.view} onRetry={ai.retry} />
      <button disabled={busy || !text.trim()} onClick={save}>
        入库本章断章
      </button>
      <h3>已保存章尾记录 ({saved.length})</h3>
      {saved.map((record) => (
        <article key={record.id} className="border rounded p-3">
          <p>
            {record.chapterNumber ? '第 ' + record.chapterNumber + ' 章' : '章节位置未知'} ·{' '}
            {record.hookType}
          </p>
          {record.tensionScore !== undefined && (
            <p>旧公式分数 {record.tensionScore}，尚未验证文学质量或追读效果。</p>
          )}
          <p className="whitespace-pre-wrap">{record.hookText}</p>
          <p>{record.authorIntent}</p>
          <button
            disabled={busy}
            onClick={() =>
              action(async () => {
                await indexedDbReaderHookRepository.delete(record.id)
                setSaved((previous) => previous.filter((item) => item.id !== record.id))
              })
            }
          >
            删除记录
          </button>
        </article>
      ))}
      <h3>断章范式灵感</h3>
      {readerHookEngine.getTemplates().map((t) => (
        <article key={t.id} className="border rounded p-3">
          <h4>{t.name}</h4>
          <p>{t.description}</p>
          <p>{t.example}</p>
          <button
            onClick={() => {
              setSelected('')
              setText(t.example)
              setKind(t.type)
            }}
          >
            载入示例
          </button>
          <button
            disabled={busy}
            onClick={() =>
              action(async () => {
                await clipboardWriter.writeText(t.example)
                setMessage('已复制例句。')
              })
            }
          >
            复制例句
          </button>
        </article>
      ))}
    </div>
  )
}
