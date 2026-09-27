import { useState, useEffect, useRef, type ChangeEvent } from 'react'
import { motion } from 'motion/react'
import { BookPlus, FileDown, Sparkles, ArchiveRestore, Trash2 } from 'lucide-react'
import type { ProjectRecord } from '../../types'
import type { NewProjectForm } from '../../domain/project/projectDefaults'
import { loadStatsForProjects, type ProjectStats } from '../../core/projectService'
import { spring, gesture } from '../../motion'
import { CreateProjectPanel } from './organisms/CreateProjectPanel'
import { ProjectCard } from './organisms/ProjectCard'
import { ProjectDeleteDialog } from './organisms/ProjectDeleteDialog'
import { ProjectArchiveDialog } from './organisms/ProjectArchiveDialog'
import type { ProjectEditFormValues } from './organisms/ProjectEditForm'
import { Tooltip } from '../../ui/primitives'

interface BookshelfProps {
  projects: ProjectRecord[]
  /** 已移出作品库的项目：数据仍在本地，可随时放回（P0.8） */
  archivedProjects?: ProjectRecord[]
  onOpenProject: (id: string) => void
  onCreateProject: (form: NewProjectForm) => void
  onImportProject?: (file: File) => void
  /** 一键创建自带种子内容的示范项目，便于首次体验 */
  onCreateDemo?: () => void
  /** 导出项目完整备份（含设定/时间线/插件/AI 数据） */
  onExportProject?: (id: string) => void
  /** 导出纯正文，不含任何中间状态 */
  onExportManuscript?: (id: string) => void
  /** 编辑项目信息（name/genre/intro/cover） */
  onUpdateProject?: (project: ProjectRecord) => void
  /** 永久删除：级联清除全部工作区数据，不可撤销 */
  onDeleteProject?: (id: string) => void
  /** 移出作品库：只隐藏条目，数据保留 */
  onRemoveFromLibrary?: (id: string) => void
  /** 放回书架 */
  onRestoreToLibrary?: (id: string) => void
}

/**
 * 书架主页（被动视图容器）。
 * 自身只持有 UI 编排状态（新建面板 / 编辑中 id / 待删除项 / 待移出项 / 菜单开关 / 统计缓存），
 * 具体的卡片、内联编辑表单、新建面板、确认弹窗均委托给 organisms（原子设计分层，§2.2）。
 *
 * 「移出作品库」与「永久删除」在这里是两条独立入口：前者只隐藏、可恢复，
 * 后者不可撤销 —— 混用会让用户以为关掉书架条目就等于删除数据（INV-04 / P0.8）。
 */
