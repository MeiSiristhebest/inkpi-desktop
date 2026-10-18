import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import type { ClueItem, ClueCognitionRecord, GodViewViolation } from '../types'
import { clueWeaverEngine } from '../engine/ClueWeaverEngine'
import { indexedDbClueWeaverRepository } from '../../../adapters/indexedDbClueWeaverRepository'
import { Network, Search } from 'lucide-react'

export const ClueWeaverDrawer: FC<DesktopPluginDrawerProps> = (props) => (
  <ProjectClueDrawer key={props.projectId} {...props} />
)

const ProjectClueDrawer: FC<DesktopPluginDrawerProps> = ({
  projectId,
  currentText,
  currentChapterNumber,
}) => {
  const [clues, setClues] = useState<ClueItem[]>([])
  const [cognitions, setCognitions] = useState<ClueCognitionRecord[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [report, setReport] = useState<{ scope: string; violations: GodViewViolation[] } | null>(
    null,
  )
  const scope = JSON.stringify([currentText, currentChapterNumber, clues, cognitions])
  const violations = report?.scope === scope ? report.violations : null

  useEffect(() => {
    let disposed = false
    Promise.all([
      indexedDbClueWeaverRepository.getAllClues(projectId),
      indexedDbClueWeaverRepository.getAllCognitions(projectId),
    ])
      .then(([allClues, allCogs]) => {
        if (disposed) return
        setClues(allClues)
        setCognitions(allCogs)
        setLoaded(true)
      })
      .catch(() => {
        if (!disposed) setError('线索档案加载失败，请重新打开抽屉重试。')
      })
    return () => {
      disposed = true
    }
  }, [projectId])

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 text-xs text-[var(--ink-text)]">
      <div className="flex items-center gap-2 border-b border-[var(--ink-border)] pb-3">
        <Network className="w-4 h-4" />
        <span>信息差与全知哨兵</span>
      </div>
      {error && <p role="alert">{error}</p>}
      <p>
        当前正文；
        {currentChapterNumber == null
          ? '章节序号未提供，不能检查获知时间。'
          : `第 ${currentChapterNumber} 章。`}
      </p>
      <p className="whitespace-pre-wrap max-h-32 overflow-y-auto">
        {currentText || '当前正文为空。'}
      </p>
      <button
        disabled={!loaded || !currentText.trim()}
        onClick={() =>
          setReport({
            scope,
            violations: clueWeaverEngine.scanGodViewLeakage(
              currentText,
              clues,
              cognitions,
              currentChapterNumber ?? undefined,
            ),
          })
        }
        className="w-full p-2 rounded border border-[var(--ink-border)] disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Search className="w-3.5 h-3.5" />
        检查当前正文
      </button>
      {violations && (
        <div className="space-y-2">
          {violations.length === 0 ? (
            <p>未找到匹配候选。未登记知识、未识别的说话人和语义越权仍需作者检查。</p>
          ) : (
            violations.map((violation, index) => (
              <div key={index} className="p-2 border border-[var(--ink-border)] rounded space-y-1">
                <p>
                  待复核：{violation.characterName} 提及 {violation.clueTitle}
                </p>
                <p>
                  原文 [{violation.startOffset}, {violation.endOffset})：{violation.snippet}
                </p>
                <p>{violation.reason}</p>
              </div>
            ))
          )}
        </div>
      )}
      <p>
        登记线索：{clues.length}；角色知识记录：{cognitions.length}。
      </p>
      <div className="space-y-1">
        {clues.map((clue) => (
          <p key={clue.id}>{clue.title}</p>
        ))}
      </div>
    </div>
  )
}
