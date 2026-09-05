# InkPi Desktop 插件系统深度评估报告

> 评估日期：2026-09-05
> 评估方法：静态全量扫描（44 插件 / 46 端口 / 41 适配器 / 141 测试文件）+ 引擎源码深度审计 + 算法实证复现
> 构建基线：`tsc -b` 零错误；`vitest run` 141 文件 / 557 测试全绿

---

## 零、结论摘要

**一句话判断：这是一个"形态上"完成的插件系统，但尚未成为"语义上"成立的插件系统。**

工程纪律（类型安全、懒加载、测试覆盖）达到商业项目水准，是真实资产。但系统最核心的两个设计目标——**跨插件联动**与**算法辅助创作**——前者实际达成率为 0%，后者在 7 个深度审计的引擎中有 5 个存在数学或语义错误，其中 2 个经实证复现为**结论方向性错误**（会给出与事实相反的建议）。

### 分级统计

| 等级 | 含义 | 数量 | 依据 |
|---|---|---|---|
| **A** | 算法真实、实现正确、工程优化到位 | **1** | living-codex（Aho-Corasick） |
| **B** | 算法真实但存在性能或边界缺陷 | **1** | consistency-sentinel（Warshall） |
| **C** | 公式成立但语义误用，结论不可信 | **4** | water-meter / volume-master / combat-sandbox / rhythm-radar |
| **D** | 关键词匹配 + 表单 CRUD，无算法内核 | **38** | 静态指标推断（见 §7 置信度说明） |

### 实证结论一览（含两条推翻自身预判的负面结果）

| 待验证主张 | 实证结果 |
|---|---|
| 香农字符熵存在长度系统性偏差 | **证实** — 同词库同风格，50 字→4.61，1000 字→5.28 |
| 情感项 `\|正面-负面\|` 存在抵消效应 | **证实** — 悲喜交加得 0.00，纯悲得 1.00 |
| `actionDensity` 对长章节系统性压低 | **证实** — 3000 字 25 词=0.833，300 字 25 词=1.000 |
| Sigmoid 在主角占优时丢失方向信息 | **证实** — 主角渡劫 vs 敌人筑基，压制率恒为 0.5 |
| 境界能级 fallback 标度不一致 | **证实** — 同一 rankValue 查表得 3.0，fallback 得 2.0 |
| `apexRatio` 符号误用 | **证实且严重** — 真实网文节奏下误差 0.842（顶点报 0%，实际 84%） |
| OLS 用 Cramer 法则存在数值失效 | **推翻** — 相对误差约 0.1%，当前规模下可接受 |
| `R² < 0.25` 阈值无判别力 | **推翻** — 误报率 0%，混乱节奏检出率 88% |

> 后两条是本次评估的**负面结果**。评估前依据数值分析理论预判二者不成立，实证后撤回。保留记录以示评估基于实测而非套用模板。

---

## 一、真正做对的部分（应当保留）

### 1.1 Aho-Corasick 实体扫描（living-codex）— 唯一 A 级

`src/plugins/living-codex/engine/AcAutomaton.ts`

三个层面全部正确：

- **算法层**：构建 O(Σ|L_i|)、扫描 O(N+Z) 摊还复杂度，符合 Aho-Corasick 理论界，非近似实现。
- **实现层**：委托通用 `GenericAhoCorasick`，未在插件内重复造轮子。
- **工程层**：`lastEntityFingerprint` 脏标记（L17-26）避免实体未变动时的高频重建——这正是"实时扫描"场景最关键的那个优化，做对了。

### 1.2 偏序集传递闭包（consistency-sentinel）— B 级

`src/plugins/consistency-sentinel/engine/ConsistencyEngine.ts:49-106`

Warshall 三重循环实现正确，DAG 环检测（L140-184）三色标记法正确，且对"已故角色活动"做了回忆/幻象语境排除（L336）——这是少见的、考虑到了误报抑制的设计。

**降级原因**：`compareTiers`（L116-134）每次调用都重建全量闭包 O(n³)，而 `scanTextForInversions`（L246-280）在实体对的双重循环中**逐个 interaction 调用**它。总复杂度 O(|实体|² × |交互| × |境界|³)。角色 50 人、境界 15 级的常见规模下，这是 10⁹ 量级。**闭包应在扫描前构建一次并复用。**

### 1.3 工程纪律

