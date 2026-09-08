# InkPi Desktop 技术架构

状态：当前实现基线。AI Runtime v1 仍是条件冻结草案，不代表所有 Phase 0–23 验收项已经完成。

本文记录 InkPi Desktop 与 InkPi Daemon 的进程边界、数据所有权、AI 任务入口和当前实现状态。规范性契约见 inkpi/docs/specs/AI_RUNTIME_SPEC_v1.md。

## 1. 进程拓扑

~~~text
Tauri 2 shell
  └─ Vite + React Desktop
       ├─ Editor / Codex / Plugins
       ├─ IndexedDB（权威创作域状态）
       ├─ AiAssistant.runTask(...)
       └─ DomainSyncService
             └─ WebSocket JSON-RPC
                   └─ InkPi Daemon
                         ├─ @inkpi/agent-core
                         │    ├─ TaskRouter
                         │    ├─ ContextPipeline
                         │    ├─ TaskScheduler
                         │    ├─ ToolRegistry / ExtensionHost
                         │    └─ InstructionRegistry
                         ├─ @inkpi/server
                         ├─ Model handler / providers
                         └─ SQLite（派生日志、检索和任务持久化）
~~~

默认约定是 TCP 端口 8848，WebSocket 使用 TCP 端口加一；实际端口由 Daemon 启动结果决定。inkpi-daemon-gateway 只负责把 @inkpi/client 的连接适配到 Desktop 端口。

## 2. 数据所有权

| 数据 | 权威位置 | 当前实现 |
| --- | --- | --- |
| 项目、分卷、章节编辑结果 | Desktop IndexedDB | indexedDbProjectRepository 在写入 projects、volumes、chapters 前追加 DomainChangeSet |
| DomainChangeSet 日志 | Desktop IndexedDB | IndexedDbDomainChangeStore，带单调 revision、校验和、幂等和快照恢复 |
| Daemon 侧变更日志和游标 | Daemon SQLite | DomainProjectionStore 写入 domain_change_sets 和 domain_projection_cursors |
| 文本全文检索、JIT 记忆、任务记录 | Daemon SQLite | 派生数据；不能回写成创作域事实 |
| AI 产物 | 当前为 Desktop IndexedDB | IndexedDbArtifactStore 的 aiArtifacts store |

SQLite 的 DomainProjectionStore 通过 DomainMaterializer 将 DomainChangeSet 物化到 workspaces、folders、documents 和 document_snapshots 等派生读模型；materializer 处理父子顺序、删除级联和从变更日志重建。DomainMaterializer 的增量、快照恢复、重建和持久化重启测试已覆盖这些边界。StoryState 的完整派生读模型仍不在当前 reducer 范围内。

workspaceId 是协议中的同步范围标识；Desktop 项目仓储当前把 projectId 作为该值使用。协议没有另定义 projectId 字段。

## 3. Desktop 分层

### 3.1 端口和适配器

- src/ports/ 定义 AiGateway、AiAssistant、项目仓储和基础设施端口。
- src/adapters/ 实现 IndexedDB、Daemon WebSocket、下载、剪贴板、确认框等外部访问。
- src/domain/ 只放内容投影、故事状态、同步和提案规则。
- src/ai/ 放 Creative Intelligence、任务工厂、结果解析、提案、产物、缓存、能力路由和插件指令。
- src/components/ 和 src/plugins/**/components/ 不直接导入模型供应商，不直接组装 Prompt，不直接调用 IndexedDB。

src/architecture.test.ts 检查禁止的基础设施访问；src/architecture-ai.test.ts 检查 React 组件的供应商导入、Prompt 构造、直接模型调用和已移除的旧 AI 入口。

### 3.2 当前 AI 端口

Desktop 的 AiAssistant 实际接口是：

~~~ts
interface AiAssistant {
  runTask(
    task: AiTask,
    options?: {
      signal?: AbortSignal
      pollIntervalMs?: number
      onProgress?: (snapshot: TaskStatusSnapshot) => void
    },
  ): Promise<TaskResult | null>
  steerTask?(taskId: string, input: unknown): Promise<boolean>
  resumeTask?(taskId: string): Promise<void>
  status(): Promise<{ running: boolean }>
  close(): Promise<void>
}
~~~

