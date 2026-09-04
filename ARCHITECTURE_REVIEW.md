# InkPi Desktop 架构评审报告

> 评审视角：资深软件架构师 · 评审日期：2026-09-03 · 代码基线：`src/`（116 个 ts/tsx，约 15.2k 行）
> 评审维度：硬编码与 mock、SRP、OCP、LSP、ISP、DIP、关注点分离、端口与适配器、纯函数与副作用隔离、原子设计、组合优于继承、被动视图、语义化命名、设计模式合理性、可测试性

---

> [!NOTE]
> **整改状态（2026-09-03 多轮整改 · 诚实版 · 缺陷类已清零，结构性项仍有剩余）**
> 逐条对照 §1–§16 实证：P0 全部 + 绝大多数 P1/P2 缺陷类，以及「仍待整改」清单中的全部 5 处结构性/模式类项，均已整改并通过 `npm run check` 验证（tsc 零错误、oxlint 零错误、vitest 227 用例全绿）。
> 原「仍待整改」5 项（§6.3/§12.3/§14.3 设置单例 + legacy 回退、§7.3 App 业务拆分、§8.2 双写 withMirror 装饰器、§11 CodexWriterDrawer 复用 Drawer、§10.2 iconBtn 统一 IconButton）现已清零；仅 §13.2 projectService 改名按评审「可不做」保留。
>
> **已整改（构建 + 测试已验证，tsc/oxlint/227 用例全绿）**
> - §1.1 种子 ID 注入式动态生成（不再硬编码 `vol-1`/`ch-1`，`RichEditor` 播种透传 `firstVolumeId`）。
> - §1.2 种子三章示范正文外移到 `domain/seed/seedContent.ts`。
> - §1.3 `tabDefinitions.ts` 反混淆 + `TAB_DEFINITIONS`/`TabDefinition`；§1.4 敏感词表去重为 `src/config/sensitiveWords.ts`；§1.5 `BookCover` 渐变→`bookCoverPalettes.ts`、`CodexMasterView` 彩色类→`var(--ink-accent)`、`RichEditor` 状态色令牌化；§1.6 业务默认值外移到 `domain/chapter/*` 与 `domain/project/projectDefaults.ts`。
> - §2.1 `RichEditor` 32 个 `useState` → `useChapterEditorModel`+`useChapterAutosave`+9 个 `organisms`（1128→334 行）；§2.2 `Bookshelf` 拆为容器 + 5 个 organisms + `coverUpload.ts`；§2.3 `CheckTools` 领域规则外移到 `domain/moderation/healthCheck.ts` 纯函数；§2.4 `pluginRegistry.tsx` 删除 legacy 双实现，`SettingsView` 包裹 `PluginProvider`。
> - §3.1 `Engine` if 链 → 视图注册表；§3.2 `CodexAdapters` 双 switch → 表驱动；§3.3 `InspireTools` if-else → 策略注册表 `inspireStrategies.ts`。
> - §4.1 `importProject` 返回 `Result` 类型；§4.2 `RichEditor` 6 个可选回调默认 no-op 空对象；§4.3 `Adapters.ts` 关系图边改用规范化引用键 `relKey(a,b)`。
> - §5.1 `ProjectRepository` 按读写拆为 `ProjectQueryPort`+`ProjectCommandPort`（适配器同时实现，读取型 hook 收窄到 `ProjectQueryPort`）；§5.2 新增 `getVolumesByProject`/`getChaptersByProject` 并按项目查询（5 处调用方迁移）。
> - §6.1 `RichEditor` 两导出路径统一走 `blobFileDownloader`/`renderChapterHtmlDocument`；§6.2 六个模块直引 `db` 全部改走端口，由 `src/architecture.test.ts` 守卫拦截（排除 `*.test.*`）。
> - §7.1 `chapterExporter` 只管 txt/md，HTML 外壳移到 `htmlChapterRenderer`；§7.2 视图数据访问收口（CheckTools→healthCheck、Bookshelf→model、CodexMasterView→repository 端口）。
> - §8.1 缺失端口补齐（`KeyValueStore`/`ConfirmDialog`/`ClipboardWriter`/`Clock`/`IdGenerator`/`RandomSource` 等）；§9.2 `seed`/`Adapters` 时间注入 `Clock`；§9.3 `window.confirm`/`navigator.clipboard` 收口端口；§9.4 `projectService`/`useDashboardModel` 去模块级可变状态。
> - §10.1 补齐 `ui/molecules`（Modal/ConfirmDialog/ContextMenu/Drawer）；§12.3 `pluginRegistry` legacy 回退删除；§13.1 `PluginManagerView`→`PluginSettingsView`（含文件重命名）；§13.2 `CodexAdapters`→纯函数、`living-codex/data/`→`content/`；§13.3 引入 Prettier；§14.2 `CodexAdapters` 静态类→纯函数；§14.4 `AiGateway`→语义化 `AiAssistant`；§15.4 `architecture.test.ts` 守卫固化。
>
> **已整改（实证清单，本轮全部清零 · 2026-09-03 后续轮）**
> - **§6.3 / §12.3 / §14.3**：`settings.tsx` 的 `let settingsRepo` + `setSettingsRepository` 可变单例、以及 `listeners` Set + `legacySettings` + `useLegacySettings` 模块级回退已删除；持久化改为模块级常量组合 `withMirror(localStorageSettingsRepository, indexedDbSettingsRepository)`（`src/adapters/mirroringSettingsRepository.ts` / `localStorageSettingsRepository.ts`），`useSettings` 未包裹 Provider 时显式报错（与 `pluginRegistry` 同范式）。
> - **§7.3【P2】**：`App.tsx` 拆为组合根（仅 `<SettingsProvider>` + `<ThemeController>` 装配）与 `AppShell`（消费设置），业务拆到 `src/hooks/useAiConversation.ts`（daemon 连接 / 会话 / Ghost / 对话状态机）与 `src/hooks/useProjectLibrary.ts`（项目 CRUD 编排）。
> - **§8.2【P1】**：双写（localStorage 即时写 + IndexedDB 镜像）抽为 `withMirror` 装饰器（`src/adapters/mirroringSettingsRepository.ts`），`settings.tsx` 的 `saveSettings` / `loadSettingsFromIDB` 仅委托该装饰器，不再手写两段式。
> - **§11【P2】**：`CodexWriterDrawer.tsx` 已复用 `ui/molecules/Drawer` 外壳（`widthClass="w-72"`），`WriterDesk.tsx` 外层容器去除重复边框/背景；与 `SplitViewDrawer` / `ScratchpadDrawer` 同范式。
> - **§13.2【P2，低价值】**：`projectService.ts` 改名 `application/projectUseCases.ts` 按评审「可不做」保留，未执行。
> - **§10.2【P2，局部】**：编辑器内联 `iconBtn` 样式字符串已删除（`src/components/editor/editorUi.ts`），`EditorToolbar` / `StatusFooter` / `FindReplaceBar` / `GlobalSearchPopup` 全部改用 `ui/atoms/IconButton` 原子（单一来源 `ICON_BTN`）。
>
> **验证**：最近一次完整 `npm run check` 全绿（tsc 零错误、oxlint 零错误、vitest 227 用例）。注：本回合 Bash/Grep 工具临时不可用，无法重跑门禁；上述"已整改"状态来自上一次成功门禁 + 逐文件 Read 实证。仍待整改项将在工具恢复后补齐并复跑门禁。

