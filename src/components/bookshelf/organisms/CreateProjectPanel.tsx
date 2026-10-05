import { useState, useRef, type ChangeEvent } from 'react'
import { ImageIcon, X, ChevronDown, ChevronRight } from 'lucide-react'
import { ALL_AVAILABLE_PLUGINS, PLUGIN_CATEGORIES } from '../../../core/pluginRegistry'
import {
  LEAN_PLUGIN_IDS,
  PROJECT_GENRES,
  RECOMMENDED_PLUGIN_IDS,
  type NewProjectForm,
  type ProjectStarter,
  type ToolingCombo,
} from '../../../domain/project/projectDefaults'
import { readCoverImage } from '../coverUpload'
import { Tooltip } from '../../../ui/primitives'

interface CreateProjectPanelProps {
  onClose: () => void
  onCreate: (form: NewProjectForm) => void
}

const optionClass = (active: boolean) =>
  `flex-1 text-left px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
    active
      ? 'border-[var(--ink-accent)]/50 bg-[var(--ink-accent-soft)] text-[var(--ink-accent)]'
      : 'border-[var(--ink-border)] bg-[var(--ink-bg-panel)] text-[var(--ink-text)] hover:border-[var(--ink-border-strong)]'
  }`

const labelClass = 'text-[11px] text-[var(--ink-text-muted)] mb-1 block'

/**
 * 展开式「新建小说项目」面板（原子设计 · organisms，§P3.6）。
 *
 * 只要求书名，其余全部可选 —— 但每一个可选项都会留下真实差别：封面进项目记录并显示在卡片
 * 与字数浮窗上，「从哪里开始」决定种子路径（示范会注入成套样例设定），工具组合写进这个项目
 * 自己的插件开关。所以这里不再出现「完整项目 / 自定义项目」那种看着不同、落库相同的选项。
 * 高级用户不展开「更多设置」就是一次性创建，摘要行如实念出未展开时生效的默认值。
 */
