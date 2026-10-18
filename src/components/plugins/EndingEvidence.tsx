import type { EndingReview } from '../../domain/endingReview'
export function EndingEvidence({ report }: { report: EndingReview }) {
  return (
    <section className="space-y-2 text-xs border border-[var(--ink-border)] rounded-lg p-3">
      <p>
        {report.inputStatus === 'empty'
          ? '没有正文，无法审阅章尾。'
          : '词项定位；未解问题和读者反应需要语境复核。'}
      </p>
      <p>
        全文 {report.characters} 个非空白 Unicode 字符；章尾范围 [{report.coverage.start},{' '}
        {report.coverage.end}) / {report.coverage.total}（位置按 UTF-16）。
      </p>
      <blockquote className="whitespace-pre-wrap">{report.endingText}</blockquote>
      {report.observations.map((item) => (
        <p key={item.start + ':' + item.end}>
          {item.label} [{item.start}, {item.end})
        </p>
      ))}
      {report.inputStatus === 'provided' && !report.observations.length && (
        <p>词表未命中，不能据此判断章尾质量。</p>
      )}
    </section>
  )
}
