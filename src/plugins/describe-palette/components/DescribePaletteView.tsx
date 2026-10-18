import { useMemo, useState, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import type { SenseType, GenreType, SensorySnippet } from '../types'
import { describePaletteEngine } from '../engine/DescribePaletteEngine'
import { clipboardWriter } from '../../../adapters/clipboardWriter'
import { Select } from '../../../ui/primitives'
const SENSES: Record<SenseType, string> = {
  sight: '视觉',
  sound: '听觉',
  scent: '嗅觉',
  taste: '味觉',
  touch: '触觉',
  metaphor: '意象',
}
const GENRES: Record<GenreType, string> = {
  all: '全题材',
  xianxia: '东方幻想',
  fantasy: '奇幻',
  scifi: '科幻',
  urban: '日常',
  wuxia: '武侠',
  horror: '悬疑惊悚',
  history: '历史',
}
export const DescribePaletteView: FC<DesktopPluginViewProps> = (props) => (
  <DescribeWorkspace key={props.projectId} />
)
function DescribeWorkspace() {
  const [sense, setSense] = useState<SenseType | 'all'>('all')
  const [genre, setGenre] = useState<GenreType>('all')
  const [query, setQuery] = useState('')
  const [text, setText] = useState('')
  const [sample, setSample] = useState<{ scope: string; snippets: SensorySnippet[] } | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const scope = JSON.stringify([sense, genre, query])
  const found = useMemo(
    () =>
      describePaletteEngine.searchSnippets(query, {
        genre,
        sense: sense === 'all' ? undefined : sense,
        limit: 60,
      }),
    [query, genre, sense],
  )
  const snippets = sample?.scope === scope ? sample.snippets : found
  const report = useMemo(() => describePaletteEngine.diagnoseText(text), [text])
  return (
    <div className="p-6 space-y-4 h-full overflow-y-auto">
      <h2>描写素材与感官词项</h2>
      <p>
        按作者选择的对象词项、题材与类别检索素材。示例需适配场景、叙述视角和作者风格，不能直接证明描写质量。
      </p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <input
        aria-label="描写素材检索"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setMessage('')
        }}
        placeholder="对象或环境关键词；多个词用空格分隔"
        className="w-full border rounded p-2"
      />
      <Select
        aria-label="素材题材"
        value={genre}
        onValueChange={(value) => setGenre(value as GenreType)}
      >
        {Object.entries(GENRES).map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </Select>
      <Select
        aria-label="素材感官类别"
        value={sense}
        onValueChange={(value) => setSense(value as SenseType | 'all')}
      >
        <option value="all">全部类别</option>
        {Object.entries(SENSES).map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </Select>
      <button
        onClick={() => {
          setError('')
          setMessage('')
          try {
            setSample({
              scope,
              snippets: describePaletteEngine.inspireRandom(
                genre,
                sense === 'all' ? undefined : sense,
                3,
                undefined,
                query,
              ),
            })
          } catch (cause) {
            setError(String(cause))
          }
        }}
      >
        按筛选抽取素材
      </button>
      <button onClick={() => setSample(null)}>显示检索结果</button>
      <p>当前显示 {snippets.length} 条素材。</p>
      {!snippets.length && <p>没有符合全部检索词和筛选条件的素材。</p>}
      {snippets.map((snippet) => (
        <article key={snippet.id} className="border rounded p-3 space-y-2">
          <p>
            {SENSES[snippet.primarySense]} · {snippet.category}
          </p>
          <p>{snippet.text}</p>
          {snippet.exampleContext && <p>示例语境：{snippet.exampleContext}</p>}
          <button
            onClick={async () => {
              setError('')
              setMessage('')
              try {
                await clipboardWriter.writeText(snippet.text)
                setMessage('已复制素材，请按作品语境改写。')
              } catch (cause) {
                setError(String(cause))
              }
            }}
          >
            复制此句
          </button>
        </article>
      ))}
      <h3>正文词项定位</h3>
      <textarea
        aria-label="待定位描写正文"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="粘贴实际正文；未命中不等于缺少感官描写"
        className="w-full border rounded p-3"
        rows={4}
      />
      <p>
        {report.totalWordCount} 个非空白 Unicode 字符。{report.advice}
      </p>
      <table className="text-xs">
        <thead>
          <tr>
            <th>词表类别</th>
            <th>定位次数</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(SENSES).map(([id, label]) => (
            <tr key={id}>
              <td>{label}</td>
              <td>{report.radar[id as SenseType]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {report.matches.map((match) => (
        <p key={match.sense + ':' + match.start}>
          {SENSES[match.sense]}词项 [{match.start}, {match.end})「{match.quote}」
        </p>
      ))}
    </div>
  )
}
