import type { FC } from 'react'
import { useProjectData } from '../../../core/projectDataContext'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { ChapterOverviewBoard } from './ChapterOverviewBoard'
import { ProjectStartGuide } from './ProjectStartGuide'

export const ProjectCompassMasterView: FC<DesktopPluginViewProps> = ({
  projectId,
  onOpenView,
  onOpenChapter,
}) => {
  const { project, volumes, chapters, isLoading } = useProjectData()

  return (
    <main className="h-full overflow-y-auto bg-[var(--ink-bg)] p-6 text-[var(--ink-text)]">
      <div className="mx-auto max-w-5xl space-y-5">
        <header>
          <h1 className="text-lg font-semibold">项目罗盘</h1>
          <p className="mt-1 text-xs text-[var(--ink-text-muted)]">
            基于当前作品的定位、设定、分卷和章节记录，整理下一步创作路径。
          </p>
        </header>
        <ProjectStartGuide
          projectId={projectId}
          project={project ?? undefined}
          volumes={volumes}
          chapters={chapters}
          onOpenView={onOpenView ?? (() => {})}
        />
        <ChapterOverviewBoard
          projectId={projectId}
          volumes={volumes}
          chapters={chapters}
          loading={isLoading}
          onOpenChapter={onOpenChapter ?? (() => {})}
        />
      </div>
    </main>
  )
}
