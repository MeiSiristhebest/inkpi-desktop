import type { FC } from 'react'
import type { ReferenceMaterialOmissionReason } from '../../domain/references/referenceMaterials'
import type { DesktopPreparedContextCoverage } from '../../types/aiContextCoverage'

export interface DesktopPreparedContextSummaryProps {
  coverage: DesktopPreparedContextCoverage
  testId: string
}

/** Discloses the Desktop task object only, never claiming it mirrors the final provider request. */
export const DesktopPreparedContextSummary: FC<DesktopPreparedContextSummaryProps> = ({
  coverage,
  testId,
}) => {
  const selectionLabel = coverage.selectionText.explicitSelection
    ? '用户选区文本'
    : '编译器 selectionText（无显式选区）'
  const storyStateLabel = coverage.storyState.attached
    ? `原始 StoryState ${coverage.storyState.recordCount} 条`
    : '未附带原始 StoryState'
  const referenceMaterials = coverage.referenceMaterials

  return (
    <div
      data-testid={testId}
      className="rounded border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] p-2 space-y-0.5 font-sans"
    >
      <div className="font-semibold text-[var(--ink-text)]">
        Desktop 预备上下文（不是最终 Runtime/Provider 请求）
      </div>
      <div>
        正文片段：{coverage.documentText.includedCharacters}/
        {coverage.documentText.sourceCharacters} 个 UTF-16 字符， 偏移 [
        {coverage.documentText.rangeStart}, {coverage.documentText.rangeEnd})
      </div>
      <div>
        {selectionLabel}：{coverage.selectionText.includedCharacters}/
        {coverage.selectionText.sourceCharacters} 个 UTF-16 字符，偏移 [
        {coverage.selectionText.rangeStart}, {coverage.selectionText.rangeEnd})
      </div>
      <div>
        语义块：{coverage.semanticBlocks.count} 个 / {coverage.semanticBlocks.characters} 个 UTF-16
        字符； 邻近章节：{coverage.neighboringDocuments.count} 个 /{' '}
        {coverage.neighboringDocuments.characters} 个 UTF-16 字符
      </div>
      <div>
        {storyStateLabel}；编译 StoryContext {coverage.storyContext.recordCount} 条（正典{' '}
        {coverage.storyContext.canonicalFactCount}，假设 {coverage.storyContext.hypothesisCount}）；
        JIT 实体 {coverage.jit.entityCount} 个、伏笔 {coverage.jit.promiseCount} 个
      </div>
      {referenceMaterials && (
        <div>
          参考资料：{referenceMaterials.includedCount}/{referenceMaterials.sourceCount} 份带入，
          {referenceMaterials.includedCharacters} 个 UTF-16 字符
          {referenceMaterials.omittedCount > 0 && (
            <ul className="mt-1 list-disc pl-4">
              {referenceMaterials.sources.flatMap((source) =>
                source.omissionReason
                  ? [
                      <li key={source.sourceId}>
                        {source.title}：{formatOmissionReason(source.omissionReason)}
                      </li>,
                    ]
                  : [],
              )}
            </ul>
          )}
        </div>
      )}
      <div className="text-[var(--ink-text-faint)]">
        仅表示 Desktop 编译的任务字段覆盖；最终请求由 Runtime 与 Provider 在执行阶段组装。
      </div>
    </div>
  )
}

const OMISSION_REASON_LABELS: Record<ReferenceMaterialOmissionReason, string> = {
  'not-selected': '未选择',
  'no-matching-passages': '没有命中段落',
  'context-budget': '受上下文预算限制',
}

function formatOmissionReason(reason: ReferenceMaterialOmissionReason): string {
  return OMISSION_REASON_LABELS[reason]
}
