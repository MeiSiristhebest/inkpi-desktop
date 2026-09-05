import { useState, useEffect, useRef, type FC } from 'react'
import type { CodexEntity } from '../types'
import { CodexGraphStore } from '../engine/GraphStore'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'
import { pluginEventBus } from '../../../core/pluginEventBus'
import {
  User,
  Shield,
  MapPin,
  Sparkles,
  BookOpen,
  Layers,
  Info,
  X,
} from 'lucide-react'
import { Drawer } from '../../../ui/molecules/Drawer'

interface CodexWriterDrawerProps {
  projectId: string
  currentText: string
  onOpenDetail?: (entityId: string) => void
}

const CATEGORY_ICONS: Record<string, any> = {
  character: User,
  faction: Shield,
  location: MapPin,
  item: Sparkles,
  default: BookOpen,
}

export const CodexWriterDrawer: FC<CodexWriterDrawerProps> = ({
  projectId,
  currentText,
  onOpenDetail,
}) => {
  const [activeEntities, setActiveEntities] = useState<CodexEntity[]>([])
  const [xmlSnippet, setXmlSnippet] = useState<string>('')
  const [previewEntity, setPreviewEntity] = useState<CodexEntity | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const graphStore = useRef<CodexGraphStore>(new CodexGraphStore())

  // 初始化加载数据库中的全部实体
  useEffect(() => {
    loadGraphData()
  }, [projectId])

  const loadGraphData = async () => {
    try {
      const all = await indexedDbCodexEntityRepository.getAll()
      const projEntities = all.filter((e) => e.projectId === projectId)
      graphStore.current.updateDataset(projEntities)
      // 立即执行一次扫描
      runScan(currentText)
    } catch (err) {
      // 读取失败不应让随动抽屉变白：记录错误并退化为「待命」空态
      console.error('[InkPi] 世界观随动抽屉数据加载失败:', err)
      setLoadError(err instanceof Error ? err.message : String(err))
      setActiveEntities([])
    }
  }

  const runScan = (text: string) => {
    const { matchedEntities, xmlContext } = graphStore.current.resolveContextSlice(text, 800)
    setActiveEntities(matchedEntities)
    setXmlSnippet(xmlContext)

    // 向系统 EventBus 广播被正文触碰到的实体 (CODEX_ENTITY_TOUCHED)
    matchedEntities.forEach((ent) => {
      try {
        pluginEventBus.emit('CODEX_ENTITY_TOUCHED', {
          projectId,
          entityId: ent.id,
          entityName: ent.name,
          category: ent.category,
        })
      } catch (err) {
        console.warn('[CodexWriterDrawer] Failed to emit CODEX_ENTITY_TOUCHED:', err)
      }
    })
  }

  // 150ms 输入防抖扫描
  useEffect(() => {
    const timer = setTimeout(() => {
      runScan(currentText)
    }, 150)

    return () => clearTimeout(timer)
  }, [currentText])

  if (activeEntities.length === 0) {
    return (
      <Drawer widthClass="w-72">
        <div className="p-4 text-center text-xs text-[var(--ink-text-faint)] space-y-2">
          <Layers className="w-7 h-7 mx-auto opacity-30 text-[var(--ink-accent)]" />
          {loadError ? (
            <p className="font-medium text-red-400 leading-relaxed px-1">{loadError}</p>
          ) : (
            <>
              <p className="font-medium text-[var(--ink-text-muted)]">活体世界观待命</p>
              <p className="text-[11px] leading-relaxed">
                正文中出现的人物、法宝、宗门将通过 AC 自动机毫秒级在此高亮呈现
              </p>
            </>
          )}
        </div>
      </Drawer>
    )
  }

  return (
    <Drawer widthClass="w-72">
      <div className="h-full flex flex-col overflow-hidden text-[12px]">
        {/* 头部状态 */}
        <div className="px-3 py-2 border-b border-[var(--ink-border)] bg-[var(--ink-bg-sidebar)]/60 flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-medium text-[var(--ink-accent)]">
            <Layers className="w-3.5 h-3.5" />
            <span>段落激活实体 ({activeEntities.length})</span>
          </div>
          <span className="text-[10px] text-[var(--ink-text-faint)]">AC 自动机索引</span>
        </div>

        {/* 实体卡片列表 */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {activeEntities.map((ent) => {
            const Icon = CATEGORY_ICONS[ent.category] || CATEGORY_ICONS.default
            return (
              <div
                key={ent.id}
                onClick={() => {
                  setPreviewEntity(ent)
                  if (onOpenDetail) onOpenDetail(ent.id)
                }}
                className="p-2.5 rounded-lg bg-[var(--ink-bg-card)] border border-[var(--ink-border)] hover:border-[var(--ink-accent)] cursor-pointer transition-all shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-[12px] text-[var(--ink-text)]">
                    <Icon className="w-3.5 h-3.5 text-[var(--ink-accent)]" />
                    <span>{ent.name}</span>
                    {ent.aliases && ent.aliases.length > 0 && (
                      <span className="text-[10px] font-normal text-[var(--ink-text-faint)] truncate max-w-[80px]">
                        ({ent.aliases[0]})
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] px-1 py-0.5 rounded bg-[var(--ink-bg-hover)] text-[var(--ink-text-muted)]">
                    {ent.category}
                  </span>
                </div>

                <p className="text-[11px] text-[var(--ink-text-muted)] mt-1 line-clamp-2 leading-relaxed">
                  {ent.summary || '暂无描述'}
                </p>

                {ent.relations && ent.relations.length > 0 && (
                  <div className="mt-1.5 pt-1.5 border-t border-[var(--ink-border)]/60 flex flex-wrap gap-1">
                    {ent.relations.slice(0, 2).map((r, i) => (
                      <span
                        key={i}
                        className="text-[9px] px-1 py-0.5 rounded bg-[var(--ink-accent)]/10 text-[var(--ink-accent)] border border-[var(--ink-accent)]/20"
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

        {/* 底部 AI XML 切片预览折叠 */}
        {xmlSnippet && (
          <div className="p-2 border-t border-[var(--ink-border)] bg-[var(--ink-bg-sidebar)]/30 text-[10px] text-[var(--ink-text-faint)]">
            <div className="flex items-center gap-1 font-medium mb-1">
              <Info className="w-3 h-3 text-[var(--ink-accent)]" />
              <span>AI 上下文切片已就绪 ({xmlSnippet.length} 字符)</span>
            </div>
          </div>
        )}

        {/* 实体轻量速查悬浮窗 */}
        {previewEntity && (
          <div className="p-3 border-t border-[var(--ink-border)] bg-[var(--ink-bg-card)] text-[11px] space-y-1.5 shadow-lg">
            <div className="flex items-center justify-between font-semibold">
              <span className="text-[var(--ink-accent)]">{previewEntity.name} 详情</span>
              <button
                onClick={() => setPreviewEntity(null)}
                className="text-[var(--ink-text-faint)] hover:text-[var(--ink-text)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[var(--ink-text-muted)] leading-relaxed">
              {previewEntity.detailMarkdown || previewEntity.summary || '暂无更多详情'}
            </p>
          </div>
        )}
      </div>
    </Drawer>
  )
}
