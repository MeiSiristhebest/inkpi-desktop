import { BookOpen, MoreVertical, Upload, FolderOpen } from 'lucide-react'
import type { ProjectRecord } from '../../../types'
import type { ProjectStats } from '../../../core/projectService'
import { ProjectContextMenu } from './ProjectContextMenu'
import { ProjectEditForm, type ProjectEditFormValues } from './ProjectEditForm'

interface ProjectCardProps {
  project: ProjectRecord
  stats?: ProjectStats
  isEditing: boolean
  isMenuOpen: boolean
  isCustom: boolean
  onOpen: () => void
  onToggleMenu: () => void
  onCloseMenu: () => void
  onStartEdit: () => void
  onExport: () => void
  onDelete: () => void
  onSaveEdit: (form: ProjectEditFormValues) => void
  onCancelEdit: () => void
}

/**
 * 书架中的单张作品卡片（原子设计 · organisms）。
 * 视图态（封面 / 标题 / 标签 / 统计 / 简介 / 操作栏）与内联编辑态由父级布尔 prop 切换；
 * 气泡菜单开关、编辑表单状态分别委托 ProjectContextMenu / ProjectEditForm，自身保持无状态展示。
 */
export const ProjectCard = ({
  project,
  stats,
  isEditing,
  isMenuOpen,
  isCustom,
  onOpen,
  onToggleMenu,
  onCloseMenu,
  onStartEdit,
  onExport,
  onDelete,
  onSaveEdit,
  onCancelEdit,
}: ProjectCardProps) => {
  if (isEditing) {
    return (
      <ProjectEditForm
        project={project}
        onCancel={onCancelEdit}
        onSave={onSaveEdit}
      />
    )
  }

  const vols = stats?.volumes ?? 0
  const chs = stats?.chapters ?? 0
  const wordsWan = ((stats?.words ?? 0) / 10000).toFixed(1)

  return (
    <div
      onClick={() => onOpen()}
      className="group relative bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] hover:border-[var(--ink-border-strong)] rounded-2xl p-5 transition-all shadow-[var(--ink-shadow-sm)] hover:shadow-[var(--ink-shadow)] cursor-pointer flex flex-col justify-between"
    >
      <div className="flex items-start gap-4">
        {/* 左侧封面：优雅的真实书本比例 (1:1.4) 质感与微阴影 */}
        {project.cover ? (
          <img
            src={project.cover}
            alt={project.name}
            className="w-[104px] h-[146px] object-cover rounded-xl border border-[var(--ink-border)] shrink-0 shadow-sm group-hover:shadow-md transition-shadow"
          />
        ) : (
          <div className="w-[104px] h-[146px] rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] shrink-0 flex flex-col items-center justify-center text-[var(--ink-text-faint)] group-hover:text-[var(--ink-accent)] transition-colors shadow-2xs">
            <BookOpen size={28} strokeWidth={1.5} />
            <span className="text-[10px] mt-2 tracking-wider font-sans opacity-70">暂无封面</span>
          </div>
        )}

        {/* 右侧作品详情区域 */}
        <div className="flex-1 min-w-0 flex flex-col pt-0.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[16px] font-semibold text-[var(--ink-text)] group-hover:text-[var(--ink-accent)] transition-colors truncate">
              {project.name}
            </h3>

            {/* 右上角操作气泡菜单 */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={onToggleMenu}
                title="更多操作"
                className="w-7 h-7 rounded-lg text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] flex items-center justify-center transition-colors cursor-pointer"
              >
                <MoreVertical size={15} />
              </button>

              {isMenuOpen && (
                <ProjectContextMenu
                  hasUpdate
                  hasExport
                  onClose={onCloseMenu}
                  onEdit={onStartEdit}
                  onExport={onExport}
                  onDelete={onDelete}
                />
              )}
            </div>
          </div>

          {/* 标签与写作统计指标 */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {project.genre && (
              <span className="px-2 py-0.5 text-[10.5px] rounded-md bg-[var(--ink-bg-panel)] text-[var(--ink-text-muted)] border border-[var(--ink-border)] font-medium">
                {project.genre}
              </span>
            )}
            {isCustom && (
              <span className="px-2 py-0.5 text-[10.5px] rounded-md bg-[var(--ink-accent)]/10 text-[var(--ink-accent)] border border-[var(--ink-accent)]/20 font-medium">
                自定义
              </span>
            )}
            <span className="text-[11.5px] text-[var(--ink-text-muted)]">
              {vols} 卷 · {chs} 章 · {wordsWan} 万字
            </span>
          </div>

          {/* 作品简介 */}
          {project.intro ? (
            <p className="mt-2.5 text-[12px] text-[var(--ink-text-muted)] line-clamp-2 leading-relaxed">
              {project.intro}
            </p>
          ) : (
            <p className="mt-2.5 text-[12px] text-[var(--ink-text-faint)] italic">暂未添加作品简介</p>
          )}
        </div>
      </div>

      {/* 卡片底栏：创建时间与直觉的“进入写作”主按钮 */}
      <div className="mt-4 pt-3 border-t border-[var(--ink-border)] flex items-center justify-between text-[11px] text-[var(--ink-text-faint)]">
        <span>
          {project.updatedAt || project.createdAt
            ? `更新于 ${new Date(project.updatedAt || project.createdAt!).toLocaleDateString()}`
            : '暂无更新记录'}
        </span>

        <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onExport}
            title="导出 JSON 备份"
            className="w-7 h-7 rounded-lg text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] border border-transparent hover:border-[var(--ink-border)] flex items-center justify-center transition-colors cursor-pointer"
          >
            <Upload size={13} />
          </button>
          <button
            type="button"
            onClick={onOpen}
            title="打开项目"
            className="inline-flex items-center gap-1.5 px-3 h-7.5 rounded-lg bg-[var(--ink-accent)] text-white text-[12px] font-medium hover:bg-[var(--ink-accent-hover)] transition-colors shadow-2xs cursor-pointer"
          >
            <FolderOpen size={13} /> 进入写作
          </button>
        </div>
      </div>
    </div>
  )
}