- 44 个插件全部 `lazy()` 懒加载，首屏只加载静态定义（`pluginDefinitions.ts`）。
- 强类型事件总线：`PluginEventPayloads` 的类型映射设计良好。
- 141 个测试文件、557 个用例，无 `.skip` / `.only`；`tsc -b` 零错误。

---

## 二、P0 架构级缺陷

### 2.1 事件总线是单向死路 —— "跨插件联动"实际达成率 0%

`src/core/pluginEventBus.ts` 声明了 8 条联动链路。全量扫描生产代码（排除测试）：

```
emit 点（4 处）：
  pluginHostContext.tsx:159        CODEX_ENTITY_TOUCHED
  domain/evaluator/ChapterQualityEvaluator.ts:56   UNIFIED_CHAPTER_EVALUATED
  plugins/chekhov-radar/.../ChekhovRadarEngine.ts:122   FORESHADOW_PLANTED
  plugins/reader-hook/.../ReaderHookEngine.ts:221       CHAPTER_CONTENT_AUDITED

on 订阅点（0 处）

从未被 emit 的事件（4 个）：
  TIMELINE_EVENT_REGISTERED / POWER_BREACH_DETECTED
  PROMISE_STATUS_CHANGED  / EMOTIONAL_CURVE_UPDATED
```

**8 条声明链路，0 条闭合。** 4 个事件从未发射，4 个发射了但无人接收——后者是纯粹的运行时开销。

**第一性原理层面的双重失效**：即使补上订阅者，仍然不工作。因为所有插件都是 `lazy()` 懒加载，挂载时机由用户点击侧边栏决定；而事件总线是纯 pub/sub，**无重放（replay）、无状态查询、无事件持久化**。插件 A 在插件 B 发射事件时尚未挂载 → 该事件**永久丢失**。用户几乎不可能同时打开 combat-sandbox 与 consistency-sentinel 两个界面。

> 修复方向：事件总线需增加"最近 N 条事件环形缓冲 + 订阅时重放"，或改为派生状态（插件按需主动查询共享的领域状态），而非依赖时序耦合的事件。

**测试的虚假安全感**：`crossPluginEvents.test.ts` 的用例名为 "Cross-Plugin EventBus Reactive Dataflow"，但只断言 `listener` 被调用——即只验证发射器工作，**没有任何用例验证存在真实接收方**。测试通过 ≠ 功能存在。

### 2.2 异步监听器错误被静默吞没

`pluginEventBus.ts:106-117`：

```ts
public emit<T>(type: T, payload: PluginEventPayloads[T]): void {
  for (const fn of bucket) {
    try { fn(payload) } catch (err) { console.warn(...) }   // ← 对 async 无效
  }
}
```

而 `PluginEventListener` 的签名是 `=> void | Promise<void>`。`try/catch` **无法捕获** async 函数的 rejection——`fn(payload)` 返回 Promise 后立即返回，异常变成 unhandled rejection。`emit` 声明为 `void` 而非 `Promise<void>`，也从类型上杜绝了 await 的可能。

### 2.3 架构守卫存在语义漏洞，34% 的插件文件绕过端口层

项目在 `architecture.test.ts` 建立了六边形依赖守卫，但 `FORBIDDEN_PATTERNS`（L21-38）只检测 6 种**字符串模式**，其中对索引层的检测仅为：

```ts
{ re: /from\s+['"][^'"]*\/db\/indexedDB['"]/, msg: '直接 import db/indexedDB' }
```

适配器通过 `import { db } from '../db/indexedDB'` 已吸收该依赖，上层引用 `../adapters/indexedDbXxxRepository` **即可绕过全部检测**。实测绕过规模：

| 层 | 直引 adapters 的非测试文件数 | 占比 |
|---|---|---|
| `src/plugins` | **78 / 230** | **34%** |
| `src/components` | 10 | — |
| `src/core` | 6（几乎全部核心文件） | — |

`src/core/pluginHostContext.tsx` 自身即直引 `indexedDbProjectRepository`、`indexedDbCodexEntityRepository`。**"只依赖 ports"这条约束在生产代码中未被执行，守卫测试提供了虚假信心。**

### 2.4 41 张表定义了 20+ 个索引，零使用

`src/db/indexedDB.ts` 在 L89-163 为 codexEntities、timelineNodes、promiseLedger 等 20+ 张表创建了 `projectId` 索引。而全部 41 个仓储适配器中：

