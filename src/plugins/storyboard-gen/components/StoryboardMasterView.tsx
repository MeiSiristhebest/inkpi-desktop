import { useEffect, useRef, useState, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import type {
  CharacterVisualCard,
  ClimaxStoryboardExtraction,
  StoryboardSceneRecord,
} from '../types'
import { StoryboardEngine } from '../engine/StoryboardEngine'
import { indexedDbStoryboardRepository } from '../../../adapters/indexedDbStoryboardRepository'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { usePluginAiTask } from '../../../core/usePluginAiTask'
import { PluginAiTaskPanel } from '../../../components/plugins/PluginAiTaskPanel'
import { semanticTextFromContent } from '../../../domain/content'
import { matchesSerializedResult } from '../../../domain/serializedResult'
import { redactPluginValue } from '../../../core/pluginDataRedaction'
import { clipboardWriter } from '../../../adapters/clipboardWriter'
import { blobFileDownloader } from '../../../adapters/blobFileDownloader'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'

export const StoryboardMasterView: FC<DesktopPluginViewProps> = (props) => (
  <StoryboardSession key={props.projectId} {...props} />
)
const StoryboardSession: FC<DesktopPluginViewProps> = ({ projectId, onStats }) => {
  const host = useOptionalPluginHostContext()
  const chapter = host?.projectId === projectId ? host.activeChapter : null
  const [mode, setMode] = useState<'chapter' | 'manual'>(chapter ? 'chapter' : 'manual')
  const [manualText, setManualText] = useState('')
  const [manualTitle, setManualTitle] = useState('')
  const [artStyle, setArtStyle] = useState('')
  const [sceneGoal, setSceneGoal] = useState('')
  const [characterName, setCharacterName] = useState('')
  const [visualFeatures, setVisualFeatures] = useState('')
  const [characters, setCharacters] = useState<
    Array<{ id: string; name: string; visualFeatures: string }>
  >([])
  const [scenes, setScenes] = useState<StoryboardSceneRecord[]>([])
  const [workflow, setWorkflow] = useState<{
    identity: string
    result: ClimaxStoryboardExtraction
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [copied, setCopied] = useState<{ identity: string; id: string } | null>(null)
  const activeChapter = mode === 'chapter' && chapter ? chapter : null
  const sourceText = activeChapter ? (activeChapter.content ?? '') : manualText
  const sourceTitle = activeChapter ? activeChapter.title : manualTitle
  const chapterId = activeChapter?.id ?? 'manual'
  const text = semanticTextFromContent(
    activeChapter?.id ?? `storyboard-${projectId}-manual`,
    sourceText,
    activeChapter?.revision,
  )
  const title = semanticTextFromContent(
    activeChapter ? `${activeChapter.id}-title` : `storyboard-${projectId}-title`,
    sourceTitle,
    activeChapter?.revision,
  )
  const semanticCharacters = characters.map((character) => ({
    ...character,
    name: semanticTextFromContent(`${character.id}-name`, character.name),
    visualFeatures: semanticTextFromContent(
      `${character.id}-visual-features`,
      character.visualFeatures,
    ),
  }))
  const context = {
    characters: semanticCharacters,
    artStyle: semanticTextFromContent(`storyboard-${projectId}-art-style`, artStyle),
    sceneGoal: semanticTextFromContent(`storyboard-${projectId}-scene-goal`, sceneGoal),
  }
  const identity = JSON.stringify([
    projectId,
    chapterId,
    activeChapter?.revision,
    sourceText,
    sourceTitle,
    characters,
    artStyle,
    sceneGoal,
  ])
  const identityRef = useRef<string | null>(identity)
  identityRef.current = identity
  useEffect(
    () => () => {
      identityRef.current = null
    },
    [],
  )
  const ai = usePluginAiTask('storyboard-gen', identity)
  const local = StoryboardEngine.extractStoryboard(chapterId, title, text, context)
  const runtimeInput = { chapterId, chapterTitle: title, chapterText: text, context }
  const analysisInput = {
    ...StoryboardEngine.buildAnalysisInput({
      chapterTitle: title,
      chapterText: text,
      artStyle: context.artStyle,
    }),
    characters: context.characters,
    sceneGoal: context.sceneGoal,
  }
  const extracted = workflow?.identity === identity ? workflow.result : local
  useEffect(() => {
    let stale = false
    indexedDbStoryboardRepository
      .getAll(projectId)
      .then((all) => {
        if (!stale) {
          setScenes(all.filter((s) => s.projectId === projectId))
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
      title: '原文分镜草案',
      wordCount: Array.from(text.replace(/\s/gu, '')).length,
      updatedAt: clock.now(),
    })
  }, [text, onStats])
  const run = async () => {
    if (!text.trim() || busyRef.current) return
    const scope = identity
    const expected = local
    busyRef.current = true
    setBusy(true)
    setError(null)
    try {
      if (!host?.aiAssistant?.isAvailable || !host.aiAssistant.runPluginWorkflow)
        throw new Error('Runtime 工作流未连接。')
      const outcome = await host.aiAssistant.runPluginWorkflow('storyboard-gen', runtimeInput, {
        projectId,
        executionMode: 'explicit',
      })
      if (identityRef.current !== scope) return
      if (outcome?.status !== 'completed')
        throw new Error(outcome?.status === 'failed' ? outcome.error : '工作流尚未完成。')
      if (!matchesSerializedResult(outcome.result, redactPluginValue(expected)))
        throw new Error('返回的镜头与当前原文或视觉约束不一致。')
      setWorkflow({ identity: scope, result: expected })
      setNotice('Runtime 分镜草案已构建。')
    } catch (cause) {
      if (identityRef.current === scope) setError(String(cause))
    } finally {
      busyRef.current = false
      if (identityRef.current !== null) setBusy(false)
    }
  }
  const save = async () => {
    if (!extracted.frames.length || busyRef.current) return
    const scope = identity
    busyRef.current = true
    setBusy(true)
    try {
      const record = {
        ...StoryboardEngine.createSceneRecord(
          idGenerator.generate('storyboard'),
          projectId,
          chapterId,
          extracted,
          clock.now(),
        ),
        sourceRevision: mode === 'chapter' ? chapter?.revision : undefined,
      }
      await indexedDbStoryboardRepository.save(record)
      setScenes((current) => [...current, record])
      setNotice(
        identityRef.current === scope ? '分镜草案已归档。' : '本次草案已归档，后续修改尚未保存。',
      )
      setError(null)
    } catch (cause) {
      setError('保存失败：' + String(cause))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }
  const copy = async (prompt: string, id: string) => {
    const scope = identity
    try {
      await clipboardWriter.writeText(prompt)
      if (identityRef.current === scope) {
        setCopied({ identity: scope, id })
        setError(null)
      }
    } catch (cause) {
      if (identityRef.current === scope) setError('复制失败：' + String(cause))
    }
  }
  const exportPlan = () => {
    const body =
      '# ' +
      extracted.sceneTitle +
      '\n\n作者画风：' +
      (artStyle || '未提供') +
      '\n作者场景目标：' +
      (sceneGoal || '未提供') +
      '\n\n' +
      extracted.frames
        .map(
          (frame) =>
            '## ' +
            frame.shotLabel +
            '\n\n原文位置：' +
            frame.sourceStart +
            '–' +
            frame.sourceEnd +
            '\n\n' +
            frame.sourceQuote +
            '\n\n提示词：\n' +
            frame.visualPrompt,
        )
        .join('\n\n') +
      '\n\n## 作者角色外观\n' +
      extracted.suggestedCharacters
        .map((card) => card.characterName + '：' + (card.visualFeatures || '未提供'))
        .join('\n')
    try {
      blobFileDownloader.downloadBlob(
        '分镜草案.md',
        new Blob([body], { type: 'text/markdown;charset=utf-8' }),
      )
    } catch (cause) {
      setError(String(cause))
    }
  }
  return (
    <div className="p-6 space-y-4 h-full overflow-y-auto">
      <h2>角色立绘与分镜生成器 (StoryboardGen)</h2>
      <p>
        按实际正文提供最多四个镜头素材，机位属于可选设计；未提供的角色外观和光线保持未知。构图示意不代表已生成图片。
      </p>
      <button disabled={!chapter} onClick={() => setMode('chapter')}>
        使用当前章节
      </button>
      <button onClick={() => setMode('manual')}>使用独立场景</button>
      <p>
        来源：
        {mode === 'chapter' && chapter
          ? chapter.title + ' · 版本 ' + (chapter.revision ?? '未知')
          : '作者独立场景'}
      </p>
      {mode === 'manual' && (
        <input
          aria-label="场景标题"
          placeholder="场景标题"
          value={manualTitle}
          onChange={(e) => setManualTitle(e.target.value)}
        />
      )}
      <textarea
        aria-label="高潮名场面文本描述"
        placeholder="提供需要制作分镜的真实场景文本"
        readOnly={mode === 'chapter'}
        value={text}
        onChange={(e) => setManualText(e.target.value)}
      />
      <input
        aria-label="作者场景目标"
        placeholder="需要表达的场景目标"
        value={sceneGoal}
        onChange={(e) => setSceneGoal(e.target.value)}
      />
      <input
        aria-label="作者画风"
        placeholder="作者选择的画风（可留空）"
        value={artStyle}
        onChange={(e) => setArtStyle(e.target.value)}
      />
      <input
        aria-label="角色名称"
        placeholder="角色名称"
        value={characterName}
        onChange={(e) => setCharacterName(e.target.value)}
      />
      <textarea
        aria-label="角色外观约束"
        placeholder="作者明确的发型、服装、姿态等外观约束"
        value={visualFeatures}
        onChange={(e) => setVisualFeatures(e.target.value)}
      />
      <button
        disabled={!characterName.trim()}
        onClick={() => {
          setCharacters((current) => [
            ...current,
            {
              id: idGenerator.generate('visual-character'),
              name: characterName.trim(),
              visualFeatures,
            },
          ])
          setCharacterName('')
          setVisualFeatures('')
        }}
      >
        加入角色外观约束
      </button>
      {characters.map((character) => (
        <p key={character.id}>
          {character.name}：{character.visualFeatures || '外观尚未提供'}
          <button
            onClick={() => setCharacters((current) => current.filter((c) => c.id !== character.id))}
          >
            移除
          </button>
        </p>
      ))}
      {error && (
        <p role="alert">
          {error}
          <button onClick={() => setAttempt((n) => n + 1)}>重新读取档案</button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <button
        disabled={!text.trim() || busy || !host?.aiAssistant?.isAvailable}
        onClick={() => void run()}
      >
        {busy ? '运行中…' : '构建 Runtime 分镜草案'}
      </button>
      <button disabled={!extracted.frames.length || busy} onClick={() => void save()}>
        归档本幕分镜草案
      </button>
      <button disabled={!extracted.frames.length} onClick={exportPlan}>
        导出分镜与角色提示词
      </button>
      {host?.aiAssistant?.isAvailable && (
        <button disabled={!text.trim() || ai.isRunning} onClick={() => void ai.run(analysisInput)}>
          AI 场景与镜头复核
        </button>
      )}
      <PluginAiTaskPanel view={ai.view} onRetry={ai.retry} />
      {!text.trim() && <p>没有场景正文，尚未生成镜头素材。</p>}
      <p>
        原文段落覆盖：{extracted.coverage?.suppliedPassages ?? 0} /{' '}
        {extracted.coverage?.totalPassages ?? 0}
        ；超过四段时抽取开头、中间和结尾，未检查全部场景意义。
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {extracted.frames.map((frame) => (
          <article key={frame.id} className="border rounded p-3 space-y-2">
            <h3>{frame.shotLabel}</h3>
            <svg viewBox="0 0 160 90" role="img" aria-label="可选构图示意">
              <rect width="160" height="90" fill="#161e2e" />
              <path d="M53 0V90M107 0V90M0 30H160M0 60H160" stroke="#94a3b8" opacity=".5" />
            </svg>
            <p>
              原文位置 {frame.sourceStart}–{frame.sourceEnd}
            </p>
            <blockquote className="whitespace-pre-wrap">{frame.sourceQuote}</blockquote>
            <p>光线：{frame.lightingMood || '未提供'}</p>
            <pre className="whitespace-pre-wrap">{frame.visualPrompt}</pre>
            <button onClick={() => void copy(frame.visualPrompt, frame.id)}>
              {copied?.identity === identity && copied.id === frame.id
                ? '已复制'
                : '复制镜头提示词'}
            </button>
          </article>
        ))}
      </div>
      {extracted.suggestedCharacters.map((character: CharacterVisualCard) => (
        <article key={character.characterId} className="border p-3">
          <strong>{character.characterName}</strong>
          <p>{character.visualFeatures || '外观尚未提供'}</p>
          <button onClick={() => void copy(character.stableDiffusionPrompt, character.characterId)}>
            复制立绘 Prompt
          </button>
        </article>
      ))}
      <h3>已保存分镜档案 ({scenes.length})</h3>
      {scenes.map((scene) => (
        <details key={scene.id}>
          <summary>
            {scene.sceneTitle} ·{' '}
            {scene.chapterId === 'manual'
              ? '独立场景'
              : '章节版本 ' + (scene.sourceRevision ?? '未知')}
          </summary>
          {scene.schemaVersion !== 2 && <p>旧模板场景与外观未经本轮验证。</p>}
          {scene.shotFrames.map((frame) => (
            <p key={frame.id}>{frame.description}</p>
          ))}
        </details>
      ))}
    </div>
  )
}
