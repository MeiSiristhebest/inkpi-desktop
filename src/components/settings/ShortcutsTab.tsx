import type { FC } from 'react'
import { Section } from './SettingsShared'

const SHORTCUT_ITEMS = [
  { action: '新建章节', key: 'Ctrl + N' },
  { action: '全屏模式', key: 'Ctrl + .' },
  { action: '一键排版', key: 'Ctrl + K' },
  { action: '插入分隔线', key: 'Ctrl + Alt + S' },
  { action: '定位章首', key: 'Ctrl + ↑' },
  { action: '定位章尾', key: 'Ctrl + ↓' },
  { action: '老板键 / 快速隐藏', key: 'Alt + `' },
  { action: '查看快捷键', key: 'Ctrl + 0' },
  { action: '大纲面板', key: 'Ctrl + 1' },
  { action: '设定集 / Codex', key: 'Ctrl + 2' },
  { action: '查找替换', key: 'Ctrl + F' },
  { action: '保存章节', key: 'Ctrl + S' },
]

export const ShortcutsTab: FC = () => (
  <Section title="快捷键速查" desc="支持键盘高效全盲操，手不离键盘即可完成分卷、切章与排版。">
    <div className="p-4 grid grid-cols-2 gap-3">
      {SHORTCUT_ITEMS.map((item) => (
        <div
          key={item.action}
          className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] text-xs"
        >
          <span className="text-[var(--ink-text)] font-medium">{item.action}</span>
          <kbd className="px-2 py-0.5 rounded-md bg-[var(--ink-bg)] border border-[var(--ink-border)] text-[var(--ink-text-muted)] font-mono text-[11px] shadow-2xs">
            {item.key}
          </kbd>
        </div>
      ))}
    </div>
  </Section>
)
