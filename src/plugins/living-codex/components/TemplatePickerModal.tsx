import { useId, useState, type FC } from 'react'
import { X, Sparkles, User, Shield, MapPin, Check } from 'lucide-react'
import { Modal } from '../../../ui/molecules/Modal'
import {
  CHARACTER_PRESETS,
  WORLD_TEMPLATE_PRESETS,
  countTemplates,
} from '../content/characterPresets'
import type { CharacterPreset, WorldTemplatePreset } from '../content/characterPresets'
import type { CodexEntity } from '../types'

interface TemplatePickerModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (presetData: Partial<CodexEntity>) => void
}

export const TemplatePickerModal: FC<TemplatePickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const [activeTab, setActiveTab] = useState<'character' | 'faction' | 'item' | 'location'>(
    'character',
  )
  const [genderFilter, setGenderFilter] = useState<'all' | '男' | '女'>('all')
  const [selectedPreset, setSelectedPreset] = useState<CharacterPreset | null>(
    CHARACTER_PRESETS[0] || null,
  )
  const titleId = useId()

  if (!isOpen) return null

  const filteredCharacters = CHARACTER_PRESETS.filter(
    (p) => genderFilter === 'all' || p.gender === genderFilter,
  )

  const effectivePreset =
    filteredCharacters.find((p) => p.id === selectedPreset?.id) || filteredCharacters[0] || null

  // 只把模板灌进当前表单、不写库（§P2.15）：与 consistency-sentinel「套用预置体系」那种直接落库的动词必须分开。
  const handleFillCharacterForm = (preset: CharacterPreset) => {
    onSelect({
      name: '',
      aliases: [],
      category: 'character',
      summary: preset.summaryTemplate,
      attributes: preset.suggestedAttributes,
      detailMarkdown: preset.detailMarkdown,
    })
    onClose()
  }

  const handleFillGenericForm = (preset: WorldTemplatePreset) => {
    onSelect({
      name: '',
      aliases: [],
      category: preset.category,
      summary: preset.summary,
      attributes: { 类别: preset.title, 危险等级: '普通' },
      detailMarkdown: preset.detailMarkdown,
    })
    onClose()
  }

  return (
    <Modal
      onClose={onClose}
      ariaLabelledBy={titleId}
      widthClass="max-w-3xl"
      panelClassName="h-[580px] bg-[var(--ink-bg)] text-[var(--ink-text)] rounded-xl border border-[var(--ink-border)] shadow-2xl flex flex-col overflow-hidden"
    >
      {/* 弹窗顶栏 */}
      <div className="h-12 shrink-0 px-4 border-b border-[var(--ink-border)] bg-[var(--ink-bg-sidebar)] flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-[13px]">
          <Sparkles className="w-4 h-4 text-[var(--ink-accent)]" />
          <span id={titleId}>世界观与人设模版库（{countTemplates()} 款预置模板）</span>
        </div>
        <button
          onClick={onClose}
          aria-label="关闭"
          className="p-1 rounded-md text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 题材/类型选项卡 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--ink-border)] bg-[var(--ink-bg-sidebar)]/50 text-[12px]">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('character')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
              activeTab === 'character'
                ? 'bg-[var(--ink-bg-active)] font-medium text-[var(--ink-accent)] shadow-xs'
                : 'text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)]'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>核心人设模版</span>
          </button>
          <button
            onClick={() => setActiveTab('faction')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
              activeTab === 'faction'
                ? 'bg-[var(--ink-bg-active)] font-medium text-[var(--ink-accent)] shadow-xs'
                : 'text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)]'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>势力宗门模版</span>
          </button>
          <button
            onClick={() => setActiveTab('item')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
              activeTab === 'item'
                ? 'bg-[var(--ink-bg-active)] font-medium text-[var(--ink-accent)] shadow-xs'
                : 'text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>神兵法宝模版</span>
          </button>
          <button
            onClick={() => setActiveTab('location')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
              activeTab === 'location'
                ? 'bg-[var(--ink-bg-active)] font-medium text-[var(--ink-accent)] shadow-xs'
                : 'text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)]'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>地理禁地模版</span>
          </button>
        </div>

        {activeTab === 'character' && (
          <div className="flex items-center gap-1 bg-[var(--ink-bg)] p-0.5 rounded border border-[var(--ink-border)] text-[11px]">
            <button
              onClick={() => setGenderFilter('all')}
              className={`px-2 py-0.5 rounded ${genderFilter === 'all' ? 'bg-[var(--ink-accent)] text-white' : 'text-[var(--ink-text-muted)]'}`}
            >
              全部
            </button>
            <button
              onClick={() => setGenderFilter('女')}
              className={`px-2 py-0.5 rounded ${genderFilter === '女' ? 'bg-[var(--ink-accent)] text-white' : 'text-[var(--ink-text-muted)]'}`}
            >
              女性人设
            </button>
            <button
              onClick={() => setGenderFilter('男')}
              className={`px-2 py-0.5 rounded ${genderFilter === '男' ? 'bg-[var(--ink-accent)] text-white' : 'text-[var(--ink-text-muted)]'}`}
            >
              男性人设
            </button>
          </div>
        )}
      </div>

      {/* 模版展示区 */}
      <div className="flex-1 flex min-h-0">
        {activeTab === 'character' ? (
          <>
            {/* 人设模版列表 */}
            <div className="w-72 shrink-0 border-r border-[var(--ink-border)] overflow-y-auto p-2 space-y-1.5">
              {filteredCharacters.map((preset) => {
                const isSelected = selectedPreset?.id === preset.id
                return (
                  <div
                    key={preset.id}
                    onClick={() => setSelectedPreset(preset)}
                    className={`p-2.5 rounded-lg border text-[12px] cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[var(--ink-bg-active)] border-[var(--ink-accent)] ring-1 ring-[var(--ink-accent)]/20'
                        : 'bg-[var(--ink-bg-card)] border-[var(--ink-border)] hover:border-[var(--ink-accent)]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[13px]">{preset.name}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${preset.gender === '女' ? 'bg-pink-500/10 text-pink-500' : 'bg-blue-500/10 text-blue-500'}`}
                      >
                        {preset.gender}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--ink-text-faint)] mt-1 truncate">
                      {preset.tagline}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* 人设模版详细预览与应用 */}
            {effectivePreset && (
              <div className="flex-1 flex flex-col min-w-0 p-4 overflow-y-auto text-[12px] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-[15px] font-bold text-[var(--ink-text)]">
                      {effectivePreset.name}
                    </h4>
                    <p className="text-[11px] text-[var(--ink-accent)] font-medium mt-0.5">
                      {effectivePreset.tagline}
                    </p>
                  </div>
                  <button
                    onClick={() => handleFillCharacterForm(effectivePreset)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--ink-accent)] text-white rounded-lg font-medium text-[12px] shadow-sm hover:opacity-90"
                  >
                    <Check className="w-3.5 h-3.5" />
                    填入当前设定表单
                  </button>
                </div>
                <p className="text-[11px] text-[var(--ink-text-faint)]">
                  只是把模板文字填入右侧设定表单；选择时不会写入设定库，点击保存后才会创建或更新记录。
                </p>

                <div className="p-2.5 rounded-lg bg-[var(--ink-bg-sidebar)] border border-[var(--ink-border)]">
                  <span className="text-[11px] font-medium text-[var(--ink-text-faint)]">
                    适配身份定位:
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {effectivePreset.fit.map((f, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--ink-bg-hover)] text-[var(--ink-text-muted)]"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex-1 p-3 rounded-lg bg-[var(--ink-bg-card)] border border-[var(--ink-border)] overflow-y-auto font-sans leading-relaxed whitespace-pre-wrap text-[12px] text-[var(--ink-text-muted)]">
                  {effectivePreset.detailMarkdown}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 p-4 grid grid-cols-2 gap-3 overflow-y-auto">
            {WORLD_TEMPLATE_PRESETS.filter((t) => t.category === activeTab).map((t) => (
              <div
                key={t.id}
                onClick={() => handleFillGenericForm(t)}
                className="p-4 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-card)] hover:border-[var(--ink-accent)] cursor-pointer"
              >
                <h4 className="font-semibold text-[13px]">{t.heading}</h4>
                <p className="text-[11px] text-[var(--ink-text-muted)] mt-1">{t.blurb}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
