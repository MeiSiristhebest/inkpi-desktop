# Desktop 插件能力与 UI/UX 复核

日期：2026-11-01。对象：`inkpi-desktop` 当前工作树，而非仅 HEAD。复核前 GitButler 有 129 项既有未提交变更；该次基线复核不修改生产实现、不提交、不推送。此前 44 项加上新增的 5 项，当前目录与注册宇宙为 **49 个插件**。

## 2026-11-02 修复复核增补

以下状态是在上述 2026-11-01 基线上做的后续修复；原有发现描述和复现记录保留为历史证据。工作树仍含共享/未归属变更，本次未提交或推送。

| 基线项             | 当前状态                                                                                                                                                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R01 任务来源       | 已修复：通过显式 `PluginWorkflowSource` 区分工作区、手动文本、保存章节和编辑副本；选定章节先校验项目归属；工作区输入不再伪造 `documentId`。                                                          |
| R02 全书章序       | 已修复：历法、读者模拟与全文取样按卷序及卷内章序生成全书位置；未知位置保留未知，不参加冲突排序。                                                                                                     |
| R03 稿件导入       | 已修复书架入口：书架按已注册的 bookshelf action 展示导入，不再依赖离开项目后已消失的项目插件启用状态。回归测试覆盖 Provider 从项目范围切换到书架范围并打开导入对话框；未声称完成打包 WebView2 验收。 |
| R04 编辑副本       | 已修复：Reader Hook 保存 `sourceKind` 与基准修订，区分保存章、编辑副本和手动文本。                                                                                                                   |
| U01 主题           | 已修复所报主题表面：受影响页面通过 scoped `.plugin-workspace-page` 映射到 Desktop 语义 token；Gold Chapters 主操作也改用 accent token。                                                              |
| U02 表单层级       | 已补共享基线：受影响页面的无样式标题、原生输入/选择/文本域、焦点/禁用状态、主操作和数据分组使用统一 token 与层级；保留各插件自己的流程，没有批量改写全部原生按钮。未重跑浏览器截图验收。             |
| U03 可访问名称     | 已修复：历法页面 9 个数字输入均有可访问名称，组件测试逐项检查名称及数量。                                                                                                                            |
| 目录承诺           | 已收窄起名、势力、读者、战力和分镜的描述/标签；测试防止重新宣传无证据的读音分析、胜率、受众数量或九宫格。                                                                                            |
| C01/C02 能力有效性 | 未解决，也未通过虚构公式、真实模型调用或无作者盲评来宣称解决；仍需独立能力评估。                                                                                                                     |

本次实际验证：聚焦数据边界/导入/章序测试 **16 个文件、112 项通过**；聚焦 UI/主题/可访问名称/目录测试 **19 个文件、69 项通过**；`pnpm run typecheck` 通过；目标文件 Prettier 检查通过。目标 Oxlint 命令退出码为 0，但仍报告若干 hook/ref 警告。未运行全量 `pnpm check`、全套测试或完整 build；未做真实 Provider/模型质量评测、作者盲评、打包 WebView2、原生 IME/DPI/屏幕阅读器或长时规模验证。

## 结论

此前优化有效，但还不能认定这些插件已成为成熟的写作辅助系统。现状可分为：

1. 已有明确计算意义的工具：固定年历法换算、网格最短耗时路线、作者资源预算扣减、作者标注的二次曲线拟合等。
2. 作者记录与约束复核器：战力、势力关系、伏笔等更谨慎了，但登记、统计和核对不等于自动推演剧情。
3. 创作模板与可选 AI 审阅：脑暴、读者解读、分镜、分支等仍存在明显能力上限；精确引用和绿色合同测试不能证明建议有用或语义正确。

**没有把旧问题重新当作新发现**：当前本地战力引擎不再由等级生成物理能量或胜率；读者插件不再生成固定好评、点赞及质量分；黄金三章已撤下任意加权质量分。不得用新增公式或恢复旧分数作为下一轮优化方向。

## 范围与验证

- 对全部 49 个插件做目录、注册、Runtime 边界、测试入口和 UI 结构扫描；重点阅读共享 AI 路径、时间/来源边界及定量和创作类引擎。
- 实际 Edge/Vite 检查 **19 个可通过 canvas 命令进入的插件主视图**，分别使用 1440×900、900×900，羊皮纸主题；另检查默认主题及稿件导入的完整入口路径。Water Meter 的命令声明为 drawer-only，未把其他页面误算成它的主视图。
- 这些主要是空/低数据量合成作品的渲染检查，不是 49 个插件的完整功能验收。本次可见控件测量没有发现超出视口的候选，页面错误事件为 0；不能据此排除有长结果、大数据或其他主题时的布局问题。
- 43 个既有 `*Reliability.test.ts` 加 6 个共享边界/生命周期套件：**49 个测试文件、266 项通过**。
- 另运行 4 个临时合成复现，分别确认任务来源错配、跨卷历法假冲突、修改副本仍沿用原修订、脑暴模板固定。**4/4 通过表示复现成立，不表示缺陷已修复。**临时测试已移出 `src/test`，未改变原有测试断言。
- 浏览器使用独立、非持久化会话；只创建合成作品，WebSocket 被阻断，未请求 Runtime/Provider，未读取作者作品。
- 未运行真实模型质量评测、作者盲评、Tauri/WebView2、原生 IME/DPI/读屏、长期规模测试；本轮未重跑全量 check/build。

