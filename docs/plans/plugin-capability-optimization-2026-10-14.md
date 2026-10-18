# 44 个插件的能力改造

用户要求：逐项优化全部插件的实际能力，并核验实现是否合理。范围以 `ALL_PLUGIN_DEFINITIONS` 中的 44 项为准。现有修改和用户数据保留；不提交、推送或修改分支。

## 实施与验收

1. 检查每项的原始用途、当前输入、核心算法、输出和数据路径；用独立正反例确认问题，不能把描述或旧测试当成有效性证据。
2. 先改正文和读者分析，再改设定、时间、因果、数量计算，最后改创作生成、媒体、写作工具。沿用已有宿主和存储，不重建插件框架。
3. 确定性功能验证边界、不变量和实际约束；语义功能提供所需上下文、精确出处、明确的未知原因和作者复核。词表只能定位词项，不能证明角色行为、文学质量或受众反应。
4. 每组跑领域行为回归和相关组件/存储测试；最终跑类型、格式、lint、全量测试和构建。每项分别记录本地验证和模型效果，失败与未运行也保留。

主要风险：任意得分、固定评论、虚构数值、默认题材、截断未披露、缺失约束、旧输入结果、保存与导出兼容。引用校验只能证明出处匹配；真实模型效果须另外评测。用户已授权最多五条合成模型请求，环境凭据尚缺；作者样稿尚未提供。这些条件不阻止本地算法与合同改造。

## 逐项记录

“待检查”表示本轮尚未验收，即使该插件已有旧测试。

