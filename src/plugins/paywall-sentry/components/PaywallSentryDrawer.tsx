import { useState, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { PaywallSentryEngine } from '../engine/PaywallSentryEngine'
import { EndingEvidence } from '../../../components/plugins/EndingEvidence'
export const PaywallSentryDrawer: FC<DesktopPluginDrawerProps> = (props) => (
  <PaywallDrawerBody key={props.projectId} {...props} />
)
function PaywallDrawerBody({ currentText, currentChapterNumber }: DesktopPluginDrawerProps) {
  const [input, setInput] = useState('')
  const report = PaywallSentryEngine.analyzeChapter({
    chapterId: 'preview',
    chapterTitle: '当前正文',
    chapterOrder: currentChapterNumber ?? null,
    content: input || currentText || '',
  })
  return (
    <div className="p-4 space-y-3 text-xs">
      <h3>付费过渡章尾复核</h3>
      <p>当前正文用于章尾观察；付费与受众效果需要实测数据。</p>
      <textarea
        aria-label="手动过渡章正文"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="留空使用当前编辑器正文"
      />
      <EndingEvidence report={report.ending} />
    </div>
  )
}
