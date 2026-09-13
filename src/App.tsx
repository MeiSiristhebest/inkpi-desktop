import { type FC } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { spring, variants } from './motion'
import { Engine } from './core/engine'
import { Bookshelf } from './components/bookshelf/Bookshelf'
import { AiAssistantPanel } from './components/ai/AiAssistantPanel'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useSettings, SettingsProvider, type AppSettings } from './core/settings'
import { ThemeController } from './core/ThemeController'
import { useAiConversation } from './hooks/useAiConversation'
import { useProjectLibrary, type ProjectLibrary } from './hooks/useProjectLibrary'
import { PluginProvider } from './core/pluginRegistry'
import { ProjectDataProvider, useProjectData } from './core/projectDataContext'
import { StoryStateProvider, useStoryState } from './core/storyStateContext'
import { DesktopPluginHostProvider } from './core/pluginHostContext'
import type { ReactNode } from 'react'
import { CreativeWorkflowsPanel } from './components/ai/CreativeWorkflowsPanel'
import { TaskRecoveryPanel } from './components/ai/TaskRecoveryPanel'

const ProjectWorkspace: FC<{
  projectId: string
  projectName?: string
  isConnected: boolean
  onAiTask: (
    task: import('@inkpi/protocol').AiTask,
  ) => Promise<import('@inkpi/protocol').TaskResult | null>
  onPluginTool: (pluginId: string, input: Record<string, unknown>) => Promise<unknown | null>
  onPluginWorkflow: (
    pluginId: string,
    input: unknown,
    metadata?: Record<string, unknown>,
  ) => Promise<unknown | null>
  children: ReactNode
}> = ({
  projectId,
  projectName,
  isConnected,
  onAiTask,
  onPluginTool,
  onPluginWorkflow,
  children,
}) => {
  const { chapters, volumes, reloadChapters } = useProjectData()
  return (
    <DesktopPluginHostProvider
      projectId={projectId}
      projectName={projectName}
      activeChapter={chapters[0] || null}
      chapters={chapters}
      volumes={volumes}
      onRefreshHierarchy={reloadChapters}
      onAiTask={onAiTask}
      onPluginTool={onPluginTool}
      onPluginWorkflow={onPluginWorkflow}
      isAiConnected={isConnected}
    >
      {children}
    </DesktopPluginHostProvider>
  )
}

