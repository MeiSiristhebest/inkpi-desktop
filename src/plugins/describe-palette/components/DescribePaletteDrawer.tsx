import { useMemo, useState, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { describePaletteEngine } from '../engine/DescribePaletteEngine'
import { clipboardWriter } from '../../../adapters/clipboardWriter'
export const DescribePaletteDrawer: FC<DesktopPluginDrawerProps> = (props) => (
  <DescribeDrawerBody key={props.projectId} {...props} />
)
function DescribeDrawerBody({ currentText }: DesktopPluginDrawerProps) {
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const report = useMemo(() => describePaletteEngine.diagnoseText(currentText || ''), [currentText])
  const snippets = useMemo(() => describePaletteEngine.searchSnippets(query, { limit: 5 }), [query])
  return (
    <aside data-testid="describe-palette-drawer" className="p-4 space-y-3 text-xs">
      <h3>描写素材与原文定位</h3>
      <p>{report.advice}</p>
      {report.matches.map((m) => (
        <p key={m.sense + ':' + m.start}>
          [{m.start}, {m.end})「{m.quote}」
        </p>
      ))}
      <input
        aria-label="素材关键词"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜索实际对象或环境词项"
      />
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {!snippets.length && <p>没有匹配的素材。</p>}
      {snippets.map((s) => (
        <article key={s.id}>
          <p>{s.text}</p>
          <button
            onClick={async () => {
              setError('')
              setMessage('')
              try {
                await clipboardWriter.writeText(s.text)
                setMessage('已复制素材。')
              } catch (cause) {
                setError(String(cause))
              }
            }}
          >
            复制此句
          </button>
        </article>
      ))}
    </aside>
  )
}