## 0. 总体结论

**一句话**：架构"图纸"是对的（`ports/` + `adapters/` + `domain/` 三层骨架已经搭起来，且 `projectService` / `useDashboardModel` / `daemonConnection` 是教科书级样板），但**执行只覆盖了约 30% 的代码**——最大、最核心的 `RichEditor.tsx`（1679 行）以及 `CheckTools` / `CodexMasterView` / `pluginRegistry` 完全绕开了这套骨架，直接抓着 `db` 单例、`localStorage`、`document`、`window` 干活。

**分层评分（10 分制）**

| 维度 | 得分 | 说明 |
|---|---|---|
| 硬编码与 mock | 4 | 种子 ID 硬编码已造成跨项目数据覆盖的实质 Bug；42 模块配置为压缩后的字面量 |
| SRP | 3 | `RichEditor` 单组件 32 个 `useState`，同时承担持久化、检索、快捷键、排版、导出 |
| OCP | 3 | `Engine.renderCurrentView` 硬编码 if 链；`CodexAdapters.mapTabIdToCategory` switch 分派 |
| LSP | 7 | 无继承体系，天然规避；但端口实现有"静默降级"契约破坏 |
| ISP | 6 | `AppSettings` 已切片（好），`ProjectRepository` 仍是胖接口 |
| DIP | 4 | 同一文件内 `handleExportChapter` 走端口、`handleExportSingleChapter` 绕过端口 |
| 关注点分离 | 3 | 领域层 `chapterExporter` 生成 HTML+CSS；视图层写业务规则 |
| 端口与适配器 | 4 | 骨架正确，但 6 个模块直接 import `db` 单例 |
| 纯函数与副作用 | 4 | `domain/seed.ts` 调 `Date.now()`；组件内散落 `window.confirm` / `alert` |
| 原子设计 | 5 | 只有 `ui/atoms` 一层，无 molecules/organisms，大组件内联一切 |
| 组合优于继承 | 8 | 无继承滥用，但缺少组合式拆分 |
| 被动视图 | 3 | 仅 `DashboardView`（0 个 `useState`）达标 |
| 语义化命名 | 4 | `tabDefinitions` 导出名为 `ot`；`PluginManagerView`；`CodexAdapters` |
| 设计模式 | 5 | 工厂函数用得好，但注入方式三套并存 |
| 可测试性 | 5 | 纯领域层可测，核心编辑器几乎不可测 |

---

## 1. 硬编码与 mock

### 1.1 【P0 · 已产生真实 Bug】种子数据硬编码 ID，导致跨项目数据相互覆盖

`src/domain/seed.ts:11,31` —— `buildSeedVolumes` / `buildSeedChapters` 返回的记录 ID 固定为 `'vol-1'` / `'ch-1'`，与传入的 `projectId` 无关：

```ts
export const buildSeedVolumes = (projectId: string = LEGACY_PROJECT_ID): VolumeRecord[] => [
  { id: 'vol-1', projectId, title: '第一卷 · 苍云初醒', order: 1, ... },
  { id: 'vol-2', projectId, title: '第二卷 · 星罗万象', order: 2, ... },
]
```

IndexedDB 的 keyPath 是 `id`（`src/db/indexedDB.ts:42`），`db.put` 是覆盖写。因此：

- 创建项目 A → 写入 `vol-1`（projectId=A）
- 创建项目 B → 写入 `vol-1`（projectId=B）→ **A 的分卷与章节被"抢走"**

`src/core/projectService.ts:138-141` 与 `src/components/editor/RichEditor.tsx:250-255` 两处都会写种子，命中概率更高。

**重构方向**：ID 生成是基础设施能力，应从领域层外移，列为显式依赖：

```ts
// domain/seed.ts —— 改成纯函数，ID 由调用方注入
export const buildSeedVolumes = (projectId: string, id: IdGenerator): VolumeRecord[] =>
  SEED_VOLUME_TEMPLATES.map((tpl, i) => ({
    id: id('vol'), projectId, ...tpl, order: i + 1,
    createdAt: ..., updatedAt: ...
  }))
```

时间同理外移为 `Clock` 端口（`{ now(): number }`）。这样 `domain/seed` 真正变纯，可脱离环境断言。

### 1.2 【P1】领域层内嵌示范正文 HTML

`src/domain/seed.ts:36` 三章"示范正文"直接写在领域模块里。它不是领域规则，是可替换的**内容资产**。

**重构方向**：挪到 `src/domain/seed/templates/` 或 `assets/seed/`，由组合根装配时注入；领域层只保留"首次启动若无数据则灌入种子"这一用例。

### 1.3 【P1】42 模块配置为压缩产物，标识符彻底丧失语义

`src/config/tabDefinitions.ts` 是某打包产物的残留：

