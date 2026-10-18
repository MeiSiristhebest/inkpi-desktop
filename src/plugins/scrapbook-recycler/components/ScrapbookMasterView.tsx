import { useEffect, useRef, useState, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import type { ScrapbookFragmentRecord } from '../types'
import { ScrapbookEngine } from '../engine/ScrapbookEngine'
import { indexedDbScrapbookRepository } from '../../../adapters/indexedDbScrapbookRepository'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { clipboardWriter } from '../../../adapters/clipboardWriter'
import { clock } from '../../../adapters/clock'
import { semanticTextFromContent } from '../../../domain/content'

export const ScrapbookMasterView: FC<DesktopPluginViewProps> = (props) => (
  <ScrapbookSession key={props.projectId} {...props} />
)
const ScrapbookSession: FC<DesktopPluginViewProps> = ({ projectId, onStats }) => {
  const host = useOptionalPluginHostContext()
  const [fragments, setFragments] = useState<ScrapbookFragmentRecord[]>([])
  const [query, setQuery] = useState('')
  const [rankedInput, setRankedInput] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const input = JSON.stringify([projectId, query, fragments])
  const semanticContext = semanticTextFromContent(`scrapbook-${projectId}-context`, query)
  const semanticFragments = fragments.map((fragment) => ({
    ...fragment,
    sourceChapterTitle:
      fragment.sourceChapterTitle === undefined
        ? undefined
        : semanticTextFromContent(
            `${fragment.id}-chapter-title`,
            fragment.sourceChapterTitle,
            fragment.sourceRevision,
          ),
    snippet: semanticTextFromContent(fragment.id, fragment.snippet, fragment.sourceRevision),
    tags: fragment.tags.map((tag, index) =>
      semanticTextFromContent(`${fragment.id}-tag-${index}`, tag),
    ),
  }))
  const inputRef = useRef<string | null>(input)
  inputRef.current = input
  useEffect(
    () => () => {
      inputRef.current = null
    },
    [],
  )
  useEffect(() => {
    let stale = false
    indexedDbScrapbookRepository
      .getAll(projectId)
      .then((all) => {
        if (!stale) {
          setFragments(
            all.filter((f) => f.projectId === projectId).sort((a, b) => b.deletedAt - a.deletedAt),
          )
          setError(null)
        }
      })
      .catch((cause) => {
        if (!stale) setError(String(cause))
      })
    return () => {
      stale = true
    }
  }, [projectId, attempt])
  useEffect(() => {
    onStats?.({
      title: '废稿回收站',
      wordCount: fragments.reduce(
        (sum, f) => sum + Array.from(f.snippet.replace(/\s/gu, '')).length,
        0,
      ),
      updatedAt: clock.now(),
    })
  }, [fragments, onStats])
  const rank = async () => {
    if (!query.trim()) {
      setError('先输入检索词或上下文。')
      return
    }
    const scope = input
    const local = ScrapbookEngine.recommendFragments(
      semanticContext,
      semanticFragments,
      semanticFragments.length,
    )
    setBusy(true)
    setError(null)
    try {
      if (host?.aiAssistant?.isAvailable && host.aiAssistant.runPluginTool) {
        const result = await host.aiAssistant.runPluginTool('scrapbook-recycler', {
          contextText: semanticContext,
          fragments: semanticFragments,
          topK: semanticFragments.length,
        })
        if (
          !Array.isArray(result) ||
          result.length !== local.length ||
          result.some(
            (r, i) =>
              r?.fragment?.id !== local[i].fragment.id ||
              !Number.isFinite(r.similarityScore) ||
              Math.abs(r.similarityScore - local[i].similarityScore) > 1e-9,
          )
        ) {
          throw new Error('返回的排序与当前素材不一致，请重试。')
        }
      }
      if (inputRef.current === scope) setRankedInput(scope)
    } catch (cause) {
      if (inputRef.current === scope) setError(String(cause))
    } finally {
      if (inputRef.current !== null) setBusy(false)
    }
  }
  const isRanked = rankedInput === input
  const fragmentById = new Map(fragments.map((fragment) => [fragment.id, fragment]))
  const matches = isRanked
    ? ScrapbookEngine.recommendFragments(
        semanticContext,
        semanticFragments,
        semanticFragments.length,
      )
        .map((recommendation) => fragmentById.get(recommendation.fragment.id))
        .filter((fragment): fragment is ScrapbookFragmentRecord => fragment !== undefined)
    : fragments.filter(
        (f) =>
          !query ||
          [f.snippet, f.sourceChapterTitle ?? '', ...f.tags].some((s) => s.includes(query)),
      )
  const copy = async (fragment: ScrapbookFragmentRecord) => {
    try {
      await clipboardWriter.writeText(fragment.snippet)
      setCopiedId(fragment.id)
      setError(null)
    } catch (cause) {
      setCopiedId(null)
      setError('复制失败：' + String(cause))
    }
  }
  const remove = async (id: string) => {
    try {
      await indexedDbScrapbookRepository.delete(id)
      setFragments((current) => current.filter((f) => f.id !== id))
      setError(null)
    } catch (cause) {
      setError('删除失败：' + String(cause))
    }
  }
  return (
    <div className="p-6 space-y-4">
      <h2>废稿灵感碎纸机回收站 (ScrapbookRecycler)</h2>
      <p>
        章节成功保存时保留有内容的删除片段。检索基于词项 TF-IDF 余弦相似度，不能判断语义或文学质量。
      </p>
      <p>已归档 {fragments.length} 处废稿切片</p>
      <input
        aria-label="搜索废稿"
        placeholder="搜索废稿内容、关键词标签或原所属章节..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setCopiedId(null)
        }}
      />
      <button data-testid="scrapbook-ai-run" disabled={busy} onClick={() => void rank()}>
        {busy ? '关键词排序中…' : '按上下文关键词重排'}
      </button>
      {isRanked && <button onClick={() => setRankedInput(null)}>回到本地匹配顺序</button>}
      <p data-testid="scrapbook-result-origin">
        排序来源：{isRanked ? '词项 TF-IDF' : '本地关键词匹配'} · {matches.length} 条命中
      </p>
      {error && (
        <p role="alert">
          {error}
          <button onClick={() => setAttempt((n) => n + 1)}>重新读取</button>
        </p>
      )}
      {matches.length === 0 && <p>暂无符合条件的废稿灵感片段</p>}
      {matches.map((f) => (
        <article className="border rounded p-3 space-y-2" key={f.id}>
          <p>
            来源: {f.sourceChapterTitle || '未命名章节'} (
            {Array.from(f.snippet.replace(/\s/gu, '')).length} 字) · 版本{' '}
            {f.sourceRevision ?? '未知'} · 位置 {f.sourceOffset ?? '未知'}
          </p>
          <blockquote className="whitespace-pre-wrap">{f.snippet}</blockquote>
          <p>{f.tags.join('、')}</p>
          <button onClick={() => void copy(f)}>{copiedId === f.id ? '已复制' : '提取片段'}</button>
          <button
            aria-label={'删除《' + (f.sourceChapterTitle || '未命名章节') + '》的废稿片段'}
            onClick={() => void remove(f.id)}
          >
            删除
          </button>
        </article>
      ))}
    </div>
  )
}
