# 插件能力可靠性审查与第一批修复

日期：2026-10-14（Asia/Shanghai）。范围：黄金三章、读者模拟器、读者影子视角的合成反例，以及战力沙盘的公式来源检查。不是全部 44 个插件的能力验收。

## 结论

此前的启停、保存、抽屉、来源标签与组件检查不能证明插件具备设想的分析能力。已有实现把词项命中转换为质量判断、读者反应和精确数值，但没有为这些转换提供实测依据。原始目录提出了量化开篇评分、读者反应模拟等目标；目标描述不能证明算法有效。

本轮先修黄金三章的输出与证据合同：移除新分析中的任意加权分和达标结论，保留可定位的词项观察，并让 AI 结果经过结构和引用校验。这解决了已复现的无依据结论与引用不匹配问题，**不代表模型已能可靠评价开篇质量**。原有量化评分目标仍未实现有效性验收；也没有用新增词表替代语义理解。

## 可复现反例

使用 Node 直接导入工作树中的 TypeScript 引擎，所有输入均为本轮创建的合成文本，没有读取或发送作者稿件。

| 插件         | 输入或实现                                                       | 修复前实际结果                                            | 能证明的问题                                                                   |
| ------------ | ---------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 黄金三章     | `主角为了复仇激活系统，面对欺凌。原来还有秘密。`                 | 91 分、达标                                               | 分数由四类关键词存在性决定                                                     |
| 黄金三章     | `本文没有复仇，也没有系统，更没有欺凌。原来只是词表。`           | 同样 91 分、达标                                          | 不区分情节存在与否定、词表讨论；无法支撑质量判定                               |
| 黄金三章     | 空文本                                                           | 49 分；生成注入危机、提前金手指、删背景和第三章断章等建议 | 没有内容也会诊断内容缺陷                                                       |
| 读者模拟器   | 空文本                                                           | 毒点 10、逻辑 85、爽点 40；生成赞扬评论与 12 个点赞       | 输出不是观察到的读者反馈，也没有文本依据                                       |
| 读者影子视角 | `她没有跪下，而是抵抗命令。`                                     | 1 条毒点预警；声称主角跪下、无原则宽恕并触发弃书          | 否定句被当成肯定事件，固定评论与原文相反                                       |
| 战力沙盘     | 源码把阶梯序位映射到固定 `Log10(J)`，再经固定 Sigmoid 输出压制率 | 本轮只查源码，没有完成战斗场景实验                        | 未见作者给定能量值或经验校准参与该换算；数学函数本身不能证明物理解释或概率可靠 |

黄金三章新增六项行为回归在修改前全部失败；它们检查空输入、词表否定、词表外题材、精确出处和覆盖范围。旧测试只验证固定词项得到预定分数，因此不能发现这些能力问题。

## 已实施：黄金三章

- 本地引擎仅返回每类首个词项及原文区间。不再输出 `score`、`isQualified`、剧情缺失诊断或强制改写建议。无命中不等于文本有缺陷。
- 开头最多 3000、末尾最多 500 个字符是明确的节选边界；重叠范围合并，不重复计算。请求中包含实际末尾、每份节选的 ID、原文起点及覆盖信息。省略部分不声明为已检查。
- AI 输入包含动机、独特筹码、冲突、结尾四个维度及 JSON 结果合同；筹码不被限定为修真金手指。指令版本由 1 升为 2，并同步注册表与任务元数据。
- 每项结果分别提供明确观察、模型解释、修改建议和引用。校验器要求引用属于所提交节选，偏移为合法整数，摘录与对应原文逐字符一致。自由文本、空的“全部通过”、缺少证据、捏造摘录和越界引用会显示失败。
- 当前输入框的文本变化后不再展示旧点评；切换作品重新建立插件状态。分析绑定的是送出的节选快照。本轮未完成外部窗口改稿后的多章修订核对；校验只证明引用绑定，不能证明模型解释正确，也不能证明所有问题都被找到。
- 新保存记录包含原文节选、覆盖范围和词项证据，不生成分数。旧记录保持原样，历史分数标为未校准。保存失败公开错误并可重试。未迁移、删除或重新评分历史数据。
- 沿用现有插件宿主、任务执行、产物持久化与回执面板；不另建模型通道或任务库。AI 结果没有自动写入正文。

