import { useState, type FC } from 'react'
import { X, Sparkles, User, Shield, MapPin, Check } from 'lucide-react'
import { CHARACTER_PRESETS, type CharacterPreset } from '../content/characterPresets'
import type { CodexEntity, CodexCategory } from '../types'

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
  const [activeTab, setActiveTab] = useState<'character' | 'faction' | 'item' | 'location'>('character')
  const [genderFilter, setGenderFilter] = useState<'all' | '男' | '女'>('all')
  const [selectedPreset, setSelectedPreset] = useState<CharacterPreset | null>(CHARACTER_PRESETS[0] || null)

  if (!isOpen) return null

  const filteredCharacters = CHARACTER_PRESETS.filter(
    (p) => genderFilter === 'all' || p.gender === genderFilter
  )

  const effectivePreset =
    filteredCharacters.find((p) => p.id === selectedPreset?.id) || filteredCharacters[0] || null

  const handleApplyCharacter = (preset: CharacterPreset) => {
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

  const handleApplyGenericTemplate = (category: CodexCategory, title: string, summary: string, markdown: string) => {
    onSelect({
      name: '',
      aliases: [],
      category,
      summary,
      attributes: { 类别: title, 危险等级: '普通' },
      detailMarkdown: markdown,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-3xl h-[580px] bg-[var(--ink-bg)] text-[var(--ink-text)] rounded-xl border border-[var(--ink-border)] shadow-2xl flex flex-col overflow-hidden">
        {/* 弹窗顶栏 */}
        <div className="h-12 shrink-0 px-4 border-b border-[var(--ink-border)] bg-[var(--ink-bg-sidebar)] flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-[13px]">
            <Sparkles className="w-4 h-4 text-[var(--ink-accent)]" />
            <span>世界观与人设模版库 (36+ 款预置模板)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)]"
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
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${preset.gender === '女' ? 'bg-pink-500/10 text-pink-500' : 'bg-blue-500/10 text-blue-500'}`}>
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
                      onClick={() => handleApplyCharacter(effectivePreset)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--ink-accent)] text-white rounded-lg font-medium text-[12px] shadow-sm hover:opacity-90"
                    >
                      <Check className="w-3.5 h-3.5" />
                      一键套用此人设
                    </button>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[var(--ink-bg-sidebar)] border border-[var(--ink-border)]">
                    <span className="text-[11px] font-medium text-[var(--ink-text-faint)]">适配身份定位:</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {effectivePreset.fit.map((f, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--ink-bg-hover)] text-[var(--ink-text-muted)]">
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
          ) : activeTab === 'faction' ? (
            <div className="flex-1 p-4 grid grid-cols-2 gap-3 overflow-y-auto">
              <div
                onClick={() =>
                  handleApplyGenericTemplate(
                    'faction',
                    '隐世仙门/名门正派',
                    '传承万年的正道巨擘，拥有护宗大阵与太上长老团，门风严谨。',
                    '### 宗门构架\n分为内门、外门、执法堂、传功阁。\n\n### 镇派至宝\n护宗天阶大阵、不灭真火。'
                  )
                }
                className="p-4 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-card)] hover:border-[var(--ink-accent)] cursor-pointer"
              >
                <h4 className="font-semibold text-[13px]">隐世仙门 / 名门正派</h4>
                <p className="text-[11px] text-[var(--ink-text-muted)] mt-1">传承万载的正道巨擘，以阵法、剑诀与浩然正气著称。</p>
              </div>
              <div
                onClick={() =>
                  handleApplyGenericTemplate(
                    'faction',
                    '魔门九幽/暗杀公会',
                    '藏于暗处的杀伐势力，实力为尊，内部遵循残酷的丛林法则。',
                    '### 组织戒律\n完成任务赏千金，泄密者诛灭九族。\n\n### 核心秘法\n九幽匿影身法、煞血噬魂术。'
                  )
                }
                className="p-4 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-card)] hover:border-[var(--ink-accent)] cursor-pointer"
              >
                <h4 className="font-semibold text-[13px]">魔门九幽 / 暗杀公会</h4>
                <p className="text-[11px] text-[var(--ink-text-muted)] mt-1">行事狠辣不择手段的暗影势力，视规矩为无物。</p>
              </div>
            </div>
          ) : activeTab === 'item' ? (
            <div className="flex-1 p-4 grid grid-cols-2 gap-3 overflow-y-auto">
              <div
                onClick={() =>
                  handleApplyGenericTemplate(
                    'item',
                    '上古神器/本命法宝',
                    '封印中的太古至尊神物，内蕴残破乾坤小世界，可成长进化。',
                    '### 法宝特质\n随宿主境界逐步解封九重神禁。\n\n### 附带神通\n时间流速加速、提纯天地灵药。'
                  )
                }
                className="p-4 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-card)] hover:border-[var(--ink-accent)] cursor-pointer"
              >
                <h4 className="font-semibold text-[13px]">上古神器 / 本命至宝</h4>
                <p className="text-[11px] text-[var(--ink-text-muted)] mt-1">主角专属随身金手指法宝，带残魂或独立空间。</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 p-4 grid grid-cols-2 gap-3 overflow-y-auto">
              <div
                onClick={() =>
                  handleApplyGenericTemplate(
                    'location',
                    '远古秘境/太古神墟',
                    '千年一开的试炼遗迹，机缘与大凶并存，内有太古妖兽盘踞。',
                    '### 入境限制\n仅容许骨龄百岁以下或金丹以下修士进入。\n\n### 核心产出\n筑基灵草、上古功法残卷、天外神石。'
                  )
                }
                className="p-4 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-card)] hover:border-[var(--ink-accent)] cursor-pointer"
              >
                <h4 className="font-semibold text-[13px]">远古秘境 / 太古神墟</h4>
                <p className="text-[11px] text-[var(--ink-text-muted)] mt-1">各大势力抢夺机缘的副本舞台，杀人夺宝高发地。</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