| 插件                 | 核心用途                       | 本轮状态与证据                                                                                                                                                  |
| -------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| living-codex         | 作者设定、实体定位、图关系     | Unicode 实体跨度、缓存键碰撞、同项目唯一关系解析与 XML 转义已修；上下文含作者关系和估算预算；本地回归通过                                                       |
| promise-ledger       | 伏笔状态、截止与依赖           | 使用实际期限、间隔和进度；移除读者记忆热度及健康分；进度/兑现须作者说明与原文；本地回归通过                                                                     |
| timeline-grid        | 因果依赖与排序                 | 精确环成员、缺失依赖和情绪标注位置已修；按卷生成章节顺序，未挂卷位置未知；本地回归通过                                                                          |
| safe-gate            | 作者词表定位和替换复核         | 无效规则与空匹配可见；重叠命中保留；替换核对原文，批量先验证全部区间；实际完整输入与语境审阅接入；本地回归通过                                                  |
| scene-beats          | 场景目标、冲突与节拍           | 有效预算与连续区间、真实章节绑定、未标注情绪未知、作者完成标记及保存期间后续编辑保留已验证；无戏剧质量评级                                                      |
| describe-palette     | 依据对象和语境的感官描写       | 空集合、零限制、全部检索词、筛选后抽取、Unicode 定位和复制重试已修；不推导感官缺失或描写质量；本地回归通过                                                      |
| name-forge           | 作者约束下的命名               | 数量/长度/必需片段/排除名称、项目名称碰撞、名称草案收录和作者提供读音分组已验证；自动读音与文学效果未证明                                                       |
| expectation-engine   | 作者记录的期待与兑现计划       | 短文本词项与真实期待记录接入；无默认爽点/流失判定；实际全书章序、作者兑现说明及有出处审阅接入；本地回归通过                                                     |
| consistency-sentinel | 已确认的状态与等级约束         | 显式空偏序、缺失端点和字面人名已修；战斗/已故角色命中为候选，时间未知不判冲突；来源与约束上下文接入；本地回归通过                                               |
| sprint-arena         | 写作增量、时速与专注           | 计入 Unicode 正向净增量并以字/分钟显示；会话按当前章节隔离，写入失败可重试。心流等级只是连击与速率阈值，不是心理状态测量                                        |
| reader-hook          | 章尾特征、悬念与改写           | 章尾原文范围、实际词项和作者目标接入；无张力/追读评级；保存失败重试及旧数值隔离已验证                                                                           |
| clue-weaver          | 角色知识与线索状态             | 字面说话人、知识获得章节、缺失认知与原文跨度已修；主视图和侧栏按实际项目/章节输入；本地回归通过；语义审读待验证                                                 |
| water-meter          | 文本统计和可复核的删改候选     | Unicode 熵、短文本、覆盖和单次原文删改已修；5 文件 13 用例通过；模型效果待验证                                                                                  |
| volume-master        | 分卷目标和章节规划             | 实际保存稿计数、作者预算/阶段、已有原文情绪标注、退化/不足/范围外拟合处理已修；保存重试与并发编辑保留已验证                                                     |
| dialogue-distiller   | 说话人、对白特征与修改         | 单字/特殊字符姓名、引语原文和 Unicode 句长已修；比较实际标点及样本差，缺样本不诊断；本地回归通过                                                                |
| faction-matrix       | 作者关系与变动记录             | 缺失关系未知、从属方向、作者系数与理由、排列无关的三角候选已修；不推导情节事实；本地回归通过                                                                    |
| paywall-sentry       | 章尾过渡与实测运营输入         | 短文本及 Unicode 计数已修；付费计数、统计口径和真实章序接入；不推导付费潜力；本地回归通过                                                                       |
| press-forge          | 排版元数据和可用导出           | 格式化保留原文标点；作者词表命中只产生待核对提示，不代表平台判定。Desktop 组件与 Runtime 工具回归通过；真实平台规则未测                                         |
| emotion-curve        | 作者情绪标注与顺序             | 作者标注、精确引用与真实章序接入；未知维度和断档不补分；无读者情绪预测；本地回归通过                                                                            |
| brainstorm-spark     | 当前困境与受约束的备选方案     | 缺少问题、局势、目标或对手条件时不生成；八类结果是带资源和约束核对项的创作提示，不是完成的情节方案。Desktop 回归通过，语义效果未评测                            |
| reader-simulator     | 有出处的假设读者解读           | 固定评分、赞同与夸奖已移除；实际片段和画像审阅接入引用合同；本地回归通过；读者模拟效果待验证                                                                    |
| chekhov-radar        | 伏笔间隔和未兑现记录           | 未知位置、作者复核期限和精确词项候选已接入；作者记录只写入 `chekhovGuns`，提及不创建记录或发跨插件事件；Promise Ledger 保持独立；本地回归通过                   |
| rhythm-metronome     | 标点、句长和分段统计           | 虚构篇幅和健康分已移除；实际句长、标点、篇幅样本与作者周期计划接入；本地回归通过                                                                                |
| geography-map        | 明确距离、路线和速度假设       | 精度、原地零耗时、非法速度已修；实际网格最短耗时路线、障碍、作者系数及存储接入；虚构地名和行程已移除；本地回归通过                                              |
| combat-sandbox       | 作者等级、能力、成本与战术约束 | 固定能量和胜率已移除；能力、环境、目标、约束理由和资源余额接入；Consistency 从存档恢复作者确认的冲突并在对决保存后刷新；模型推演待验证                          |
| multi-calendar       | 已定义历法的日期换算           | 非法日期、月长和非整数拒绝；未支持闰年拒绝；跨纪元连续整数年（含0）已说明；AI 排查按序选取有正文样本、明示范围并按章节 ID/修订绑定结果                          |
| pov-guard            | 叙述视角、知情范围与出处       | 名称按字面匹配；过滤成对对话、否定和换主语；知情者生效；原文位置和候选解释接入；掩码不保留秘密；本地回归通过；完整语义审读待验证                                |
| narrative-linter     | 可定位的文本规则和语境审阅     | CRLF/Unicode 位置和精确引用已修；作者规则、阈值、配置持久化与失败重试接入；安全预览删改；移除文学分数；本地回归通过                                             |
| diff-reviewer        | 差异、逐项采纳与来源版本       | Runtime 返回精确差异区间并保留行尾；Desktop 仅对已验证来源范围开放采纳。桌面组件/引擎与 Runtime 回归通过；跨稿语义判断未评测                                    |
| iron-chamber         | 作者专注目标、进度与自愿退出   | 改为真实章节专注目标；Unicode 净增和经过时间、自愿结束、来源隔离、保存失败重试、同项目会话事务互斥已验证；移除未保存临时编辑区                                  |
| soundscape           | 音频合成、资源生命周期         | 以 Web Audio 振荡器合成按键声和环境声；零音量不创建 AudioContext 或节点，停止时只释放本插件拥有的节点、定时器和上下文。Desktop 回归通过；真机音质未测           |
| scrapbook-recycler   | 删除片段保留与检索复用         | Runtime 按语料词频排序、排除已复用片段并支持零结果上限；Desktop 保留原文片段。两端定向回归通过；作者实际复用价值未评估                                          |
| aftermath-sync       | 提取后由作者确认的状态更新     | 否定/对白/计划不作为事实；原文候选及作者确认值/说明接入；实体 ID、旧状态校验、日志/实体/提案原子回写及故障回滚已验证                                            |
| subtext-compiler     | 人物目标、表层台词与潜台词     | 实际台词、人物目标、隐藏原因、关系与作者动作接入；无固定心理机制或无正文台词；保存重试已验证                                                                    |
| rhythm-radar         | 实际断章位置和节奏线索         | 实际句段切口、引语边界、前后全文保留及作者选择接入；无虚构金句；本地回归通过                                                                                    |
| shadow-reader        | 按阅读顺序解读、区分已知和推测 | 阅读顺序、画像、精确原文问句接入；固定毒点与情绪计数已移除；本地回归通过；模型解读待验证                                                                        |
| multiverse-whatif    | 保留前提的分支推演             | 作者前提进入结构化分支草案；Desktop 引擎/组件与 Runtime 工作流回归通过。真实模型的正史一致性和作者可用性未评估                                                  |
| voice-preview        | 对白分配、语音能力与失败反馈   | 台词保留原文区间；未知说话人和情绪保持未归属，播放取消与分段错误有回归。Desktop 测试通过；真实系统音色与听感未验                                                |
| storyboard-gen       | 依据实际场景的分镜             | 仅选取真实章节或手工原文；分镜保留精确出处，并支持作者外观/画风约束、归档、复制和提示词导出。Desktop 与 Runtime 回归通过；图像服务按用户要求暂缓                |
| archetype-cards      | 可选创作素材与人物约束         | 预设素材按分类抽取且不重复；标签不自动产生冲突分或必然敌意。Desktop 回归通过；作者使用效果未评测                                                                |
| author-ops           | 实测运营数据与描述统计         | 留存比较要求相同周期、群体和统计口径，只比较相邻章节；缺失原因不作归因，名片只使用作者填写资料。Desktop 回归通过；平台数据未接入                                |
| gold-chapters-eval   | 动机、筹码、冲突和结尾审阅     | 精确引用合同和候选观察已修；实际前三个已挂卷章节、输入变化失效提示及项目隔离已验证；文学质量效果待评测                                                          |
| memory-palace        | 真实历史命中、出处和召回       | Runtime 与本地检索在匹配前投影章节、实体和卷册的语义正文；卷序不可比时不推断首末章或最近摘录，结构 ID 保持不变。Runtime 与 Desktop 回归通过；语义召回质量未评测 |
| sub-plot-braid       | 副线状态与交汇依赖             | 空标题、未知位置、作者提醒间隔与交汇前置条件已修；字面提及不证明推进；本地回归通过                                                                              |

