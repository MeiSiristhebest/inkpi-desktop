import { useState, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { readerHookEngine } from '../engine/ReaderHookEngine'
import { clipboardWriter } from '../../../adapters/clipboardWriter'
import { EndingEvidence } from '../../../components/plugins/EndingEvidence'
export const ReaderHookDrawer: FC<DesktopPluginDrawerProps> = (props) => (
  <ReaderHookDrawerBody key={props.projectId} {...props} />
)
function ReaderHookDrawerBody({ currentText }: DesktopPluginDrawerProps) {
  const [input, setInput] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  return (
    <div className="p-4 space-y-3 text-xs">
      <h3>章尾断章哨兵</h3>
      <textarea
        aria-label="手动章尾正文"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="快速粘贴正文末尾段落；留空使用当前正文"
        className="w-full border rounded p-2"
      />
      <EndingEvidence report={readerHookEngine.analyzeEnding(input || currentText || '')} />
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <h4>断章范式灵感</h4>
      {readerHookEngine.getTemplates().map((t) => (
        <article key={t.id}>
          <p>
            {t.name}：{t.example}
          </p>
          <button
            onClick={async () => {
              setError('')
              setMessage('')
              try {
                await clipboardWriter.writeText(t.example)
                setMessage('已复制例句。')
              } catch (cause) {
                setError(String(cause))
              }
            }}
          >
            复制例句
          </button>
        </article>
      ))}
    </div>
  )
}