实现是 src/adapters/daemonAiAssistant.ts。它调用 task.submit，轮询 task.status，在 AbortSignal 触发时调用 task.cancel，并把状态快照交给进度回调。

openSession、suggestContinuation 和 prompt 已不再是 Desktop AiAssistant 端口的方法。Daemon 仍保留 session.*、agent.* 等旧会话/Agent RPC 供现有会话基础设施使用；这些 RPC 不是 Creative Task API，新的创作请求不得以它们作为入口。仓库中的其他开发说明文件仍有旧名称，未在本次文档范围内修改。

## 4. Canonical Content Representation

src/domain/content/semanticDocument.ts 定义：

~~~ts
interface SemanticDocument {
  documentId: string
  revision: number
  text: string
  blocks: SemanticBlock[]
  sourceMap: TextSourceMap
  representation: 'prosemirror-json' | 'html' | 'text'
}
~~~

SemanticBlock 包含稳定 block id、类型、规范化文本、semantic 范围和可选编辑器位置。当前入口：

- semanticDocumentFromProseMirror
- semanticDocumentFromHtml
- semanticDocumentFromText
- projectEditorContent / projectContent
- semanticTextFromContent

AI 任务使用 SemanticDocument.text、blocks 和 selection；SourceMap 保留在 Desktop，用于把提案范围映射回编辑器坐标。插件中的章节内容应先通过 semanticTextFromContent 投影。HTML 是编辑器输入格式，不是 AI 的协议输入。

TextSourceMap 提供 semanticToEditor、editorToSemantic、semanticRangeToEditor 和 editorRangeToSemantic。目前是按 block 区间进行映射，复杂标记和所有编辑器节点类型的正确性仍需扩展测试。

## 5. Canonical Story Model

src/domain/story/storyState.ts 的 StoryState 是不可变更新风格的聚合：

~~~ts
interface StoryState {
  revision: number
  entities: Record<string, StoryEntity>
  relations: Record<string, StoryRelation>
  events: Record<string, StoryEvent>
  scenes: Record<string, StoryScene>
  timelines: Record<string, StoryTimeline>
  promises: Record<string, NarrativePromise>
  constraints: Record<string, StoryConstraint>
}
~~~

当前提供 create、upsert、remove、revision 和 assertStoryState。每个条目必须带 provenance。实际事实等级为：

canonical-fact、character-belief、rumor、hypothesis、ai-inference、proposal。

Provenance 记录 sourceType、factLevel、来源文档/块/修订、confidence 和 evidence。isCanonicalFact 只把 factLevel === 'canonical-fact' 视为作者事实。StoryState 的持久化、从所有插件数据源的提取和完整运行时注册仍未形成已验证的端到端链路。

## 6. Runtime 任务边界

### 6.1 调用链

~~~text
UI / Plugin
  → CreativeIntelligence 或 AiAssistant
  → AiTask
  → task.submit
  → TaskRouter
  → ContextPipeline
  → TaskHandler / TaskModelHandler
  → Model provider
  → TaskResult / Artifact / Proposal reference
~~~

@inkpi/agent-core 只依赖通用协议和端口，不依赖 Creative Domain。StoryContextCompiler 位于 Desktop src/ai/context/，不能移动到 agent-core。

### 6.2 AiTask 和结果

协议文件是 inkpi/packages/protocol/src/task.ts。核心维度相互独立：

- ExecutionStrategy：completion、reasoning、workflow、agent
- ExecutionMode / SchedulingPolicy：interactive、foreground、background、batch
- OutputFormat：text、structured、patch
- OutputPersistence：ephemeral、session、artifact
- EffectMode：read-only、proposal

TaskResult.status 的终态是 waiting-user、completed、failed、cancelled。interrupted 是 TaskStatusSnapshot 和执行记录中的可恢复状态，不是当前 TaskResult 的终态联合成员。

### 6.3 TaskRouter

TaskRouter 位于 packages/agent-core/src/tasks/task-router.ts，当前提供：

- submit、status、wait、cancel
- steer、resume
- replay、fork
- execution（进程内执行记录读取）
- TaskRegistry 精确 kind、canHandle 和 wildcard handler 解析
- ContextPipeline 调用、超时、retry、checkpoint、任务事件和持久化

事件类型包括 created、queued、started、progress、checkpointed、waiting-user、completed、failed、cancelled、interrupted。Daemon 将 TaskRouter 事件广播为 task.event。

