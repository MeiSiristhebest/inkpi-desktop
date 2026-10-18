import type { FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { RhythmRadarEngine } from '../engine/RhythmRadarEngine'
export const RhythmRadarDrawer: FC<DesktopPluginDrawerProps> = ({ currentText }) => {
  const report = RhythmRadarEngine.analyzeChapter(currentText || '', 'preview', 0)
  return (
    <div className="p-4 space-y-3 text-xs">
      <h3>断章位置雷达</h3>
      <p>实际句段边界，不代表读者反馈。</p>
      {report.inputStatus === 'empty' ? (
        <p>没有正文，无法定位断章。</p>
      ) : !report.cuts.length ? (
        <p>没有完整的句段边界；引语尚未闭合时不建议切口。</p>
      ) : (
        report.cuts.map((c) => (
          <article key={c.end}>
            <p>{c.quote}</p>
            <p>
              位置 {c.end}；保留后续 {c.afterCharacters} 字符。
            </p>
          </article>
        ))
      )}
    </div>
  )
}
