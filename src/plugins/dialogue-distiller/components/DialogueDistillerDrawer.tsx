import { useMemo, useState, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { dialogueDistillerEngine } from '../engine/DialogueDistillerEngine'
export const DialogueDistillerDrawer: FC<DesktopPluginDrawerProps> = (props) => (
  <DialogueDrawerBody key={props.projectId} {...props} />
)
function DialogueDrawerBody({ currentText, projectId }: DesktopPluginDrawerProps) {
  const [input, setInput] = useState('')
  const [namesInput, setNamesInput] = useState('')
  const text = input || currentText || ''
  const names = useMemo(
    () => [...new Set(namesInput.split(/[,，、\s]+/).filter(Boolean))],
    [namesInput],
  )
  const evidence = useMemo(
    () => dialogueDistillerEngine.extractQuoteEvidence(text, names),
    [text, names],
  )
  return (
    <div className="p-4 space-y-3 text-xs">
      <h3>角色对白样本</h3>
      <p>明确引语归属的定位结果，人物口吻仍需语境复核。</p>
      <input
        aria-label="目标角色列表"
        value={namesInput}
        onChange={(e) => setNamesInput(e.target.value)}
        placeholder="输入作品中的角色名，以逗号分隔"
      />
      <textarea
        aria-label="手动对白正文"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="粘贴正文或使用当前编辑器正文"
      />
      {!evidence.length ? (
        <p>没有可归属的对白；补充实际角色名和明确的引语。</p>
      ) : (
        names.map((name) => {
          const found = evidence.filter((e) => e.characterName === name)
          const stats = dialogueDistillerEngine.computeVoiceprint(
            name,
            found.map((e) => e.quote),
            projectId,
          )
          return (
            <section key={name}>
              <h4>
                {name} · {found.length} 段
              </h4>
              {found.length > 0 ? (
                <p>
                  平均句长 {stats.averageSentenceLength.toFixed(2)}；问号句段{' '}
                  {(stats.questionRatio * 100).toFixed(1)}%；感叹号句段{' '}
                  {(stats.exclamationRatio * 100).toFixed(1)}%。
                </p>
              ) : (
                <p>样本缺失。</p>
              )}
              {found.map((e) => (
                <p key={e.start}>
                  [{e.start}, {e.end})「{e.quote}」
                </p>
              ))}
            </section>
          )
        })
      )}
    </div>
  )
}