## 验证记录

已完成共同分析入口的 22 项领域准则与引用合同，并注册 23 项任务（黄金三章使用独立合同）。它校验输入版本、输出结构和精确引用，不能证明模型解释正确。

2026-10-14 第一组共同入口、画像及读者核心回归：7 文件 96 用例通过。WaterMeter 最新独立回归：5 文件 13 用例通过。视角、历法、地理、节奏新增 27 个反例中修复前 23 个失败；修复后 27 个通过，相关全组 13 文件 60 用例通过。战斗沙盘与事件合同 4 文件 19 用例通过。TypeScript 检查通过。各次运行有重叠，用例数不累加。后续修改仍须重新运行受影响的检查。

证据 JSON 保存在本 chat 的可视化目录：`plugin-water-results.json`、`plugin-quantitative-red.json`、`plugin-quantitative-green.json`、`plugin-quantitative-full.json`、`plugin-combat-red.json`、`plugin-combat-green.json`。四组已经按项目 Prettier 格式化。全 44 项尚未逐项改造，最终全量测试、构建、真实模型效果与作者质量复核尚未完成。

2026-10-14 第二阶段：按卷章节编号与八插件关联回归 33 文件 122 通过、1 失败；该失败为开篇输入失效提示，修复后含开篇合同的规则组 8 文件 29 用例通过。设定与专注最终组 22 文件 97 用例通过，含真实 IndexedDB 事务故障回滚、同项目并发会话互斥、跨章计数隔离和保存重试。TypeScript 通过。当前已有 21 项完成本轮局部实现及行为验证；其余 23 项继续检查。全量测试、构建和真实语义效果尚未完成。

