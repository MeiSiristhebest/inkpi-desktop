import type { FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { StoryboardEngine } from '../engine/StoryboardEngine'
export const StoryboardDrawer: FC<DesktopPluginDrawerProps> = ({ projectId, currentText }) => {
  const host = useOptionalPluginHostContext()
  const chapter = host?.projectId === projectId ? host.activeChapter : null
  const extracted = StoryboardEngine.extractStoryboard(
    chapter?.id ?? 'manual',
    chapter?.title ?? '',
    currentText,
  )
  return (
    <div className="p-3 space-y-3 text-xs">
      <h3>名场面四格分镜</h3>
      <p>{extracted.frames.length} 个原文镜头素材</p>
      <p>按正文顺序提供素材；构图属于可选设计，图片尚未生成。</p>
      {!extracted.frames.length && <p>当前正文为空。</p>}
      {extracted.frames.map((frame) => (
        <article key={frame.id}>
          <p>
            {frame.shotLabel} · 位置 {frame.sourceStart}–{frame.sourceEnd}
          </p>
          <blockquote>{frame.sourceQuote}</blockquote>
        </article>
      ))}
    </div>
  )
}
