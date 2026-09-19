import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DesktopPluginHostProvider } from '../core/pluginHostContext'
import { SubtextMasterView } from './subtext-compiler/components/SubtextMasterView'

const pluginRoot = dirname(fileURLToPath(import.meta.url))

const taskBoundaries = [
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
  ['emotion-curve/components/EmotionCurveMasterView.tsx', /content:\s*semanticTextFromContent/],
  ['expectation-engine/components/ExpectationMasterView.tsx', /title:\s*semanticTextFromContent/],
  ['faction-matrix/components/FactionMatrixMasterView.tsx', /reason:\s*semanticTextFromContent/],
  [
    'gold-chapters-eval/components/GoldChaptersMasterView.tsx',
    /openingText:\s*semanticTextFromContent/,
  ],
  [
    'multi-calendar/components/MultiCalendarMasterView.tsx',
    /semanticTextFromContent\(c\.id, c\.content/,
  ],
  ['narrative-linter/components/NarrativeLinterMasterView.tsx', /text:\s*semanticTextFromContent/],
  [
    'paywall-sentry/components/PaywallSentryMasterView.tsx',
    /semanticTextFromContent\(c\.id, c\.content/,
  ],
  ['promise-ledger/components/LedgerMasterView.tsx', /semanticTextFromContent[\s\S]*e\.plantNote/],
  ['reader-hook/components/ReaderHookMasterView.tsx', /endingText:\s*semanticTextFromContent/],
  [
    'reader-simulator/components/ReaderSimulatorMasterView.tsx',
    /semanticTextFromContent\(\s*currentChapter\.id/,
  ],
  ['safe-gate/components/SafeGateView.tsx', /text:\s*semanticTextFromContent/],
  ['scene-beats/components/SceneBeatsMasterView.tsx', /synopsis:[\s\S]*semanticTextFromContent/],
  [
    'sub-plot-braid/components/SubPlotBraidMasterView.tsx',
    /semanticTextFromContent[\s\S]*s\.summary/,
  ],
  ['subtext-compiler/components/SubtextMasterView.tsx', /spoken:\s*semanticTextFromContent/],
  ['timeline-grid/components/TimelineGridView.tsx', /semanticTextFromContent\(c\.id, c\.content/],
  ['volume-master/components/VolumeMasterMasterView.tsx', /conflict:\s*semanticTextFromContent/],
  ['water-meter/components/WaterMeterMasterView.tsx', /text:\s*semanticTextFromContent/],
] as const

const runtimeBoundaries = [
  [
    'diff-reviewer/components/DiffReviewerMasterView.tsx',
    /oldText:\s*semanticSourceText[\s\S]*newText:\s*semanticProposedText/,
  ],
  ['memory-palace/components/MemoryPalaceMasterView.tsx', /content:\s*semanticTextFromContent/],
  [
    'multiverse-whatif/components/MultiverseMasterView.tsx',
    /canonChapters:\s*canonChapters\.map[\s\S]*divergencePremise:\s*semanticTextFromContent/,
  ],
  [
    'press-forge/components/PressForgeMasterView.tsx',
    /semanticTextFromContent[\s\S]*rawContent:\s*currentChapterText/,
  ],
  [
    'scrapbook-recycler/components/ScrapbookMasterView.tsx',
    /contextText:\s*semanticTextFromContent[\s\S]*snippet:\s*semanticTextFromContent/,
  ],
  ['storyboard-gen/components/StoryboardMasterView.tsx', /chapterText:\s*semanticTextFromContent/],
] as const

const readBoundarySource = (relativePath: string) =>
  readFileSync(resolve(pluginRoot, relativePath), 'utf8')

describe('plugin AI input boundaries', () => {
  it('audits all 22 runPluginTask and six Runtime tool/workflow call sites', () => {
    for (const [relativePath, projectionPattern] of taskBoundaries) {
      const source = readBoundarySource(relativePath)
      expect(source).toMatch(/runPluginTask\(/)
      expect(source).toMatch(projectionPattern)
    }

    for (const [relativePath, projectionPattern] of runtimeBoundaries) {
      const source = readBoundarySource(relativePath)
      expect(source).toMatch(/runPluginTool\(|runPluginWorkflow\(/)
      expect(source).toMatch(projectionPattern)
    }

    const allSources = [...taskBoundaries, ...runtimeBoundaries].map(([relativePath]) =>
      readBoundarySource(relativePath),
    )
    const taskCallCount = allSources.reduce(
      (count, source) => count + (source.match(/runPluginTask\(/g)?.length ?? 0),
      0,
    )
    const runtimeCallCount = allSources.reduce(
      (count, source) =>
        count + (source.match(/runPluginTool\(|runPluginWorkflow\(/g)?.length ?? 0),
      0,
    )

    expect(taskCallCount).toBe(22)
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
    fireEvent.change(spokenInput!, { target: { value: '<p>表面台词</p><p>第二句</p>' } })
    fireEvent.click(screen.getByRole('button', { name: 'AI 潜台词与微表情深度编译' }))

    await waitFor(() => expect(onAiTask).toHaveBeenCalledTimes(1))
    const task = onAiTask.mock.calls[0][0] as {
      input?: { payload?: { analysisInput?: { spoken?: string } } }
    }
    expect(task.input?.payload?.analysisInput?.spoken).toBe('表面台词\n第二句')
  })
})