const ProjectEngine: FC<{
  projectId: string
  projectName?: string
  isConnected: boolean
  isReconnecting: boolean
  onReconnect: () => void
  onRequestGhost: (chapterId: string, text: string) => Promise<string | null>
  onAiTask: (
    task: import('@inkpi/protocol').AiTask,
  ) => Promise<import('@inkpi/protocol').TaskResult | null>
  onOpenAssistant: () => void
  aiPanelOpen: boolean
  setAiPanelOpen: (open: boolean) => void
  aiMessages: Array<{ role: 'user' | 'assistant'; text: string }>
  aiInput: string
  setAiInput: (value: string) => void
  aiBusy: boolean
  sendAiPrompt: (prompt: string) => void
  runContinuityAudit: import('./hooks/useAiConversation').AiConversation['runContinuityAudit']
  runDeepReasoning: import('./hooks/useAiConversation').AiConversation['runDeepReasoning']
  runDistillationWorkflow: import('./hooks/useAiConversation').AiConversation['runDistillationWorkflow']
  steerTask: import('./hooks/useAiConversation').AiConversation['steerTask']
  onHome: () => void
}> = (props) => {
  const { chapters } = useProjectData()
  return (
    <Engine
      projectId={props.projectId}
      projectName={props.projectName}
      isConnected={props.isConnected}
      isReconnecting={props.isReconnecting}
      onReconnect={props.onReconnect}
      onRequestGhost={props.onRequestGhost}
      onAiTask={props.onAiTask}
      onOpenAssistant={props.onOpenAssistant}
      onHome={props.onHome}
      rightPanel={
        <>
          <CreativeWorkflowsPanel
            projectId={props.projectId}
            chapters={chapters}
            connected={props.isConnected}
            onContinuityAudit={props.runContinuityAudit}
            onDeepReasoning={props.runDeepReasoning}
            onDistillationWorkflow={props.runDistillationWorkflow}
            onSteerTask={props.steerTask}
          />
          <AnimatePresence>
            {props.aiPanelOpen && (
              <motion.div
                key="ai-assistant-drawer"
                {...variants.slideInFromRight}
                transition={spring.gentle}
                className="h-full flex"
              >
                <AiAssistantPanel
                  messages={props.aiMessages}
                  input={props.aiInput}
                  busy={props.aiBusy}
                  connected={props.isConnected}
                  onInputChange={props.setAiInput}
                  onSend={() => props.sendAiPrompt(props.aiInput)}
                  onClose={() => props.setAiPanelOpen(false)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      }
    />
  )
}

/**
 * 应用根组件（组合根）：只负责 Provider 装配（SettingsProvider / ThemeController），
 * 自身不直接消费 useSettings（否则会落在 Provider 之外而报错，§12.3）。业务编排交给 AppShell。
 */
export const App: FC = () => (
  <SettingsProvider>
    <PluginProvider>
      <ThemeController />
      <AppShell />
    </PluginProvider>
  </SettingsProvider>
)

/**
 * 业务外壳：在 SettingsProvider 之内消费设置，并把业务 hook 的输出接到视图。
 *   - 项目书架 CRUD → useProjectLibrary（§7.3）
 *   - daemon 连接 / 会话 / AI 对话状态机 → useAiConversation（§7.3）
 * 组合根（App）与业务（AppShell）分离，App 不再内联任何业务编排逻辑（§7.3）。
 */
const AppShell: FC = () => {
  const [settings] = useSettings()
  const library = useProjectLibrary()

  return (
    <StoryStateProvider workspaceId={library.activeProjectId}>
      <AppShellContent settings={settings} library={library} />
    </StoryStateProvider>
  )
}

const AppShellContent: FC<{ settings: AppSettings; library: ProjectLibrary }> = ({
  settings,
  library,
}) => {
  const { storyState } = useStoryState()

  const {
    projects,
    activeProjectId,
    setActiveProjectId,
    createProject,
    importProject,
    createDemo,
    exportProject,
    updateProject,
    deleteProject,
  } = library

  const ai = useAiConversation(settings.daemonWsUrl, settings.aiModel, activeProjectId, {
    storyState,
  })

  const {
    isConnected,
    isReconnecting,
    aiPanelOpen,
    setAiPanelOpen,
    aiMessages,
    aiInput,
    setAiInput,
    aiBusy,
    reconnect,
    requestGhost,
    sendAiPrompt,
    runAiTask,
    runContinuityAudit,
    runDeepReasoning,
    runDistillationWorkflow,
    runPluginTool,
    runPluginWorkflow,
    steerTask,
    taskRecovery,
    taskRecoveryLoading,
    taskRecoveryError,
    resumeTask,
    cancelTask,
    dismissTask,
  } = ai

  const content = (
    <AnimatePresence mode="wait">
      {!activeProjectId ? (
        <motion.div
          key="view-bookshelf"
          {...variants.fade}
          transition={spring.gentle}
          className="h-full w-full"
        >
          <ErrorBoundary label="书架">
            <Bookshelf
              projects={projects}
              onOpenProject={setActiveProjectId}
              onCreateProject={createProject}
              onImportProject={importProject}
              onCreateDemo={createDemo}
              onExportProject={exportProject}
              onUpdateProject={updateProject}
              onDeleteProject={deleteProject}
            />
          </ErrorBoundary>
        </motion.div>
      ) : (
        <motion.div
          key={`view-workspace-${activeProjectId}`}
          {...variants.fade}
          transition={spring.gentle}
          className="h-full w-full"
        >
          <ErrorBoundary label="应用主框架">
            <ProjectDataProvider projectId={activeProjectId}>
              <ProjectWorkspace
                projectId={activeProjectId}
                projectName={projects.find((p) => p.id === activeProjectId)?.name}
                isConnected={isConnected}
                onAiTask={runAiTask}
                onPluginTool={runPluginTool}
                onPluginWorkflow={runPluginWorkflow}
              >
                <ProjectEngine
                  projectId={activeProjectId}
                  projectName={projects.find((p) => p.id === activeProjectId)?.name}
                  isConnected={isConnected}
                  isReconnecting={isReconnecting}
                  onReconnect={reconnect}
                  onRequestGhost={requestGhost}
                  onAiTask={runAiTask}
                  onOpenAssistant={() => setAiPanelOpen(!aiPanelOpen)}
                  onHome={() => setActiveProjectId(null)}
                  aiPanelOpen={aiPanelOpen}
                  setAiPanelOpen={setAiPanelOpen}
                  aiMessages={aiMessages}
                  aiInput={aiInput}
                  setAiInput={setAiInput}
                  aiBusy={aiBusy}
                  sendAiPrompt={sendAiPrompt}
                  runContinuityAudit={runContinuityAudit}
                  runDeepReasoning={runDeepReasoning}
                  runDistillationWorkflow={runDistillationWorkflow}
                  steerTask={steerTask}
                />
              </ProjectWorkspace>
            </ProjectDataProvider>
          </ErrorBoundary>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <>
      {content}
      {activeProjectId && (
        <TaskRecoveryPanel
          records={taskRecovery}
          loading={taskRecoveryLoading}
          error={taskRecoveryError}
          connected={isConnected}
          onResume={resumeTask}
          onCancel={cancelTask}
          onDismiss={dismissTask}
        />
      )}
    </>
  )
}

export default App
