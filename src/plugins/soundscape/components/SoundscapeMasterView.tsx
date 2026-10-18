import { useEffect, useRef, useState, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import type { SoundscapeConfigRecord } from '../types'
import { AudioSynthesizerEngine } from '../engine/AudioSynthesizerEngine'
import { indexedDbSoundscapeConfigRepository } from '../../../adapters/indexedDbSoundscapeConfigRepository'
import { clock } from '../../../adapters/clock'

export const SoundscapeMasterView: FC<DesktopPluginViewProps> = (props) => (
  <SoundscapeSession key={props.projectId} {...props} />
)
const SoundscapeSession: FC<DesktopPluginViewProps> = ({ projectId, onStats }) => {
  const [synth] = useState(() => new AudioSynthesizerEngine())
  const [config, setConfig] = useState<SoundscapeConfigRecord>({
    projectId,
    switchType: 'blue',
    backgroundAmbience: 'none',
    volumeKey: 0.2,
    volumeAmbience: 0.2,
    enabled: false,
  })
  const [playing, setPlaying] = useState(false)
  const [pending, setPending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const mounted = useRef(true)
  const configRef = useRef(config)
  configRef.current = config
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      synth.close()
    }
  }, [synth])
  useEffect(() => {
    let stale = false
    setLoading(true)
    indexedDbSoundscapeConfigRepository
      .get(projectId)
      .then((saved) => {
        if (stale) return
        if (saved) {
          if (
            saved.projectId !== projectId ||
            ![saved.volumeKey, saved.volumeAmbience].every(
              (v) => Number.isFinite(v) && v >= 0 && v <= 1,
            ) ||
            !['none', 'rain', 'campfire', 'temple'].includes(saved.backgroundAmbience)
          )
            throw new Error('已保存音景配置无效。')
          AudioSynthesizerEngine.getSwitchParams(saved.switchType)
          setConfig(saved)
        }
        setError(null)
      })
      .catch((cause) => {
        if (!stale) setError(String(cause))
      })
      .finally(() => {
        if (!stale) setLoading(false)
      })
    return () => {
      stale = true
    }
  }, [projectId, attempt])
  useEffect(() => {
    onStats?.({ title: '合成键盘声与背景音', wordCount: 0, updatedAt: clock.now() })
  }, [onStats])
  const edit = (patch: Partial<SoundscapeConfigRecord>) => {
    const next = { ...config, ...patch }
    configRef.current = next
    if (!next.enabled || next.backgroundAmbience !== config.backgroundAmbience) {
      synth.stopAmbience()
      setPlaying(false)
    }
    if (!next.enabled) synth.close()
    if (next.volumeAmbience !== config.volumeAmbience) synth.setAmbienceVolume(next.volumeAmbience)
    setConfig(next)
    setNotice('配置已修改，尚未保存。')
  }
  const toggle = async () => {
    if (playing) {
      synth.stopAmbience()
      setPlaying(false)
      return
    }
    const snapshot = config
    setPending(true)
    setError(null)
    try {
      const started = await synth.startAmbience(
        snapshot.backgroundAmbience,
        snapshot.volumeAmbience,
      )
      if (
        mounted.current &&
        configRef.current.enabled &&
        configRef.current.backgroundAmbience === snapshot.backgroundAmbience
      ) {
        synth.setAmbienceVolume(configRef.current.volumeAmbience)
        setPlaying(started)
      } else synth.stopAmbience()
    } catch (cause) {
      if (mounted.current) setError(String(cause))
    } finally {
      if (mounted.current) setPending(false)
    }
  }
  const save = async () => {
    const snapshot = config
    try {
      await indexedDbSoundscapeConfigRepository.save(snapshot)
      setError(null)
      setNotice(
        configRef.current === snapshot ? '音景配置已保存。' : '本次配置已保存，后续调整尚未保存。',
      )
    } catch (cause) {
      setError('保存失败：' + String(cause))
    }
  }
  return (
    <div className="p-6 space-y-4">
      <h2>机械键盘声学与白噪音伴奏 (Soundscape)</h2>
      <p>
        使用振荡器、滤波噪音与钟音合成可选音效。编辑器抽屉仅监听正文区域的真实击键事件，正文变化不会触发按键音。
      </p>
      {error && (
        <p role="alert">
          {error}
          <button onClick={() => setAttempt((n) => n + 1)}>重新读取配置</button>
          <button onClick={() => void save()}>重试保存</button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <fieldset disabled={loading} className="space-y-3">
        <button onClick={() => edit({ enabled: !config.enabled })}>
          {config.enabled ? '声学系统已开启' : '声学系统已静音'}
        </button>
        <select
          aria-label="轴体音效"
          value={config.switchType}
          onChange={(e) =>
            edit({ switchType: e.target.value as SoundscapeConfigRecord['switchType'] })
          }
        >
          <option value="blue">清脆青轴</option>
          <option value="brown">微段落茶轴</option>
          <option value="vintage">古典打字机</option>
          <option value="silent">静音</option>
        </select>
        <label>
          按键音量
          <input
            aria-label="按键音量"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={config.volumeKey}
            onChange={(e) => edit({ volumeKey: Number(e.target.value) })}
          />
        </label>
        <button
          disabled={!config.enabled}
          onClick={() =>
            void synth
              .triggerKeyPress(config.switchType, config.volumeKey)
              .catch((cause) => setError(String(cause)))
          }
        >
          试听当前击键合成音效 (Click)
        </button>
        <select
          aria-label="背景音景"
          value={config.backgroundAmbience}
          onChange={(e) =>
            edit({
              backgroundAmbience: e.target.value as SoundscapeConfigRecord['backgroundAmbience'],
            })
          }
        >
          <option value="none">无背景音</option>
          <option value="rain">雨声噪音</option>
          <option value="campfire">壁炉噪音</option>
          <option value="temple">钟音</option>
        </select>
        <label>
          环境音量
          <input
            aria-label="环境音量"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={config.volumeAmbience}
            onChange={(e) => edit({ volumeAmbience: Number(e.target.value) })}
          />
        </label>
        <button
          disabled={!config.enabled || config.backgroundAmbience === 'none' || pending}
          onClick={() => void toggle()}
        >
          {pending ? '启动音频中…' : playing ? '停止播放白噪音' : '开始播放背景白噪音'}
        </button>
        <button onClick={() => void save()}>保存音景配置</button>
      </fieldset>
    </div>
  )
}
