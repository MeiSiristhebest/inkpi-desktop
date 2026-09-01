import { useState, useEffect, useMemo, type FC } from 'react'
import type { CodexEntity, CodexCategory } from '../types'
import { db } from '../../../db/indexedDB'
import { CodexEntityEditor } from './CodexEntityEditor'
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
} from 'lucide-react'

interface CodexMasterViewProps {
  projectId: string
}

const CATEGORY_TABS: { id: 'all' | CodexCategory; label: string; icon: any }[] = [
  { id: 'all', label: '全部实体', icon: Layers },
  { id: 'character', label: '角色人物', icon: User },
  { id: 'faction', label: '国家宗门', icon: Shield },
  { id: 'location', label: '地理风物', icon: MapPin },
  { id: 'item', label: '物品法宝', icon: Sparkles },
  { id: 'race', label: '种族生物', icon: BookOpen },
  { id: 'history', label: '历史事件', icon: Calendar },
  { id: 'term', label: '名词术语', icon: Database },
]

export const CodexMasterView: FC<CodexMasterViewProps> = ({ projectId }) => {
  const [entities, setEntities] = useState<CodexEntity[]>([])
  const [activeCategory, setActiveCategory] = useState<'all' | CodexCategory>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEntity, setSelectedEntity] = useState<CodexEntity | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadEntities()
  }, [projectId])

  const loadEntities = async () => {
    setLoading(true)
    const all = await db.getAll<CodexEntity>('codexEntities')
    const projEntities = all.filter((e) => !e.projectId || e.projectId === projectId)
    setEntities(projEntities)
    setLoading(false)
  }

  const handleSaveEntity = async (entity: CodexEntity) => {
    await db.put('codexEntities', entity)
    await loadEntities()
    setSelectedEntity(entity)
    setIsCreating(false)
  }

  const handleDeleteEntity = async (entityId: string) => {
    await db.delete('codexEntities', entityId)
    await loadEntities()
    setSelectedEntity(null)
    setIsCreating(false)
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

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg)] text-[var(--ink-text)] overflow-hidden">
      {/* 顶栏操作区 */}
      <div className="h-11 shrink-0 flex items-center justify-between gap-3 px-4 border-b border-[var(--ink-border)] bg-[var(--ink-bg-sidebar)]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5 font-semibold text-[13px]">
            <Layers className="w-4 h-4 text-[var(--ink-accent)]" />
            <span>活体世界观实体图谱</span>
          </div>
          <span className="text-[11px] text-[var(--ink-text-faint)]">
            已载入 {entities.length} 个实体 · {totalKeywords} 个 AC 自动机词条
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* 搜索框 */}
          <div className="relative w-48">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[var(--ink-text-muted)]" />
            <input
              type="text"
              placeholder="搜名称/别名/摘要..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1 text-[12px] bg-[var(--ink-bg)] border border-[var(--ink-border)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--ink-accent)]"
            />
          </div>

          <button
            onClick={() => {
              setSelectedEntity(null)
              setIsCreating(true)
            }}
            className="flex items-center gap-1 px-3 py-1 bg-[var(--ink-accent)] text-white rounded text-[12px] font-medium shadow-sm hover:opacity-90 transition-opacity"
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
          <div className="flex items-center gap-1 px-4 py-2 border-b border-[var(--ink-border)] bg-[var(--ink-bg-sidebar)]/50 overflow-x-auto text-[12px]">
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
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
                    active
                      ? 'bg-[var(--ink-bg-active)] font-medium text-[var(--ink-text)]'
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

          {/* 实体卡片网格 */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="h-full flex items-center justify-center text-xs text-[var(--ink-text-faint)]">
                正在加载世界观数据...
              </div>
            ) : filteredEntities.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-xs text-[var(--ink-text-faint)]">
                <Layers className="w-8 h-8 opacity-30" />
                <span>暂无符合条件的实体</span>
                <button
                  onClick={() => {
                    setSelectedEntity(null)
                    setIsCreating(true)
                  }}
                  className="mt-2 text-[var(--ink-accent)] hover:underline"
                >
                  点击新建第一个实体
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredEntities.map((ent) => {
                  const isSelected = selectedEntity?.id === ent.id
                  return (
                    <div
                      key={ent.id}
                      onClick={() => {
                        setSelectedEntity(ent)
                        setIsCreating(false)
                      }}
                      className={`p-3 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--ink-bg-active)] border-[var(--ink-accent)] shadow-sm'
                          : 'bg-[var(--ink-bg-card)] border-[var(--ink-border)] hover:border-[var(--ink-accent)]/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-semibold text-[13px]">
                          <span>{ent.name}</span>
                          {ent.aliases && ent.aliases.length > 0 && (
                            <span className="text-[10px] text-[var(--ink-text-faint)] truncate max-w-[120px]">
                              ({ent.aliases.join(', ')})
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--ink-bg-hover)] text-[var(--ink-text-muted)]">
                          {ent.category}
                        </span>
                      </div>

                      <p className="text-[12px] text-[var(--ink-text-muted)] mt-1.5 line-clamp-2 leading-relaxed">
                        {ent.summary || '暂无高密度描述'}
                      </p>

                      {ent.relations && ent.relations.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-[var(--ink-border)] flex flex-wrap gap-1">
                          {ent.relations.slice(0, 3).map((r, i) => (
                            <span
                              key={i}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--ink-accent)]/10 text-[var(--ink-accent)] border border-[var(--ink-accent)]/20"
                            >
                              {r.relationType}: {r.targetName}
                            </span>
                          ))}
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
          <div className="w-[360px] shrink-0 h-full">
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
    </div>
  )
}
