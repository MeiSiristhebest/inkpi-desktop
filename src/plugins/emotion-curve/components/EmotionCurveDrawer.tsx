import { useEffect, useState, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { EmotionCurveEngine } from '../engine/EmotionCurveEngine'
import { pluginEventBus } from '../../../core/pluginEventBus'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
export const EmotionCurveDrawer: FC<DesktopPluginDrawerProps> = (props) => (
  <EmotionDrawerBody key={props.projectId} {...props} />
)
function EmotionDrawerBody({
  projectId,
  currentText,
  currentChapterNumber,
}: DesktopPluginDrawerProps) {
  const host = useOptionalPluginHostContext()
  const [input, setInput] = useState('')
  const [notice, setNotice] = useState<{ chapterId: string; count: number } | null>(null)
  useEffect(
    () =>
      pluginEventBus.on('CHAPTER_CONTENT_AUDITED', (payload) => {
        if (payload.projectId === projectId && payload.chapterId === host?.activeChapter?.id)
          setNotice({ chapterId: payload.chapterId, count: payload.wordCount })
      }),
    [projectId, host?.activeChapter?.id],
  )
  const text = input || currentText || ''
  const report = EmotionCurveEngine.evaluateChapter({
    chapterId: host?.activeChapter?.id ?? 'preview',
    chapterTitle: '当前正文',
    chapterOrder: currentChapterNumber ?? null,
    content: text,
  })
  return (
    <div className="p-4 space-y-3 text-xs">
      <h3>情绪词项复核</h3>
      <p>词项仅用于定位；读者情绪与作者意图不能由词频推断。</p>
      {notice && notice.chapterId === host?.activeChapter?.id && !input && (
        <p>同章审计记录：{notice.count} 字符；该计数不代表当前版本的情绪。</p>
      )}
      <textarea
        aria-label="手动情绪正文"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="留空使用当前正文"
      />
      <p>{report.wordCount} 个非空白 Unicode 字符。</p>
      {report.matches.length ? (
        report.matches.map((m) => (
          <p key={m.type + ':' + m.start}>
            [{m.start}, {m.end})「{m.quote}」
          </p>
        ))
      ) : (
        <p>没有词表命中，情绪未知。</p>
      )}
    </div>
  )
}
