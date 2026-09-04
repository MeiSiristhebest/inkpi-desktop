import React, { useState } from 'react'
import type { ProjectRepository } from '../../ports/projectRepository'
import type { TableRecordRepository } from '../../ports/tableRecordRepository'
import { indexedDbProjectRepository } from '../../adapters/indexedDbProjectRepository'
import { indexedDbTableRecordRepository } from '../../adapters/indexedDbTableRecordRepository'
import { TAB_DEFINITIONS as tabDefinitions } from '../../config/tabDefinitions'
import { ShieldAlert, Activity, CheckCircle2, AlertTriangle, Play } from 'lucide-react'

import { DEFAULT_SENSITIVE_WORDS } from '../../config/sensitiveWords'
import {
  findDuplicateCodes,
  findMissingDisplayNames,
  type HealthIssue,
} from '../../domain/moderation/healthCheck'

export interface CheckToolsProps {
  projectId: string
  projectRepo?: ProjectRepository
  tableRepo?: TableRecordRepository
}

export const CheckTools: React.FC<CheckToolsProps> = ({
  projectId,
  projectRepo = indexedDbProjectRepository,
  tableRepo = indexedDbTableRecordRepository,
}) => {
  const [activeTab, setActiveTab] = useState<'health' | 'sensitive'>('health')
  const [checking, setChecking] = useState(false)
  const [issues, setIssues] = useState<HealthIssue[]>([])
  const [hasScanned, setHasScanned] = useState(false)

  // 敏感词检测状态
  const [customWords, setCustomWords] = useState<string>('')
  const [sensitiveHits, setSensitiveHits] = useState<{ chapterTitle: string; hits: string[] }[]>([])

  // 确定性数据体检（编号重复、必填空扫描）
  const runHealthCheck = async () => {
    setChecking(true)
    const newIssues: HealthIssue[] = []

    try {
      // 按 tab 分组检查（每个表格通过仓储端口加载，不直接碰 db）
      const tableTabs = tabDefinitions.filter((t) => t.type === 'table')

      for (const tab of tableTabs) {
        const rows = await tableRepo.getRows(projectId, tab.id)
        // 领域规则（纯函数，见 domain/moderation/healthCheck.ts）
        newIssues.push(...findDuplicateCodes(rows, tab))
        newIssues.push(...findMissingDisplayNames(rows, tab))
      }

      setIssues(newIssues)
      setHasScanned(true)
    } finally {
      setChecking(false)
    }
  }

  // 全书敏感词扫描
  const runSensitiveScan = async () => {
    setChecking(true)
    try {
      const projChapters = await projectRepo.getChaptersByProject(projectId)

      const wordsToScan = [
        ...DEFAULT_SENSITIVE_WORDS,
        ...customWords
          .split(/[,，\s\n]+/)
          .map((w) => w.trim())
          .filter(Boolean),
      ]

      const results: { chapterTitle: string; hits: string[] }[] = []

      for (const ch of projChapters) {
        const hits: string[] = []
        const content = ch.content || ''
        for (const w of wordsToScan) {
          if (content.includes(w)) {
            hits.push(w)
          }
        }
        if (hits.length > 0) {
          results.push({ chapterTitle: ch.title, hits })
        }
      }

      setSensitiveHits(results)
      setHasScanned(true)
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-[var(--ink-bg)] text-[var(--ink-text)] p-6 select-none">
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">作品检查与体检工具</h1>
          <ShieldAlert className="w-4 h-4 text-[var(--ink-accent)]" />
        </div>
        <p className="mt-1 text-xs text-[var(--ink-text-muted)]">
          数据结构健康体检（离线确定性扫描） · 全书敏感词检测
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-[var(--ink-border)] pb-2">
        <button
          onClick={() => {
            setActiveTab('health')
            setHasScanned(false)
          }}
          className={`px-4 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
            activeTab === 'health'
              ? 'bg-[var(--ink-accent)] text-white'
              : 'text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)]'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          数据结构体检
        </button>
        <button
          onClick={() => {
            setActiveTab('sensitive')
            setHasScanned(false)
          }}
          className={`px-4 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
            activeTab === 'sensitive'
              ? 'bg-[var(--ink-accent)] text-white'
              : 'text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)]'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          敏感词全书检测
        </button>
      </div>

      {activeTab === 'health' ? (
        <div className="space-y-6 max-w-4xl">
          <div className="p-5 rounded-2xl bg-[var(--ink-bg-card)] border border-[var(--ink-border)] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold">全书设定离线数据体检</h3>
              <p className="text-xs text-[var(--ink-text-muted)] mt-1">
                纯程序扫描，无需联网，检查各表格编号冲突、必填项遗漏与引用悬空。
              </p>
            </div>
            <button
              onClick={runHealthCheck}
              disabled={checking}
              className="px-4 py-2 bg-[var(--ink-accent)] text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              {checking ? '扫描中...' : '开始体检'}
            </button>
          </div>

          {hasScanned && (
            <div className="space-y-3">
              {issues.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs flex flex-col items-center justify-center gap-2">
                  <CheckCircle2 className="w-6 h-6" />
                  <span>数据结构健康，未发现编号冲突或必填遗漏 ✓</span>
                </div>
              ) : (
                issues.map((issue) => (
                  <div
                    key={issue.id}
                    className={`p-4 rounded-xl border flex items-start gap-3 ${
                      issue.severity === 'error'
                        ? 'bg-red-500/10 border-red-500/30 text-red-500'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-600'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase border">
                          {issue.category}
                        </span>
                        <h4 className="text-xs font-bold text-[var(--ink-text)]">{issue.title}</h4>
                      </div>
                      <p className="text-xs text-[var(--ink-text-muted)] mt-1">{issue.detail}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6 max-w-4xl">
          <div className="p-5 rounded-2xl bg-[var(--ink-bg-card)] border border-[var(--ink-border)] space-y-4">
            <div>
              <h3 className="text-sm font-bold">敏感词库扫描</h3>
              <p className="text-xs text-[var(--ink-text-muted)] mt-1">
                逐章比对系统常见违规词与自定义词库，找出命中章节以便发布前修正。
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--ink-text-muted)]">
                自定义敏感词（以逗号或空格分隔）：
              </label>
              <textarea
                value={customWords}
                onChange={(e) => setCustomWords(e.target.value)}
                placeholder="例如：特定平台违禁词、需要避讳的词语..."
                rows={2}
                className="w-full p-2.5 text-xs rounded-lg bg-[var(--ink-bg)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none focus:ring-1 focus:ring-[var(--ink-accent)]"
              />
            </div>
            <button
              onClick={runSensitiveScan}
              disabled={checking}
              className="px-4 py-2 bg-[var(--ink-accent)] text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              {checking ? '扫描中...' : '扫描全书正文'}
            </button>
          </div>

          {hasScanned && (
            <div className="space-y-3">
              {sensitiveHits.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs flex flex-col items-center justify-center gap-2">
                  <CheckCircle2 className="w-6 h-6" />
                  <span>全书正文干净，未命中任何敏感词 ✓</span>
                </div>
              ) : (
                sensitiveHits.map((hit, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-[var(--ink-bg-card)] border border-[var(--ink-border)] flex items-start justify-between gap-4"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-[var(--ink-text)]">
                        {hit.chapterTitle}
                      </h4>
                      <p className="text-xs text-red-500 mt-1 flex flex-wrap gap-1">
                        命中敏感词：
                        {hit.hits.map((w, wIdx) => (
                          <span
                            key={wIdx}
                            className="px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-[10px]"
                          >
                            {w}
                          </span>
                        ))}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
