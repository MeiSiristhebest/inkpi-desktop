import type { FC } from 'react'
import { ArrowRight, Compass, FileEdit, Smile } from 'lucide-react'
import type { PluginDashboardExtensionProps } from '../../../types/plugin'
import { ChapterOverviewBoard } from './ChapterOverviewBoard'
import { ProjectStartGuide } from './ProjectStartGuide'

export const ProjectCompassDashboardExtension: FC<PluginDashboardExtensionProps> = ({
  projectId,
  project,
  volumes,
  chapters,
  loading,
  resumeChapter,
  unresolvedForeshadowsCount,
  unusedIdeasCount,
  onOpenView,
  onOpenChapter,
}) => (
  <div className="space-y-7">
    <ProjectStartGuide
      projectId={projectId}
      project={project ?? undefined}
      volumes={volumes}
      chapters={chapters}
      onOpenView={onOpenView}
    />

    <section
      aria-labelledby="dashboard-next-actions-title"
      data-testid="dashboard-next-actions"
      className="space-y-3 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2
            id="dashboard-next-actions-title"
            className="text-[14px] font-semibold text-[var(--ink-text)]"
          >
            下一步
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--ink-text-faint)]">
            从上次进度或待处理内容继续
          </p>
        </div>
        <span className="text-[11px] text-[var(--ink-text-faint)]">本作品</span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {resumeChapter && (
          <button
            type="button"
            aria-label={`继续上次写作《${resumeChapter.title}》`}
            onClick={() => onOpenChapter(resumeChapter.id)}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] p-3 text-left transition-colors hover:border-[var(--ink-accent)]"
          >
            <FileEdit className="h-4 w-4 shrink-0 text-[var(--ink-accent)]" />
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-medium text-[var(--ink-text)]">
                继续上次写作
              </span>
              <span className="block truncate text-[11px] text-[var(--ink-text-muted)]">
                {resumeChapter.title}
              </span>
            </span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--ink-text-faint)]" />
          </button>
        )}
        {unresolvedForeshadowsCount > 0 && (
          <button
            type="button"
            aria-label={`查看 ${unresolvedForeshadowsCount} 条未回收伏笔`}
            onClick={() => onOpenView('foreshadow')}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] p-3 text-left transition-colors hover:border-[var(--ink-accent)]"
          >
            <Compass className="h-4 w-4 shrink-0 text-[var(--ink-accent)]" />
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-medium text-[var(--ink-text)]">
                检查未回收伏笔
              </span>
              <span className="block text-[11px] text-[var(--ink-text-muted)]">
                {unresolvedForeshadowsCount} 条待处理
              </span>
            </span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--ink-text-faint)]" />
          </button>
        )}
        {unusedIdeasCount > 0 && (
          <button
            type="button"
            aria-label={`查看 ${unusedIdeasCount} 条未用灵感`}
            onClick={() => onOpenView('ideas')}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] p-3 text-left transition-colors hover:border-[var(--ink-accent)]"
          >
            <Smile className="h-4 w-4 shrink-0 text-[var(--ink-accent)]" />
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-medium text-[var(--ink-text)]">
                挑选未用灵感
              </span>
              <span className="block text-[11px] text-[var(--ink-text-muted)]">
                {unusedIdeasCount} 条可回看
              </span>
            </span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--ink-text-faint)]" />
          </button>
        )}
        {loading && (
          <p className="py-2 text-[12px] text-[var(--ink-text-faint)]">正在读取本作品进度…</p>
        )}
        {!loading &&
          !resumeChapter &&
          unresolvedForeshadowsCount === 0 &&
          unusedIdeasCount === 0 && (
            <p className="py-2 text-[12px] text-[var(--ink-text-faint)]">
              暂无待处理事项，可从快捷入口开始。
            </p>
          )}
      </div>
    </section>

    <ChapterOverviewBoard
      projectId={projectId}
      volumes={volumes}
      chapters={chapters}
      loading={loading}
      onOpenChapter={onOpenChapter}
    />
  </div>
)