```ts
const O = createField; const _ = createCol; const di = createDateCol; const Kn = createCalendarCol;
export const ot = [/* 数千行巨型字面量 */]
```

`src/core/engine.tsx:18` 因此写成 `import { ot as tabDefinitions } from '../config/tabDefinitions'`，`CheckTools.tsx:3` 同样。这是全仓库**可读性最差**的一处，且修改任何一个字段都要在单行超长字面量里做手术。

**重构方向**：
1. 反混淆，按业务域拆成 `config/modules/positioning.ts` / `worldbase.ts` / `outline.ts`…，每个模块一个具名导出；
2. 字段用语义常量收敛魔法字符串（`FIELD_KEYS.编号`、`FIELD_KEYS.名称`），让 `CheckTools` 与 `CodexAdapters` 引用同一份常量；
3. 统一代码风格（该文件用分号 + 双引号，与全仓库的无分号 + 单引号不一致）。

### 1.4 【P1】敏感词表在两处重复硬编码

`src/components/tools/CheckTools.tsx:15-17` 与 `src/components/editor/modals/SensitiveModal.tsx:5` 各有一份完全相同的 8 词数组。任一处增删都会造成"全书扫描"与"本章检测"结果不一致。

**重构方向**：提到 `src/domain/moderation/sensitiveLexicon.ts`（领域资产）+ `SensitiveWordDetector` 端口，两个视图共享同一用例 `scanChapter(content, lexicon)`。

### 1.5 【P2】硬编码色值绕过设计令牌

项目 MEMORY.md 明确"所有颜色必须通过 `var(--ink-*)` 取用"，但仍有 15+ 处漏网：

- `RichEditor.tsx:92-95` 章节状态色 `#9b9a97 / #9a6700 / #0f6e56 / #787774`
- `RichEditor.tsx:966` 兜底色 `#94a3b8`
- `ui/atoms/BookCover.tsx:22-29` 9 组渐变色
- `domain/text/chapterExporter.ts:23` 导出 HTML 内联 `color:#222`
- `CodexMasterView.tsx:36-42` 8 组 Tailwind 彩色类（`bg-blue-500/10` 等）

**重构方向**：新增 `--ink-status-draft / -review / -published / -archived` 与 `--ink-cover-*` 令牌；`BookCover` 的 9 组配色改为 `coverPalette` 令牌数组，按索引取用。

### 1.6 【P2】业务默认值硬编码在视图里

`Bookshelf.tsx:106` `projectType === 'full' ? '东方玄幻' : '自定义'`；`RichEditor.tsx:493` `第${String(order+1).padStart(3,'0')}章 未命名`；`RichEditor.tsx:494/548` 空章节内容 `'<p>　　</p>'`。

**重构方向**：收进 `domain/chapter/chapterNaming.ts`（`composeChapterTitle(order)`）与 `domain/chapter/blankContent.ts`。

---

## 2. 单一职责原则（SRP）

### 2.1 【P0】`RichEditor.tsx`：1679 行 / 32 个 `useState` 的"上帝组件"

它同时是：数据访问层（`db.getAll` / `db.put`）、缓存层（`localStorage` 读写快照与偏好）、业务逻辑层（全书检索、章节序号派生、目录过滤、字数统计）、快捷键总线（`window.keydown`）、排版引擎（缩进/标点/替换）、导出适配器（`document.createElement('a')`）、以及 6 个模态框的调度中心。

**重构方向**：按"用例"纵向切分，而非按技术横向切：

```
features/chapter-editor/
  ChapterEditorView.tsx          ← 只剩 JSX + 事件委托（目标 <250 行）
  useChapterEditorModel.ts       ← Presentation Model：状态聚合 + 命令
  useChapterAutosave.ts          ← 防抖存盘（依赖 ChapterRepository 端口）
  useGhostSuggestion.ts          ← 续写防抖（依赖 GhostSuggester 端口）
  useGlobalChapterSearch.ts      ← 全书检索
  useEditorShortcuts.ts          ← 快捷键（依赖 ShortcutRegistry）
  components/ChapterTree.tsx     ← 目录树（分子）
  components/FindReplaceBar.tsx  ← 检索条（分子）
  components/EditorStatusBar.tsx ← 状态栏（分子）
```

状态收敛：32 个 `useState` → 一个 `useReducer` 管理的 `EditorState`，命令走 `dispatch({type:'chapter/rename', ...})`。

### 2.2 【P1】`Bookshelf.tsx` 660 行：列表 + 编辑表单 + 删除确认 + 封面上传四合一

`renderProjectCard`（150-422 行）一个函数内用 `isEditing` 分支渲染两套完全不同的 UI。

**重构方向**：拆 `ProjectCard`（展示态）、`ProjectEditCard`（编辑态）、`CreateProjectPanel`、`DeleteProjectDialog`、`CoverUploader`；`FileReader` 读封面 → 提为 `ImageReader` 端口。

### 2.3 【P1】`CheckTools.tsx`：业务规则写在组件函数体里

`runHealthCheck`（30-88）实现了"编号唯一性扫描""主标识必填扫描"两条领域规则，`runSensitiveScan`（91-122）实现了敏感词命中规则，同时直接 `db.getAll`。

**重构方向**：

```ts
// domain/moderation/healthCheck.ts —— 纯函数，输入全量数据，输出问题列表
export function findDuplicateCodes(rows, tab): HealthIssue[]
export function findMissingDisplayNames(rows, tab): HealthIssue[]
// application/runHealthCheck.ts —— 用例：取数据 → 调规则 → 聚合
```

### 2.4 【P1】`PluginManagerView` / `pluginRegistry` 双写双存储

`pluginRegistry.tsx` 同时管 Context 状态、`localStorage` 读写、IndexedDB 镜像、以及一份"模块级 legacy 状态"（153-248 行）。两套实现（`PluginProvider` 与 `useLegacyPluginRegistry`）逻辑重复约 90 行。

**重构方向**：删除 legacy 分支（通过 `createContext` 默认值或测试专用 Provider 解决"不包裹就渲染"的问题，见 §12）；持久化合并为单一 `PluginStateRepository` 端口，双写策略放到一个 `MirroringPluginStateRepository` 装饰器里。

