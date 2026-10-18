import { useEffect, useMemo, useRef, useState, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import type { VoiceCastProfileRecord } from '../types'
import { VoicePreviewEngine } from '../engine/VoicePreviewEngine'
import { VoicePlaybackController } from '../engine/VoicePlaybackController'
import { indexedDbVoicePreviewRepository } from '../../../adapters/indexedDbVoicePreviewRepository'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { semanticTextFromContent } from '../../../domain/content'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'

export const VoicePreviewMasterView: FC<DesktopPluginViewProps> = (props) => (
  <VoiceSession key={props.projectId} {...props} />
)
const VoiceSession: FC<DesktopPluginViewProps> = ({ projectId, onStats }) => {
  const host = useOptionalPluginHostContext()
  const [player] = useState(() => new VoicePlaybackController())
  const [mode, setMode] = useState<'chapter' | 'manual'>('chapter')
  const [manualText, setManualText] = useState('')
  const [namesText, setNamesText] = useState('')
  const [knownNames, setKnownNames] = useState<string[]>([])
  const [casts, setCasts] = useState<VoiceCastProfileRecord[]>([])
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [overrides, setOverrides] = useState<{
    source: string
    values: Record<number, string>
  } | null>(null)
  const [current, setCurrent] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const chapter = host?.projectId === projectId ? host.activeChapter : null
  const chapterText =
    mode === 'chapter' && chapter
      ? semanticTextFromContent(chapter.id, chapter.content ?? '', chapter.revision)
      : manualText
  const source = JSON.stringify([projectId, mode, chapter?.id, chapter?.revision, chapterText])
  const sourceRef = useRef<string | null>(source)
  sourceRef.current = source
  useEffect(() => {
    player.stop()
    setPlaying(false)
    setCurrent(null)
    return () => player.stop()
  }, [player, source])
  useEffect(
    () => () => {
      sourceRef.current = null
    },
    [],
  )
  useEffect(() => {
    let stale = false
    Promise.all([
      indexedDbVoicePreviewRepository.getAll(projectId),
      indexedDbCodexEntityRepository.getAll(),
    ])
      .then(([profiles, entities]) => {
        if (stale) return
        setCasts(profiles.filter((c) => c.projectId === projectId))
        setKnownNames(
          entities
            .filter((e) => e.projectId === projectId && e.category === 'character')
            .flatMap((e) => [e.name, ...(e.aliases ?? [])]),
        )
        setError(null)
      })
      .catch((cause) => {
        if (!stale) setError(String(cause))
      })
    return () => {
      stale = true
    }
  }, [projectId, attempt])
  useEffect(() => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
    if (!synth) return
    const update = () => {
      try {
        setVoices(typeof synth.getVoices === 'function' ? synth.getVoices() : [])
      } catch (cause) {
        setError(String(cause))
      }
    }
    update()
    synth.addEventListener?.('voiceschanged', update)
    return () => synth.removeEventListener?.('voiceschanged', update)
  }, [])
  useEffect(() => {
    onStats?.({
      title: '角色对白试听',
      wordCount: Array.from(chapterText.replace(/\s/gu, '')).length,
      updatedAt: clock.now(),
    })
  }, [chapterText, onStats])
  const script = useMemo(
    () =>
      VoicePreviewEngine.extractScript(chapterText, [
        ...knownNames,
        ...namesText.split('\n').filter(Boolean),
      ]),
    [chapterText, knownNames, namesText],
  )
  const lines = script.lines.map((line) => ({
    ...line,
    speakerName:
      overrides?.source === source && overrides.values[line.lineIndex]
        ? overrides.values[line.lineIndex]
        : line.speakerName,
  }))
  const speakers = [
    ...new Set(lines.map((l) => l.speakerName).filter((name) => name !== '未归属说话人')),
  ]
  const profileFor = (name: string) =>
    [...casts].sort((a, b) => b.updatedAt - a.updatedAt).find((c) => c.characterName === name)
  const play = (selected = lines) => {
    const scope = source
    setError(null)
    try {
      player.start(
        selected.map((line) => {
          const cast = profileFor(line.speakerName)
          return {
            lineIndex: line.lineIndex,
            text: line.dialogueText,
            pitch: cast?.pitch ?? 1,
            rate: cast?.rate ?? 1,
            voiceURI: cast?.voiceURI,
            language: cast?.language,
          }
        }),
        {
          onLine: (index) => {
            if (sourceRef.current === scope) {
              setPlaying(true)
              setCurrent(index)
            }
          },
          onComplete: () => {
            if (sourceRef.current === scope) {
              setPlaying(false)
              setCurrent(null)
            }
          },
          onError: (message) => {
            if (sourceRef.current === scope) {
              setError(message)
              setPlaying(false)
              setCurrent(null)
            }
          },
        },
      )
    } catch (cause) {
      setError(String(cause))
      setPlaying(false)
    }
  }
  const prepare = () => {
    const additions = speakers
      .filter((name) => !profileFor(name))
      .map((name) => ({
        id: idGenerator.generate('cast'),
        projectId,
        characterId: 'manual-' + encodeURIComponent(name),
        ...VoicePreviewEngine.deriveDefaultProfile(name, 'neutral', 'unspecified'),
        updatedAt: clock.now(),
        assignmentSource: 'neutral-default' as const,
      }))
    setCasts((current) => [...current, ...additions])
    setNotice('已准备中性声线配置，调整后请保存。')
  }
  const save = async (cast: VoiceCastProfileRecord) => {
    setBusy(true)
    setError(null)
    try {
      VoicePreviewEngine.validateProfile(cast)
      const updated = { ...cast, assignmentSource: 'author' as const, updatedAt: clock.now() }
      await indexedDbVoicePreviewRepository.save(updated)
      setCasts((current) => current.map((c) => (c.id === cast.id && c === cast ? updated : c)))
      setNotice('声线配置已保存；保存期间的后续修改请再次保存。')
    } catch (cause) {
      setError('保存失败：' + String(cause))
    } finally {
      setBusy(false)
    }
  }
  const edit = (id: string, patch: Partial<VoiceCastProfileRecord>) =>
    setCasts((current) => current.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  return (
    <div className="p-6 space-y-4 h-full overflow-y-auto">
      <h2>角色拟真有声对白试听器 (VoicePreview)</h2>
      <p>
        使用当前系统提供的语音，按作者选择的声线、音调和语速试听。未确定的说话人需人工分配；浏览器语音不提供所称
        DSP 音色滤波。
      </p>
      {!player.isAvailable() && <p>当前环境未提供浏览器语音合成，台本和配置仍可编辑。</p>}
      {error && (
        <p role="alert">
          {error}
          <button onClick={() => setAttempt((n) => n + 1)}>重新读取配置</button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <button onClick={() => setMode('chapter')} disabled={!chapter}>
        使用当前章节
      </button>
      <button onClick={() => setMode('manual')}>使用独立片段</button>
      {mode === 'chapter' && !chapter && <p>尚未打开章节，可使用独立片段。</p>}
      <textarea
        aria-label="章节对白正文输入区"
        placeholder="粘贴章节正文以提取对白台本"
        readOnly={mode === 'chapter' && Boolean(chapter)}
        value={chapterText}
        onChange={(e) => {
          setMode('manual')
          setManualText(e.target.value)
        }}
      />
      <textarea
        aria-label="说话人名称清单"
        placeholder="需要按字面识别的角色名，每行一个；已读取本项目人物库"
        value={namesText}
        onChange={(e) => setNamesText(e.target.value)}
      />
      <button onClick={prepare} disabled={!speakers.length}>
        准备角色声线配置
      </button>
      <button disabled={!player.isAvailable() || !lines.length} onClick={() => play()}>
        整章对白试听 ({lines.length}句)
      </button>
      <button
        disabled={!playing}
        onClick={() => {
          player.stop()
          setPlaying(false)
          setCurrent(null)
        }}
      >
        停止播讲
      </button>
      <h3>广播剧音轨台本 ({lines.length} 句)</h3>
      {!lines.length && <p>等待正文：粘贴包含角色对白的章节正文后显示试听内容。</p>}
      {lines.map((line) => (
        <article className="border rounded p-3" key={line.lineIndex}>
          <p>
            {current === line.lineIndex ? '排队 / 播放中 · ' : ''}
            {line.speakerName} · 原文位置 {line.sourceStart}–{line.sourceEnd}
          </p>
          <blockquote className="whitespace-pre-wrap">{line.dialogueText}</blockquote>
          <p>归属依据：{line.attribution || '无明确归属'}；情绪未自动推断。</p>
          <input
            aria-label={'分配说话人 ' + line.lineIndex}
            placeholder="作者分配说话人"
            value={overrides?.source === source ? (overrides.values[line.lineIndex] ?? '') : ''}
            onChange={(e) =>
              setOverrides((previous) => ({
                source,
                values: {
                  ...(previous?.source === source ? previous.values : {}),
                  [line.lineIndex]: e.target.value,
                },
              }))
            }
          />
          <button disabled={!player.isAvailable()} onClick={() => play([line])}>
            试听第 {line.lineIndex} 句
          </button>
        </article>
      ))}
      <h3>登场角色声线调音板 ({casts.length})</h3>
      {casts.map((cast) => (
        <article key={cast.id} className="border rounded p-3 space-y-2">
          <strong>{cast.characterName}</strong>
          {!cast.assignmentSource && (
            <p>旧配置来源未记录；性别、年龄与滤波标签不用于推断新参数。</p>
          )}
          <select
            aria-label={'声线 ' + cast.characterName}
            value={cast.voiceURI ?? ''}
            onChange={(e) =>
              edit(cast.id, {
                voiceURI: e.target.value || undefined,
                language: voices.find((v) => v.voiceURI === e.target.value)?.lang,
              })
            }
          >
            <option value="">系统默认语音</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} · {v.lang}
              </option>
            ))}
          </select>
          <label>
            音调
            <input
              aria-label={'音调 ' + cast.characterName}
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={cast.pitch}
              onChange={(e) => edit(cast.id, { pitch: Number(e.target.value) })}
            />
          </label>
          <label>
            语速
            <input
              aria-label={'语速 ' + cast.characterName}
              type="number"
              min={0.5}
              max={2}
              step={0.1}
              value={cast.rate}
              onChange={(e) => edit(cast.id, { rate: Number(e.target.value) })}
            />
          </label>
          <button disabled={busy} onClick={() => void save(cast)}>
            保存此声线
          </button>
        </article>
      ))}
    </div>
  )
}
