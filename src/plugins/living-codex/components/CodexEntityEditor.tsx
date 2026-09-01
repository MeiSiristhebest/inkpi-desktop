import { useState, useEffect, type FC } from 'react'
import type { CodexEntity, CodexCategory, EntityRelation } from '../types'
import { Save, Trash2, X, Plus } from 'lucide-react'

interface CodexEntityEditorProps {
  entity: Partial<CodexEntity> | null
  allEntities: CodexEntity[]
  onSave: (entity: CodexEntity) => Promise<void>
  onDelete?: (entityId: string) => Promise<void>
  onClose: () => void
}

const CATEGORIES: { id: CodexCategory; label: string }[] = [
  { id: 'character', label: '角色人物' },
  { id: 'faction', label: '国家宗门' },
  { id: 'location', label: '地理风物' },
  { id: 'item', label: '物品法宝' },
  { id: 'race', label: '种族生物' },
  { id: 'history', label: '历史事件' },
  { id: 'term', label: '名词术语' },
]

export const CodexEntityEditor: FC<CodexEntityEditorProps> = ({
  entity,
  allEntities,
  onSave,
  onDelete,
  onClose,
}) => {
  const [name, setName] = useState('')
  const [aliasesStr, setAliasesStr] = useState('')
  const [category, setCategory] = useState<CodexCategory>('character')
  const [parentId, setParentId] = useState('')
  const [summary, setSummary] = useState('')
  const [detailMarkdown, setDetailMarkdown] = useState('')
  const [relations, setRelations] = useState<EntityRelation[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // 关系编辑行状态
  const [newRelTarget, setNewRelTarget] = useState('')
  const [newRelType, setNewRelType] = useState('盟友')

  useEffect(() => {
    if (entity) {
      setName(entity.name || '')
      setAliasesStr((entity.aliases || []).join(', '))
      setCategory(entity.category || 'character')
      setParentId(entity.parentId || '')
      setSummary(entity.summary || '')
      setDetailMarkdown(entity.detailMarkdown || '')
      setRelations(entity.relations || [])
    }
  }, [entity])

  const handleAddRelation = () => {
    if (!newRelTarget) return
    const targetObj = allEntities.find((e) => e.name === newRelTarget || e.id === newRelTarget)
    const targetName = targetObj ? targetObj.name : newRelTarget
    const targetId = targetObj ? targetObj.id : newRelTarget

    setRelations((prev) => [
      ...prev,
      { targetId, targetName, relationType: newRelType },
    ])
    setNewRelTarget('')
  }

  const handleRemoveRelation = (index: number) => {
    setRelations((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!name.trim()) return
    setIsSaving(true)

    const aliases = aliasesStr
      .split(/[,，、/|;\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    const updated: CodexEntity = {
      id: entity?.id || `ent-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      projectId: entity?.projectId || 'inkpi-default',
      name: name.trim(),
      aliases,
      category,
      parentId: parentId || undefined,
      attributes: entity?.attributes || {},
      relations,
      summary: summary.trim() || `${name} (${category})`,
      detailMarkdown,
      createdAt: entity?.createdAt || Date.now(),
      updatedAt: Date.now(),
    }

    await onSave(updated)
    setIsSaving(false)
  }

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg)] text-[var(--ink-text)] overflow-hidden border-l border-[var(--ink-border)]">
      {/* 顶栏 */}
      <div className="h-11 shrink-0 flex items-center justify-between px-4 border-b border-[var(--ink-border)] bg-[var(--ink-bg-sidebar)]">
        <span className="text-[13px] font-medium">
          {entity?.id ? '编辑实体档案' : '新建实体'}
        </span>
        <div className="flex items-center gap-1.5">
          {entity?.id && onDelete && (
            <button
              onClick={() => onDelete(entity.id!)}
              className="p-1 rounded text-red-500 hover:bg-red-500/10"
              title="删除实体"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={isSaving || !name.trim()}
            className="flex items-center gap-1 px-3 py-1 bg-[var(--ink-accent)] text-white rounded text-[12px] font-medium disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? '保存中...' : '保存'}
          </button>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--ink-bg-hover)] text-[var(--ink-text-muted)]">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 表单内容区 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-[13px]">
        {/* 名称与别名 */}
        <div className="space-y-1">
          <label className="text-[12px] font-medium text-[var(--ink-text-muted)]">实体主名称 *</label>
          <input
            className="w-full px-3 py-1.5 bg-[var(--ink-bg-sidebar)] border border-[var(--ink-border)] rounded text-[13px] focus:outline-none focus:ring-1 focus:ring-[var(--ink-accent)]"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="如：陈渊、青岚宗、青铜小塔..."
          />
        </div>

        <div className="space-y-1">
          <label className="text-[12px] font-medium text-[var(--ink-text-muted)]">
            别名 / 绰号 / 简称 (用于 AC 自动机多模式扫描)
          </label>
          <input
            className="w-full px-3 py-1.5 bg-[var(--ink-bg-sidebar)] border border-[var(--ink-border)] rounded text-[13px] focus:outline-none focus:ring-1 focus:ring-[var(--ink-accent)]"
            value={aliasesStr}
            onChange={(e) => setAliasesStr(e.target.value)}
            placeholder="多个别名用逗号或顿号隔开，如：渊哥, 废脉少主, 混沌体"
          />
        </div>

        {/* 类别 */}
        <div className="space-y-1">
          <label className="text-[12px] font-medium text-[var(--ink-text-muted)]">分类类别</label>
          <div className="grid grid-cols-4 gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`py-1 text-[11px] rounded border transition-colors ${
                  category === c.id
                    ? 'bg-[var(--ink-accent)] text-white border-[var(--ink-accent)]'
                    : 'bg-[var(--ink-bg-sidebar)] border-[var(--ink-border)] text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* 高密度 AI 摘要 */}
        <div className="space-y-1">
          <label className="text-[12px] font-medium text-[var(--ink-text-muted)]">
            AI 高密度切片摘要 (50字以内，供上下文精准注入)
          </label>
          <textarea
            rows={2}
            className="w-full p-2 bg-[var(--ink-bg-sidebar)] border border-[var(--ink-border)] rounded text-[12px] focus:outline-none focus:ring-1 focus:ring-[var(--ink-accent)]"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="如：青岚宗杂役弟子，淬体九重，觉醒吞噬神体，受萧景行打压..."
          />
        </div>

        {/* 关联图谱关系 */}
        <div className="space-y-2 pt-2 border-t border-[var(--ink-border)]">
          <label className="text-[12px] font-medium text-[var(--ink-text-muted)]">关联实体与关系</label>
          <div className="space-y-1.5">
            {relations.map((rel, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded bg-[var(--ink-bg-card)] border border-[var(--ink-border)] text-[12px]"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--ink-accent)]">{rel.relationType}</span>
                  <span>→</span>
                  <span>{rel.targetName}</span>
                </div>
                <button
                  onClick={() => handleRemoveRelation(idx)}
                  className="text-[var(--ink-text-faint)] hover:text-red-500"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* 添加新关系 */}
          <div className="flex gap-1.5 pt-1">
            <select
              value={newRelType}
              onChange={(e) => setNewRelType(e.target.value)}
              className="px-2 py-1 bg-[var(--ink-bg-sidebar)] border border-[var(--ink-border)] rounded text-[12px]"
            >
              <option value="宿敌">宿敌</option>
              <option value="盟友">盟友</option>
              <option value="师徒">师徒</option>
              <option value="所属势力">所属势力</option>
              <option value="持有者">持有者</option>
              <option value="位于">位于</option>
            </select>
            <input
              value={newRelTarget}
              onChange={(e) => setNewRelTarget(e.target.value)}
              placeholder="目标实体名..."
              className="flex-1 px-2 py-1 bg-[var(--ink-bg-sidebar)] border border-[var(--ink-border)] rounded text-[12px]"
            />
            <button
              onClick={handleAddRelation}
              className="px-2.5 py-1 bg-[var(--ink-bg-hover)] border border-[var(--ink-border)] rounded text-[12px] hover:bg-[var(--ink-border)] flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> 添加
            </button>
          </div>
        </div>

        {/* 详细设定 Markdown */}
        <div className="space-y-1 pt-2 border-t border-[var(--ink-border)]">
          <label className="text-[12px] font-medium text-[var(--ink-text-muted)]">完整设定详情 (Markdown)</label>
          <textarea
            rows={6}
            className="w-full p-2 font-mono bg-[var(--ink-bg-sidebar)] border border-[var(--ink-border)] rounded text-[12px] focus:outline-none focus:ring-1 focus:ring-[var(--ink-accent)]"
            value={detailMarkdown}
            onChange={(e) => setDetailMarkdown(e.target.value)}
            placeholder="记录背景渊源、功法细节、名场面预留等完整设定..."
          />
        </div>
      </div>
    </div>
  )
}