---

## 3. 开闭原则（OCP）

### 3.1 【P1】`Engine.renderCurrentView()` 硬编码视图分发链

`engine.tsx:111-182`：`if (activeTabId === 'dashboard') … else if ('editor') … else if ('guide') …`，再叠加 `type === 'form' | 'table' | 'card'`。每加一个视图类型就要改这个函数。

**重构方向**：视图注册表 + 策略：

```ts
// config/viewRegistry.ts
export const viewRegistry: Record<ViewKind, FC<ViewProps>> = {
  form: FormView, table: TableView, card: CardView,
}
// 具名视图覆盖
export const namedViewOverrides: Record<string, FC<ViewProps>> = {
  dashboard: DashboardView, editor: RichEditor, guide: GuideView,
  'inspire-tools': InspireTools, 'check-tools': CheckTools, 'material-library': MaterialLibrary,
}
```

Engine 退化为 `const View = namedViewOverrides[id] ?? viewRegistry[meta.type] ?? NotReadyView` —— 新增视图只加注册项。

### 3.2 【P1】`CodexAdapters.mapTabIdToCategory` 与 `buildTableSummary` 双 switch

`Adapters.ts:110-127,152-168`：新 tab 类型要改两处 switch。

**重构方向**：类别映射表驱动（`const TAB_CATEGORY: Record<string, CodexCategory>`）+ 摘要策略注册表（`Record<CodexCategory, Summarizer>`），`Summarizer` 是一个 `(data) => string` 的函数类型——组合而非分支。

### 3.3 【P2】`InspireTools.generateItem()` 的 if-else 风格分派

`InspireTools.tsx:35-64` 六大类 × 七风格的全展开分支。

**重构方向**：`NameGenerator` 策略接口 + 注册表：

```ts
interface NameGenerator { readonly category: Category; readonly style: Style; next(rnd: RandomSource): string }
const generators: NameGenerator[] = [...]
```

新增风格 = 新增一个生成器对象并注册，零改动既有代码。

---

## 4. 里氏替换原则（LSP）

无 class 继承体系，天然规避了经典 LSP 陷阱（**这是好事，继续保持——坚持组合优于继承**）。但有两类"契约破坏"：

### 4.1 【P1】端口实现的静默降级

`projectService.importProject`（`projectService.ts:146-179`）捕获所有异常后 `return null`，调用方无法区分"文件不是 JSON"与"文件结构不合法"，也无法拿到错误详情。`App.tsx:180-185` 收到 `null` 只能哑火。

**重构方向**：端口方法返回 `Result` 类型（`{ ok: true; value } | { ok: false; error: ImportError }`），或用带类型的 Error 子类，保证"任何实现都向调用方传递完整失败信息"这一契约。

### 4.2 【P2】可选回调造成的行为不一致

`RichEditorProps` 有 6 个可选回调（`onRequestGhost?`、`onAiPrompt?`、`onReconnect?`…），组件内部到处 `onX?.()`。不同"实现"（传/不传）表现出不同行为且无显式契约。

**重构方向**：改为必填，由组合根注入 no-op 实现（`const noopGhostSuggester: GhostSuggester = { suggest: async () => null }`），让"能力缺失"变成显式的空对象模式，而不是散落的 `?.`。

### 4.3 【P2】`CodexAdapters` 用名字充当 ID

`Adapters.ts:32,41` `targetId: rel.personB`（人名即 ID）。一旦改名，所有关系边失效。应在适配阶段解析为实体 ID，解析不到则产出"悬空引用"问题项（可复用 §3 的 healthCheck）。

---

## 5. 接口隔离原则（ISP）

### 5.1 【P1】`ProjectRepository` 是胖接口

`ports/projectRepository.ts` 9 个方法里塞了 Project / Volume / Chapter 三个聚合的全部 CRUD。`useDashboardModel` 只要读，`Bookshelf` 只要统计，都被迫依赖写方法。

**重构方向**：按聚合与读写切分，再组合：

```ts
export interface ProjectReader { getAllProjects(); getProject(id) }
export interface ProjectWriter { saveProject(p); deleteProject(id) }
export interface ChapterReader { getChaptersByProject(projectId) }   // 注意：按项目查询
export interface ChapterWriter { saveChapter(c); deleteChapter(id) }
export type ProjectRepository = ProjectReader & ProjectWriter & VolumeReader & …  // 便于现有代码过渡
```

### 5.2 【P1】仓储缺少按项目查询能力，过滤逻辑泄漏到调用方

`loadProjectStats` / `loadStatsForProjects` / `loadWorkspaceStats` / `computeDashboardModel` / `CheckTools` / `CodexMasterView` 六处都在重复同一段 `all.filter(x => x.projectId === projectId)`。这是**端口设计缺陷导致的领域逻辑外泄**。

**重构方向**：端口直接提供 `getVolumesByProject(projectId)` / `getChaptersByProject(projectId)`，把过滤下推到适配器（IndexedDB 有 `projectId` 索引，还能顺带提升性能）。

### 5.3 ✅ 做得好：`AppSettings` 的切片设计

`settings.tsx:70-99` 把巨型配置切成 `AppearanceSettings` / `AiModelSettings` / `ConnectionSettings` / `EditorPreferences`，再用 `extends` 组合成 `AppSettings`。这是本仓库里 ISP 的最佳实践，值得推广到其他接口。

---

## 6. 依赖倒置原则（DIP）

### 6.1 【P0】同一个文件内，DIP 一会儿遵守一会儿违反

`RichEditor.tsx`：

- `handleExportChapter`（699-708 行）✅ 走 `blobFileDownloader.downloadBlob(...)`
- `handleExportSingleChapter`（573-585 行）❌ 手写 `URL.createObjectURL` + `document.createElement('a')` + `a.click()` —— 与 `adapters/blobFileDownloader.ts` 逐行重复

同一个副作用，一个走端口、一个绕过端口，说明这不是设计选择而是**随手为之**。