- 使用索引查询（`db.getByIndex` / `store.index()`）的：**0 个**
- 采用 `getAll()` 全表加载 + 内存 filter 的：**37 个**

IndexedDB 的核心能力被完全放弃，每次打开插件即全表反序列化。

**更严重的是接口签名不统一导致租户隔离失效**（`SprintRepository` 无 projectId，同项目的 `IronChamberRepository` 有）：

```ts
// indexedDbSprintRepository.ts
async getAll(): Promise<SprintRecord[]> {          // ← 无 projectId
  return db.getAll<SprintRecord>('sprintRecords')  // ← 返回所有项目的数据
}
// indexedDbIronChamberRepository.ts
async getAll(projectId: string): Promise<IronChamberRecord[]> {
  const all = await db.getAll<IronChamberRecord>("ironChamberRecords")
  return all.filter((r) => r.projectId === projectId)   // ← 全表扫描后过滤
}
```

`getAll()` 无 projectId 参数的仓储共 **4 个**：`archetype` / `expectation` / `readerHook` / `sprint`。这 4 个插件会把**所有项目**的记录混在一起呈现。

> 附注：`DB_VERSION = 21`——21 次 schema 迁移、41 张表，说明数据模型仍在快速膨胀且未收敛。

### 2.5 `aiCapabilities` 是死接口

`DesktopPlugin` 接口定义了 `aiCapabilities.systemPromptEnhancer`，44 个插件中**实现数为 0**。插件描述中大量出现的"AI"字样与此接口无关。

同类信号：44 个插件版本**全部**为 `1.0.0`（版本号零信息量）；只有 2 个声明了 `author`；`enabledByDefault: false` 出现 **0 次**——即默认 44 个插件全开，"插件开关"机制在首次使用时等同于不存在，§2.4 的租户隔离问题因此必然在首次使用即暴露。

### 2.6 `refreshBookHierarchy` 是空函数

`pluginHostContext.tsx:69-71`：

```ts
const refreshBookHierarchy = useCallback(async () => {
  // Hierarchical state is synchronized via props/reactive hooks
}, [])
```

接口承诺了能力，实现是 no-op。插件调用后以为数据已刷新，实际什么都没发生——**静默违约比抛错更危险**。

### 2.7 CAS 竞态

`mutateActiveChapter`（L73-139）用 `internalRevision`（React state）做乐观锁。该方法为 `async`，在 await IndexedDB 写入期间 React state 尚未更新，并发的第二次调用必然 CAS 失败。且失败时仅返回 `conflict: true`，无重试辅助。

---

## 三、P1 算法正确性（含实证数据）

### 3.1 rhythm-radar：文档三项公式，实现只有两项；且情感项用错维度

`plugins/rhythm-radar/engine/RhythmRadarEngine.ts`

**问题一：公式与文档不符。** 文件头声明 `T(c) = α|Sentiment| + β·ActionDensity + γ·Conflict`，实现（L55）为 `0.55*actionDensity + 0.45*sentimentValence`——**`γ·Conflict` 项根本不存在**。

**问题二（更严重）：情感项混淆了 valence 与 arousal。**

```ts
const sentimentValence = Math.min(1.0, Math.abs(positiveWords - negativeWords) / 10)  // L52
```

实证：

```
纯悲伤独白        pos= 0 neg=20 → valence=1.00
悲喜交加/强烈冲突  pos=15 neg=15 → valence=0.00   ← 情感冲突最激烈，得 0 分
平淡叙述          pos= 2 neg= 3 → valence=0.10
纯大团圆          pos=20 neg= 0 → valence=1.00
```

在 Russell 情感环状模型中，**valence（效价，-到+）与 arousal（唤醒度，低到高）是两个正交维度**。叙事"张力"对应的是 arousal，不是 valence 净值。`|正面 - 负面|` 衡量的是情感**偏向**，导致悲喜交加（高 arousal）被判为最低张力，纯悲/纯喜（单一极性）被判为最高。**结论与叙事学直觉完全相反。**

> 修复：`arousal = (positive + negative) / K`，保留 valence 仅用于判断情感方向（悲/喜），二者分别作为独立项进入张力公式。

**问题三：密度归一化引入长度偏差。** `actionDensity = combatWords / (text.length/100)`（L47）：

```
章节 3000 字，战斗词 25 → 0.833
章节  300 字，战斗词 25 → 1.000（饱和）
```

