import { useState } from 'react'
import { Section, Row, Switch } from './SettingsShared'
import type { AppSettings } from '../../core/settings'
import { localStorageKeyValueStore } from '../../adapters/localStorageKeyValueStore'

export interface WritingHabitsConfig {
  autoScrollMode: 'wrap' | 'enter'
  scrollThreshold: string
  scrollCrossChapter: boolean
  highlightRole: boolean
  highlightSetting: boolean
  highlightOccurrence: 'first' | 'all'
  highlightStyle: 'underline' | 'badge'
  autoNumbering: boolean
  autoQuotes: boolean
  showRoyaltyEstimate: boolean
  sedentaryMinutes: string
  chapterTargetWord: string
}

export const WRITING_HABITS_STORAGE_KEY = 'inkpi-writing-habits-config'

export const getWritingHabitsConfig = (): WritingHabitsConfig => {
  try {
    const raw = localStorageKeyValueStore.getSync(WRITING_HABITS_STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return {
    autoScrollMode: 'wrap',
    scrollThreshold: '70%',
    scrollCrossChapter: false,
    highlightRole: true,
    highlightSetting: true,
    highlightOccurrence: 'first',
    highlightStyle: 'underline',
    autoNumbering: true,
    autoQuotes: true,
    showRoyaltyEstimate: false,
    sedentaryMinutes: '40',
    chapterTargetWord: '2000',
  }
}

export const WritingHabitsTab: React.FC<{
  settings?: AppSettings
  update?: (p: Partial<AppSettings>) => void
}> = () => {
  const [config, setConfig] = useState<WritingHabitsConfig>(getWritingHabitsConfig)

  const updateConfig = (patch: Partial<WritingHabitsConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch }
      void localStorageKeyValueStore.set(WRITING_HABITS_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  return (
    <>
      <Section title="自动滚屏" desc="码字时正文根据光标位置平滑自动向上滚动，保持视口舒适。">
        <Row label="换行时滚动" hint="性能表现佳，光标垂直居中维持在黄金分割线上">
          <Switch
            checked={config.autoScrollMode === 'wrap'}
            onChange={() => updateConfig({ autoScrollMode: 'wrap' })}
          />
        </Row>
        <Row label="回车时滚动" hint="仅在按下回车换段时触发页面滚动">
          <Switch
            checked={config.autoScrollMode === 'enter'}
            onChange={() => updateConfig({ autoScrollMode: 'enter' })}
          />
        </Row>
        <Row
          label={`滚屏触发高度 · ${config.scrollThreshold}`}
          hint="内容达到指定视口高度时开始平滑滚屏"
        >
          <select
            value={config.scrollThreshold}
            onChange={(e) => updateConfig({ scrollThreshold: e.target.value })}
            className="px-2.5 py-1 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] text-xs"
          >
            <option value="50%">50%</option>
            <option value="60%">60%</option>
            <option value="70%">70%</option>
            <option value="80%">80%</option>
          </select>
        </Row>
        <Row label="滚动跨章" hint="滚动到底部时可直接翻看下一章">
          <Switch
            checked={config.scrollCrossChapter}
            onChange={(v) => updateConfig({ scrollCrossChapter: v })}
          />
        </Row>
      </Section>

      <Section title="自动高亮与设定感知" desc="正文出现设定集人物角色与专有名词时智能高亮标记。">
        <Row label="识别角色与设定名词">
          <div className="flex gap-4 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={config.highlightRole}
                onChange={(e) => updateConfig({ highlightRole: e.target.checked })}
                className="w-3.5 h-3.5 rounded text-[var(--ink-accent)] accent-[var(--ink-accent)]"
              />
              <span>角色</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={config.highlightSetting}
                onChange={(e) => updateConfig({ highlightSetting: e.target.checked })}
                className="w-3.5 h-3.5 rounded text-[var(--ink-accent)] accent-[var(--ink-accent)]"
              />
              <span>设定</span>
            </label>
          </div>
        </Row>
        <Row label="高亮触发范围与呈现样式">
          <div className="flex items-center gap-2 text-xs">
            <select
              value={config.highlightOccurrence}
              onChange={(e) =>
                updateConfig({ highlightOccurrence: e.target.value as 'first' | 'all' })
              }
              className="px-2 py-1 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] text-xs"
            >
              <option value="first">首次出现</option>
              <option value="all">全部出现</option>
            </select>
            <select
              value={config.highlightStyle}
              onChange={(e) =>
                updateConfig({ highlightStyle: e.target.value as 'underline' | 'badge' })
              }
              className="px-2 py-1 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] text-xs"
            >
              <option value="underline">下划线高亮</option>
              <option value="badge">徽章点缀</option>
            </select>
          </div>
        </Row>
      </Section>

      <Section title="章节与标点辅助">
        <Row label="新建章节时自动生成章节号" hint="如「第001章 」，保持目录命名整洁">
          <Switch
            checked={config.autoNumbering}
            onChange={(v) => updateConfig({ autoNumbering: v })}
          />
        </Row>
        <Row label="输入“时自动补齐双引号”" hint="并将光标自动置于引号中间">
          <Switch checked={config.autoQuotes} onChange={(v) => updateConfig({ autoQuotes: v })} />
        </Row>
        <Row label="状态栏显示稿费预估选项">
          <Switch
            checked={config.showRoyaltyEstimate}
            onChange={(v) => updateConfig({ showRoyaltyEstimate: v })}
          />
        </Row>
      </Section>

      <Section title="健康与节奏提醒">
        <Row label="久坐提醒" hint="连续码字达到设定时长后弹出柔和休息提示">
          <select
            value={config.sedentaryMinutes}
            onChange={(e) => updateConfig({ sedentaryMinutes: e.target.value })}
            className="px-2.5 py-1 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] text-xs"
          >
            <option value="30">连续 30 分钟</option>
            <option value="40">连续 40 分钟</option>
            <option value="60">连续 60 分钟</option>
          </select>
        </Row>
        <Row label="分章提示" hint="单章字数达到设定目标时提醒收尾剧情钩子">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[var(--ink-text-muted)]">每满</span>
            <input
              type="number"
              value={config.chapterTargetWord}
              onChange={(e) => updateConfig({ chapterTargetWord: e.target.value })}
              className="w-16 px-2 py-1 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] text-center text-xs tabular-nums"
            />
            <span className="text-[var(--ink-text-muted)]">字提醒</span>
          </div>
        </Row>
      </Section>
    </>
  )
}
