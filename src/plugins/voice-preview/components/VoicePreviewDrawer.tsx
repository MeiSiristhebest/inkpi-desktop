import { useEffect, useState, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { VoicePreviewEngine } from '../engine/VoicePreviewEngine'
import { VoicePlaybackController } from '../engine/VoicePlaybackController'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'
export const VoicePreviewDrawer: FC<DesktopPluginDrawerProps> = (props) => (
  <VoiceDrawer key={props.projectId} {...props} />
)
const VoiceDrawer: FC<DesktopPluginDrawerProps> = ({ projectId, currentText }) => {
  const [player] = useState(() => new VoicePlaybackController())
  const [names, setNames] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    let stale = false
    indexedDbCodexEntityRepository
      .getAll()
      .then((all) => {
        if (!stale)
          setNames(
            all
              .filter((e) => e.projectId === projectId && e.category === 'character')
              .flatMap((e) => [e.name, ...(e.aliases ?? [])]),
          )
      })
      .catch((cause) => {
        if (!stale) setError(String(cause))
      })
    return () => {
      stale = true
    }
  }, [projectId])
  useEffect(() => {
    player.stop()
    setPlaying(false)
    return () => player.stop()
  }, [player, currentText])
  const script = VoicePreviewEngine.extractScript(currentText, names)
  const play = () => {
    try {
      player.start(
        script.lines.map((line) => ({
          lineIndex: line.lineIndex,
          text: line.dialogueText,
          pitch: 1,
          rate: 1,
        })),
        {
          onLine: () => setPlaying(true),
          onComplete: () => setPlaying(false),
          onError: (message) => {
            setPlaying(false)
            setError(message)
          },
        },
      )
    } catch (cause) {
      setError(String(cause))
    }
  }
  return (
    <div className="p-3 space-y-3 text-xs">
      <h3>广播剧对白试听</h3>
      <p>
        {script.totalLines} 句对白 · 已归属：{script.characterSpeakers.join('、') || '无明确归属'}
      </p>
      <p>快速试听使用系统默认声线；人物声线可在主面板明确分配。</p>
      {!player.isAvailable() && <p>当前环境未提供浏览器语音合成。</p>}
      {error && <p role="alert">{error}</p>}
      <button disabled={!player.isAvailable() || !script.totalLines} onClick={play}>
        试听当前对白
      </button>
      <button
        disabled={!playing}
        onClick={() => {
          player.stop()
          setPlaying(false)
        }}
      >
        停止
      </button>
      {script.lines.slice(0, 3).map((line) => (
        <blockquote key={line.lineIndex}>
          {line.speakerName}：{line.dialogueText}
        </blockquote>
      ))}
    </div>
  )
}
