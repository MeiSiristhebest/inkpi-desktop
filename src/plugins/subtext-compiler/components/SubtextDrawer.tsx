import { useMemo, useState, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { SubtextCompilerEngine } from '../engine/SubtextCompilerEngine'
import { Select } from '../../../ui/primitives'
export const SubtextDrawer: FC<DesktopPluginDrawerProps> = (props) => (
  <SubtextDrawerBody key={props.projectId} {...props} />
)
function SubtextDrawerBody({ currentText }: DesktopPluginDrawerProps) {
  const quotes = useMemo(
    () =>
      [...currentText.matchAll(/“([^”]+)”|「([^」]+)」/g)].map((m) => ({
        id: String(m.index),
        quote: m[1] ?? m[2],
        start: m.index! + 1,
      })),
    [currentText],
  )
  const [choice, setChoice] = useState('')
  const [speaker, setSpeaker] = useState('')
  const [goal, setGoal] = useState('')
  const [meaning, setMeaning] = useState('')
  const selected = quotes.find((q) => q.id === choice)
  const compiled =
    selected && speaker.trim()
      ? SubtextCompilerEngine.compile(selected.quote, speaker, undefined, {
          goal,
          intendedMeaning: meaning,
        })
      : null
  return (
    <div className="p-4 space-y-3 text-xs">
      <h3>对白潜台词草稿</h3>
      <p>只列实际引语；说话人和隐藏含义由作者填写。</p>
      {!quotes.length ? (
        <p>当前正文没有完整引语，未生成台词或潜台词。</p>
      ) : (
        <>
          <Select
            aria-label="选择原文对白"
            value={choice}
            onValueChange={(value) => {
              setChoice(value)
              setSpeaker('')
              setGoal('')
              setMeaning('')
            }}
          >
            <option value="">选择实际对白</option>
            {quotes.map((q) => (
              <option key={q.id} value={q.id}>
                [{q.start}] {q.quote}
              </option>
            ))}
          </Select>
          <input
            aria-label="说话人"
            value={speaker}
            onChange={(e) => setSpeaker(e.target.value)}
            placeholder="作者确认的说话人"
          />
          <input aria-label="说话目标" value={goal} onChange={(e) => setGoal(e.target.value)} />
          <textarea
            aria-label="作者隐藏含义"
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
          />
          {compiled && (
            <p>
              作者草稿：「{compiled.spoken}」；潜台词：{compiled.subtext || '未知'}
            </p>
          )}
        </>
      )}
    </div>
  )
}
