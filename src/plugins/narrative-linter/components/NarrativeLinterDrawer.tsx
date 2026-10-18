import { useState, useEffect, useMemo, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { NarrativeLinterEngine } from '../engine/NarrativeLinterEngine'
import { indexedDbNarrativeLinterRepository } from '../../../adapters/indexedDbNarrativeLinterRepository'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { ScoreProvenanceBadge } from '../../../ui/atoms'

export const NarrativeLinterDrawer: FC<DesktopPluginDrawerProps> = (props) => (
  <ProjectNarrativeDrawer key={props.projectId} {...props} />
)
const ProjectNarrativeDrawer: FC<DesktopPluginDrawerProps> = ({ projectId, currentText }) => {
  const [engine] = useState(() => new NarrativeLinterEngine())
  const [rules, setRules] = useState(NarrativeLinterEngine.getDefaultRules)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let disposed = false
    indexedDbNarrativeLinterRepository
      .getConfig(projectId)
      .then((config) => {
        if (disposed) return
        if (config) {
          const defaults = NarrativeLinterEngine.getDefaultRules()
          setRules(
            config.rules.map((rule) => ({
              ...rule,
              options:
                rule.options ?? defaults.find((item) => item.ruleId === rule.ruleId)?.options,
            })),
          )
        }
        setLoaded(true)
      })
      .catch(() => {
        if (!disposed) setError('规则配置读取失败，请重试。')
      })
    return () => {
      disposed = true
    }
  }, [projectId])
  const summary = useMemo(
    () => (loaded ? engine.lint(currentText, rules) : null),
    [engine, currentText, loaded, rules],
  )
  return (
    <div className="p-3.5 space-y-3 text-xs bg-[var(--ink-bg-panel)] text-[var(--ink-text)]">
      <div className="flex items-center justify-between pb-2 border-b border-[var(--ink-border)]">
        <span className="font-bold flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" />
          规则信号门禁巡检
        </span>
        {summary && <span>{summary.totalIssues} 处</span>}
      </div>
      <ScoreProvenanceBadge source="rule" detail="按项目启用规则定位原文；文学质量尚未判断" />
      {error && <p role="alert">{error}</p>}
      {summary?.configErrors.map((message) => (
        <p role="alert" key={message}>
          {message}
        </p>
      ))}
      {!currentText.trim() ? (
        <p>等待正文</p>
      ) : !summary ? (
        <p>正在读取规则配置</p>
      ) : summary.totalIssues === 0 ? (
        <p>{summary.configErrors.length ? '部分规则未执行' : '未命中当前启用规则；语境尚未审阅'}</p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {summary.issues.map((issue) => (
            <div
              key={issue.id}
              className="p-2.5 rounded-lg border bg-[var(--ink-bg-elevated)] space-y-1"
            >
              <div className="flex items-center justify-between font-semibold">
                <span>
                  <AlertCircle className="w-3 h-3 inline" /> {issue.ruleName}
                </span>
                <span>L{issue.lineNumber}</span>
              </div>
              <div className="font-serif">「{issue.matchedSnippet}」</div>
              <div>{issue.message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