同样的写作密度，长章节被系统性压低，短章节饱和。

**问题四：空文本返回伪造值**（L30-41）：空文本返回 `tensionScore: 0.3, pacingStatus: "optimal"`。

**问题五：接口与实现断层。** `analyzeChapter(text, _chapterId, _chapterOrder)`——后两个参数以下划线前缀标记未使用。断章雷达**无法利用章节在全书中的序号**，而"黄金三章""30 章锈蚀警报"这类同类逻辑本该依赖它。接口设计了上下文，实现没接。

**问题六：断章分类器是关键词链 + 兜底**，非"4 大黄金分类器"。`tailSnippet.includes("原来")` 之类（L67-79），而"原来"是极高频中文词，几乎任何解释性结尾都会命中 `info_twist`，分布严重偏斜；未命中任何关键词时**兜底为 `life_and_death`**。

### 3.2 volume-master：`apexRatio` 把"最低谷"当作"高潮顶点"上报（实证误差 0.842）

`plugins/volume-master/engine/VolumeMasterEngine.ts:86`

```ts
const apexRatio = beta2 !== 0 ? -beta1 / (2 * beta2) : 0
```

二次函数 `y = β₂x² + β₁x + β₀` 的驻点 `-β₁/(2β₂)`：
- `β₂ < 0`（开口向下）→ **极大值**，确为高潮顶点 ✓
- `β₂ > 0`（开口向上）→ **极小值**，是最低谷 ✗

代码不检查符号，一律命名为 `apex`（顶点），再 clamp 到 [0,1]。实证：

| 场景 | β₂ | 拟合驻点 | clamp 后输出 | 数据真实最高点 | 误差 |
|---|---|---|---|---|---|
| S1 标准单峰弧 | -1.577 | 0.732 | 0.732 | 0.632 | 0.100 ✓ |
| **S2 网文：上升 + 卷末 88% 大高潮** | **+0.724** | **-0.034** | **0.000** | **0.842** | **0.842 ✗** |
| S3 U 型：高开-低谷-回升 | +2.025 | 0.451 | 0.451 | 1.000 | 0.549 ✗ |

**S2 恰恰是中国网文最典型的节奏形态**（持续上升 + 卷末大高潮），即该缺陷在最高频场景下最严重：插件告诉用户"高潮顶点在 0% 处"，实际在 84% 处。而 clamp 操作进一步抹去了"驻点落在区间外"这一**模型不适用**的关键信号。

**另：数据不足时返回伪造的完美拟合**（L104）：

```ts
if (n < 3) return { r2: 1.0, apexPositionRatio: 0.75 }
```

同文件 L144 注释明确写着"杜绝伪造假数据"。此处恰返回 `r2 = 1.0` 的假数据，且 `0.75` 是硬编码的"理想顶点"。

> 修复：`β₂ > 0` 时不应输出 apex（应输出"张力单调上升，无单峰顶点"，或改报驻点为极小值）；驻点越界时应透传越界事实而非 clamp；`n < 3` 应返回 `null` 而非 1.0。

### 3.3 water-meter：香农熵公式正确，但与"水分"无理论关联

`plugins/water-meter/engine/WaterMeterEngine.ts:43-61`

公式 `H = -Σ p·log₂p` 实现无误，问题在**用错了对象**：

**（1）字符熵不衡量"水分"。** 一阶字符熵衡量的是**用字丰富度**（type-token ratio 的信息论版本）。词典雅但信息稀薄的环境描写 → 高熵；信息密集但高频字重复的紧凑对话 → 低熵。熵与水分**不相关甚至负相关**。

**（2）熵随文本长度系统性增长，与风格无关。** 实证（同一词库、同一随机过程、风格完全恒定，仅改变长度）：

```
 50 字 → 4.61      500 字 → 5.25     5000 字 → 5.32
100 字 → 5.02     1000 字 → 5.28    10000 字 → 5.32
```

差异 0.67 bits **纯粹来自样本量**（plug-in 估计量的系统负偏差 `E[Ĥ] ≈ H - (m-1)/(2N ln2)`）。而判据 `entropy < 5.0 && totalWordCount > 100`（L151）中的 `> 100` 只是部分规避，**未做归一化**。用真实中文（字表约 3000，log₂≈11.6）时欠采样更严重。

**（3）评分权重无出处。** L146-153：