新增证据：plugin-sequence-green.json、plugin-text-rules-red.json、plugin-text-rules-green.json、plugin-state-red.json、plugin-state-green.json、plugin-focus-red.json、plugin-rules-state-focus.json。以上运行存在重叠，不累加用例数。

2026-10-14 后续组：章尾/对白与事件合同 17 文件 41 通过、2 失败；事件联合类型扫描和界面选择器修正后补验 2 文件全部通过，类型检查通过。情绪/关系/潜台词新增 9 个反例全部失败，修复后 9 个通过，关联 11 文件 32 用例通过，类型检查通过。当前 28 项完成本轮局部实现及行为验证，余下 16 项继续检查。新证据：plugin-ending-red.json、plugin-ending-green.json、plugin-ending-components.json、plugin-ending-followup.json、plugin-emotion-relations-red.json、plugin-emotion-relations-green.json、plugin-emotion-relations-components.json。未进行真实模型效果验收。

创作组：节拍、分卷、描写、命名 12 个新反例全部失败，修复后 12 个通过；完整关联回归 16 文件 48 用例通过，TypeScript 通过。包含异步保存期间后续编辑保留、按当前章节选择细纲、实际正文 Unicode 计数、未知预算与阶段、命名碰撞、检索全部条件和无虚构读音分数。本轮已有 32 项完成局部实现及行为验证；其余 12 项继续处理。证据：plugin-creative-red.json、plugin-creative-green.json、plugin-creative-components.json。名字自动读音能力目前没有可信词典，不能当作已实现；真实语义与作者质量效果仍未验证。

2026-10-14 后续复核：之前标记“待检查”的 12 项现均有当前源码审查与本地边界记录。DiffReviewer、Memory Palace、Press Forge、Scrapbook Recycler、Multiverse What-if、Storyboard 的 Desktop 定向测试 19 文件/74 项通过；相关 Runtime 工具与工作流测试 2 文件/10 项通过。Sprint Arena、Brainstorm Spark、Soundscape、Voice Preview、Archetype Cards、Author Ops 的 Desktop 定向测试 21 文件/53 项通过。Runtime 全量测试 218 文件/1,206 项通过/1 项跳过；依赖锁定检查、TypeScript 和 Biome 对 506 文件的检查通过。Desktop 全量检查 372 文件/1,842 项通过/2 项跳过/0 项失败；之后的测试夹具更正经相关场景 4/4 和当前定向组复验。矩阵 44 行均有本地行为记录，已无待检查行；这不代表 44 项七类生产验收完成。真实 Provider、作者稿件、物理音频设备/系统音色及图像生成均未测试；图像服务仍按用户决定暂缓。

2026-10-15 多历法 AI 排查范围补验：从全部有正文的章节中按阅读顺序均匀选取最多 15 章，避免只扫描开篇；每章仍最多提供前 250 个语义正文字符，并携带章节 ID 与修订。面板说明总章数、空章、未抽中章节和截断范围；全无正文时禁用 AI 操作。结果身份绑定实际样本和修订，样本变化会隐藏旧结果。指令要求把均匀抽样章节之间的内容视为未检查。新增 31 章覆盖和 HTML 语义投影回归，并修正 AI 输入边界审计中过时的 Multi-Calendar 投影断言。最终定向 Vitest 6 个文件、39 项全部通过；`tsc -b`、改动文件 Oxlint 和 Prettier 检查通过。首次全量 `pnpm run check` 在旧断言处失败；更新断言和 Combat warning recovery 后，全量检查在最终源码与测试状态上完成，退出码 0。保留的输出未包含 Vitest 文件和用例总数。真实模型效果仍待验证。

