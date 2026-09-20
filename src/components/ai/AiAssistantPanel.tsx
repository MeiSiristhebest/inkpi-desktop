import { useState, useEffect, type FC } from 'react'
import {
  Sparkles,
  X,
  RefreshCw,
  Activity,
  AlertTriangle,
  CheckCircle2,
  CloudOff,
} from 'lucide-react'
import { AiActivityCenter } from './AiActivityCenter'
import type { TaskRecoveryRecord } from '../../db/taskRecoveryStore'
import type { AiArtifact } from '../../ai/artifacts/artifactStore'
import type { DomainSyncConflict } from '../../domain/sync/domainSyncService'

interface AiMessage {
  role: 'user' | 'assistant'
  text: string
}

interface AiAssistantPanelProps {
  messages: AiMessage[]
  input: string
  busy: boolean
  connected: boolean
  domainSyncState?: 'synced' | 'syncing' | 'offline' | 'pending' | 'conflict'
  syncConflict?: DomainSyncConflict
  onRetrySync?: () => void
  onInputChange: (value: string) => void
  onSend: () => void
  onClose: () => void
  initialTab?: 'chat' | 'activity'
  onTabChange?: (tab: 'chat' | 'activity') => void
  taskRecovery?: TaskRecoveryRecord[]
  artifacts?: AiArtifact[]
  taskRecoveryLoading?: boolean
  taskRecoveryError?: string
  onResumeTask?: (taskId: string) => Promise<boolean>
  onCancelTask?: (taskId: string) => Promise<boolean>
  onDismissTask?: (taskId: string) => Promise<boolean>
  onSteerTask?: (taskId: string, input: unknown) => Promise<boolean>
}