TaskModelHandler 是当前通用模型 handler。它接收 ModelConfig，调用 streamAi，支持共享 ToolRegistry 的顺序工具循环，接收公开 steering，并删除 <think> 及其他私有推理字段。TaskRouter 不提交 Proposal，也不直接修改 Desktop 域状态。

TaskRouter 当前通过 Daemon 暴露的 RPC 是：

task.submit、task.status、task.cancel、task.steer、task.resume、task.replay、task.fork。

TaskRouter.execution 暂无对应公开 RPC。能力路由、产物持久化和缓存也没有被证明由 TaskRouter 默认自动接入。

## 7. Domain Projection Sync

协议 inkpi/packages/protocol/src/domain-sync.ts 的实际类型为：

~~~ts
interface DomainChangeSet {
  id: string
  workspaceId: string
  sourceDeviceId: string
  baseRevision: number
  revision: number
  changes: DomainChange[]
  checksum: string
  createdAt: number
}
~~~

每个 DomainChange 有 id、aggregateType、aggregateId、upsert | delete、aggregate revision、可选 payload 和 occurredAt。

Desktop IndexedDbDomainChangeStore.append 串行化追加，要求 baseRevision === currentRevision 且 revision === currentRevision + 1；相同 id 和相同校验和幂等返回，不同内容的 id 冲突报错。list、snapshot 和 restore 会校验 workspace、连续 revision 和 checksum。

Daemon DomainProjectionStore.apply/list/createSnapshot/restoreSnapshot 使用同样的规则，并在 SQLite 中维护 domain_change_sets 和 domain_projection_cursors。domain.sync.push、domain.sync.pull、domain.sync.snapshot 和 domain.sync.restore 由 Daemon 注册。

当前校验和由协议中的确定性排序序列计算 32 位 FNV-1a 风格值；它用于一致性检测，不是加密签名。多设备冲突解决、物化文档/故事投影和完整离线重连演练仍需验证。

## 8. Proposal / CAS 边界

AI 不直接写 Authoritative Domain State。当前有两个相关但尚未统一的 Desktop 类型：

1. src/ai/proposals/domainProposal.ts 的 DomainProposal：通用目标、操作、baseRevision、可选 sourceHash、patch、evidence 和 reason。
2. src/ai/proposals/proposalLedger.ts 的 AiProposal：面向文本重写 UI 的 TextPatch[]、状态和 inversePatches。

ProposalLedger 的规则：

- 新提案为 pending；accept 后才可 commit，reject 终止审阅。
- commit 检查当前 revision 与 baseRevision；不一致则标记 stale 并抛出 ProposalConflictError。
- 可选 currentSourceHash 与提案 sourceHash 不一致时标记 stale。
- rebase 由调用者提供 patch transform，并把状态重置为 pending。
- commit 的 apply 回调负责实际写入；写入成功后记录 committedRevision 和 inversePatches。
- undo 要求当前 revision 等于 committedRevision，并以新 revision 应用 inversePatches。

当前 Proposal Ledger 是 Desktop 本地逻辑，不是 Daemon RPC，也没有统一的 DomainProposal 持久化适配器。Selection Toolbar 已接入文本提案审阅路径；跨窗口/跨设备提案提交仍待验证。

## 9. 五个 Vertical Slices

| Slice | 当前入口与策略 | 当前状态 |
| --- | --- | --- |
| Continue Prose | createContinueTask；creative.continue；completion + interactive；text/ephemeral；read-only。useAiConversation.requestGhost 通过 runTask 获取文本。 | Desktop task assistant 已通过真实 WebSocket child process 验证 completed 和 waiting-user 两个用例；编辑器 GhostText 全链路仍未验收 |
| Selection Rewrite | createRewriteTask；creative.rewrite；completion + interactive；patch/artifact；proposal + approval。 | ProposalLedger 的 accept/reject/modify/rebase/commit/undo/CAS 逻辑存在；完整持久化与冲突 UI 集成待验收 |
| Continuity Audit | createContinuityAuditTask；narrative.continuity.audit；workflow + background；structured/artifact；ContinuityAuditScheduler 提供 debounce/cancel/dedup。 | 编排和单元测试存在；章节保存触发、诊断到 gutter marker 的生产链路未确认 |
| Deep Story Reasoning | createDeepReasoningTask；narrative.deep.reason；reasoning + interactive；structured/artifact；TaskModelHandler 支持工具和公开 steering。 | 本地编排、工具循环和 steering 路径存在；长任务 UI、人机介入和真实模型能力路由待验收 |
| Project Distillation | createDistillationTask；narrative.project.distill；workflow + background；structured/artifact；ProjectDistillationWorkflow 按 chunk 顺序执行并保存 checkpoint。 | map/reduce 风格合并、断点和部分失败逻辑有测试；大项目 benchmark、Daemon 重启恢复和 lineage 端到端待验收 |