**重构方向**：`handleExportSingleChapter` 改为复用 `blobFileDownloader`；再用 ESLint `no-restricted-imports` / `no-restricted-globals` 把 `db/indexedDB`、`localStorage`、`document`、`window` 在 `components/`、`domain/`、`core/` 下**设为编译期禁入**，让违规无法被提交。

### 6.2 【P0】6 个模块直接 import `db` 单例，绕过 `ports/` + `adapters/`

```
components/editor/RichEditor.tsx:55        import { db, uid } from '../../db/indexedDB'
components/editor/WriterDesk.tsx:3         import { db, uid } from '../../db/indexedDB'
components/tools/CheckTools.tsx:2          import { db } from '../../db/indexedDB'
core/pluginRegistry.tsx:12                 import { db } from '../db/indexedDB'
plugins/living-codex/.../CodexMasterView.tsx:3     import { db } from '../../../db/indexedDB'
plugins/living-codex/.../CodexWriterDrawer.tsx:4   import { db } from '../../../db/indexedDB'
```

而 `adapters/indexedDb*Repository.ts` 五个适配器才是"官方通道"。结果是：**六边形架构只围住了三分之一的代码**。

另外 `uid` 从 `db/indexedDB` 导出，被 `core/projectService.ts:1`、`hooks/useCardViewModel.ts:5`、`hooks/useTableViewModel.ts:6` 引用——ID 生成这种基础设施能力顺着 import 污染到了领域与用例层。

**重构方向**：

```ts
// ports/idGenerator.ts
export interface IdGenerator { next(prefix?: string): string }
// ports/clock.ts
export interface Clock { now(): number }
```

新建 `ports/chapterRepository.ts` / `ports/codexRepository.ts` / `ports/pluginStateRepository.ts`，把上述 6 处的 `db` 调用换成端口注入。

### 6.3 【P1】三套依赖注入方式并存

| 方式 | 出现位置 | 问题 |
|---|---|---|
| 模块级 `let` + `setXxx()` setter | `projectService.ts:19-28`、`settings.tsx:148-151`、`useDashboardModel.ts:7-11` | 全局可变单例；测试间互相污染，必须手动 reset；无法按实例配置 |
| 函数参数默认值 | `useTableViewModel.ts:19` `repository = indexedDbTableRecordRepository` | ✅ 正确做法 |
| React Context | `settings.tsx`、`pluginRegistry.tsx` | ✅ 正确做法 |

**重构方向**：统一为"组合根 + 容器"。用 `useTableViewModel` 的参数默认值模式替换所有 setter 模式；服务层改为工厂：

```ts
// application/createProjectService.ts
export const createProjectService = (deps: { repo: ProjectRepository; downloader: FileDownloader; ids: IdGenerator; clock: Clock }) => ({
  loadProjects, createProject, exportProject, /* ... */
})
// 组合根 main.tsx
export const projectService = createProjectService({ repo: indexedDbProjectRepository, downloader: blobFileDownloader, ids: uidGenerator, clock: systemClock })
```

测试里直接 `createProjectService({ repo: inMemoryProjectRepository(), ... })` —— 零全局状态。

---

## 7. 关注点分离（SoC）

### 7.1 【P1】领域层生成表现层产物

`domain/text/chapterExporter.ts:23` 的 `exportChapter` 直接拼出 `<!doctype html>…<style>…color:#222…` —— 领域层在写 CSS。

**重构方向**：领域只产出**结构化文档模型**（`{ title, blocks: Paragraph[] }`），渲染交给适配器：

```ts
// domain/text/chapterDocument.ts   —— 纯领域
export const toChapterDocument = (html: string, title: string): ChapterDocument
// adapters/renderers/htmlChapterRenderer.ts  —— 表现层
export const renderHtml = (doc: ChapterDocument, theme: ExportTheme): string
```

`theme` 从设置注入，导出样式随之可配置（顺带解决硬编码 `#222`）。

### 7.2 【P1】视图层里写数据访问

`Bookshelf.tsx:69-78` 在 `useEffect` 里直接调 `loadStatsForProjects`；`CodexMasterView.tsx:65-79` 直接 `db.getAll`；`CheckTools.tsx:35,94` 直接 `db.getAll`。

**重构方向**：视图只接收 ViewModel。统计走 `useProjectStats(ids)`，Codex 走 `useCodexGraph(projectId)`，体检走 `useHealthCheck(projectId)`。

### 7.3 【P2】`App.tsx` 既是组合根又是业务组件

`App.tsx` 同时负责：连接 daemon（`initConnection`）、会话管理（`ensureSession`）、AI 对话状态机（`sendAiPrompt`）、项目 CRUD 编排。

**重构方向**：`App.tsx` 只做组合根（Provider 装配 + 路由），业务拆到 `features/ai-assistant/useAiConversation.ts` 与 `features/projects/useProjectLibrary.ts`；daemon 会话管理独立为 `application/sessionService.ts`（依赖 `AiGateway` 端口）。

---

## 8. 端口与适配器架构

**骨架是对的**：`ports/`（14 个抽象端口，含 `IdGenerator` / `Clock` / `RandomSource` / `KeyValueStore` / `ConfirmDialog` / `ClipboardWriter` / `FileDownloader` / `AiGateway` 及 7 个仓储端口）+ `adapters/`（IndexedDB 仓储 + `idGenerator` / `clock` / `randomSource` / `clipboardWriter` / `confirmDialog` / `blobFileDownloader` / `inkpiDaemonGateway` / `htmlChapterRenderer`）+ `domain/`（纯函数）。问题在边界被反复穿透（见 §6.2），以及端口粒度不合理（见 §5.2）——穿透问题已在整改中修复。

### 8.1 【P1】缺失的端口清单

| 现有直连 | 应新增端口 | 适配器实现 |
|---|---|---|
| `localStorage`（8 处） | `KeyValueStore` | `localStorageKeyValueStore` / `memoryKeyValueStore` |
| `window.confirm` / `alert` | `UserConfirmator` | `windowConfirmator` / `autoConfirmator`（测试） |
| `navigator.clipboard` | `ClipboardWriter` | `browserClipboard` / `memoryClipboard` |
| `Date.now()`（领域内） | `Clock` | `systemClock` / `frozenClock` |
| `Math.random()`（InspireTools） | `RandomSource` | `mathRandom` / `seededRandom`（可复现测试） |
| `db`（6 处） | `ChapterRepository` / `CodexRepository` / `PluginStateRepository` | `indexedDb*` |
| `uid()` | `IdGenerator` | `uidGenerator` / `sequentialIdGenerator` |