源码与测试：`src/plugins/gold-chapters-eval/`、`src/ports/goldChaptersRepository.ts`、`src/ai/instructions/pluginInstructions.ts`、`src/adapters/indexedDbGoldChaptersRepository.test.ts`。

## 后续能力改造顺序

1. 先处理读者模拟器与影子视角中已复现的伪造反馈、否定句误判，再审查战力沙盘的物理量与概率假设。固定评论与规则分不能作为真实受众效果。没有观测数据时，保留明确的假设场景和作者复核，移除伪造的实测含义。
2. 连续性、POV、伏笔与时间线：从原文提取带出处的实体、事件、知情者和时间；作者确认的事实与模型推测分别表示。确定性检查只比较已明确的约束；对话转述、角色误解、否定、回忆和未知时间不能直接成为已确认矛盾。
3. 开篇、节奏、对白和改写：补齐任务所需的章节边界、人物目标、题材与前后文。检索结果应能回到保存版本的原文。模型输出使用领域结构与引用；结果经作者审阅、采纳和撤销，不能用一条通用 prompt 加任意分数替代能力实现。
4. 针对实际用途建立独立评测。先用合成反例和已获许可的标注摘录测最低能力，再用独立的代表性样稿评估泛化。作者尚未提供的稿件不得进入模型请求；已授权的五条合成请求只能用于有限验收，不能作为总体可靠性估计。

## 工程与质量验收分别记录

| 层次                 | 验收方法                                                                   | 当前状态                                            |
| -------------------- | -------------------------------------------------------------------------- | --------------------------------------------------- |
| 生命周期与数据正确性 | 项目隔离、来源变化、取消、失败、重试、保存及恢复                           | 黄金三章已有本地合同与宿主集成测试；44 项矩阵未完成 |
| 引用与范围           | 原文精确匹配、合法区间、片段身份、截断披露、缺失证据拒绝                   | 黄金三章本地校验已实施；其他插件未全量覆盖          |
| 确定性算法           | 用已明确输入构造正反例、边界和不变量；检验真实约束而非复写实现             | 部分既有引擎有测试，未完成逐项有效性审查            |
| 语义分析             | 独立标注实体、事件、矛盾和支撑出处；逐类别报告误报、漏报、弃答及未知原因   | 未完成；引用校验与绿色单测不能替代此项              |
| 创作建议             | 作者盲评原文与修改稿，记录任务目标、改善项、引入错误及分歧                 | 未运行；作者摘录与评审待提供                        |
| 受众或商业预测       | 明确观测结果、数据来源与目标人群，隔离作品和时间划分，做校准与不确定性评估 | 没有这类验证证据；不得声称已能预测                  |

评测报告须记录样本构成、完整分母、模型/指令版本、输入范围、失败与弃答，不只保留成功输出。主观评价允许分歧，不把模型自行给的置信度当成实测准确率，也不把多模型一致当成人工真值。

