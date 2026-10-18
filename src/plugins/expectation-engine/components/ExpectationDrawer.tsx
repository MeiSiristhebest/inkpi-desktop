import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import type { ExpectationContract } from '../types'
import { expectationEngine } from '../engine/ExpectationEngine'
import { indexedDbExpectationRepository } from '../../../adapters/indexedDbExpectationRepository'

export const ExpectationDrawer: FC<DesktopPluginDrawerProps> = (props) => (
  <ProjectExpectationDrawer key={props.projectId} {...props} />
)
const ProjectExpectationDrawer: FC<DesktopPluginDrawerProps> = ({
  projectId,
  currentText,
  currentChapterNumber,
}) => {
  const [contracts, setContracts] = useState<ExpectationContract[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    let disposed = false
    indexedDbExpectationRepository
      .getAll()
      .then((all) => {
        if (!disposed) setContracts(all.filter((contract) => contract.projectId === projectId))
      })
      .catch(() => {
        if (!disposed) setError('期待契约加载失败，请重试。')
      })
    return () => {
      disposed = true
    }
  }, [projectId])
  const chapter = currentChapterNumber ?? 0
  const rhythm = expectationEngine.evaluateChapterText(currentText, chapter)
  const audit = expectationEngine.auditContracts(contracts, chapter)
  const active = contracts.filter(
    (contract) => contract.status !== 'fulfilled' && contract.status !== 'broken',
  )
  return (
    <aside
      data-testid="expectation-drawer"
      className="h-full overflow-y-auto p-4 text-xs space-y-3 text-[var(--ink-text)]"
    >
      <p className="font-semibold">期待感与节奏监测</p>
      {error && <p role="alert">{error}</p>}
      <p>
        词项计数：压迫定位词 {rhythm.suppressionSum}；结果定位词 {rhythm.payoffSum}；计数比例{' '}
        {rhythm.spr == null ? '分母为零，未定义' : rhythm.spr.toFixed(2)}。
      </p>
      <p>这是内置词表的字面定位，不能判断承诺、情绪、兑现或读者反应。</p>
      <div className="space-y-1 max-h-44 overflow-y-auto">
        {rhythm.observations.map((observation, index) => (
          <p key={index}>
            原文 [{observation.startOffset}, {observation.endOffset})：{observation.quote}
          </p>
        ))}
      </div>
      <p className="font-semibold">待兑现爽点契约 ({active.length})</p>
      <p>
        {chapter > 0
          ? '当前第 ' +
            chapter +
            ' 章；逾期 ' +
            audit.overdueContracts.length +
            ' 条；本章到期 ' +
            audit.dueContracts.length +
            ' 条。'
          : '章节序号未提供，不能判断逾期。'}
        未登记期限 {audit.unknownDeadlines.length} 条。
      </p>
      {active.length ? (
        active.map((contract) => (
          <div key={contract.id} className="p-2 rounded border border-[var(--ink-border)]">
            <p>{contract.title}</p>
            <p>
              作者标注：{contract.status}；计划兑现章：
              {contract.promisedResolveChapter > 0 ? contract.promisedResolveChapter : '未登记'}。
            </p>
            <p>{contract.notes}</p>
          </div>
        ))
      ) : (
        <p>暂无未决契约，可在主视口登记。</p>
      )}
    </aside>
  )
}