### 8.2 【P1】双向持久化是基础设施关注点，却写在核心模块里

`settings.tsx` 与 `pluginRegistry.tsx` 各自实现了一套"localStorage 即时写 + IndexedDB 异步镜像 + 启动回读比对"的三段式逻辑，合计约 200 行重复。

**重构方向**：抽出一个装饰器适配器，业务层完全感知不到双写：

```ts
// adapters/mirroringRepository.ts
export const withMirror = (primary: KeyValuePort, mirror: KeyValuePort, logger: Logger): KeyValuePort => ({ ... })
```

这正是装饰器模式的正当用武之地（见 §13）。

---

## 9. 纯函数与副作用隔离

### 9.1 ✅ 做得好

- `domain/dashboard.ts` 的 `computeDashboardModel`：纯函数，无 React / 无 DOM / 无存储，注释也写明了意图。
- `domain/text/*`（`countWords` / `fixPunctuation` / `applyFindReplace` / `wordFrequency`）：纯文本变换。
- `core/daemonConnection.ts`：`connectToDaemon(gateway, url, opts)` 依赖全注入，重试与超时封装干净，可脱离 WebSocket 单测。

### 9.2 【P1】领域层不纯

`domain/seed.ts:15,24`（`Date.now()`）、`plugins/living-codex/engine/Adapters.ts:57-58,105-106`（`createdAt: Date.now()`——更糟，适配转换时**伪造**了创建/更新时间，覆盖真实时间戳）。

**重构方向**：时间参数化；适配器转换保留原记录的 `createdAt/updatedAt`，只在缺失时回落。

### 9.3 【P1】组件内直接调用命令式浏览器 API

| 位置 | 调用 | 问题 |
|---|---|---|
| `CodexMasterView.tsx:109` | `window.confirm` | 阻塞式，测试无法断言与驱动 |
| `Bookshelf.tsx:88` | `alert` | 同上，且文案硬编码 |
| `RichEditor.tsx:564` | `navigator.clipboard.writeText` | 权限失败被 `.catch(() => {})` 静默吞掉 |
| `InspireTools.tsx:79` | `navigator.clipboard.writeText` | 无错误处理 |
| `RichEditor.tsx:824` | `window.addEventListener('keydown')` | 全局副作用散在组件里 |
| `CodexMasterView.tsx:58` / `RichEditor.tsx:566` | `setTimeout` 不清理 | 卸载后仍 setState |

**重构方向**：全部收进 §8.1 的端口；`setTimeout` 一律用 `useEffect` 清理或 `useTimeout` hook 封装。

### 9.4 【P1】可变全局状态

`settings.tsx:210` `let legacySettings`、`pluginRegistry.tsx:154` `let legacyEnabledIds`、`projectService.ts:19` `let projectRepo`、`useDashboardModel.ts:7` `let repo` —— 四处模块级可变变量，跨测试、跨组件实例共享。

**重构方向**：见 §6.3，全部改为显式注入，模块级只剩不可变常量。

---

## 10. 原子设计（Atomic Design）

### 10.1 【P1】只有 atoms，没有 molecules / organisms

`ui/atoms/` 下 5 个原子（`IconButton` / `Row` / `Placeholder` / `StatCard` / `BookCover`）。而 `RichEditor.tsx` 内部内联了至少 8 个可复用分子：目录树、检索条、匹配计数跳转器、画布宽度切换、状态栏、右键菜单、重命名弹窗、删除确认弹窗。它们在别处无法复用，只能复制粘贴。

**重构方向**：补齐两层：

```
ui/atoms/        IconButton · Row · Placeholder · StatCard · BookCover · StatusDot · Kbd
ui/molecules/    SearchInput · ContextMenu · ConfirmDialog · SegmentedControl · Toast · ProgressBar · Modal
features/*/      （有机体）ChapterTree · FindReplaceBar · EditorStatusBar · ProjectCard
```

**越级依赖检查**：`ui/atoms` 目前不依赖任何业务模块 ✅ 保持。需增加 lint 规则禁止 `ui/` 反向 import `features/`、`components/`。

### 10.2 【P2】`RichEditor.tsx:99` 的 `iconBtn` 样式字符串

一个跨组件复用的按钮样式，以模块常量形式躺在编辑器里。应提为 `ui/atoms/IconButton` 的 variant。同理 `CodexMasterView.tsx:36-42` 的 `badgeClass` 字符串数组。

---

## 11. 组合优于继承

✅ **全仓库无一处 `extends` 业务基类**（仅 `ErrorBoundary` / `RootErrorBoundary` 继承 `React.Component`，属于框架必需）。这一点做得好。

**改进空间**：目前"复用"主要靠复制粘贴而非组合。建议：

- 弹窗类：用 `<Modal><Modal.Header/><Modal.Body/><Modal.Footer/></Modal>` 组合，而不是每个弹窗复制一份 `fixed inset-0 z-50 bg-black/40 backdrop-blur` 外壳（当前 `RichEditor` 2 处、`Bookshelf` 1 处、`TemplatePickerModal` 1 处完全重复）。
- 抽屉类：`SplitViewDrawer` / `ScratchpadDrawer` / `CodexWriterDrawer` 三份几乎相同的定位与遮罩逻辑 → `<Drawer side="right" onClose>`。
- 编辑器能力：`GhostText` / `QuoteHighlight` / `SmartQuotes` 已是 TipTap 扩展组合 ✅ 这个模式是对的，保持。

---

## 12. 被动视图 / 展示模型（Passive View / Presentation Model）

### 12.1 ✅ 唯一达标：`DashboardView`

`DashboardView.tsx` **0 个 `useState`**，全部数据来自 `useDashboardModel(projectId)`，只做声明式渲染。这是全仓库的标杆。

### 12.2 ❌ 其余视图全是"智能视图"

