import { useState, useEffect, useMemo, type FC } from 'react'
import type { CodexEntity, CodexCategory } from '../types'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'
import { blobFileDownloader } from '../../../adapters/blobFileDownloader'
import { confirmDialog } from '../../../adapters/confirmDialog'
import { clock } from '../../../adapters/clock'
import { CodexEntityEditor } from './CodexEntityEditor'
import { TemplatePickerModal } from './TemplatePickerModal'
import { WORLDVIEW_DEMO_PACKS, type WorldviewDemoPack } from '../content/worldviewDemos'
import {
  Search,
  Plus,
  User,
  Shield,
  MapPin,
  Sparkles,
  BookOpen,
  Calendar,
  Layers,
  Database,
  Download,
  Trash2,
  Check,
  Flame,
} from 'lucide-react'

interface CodexMasterViewProps {
  projectId: string
}

const CATEGORY_TABS: {
  id: 'all' | CodexCategory
  label: string
  icon: any
  badgeClass: string
}[] = [
  { id: 'all', label: '全部实体', icon: Layers, badgeClass: 'bg-[var(--ink-bg-hover)] text-[var(--ink-text)]' },
  // 类别区分依靠图标 + 文案；配色统一使用全局唯一强调色令牌（不引入第二彩色，评审 §1.5）。
  { id: 'character', label: '角色人物', icon: User, badgeClass: 'bg-[var(--ink-accent)]/10 text-[var(--ink-accent)] border border-[var(--ink-accent)]/20' },
  { id: 'faction', label: '国家宗门', icon: Shield, badgeClass: 'bg-[var(--ink-accent)]/10 text-[var(--ink-accent)] border border-[var(--ink-accent)]/20' },
  { id: 'location', label: '地理风物', icon: MapPin, badgeClass: 'bg-[var(--ink-accent)]/10 text-[var(--ink-accent)] border border-[var(--ink-accent)]/20' },
  { id: 'item', label: '物品法宝', icon: Sparkles, badgeClass: 'bg-[var(--ink-accent)]/10 text-[var(--ink-accent)] border border-[var(--ink-accent)]/20' },
  { id: 'race', label: '种族生物', icon: BookOpen, badgeClass: 'bg-[var(--ink-accent)]/10 text-[var(--ink-accent)] border border-[var(--ink-accent)]/20' },
  { id: 'history', label: '历史事件', icon: Calendar, badgeClass: 'bg-[var(--ink-accent)]/10 text-[var(--ink-accent)] border border-[var(--ink-accent)]/20' },
  { id: 'term', label: '名词术语', icon: Database, badgeClass: 'bg-[var(--ink-accent)]/10 text-[var(--ink-accent)] border border-[var(--ink-accent)]/20' },
]

