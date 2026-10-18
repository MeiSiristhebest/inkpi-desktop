import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DesktopPluginHostProvider } from '../core/pluginHostContext'
import { ArchetypeMasterView } from './archetype-cards/components/ArchetypeMasterView'
import { BrainstormSparkMasterView } from './brainstorm-spark/components/BrainstormSparkMasterView'
import { ShadowReaderMasterView } from './shadow-reader/components/ShadowReaderMasterView'
import { SubtextMasterView } from './subtext-compiler/components/SubtextMasterView'

const pluginRoot = dirname(fileURLToPath(import.meta.url))
const brainstormPlaceholders = {
  coreProblem: '例：主角被困在一处既打不过也退不走的死地',
  currentSituation: '例：合围还在收紧，能用的筹码已经见底',
  protagonistGoal: '例：活着脱身，同时不丢掉最关键的那一样东西',
  enemyAdvantage: '例：对方握着主角无法正面抗衡的人数与规矩',
}

const taskBoundaries = [
  [
    'archetype-cards/components/ArchetypeMasterView.tsx',
    /const semanticContext = semanticTextFromContent[\s\S]*const semanticMaterials = cards\.map\(\(card\) => \(\{[\s\S]*name:\s*semanticTextFromContent[\s\S]*coreDesire:\s*semanticTextFromContent[\s\S]*fatalFlaw:\s*semanticTextFromContent[\s\S]*typicalBehaviors:\s*card\.typicalBehaviors\.map[\s\S]*semanticTextFromContent[\s\S]*conflictPrompt:\s*semanticTextFromContent[\s\S]*materials:\s*semanticMaterials[\s\S]*actualSceneAndConstraints:\s*semanticContext/,
  ],
  [
    'brainstorm-spark/components/BrainstormSparkMasterView.tsx',
    /const semanticInput = \{[\s\S]*coreProblem:\s*semanticTextFromContent[\s\S]*currentSituation:\s*semanticTextFromContent[\s\S]*protagonistGoal:\s*semanticTextFromContent[\s\S]*enemyAdvantage:\s*semanticTextFromContent[\s\S]*knownResources:[\s\S]*semanticTextFromContent[\s\S]*constraints:[\s\S]*semanticTextFromContent[\s\S]*generateSolutions\(semanticInput\)[\s\S]*buildAnalysisInput\(semanticInput\)/,
  ],
  [
    'chekhov-radar/components/ChekhovRadarMasterView.tsx',
    /semanticTextFromContent\(c\.id, c\.content/,
  ],
  ['clue-weaver/components/ClueWeaverMasterView.tsx', /text:\s*semanticTextFromContent/],
  ['combat-sandbox/components/CombatSandboxMasterView.tsx', /stakes:\s*semanticTextFromContent/],
  ['consistency-sentinel/components/ConsistencyMasterView.tsx', /text:\s*semanticTextFromContent/],
  [
    'dialogue-distiller/components/DialogueDistillerMasterView.tsx',
    /text:\s*semanticTextFromContent/,
  ],
  ['emotion-curve/components/EmotionCurveMasterView.tsx', /text:\s*semanticTextFromContent/],
  ['expectation-engine/components/ExpectationMasterView.tsx', /content:\s*semanticTextFromContent/],
  [
    'faction-matrix/components/FactionMatrixMasterView.tsx',
    /authorRelationships:\s*relationships\.map\([\s\S]*?notes:[\s\S]*?semanticTextFromContent[\s\S]*?rippleRationale:[\s\S]*?semanticTextFromContent/,
  ],
  [
    'gold-chapters-eval/components/GoldChaptersMasterView.tsx',
    /buildAnalysisInput\(\s*semanticTextFromContent/,
  ],
  [
    'multi-calendar/components/MultiCalendarMasterView.tsx',
    /(?:semanticTextFromContent\(c\.id, c\.content|buildChronologyScanInput\(chapters\))/,
  ],
  ['multiverse-whatif/components/MultiverseMasterView.tsx', /ai\.run\(semanticInput\)/],
  ['narrative-linter/components/NarrativeLinterMasterView.tsx', /text:\s*semanticTextFromContent/],
  [
    'paywall-sentry/components/PaywallSentryMasterView.tsx',
    /semanticTextFromContent\(c\.id, c\.content/,
  ],
  [
    'promise-ledger/components/LedgerMasterView.tsx',
    /promises:\s*entries\.map\([\s\S]*plantNote:[\s\S]*semanticTextFromContent[\s\S]*progressHistory:\s*entry\.progressHistory\.map[\s\S]*note:\s*semanticTextFromContent[\s\S]*payoffNote:[\s\S]*semanticTextFromContent/,
  ],
  ['reader-hook/components/ReaderHookMasterView.tsx', /endingText:\s*semanticTextFromContent/],
  [
    'reader-simulator/components/ReaderSimulatorMasterView.tsx',
    /semanticTextFromContent\(\s*currentChapter\.id/,
  ],
  ['safe-gate/components/SafeGateView.tsx', /text:\s*semanticTextFromContent/],
  [
    'shadow-reader/components/ShadowReaderMasterView.tsx',
    /const semanticChapterText = semanticTextFromContent[\s\S]*wordCount:\s*semanticChapterText\.length[\s\S]*ShadowReaderEngine\.simulate\([\s\S]*semanticChapterText[\s\S]*!semanticChapterText\.trim\(\)[\s\S]*buildAnalysisInput\([\s\S]*semanticChapterText/,
  ],
  ['storyboard-gen/components/StoryboardMasterView.tsx', /ai\.run\(analysisInput\)/],
  [
    'scene-beats/components/SceneBeatsMasterView.tsx',
    /const semanticPlan = plan\s*\?\s*\{[\s\S]*beats:\s*plan\.beats\.map[\s\S]*title:[\s\S]*semanticTextFromContent[\s\S]*goalOrConflict:[\s\S]*semanticTextFromContent[\s\S]*notes:[\s\S]*semanticTextFromContent[\s\S]*authorPlan:\s*semanticPlan/,
  ],
  [
    'sub-plot-braid/components/SubPlotBraidMasterView.tsx',
    /const semanticStrands = strands\.map\([\s\S]*title:[\s\S]*semanticTextFromContent[\s\S]*summary:[\s\S]*semanticTextFromContent[\s\S]*involvedCharacterNames:\s*strand\.involvedCharacterNames\.map[\s\S]*semanticTextFromContent[\s\S]*convergenceNote:[\s\S]*semanticTextFromContent[\s\S]*lastProgressNote:[\s\S]*semanticTextFromContent[\s\S]*tags:\s*strand\.tags\.map[\s\S]*semanticTextFromContent[\s\S]*strands:\s*semanticStrands/,
  ],
  ['subtext-compiler/components/SubtextMasterView.tsx', /spoken:\s*semanticTextFromContent/],
  [
    'timeline-grid/components/TimelineGridView.tsx',
    /chapterSources:\s*chaptersList\.map[\s\S]*text:\s*semanticTextFromContent\(chapter\.id,\s*chapter\.content,\s*chapter\.revision\)/,
  ],
  [
    'volume-master/components/VolumeMasterMasterView.tsx',
    /const semanticPlan = \{[\s\S]*coreConflict:[\s\S]*semanticTextFromContent[\s\S]*climaxNode:[\s\S]*semanticTextFromContent[\s\S]*rewardOutcome:[\s\S]*semanticTextFromContent[\s\S]*crossVolumeCliffhanger:[\s\S]*semanticTextFromContent[\s\S]*constraints:[\s\S]*semanticTextFromContent[\s\S]*authorPlan:\s*\{\s*\.\.\.semanticPlan/,
  ],
  ['water-meter/components/WaterMeterMasterView.tsx', /text:\s*semanticTextFromContent/],
] as const

const runtimeBoundaries = [
  [
    'diff-reviewer/components/DiffReviewerMasterView.tsx',
    /oldText:\s*semanticSourceText[\s\S]*newText:\s*semanticProposedText/,
  ],
  [
    'memory-palace/components/MemoryPalaceMasterView.tsx',
    /runtimeChapters\s*=\s*useMemo\([\s\S]*?chapters\.map\([\s\S]*?content:\s*semanticTextFromContent[\s\S]*?chapters:\s*runtimeChapters/,
  ],
  [
    'multiverse-whatif/components/MultiverseMasterView.tsx',
    /const semanticPremise = semanticTextFromContent[\s\S]*const semanticEvents: BranchEvent\[\] = events\.map[\s\S]*eventSummary:\s*semanticTextFromContent[\s\S]*assumptions:[\s\S]*semanticTextFromContent[\s\S]*consequences:[\s\S]*semanticTextFromContent[\s\S]*premiseLink:[\s\S]*semanticTextFromContent[\s\S]*branchEvents:\s*semanticEvents[\s\S]*runPluginWorkflow[\s\S]*semanticInput[\s\S]*ai\.run\(semanticInput\)/,
  ],
  [
    'press-forge/components/PressForgeMasterView.tsx',
    /semanticTextFromContent[\s\S]*rawContent:\s*currentChapterText/,
  ],
  [
    'scrapbook-recycler/components/ScrapbookMasterView.tsx',
    /const semanticContext = semanticTextFromContent[\s\S]*const semanticFragments = fragments\.map\([\s\S]*snippet:\s*semanticTextFromContent[\s\S]*contextText:\s*semanticContext[\s\S]*fragments:\s*semanticFragments/,
  ],
  [
    'storyboard-gen/components/StoryboardMasterView.tsx',
    /const sourceText =[\s\S]*manualText[\s\S]*const text = semanticTextFromContent[\s\S]*semanticCharacters = characters\.map[\s\S]*visualFeatures:[\s\S]*semanticTextFromContent[\s\S]*artStyle:[\s\S]*semanticTextFromContent[\s\S]*sceneGoal:[\s\S]*semanticTextFromContent[\s\S]*chapterText:\s*text[\s\S]*context[\s\S]*buildAnalysisInput[\s\S]*chapterText:\s*text[\s\S]*ai\.run\(analysisInput\)/,
  ],
] as const

const readBoundarySource = (relativePath: string) =>
  readFileSync(resolve(pluginRoot, relativePath), 'utf8')

describe('plugin AI input boundaries', () => {
  it('audits all 27 plugin task-seam and six Runtime tool/workflow call sites', () => {
    for (const [relativePath, projectionPattern] of taskBoundaries) {
      const source = readBoundarySource(relativePath)
      expect(source).toMatch(/usePluginAiTask\(/)
      const taskBinding =
        source.match(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*usePluginAiTask\(/)?.[1] ?? ''
      expect(taskBinding, `${relativePath} binds the shared task seam`).not.toBe('')
      expect(source).toMatch(new RegExp(`${taskBinding}\\.run\\(`))
      expect(source).toMatch(projectionPattern)
    }

    for (const [relativePath, projectionPattern] of runtimeBoundaries) {
      const source = readBoundarySource(relativePath)
      expect(source).toMatch(/runPluginTool\(|runPluginWorkflow\(/)
      expect(source).toMatch(projectionPattern)
    }

    const taskSources = taskBoundaries.map(([relativePath]) => readBoundarySource(relativePath))
    const runtimeSources = runtimeBoundaries.map(([relativePath]) =>
      readBoundarySource(relativePath),
    )
    const allSources = [...taskSources, ...runtimeSources]
    const taskCallCount = taskSources.reduce((count, source) => {
      const taskBinding = source.match(
        /\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*usePluginAiTask\(/,
      )?.[1]
      return (
        count +
        (taskBinding ? (source.match(new RegExp(`${taskBinding}\\.run\\(`, 'g'))?.length ?? 0) : 0)
      )
    }, 0)
    const runtimeCallCount = runtimeSources.reduce(
      (count, source) =>
        count + (source.match(/runPluginTool\(|runPluginWorkflow\(/g)?.length ?? 0),
      0,
    )

    expect(taskCallCount).toBe(28)
    expect(runtimeCallCount).toBe(6)

    const directCreativeInputs = [
      /text:\s*(?:scanText|auditText|extractText|inputText)\.slice/,
      /openingText:\s*chaptersText\.slice/,
      /endingText:\s*testText\b/,
      /chapterText:\s*sceneText\b/,
      /divergencePremise:\s*premise\b/,
      /contextText:\s*filterQuery\b/,
      /conflict:\s*editConflict\b/,
      /climax:\s*editClimax\b/,
      /fragments:\s*fragments\b/,
    ]
    for (const source of allSources) {
      for (const directInputPattern of directCreativeInputs) {
        expect(source).not.toMatch(directInputPattern)
      }
    }
  })

  it('projects manually edited HTML before sending a plugin task', async () => {
    const onAiTask = vi.fn(async () => null)
    render(
      <DesktopPluginHostProvider
        projectId="p1"
        activeChapter={null}
        onAiTask={onAiTask}
        isAiConnected
      >
        <SubtextMasterView projectId="p1" />
      </DesktopPluginHostProvider>,
    )

    const spokenInput = screen
      .getAllByRole('textbox')
      .find((element) => element.tagName === 'TEXTAREA')
    expect(spokenInput).toBeDefined()
    fireEvent.change(screen.getByPlaceholderText('填写角色名'), {
      target: { value: '角色甲' },
    })
    fireEvent.change(spokenInput!, { target: { value: '<p>表面台词</p><p>第二句</p>' } })
    fireEvent.click(screen.getByRole('button', { name: 'AI 潜台词方案复核' }))

    await waitFor(() => expect(onAiTask).toHaveBeenCalledTimes(1))
    const task = onAiTask.mock.calls[0][0] as {
      input?: { payload?: { analysisInput?: { input?: { spoken?: string } } } }
    }
    expect(task.input?.payload?.analysisInput?.input?.spoken).toBe('表面台词\n第二句')
  })

  it('projects Archetype Cards scene text and editable author materials before review', async () => {
    const onAiTask = vi.fn(async () => null)
    render(
      <DesktopPluginHostProvider
        projectId="p1"
        activeChapter={null}
        onAiTask={onAiTask}
        isAiConnected
      >
        <ArchetypeMasterView projectId="p1" />
      </DesktopPluginHostProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: '随机抽取双卡对垒' }))
    fireEvent.change(screen.getByLabelText('素材名 1'), {
      target: { value: '<p>守门者</p>' },
    })
    fireEvent.change(screen.getByLabelText('目标 1'), {
      target: { value: '<p>保护港口</p>' },
    })
    const sceneInput = screen.getByRole('textbox', { name: '实际场景与人物限制' })
    fireEvent.change(sceneInput, { target: { value: '<p></p>' } })
    const reviewButton = screen.getByRole('button', { name: 'AI 对手戏方案复核' })
    expect(reviewButton).toBeDisabled()

    fireEvent.change(sceneInput, { target: { value: '<p>风暴前撤离居民</p>' } })
    fireEvent.click(reviewButton)
    await waitFor(() => expect(onAiTask).toHaveBeenCalledTimes(1))

    const task = onAiTask.mock.calls[0][0] as { input?: unknown }
    const submittedInput = JSON.stringify(task.input)
    expect(submittedInput).toContain('守门者')
    expect(submittedInput).toContain('保护港口')
    expect(submittedInput).toContain('风暴前撤离居民')
    expect(submittedInput).not.toContain('<p>')
  })

  it('projects Brainstorm Spark fields and rejects markup-only required input', async () => {
    const onAiTask = vi.fn(async () => null)
    render(
      <DesktopPluginHostProvider
        projectId="p1"
        activeChapter={null}
        onAiTask={onAiTask}
        isAiConnected
      >
        <BrainstormSparkMasterView projectId="p1" />
      </DesktopPluginHostProvider>,
    )

    fireEvent.change(screen.getByPlaceholderText(brainstormPlaceholders.coreProblem), {
      target: { value: '<p></p>' },
    })
    fireEvent.change(screen.getByPlaceholderText(brainstormPlaceholders.currentSituation), {
      target: { value: '出口快塌了' },
    })
    fireEvent.change(screen.getByPlaceholderText(brainstormPlaceholders.protagonistGoal), {
      target: { value: '带同伴撤离' },
    })
    fireEvent.change(screen.getByPlaceholderText(brainstormPlaceholders.enemyAdvantage), {
      target: { value: '追兵熟悉矿道' },
    })

    const reviewButton = screen.getByRole('button', { name: 'AI 受约束方案复核' })
    expect(reviewButton).toBeDisabled()
    fireEvent.change(screen.getByPlaceholderText(brainstormPlaceholders.coreProblem), {
      target: { value: '<p>主角被困在矿道</p>' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: '已有筹码与线索' }), {
      target: { value: '<p>火折子</p>\n旧钥匙' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: '不可改变的条件' }), {
      target: { value: '<p>身份不能暴露</p>' },
    })
    fireEvent.click(reviewButton)
    await waitFor(() => expect(onAiTask).toHaveBeenCalledTimes(1))

    const task = onAiTask.mock.calls[0][0] as { input?: unknown }
    const submittedInput = JSON.stringify(task.input)
    expect(submittedInput).toContain('主角被困在矿道')
    expect(submittedInput).toContain('火折子')
    expect(submittedInput).toContain('身份不能暴露')
    expect(submittedInput).not.toContain('<p>')
  })

  it('projects Shadow Reader edited text before simulation and AI review', async () => {
    const onAiTask = vi.fn(async () => null)
    render(
      <DesktopPluginHostProvider
        projectId="p1"
        activeChapter={null}
        onAiTask={onAiTask}
        isAiConnected
      >
        <ShadowReaderMasterView projectId="p1" />
      </DesktopPluginHostProvider>,
    )

    const chapterInput = screen.getByRole('textbox', { name: /章节正文推演区/ })
    fireEvent.change(chapterInput, { target: { value: '<p></p>' } })
    const reviewButton = screen.getByRole('button', { name: 'AI 阅读顺序复核' })
    expect(reviewButton).toBeDisabled()
    fireEvent.change(chapterInput, {
      target: { value: '<p>她拒绝交出地图。</p><p>她改从旧桥撤离。</p>' },
    })
    fireEvent.click(reviewButton)
    await waitFor(() => expect(onAiTask).toHaveBeenCalledTimes(1))

    const task = onAiTask.mock.calls[0][0] as { input?: unknown }
    const submittedInput = JSON.stringify(task.input)
    expect(submittedInput).toContain('她拒绝交出地图。')
    expect(submittedInput).toContain('她改从旧桥撤离。')
    expect(submittedInput).not.toContain('<p>')
  })
})