export const Bookshelf = ({
  projects,
  archivedProjects = [],
  onOpenProject,
  onCreateProject,
  onImportProject,
  onExportProject,
  onExportManuscript,
  onUpdateProject,
  onDeleteProject,
  onRemoveFromLibrary,
  onRestoreToLibrary,
}: BookshelfProps) => {
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingProject, setDeletingProject] = useState<ProjectRecord | null>(null)
  const [archivingProject, setArchivingProject] = useState<ProjectRecord | null>(null)
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
            <span className="text-xs font-normal text-[var(--ink-text-muted)] border border-[var(--ink-border)] px-1.5 py-0.5 rounded-full">
              v0.1.0
            </span>
          </h1>
          <p className="mt-2 text-[13px] text-[var(--ink-text-muted)] tracking-wide">
            AI 驱动的现代小说创作工作台
          </p>
        </header>

        <div className="flex items-center justify-between mb-6 flex-wrap gap-4 border-b border-[var(--ink-border)] pb-4">
          <h2 className="text-[14px] font-semibold text-[var(--ink-text)] flex items-center gap-2 flex-wrap">
            <Sparkles size={15} className="text-[var(--ink-accent)]" /> 我的作品 ({projects.length})
            <span className="text-[12px] font-normal text-[var(--ink-text-muted)]">
              每本书是一个独立项目 · 打开后进入完整创作面板
            </span>
          </h2>

          <div className="flex gap-2 items-stretch shrink-0">
            <motion.button
              type="button"
              onClick={() => importInputRef.current?.click()}
              {...gesture.button}
              transition={spring.snappy}
              className="inline-flex items-center gap-1.5 px-3.5 h-8 rounded-lg text-[12.5px] font-medium bg-[var(--ink-bg-elevated)] text-[var(--ink-text)] border border-[var(--ink-border)] hover:bg-[var(--ink-bg-hover)] transition-colors shadow-2xs cursor-pointer select-none"
            >
              <FileDown size={13} /> 导入项目
            </motion.button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImport}
            />

            <motion.button
              type="button"
              onClick={() => setCreating(true)}
              {...gesture.button}
              transition={spring.snappy}
              className="inline-flex items-center gap-1.5 px-3.5 h-8 rounded-lg text-[12.5px] font-medium bg-[var(--ink-accent)] text-white hover:bg-[var(--ink-accent-hover)] font-semibold transition-colors shadow-xs cursor-pointer select-none"
            >
              <BookPlus size={14} /> 新建小说项目
            </motion.button>
          </div>
        </div>

        {creating && (
          <CreateProjectPanel onClose={() => setCreating(false)} onCreate={onCreateProject} />
        )}

        {projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--ink-border-strong)] bg-[var(--ink-bg-panel)]/60 py-16 text-center shadow-xs">
            <BookPlus size={28} className="mx-auto text-[var(--ink-text-faint)] mb-3" />
            <div className="text-[13px] text-[var(--ink-text)] font-medium">
              还没有作品，点击右上角「新建小说项目」开启第一本书
            </div>
            <div className="mt-1.5 text-[11.5px] text-[var(--ink-text-muted)]">
              开启属于你的沉浸式创作旅程
            </div>
          </div>
        ) : (
          <motion.div
            initial="initial"
            animate="animate"
            variants={{
              initial: {},
              animate: { transition: { staggerChildren: 0.05 } },
            }}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
          >
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
                onExportManuscript={() => onExportManuscript?.(p.id)}
                onRemoveFromLibrary={() => setArchivingProject(p)}
                onDelete={() => setDeletingProject(p)}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={() => setEditingId(null)}
              />
            ))}
          </motion.div>
        )}

        {archivedProjects.length > 0 && (
          <section
            className="mt-10 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)]/40 p-4"
            aria-label="已移出作品库"
          >
            <h3 className="text-[12.5px] font-semibold text-[var(--ink-text-muted)] mb-1">
              已移出作品库 ({archivedProjects.length})
            </h3>
            <p className="text-[11px] text-[var(--ink-text-faint)] mb-3">
              这些作品的数据仍完整保留在本地，放回即可继续写作。
            </p>
            <ul className="flex flex-col gap-1.5">
              {archivedProjects.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)]"
                >
                  <span className="text-[12.5px] text-[var(--ink-text)] truncate">
                    {p.name}
                    {p.genre ? (
                      <span className="text-[var(--ink-text-faint)]"> · {p.genre}</span>
                    ) : null}
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onRestoreToLibrary?.(p.id)}
                      className="inline-flex items-center gap-1 px-2 h-6.5 rounded-md text-[11.5px] border border-[var(--ink-border)] text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer"
                    >
                      <ArchiveRestore size={12} /> 放回书架
                    </button>
                    <Tooltip content="永久删除（不可撤销）">
                      <button
                        type="button"
                        onClick={() => setDeletingProject(p)}
                        aria-label={`永久删除 ${p.name}`}
                        className="inline-flex items-center justify-center w-6.5 h-6.5 rounded-md text-[var(--ink-text-muted)] hover:text-[var(--ink-danger)] hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </Tooltip>
                  </span>
                </li>
              ))}
            </ul>
          </section>
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

      <ProjectArchiveDialog
        project={archivingProject}
        onCancel={() => setArchivingProject(null)}
        onConfirm={() => {
          if (archivingProject) onRemoveFromLibrary?.(archivingProject.id)
          setArchivingProject(null)
        }}
      />
    </div>
  )
}