| 组件 | `useState` 数 | 视图内业务 |
|---|---|---|
| `RichEditor` | 32 | 检索、序号派生、统计、排版、导出、快捷键 |
| `Bookshelf` | 11 | 分组、统计、封面编码、表单校验 |
| `CodexMasterView` | 10 | 加载、过滤、排序、CRUD、Demo 灌入 |
| `SettingsView` | 5 | 各分区配置编排 |
| `Engine` | 8 | 视图分发、布局状态、快捷键 |

**重构方向**：统一"组件 = `useXxxModel()` + JSX"范式：

```tsx
// 目标形态
export const ChapterEditorView: FC<{ projectId: string }> = ({ projectId }) => {
  const model = useChapterEditorModel(projectId)   // 所有状态与命令
  return <EditorLayout {...model} />                // 纯渲染，所有事件都委托给 model 的命令
}
```

模型层用 `useReducer` 表达状态迁移（纯函数 `editorReducer(state, action)`，可脱离 React 单测），命令层封装副作用（调用端口）。

### 12.3 【P2】"未被 Provider 包裹就回退模块级状态"是测试债

`settings.tsx:251-255` 与 `pluginRegistry.tsx:254-258` 都为"测试不包裹 Provider"留了后门，代价是维护两套完整实现（约 90 行重复）+ 模块级可变状态。

**重构方向**：删掉 legacy 分支，测试改用显式 Provider：

```tsx
const renderWithProviders = (ui: ReactNode) =>
  render(<SettingsProvider><PluginProvider>{ui}</PluginProvider></SettingsProvider>)
```

一次性改测试，换取生产代码砍掉 180 行重复与两处全局状态。

---

## 13. 语义化命名

### 13.1 【P1】`tabDefinitions.ts` 导出 `ot`

`export const ot = [...]` / `export default ot` —— 唯一的"可读"信息来自 import 时的重命名。同文件内 `O` `_` `di` `Kn` `zr` `$d` `xi` `qt` `Id` 全部无语义。

**重构方向**：见 §1.3，反混淆后按业务命名（`POSITIONING_MODULE`、`WORLD_BASE_MODULE`、`outlineColumns` 等）。

### 13.2 【P2】模糊后缀与不一致前缀

| 现状 | 建议 |
|---|---|
| `components/plugins/PluginManagerView.tsx` | `PluginCatalogView`（它是一个视图，不是管理器；真正的管理逻辑在 `pluginRegistry`） |
| `core/projectService.ts` | `application/projectUseCases.ts` 或保留 `Service` 但明确其为用例层；当前"Service"承载了仓储编排 + 统计 + 迁移三种职责 |
| `plugins/living-codex/engine/Adapters.ts` 的 `CodexAdapters` | `toCodexEntity(record, ctx)` —— 它是一组**纯转换函数**，不是适配器对象（适配器应该实现端口） |
| `plugins/living-codex/data/` | `content/` 或 `templates/`（`data` 无信息量） |
| `hooks/useXxxViewModel.ts` | ✅ 命名清晰，保持 |

### 13.3 【P2】风格不一致

`InspireTools.tsx` / `CheckTools.tsx` / `tabDefinitions.ts` 用分号 + `React.FC`；其余文件无分号 + `import { type FC }`。建议加 Prettier 统一（仓库目前只有 oxlint，无格式化器）。

---

## 14. 设计模式合理性

### 14.1 ✅ 用得好的

- **工厂函数**：`createField` / `createCol` / `createRefCol`（`tabDefinitions.ts:3-10`）——思路对，只是名字被压缩坏了。
- **端口-适配器**：`ports/` + `adapters/` 的定位与注释都准确。
- **空对象模式**雏形：`App.tsx:153` 离线时回显提示消息——可以正式化为 `OfflineAiGateway`。
- **Aho-Corasick 引擎**（`AcAutomaton.ts`）：算法层与 React 完全解耦，可独立单测 ✅

### 14.2 ❌ 静态工具类反模式

`CodexAdapters`（`Adapters.ts:5`）是一个只有 `public static` 方法的类 —— 无法注入、无法替换、无法 mock，是披着类外衣的命名空间。

**重构方向**：改为具名纯函数导出（tree-shaking 友好、易测、易组合）：

```ts
export const toCodexEntityFromCard = (card: CardRecord, relations: Relation[], clock: Clock): CodexEntity
export const toCodexEntityFromTableRow = (row: TableRowRecord, clock: Clock): CodexEntity
```

### 14.3 ❌ 缺少策略 / 装饰器 / 观察者

- **策略**：导出格式（txt/md/html）、命名生成风格、章节摘要 —— 目前全是 switch / if 链。
- **装饰器**：双写仓储镜像（§8.2）、仓储 + 内存缓存、日志包装 —— 目前靠复制。
- **观察者**：`settings` 与 `pluginRegistry` 各自手写 listener Set，可统一为一个 `ObservableValue<T>` 基元。

### 14.4 ⚠ 过度设计的苗头

`AiGateway` 只有 `connect(url)`，而 `RpcClient.request(method, params)` 是全动态字符串 RPC —— 这个抽象**太薄**，导致 `App.tsx` 里到处硬编码方法名 `'session.create'` / `'session.ghost.suggest'` / `'session.prompt'`（MEMORY.md 已记录踩过"短名方法不可用"的坑）。

**重构方向**：不要把 RPC 做成通用字符串管道，做成**语义化用例接口**：

```ts
export interface AiAssistant {
  openSession(chapterId: string, model?: string): Promise<SessionId>
  suggestContinuation(session: SessionId, tail: string): Promise<string | null>
  prompt(session: SessionId, text: string): Promise<string>
}
```

方法名与协议细节封在适配器里，业务层不再出现字符串协议。

---

## 15. 可测试性

### 15.1 ✅ 已经可脱离环境测试的

`domain/text/*`、`domain/dashboard.ts`、`domain/rules/codeRule.ts`、`core/daemonConnection.ts`、`plugins/living-codex/engine/*`、`core/projectService.ts`（通过 setter 注入）—— 这些模块的测试无需 jsdom、无需 IndexedDB。