export const CodexMasterView: FC<CodexMasterViewProps> = ({ projectId }) => {
  const [entities, setEntities] = useState<CodexEntity[]>([])
  const [activeCategory, setActiveCategory] = useState<'all' | CodexCategory>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEntity, setSelectedEntity] = useState<CodexEntity | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 2500)
  }

  useEffect(() => {
    loadEntities()
  }, [projectId])

  const loadEntities = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const all = await indexedDbCodexEntityRepository.getAll()
      const projEntities = all.filter((e) => e.projectId === projectId)
      setEntities(projEntities)
    } catch (err) {
      // 兜底：IndexedDB 读取失败不应导致整页白屏，而是展示可读错误与重试
      console.error('[InkPi] 世界观实体数据加载失败:', err)
      setLoadError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleSaveEntity = async (entity: CodexEntity) => {
    await indexedDbCodexEntityRepository.save(entity)
    await loadEntities()
    setSelectedEntity(entity)
    setIsCreating(false)
    showToast('实体已成功保存')
  }

  const handleDeleteEntity = async (entityId: string) => {
    await indexedDbCodexEntityRepository.delete(entityId)
    await loadEntities()
    setSelectedEntity(null)
    setIsCreating(false)
    showToast('实体已删除')
  }

  // 一键预载世界观 Demo 包
  const handleLoadDemoPack = async (pack: WorldviewDemoPack) => {
    const demoEntities = pack.entities(projectId)
    for (const ent of demoEntities) {
      await indexedDbCodexEntityRepository.save(ent)
    }
    await loadEntities()
    showToast(`已成功预载【${pack.title}】(${demoEntities.length}个实体)`)
  }

  // 清空当前工程的世界观实体
  const handleClearAll = async () => {
    if (!(await confirmDialog.confirm('确定要清空当前工程的所有世界观实体吗？此操作不可逆。'))) return
    for (const ent of entities) {
      await indexedDbCodexEntityRepository.delete(ent.id)
    }
    await loadEntities()
    setSelectedEntity(null)
    setIsCreating(false)
    showToast('世界观实体已清空')
  }

  // 导出世界观图谱为 JSON（副作用委托给 FileDownloader 端口）
  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(entities, null, 2)], { type: 'application/json' })
    blobFileDownloader.downloadBlob(`inkpi-codex-${projectId}-${clock.now()}.json`, blob)
    showToast('世界观图谱已导出')
  }

  // 过滤实体列表
  const filteredEntities = useMemo(() => {
    return entities.filter((e) => {
      const matchCat = activeCategory === 'all' || e.category === activeCategory
      const q = searchQuery.toLowerCase().trim()
      const matchSearch =
        !q ||
        e.name.toLowerCase().includes(q) ||
        (e.aliases || []).some((a) => a.toLowerCase().includes(q)) ||
        (e.summary || '').toLowerCase().includes(q)
      return matchCat && matchSearch
    })
  }, [entities, activeCategory, searchQuery])

  // 统计所有别名及索引模式总数
  const totalKeywords = useMemo(() => {
    return entities.reduce((acc, e) => acc + 1 + (e.aliases?.length || 0), 0)
  }, [entities])

  const getCategoryMeta = (cat: CodexCategory) => {
    return CATEGORY_TABS.find((t) => t.id === cat) || CATEGORY_TABS[0]
  }

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg)] text-[var(--ink-text)] overflow-hidden">
      {/* 顶栏操作区 */}
      <div className="h-12 shrink-0 flex items-center justify-between gap-3 px-4 border-b border-[var(--ink-border)] bg-[var(--ink-bg-sidebar)]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 font-semibold text-[13px]">
            <div className="w-6 h-6 rounded-md bg-[var(--ink-accent)]/10 text-[var(--ink-accent)] flex items-center justify-center">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <span>活体世界观实体图谱</span>
          </div>
          <span className="text-[11px] text-[var(--ink-text-faint)] hidden sm:inline">
            已载入 {entities.length} 个实体 · {totalKeywords} 个 AC 自动机词条
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* 搜索框 */}
          <div className="relative w-44 md:w-52">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[var(--ink-text-muted)]" />
            <input
              type="text"
              placeholder="搜名称/别名/摘要..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1 text-[12px] bg-[var(--ink-bg)] border border-[var(--ink-border)] rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--ink-accent)]"
            />
          </div>

          {/* 模版库按钮 */}
          <button
            onClick={() => setIsTemplateModalOpen(true)}
            className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-md text-[12px] font-medium border border-[var(--ink-border)] bg-[var(--ink-bg-card)] hover:bg-[var(--ink-bg-hover)] text-[var(--ink-text)]"
            title="浏览 36+ 种男女核心人设与世界观模版"
          >
            <Sparkles className="w-3.5 h-3.5 text-[var(--ink-accent)]" />
            <span>模版库</span>
          </button>

          {/* 导出/备份 */}
          {entities.length > 0 && (
            <button
              onClick={handleExportJSON}
              className="p-1.5 rounded-md border border-[var(--ink-border)] bg-[var(--ink-bg-card)] text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)]"
              title="导出图谱 JSON 备份"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}

          {/* 清空图谱 */}
          {entities.length > 0 && (
            <button
              onClick={handleClearAll}
              className="p-1.5 rounded-md border border-[var(--ink-border)] bg-[var(--ink-bg-card)] text-red-500 hover:bg-red-500/10"
              title="清空当前工程的世界观实体"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* 新建实体主按钮 */}
          <button
            onClick={() => {
              setSelectedEntity(null)
              setIsCreating(true)
            }}
            className="flex items-center gap-1 px-3 py-1 bg-[var(--ink-accent)] text-white rounded-md text-[12px] font-medium shadow-xs hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            新建实体
          </button>
        </div>
      </div>

      {/* 主体分栏 */}
      <div className="flex-1 flex min-h-0">
        {/* 左侧分类与卡片列表 */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* 分类标签栏 */}
          <div className="flex items-center gap-1.5 px-4 py-2 border-b border-[var(--ink-border)] bg-[var(--ink-bg-sidebar)]/50 overflow-x-auto text-[12px]">
            {CATEGORY_TABS.map((tab) => {
              const Icon = tab.icon
              const count =
                tab.id === 'all'
                  ? entities.length
                  : entities.filter((e) => e.category === tab.id).length
              const active = activeCategory === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
                    active
                      ? 'bg-[var(--ink-bg-active)] font-medium text-[var(--ink-text)] shadow-xs'
                      : 'text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  <span className="text-[10px] opacity-70">({count})</span>
                </button>
              )
            })}
          </div>

          {/* 实体卡片网格与空状态 */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="h-full flex items-center justify-center text-xs text-[var(--ink-text-faint)]">
                正在加载世界观数据...
              </div>
            ) : loadError ? (
              /* 数据加载失败：可读错误 + 重试，而非白屏 */
              <div className="h-full flex flex-col items-center justify-center gap-3 text-[var(--ink-text-muted)]">
                <Database className="w-8 h-8 opacity-40 text-red-400" />
                <span className="text-[13px] font-medium text-[var(--ink-text)]">世界观数据加载失败</span>
                <span className="text-[11px] text-[var(--ink-text-faint)] max-w-md text-center px-4 leading-relaxed">
                  {loadError}
                </span>
                <button
                  onClick={loadEntities}
                  className="mt-1 px-3 py-1.5 rounded-md bg-[var(--ink-accent)] text-white text-[12px] font-medium hover:opacity-90 transition-opacity"
                >
                  重试加载
                </button>
              </div>
            ) : entities.length === 0 ? (
              /* 极致美化的开箱引导空状态 */
              <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-[var(--ink-accent)]/10 text-[var(--ink-accent)] mx-auto flex items-center justify-center shadow-xs">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h3 className="text-[16px] font-bold text-[var(--ink-text)]">
                    开启你的活体世界观图谱
                  </h3>
                  <p className="text-[12px] text-[var(--ink-text-muted)] max-w-lg mx-auto leading-relaxed">
                    你可以一键预装经典题材世界观 Demo 体验 Aho-Corasick 毫秒级行文感知，也可以从 36+ 种核心人设模版自由创造。
                  </p>
                </div>

                {/* 3 大开箱即用 Demo 卡片 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  {WORLDVIEW_DEMO_PACKS.map((pack) => (
                    <div
                      key={pack.id}
                      className="p-4 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-card)] flex flex-col justify-between hover:border-[var(--ink-accent)] transition-all shadow-xs group"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-[var(--ink-accent)]/10 text-[var(--ink-accent)] border border-[var(--ink-accent)]/20">
                            {pack.badge}
                          </span>
                          <span className="text-[11px] text-[var(--ink-text-faint)]">
                            {pack.entitiesCount} 个实体
                          </span>
                        </div>
                        <h4 className="font-bold text-[14px] text-[var(--ink-text)] group-hover:text-[var(--ink-accent)] transition-colors">
                          {pack.title}
                        </h4>
                        <p className="text-[11px] text-[var(--ink-text-muted)] leading-relaxed">
                          {pack.description}
                        </p>
                      </div>

                      <button
                        onClick={() => handleLoadDemoPack(pack)}
                        className="mt-4 w-full py-1.5 rounded-lg bg-[var(--ink-bg-hover)] hover:bg-[var(--ink-accent)] hover:text-white text-[12px] font-medium transition-all flex items-center justify-center gap-1"
                      >
                        <Flame className="w-3.5 h-3.5 text-amber-500 group-hover:text-white" />
                        <span>一键预载此世界观</span>
                      </button>
                    </div>
                  ))}
                </div>

                {/* 快捷操作区 */}
                <div className="flex items-center justify-center gap-3 pt-4 border-t border-[var(--ink-border)]">
                  <button
                    onClick={() => setIsTemplateModalOpen(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--ink-bg-card)] border border-[var(--ink-border)] hover:border-[var(--ink-accent)] text-[12px] font-medium transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[var(--ink-accent)]" />
                    <span>从 36+ 种男女核心人设模版挑选</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedEntity(null)
                      setIsCreating(true)
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--ink-accent)] text-white text-[12px] font-medium shadow-xs hover:opacity-90 transition-opacity"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>新建空白实体档案</span>
                  </button>
                </div>
              </div>
            ) : filteredEntities.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-xs text-[var(--ink-text-faint)]">
                <Layers className="w-8 h-8 opacity-30" />
                <span>未找到符合条件的实体</span>
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-1 text-[var(--ink-accent)] hover:underline"
                >
                  清除搜索条件
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {filteredEntities.map((ent) => {
                  const isSelected = selectedEntity?.id === ent.id
                  const meta = getCategoryMeta(ent.category)
                  const CategoryIcon = meta.icon

                  return (
                    <div
                      key={ent.id}
                      onClick={() => {
                        setSelectedEntity(ent)
                        setIsCreating(false)
                      }}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[var(--ink-bg-active)] border-[var(--ink-accent)] ring-1 ring-[var(--ink-accent)]/30 shadow-sm'
                          : 'bg-[var(--ink-bg-card)] border-[var(--ink-border)] hover:border-[var(--ink-accent)]/50 hover:shadow-xs'
                      }`}
                    >
                      <div>
                        {/* 卡片顶栏 */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 font-bold text-[13px] text-[var(--ink-text)]">
                            <CategoryIcon className="w-4 h-4 text-[var(--ink-accent)]" />
                            <span>{ent.name}</span>
                            {ent.aliases && ent.aliases.length > 0 && (
                              <span className="text-[10px] font-normal text-[var(--ink-text-faint)] truncate max-w-[100px]">
                                ({ent.aliases.join(', ')})
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0 ${meta.badgeClass}`}
                          >
                            {meta.label}
                          </span>
                        </div>

                        {/* 高密度描述摘要 */}
                        <p className="text-[12px] text-[var(--ink-text-muted)] mt-2 line-clamp-2 leading-relaxed">
                          {ent.summary || '暂无高密度描述'}
                        </p>
                      </div>

                      {/* 关联网络药丸 */}
                      {ent.relations && ent.relations.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-[var(--ink-border)] flex flex-wrap gap-1">
                          {ent.relations.slice(0, 3).map((r, i) => (
                            <span
                              key={i}
                              className="text-[9px] px-2 py-0.5 rounded-md bg-[var(--ink-accent)]/10 text-[var(--ink-accent)] border border-[var(--ink-accent)]/20 font-medium"
                            >
                              {r.relationType}: {r.targetName}
                            </span>
                          ))}
                          {ent.relations.length > 3 && (
                            <span className="text-[9px] px-1 text-[var(--ink-text-faint)] self-center">
                              +{ent.relations.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* 右侧编辑抽屉 */}
        {(selectedEntity || isCreating) && (
          <div className="w-[380px] shrink-0 h-full">
            <CodexEntityEditor
              entity={selectedEntity}
              allEntities={entities}
              onSave={handleSaveEntity}
              onDelete={selectedEntity?.id ? handleDeleteEntity : undefined}
              onClose={() => {
                setSelectedEntity(null)
                setIsCreating(false)
              }}
            />
          </div>
        )}
      </div>

      {/* 模版库弹窗 */}
      <TemplatePickerModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        onSelect={(preset) => {
          setSelectedEntity(preset as CodexEntity)
          setIsCreating(true)
        }}
      />

      {/* 轻量 Toast 提示 */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-[var(--ink-bg-card)] border border-[var(--ink-border)] text-[var(--ink-text)] px-4 py-2 rounded-lg shadow-xl text-[12px] font-medium flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-emerald-500" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  )
}
