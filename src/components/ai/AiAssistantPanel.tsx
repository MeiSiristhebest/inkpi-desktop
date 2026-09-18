import { useState, useEffect, type FC } from 'react'
import { Sparkles, X, RefreshCw, Activity } from 'lucide-react'
import { AiActivityCenter } from './AiActivityCenter'
import type { TaskRecoveryRecord } from '../../db/taskRecoveryStore'
import type { AiArtifact } from '../../ai/artifacts/artifactStore'

interface AiMessage {
  role: 'user' | 'assistant'
  text: string
}

interface AiAssistantPanelProps {
  messages: AiMessage[]
  input: string
  busy: boolean
  connected: boolean
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
        <button
          onClick={onClose}
          title="收起"
          className="p-1.5 rounded-md text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)] transition-colors duration-150"
        >
          <X className="w-3.5 h-3.5" />
        </button>
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
    </aside>
  )
}