```ts
score += (0.06 - actionVerbRatio) * 600      // 系数 600
score += Math.min(45, clicheRatio * 500)     // 系数 500
score += (5.0 - entropyScore) * 12           // 系数 12
```

三项线性叠加，无任何校准（calibration）依据。另 `ACTION_VERBS.includes(char)` 对每个字符做数组线性搜索（O(n·m)），且**按单字判定动词**在语言学上不成立（"打"在"打量/打架/打水"中词性各异）。

### 3.4 combat-sandbox：Sigmoid 在主角占优时方向信息完全丢失

`plugins/combat-sandbox/engine/CombatSandboxEngine.ts:33`

```ts
const deltaLogE = eTier.energyLog10 - pTier.energyLog10
if (deltaLogE <= 0) return 0.5    // 注释写"势均力敌或主角高"
```

实证（"压制率"= 敌人对主角的压制程度）：

```
主角筑基 vs 敌人金丹（差 1 大阶） → 0.802
主角筑基 vs 敌人渡劫（差 6 大阶） → 1.000
主角金丹 vs 敌人筑基（主角占优 1 阶） → 0.500   ← 应为 ~0
主角渡劫 vs 敌人筑基（主角占优 6 阶） → 0.500   ← 应为 ~0
```

主角碾压敌人时压制率恒为 0.5。虽然 `auditPowerBreach`（L63）在 `diff <= 0` 时提前返回，使主流程未受影响，但作为 **public static API**，任何外部调用者都会拿到错误结果。

**另：fallback 与查表标度不一致**（L29-30）。`rankValue=10` 查表得 `energyLog10=3.0`，未命中时 fallback `rankValue * 0.2` 得 `2.0`——同一 rankValue 在两条路径下相差整整一个大阶，产生边界跳变。

**另：`generateFourPhaseTemplate`（L129-175）是 100% 硬编码模板。** 除人名与技法名字符串插值外，输出与输入无关，四段拆招链恒定。API 名为"generate"，实为模板填充。

### 3.5 diff-reviewer：CRLF 丢失 + 采纳静默失败

`plugins/diff-reviewer/engine/DiffReviewerEngine.ts`

**（1）行尾符丢失（Windows 桌面应用的真实缺陷）**：L148 用 `/\r?\n/` 切分，L242 用 `resultLines.join("\n")` 重组——CRLF 文档的所有 `\r` 被静默吞掉。

**（2）hunk 匹配失败时静默跳过**：L208-218，若 `matchIdx === -1`（锚定与回退均未命中），该 hunk 被直接跳过，**不上报、不抛错**。用户点击"采纳"后文本未变，且无从得知原因。

**（3）词级 diff 按位置配对而非相似度**：`enrichWordTokens`（L107-129）以索引顺序配对 removed/added。`-a -b +c` 会把 `a` 与 `c` 配对，产生误导性高亮。

**（4）"Myers 算法"的表述**：实现调用 `diff` 包的 `structuredPatch`（Myers 在 jsdiff 内部）。**复用成熟库是正确的工程决策**，但插件描述与文件头将其列为"核心算法"，属于自研成分的夸大。

### 3.6 consistency-sentinel：O(n³) 闭包在循环内重建

见 §1.2。

---

## 四、被推翻的两条预判（负面结果记录）

评估前依据数值分析理论提出两条批评，经实证复现后**均不成立，予以撤回**：

**撤回一：Cramer 法则解 OLS 正规方程组存在数值失效。**
理论依据是 `cond(XᵀX) = cond(X)²` 且多项式基构成 Hilbert 类病态矩阵。但实测表明，对 3×3 二次多项式回归（`cond(XᵀX) ≈ 524`）在 n=40 规模下：

```
真值:              β0=0.3,      β1=0.5,      β2=0.2
x∈[0,1] 归一化:    β0=0.300000, β1=0.500000, β2=0.200000
x=1..40 (真值应为): β0=0.287331, β1=0.012537, β2=0.000131
x=1..40 (实际拟合): β0=0.287311, β1=0.012558, β2=0.000131   ← 吻合，相对误差 ~0.1%
```

**在当前调用路径（x 已归一化到 [0,1]）与合理数据规模下，精度可接受。** 残余风险仅存在于 x 跨度极小的退化情形（实测此时会正确触发奇异分支）。建议降级为：改用 QR 分解是稳健性改进而非缺陷修复；但**奇异时的静默返回全 0（r²=0 被当作"拟合度为零"而非"无法计算"）仍是缺陷**。