export const CreateProjectPanel = ({ onClose, onCreate }: CreateProjectPanelProps) => {
  const [name, setName] = useState('')
  const [cover, setCover] = useState('')
  const [genre, setGenre] = useState('')
  const [starter, setStarter] = useState<ProjectStarter>('blank')
  const [tooling, setTooling] = useState<ToolingCombo>('recommended')
  const [customPluginIds, setCustomPluginIds] = useState<readonly string[]>(RECOMMENDED_PLUGIN_IDS)
  const [advanced, setAdvanced] = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const toolingCount =
    tooling === 'lite'
      ? LEAN_PLUGIN_IDS.length
      : tooling === 'recommended'
        ? RECOMMENDED_PLUGIN_IDS.length
        : customPluginIds.length

  const trimmedName = name.trim()
  const summary = [
    starter === 'demo' ? '示范样例' : '空白作品',
    `${toolingCount} 件工具`,
    genre.trim() ? genre.trim() : '题材未定',
  ].join(' · ')

  const handleCreate = () => {
    if (!trimmedName) return
    onCreate({
      name: trimmedName,
      genre: genre.trim(),
      cover,
      starter,
      tooling,
      customPluginIds,
    })
  }

  const toggleCustomPlugin = (id: string) => {
    setTooling('custom')
    setCustomPluginIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]))
  }

  return (
    <div className="mb-8 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] p-5 shadow-[var(--ink-shadow)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[13px] font-semibold text-[var(--ink-text)]">新建小说项目</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] p-1 transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex gap-5 flex-col sm:flex-row">
        {/* 封面：选了就会存进项目记录，卡片与字数浮窗都读它 */}
        <div className="shrink-0">
          <Tooltip content="上传封面（可选，2MB 以内）">
            <div
              onClick={() => coverInputRef.current?.click()}
              className="group relative w-[88px] h-[123px] rounded-lg border border-dashed border-[var(--ink-border-strong)] hover:border-[var(--ink-accent)]/50 bg-[var(--ink-bg-panel)] overflow-hidden transition-colors flex items-center justify-center cursor-pointer select-none"
            >
              {cover ? (
                <>
                  <img src={cover} alt="封面预览" className="w-full h-full object-cover" />
                  <Tooltip content="移除封面">
                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        setCover('')
                      }}
                      className="absolute top-1 right-1 p-0.5 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={11} />
                    </span>
                  </Tooltip>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-[var(--ink-text-muted)] group-hover:text-[var(--ink-accent)] transition-colors">
                  <ImageIcon size={20} />
                  <span className="text-[10px]">上传封面</span>
                </div>
              )}
            </div>
          </Tooltip>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            data-testid="creation-cover-input"
            className="hidden"
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const f = e.target.files?.[0]
              if (f) readCoverImage(f).then((url) => url && setCover(url))
              e.target.value = ''
            }}
          />
        </div>

        <div className="flex-1 flex flex-col gap-3">
          <div>
            <label className={labelClass} htmlFor="new-project-name">
              书名 *
            </label>
            <input
              id="new-project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="给这本书起个名字，其他信息之后随时可以补"
              autoFocus
              className="w-full text-[13px] px-3 py-2 rounded-lg bg-[var(--ink-bg-panel)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none focus:border-[var(--ink-accent)]"
            />
          </div>

          {/* 未展开时也把生效的默认值念出来，不让用户猜自己创建了什么（INV-09） */}
          <button
            type="button"
            data-testid="creation-advanced-toggle"
            onClick={() => setAdvanced((v) => !v)}
            className="flex items-center gap-1.5 text-left text-[11.5px] text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] transition-colors cursor-pointer"
          >
            {advanced ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            更多设置
            <span className="text-[var(--ink-text-faint)]">· 当前 {summary}</span>
          </button>

          {advanced && (
            <div className="flex flex-col gap-3 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-panel)]/40 p-3">
              <div>
                <span className={labelClass}>从哪里开始</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStarter('blank')}
                    className={optionClass(starter === 'blank')}
                  >
                    <div className="text-[12.5px] font-medium">空白作品</div>
                    <div className="text-[10px] text-[var(--ink-text-muted)] mt-0.5">
                      单卷单空白章，一条设定都不替你编
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStarter('demo')}
                    className={optionClass(starter === 'demo')}
                  >
                    <div className="text-[12.5px] font-medium">示范样例（苍澜纪元）</div>
                    <div className="text-[10px] text-[var(--ink-text-muted)] mt-0.5">
                      注入两卷三章修仙样例与成套设定
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className={labelClass} htmlFor="new-project-genre">
                  题材
                </label>
                <input
                  id="new-project-genre"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  placeholder="留空则记为未分类，之后在卡片菜单里改"
                  className="w-full text-[12.5px] px-3 py-1.5 rounded-lg bg-[var(--ink-bg-panel)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none focus:border-[var(--ink-accent)]"
                />
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {PROJECT_GENRES.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGenre(g)}
                      className={`px-2 py-0.5 rounded-md text-[11px] border transition-colors cursor-pointer ${
                        genre === g
                          ? 'border-[var(--ink-accent)]/50 text-[var(--ink-accent)] bg-[var(--ink-accent-soft)]'
                          : 'border-[var(--ink-border)] text-[var(--ink-text-muted)] hover:border-[var(--ink-border-strong)]'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className={labelClass}>工具组合</span>
                <div className="flex gap-2">
                  {(
                    [
                      ['lite', LEAN_PLUGIN_IDS.length, '只有设定卡片与基础质检'],
                      ['recommended', RECOMMENDED_PLUGIN_IDS.length, '每类挑门槛最低的，适合连载'],
                      ['custom', customPluginIds.length, '逐件勾'],
                    ] as [ToolingCombo, number, string][]
                  ).map(([combo, count, blurb]) => (
                    <button
                      key={combo}
                      type="button"
                      data-testid={`tooling-${combo}`}
                      onClick={() => setTooling(combo)}
                      className={optionClass(tooling === combo)}
                    >
                      <div className="text-[12.5px] font-medium">
                        {combo === 'lite' ? '精简' : combo === 'recommended' ? '推荐' : '自定义'}
                      </div>
                      <div className="text-[10px] text-[var(--ink-text-muted)] mt-0.5">
                        {count} 件 · {blurb}
                      </div>
                    </button>
                  ))}
                </div>

                {tooling === 'custom' && (
                  <div
                    data-testid="tooling-catalog"
                    className="mt-2 max-h-[190px] overflow-y-auto rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] p-2 grid grid-cols-1 sm:grid-cols-2 gap-x-3"
                  >
                    {PLUGIN_CATEGORIES.filter((c) => c.id !== 'all').map((category) => {
                      const inCategory = ALL_AVAILABLE_PLUGINS.filter(
                        (plugin) => plugin.category === category.id,
                      )
                      if (!inCategory.length) return null
                      return (
                        <div key={category.id} className="mb-1.5">
                          <div className="text-[10px] text-[var(--ink-text-faint)] mt-1 mb-0.5">
                            {category.label}
                          </div>
                          {inCategory.map((plugin) => (
                            <label
                              key={plugin.id}
                              title={plugin.description}
                              className="flex items-center gap-1.5 text-[11.5px] text-[var(--ink-text)] py-0.5 cursor-pointer select-none"
                            >
                              <input
                                type="checkbox"
                                checked={customPluginIds.includes(plugin.id)}
                                onChange={() => toggleCustomPlugin(plugin.id)}
                              />
                              {plugin.name}
                            </label>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleCreate}
            disabled={!trimmedName}
            className="w-full h-9 rounded-lg bg-[var(--ink-accent)] text-white font-semibold text-[13px] hover:bg-[var(--ink-accent-hover)] disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            {trimmedName ? '创建并进入项目' : '先写下书名'}
          </button>
        </div>
      </div>
    </div>
  )
}
