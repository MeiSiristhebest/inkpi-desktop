import { type FC } from 'react'
import { Engine } from './core/engine'
import { Bookshelf } from './components/bookshelf/Bookshelf'
import { AiAssistantPanel } from './components/ai/AiAssistantPanel'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useSettings, SettingsProvider } from './core/settings'
import { ThemeController } from './core/ThemeController'
import { useAiConversation } from './hooks/useAiConversation'
import { useProjectLibrary } from './hooks/useProjectLibrary'

/**
 * 应用根组件（组合根）：只负责 Provider 装配（SettingsProvider / ThemeController），
 * 自身不直接消费 useSettings（否则会落在 Provider 之外而报错，§12.3）。业务编排交给 AppShell。
 */
export const App: FC = () => (
  <SettingsProvider>
    <ThemeController />
    <AppShell />
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
  const ai = useAiConversation(settings.daemonWsUrl, settings.aiModel)

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
  } = ai

  const content = !activeProjectId ? (
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
  ) : (
    <ErrorBoundary label="应用主框架">
      <Engine
        projectId={activeProjectId}
        projectName={projects.find((p) => p.id === activeProjectId)?.name}
        isConnected={isConnected}
        isReconnecting={isReconnecting}
        onReconnect={reconnect}
        onRequestGhost={requestGhost}
        onAiPrompt={sendAiPrompt}
        onOpenAssistant={() => setAiPanelOpen(!aiPanelOpen)}
        onHome={() => setActiveProjectId(null)}
        rightPanel={
          aiPanelOpen ? (
            <AiAssistantPanel
              messages={aiMessages}
              input={aiInput}
              busy={aiBusy}
              connected={isConnected}
              onInputChange={setAiInput}
              onSend={() => sendAiPrompt(aiInput)}
              onClose={() => setAiPanelOpen(false)}
            />
          ) : null
        }
      />
    </ErrorBoundary>
  )

  return content
}

export default App