任务工厂引用的 provider id 是 creative.document、creative.story、retrieval.jit。Daemon 目前在注入 JIT retriever 时注册 JitContextProvider；Desktop Story provider 和 document provider 的跨进程注册需继续核对。

## 10. 扩展能力边界

### Skills

ProgressiveSkillRuntime 复用 ExtensionHost、DynamicPluginLoader、ToolRegistry 和 SkillDiscoveryEngine。SkillManifest 包含 id、version、title、description、intents、capabilities、taskKinds、tools 和 eager | lazy | on-demand activation。discovery 只读取 metadata；load 才读取完整 markdown body；扩展工具在加载后镜像到现有 ToolRegistry。

通用 progressive disclosure runtime 已存在。hook、promise、character-voice、timeline-consistency 四个第一批 creative skill 的 manifest 已存在；Runtime 生命周期测试覆盖共享 ExtensionHost、ToolRegistry、TaskRegistry、ContextPipeline 的注册、失败回滚、重试和并发幂等。四个 first-party skill 逐个激活、Desktop 生产环境跨进程注册和 CI 验收仍未确认。

### Artifacts

src/ai/artifacts/artifactStore.ts 定义 Artifact、AiArtifact、ArtifactStore、IndexedDbArtifactStore 和 ArtifactRuntime。Artifact 必须有 id、type、version、content、provenance、createdAt、updatedAt；lineage 可记录 parentArtifactId、sourceTaskId 和 sourceRevision。当前预定义类型包括 story-plan、character-state、open-threads、chapter-summary、audit-report 和 distillation-checkpoint。

只有 output persistence 为 artifact 且任务结果为 completed 或 waiting-user 时，ArtifactRuntime.persistTaskResult 才写入 aiArtifacts。当前没有 Daemon Artifact RPC 或跨端同步协议。

### Cache

ContextCache 和 LayeredContextCache 提供 context、semantic、provider 三层缓存。键可包含 taskKind、contextFingerprint、projectRevision、model、instructionVersion、skillVersion、providerId；实现有 TTL、LRU 淘汰和 hit/miss/eviction 统计。

daemonAiAssistant.runTask 现在经由 CreativeIntelligence，再由其接入 provider-response cache；缓存工具仍未证明已接入 ContextPipeline、context compilation 或 retrieval 的默认路径，三层缓存的实际命中率和跨重启策略仍需测量。

### Capability

CapabilityRouter.select 先按任务 requirements 和 ModelCapabilities 过滤，再按 route priority、quality 和 latency 排序。当前可过滤 streaming、tool calling、structured/json schema、reasoning、vision、context、latency、cost 和输出格式。

Desktop 的 CreativeIntelligence 在提交前执行 CapabilityRouter.select；Daemon 的 task.submit 在入队前执行 CapabilityRouter.resolve，TaskModelHandler 使用选定 route。能力过滤、确定性排序和 mismatch-before-queue 有测试；真实 provider capability matrix、跨进程配置和生产 fallback 仍待证明。

### Instructions

InstructionRegistry 位于 agent-core，支持 register、upsert、unregister、compose、composeForTask，按 priority 和 id 确定性排序，并返回 entry ids、version 和 truncation。TaskRouter 将匹配的 instructions 传给 handler，并把 instruction version/ids 放入结果 provenance。

Desktop 插件指令由 src/ai/instructions/pluginInstructions.ts 的稳定映射提供；daemonAiAssistant 在首个 task batch 前通过共享 promise 自动注册 6 个核心和 22 个插件指令。真实 child-process 集成已检查 instruction.status 以及两类任务的 instruction provenance；五个切片全量生产链路仍待验收。

### Observability