方法依据：[CheckList](https://aclanthology.org/2020.acl-main.442/)提出按语言能力与行为测试检查 NLP 系统；据此采用否定、归属、上下文缺失与不变性反例。[NIST 有效性与可靠性说明](https://airc.nist.gov/airmf-resources/airmf/3-sec-characteristics/)要求结合预期用途、代表性测试集和方法说明评估表现。本项目据此区分接口正确性、引用绑定、语义能力与受众效果；这些资料不构成本项目有效性的认证。

## 本轮验证

- 改动前：黄金三章六项新增行为回归全部失败。
- 改动后：黄金三章、引用校验、真实宿主回执、IndexedDB 历史兼容、指令版本、既有插件生命周期和架构测试共 10 个文件、80 项通过。
- Desktop 全项目 `tsc -b` 通过；改动文件 Oxlint 通过，无警告。Prettier 已执行；两仓库 `git diff --check` 通过。
- 本轮没有调用真实 Provider，没有运行作者质量盲评，没有验收全部 44 个插件的语义效果。此前全量测试结果不能替代本次能力评测。
- 备份与组件补验：3 个文件、30 项通过（其中 5 项与上面的组件测试重叠）。实际 IndexedDB 中的新证据和旧评分均可导出、复制导入到另一作品，原记录保持不变。新增回归加入既有 WorkspaceLifecycleService 测试，无新增备份机制。
- 生产构建与前端 parity 通过；保留既有 `node:net` 浏览器外置和大 chunk 警告。最终 TypeScript、改动文件 Oxlint 与 Prettier 检查通过。未重跑全量 Desktop 测试与覆盖率。

没有提交、推送或修改分支；保留工作树中的既有修改。GitButler diff 在本机因 AppData 临时目录访问被拒绝，检查使用只读 `git -C`。

## 2026-10-14 后续复核：Consistency、Combat 与 POV 结果范围

`POWER_BREACH_DETECTED` 带作品 ID、对决记录 ID、双方名称和诊断，但没有章节、段落或修订标识。Consistency 抽屉此前只要当前正文出现双方名称，就把已保存沙盘警告合并成正文候选。合成反例“甲和乙在议事堂会面。”没有战斗动作，但仅因两个名称都出现而显示一条“越阶战力失真”。该事件不能证明当前章节包含同一场对决。

抽屉现在将这类事件放入单独的“未绑定章节的沙盘预警”区域，不参与正文候选数或正文片段列表。说明文字明确记录缺少章节、段落和修订出处；没有把预警链接到章节。战斗记录先写入仓储，成功后才广播。事件现在带稳定的对决记录 ID；抽屉用它更新同一对决，并保留同名角色之间的不同对决。抽屉仍显示 EventBus 内存回放缓冲区和组件本地状态中的副本，不会从持久化仓储重载这些预警。进程重启后该区域不会恢复，不能把它当作持久化的记录视图。标题和说明明确标注“本窗口收到”的范围及重启后不恢复。

Consistency 主视图还把例外词列表说明从“出现则视为合理越阶”改为“作者登记的越阶例外词（命中仍需核对）”。引擎不会因命中例外词而取消候选；会保留候选并提示核对能力条件和故事时间。主视图测试检查了这条说明。

POV 抽屉原先只在正文或作品变化时重载配置；主视图保存同一作品的新规则不会刷新抽屉，旧候选会继续显示。新增 `POV_GUARD_CONFIG_SAVED` 事件。主视图在仓储保存成功后发出事件；抽屉按作品订阅、重新读取已保存配置并重跑规则。事件总线契约测试验证有真实发布者和订阅者；组件回归验证主视角获知一条秘密后，抽屉中的“知情来源待复核”候选被清除。未改持久化结构。

相关验证：合并运行 Consistency、Combat Sandbox、POV 和 EventBus 共 14 个测试文件、65 项通过；分组结果分别为 10 个文件/45 项和 6 个文件/27 项，共享 2 个事件总线测试文件。前序插件组合复验 33 个文件、153 项通过。Consistency 与 POV 回归先在旧行为下失败，修复后通过。Desktop typecheck、改动文件 Oxlint 和 Prettier 通过。全量 Desktop 测试和覆盖率未因这些局部变更重跑。这些修复只关闭来源误关联、旧规则结果不刷新和一条错误说明，不验证战斗推演或完整语义分析准确性，也不关闭全部 44 个插件的七类验收。

## 2026-10-14 后续复核：Timeline 未登记叙事线

Timeline Grid 会把没有 `NarrativeThread` 记录的事件放入“待定位事件”，但冲突检测仍按事件中的 `threadId` 字符串分组。两条事件若保留相同的失效 thread ID 且位于同一章，原逻辑仍报告“单线章节碰撞”，尽管它们没有已登记的叙事线。该结果把悬空引用当成已知分组。

`auditAllConflicts` 和 `detectChapterCollisions` 现在可接收已登记的 thread ID 集合；Timeline Grid 传入作品当前的线程列表。缺失线程的事件仍参与 ID、依赖和章节顺序检查，只跳过需要已登记叙事线才能成立的“同线碰撞”检查。作者仍可在待定位列表中打开和修复这些事件。

新增引擎回归验证空的有效线程集合不产生同线碰撞，登记了该线程后仍能报告碰撞；TimelineGridView 组件回归覆盖两个共享失效 thread ID 的待定位事件。直接转译并执行当前引擎源码复现了修复前的错误结果；修复后直接执行得到预期结果。TypeScript 应用项目检查覆盖 627 个文件、0 诊断；四个改动文件通过仓库 Prettier 配置。受当前命令宿主不能进入 Unicode 工作目录的限制，Vitest、`git diff --check` 和 GitButler 最终状态未运行。本次没有运行全量 Desktop 套件或覆盖率。

这项修复只收窄了无效 thread 引用下的章节碰撞提示，不证明时间线提取、事件因果或情节连续性语义正确。全部 44 个插件的七类验收仍未完成。

## 2026-10-14 源码复核：伏笔账本与契诃夫雷达

`LedgerEngine.computeDebtSnapshot` 只按作者登记的埋设章节、软期限和硬期限计算章节跨度；`memoryDecayLambda` 不参与读者记忆判断。`detectPayoffCandidates` 返回 `mention`，Writer Drawer 明确显示“提及不等于兑现”；快速兑现还要求作者填写说明，并再次核对当前正文区间与候选摘录一致。

Chekhov Drawer 与主视图均在档案仓储保存成功后才发送 `FORESHADOW_PLANTED`。但该事件没有把记录接入 Promise Ledger：Chekhov 写入 `chekhovGuns`，事件订阅者只重载 `promiseLedger`；事件也没有稳定记录 ID、原文片段或期限映射。事件总线契约测试检查了发布者和订阅者，却没有验证新增枪支是否出现在账本。该跨插件连接目前无数据效果。

没有把两种记录自动复制，因为它们的状态、期限和语义不同，现有事件也缺少关联字段；复制会产生未经确认的持久化映射。方案已要求先记录各数据所有者，再设计可逆迁移。此次源码审查没有运行新的 Promise/Chekhov 测试。精确引用尚未绑定到兑现章节修订；语义上的真正兑现、读者是否记得伏笔及商业效果均未验证。没有新增代码变更。

## 2026-10-14 跨插件事件边界复核

`CODEX_ENTITY_TOUCHED` 在 Codex 实体写入成功后发送；Aftermath 与 Consistency 按作品重新读取同一个设定库。`CHAPTER_CONTENT_AUDITED` 只给情绪抽屉显示同章字符计数，并明确说计数不代表当前版本的情绪。这两条事件的消费者与数据用途相符。

`POWER_BREACH_DETECTED` 只在 Combat Sandbox 对决记录保存成功后发送，并带有该记录 ID。Consistency 显示事件副本，但不持久化或从沙盘仓储重载；项目重启后不会恢复。`FORESHADOW_PLANTED` 的生产订阅者只重载 Promise Ledger 表，Chekhov 记录不会进入该表。现有事件契约测试主要核对声明的发布者与订阅者，不能证明跨插件持久化、记录映射或重启恢复。

此次为源码追踪，没有新增运行测试。伏笔统一视图/关联仍待确认数据所有者与语义；战斗预警仍是未绑定章节的会话提示。不要将事件连通性报告成记录同步或持久化验收。

## 2026-10-14 Combat 事件记录身份

多个已保存对决可以涉及相同角色。Consistency 抽屉原先按双方姓名去重，后续对决会被隐藏。`POWER_BREACH_DETECTED` 现在携带保存记录的稳定 ID；抽屉按该 ID 更新同一记录，同时保留相同角色之间的其他对决。新增组件回归覆盖两个不同对决及同一 ID 的更新。

TypeScript 应用项目检查 627 个文件、0 诊断；改动文件通过 Prettier。受命令宿主不能进入 Unicode 工作目录限制，新增 Vitest 回归未运行。本修复解决本窗口内的事件身份去重，不解决对决预警的持久化恢复或章节出处。

## 2026-10-14 E2E 合同复核与本地验证

- 更新旧 E2E 断言以匹配当前源码合同：空输入不报告未经校准的 WaterMeter/NarrativeLinter 分数；未知拼音读音不从 Unicode 奇偶推断；无足够方差的 OLS 拟合不报告 r² 或峰值；DiffReviewer 保留计算出的来源快照与区间；战力沙盘只有作者确认违反的限制才会产生预警；章节质量事件发布 schema v2 的来源观察，不持久化综合分或自动写入 Living Codex。
- 四个引擎、写回、边界和场景套件通过 30/30；CrossFeatureFlows 通过 5/5；TimelineGridView 通过 6/6。完整 Desktop `pnpm run check` 通过 372 个测试文件、1,842 项通过、2 项跳过、0 项失败。构建和 Web/Tauri frontend parity 通过。
- 一个场景夹具原先手动伪造 `waterScore`，与生产 `CHAPTER_CONTENT_AUDITED` 事件（project、chapter、wordCount）不符；移除该字段后，Prettier 和场景套件再验通过（4/4）。此测试专属后续修改后没有重跑全量套件。Oxlint 有既存警告；生产构建有 `node:net` 外置、无效动态导入和大 chunk 警告。
- 这些测试证明本地代码合同与集成路径，不证明模型语义准确、写作建议质量、读者反应或商业预测。真实 Provider、获授权作者盲评和其余 44 插件七类验收仍待完成。

## 2026-10-14 后续复核：其余插件的本地合同

第一组覆盖 DiffReviewer、Memory Palace、Press Forge、Scrapbook Recycler、Multiverse What-if 和 Storyboard。Desktop 定向测试 19 个文件、74 项通过；Runtime 工具与工作流测试 2 个文件、10 项通过。回归覆盖精确差异区间与行尾、实体别名的字面位置、跨卷顺序未知时不推断首末章、保留原文标点及作者词表提示、排除已复用片段与零推荐上限，以及结构化创作工作流。分镜保留原文摘录/偏移和作者提供的外观/画风约束；空正文不造镜头或角色。Desktop 组件测试还覆盖分镜归档、复制和提示词导出。

第二组覆盖 Sprint Arena、Brainstorm Spark、Soundscape、Voice Preview、Archetype Cards 和 Author Ops。Desktop 定向测试 21 个文件、53 项通过，覆盖 Unicode 净新增字数与作品章节隔离、脑暴必需输入和上下文缺失、音量边界与所拥有音频节点的释放、对白精确区间/未知归属/播放取消、无重复抽卡和不生成冲突分，以及同周期/群体/指标口径下的相邻章节留存差。

Runtime 全量测试通过 218 个文件、1,206 项通过、1 项跳过。`pnpm run check` 的依赖锁定检查和 TypeScript 通过；`pnpm run lint` 检查 506 个文件且没有修改。Desktop 最新全量检查为 372 个文件、1,842 项通过、2 项跳过、0 项失败；之后只改了一条测试夹具，相关场景组复验 4/4 通过，且上述两组插件测试均在当前工作树通过。

原先标记“待检查”的 12 项现有源码和定向回归证据；这不等于完成其生产评测。未调用真实 Provider，未使用作者稿件，未在实体音频设备验收声音或系统音色，也未请求图像生成。按用户决定，Storyboard 当前只提供分镜草案与提示词导出，图像服务仍暂缓。模型语义质量、作者使用效果和 44 项七类生产验收仍未完成。

## 2026-10-15 Chekhov and Promise Ledger event decision

- The user chose to keep Chekhov records and Promise Ledger entries separate and remove the ineffective cross-plugin event. Chekhov writes author records to `chekhovGuns`; Promise Ledger writes entries to `promiseLedger`. Neither plugin maps or copies records from the other store.
- Removed the obsolete `FORESHADOW_PLANTED` event and the Promise Ledger reload subscription. Chekhov master and drawer regressions verify that explicit registration stays in Chekhov storage and emits no cross-plugin event. The event-bus integration fixture now covers the six current production event payloads and the required Combat record ID.
- `ChekhovRadarComponents.test.tsx`, `pluginEventBusContract.test.ts`, and `tests/e2e/tier1-features/eventBus.test.ts` passed 14/14. Desktop `tsc -b` and Prettier checks for the event fixture and related tests passed. Semantic payoff quality and real-author review remain unverified.

## 2026-10-15 plugin AI input boundary review

- `src/plugins/aiInputBoundary.test.tsx` checks 22 plugin task seams (23 calls) and six Runtime tool/workflow call sites. It requires the listed prose, notes, saved plans, chapter content, source text, and fragments to use semantic projections before task execution. It also rejects several known direct raw-input paths and verifies that manually edited HTML reaches a plugin task as plain text.
- The boundary test and ten affected plugin view/component suites passed 11 files and 38 tests. This verifies the selected input contracts and UI paths; it does not verify model output, semantic correctness, or author usefulness. The checks cover these call sites, not all 44 plugins.
- The Desktop full check recorded in the writing-product plan passed 373 test files, 1,864 tests, with two skipped and no failures. No real Provider request or author review was run; credentials and an authorized manuscript excerpt remain unavailable.

## 2026-10-15 Multi-Calendar AI scan scope

- The chronology scan now selects up to 15 non-empty chapters in reading order; empty earlier chapters no longer hide later chapters with text. It reports the 15-chapter and 250-character-per-chapter limits, the number of empty, omitted, and truncated chapters, and disables the action when no body text is available. Its result identity follows the submitted samples and revisions, so changing them hides the previous result. The task instruction forbids claiming a complete-book scan when coverage is partial.
- The app TypeScript project check covered 628 source files with zero diagnostics; the new regression file's focused typecheck also returned zero diagnostics, and Prettier checks passed after the empty-chapter follow-up. Four targeted Vitest files remain unrun because the command host denied loading the installed Rolldown Windows native binding (`ERR_DLOPEN_FAILED: Access is denied`). Dependencies were not changed. Real model effectiveness and author review remain unverified.

## 2026-10-15 Multi-Calendar scan coverage

- The scan now selects up to 15 non-empty chapters evenly across reading order, including the last chapter when the book exceeds the limit. It reports the sampling strategy and omitted chapter count; its instruction says gaps between samples are unreviewed. Per-chapter input remains capped at the first 250 semantic characters, with truncation disclosed.
- The 31-chapter regression verifies first/middle/last coverage, bounded sampling gaps, omission counts, and invalidation when the sampled final chapter revision changes. A semantic projection test verifies that editor HTML becomes canonical text. The AI input-boundary audit now accepts the shared projection helper instead of requiring inline text extraction. Six affected suites passed 39/39 tests. Desktop `tsc -b`, targeted Oxlint, and Prettier checks passed.
- The first full `pnpm run check` stopped after its serial Vitest run found the stale AI input-boundary assertion; TypeScript and Oxlint had completed. After updating the assertion and the Combat warning recovery, a full `pnpm run check` completed on the final source and test state with exit code 0. The retained output did not include the Vitest file and test totals.
- This improves coverage across the manuscript but does not verify temporal extraction quality or author usefulness. Real Provider and author review remain unverified.

## 2026-10-15 Combat warning recovery

- Consistency now loads saved Combat Sandbox records for the current project when the drawer mounts. It displays only records marked breached with `status: conflict`, a recognized review source, valid names, and a finite tier difference. Legacy heuristic records without review status/source stay hidden. These warnings remain separate from current chapter text findings.
- After a duel write succeeds, Combat Sandbox publishes a project-scoped `COMBAT_DUEL_SAVED` notification. The open Consistency drawer reloads the saved source, so editing a duel to remove a confirmed conflict clears the warning. `POWER_BREACH_DETECTED` still drives the immediate post-save notice.
- `ConsistencyDrawer.test.tsx`, `CombatSandboxComponents.test.tsx`, and `pluginEventBusContract.test.ts` passed 16/16; the event-bus E2E fixture passed 5/5. The final Desktop `pnpm run check` completed with exit code 0 after all source and test changes. The retained output did not include Vitest totals.
- The warning record is not linked to a chapter, paragraph, or document revision. Drawer-mount recovery is covered by the targeted tests; a native app restart was not run.

## 2026-10-15 Shared AI task text projection

- `usePluginAiTask` projects HTML-like markup from nested string fields before creating the grounded review input. ID fields and ID lists remain unchanged; plain strings remain unchanged; input records are copied rather than mutated.
- The focused hook suite passed 16/16, including a saved Chekhov Radar record, a source excerpt, preserved IDs, and non-mutation. The final Desktop `pnpm run check` passed TypeScript and Oxlint (with warnings), then 374 Vitest files / 1,878 tests passed and 2 were skipped.
- This covers the shared Desktop AI task boundary. The six direct Runtime call sites use separate paths and are not covered by this change. Model output quality and author usefulness remain unverified.