## 一、已复现的功能与工程问题

### R01 · P1：插件选择的章节与任务来源可以不一致

证据：[`pluginHostContext.tsx:137–160`](../../src/core/pluginHostContext.tsx#L137)、[`pluginTasks.ts:28–44`](../../src/ai/tasks/pluginTasks.ts#L28)。

共享宿主把 `resolvedActiveChapter` 固定写入任务 scope、input.documentId 和默认 provenance。带章节选择器的插件虽可在 payload 中选择另一章，却不能通过该接口改变任务来源。

合成复现：最后编辑 A 章，审阅输入明确选择 B 章；实际构造的 scope.document.id 和 outcome.provenance.documentId 都是 A。结果中心的来源/修订及过期判定可能因此关联错对象。这里只证明 Desktop 构造层，不声称抓取了最终 Provider 请求。

建议：显式传入被审阅的章节/多章/手动副本范围；宿主核验项目身份，不从最后编辑章推断所有插件的来源。增加 A→B 选择、全书输入、手动副本及来源修订改变的回归。

### R02 · P1：多历法仍把卷内 order 当作全书顺序

证据：[`MultiCalendarMasterView.tsx:84`](../../src/plugins/multi-calendar/components/MultiCalendarMasterView.tsx#L84)、[`:219`](../../src/plugins/multi-calendar/components/MultiCalendarMasterView.tsx#L219)、[`MultiCalendarEngine.ts:140–145`](../../src/plugins/multi-calendar/engine/MultiCalendarEngine.ts#L140)。

面板仅按 `chapter.order` 排序，事件也保存该卷内数字；引擎按事件的 chapterOrder 检查主线时间。

合成复现：卷一第 2 章为第 20 天，卷二第 1 章为第 30 天。真实顺序没有倒退，现有数字却把第二卷事件排到前面，产生 1 处时间冲突；按现有 `projectChapterSequence` 投影后为 0 处。

同类未统一点：[`WaterMeterMasterView.tsx:29–55`](../../src/plugins/water-meter/components/WaterMeterMasterView.tsx#L29) 的全书拼接和 [`ReaderSimulatorMasterView.tsx:35`](../../src/plugins/reader-simulator/components/ReaderSimulatorMasterView.tsx#L35) 的章序仍只看卷内 order。它们不能都照搬多历法的严重程度，但确有跨卷顺序/标号风险。

建议：统一按卷序＋卷内章序生成阅读位置；旧事件根据 chapterId 重新投影，无法定位的保留未知，不静默伪造位置。覆盖跨卷、插章、移章和重排。

### R03 · P1：新插件化后的稿件导入入口断路

证据：[`App.tsx:215`](../../src/App.tsx#L215)、[`pluginExtensionSlots.tsx:12`](../../src/core/pluginExtensionSlots.tsx#L12)、[`ManuscriptImportMasterView.tsx:13–24`](../../src/plugins/manuscript-import/components/ManuscriptImportMasterView.tsx#L13)。

在作品内启用稿件导入，主视图要求“返回作品库并导入”；返回后 `PluginProvider` 从作品范围切换到全局范围，书架按全局 activePlugins 渲染。新插件默认关闭，而书架没有全局插件管理入口。

实际浏览器复现：作品内开关为 true → 命令打开稿件导入 → 点击返回作品库并导入 → **“导入稿件”按钮数量为 0**。

这是刚完成插件化带入的回归，不是用户没有启用插件。建议明确作品库扩展的启用所有者，或让作品内入口真正承载导入动作；不能只保留一张指路卡。补 App 级启用—返回—导入集成测试，单独渲染 Bookshelf 的回退路径不能代替该验证。

### R04 · P2：章尾编辑副本与保存版本未区分

证据：[`ReaderHookMasterView.tsx:83–86`](../../src/plugins/reader-hook/components/ReaderHookMasterView.tsx#L83)、[`:124`](../../src/plugins/reader-hook/components/ReaderHookMasterView.tsx#L124)。

载入某章后允许任意修改审阅文本，但保存时仍写该章原 revision，记录没有 `sourceKind` 或副本标记。合成复现中，从未出现在修订 7 的文本仍归档为该章 sourceRevision=7。

没有发现它自动改写正文；问题是后续不能区分“修订 7 的原文证据”和“基于修订 7 编辑的副本”。可参考 Shadow Reader 现有的 saved-chapter/edited-copy 区分，保留基准修订但不要将副本伪装为保存版本。

## 二、能力有效性仍有的差距

### C01 · P2：若干“推演/生成器”实质仍是模板或计划记录

这不是要恢复伪科学公式，也不把已声明的限制说成数据错误；它是相对用户期待的能力缺口。

| 插件     | 当前已核实的能力上限                                                                          | 下一步应验证的能力                                            |
| -------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 战力沙盘 | `auditResourceBudget` 做余额扣减；`auditPowerBreach` 汇总作者标记的约束和理由，不自行推导胜负 | 用有前提、范围、时序、成本的状态转移核验具体行动；未知仍弃答  |
| 脑暴     | `generateSolutions` 对所有问题返回同 8 个操作问题，资源与限制主要拼进文案                     | 备选方案要随问题改变，并逐条解释约束满足/违反、必要铺垫与代价 |
| What-If  | 继承分歧前文本，分歧后收录作者事件；缺事件时标记“尚未提供”                                    | 真正展开受约束的后果与替代分支，并区分事实、假设和未决依赖    |
| 分镜     | 按段落等距抽取至多 4 段，依次配固定的可选景别，不等于理解场景后进行镜头设计                   | 从事件、动作和视觉连续性决定镜头，而不是以第几段决定机位      |

脑暴合成复现：给出“没有第三方”的限制后，第三个选项依然询问第三方介入；两个完全不同问题的 8 个 operatorId 完全相同。这可作为创作提问卡，但不能称为已解决困境。

源码：[`CombatSandboxEngine.ts:17–70`](../../src/plugins/combat-sandbox/engine/CombatSandboxEngine.ts#L17)、[`BrainstormSparkEngine.ts:72–105`](../../src/plugins/brainstorm-spark/engine/BrainstormSparkEngine.ts#L72)、[`MultiverseEngine.ts:54–96`](../../src/plugins/multiverse-whatif/engine/MultiverseEngine.ts#L54)、[`StoryboardEngine.ts:33–80`](../../src/plugins/storyboard-gen/engine/StoryboardEngine.ts#L33)。

图像生成之前已明确暂缓；本报告没有把未接图像服务当成新缺陷。分支和分镜也已有单独 AI 审阅按钮，但那不能自动补足确定性构建器的能力。

### C02 · P2：引用合同和测试通过，仍不代表解释有效

[`validatePluginReview`](../../src/domain/pluginAnalysis.ts#L136) 明确只校验结构和引用，不判断模型解释真假；结果最终被整理为纯文本。引用准确只能说明“这句话存在”，不能证明它支持矛盾、因果或读者解读。

当前结果面板 [`PluginAiTaskPanel.tsx:136`](../../src/components/plugins/PluginAiTaskPanel.tsx#L136) 显示纯文本，没有逐条可点击的引用导航或领域化复核交互；活动中心入口不是这些细节的替代物。

建议：保留结构化发现与引用身份，支持回到正确保存版本核对；针对否定、转述、回忆、时间变化、角色不知情和明确无冲突样本，分别测误报、漏报和弃答。创作建议需作者盲评。不能用“精确引用通过率”冒充“逻辑正确率”，也不能用本轮 266 个本地测试给出模型准确率。

## 三、UI/UX 与 Desktop 不协调的具体原因

### U01 · P2：主题 token 迁移不完整，旧皮肤仍独立存在

实际羊皮纸主题里，Desktop 背景为 `#f9f5eb`，Combat、Geography、Memory Palace、Multi-Calendar、Reader Simulator 仍有蓝灰白底；Gold Chapters 的紫色保存按钮与固定深色结果卡也不跟随同一套语义颜色。

证据：[`CombatSandboxMasterView.tsx:283`](../../src/plugins/combat-sandbox/components/CombatSandboxMasterView.tsx#L283)、[`GoldChaptersMasterView.tsx:168–197`](../../src/plugins/gold-chapters-eval/components/GoldChaptersMasterView.tsx#L168)。插件生产源码另有 22 个文件引用未在 CSS 声明的 `--ink-bg-canvas`，浏览器该 token 的值为空；引用它的背景声明不能提供预期颜色。

不是所有强调色都应该消失；问题是画布、表面、边框和主操作没有共用 Desktop 的语义层级。

### U02 · P2：能力改造后的部分页面退化成无统一样式的表单

实测 Faction、Reader Hook、Scene Beats、Volume Master、Archetype、Author Ops、Storyboard、What-If 的 h2 为 13px/400，与普通文本缺乏层级。Faction 有 13/17 个控件没有 class；Author Ops 为 15/15，Storyboard 为 11/11。它们仍可操作，但按钮、输入、分组、间距、忙碌/禁用反馈未形成一致体验。

源头示例：[`FactionMatrixMasterView.tsx:181`](../../src/plugins/faction-matrix/components/FactionMatrixMasterView.tsx#L181)、[`ReaderHookMasterView.tsx:98`](../../src/plugins/reader-hook/components/ReaderHookMasterView.tsx#L98)、[`AuthorOpsMasterView.tsx:181`](../../src/plugins/author-ops/components/AuthorOpsMasterView.tsx#L181)。

AST 清点：插件生产 TSX 中有 348 个原生 button、0 个共享 Button/IconButton 调用。这个计数只是迁移覆盖率信号，不代表 348 个功能缺陷；实际截图才证明当前页面的层级和样式断裂。

建议：沿用现有 Button/Select/Modal 门面和 Desktop 的表单样式，按真实任务统一标题、范围、主操作、表单分组和结果区；不要把所有插件压成同一种 CRUD，也不要只加颜色、阴影或一套新的组件库。

### U03 · P2：历法的数字输入仍缺可访问名称

在两个视口的实际页面中，Playwright 的角色查询均找到 **8 个名称为空的 spinbutton**，涉及日期换算、新历法数值和事件日期。看得见“年/月/日”不等于名称已关联。

源码位置包括 [`MultiCalendarMasterView.tsx:378–420`](../../src/plugins/multi-calendar/components/MultiCalendarMasterView.tsx#L378)、[`:528–570`](../../src/plugins/multi-calendar/components/MultiCalendarMasterView.tsx#L528)、[`:657–697`](../../src/plugins/multi-calendar/components/MultiCalendarMasterView.tsx#L657)。现有 Select 命名改造没有覆盖这些原生 input。

建议使用稳定 label/id 关联，并明确“源日期年”“事件日期年”等用途；补键盘和可访问名称回归。

## 四、目录承诺没有随能力收窄同步

[`pluginDefinitions.ts`](../../src/core/pluginDefinitions.ts) 仍宣传：

- `:489` 战力的“越级胜率”，而当前引擎明确不能从等级计算胜率。
- `:335` 势力的“好感度五段演化”，而当前实现不按旧阈值判定追杀/结盟。
- `:421` 读者的“5 类受众”“阅读耐受度”，但 AI 输入是 4 个假设画像，本地也不测耐受度。
- `:724` 分镜“9 宫格”，而当前本地构建器最多返回 4 个抽样镜头。
- `:183` 起名“平仄声韵采样”，此前优化已明确没有可信自动读音依据；不能继续让用户误以为已有音韵评测。

这些描述直接进入设置和命令检索，不是无关紧要的旧注释。应把真实能力、必要输入、已知限制和模型依赖写进目录，否则诚实的引擎仍被包装成过度承诺的产品。

## 建议处理顺序

1. **先修 R01/R02/R03**：任务范围、阅读次序、入口完整性。否则漂亮界面也会基于错对象工作。
2. **同步目录承诺和副本身份**：不承诺不存在的胜率、画像计数或镜头数量。
3. **统一页面与交互壳层**：以 3–4 个真实插件流程建立视觉和状态基线，再覆盖其他插件；修数字输入名称。
4. **逐类增强真正的能力**：确定性工具用不变量/反例；状态与约束工具核对具体条件；语义工具做独立样本评测；创作工具做作者质量复核。不要再以插件数量、公式数量或单测数量定义“工程化”。

## 本地复核工件

位于 `.playwright-cli/`，不属于生产实现：

- `plugin-review-probes.log`：4 个合成复现的最终输出。
- `plugin-review-probe-source.tsx.txt`：已移出测试树的复现源码。
- `plugin-review-regressions.log`：49 文件/266 项现有回归结果。
- `plugin-review-visual-output.log`、`plugin-review-visual.callback.txt`：已等待 canvas 替换和 lazy 内容落定的 38 次主视图测量；2 条 drawer-only 跳过说明。
- `plugin-review-import-dead-end.png`：返回书架后的入口断路。
- `plugin-review-faction-default.png`、`plugin-review-reader-hook-900-sepia.png`、`plugin-review-combat-sandbox-900-sepia.png`、`plugin-review-gold-chapters-eval-1440-sepia.png` 等：实际页面截图。

上文 R/U 条目描述的是 2026-11-01 的基线；后续状态见“2026-11-02 修复复核增补”。C01/C02 的能力有效性差距及未执行的外部验证仍未关闭。此前旧审计中的已关闭项和本轮没有复现的问题，不应自动重新打开。
