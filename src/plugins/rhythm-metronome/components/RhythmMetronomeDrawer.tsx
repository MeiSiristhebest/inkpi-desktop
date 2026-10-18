import type { FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { RhythmMetronomeEngine } from '../engine/RhythmMetronomeEngine'

export const RhythmMetronomeDrawer: FC<DesktopPluginDrawerProps> = ({ currentText }) => {
  const report = RhythmMetronomeEngine.analyzeText(currentText ?? '')
  return (
    <div className="p-4 space-y-3 text-xs text-[var(--ink-text)]">
      <h3 className="font-semibold text-sm">当前正文句长统计</h3>
      <p>
        {report.paragraphCount} 段，{report.sentenceCount} 个标点分句。
      </p>
      <p>
        平均句长 {report.averageSentenceCharacters?.toFixed(1) ?? '未知'}；最短{' '}
        {report.shortestSentence ?? '未知'}；最长 {report.longestSentence ?? '未知'}。
      </p>
      <p>
        逗号 {report.punctuation.comma}；句号 {report.punctuation.fullStop}；问号{' '}
        {report.punctuation.question}；感叹号 {report.punctuation.exclamation}。
      </p>
      <p className="text-[var(--ink-text-muted)]">
        分句按终止标点和换行划分，计数含标点。句长变化是文字特征，需要结合场景功能判断。
      </p>
      <details>
        <summary>原文句长与位置</summary>
        {report.sentences.map((sentence) => (
          <p key={sentence.start}>
            {sentence.characters} 字符 [{sentence.start}, {sentence.end})：{sentence.quote}
          </p>
        ))}
      </details>
    </div>
  )
}
