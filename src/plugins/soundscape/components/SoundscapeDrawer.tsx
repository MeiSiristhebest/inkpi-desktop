import { useEffect, useState, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import type { SoundscapeConfigRecord } from '../types'
import { AudioSynthesizerEngine } from '../engine/AudioSynthesizerEngine'
import { indexedDbSoundscapeConfigRepository } from '../../../adapters/indexedDbSoundscapeConfigRepository'
const listeners: symbol[] = []
export const SoundscapeDrawer: FC<DesktopPluginDrawerProps> = (props) => (
  <SoundDrawer key={props.projectId} {...props} />
)
const SoundDrawer: FC<DesktopPluginDrawerProps> = ({ projectId }) => {
  const [synth] = useState(() => new AudioSynthesizerEngine())
  const [config, setConfig] = useState<SoundscapeConfigRecord | null>(null)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let stale = false
    indexedDbSoundscapeConfigRepository
      .get(projectId)
      .then((saved) => {
        if (stale) return
        if (
          saved &&
          (saved.projectId !== projectId ||
            ![saved.volumeKey, saved.volumeAmbience].every(
              (v) => Number.isFinite(v) && v >= 0 && v <= 1,
            ))
        )
          throw new Error('音景配置不属于当前项目或音量无效。')
        setConfig(saved ?? null)
        setError(null)
      })
      .catch((cause) => {
        if (!stale) setError(String(cause))
      })
    return () => {
      stale = true
    }
  }, [projectId, attempt])
  useEffect(() => () => synth.close(), [synth])
  useEffect(() => {
    if (!config?.enabled) return
    const token = Symbol()
    listeners.push(token)
    const onKey = (event: KeyboardEvent) => {
      if (
        listeners.at(-1) !== token ||
        event.repeat ||
        event.isComposing ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return
      if (
        !(event.target instanceof HTMLElement) ||
        !event.target.closest('.ProseMirror,[data-inkpi-editor]')
      )
        return
      if (
        Array.from(event.key).length !== 1 &&
        !['Enter', 'Backspace', 'Delete'].includes(event.key)
      )
        return
      void synth
        .triggerKeyPress(config.switchType, config.volumeKey)
        .catch((cause) => setError(String(cause)))
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      const index = listeners.indexOf(token)
      if (index >= 0) listeners.splice(index, 1)
    }
  }, [config, synth])
  const toggle = async () => {
    if (playing) {
      synth.stopAmbience()
      setPlaying(false)
      return
    }
    if (!config?.enabled) {
      setError('请先在音景主面板启用并保存配置。')
      return
    }
    try {
      setPlaying(await synth.startAmbience(config.backgroundAmbience, config.volumeAmbience))
      setError(null)
    } catch (cause) {
      setError(String(cause))
      setPlaying(false)
    }
  }
  return (
    <div className="p-3 space-y-3 text-xs">
      <h3>键盘伴奏 HUD</h3>
      <p>
        {config?.enabled ? '正文击键音已启用' : '击键音未启用'} · {config?.switchType ?? '未配置'} ·
        背景 {config?.backgroundAmbience ?? '未配置'}
      </p>
      <p>只监听正文编辑器的非组合击键；粘贴、AI 写入和章节切换不会触发击键音。</p>
      {error && (
        <p role="alert">
          {error}
          <button onClick={() => setAttempt((n) => n + 1)}>重新读取配置</button>
        </p>
      )}
      <button
        disabled={!config?.enabled || config.backgroundAmbience === 'none'}
        onClick={() => void toggle()}
      >
        {playing ? '暂停白噪音' : '播放白噪音'}
      </button>
    </div>
  )
}