export const AiAssistantPanel: FC<AiAssistantPanelProps> = ({
  messages,
  input,
  busy,
  connected,
  domainSyncState = 'offline',
  syncConflict,
  onRetrySync,
  onInputChange,
  onSend,
  onClose,
  initialTab = 'chat',
  onTabChange,
  taskRecovery = [],
  artifacts = [],
  taskRecoveryLoading = false,
  taskRecoveryError,
  onResumeTask,
  onCancelTask,
  onDismissTask,
  onSteerTask,
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'activity'>(initialTab)
  const [showConflictModal, setShowConflictModal] = useState(false)

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  const handleSwitchTab = (tab: 'chat' | 'activity') => {
    setActiveTab(tab)
    onTabChange?.(tab)
  }

  return (
    <aside className="w-full h-full flex flex-col border-l border-[var(--ink-border)] bg-[var(--ink-bg-panel)]">
      <div className="h-11 shrink-0 flex items-center justify-between px-3 border-b border-[var(--ink-border)]">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleSwitchTab('chat')}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] font-medium transition-colors ${
              activeTab === 'chat'
                ? 'bg-[var(--ink-bg-elevated)] text-[var(--ink-accent)]'
                : 'text-[var(--ink-text-muted)] hover:text-[var(--ink-text)]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            副驾驶
          </button>
          <button
            type="button"
            onClick={() => handleSwitchTab('activity')}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] font-medium transition-colors ${
              activeTab === 'activity'
                ? 'bg-[var(--ink-bg-elevated)] text-[var(--ink-accent)]'
                : 'text-[var(--ink-text-muted)] hover:text-[var(--ink-text)]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            活动中心
            {(taskRecovery.length > 0 || artifacts.length > 0) && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[var(--ink-accent-soft)] text-[var(--ink-accent)]">
                {taskRecovery.length + artifacts.length}
              </span>
            )}
          </button>
        </div>
        <div className="flex items-center gap-2">
          {/* Domain Sync State Indicator */}
          {domainSyncState === 'synced' && (
            <span
              title="领域数据已与 Daemon 保持权威同步"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
            >
              <CheckCircle2 className="w-2.5 h-2.5" />
              已同步
            </span>
          )}
          {domainSyncState === 'syncing' && (
            <span
              title="正在与 Daemon 异步投影同步…"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse"
            >
              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
              正在同步
            </span>
          )}
          {domainSyncState === 'pending' && (
            <span
              title="存在尚未推送到 Daemon 的本地领域修改"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              待同步
            </span>
          )}
          {domainSyncState === 'conflict' && (
            <button
              type="button"
              onClick={() => setShowConflictModal(true)}
              title="存在领域投影版本冲突，点击查看详情"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20 transition-colors"
            >
              <AlertTriangle className="w-2.5 h-2.5" />
              存在冲突
            </button>
          )}
          {domainSyncState === 'offline' && (
            <span
              title="Daemon 离线，领域修改暂存于本地 IndexedDB"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--ink-bg-elevated)] text-[var(--ink-text-muted)] border border-[var(--ink-border)]"
            >
              <CloudOff className="w-2.5 h-2.5" />
              离线
            </span>
          )}
          <button
            onClick={onClose}
            title="收起"
            className="p-1.5 rounded-md text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)] transition-colors duration-150"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {activeTab === 'activity' ? (
        <div className="flex-1 overflow-hidden">
          <AiActivityCenter
            recoveryRecords={taskRecovery}
            artifacts={artifacts}
            loading={taskRecoveryLoading}
            error={taskRecoveryError}
            onResume={onResumeTask}
            onCancel={onCancelTask}
            onDismiss={onDismissTask}
            onSteer={onSteerTask}
          />
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 && (
              <div className="pt-10 text-center text-[12px] text-[var(--ink-text-faint)] leading-relaxed">
                <Sparkles className="w-5 h-5 mx-auto mb-2 opacity-40" />
                <p>与 InkPi Agent 对话</p>
                <p className="mt-0.5">头脑风暴、续写、润色划词段落</p>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`px-2.5 py-2 rounded-lg text-[12px] leading-relaxed whitespace-pre-wrap break-words ${
                  m.role === 'user'
                    ? 'bg-[var(--ink-accent-soft)] text-[var(--ink-text)] ml-6'
                    : 'bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] text-[var(--ink-text)]'
                }`}
              >
                {m.text}
              </div>
            ))}

            {busy && (
              <div className="flex items-center gap-1.5 px-2.5 py-2 text-[12px] text-[var(--ink-text-faint)]">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>InkPi 正在思考…</span>
              </div>
            )}
          </div>

          <div className="shrink-0 p-2.5 border-t border-[var(--ink-border)]">
            <div className="flex items-end gap-1.5">
              <input
                type="text"
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    onSend()
                  }
                }}
                placeholder={connected ? '向 InkPi 下达写作指令…' : '离线模式：无法调用 AI'}
                disabled={!connected || busy}
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-[12px] bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] focus:outline-none focus:border-[var(--ink-accent)] disabled:opacity-50"
              />
              <button
                onClick={onSend}
                disabled={!connected || busy || !input.trim()}
                className="px-3 py-1.5 rounded-lg text-[12px] bg-[var(--ink-accent)] text-white hover:bg-[var(--ink-accent-hover)] disabled:opacity-40 transition-colors duration-150"
              >
                发送
              </button>
            </div>
          </div>
        </>
      )}

      {/* Domain Sync Conflict Inspection Modal */}
      {showConflictModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--ink-border)]">
              <div className="flex items-center gap-2 text-rose-500 font-medium text-[13px]">
                <AlertTriangle className="w-4 h-4" />
                领域数据同步冲突
              </div>
              <button
                type="button"
                onClick={() => setShowConflictModal(false)}
                className="p-1 rounded text-[var(--ink-text-muted)] hover:text-[var(--ink-text)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-[12px]">
              <p className="text-[var(--ink-text-muted)] leading-relaxed">
                本地 IndexedDB 与 Daemon 远程投影产生版本分叉，当前自动同步已暂停以防丢失本地事实。
              </p>

              <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-[var(--ink-bg-panel)] border border-[var(--ink-border)]">
                <div>
                  <div className="text-[11px] text-[var(--ink-text-faint)]">本地版本 (Local)</div>
                  <div className="font-mono font-medium text-[var(--ink-text)]">
                    rev {syncConflict?.localRevision ?? '?'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[var(--ink-text-faint)]">远程版本 (Remote)</div>
                  <div className="font-mono font-medium text-[var(--ink-text)]">
                    rev {syncConflict?.remoteRevision ?? '?'}
                  </div>
                </div>
              </div>

              {syncConflict?.conflictingAggregates &&
                syncConflict.conflictingAggregates.length > 0 && (
                  <div>
                    <div className="text-[11px] font-medium text-[var(--ink-text-muted)] mb-1">
                      冲突聚合实体 ({syncConflict.conflictingAggregates.length}):
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-1 p-2 rounded bg-[var(--ink-bg-panel)] border border-[var(--ink-border)] font-mono text-[11px]">
                      {syncConflict.conflictingAggregates.map((agg, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-[var(--ink-text-muted)]"
                        >
                          <span>{agg.aggregateType}</span>
                          <span className="text-[var(--ink-text-faint)]">{agg.aggregateId}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>

            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--ink-border)] bg-[var(--ink-bg-panel)]">
              <button
                type="button"
                onClick={() => setShowConflictModal(false)}
                className="px-3 py-1.5 rounded-md text-[12px] border border-[var(--ink-border)] text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] transition-colors"
              >
                稍后处理
              </button>
              {onRetrySync && (
                <button
                  type="button"
                  onClick={() => {
                    setShowConflictModal(false)
                    onRetrySync()
                  }}
                  className="px-3 py-1.5 rounded-md text-[12px] bg-[var(--ink-accent)] text-white hover:bg-[var(--ink-accent-hover)] transition-colors"
                >
                  重新尝试同步
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
