# InkPi Product Invariants (M0)

These 10 invariants are absolute and non-negotiable across all layers of InkPi (Desktop, Runtime, Plugins, AI pipelines, Storage).

| ID         | Product Invariant                         | Definition & Enforcement                                                                                                                                                                       |
| ---------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **INV-01** | **No Silent Loss of Author Writing**      | 用户输入绝不能因为切章、切工具、关闭窗口、崩溃而无提示丢失。所有未落盘内容必须在切章/切项目/切视图/关闭窗口时强制同步 flush；异常崩溃由 Draft WAL 保障。                                       |
| **INV-02** | **Single Authoritative Mutation Path**    | 同一正文的任何 mutation（用户打字、AI 重写、插件写回、格式化、敏感词替换、历史恢复、幽灵文本采纳等）只能经过唯一的 `ChapterMutationService`。禁止通过非受控 setContent 或绕过 CAS 的并发生存。 |
| **INV-03** | **Strict Workspace Isolation**            | Workspace A 的数据、检索结果（FTS/JIT）、缓存、Artifact、Task 永远不能进入 Workspace B。所有存储、检索和任务上下文必须附带且校验 `workspaceId`。                                               |
| **INV-04** | **Honest & Complete Project Backup**      | Project backup 必须明确说明备份范围；叫“完整备份 (InkPi Workspace Backup)”就必须真正包含正文、大纲、Codex、时间线、伏笔、插件数据、StoryState、目标、历史快照与版本清单。                      |
| **INV-05** | **Strict Epistemic Distinctions**         | Unknown ≠ Demo ≠ Template ≠ User Fact ≠ AI Inference。未配置或无事实时绝不能用 Demo/模板数据冒充；AI 推测绝不能未经审批自动晋升为正典事实 (Canonical Fact)。                                   |
| **INV-06** | **Explicit AI Task Context & Scope**      | AI 必须明确知道自己正在服务哪个 Workspace / Chapter / Revision / Selection，禁止以空上下文或无范围的泛化入参驱动创作与分析。                                                                   |
| **INV-07** | **AI Generation ≠ Canonical Fact**        | AI 生成内容进入正典 (Canon) 必须经过 Proposal -> Review -> Accept 生命周期，严禁 AI 任务静默修改底层正典数据。                                                                                 |
| **INV-08** | **UI State & Durable State Consistency**  | 用户点击“应用/修复/恢复/写回”后，UI state 与 durable persistence 必须原子一致；成功提示必须在物理落库完成后给出，失败必须显式回滚并提示重试。                                                  |
| **INV-09** | **Transparent AI Execution & Provenance** | 用户界面展示的 AI 状态、模型、连接、评分来源必须与实际执行一致，严禁硬编码虚假的“就绪”或将简单启发式规则包装成虚构的 AI 预测。                                                                 |
| **INV-10** | **Decoupled Capability Lifecycle**        | Capability 是否存在、是否启用、是否出现在导航，是三件不同的事。未启用插件绝不能在后台运行、污染菜单或拦截全局快捷键。                                                                          |