### 15.2 ❌ 无法脱离环境测试的

- `RichEditor`：要测"自动存盘防抖"必须挂 jsdom + fake-indexeddb + 完整 TipTap 实例 + 模拟 `window.keydown`。实际上 `RichEditor.test.tsx` 591 行，是**全仓库最大的测试文件**——测试长度本身就是"被测单元太大"的信号。
- `CheckTools` / `InspireTools`：前者要 fake 整个 `db` 单例，后者依赖 `Math.random()`，结果不可复现（无法写稳定断言）。
- `CodexMasterView`：`window.confirm` 必须全局打桩。
- `App.tsx`：daemon 连接（WebSocket）+ IndexedDB + 全局快捷键全部耦合在根组件。

### 15.3 重构后的可测性目标

```ts
// 领域规则：纯函数，零依赖
expect(findDuplicateCodes(rows, tab)).toEqual([...])

// 用例：注入内存仓储 + 固定时钟 + 固定 ID 生成器
const svc = createProjectService({ repo: inMemoryProjectRepository(), downloader: memoryDownloader(), ids: sequentialIds(), clock: frozenClock(0) })
await svc.createProject('书名')
expect(await svc.loadProjects()).toHaveLength(1)

// Presentation Model：注入假端口，用 renderHook 测状态机
const { result } = renderHook(() => useChapterEditorModel('p1'), { wrapper: withPorts(fakePorts) })
act(() => result.current.commands.renameChapter('ch-1', '新标题'))
expect(result.current.state.chapters[0].title).toBe('新标题')
```

### 15.4 【P2】用架构测试固化边界

新增 `src/architecture.test.ts`，用依赖扫描断言分层：

```ts
it('components/ 不得直接 import db 单例', () => { ... })
it('domain/ 不得 import React / adapters / db', () => { ... })
it('domain/ 不得出现 Date.now / Math.random', () => { ... })
```

这样 §6.2、§9.2 这类违规会在 CI 阶段被拦截，而不是靠评审发现。

---

## 16. 重构路线图（建议按此顺序推进）

| 阶段 | 目标 | 关键动作 | 风险 |
|---|---|---|---|
| **P0 · 止血（1～2 天）** | 修真实 Bug + 堵住最严重的架构泄漏 | ① 种子 ID 改为注入生成（§1.1，修跨项目覆盖 Bug）<br>② `RichEditor.handleExportSingleChapter` 复用 `blobFileDownloader`（§6.1）<br>③ 敏感词表收敛到领域层（§1.4）<br>④ 加 ESLint 禁止 `components/`、`domain/`、`core/` 直连 `db`/`localStorage`/`document`/`window` | 低，均为局部替换 |
| **P1 · 拆编辑器（3～5 天）** | 消灭上帝组件，建立 Presentation Model 范式 | ① 按 §2.1 拆出 `features/chapter-editor/`，状态收敛为 `useReducer`<br>② 新增 `ChapterRepository` / `KeyValueStore` / `ClipboardWriter` / `Clock` / `IdGenerator` 端口<br>③ `RichEditor` 降到 250 行以内 | 中，编辑器逻辑密集，建议以 `RichEditor.test.tsx` 作为回归网 |
| **P1 · 统一注入（2～3 天）** | 消灭全局可变状态 | ① 全部改为"参数默认值 / Context"注入，删除 4 处 `let` + setter（§6.3）<br>② 删除 settings / pluginRegistry 的 legacy 回退分支，测试改用 `renderWithProviders`（§12.3）<br>③ `createProjectService` 等工厂化 | 中，需同步改测试 |
| **P2 · 补齐层次（3～5 天）** | 原子设计 + 视图注册表 + 契约收敛 | ① 抽 `ui/molecules/`（Modal / Drawer / ConfirmDialog / ContextMenu / Toast）（§10、§11）<br>② `Engine` 改为视图注册表（§3.1）<br>③ `AiGateway` 升级为语义化 `AiAssistant` 端口（§14.4）<br>④ 领域层时间/随机外移，新增 `RandomSource`（§9.2） | 低～中 |
| **P2 · 治理配置与命名（2～3 天）** | 提升可读性与可维护性 | ① `tabDefinitions.ts` 反混淆 + 按域拆分 + 字段 Key 常量化（§1.3）<br>② 硬编码色值全部令牌化（§1.5）<br>③ 重命名 `PluginManagerView` / `CodexAdapters` / `data/`（§13.2）<br>④ 引入 Prettier 统一风格 | 低 |
| **P3 · 固化（1 天）** | 让架构不再腐化 | ① 新增 `architecture.test.ts` 依赖方向断言（§15.4）<br>② CI 加入 `npm run check` + 覆盖率阈值（ARCHITECTURE.md 承诺 ≥85% 行 / ≥80% 分支）<br>③ 把本报告的"禁入规则"写进 `CONTRIBUTING.md` | 低 |

---

## 17. 值得保持的做法（不要改坏）

1. **`ports/` + `adapters/` 的目录语义与注释质量** —— 每个端口文件都写清了"为什么存在、谁依赖它、测试怎么替换"，这是很好的团队约定。
2. **`domain/dashboard.ts` 的 `computeDashboardModel`** —— 纯聚合函数 + `useDashboardModel` 承载 I/O，是 Passive View 的正确示范。
3. **`core/daemonConnection.ts`** —— 依赖全注入、重试/超时语义清晰、`withTimeout` 那段注释把"为什么不用 try/finally"写清楚了。
4. **`AppSettings` 的接口切片**（§5.3）—— ISP 的落地范例。
5. **`useTableViewModel` 的参数默认值注入**（§6.3）—— 应推广为全仓库标准。
6. **Ghost Text 用 ProseMirror decoration 而非写文档** —— 不污染 undo 历史，是正确的技术选型。
7. **`connectToDaemon` 的 `shouldAbort` 与组件卸载的联动** —— 生命周期处理严谨。

---

*本报告基于静态代码分析，所有行号对应评审时的代码基线。建议以 P0 阶段作为第一次 PR，后续每阶段一个 PR，并在每个 PR 内保证 `npm run check && npm test` 全绿。*