2026-10-15 Combat Sandbox 预警恢复：Consistency 在面板挂载时从当前作品的沙盘仓储读取已存对决，只显示带有效来源的作者确认冲突；旧启发式结果和未复核记录不显示。对决写入成功后发布项目作用域的保存通知，打开的面板据此重载记录，冲突解除后会移除旧预警。ConsistencyDrawer、CombatSandboxComponents 和 pluginEventBusContract 定向测试 16/16 通过；eventBus E2E 5/5 通过。最终 Desktop 全量 `pnpm run check` 退出码 0。预警仍与正文候选分开，且没有章节、段落或修订出处。真实模型推演与原生应用重启验收仍待验证；全量 Vitest 数量未从保留输出中取得。

## 2026-10-15 AI prose input boundary follow-up

Source review found three `usePluginAiTask` views missing from the semantic-input boundary table: Archetype Cards, Brainstorm Spark, and Shadow Reader. Archetype Cards now projects its scene text and every prose field in selected materials before review, and disables review for markup-only scene input. Brainstorm Spark projects its dilemma, resource, and constraint fields; required-field checks and local option generation use that projected input. Shadow Reader projects edited text for its local scan, word count, and AI review, and disables review for markup-only input. The raw editor values remain visible and continue to identify stale results.

The boundary table now covers 27 plugin task views and 28 task calls, plus six Runtime call sites. Three component-level regressions check HTML input, submitted task payloads, and markup-only required input. Desktop `tsc -b` and Prettier checks pass. Vitest and Oxlint could not start because Windows denied the installed native bindings and the optional WASI fallback packages are absent; dependencies were not changed. The new component tests remain unrun. This closes three local input-boundary gaps only; model output quality and author usefulness remain unverified. The shared hook does not apply to the six direct Runtime operations; those callers are traced below.

## 2026-10-15 Shared AI task text projection

`usePluginAiTask` now projects HTML-like markup from string fields throughout plugin task input before building the grounded review payload. Structural ID fields and ID lists remain unchanged, plain text remains byte-for-byte unchanged, and the source records are not mutated. This covers saved author records and their evidence excerpts consistently across the shared Desktop task path.

The hook regression covers a saved Chekhov Radar record, its notes and source excerpt, and an ID containing markup. The focused hook suite passed 16/16. The final Desktop `pnpm run check` completed: TypeScript and Oxlint succeeded (Oxlint reported warnings), and Vitest passed 374 files / 1,878 tests with 2 skipped. That full run included the three component regressions reported as unrun in the earlier boundary note. The shared hook does not cover the six separate Runtime call sites, real model output, or author usefulness; the direct Runtime callers are reviewed below.

## 2026-10-15 Memory Palace Runtime input projection

Runtime search already projected chapter bodies, but saved Living Codex entities and volumes could contain editor markup in names, aliases, descriptions, and excerpts. Memory Palace now applies the shared semantic-text projection to those saved fields before Runtime dispatch and local matching. The source records are not mutated, and IDs remain unchanged. The payload regression checks both entity and volume fields.

Four focused test files passed 36/36. The final Desktop `pnpm run check` passed TypeScript, Oxlint, and Vitest: 374 files, 1,880 passed, 2 skipped. `pnpm run build` and frontend parity passed. Vite reported the existing `node:net` browser externalization and chunk-size warnings. No provider environment variables were present; real model output and author usefulness remain unverified.

## 2026-10-15 Direct Runtime plugin input audit

Source review covered the six Desktop-to-Runtime operations: Diff Reviewer, Memory Palace, Press Forge, Scrapbook Recycler, Multiverse What-if, and Storyboard. Five callers already project chapter or saved text before dispatch. Memory Palace was the only caller that sent editor markup in saved Living Codex entity and volume prose; the projection above closes that gap for both Runtime and local matching. This review did not exercise the Runtime tools through an independent external caller; such callers must supply semantic text.