**撤回二：`R² < 0.25` 阈值对真实网文节奏误报。**
原判依据是单峰二次函数无法拟合多峰锯齿。实测（各采样 200 次）：

```
健康网文节奏（每3章小高潮 + 上升 + 卷末大高潮）：中位 R²=0.807，误报率 0.0%
随机混乱节奏：                                    中位 R²=0.078，检出率 88.0%
```

因整体上升趋势可被二次项有效捕捉，锯齿仅为小幅扰动。**该阈值判别力良好，误报率与检出率均达标。**

---

## 五、相容性矩阵

| 维度 | 状态 | 证据 |
|---|---|---|
| **仓储接口签名一致性** | ✗ 失效 | 46 个端口中 4 个 `getAll()` 无 projectId，跨项目串数据 |
| **查询效率契约** | ✗ 失效 | 41 张表定义 20+ 索引，使用数 0；37 处全表扫描 |
| **跨插件事件契约** | ✗ 形同虚设 | 8 条链路 0 条闭合；无 replay 机制 |
| **共享词汇表复用** | ✗ 薄弱 | `domain/lexicon/NarrativeLexicon` 仅被 2/44 插件使用 |
| **插件间评分一致性** | ✗ 无保证 | 各插件自建词表与公式，同一段文本可能得到互相矛盾的评分 |
| **依赖方向约束** | ✗ 未执行 | 34% 插件文件直引 adapters，守卫检测不到 |
| **类型安全** | ✓ 良好 | `tsc -b` 零错误，事件 payload 强类型映射 |
| **加载隔离** | ✓ 良好 | 44 插件全量 lazy()，首屏无冗余 |
| **失败隔离** | ✓ 良好 | `ErrorBoundary` + `PluginSuspenseFallback` 逐级兜底 |

**词汇表碎片化的具体后果**：water-meter 判"套话水词"、narrative-linter 判"语病"、rhythm-radar 判"低张力"，三者各自维护正则表且互不引用。用户在一章内可能同时收到"文字精炼度极佳"（water-meter）与"节奏拖沓"（rhythm-radar）的矛盾提示，而系统无任何仲裁或解释机制。

---

## 六、第一性原理判断：形态 vs 实质

从"插件系统为何存在"这一根本问题出发——插件系统的价值在于**让第三方能力以受控方式扩展宿主，且扩展点数量与质量决定系统上限**。

### 当前插件实际拥有的扩展点

| 扩展点 | 是否可用 | 备注 |
|---|---|---|
| 渲染主视图 `mainView` | ✓ | 44/44 实现 |
| 渲染写作抽屉 `drawerSnippetView` | △ | 43/44 实现，但**单实例**（`activeDrawerPluginId` 是单个 string），任一时刻仅 1 个可见 |
| AI 能力增强 `aiCapabilities` | ✗ | 0/44 实现，死接口 |
| 订阅跨插件事件 | ✗ | 无发射源 |
| 注册命令 / 快捷键 | ✗ | 无此扩展点 |
| 扩展编辑器（节点/装饰/快捷键） | ✗ | 无此扩展点 |
| 声明对其他插件的依赖 | ✗ | 无依赖声明机制 |
| 读写其他插件的数据 | ✗ | 每个插件独占私有表 |

### 缺失的系统级机制

- **无 API 版本协商**：44 个插件版本全是 `1.0.0`，宿主无从判断兼容性。
- **无生命周期钩子**：没有 `onActivate` / `onDeactivate`，插件无法在禁用时清理资源或释放 IndexedDB 连接。
- **无权限 / 沙箱模型**：全部插件同进程、同 bundle、共享完整 `mutateActiveChapter` 写权限。任何一个插件都可无约束改写用户正文。
- **无能力声明**：宿主无法在加载前得知插件需要哪些端口，也就无法做静态校验。

### 判定

**这是一个"44 个独立小应用 + 统一侧边栏入口"的集合，而非插件系统。**

插件之间无通信、无共享领域模型、无依赖、无仲裁，每个插件是一个孤岛式的"数据表单 + 若干启发式函数"。它完成了插件系统的**外壳**（注册、懒加载、启用开关、分类、错误隔离），但没有建立插件系统的**内核**（扩展点契约、能力协商、跨域协同）。

好消息是：外壳的质量相当高（类型安全、懒加载、错误隔离、557 个测试），这为内核的补建提供了可靠地基。

