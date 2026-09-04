import { useState, useEffect, useRef, type ChangeEvent } from 'react'
import { BookPlus, FileDown, Sparkles } from 'lucide-react'
import type { ProjectRecord } from '../../types'
import { loadStatsForProjects, type ProjectStats } from '../../core/projectService'
import { CreateProjectPanel } from './organisms/CreateProjectPanel'
import { ProjectCard } from './organisms/ProjectCard'
import { ProjectDeleteDialog } from './organisms/ProjectDeleteDialog'
import type { ProjectEditFormValues } from './organisms/ProjectEditForm'

interface BookshelfProps {
  projects: ProjectRecord[]
  onOpenProject: (id: string) => void
  onCreateProject: (name: string, genre: string, intro: string) => void
  onImportProject?: (file: File) => void
  /** 一键创建自带种子内容的示范项目，便于首次体验 */
  onCreateDemo?: () => void
  /** 导出项目完整备份 */
  onExportProject?: (id: string) => void
  /** 编辑项目信息（name/genre/intro/cover） */
  onUpdateProject?: (project: ProjectRecord) => void
  /** 删除项目 */
  onDeleteProject?: (id: string) => void
}

/**
 * 书架主页（被动视图容器）。
 * 自身只持有 UI 编排状态（新建面板 / 编辑中 id / 待删除项 / 菜单开关 / 统计缓存），
 * 具体的卡片、内联编辑表单、新建面板、删除确认均委托给 organisms（原子设计分层，§2.2）。
 */
export const Bookshelf = ({
  projects,
  onOpenProject,
  onCreateProject,
  onImportProject,
  onExportProject,
  onUpdateProject,
  onDeleteProject,
}: BookshelfProps) => {
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingProject, setDeletingProject] = useState<ProjectRecord | null>(null)
  const [stats, setStats] = useState<Record<string, ProjectStats>>({})
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)

  const importInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const map = await loadStatsForProjects(projects)
      if (alive) setStats(map)
    })()
    return () => {
      alive = false
    }
  }, [projects])

  // 点击空白处关闭气泡菜单（与卡片内 stopPropagation 配合，仅外部点击触发）
  useEffect(() => {
    const handleDocClick = () => setActiveMenuId(null)
    window.addEventListener('click', handleDocClick)
    return () => window.removeEventListener('click', handleDocClick)
  }, [])

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && onImportProject) onImportProject(file)
    e.target.value = ''
  }

  const handleSaveEdit = (form: ProjectEditFormValues) => {
    if (!editingId || !form.name.trim() || !onUpdateProject) return
    const original = projects.find((p) => p.id === editingId)
    if (!original) return
    onUpdateProject({
      ...original,
      name: form.name.trim(),
      genre: form.genre.trim() || undefined,
      intro: form.intro.trim() || undefined,
      cover: form.cover,
    })
    setEditingId(null)
  }

  return (
    <div className="min-h-screen bg-[var(--ink-bg)] text-[var(--ink-text)] overflow-y-auto relative font-sans selection:bg-[var(--ink-accent)]/20">
      <div className="relative z-10 w-full max-w-[1280px] mx-auto px-6 lg:px-10 py-12">
        <header className="mb-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--ink-accent)]/10 text-[var(--ink-accent)] mb-3 shadow-xs">
            <span className="text-xl font-bold font-serif">墨</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--ink-text)] tracking-tight flex items-baseline justify-center gap-2">
            InkPi
            <span className="text-xs font-normal text-[var(--ink-text-muted)] border border-[var(--ink-border)] px-1.5 py-0.5 rounded-full">v0.1.0</span>
          </h1>
          <p className="mt-2 text-[13px] text-[var(--ink-text-muted)] tracking-wide">AI 驱动的现代小说创作工作台</p>
        </header>

        <div className="flex items-center justify-between mb-6 flex-wrap gap-4 border-b border-[var(--ink-border)] pb-4">
          <h2 className="text-[14px] font-semibold text-[var(--ink-text)] flex items-center gap-2 flex-wrap">
            <Sparkles size={15} className="text-[var(--ink-accent)]" /> 我的作品 ({projects.length})
            <span className="text-[12px] font-normal text-[var(--ink-text-muted)]">
              每本书是一个独立项目 · 打开后进入完整创作面板
            </span>
          </h2>

          <div className="flex gap-2 items-stretch shrink-0">
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 h-8 rounded-lg text-[12.5px] font-medium bg-[var(--ink-bg-elevated)] text-[var(--ink-text)] border border-[var(--ink-border)] hover:bg-[var(--ink-bg-hover)] transition-colors shadow-2xs cursor-pointer"
            >
              <FileDown size={13} /> 导入项目
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImport}
            />

            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 px-3.5 h-8 rounded-lg text-[12.5px] font-medium bg-[var(--ink-accent)] text-white hover:bg-[var(--ink-accent-hover)] font-semibold transition-colors shadow-xs cursor-pointer"
            >
              <BookPlus size={14} /> 新建小说项目
            </button>
          </div>
        </div>

        {creating && (
          <CreateProjectPanel onClose={() => setCreating(false)} onCreate={onCreateProject} />
        )}

        {projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--ink-border-strong)] bg-[var(--ink-bg-panel)]/60 py-16 text-center shadow-xs">
            <BookPlus size={28} className="mx-auto text-[var(--ink-text-faint)] mb-3" />
            <div className="text-[13px] text-[var(--ink-text)] font-medium">还没有作品，点击右上角「新建小说项目」开启第一本书</div>
            <div className="mt-1.5 text-[11.5px] text-[var(--ink-text-muted)]">开启属于你的沉浸式创作旅程</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                stats={stats[p.id]}
                isEditing={editingId === p.id}
                isMenuOpen={activeMenuId === p.id}
                isCustom={(p as { projectType?: string }).projectType === 'custom'}
                onOpen={() => onOpenProject(p.id)}
                onToggleMenu={() => setActiveMenuId(activeMenuId === p.id ? null : p.id)}
                onCloseMenu={() => setActiveMenuId(null)}
                onStartEdit={() => setEditingId(p.id)}
                onExport={() => onExportProject?.(p.id)}
                onDelete={() => setDeletingProject(p)}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={() => setEditingId(null)}
              />
            ))}
          </div>
        )}
      </div>

      <ProjectDeleteDialog
        project={deletingProject}
        onCancel={() => setDeletingProject(null)}
        onConfirm={() => {
          if (deletingProject) onDeleteProject?.(deletingProject.id)
          setDeletingProject(null)
        }}
      />
    </div>
  )
}