TaskRouter observer 和 task.event 可记录 taskId、kind、状态、时间、progress、结果类型、artifact/proposal ids、checkpoint、provider/model、context fingerprint、context token count、usage、tool trace 和错误摘要。sanitizeProvenance 会删除 thinking、reasoning、chainOfThought、cot 和 rawThinking。

默认协议和持久化路径不得保存完整 Prompt、原始 <think> 或私有 CoT。当前 provenance 已覆盖两类真实 child-process 集成的 instruction id、route 和 artifact/cache 相关字段，但 skill 版本、跨进程 checkpoint/artifact lineage、统一跨层 cache 统计、生产日志脱敏和采样策略仍待验证。

## 11. 插件与 Legacy 状态

src/ai/tasks/pluginCatalog.ts 与 src/core/pluginRegistry 对齐 44 个 first-party plugin id；src/ai/tasks/pluginRuntimeCatalog.ts 为 44 个条目逐一标注 pure-local、ai-task、context-provider、tool、workflow、ui-only 或 hybrid 边界。当前有 22 个插件组件通过 PluginHostContext.aiAssistant.runAnalysis 生成 plugin.<id>.analysis 任务，其余条目也已显式分类和指向 Desktop、本地引擎、Story Context、Extension Tool 或 Runtime Workflow。

src/architecture-ai.test.ts 已覆盖：

- 44 个插件目录完整且无重复；
- Desktop 可执行源码不直接导入 LLM provider；
- React 组件不新增 Prompt 构造；
- Plugin UI 不直接调用模型；
- 新 AI 路径不直接调用模型或 task/instruction RPC，底层 RPC 仅在 adapter 中出现；
- Desktop src 不重新引入 onAiPrompt、systemPromptEnhancer、openSession、suggestContinuation；
- `src/ai` 不直接导入或调用 projects、volumes、chapters、domainChangeSets 等 authoritative store。

Daemon 的 session/agent 旧 RPC 仍被旧会话基础设施使用。本支线不删除这些 RPC；Desktop 新 AI 路径不直接引用它们。若未来 Desktop 必须保留旧 RPC 适配器，必须把文件登记为显式 compatibility boundary，并禁止新创作请求经该边界进入。`src/ai/artifacts/artifactStore.ts` 对 `aiArtifacts` 的写入是派生产物持久化，不属于 authoritative domain state。

`src/phase21-22-reliability.test.ts` 固定覆盖本地可复现的可靠性边界：等价重复 task 的 task-id 无关缓存命中、proposal revision/source-hash stale、模型结构化输出与 context budget 能力不匹配、非法 structured output、以及 project revision 驱动的 cache invalidation。`src/adapters/desktopDaemonIntegration.test.ts` 另通过真实 child process 验证 completed/waiting-user RPC 与结果持久化。Desktop 当前没有本地模型执行器或 token-budget enforcement，因此没有伪造 context overflow 测试；完整五切片、App restart 和真实 overflow 仍需集成测试。

## 12. 质量门禁与未决条件

代码仓库已有 typecheck、unit test、architecture test、Daemon RPC、同步、任务可靠性、插件生命周期和 eval runner 测试入口。本文不把一次局部测试通过解释为全量 v1 验收。

在标记 Runtime v1 为最终冻结前，必须完成并记录：

1. 五个 Slice 的真实 Desktop ↔ Daemon 集成测试（当前只有 Continue 的 completed/waiting-user 两个 child-process 用例）。
2. DomainChangeSet 到 SQLite 文档/故事读模型的明确 reducer，及重启、离线、乱序、损坏快照测试。
3. 三层 Cache、InstructionRegistry、ArtifactStore 在完整生产任务路径的接入证明；CapabilityRouter 的真实 provider matrix 和 fallback 证明。
4. 四个第一批 creative skill 的逐个实际 manifest、lazy load、ExtensionHost/ToolRegistry 注册和跨进程测试。
5. 44 个插件的分类、迁移或 UI-only 决策；清理剩余旧 session/Agent AI 入口和过期文档。
6. Evals 进入 CI，并补充 source-map、entity contradiction、invalid state transition、mutation、canonical subjective fixture 和 100/300 chapter benchmark；再以真实 provider 和人类标注 gold 复核。
7. crash/restart、模型不可用、能力不匹配、结构化输出非法、context overflow、cache invalidation、stale proposal 的可靠性报告。