---

## 七、修复优先级

> 深度审计覆盖：7 个引擎（living-codex / consistency-sentinel / water-meter / volume-master / combat-sandbox / rhythm-radar / diff-reviewer）。其余 37 个插件的分级基于静态指标（引擎行数、外部库依赖、词表复用、正则密度）推断，**置信度中等**，建议按下列优先级逐个复核。

### P0（阻断性，建议立即处理）

1. **租户隔离修复**：为 `archetype` / `expectation` / `readerHook` / `sprint` 四个仓储的 `getAll()` 补充 `projectId` 参数。这是唯一会造成**跨项目数据串味**的缺陷。
2. **事件总线补 replay 或改为派生状态**：环形缓冲 + 订阅时重放，否则 §2.1 的 8 条链路永远不会工作。在补完之前，建议**删除 4 个无人接收的 emit**，它们是纯开销。
3. **`emit` 支持异步**：改签名为 `Promise<void>` 并 `await` 监听器，或显式限定监听器必须为同步。
4. **`apexRatio` 符号修复**：`β₂ > 0` 时不得输出为"高潮顶点"（当前误差达 0.842，且发生在最典型的网文节奏上）。
5. **diff-reviewer CRLF 与静默失败**：`join` 改用原始行尾符；hunk 匹配失败必须上报。

### P1（正确性，影响建议可信度）

6. **rhythm-radar 情感项改用 arousal**：`(positive + negative) / K`，保留 valence 仅判方向；同时补上文档声称却缺失的 `γ·Conflict` 项。
7. **water-meter 熵归一化或降级**：按文本长度归一化，或将其从"水分判据"降级为"用字丰富度参考指标"，不再参与水分评分。
8. **combat-sandbox Sigmoid 方向修复**：`deltaLogE < 0` 时应返回接近 0 的压制率而非 0.5；统一 fallback 与查表标度。
9. **架构守卫补 adapters 检测**：在 `FORBIDDEN_PATTERNS` 增加 `/from\s+['"][^'"]*\/adapters\//`，逐层（含 plugins / components / core）。预计会暴露 94 个文件，需分批改迁。
10. **索引启用**：将 37 处 `getAll()` + filter 改为 `db.getByIndex('projectId', projectId)`。schema 已就绪，属低风险高收益。

### P2（架构演进，决定系统上限）

11. **建立共享领域模型**：把散落在 44 个插件中的章节分析结果收敛为统一的 `ChapterAnalysis` 聚合，各插件写入各自维度、读取全部维度——这比事件总线更适合懒加载场景，也是解决 §5 "评分互相矛盾"的根本途径。
12. **补齐扩展点**：命令注册、编辑器扩展、能力声明、生命周期钩子、API 版本字段。
13. **清理死代码**：`WriterDesk.tsx` 仅被测试引用（生产零引用），却占用 200+ 行测试维护；`aiCapabilities` 接口若无实现计划建议移除；`refreshBookHierarchy` 要么实现要么删除，不可保留 no-op。
14. **测试语义补强**：`crossPluginEvents.test.ts` 应断言"存在真实接收方"而非仅断言"发射了事件"；为 §3 中每个实证场景补充回归用例。

---

## 八、总结

**工程实现能力是扎实的，设计判断力出现了偏差。**

`tsc -b` 零错误、557 个测试全绿、44 个插件全量懒加载、Aho-Corasick 带脏标记优化——这些都证明团队具备交付高质量代码的能力。

问题出在**对"算法辅助创作"这一命题的难度估计不足**。把香农熵、OLS 回归、Sigmoid 概率引入文学分析，本身是有野心的尝试；但这些工具的**适用条件**被跳过了：熵的样本量依赖、回归的模型设定、情感极性与唤醒度的区分。当公式的形式正确性被当作语义正确性时，系统就会以数学的权威语气给出错误的创作建议——这比不给建议更危险，因为用户会信任它。

同时，**"跨插件联动"这个最吸引人的设计目标，目前只有类型定义和单元测试，没有运行时实现**。它是整个插件系统叙事的核心，也是当前最大的落差点。

建议的推进顺序：**先堵数据正确性（P0-1），再修算法语义（P0-4 ~ P1-8），最后补架构内核（P2）**。前两步能让现有 44 个插件从"看起来能用"变成"真的可用"；第三步决定这套系统能否支撑第三方生态。
