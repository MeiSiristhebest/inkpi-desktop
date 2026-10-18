import type { GoldChaptersEvaluation } from '../types'
import { OPENING_DIMENSIONS } from '../engine/GoldChaptersEngine'

export function GoldChaptersEvidence({ snapshot }: { snapshot: GoldChaptersEvaluation }) {
  return (
    <section aria-label="开篇文本线索" className="space-y-2 text-xs">
      <p>
        {snapshot.status === 'empty'
          ? '没有正文，无法分析。'
          : snapshot.status === 'no-matches'
            ? '未命中内置词表，无法据此判断开篇质量。'
            : '以下仅列出每类首个词项的位置，是否构成动机、冲突或悬念需结合上下文判断。'}
      </p>
      {snapshot.status !== 'empty' && (
        <p>
          检查范围：{snapshot.scannedCharacters} / {snapshot.sourceLength} 个字符
          {snapshot.complete
            ? '，覆盖所提交文本。'
            : '，仅开头 3000 和末尾 500 个字符，中间未检查。'}
        </p>
      )}
      {snapshot.observations.map((observation) => (
        <div key={observation.dimension} className="p-2 rounded border border-slate-400/30">
          <span>
            {OPENING_DIMENSIONS[observation.dimension]} · [{observation.start}, {observation.end})
          </span>
          <blockquote className="mt-1 font-serif">「{observation.quote}」</blockquote>
        </div>
      ))}
      <p>词项命中不能证明情节发生；未命中也不能证明情节缺失。不生成质量分或达标结论。</p>
    </section>
  )
}
