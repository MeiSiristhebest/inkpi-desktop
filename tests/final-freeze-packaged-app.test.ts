// @vitest-environment node
import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { createServer, type Server } from 'node:net'
import { mkdtemp, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import type {
  AiTask,
  SkillManifest,
  TaskExecutionSnapshot,
  TaskStatusSnapshot,
} from '@inkpi/protocol'
import {
  RUNTIME_ARTIFACT_TYPES,
  calculateDomainChangeSetChecksum,
  calculateProposalProjectionStateHash,
} from '@inkpi/protocol'
import { afterEach, describe, expect, it } from 'vitest'
import { bootstrapDesktopTaskRecovery } from '../src/adapters/desktopTaskRecoveryBootstrap'
import { createDaemonAiAssistant } from '../src/adapters/daemonAiAssistant'
import { createDaemonSkillRuntime, FIRST_PARTY_SKILL_IDS } from '../src/adapters/daemonSkillRuntime'
import { inkpiDaemonGateway } from '../src/adapters/inkpiDaemonGateway'
import { IndexedDbTaskRecoveryStore } from '../src/db/taskRecoveryStore'
import type { RpcClient } from '../src/ports/aiGateway'

const execFileAsync = promisify(execFile)
const delay = (milliseconds: number) =>
  new Promise<void>((resolveDelay) => setTimeout(resolveDelay, milliseconds))
const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const tauriConfigPath = join(desktopRoot, 'src-tauri', 'tauri.conf.json')
const mainRustPath = join(desktopRoot, 'src-tauri', 'src', 'main.rs')
const nsisDirectory = join(
  desktopRoot,
  'src-tauri',
  'target',
  'x86_64-pc-windows-gnu',
  'release',
  'bundle',
  'nsis',
)
const expectedSkillFiles = [
  'character-voice.md',
  'hook.md',
  'promise.md',
  'timeline-consistency.md',
] as const
const expectedSkillManifests = {
  'character-voice.md': 'character-voice',
  'hook.md': 'hook',
  'promise.md': 'promise',
  'timeline-consistency.md': 'timeline-consistency',
} as const
const expectedResourceFiles = [
  'WebView2Loader.dll',
  'libgcc_s_seh-1.dll',
  'libwinpthread-1.dll',
] as const

interface TauriBundleConfig {
  targets?: string[]
  externalBin?: string[]
  resources?: Record<string, string>
  icon?: string[]
}

interface TauriConfig {
  productName?: string
  identifier?: string
  build?: {
    frontendDist?: string
    beforeBuildCommand?: string
  }
  app?: {
    windows?: Array<{ label?: string; title?: string }>
  }
  bundle?: TauriBundleConfig
}

interface ArchiveEntry {
  name: string
  size?: number
}

interface PackagedDaemon {
  root: string
  skillsDirectory: string
  child: ChildProcess
  client: RpcClient
  url: string
}

interface NotificationClient extends RpcClient {
  on?: (event: string, listener: (params: unknown) => void) => () => void
}

let ownedTempDirectories: string[] = []

afterEach(async () => {
  const directories = ownedTempDirectories.splice(0)
  await Promise.all(
    directories.map(async (directory) => {
      await rm(directory, { recursive: true, force: true })
    }),
  )
})

describe('Final Freeze: packaged Desktop acceptance', () => {
  it('inspects the current NSIS payload and its startup/resource contract', async ({ skip }) => {
    const installer = await findNsisInstaller()
    if (!installer) {
      skip('SKIP: no NSIS installer; run pnpm run tauri:build first')
      return
    }

    const sevenZip = await findSevenZip()
    if (!sevenZip) {
      skip('SKIP: 7z/7zz is unavailable, so the NSIS payload cannot be inspected')
      return
    }

    const entries = await listNsisEntries(sevenZip, installer)
    const entryByName = new Map(entries.map((entry) => [entry.name.toLowerCase(), entry]))
    const expectedPayload = [
      'inkpi-desktop.exe',
      'inkpi.exe',
      ...expectedSkillFiles.map((file) => `skills/${file}`),
      ...expectedResourceFiles,
    ]

    for (const expected of expectedPayload) {
      const entry = entryByName.get(expected.toLowerCase())
      expect(entry, `NSIS payload is missing ${expected}`).toBeDefined()
      expect(entry?.size ?? 0, `${expected} must not be empty`).toBeGreaterThan(0)
    }

    const extractedManifestRoot = await ownTempDirectory('inkpi-final-freeze-manifests-')
    const extractedSkillsDirectory = join(extractedManifestRoot, 'skills')
    await mkdir(extractedSkillsDirectory)
    await runSevenZip(sevenZip, [
      'e',
      installer,
      'skills\\*.md',
      `-o${extractedSkillsDirectory}`,
      '-y',
    ])
    for (const file of expectedSkillFiles) {
      const body = await readFile(join(extractedSkillsDirectory, file), 'utf8')
      expect(body).toMatch(new RegExp(`^id:\\s*["']?${expectedSkillManifests[file]}["']?$`, 'm'))
      expect(body).toMatch(/^version:\s*\S+/m)
      expect(body).toMatch(/^activation:\s*(eager|lazy|on-demand)\s*$/m)
    }

    const config = JSON.parse(await readFile(tauriConfigPath, 'utf8')) as TauriConfig
    expect(config.productName).toBe('InkPi Desktop')
    expect(config.identifier).toBe('com.inkpi.desktop')
    expect(config.build?.frontendDist).toBe('../dist')
    expect(config.build?.beforeBuildCommand).toBe('npm run build')
    expect(config.bundle?.targets).toContain('nsis')
    expect(config.bundle?.externalBin).toContain('binaries/inkpi')
    expect(config.bundle?.resources).toMatchObject({
      'binaries/skills': 'skills',
      'dlls/WebView2Loader.dll': 'WebView2Loader.dll',
      'dlls/libgcc_s_seh-1.dll': 'libgcc_s_seh-1.dll',
      'dlls/libwinpthread-1.dll': 'libwinpthread-1.dll',
    })
    expect(config.app?.windows?.[0]).toMatchObject({ label: 'main' })

    const mainRust = await readFile(mainRustPath, 'utf8')
    expect(mainRust).toContain('res_dir.join("inkpi.exe")')
    expect(mainRust).toContain('.args(instance_config.daemon_args())')
    expect(mainRust).toContain('cmd.env("INKPI_SKILLS_DIR", skills_dir)')
    expect(mainRust).toContain('Command::new(&bin)')
  })

  const packagedDaemonTest =
    process.env.INKPI_RUN_FINAL_FREEZE_PACKAGED_DAEMON === '1' ? it : it.skip

  packagedDaemonTest(
    '[opt-in: INKPI_RUN_FINAL_FREEZE_PACKAGED_DAEMON=1] runs the packaged sidecar through RPC, activates four Skills, exercises six first-party Runtime registrations, and recovers a task after a forced restart',
    async ({ skip }) => {
      if (process.platform !== 'win32') {
        skip('SKIP: the NSIS sidecar is a Windows executable')
        return
      }

      const installer = await findNsisInstaller()
      if (!installer) {
        throw new Error('NSIS installer not found; run pnpm run tauri:build first')
      }
      const sevenZip = await findSevenZip()
      if (!sevenZip) {
        throw new Error('7z/7zz is required for the opt-in packaged sidecar acceptance')
      }

      const stateRoot = await ownTempDirectory('inkpi-final-freeze-state-')
      const stateDbPath = join(stateRoot, 'state.sqlite')
      const task = makePackagedRecoveryTask()
      let first: PackagedDaemon | undefined
      let second: PackagedDaemon | undefined
      let unsubscribeTaskEvents: (() => void) | undefined

      try {
        first = await launchPackagedDaemon(sevenZip, installer, stateDbPath, 5_000)
        const firstSkillRuntime = createDaemonSkillRuntime(first.client)
        const discovered = await firstSkillRuntime.discover()
        expect(discovered.map((skill) => skill.id).sort()).toEqual(
          [...FIRST_PARTY_SKILL_IDS].sort(),
        )
        for (const skill of discovered as SkillManifest[]) {
          expect(skill.version.trim().length).toBeGreaterThan(0)
          expect(skill.title.trim().length).toBeGreaterThan(0)
        }

        const activated = await firstSkillRuntime.ensureFirstPartySkillsActivated()
        expect(activated.activatedSkills.sort()).toEqual([...FIRST_PARTY_SKILL_IDS].sort())
        expect(activated.loadedSkills.sort()).toEqual([...FIRST_PARTY_SKILL_IDS].sort())
        expect(activated.instructions?.map((instruction) => instruction.id).sort()).toEqual(
          [...FIRST_PARTY_SKILL_IDS].map((skillId) => `skill.${skillId}`).sort(),
        )
        await assertPackagedRuntimeRegistrations(first.client)
        await assertPackagedStateBoundaries(first.client)

        const notificationClient = first.client as NotificationClient
        if (!notificationClient.on) {
          throw new Error('The RPC client does not expose task notifications')
        }
        const checkpointed = new Promise<void>((resolveCheckpoint, rejectCheckpoint) => {
          const timeout = setTimeout(() => {
            unsubscribeTaskEvents?.()
            rejectCheckpoint(new Error('Timed out waiting for packaged task checkpoint'))
          }, 15_000)
          unsubscribeTaskEvents = notificationClient.on!('task.event', (params) => {
            if (!isTaskEventFor(params, task.id, 'checkpointed')) return
            clearTimeout(timeout)
            resolveCheckpoint()
          })
        })

        await expect(first.client.request('task.submit', { task })).resolves.toMatchObject({
          taskId: task.id,
          status: 'queued',
        })
        await checkpointed
        unsubscribeTaskEvents?.()
        unsubscribeTaskEvents = undefined

        await first.client.close().catch(() => undefined)
        await stopPackagedDaemon(first, true)
        first = undefined

        second = await launchPackagedDaemon(sevenZip, installer, stateDbPath)
        const interrupted = await waitForTaskExecution(second.client, task.id, (execution) => {
          return execution.snapshot.status === 'interrupted'
        })
        expect(interrupted.snapshot).toMatchObject<TaskStatusSnapshot>({
          taskId: task.id,
          kind: task.kind,
          status: 'interrupted',
          checkpoint: { step: 'input-validated' },
          error: { code: 'TASK_INTERRUPTED' },
        })

        const projectId = 'final-freeze-packaged-project'
        const store = new IndexedDbTaskRecoveryStore()
        await store.save({
          projectId,
          task,
          snapshot: interrupted.snapshot,
          updatedAt: Date.now(),
        })
        const recoveryReport = await bootstrapDesktopTaskRecovery({
          projectId,
          store,
          getTaskExecution: (taskId) =>
            second!.client.request<TaskExecutionSnapshot>('task.execution', { taskId }),
        })
        expect(recoveryReport.recoveredTaskIds).toEqual([task.id])
        expect(recoveryReport.issues).toEqual([])

        await createDaemonAiAssistant(second.client).resumeTask(task.id)
        const completed = await waitForTaskExecution(second.client, task.id, (execution) => {
          return execution.snapshot.status === 'completed'
        })
        expect(completed.snapshot.result?.status).toBe('completed')
        expect(completed.snapshot.result?.output).toMatchObject({
          format: 'structured',
        })

        const cleanupReport = await bootstrapDesktopTaskRecovery({
          projectId,
          store,
          getTaskExecution: (taskId) =>
            second!.client.request<TaskExecutionSnapshot>('task.execution', { taskId }),
        })
        expect(cleanupReport.completedTaskIds).toEqual([task.id])
        await expect(store.list(projectId)).resolves.toEqual([])
      } finally {
        unsubscribeTaskEvents?.()
        if (first) {
          await first.client.close().catch(() => undefined)
          await stopPackagedDaemon(first, true)
        }
        if (second) {
          await second.client.close().catch(() => undefined)
          await stopPackagedDaemon(second, false)
        }
      }
    },
    60_000,
  )

  it.skip('GUI acceptance remains manual-only: installed NSIS App, WebView2, and real UI interaction are required', () =>
    undefined)
})

async function findNsisInstaller(): Promise<string | undefined> {
  const configured = process.env.INKPI_NSIS_INSTALLER?.trim()
  if (configured) {
    try {
      await stat(configured)
      return configured
    } catch {
      throw new Error(`INKPI_NSIS_INSTALLER does not exist: ${configured}`)
    }
  }

  let entries
  try {
    entries = await readdir(nsisDirectory, { withFileTypes: true })
  } catch {
    return undefined
  }

  const candidates = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('_x64-setup.exe'))
      .map(async (entry) => {
        const path = join(nsisDirectory, entry.name)
        return { path, modifiedAt: (await stat(path)).mtimeMs }
      }),
  )
  return candidates.sort((left, right) => right.modifiedAt - left.modifiedAt)[0]?.path
}

async function findSevenZip(): Promise<string | undefined> {
  for (const executable of ['7z', '7zz']) {
    try {
      await execFileAsync(executable, ['-h'], { windowsHide: true })
      return executable
    } catch {
      // Try the next conventional executable name.
    }
  }
  return undefined
}

async function listNsisEntries(sevenZip: string, installer: string): Promise<ArchiveEntry[]> {
  const { stdout } = await execFileAsync(sevenZip, ['l', '-slt', installer], {
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024,
  })
  return stdout
    .split(/\r?\n\r?\n/)
    .map((block) => {
      const name = block.match(/^Path = (.+)$/m)?.[1]?.trim()
      if (!name) return undefined
      const sizeText = block.match(/^Size = (\d+)$/m)?.[1]
      return { name: normalizeArchivePath(name), ...(sizeText ? { size: Number(sizeText) } : {}) }
    })
    .filter((entry): entry is ArchiveEntry => entry !== undefined)
}

async function launchPackagedDaemon(
  sevenZip: string,
  installer: string,
  stateDbPath: string,
  pauseAfterCheckpointMs = 0,
): Promise<PackagedDaemon> {
  const root = await ownTempDirectory('inkpi-final-freeze-daemon-')
  const skillsDirectory = join(root, 'skills')
  await mkdir(skillsDirectory)
  await runSevenZip(sevenZip, ['e', installer, 'inkpi.exe', `-o${root}`, '-y'])
  await runSevenZip(sevenZip, ['e', installer, 'skills\\*.md', `-o${skillsDirectory}`, '-y'])

  const executable = join(root, 'inkpi.exe')
  const tcpPort = await findFreePort()
  const wsPort = await findFreePort()
  const child = spawn(
    executable,
    [
      'daemon',
      '--model',
      'mock-test',
      '--port',
      String(tcpPort),
      '--ws-port',
      String(wsPort),
      '--state-db',
      stateDbPath,
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        INKPI_STATE_DB: stateDbPath,
        INKPI_SKILLS_DIR: skillsDirectory,
        ...(pauseAfterCheckpointMs > 0
          ? { INKPI_TEST_PAUSE_AFTER_CHECKPOINT_MS: String(pauseAfterCheckpointMs) }
          : {}),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  )
  let output = ''
  const capture = (chunk: Buffer) => {
    output = `${output}${chunk.toString()}`.slice(-12_000)
  }
  child.stdout?.on('data', capture)
  child.stderr?.on('data', capture)
  child.on('error', (error) => capture(Buffer.from(`\n${error.message}`)))

  const url = `ws://127.0.0.1:${wsPort}`
  try {
    const client = await waitForRpcClient(url, child, () => output)
    return { root, skillsDirectory, child, client, url }
  } catch (error) {
    await stopChild(child, true)
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${output}`)
  }
}

async function runSevenZip(sevenZip: string, args: string[]): Promise<void> {
  await execFileAsync(sevenZip, args, {
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024,
  })
}

async function waitForRpcClient(
  url: string,
  child: ChildProcess,
  output: () => string,
): Promise<RpcClient> {
  const deadline = Date.now() + 20_000
  let lastError = 'unknown connection error'
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        `Packaged sidecar exited before RPC became ready (code=${child.exitCode ?? 'null'}, signal=${child.signalCode ?? 'null'}): ${output()}`,
      )
    }
    try {
      return await connectWithoutBrowserWebSocket(url)
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      await delay(100)
    }
  }
  throw new Error(`Timed out connecting to packaged sidecar: ${lastError}\n${output()}`)
}

async function connectWithoutBrowserWebSocket(url: string): Promise<RpcClient> {
  const testGlobal = globalThis as typeof globalThis & { WebSocket?: unknown }
  const browserWebSocket = testGlobal.WebSocket
  testGlobal.WebSocket = undefined
  try {
    return await inkpiDaemonGateway.connect(url)
  } finally {
    testGlobal.WebSocket = browserWebSocket
  }
}

async function waitForTaskExecution(
  client: RpcClient,
  taskId: string,
  predicate: (execution: TaskExecutionSnapshot) => boolean,
): Promise<TaskExecutionSnapshot> {
  const deadline = Date.now() + 20_000
  let latest: TaskExecutionSnapshot | undefined
  while (Date.now() < deadline) {
    latest = await client.request<TaskExecutionSnapshot>('task.execution', { taskId })
    if (predicate(latest)) return latest
    await delay(50)
  }
  throw new Error(`Timed out waiting for task ${taskId}: ${JSON.stringify(latest)}`)
}

async function assertPackagedRuntimeRegistrations(client: RpcClient): Promise<void> {
  const tools = await client.request<Array<{ name: string }>>('tool.list')
  expect(tools.map((tool) => tool.name)).toEqual([
    'plugin.diff-reviewer.compute',
    'plugin.memory-palace.search',
    'plugin.press-forge.format',
    'plugin.scrapbook-recycler.recommend',
  ])

  const toolCalls = [
    {
      toolName: 'plugin.diff-reviewer.compute',
      arguments: { oldText: 'before\nstable', newText: 'after\nstable' },
    },
    {
      toolName: 'plugin.memory-palace.search',
      arguments: {
        query: 'Mira',
        entities: [{ id: 'packaged-hero', name: 'Mira', aliases: ['M'] }],
        chapters: [{ id: 'packaged-chapter', order: 1, title: 'Arrival', content: 'Mira arrives.' }],
      },
    },
    {
      toolName: 'plugin.press-forge.format',
      arguments: { rawContent: 'hello, world!', options: { indentSpaces: 0, paragraphSpacing: 0 } },
    },
    {
      toolName: 'plugin.scrapbook-recycler.recommend',
      arguments: {
        contextText: 'storm ally returns',
        fragments: [{ id: 'packaged-fragment', snippet: 'The storm ally returns.', isReused: false }],
        topK: 1,
      },
    },
  ] as const

  for (const [index, toolCall] of toolCalls.entries()) {
    await expect(
      client.request('tool.execute', {
        toolName: toolCall.toolName,
        toolCallId: `packaged-tool-${index}`,
        arguments: toolCall.arguments,
      }),
    ).resolves.toMatchObject({
      role: 'toolResult',
      toolName: toolCall.toolName,
      isError: false,
    })
  }

  const workflowTasks: AiTask[] = [
    {
      id: `final-freeze-packaged-multiverse-${Date.now()}`,
      kind: 'plugin.multiverse-whatif.workflow',
      input: {
        payload: {
          canonChapters: [
            { index: 1, title: 'Arrival', summary: 'The hero arrives.', entities: ['Mira'] },
            { index: 2, title: 'Storm', summary: 'The storm starts.', entities: ['Mira', 'Rook'] },
          ],
          forkChapterIndex: 2,
          divergencePremise: 'Mira accepts the forbidden alliance.',
        },
      },
      outputContract: { format: 'structured' },
      executionPolicy: { strategy: 'workflow', mode: 'foreground' },
      effectPolicy: { mode: 'read-only' },
    },
    {
      id: `final-freeze-packaged-storyboard-${Date.now()}`,
      kind: 'plugin.storyboard-gen.workflow',
      input: {
        payload: {
          chapterId: 'packaged-chapter',
          chapterTitle: 'The Reversal',
          chapterText: 'Mira crosses the bridge.\nThe rival raises a sword.',
          context: { protagonist: 'Mira', antagonist: 'Rook' },
        },
      },
      outputContract: { format: 'structured' },
      executionPolicy: { strategy: 'workflow', mode: 'foreground' },
      effectPolicy: { mode: 'read-only' },
    },
  ]

  for (const workflowTask of workflowTasks) {
    await expect(client.request('task.submit', { task: workflowTask })).resolves.toMatchObject({
      taskId: workflowTask.id,
      status: 'queued',
    })
    const completed = await waitForTaskExecution(
      client,
      workflowTask.id,
      (execution) => execution.snapshot.status === 'completed',
    )
    expect(completed.snapshot.result).toMatchObject({
      taskId: workflowTask.id,
      kind: workflowTask.kind,
      status: 'completed',
      output: { format: 'structured' },
      provenance: { runtimeClass: 'workflow' },
    })
  }
}

async function assertPackagedStateBoundaries(client: RpcClient): Promise<void> {
  const suffix = Date.now()
  const createdAt = suffix
  const workspaceId = `packaged-boundary-workspace-${suffix}`
  const unsignedChangeSet = {
    id: `packaged-change-set-${suffix}`,
    workspaceId,
    sourceDeviceId: 'packaged-acceptance',
    baseRevision: 0,
    revision: 1,
    changes: [
      {
        id: `packaged-story-change-${suffix}`,
        aggregateType: 'story.state',
        aggregateId: `story-${suffix}`,
        operation: 'upsert' as const,
        revision: 1,
        payload: { revision: 1, entities: [], relations: [], events: [], scenes: [] },
        occurredAt: createdAt,
      },
    ],
    createdAt,
  }
  const changeSet = {
    ...unsignedChangeSet,
    checksum: calculateDomainChangeSetChecksum(unsignedChangeSet),
  }
  await expect(client.request('domain.sync.push', { changeSet })).resolves.toMatchObject({
    accepted: true,
    duplicate: false,
    workspaceId,
    revision: 1,
  })
  await expect(client.request('domain.sync.push', { changeSet })).resolves.toMatchObject({
    accepted: true,
    duplicate: true,
    revision: 1,
  })
  await expect(client.request('domain.sync.pull', { workspaceId })).resolves.toEqual([changeSet])
  const snapshot = await client.request('domain.sync.snapshot', { workspaceId })
  expect(snapshot).toMatchObject({ workspaceId, revision: 1, changeSets: [changeSet] })
  await expect(client.request('domain.sync.restore', { snapshot })).resolves.toMatchObject({
    workspaceId,
    revision: 1,
  })

  const proposal = {
    id: `packaged-proposal-${suffix}`,
    taskId: `packaged-proposal-task-${suffix}`,
    baseRevision: 1,
    sourceHash: 'packaged-source-hash',
    target: { type: 'story.document', id: `chapter-${suffix}` },
    operation: 'update' as const,
    patch: { text: 'Packaged proposal boundary.' },
    status: 'pending' as const,
    createdAt,
    updatedAt: createdAt,
  }
  const stateHash = calculateProposalProjectionStateHash(proposal)
  await expect(
    client.request('proposal.sync.push', {
      workspaceId,
      expectedRevision: 0,
      proposal,
      stateHash,
    }),
  ).resolves.toMatchObject({ accepted: true, duplicate: false, revision: 1 })
  await expect(
    client.request('proposal.sync.push', {
      workspaceId,
      expectedRevision: 0,
      proposal,
      stateHash,
    }),
  ).resolves.toMatchObject({ accepted: true, duplicate: true, revision: 1 })
  await expect(client.request('proposal.sync.snapshot', { workspaceId })).resolves.toMatchObject({
    workspaceId,
    revision: 1,
    proposals: [proposal],
  })

  const artifact = {
    id: `packaged-artifact-${suffix}`,
    type: RUNTIME_ARTIFACT_TYPES.chapterSummary,
    version: 1,
    content: { summary: 'Packaged artifact boundary.' },
    provenance: {
      taskId: `packaged-artifact-task-${suffix}`,
      executionRunId: `run:packaged-artifact-${suffix}`,
      parentArtifactId: `packaged-parent-${suffix}`,
    },
    createdAt,
    updatedAt: createdAt,
  }
  await expect(client.request('artifact.save', { artifact })).resolves.toEqual({
    saved: true,
    id: artifact.id,
  })
  await expect(client.request('artifact.get', { id: artifact.id })).resolves.toEqual(artifact)
  await expect(client.request('artifact.list', { taskId: artifact.provenance.taskId })).resolves.toEqual([artifact])

  const contextTask: AiTask = {
    id: `packaged-context-task-${suffix}`,
    kind: 'packaged.context-cache-probe',
    input: {
      documentId: `packaged-document-${suffix}`,
      text: 'Packaged context boundary.',
      payload: { workspaceId, activeReferences: [] },
    },
    contextPolicy: { providerIds: ['retrieval.jit'], maxTokens: 512 },
    outputContract: { format: 'text' },
    requirements: { outputFormats: ['text'] },
  }
  await expect(client.request('task.submit', { task: contextTask })).resolves.toMatchObject({
    taskId: contextTask.id,
    status: 'queued',
  })
  const contextExecution = await waitForTaskExecution(
    client,
    contextTask.id,
    (execution) => execution.snapshot.status === 'completed',
  )
  expect(contextExecution.snapshot.result).toMatchObject({
    status: 'completed',
    output: { format: 'text' },
    provenance: {
      selectedProvider: expect.any(String),
      selectedModel: expect.any(String),
      contextFingerprint: expect.any(String),
      contextTokenCount: expect.any(Number),
      outputFormat: 'text',
    },
  })
  const contextTokenCount = (contextExecution.snapshot.result?.provenance as Record<string, unknown> | undefined)
    ?.contextTokenCount
  expect(contextTokenCount).toBeLessThanOrEqual(512)

  const retrievalHitTask: AiTask = {
    ...contextTask,
    id: `${contextTask.id}-retrieval-hit`,
    intent: 'second cache identity',
  }
  await expect(client.request('task.submit', { task: retrievalHitTask })).resolves.toMatchObject({
    taskId: retrievalHitTask.id,
    status: 'queued',
  })
  const retrievalHitExecution = await waitForTaskExecution(
    client,
    retrievalHitTask.id,
    (execution) => execution.snapshot.status === 'completed',
  )
  expect(retrievalHitExecution.snapshot.result).toMatchObject({
    status: 'completed',
    provenance: { providerCacheHit: false, contextFingerprint: expect.any(String) },
  })

  const providerHitTask: AiTask = {
    ...retrievalHitTask,
    id: `${contextTask.id}-provider-hit`,
  }
  await expect(client.request('task.submit', { task: providerHitTask })).resolves.toMatchObject({
    taskId: providerHitTask.id,
    status: 'queued',
  })
  const providerHitExecution = await waitForTaskExecution(
    client,
    providerHitTask.id,
    (execution) => execution.snapshot.status === 'completed',
  )
  expect(providerHitExecution.snapshot.result).toMatchObject({
    status: 'completed',
    provenance: { providerCacheHit: true, contextFingerprint: expect.any(String) },
  })

  const instructionStatus = await client.request<{
    ready: boolean
    count: number
    instructionIds: string[]
  }>('instruction.status')
  expect(instructionStatus).toMatchObject({ ready: true, count: FIRST_PARTY_SKILL_IDS.length })
  expect(instructionStatus.instructionIds.sort()).toEqual(
    [...FIRST_PARTY_SKILL_IDS].map((skillId) => `skill.${skillId}`).sort(),
  )
  const cacheStatus = await client.request<{
    version: number
    stats: Record<string, unknown>
  }>('cache.status')
  expect(cacheStatus).toMatchObject({
    version: 1,
    stats: {
      context: { hits: expect.any(Number), misses: expect.any(Number) },
      retrieval: { hits: expect.any(Number), misses: expect.any(Number) },
      provider: { hits: expect.any(Number), misses: expect.any(Number) },
    },
  })
  expect(cacheStatus.stats).toMatchObject({
    context: { hits: expect.any(Number) },
    retrieval: { hits: expect.any(Number) },
    provider: { hits: expect.any(Number) },
  })
  const cacheLayerStats = cacheStatus.stats as Record<string, { hits: number; misses: number }>
  expect(cacheLayerStats.context.hits).toBeGreaterThan(0)
  expect(cacheLayerStats.retrieval.hits).toBeGreaterThan(0)
  expect(cacheLayerStats.provider.hits).toBeGreaterThan(0)
  await expect(
    client.request('cache.invalidate', {
      reason: 'manual',
      layers: ['context', 'retrieval', 'provider'],
    }),
  ).resolves.toMatchObject({ accepted: true, status: { version: 1, stats: expect.any(Object) } })
}

async function stopPackagedDaemon(handle: PackagedDaemon, force: boolean): Promise<void> {
  await stopChild(handle.child, force)
  await rm(handle.root, { recursive: true, force: true })
}

async function stopChild(child: ChildProcess, force: boolean): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return
  child.kill(force ? 'SIGKILL' : 'SIGTERM')
  await waitForChildExit(child, 5_000)
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL')
    await waitForChildExit(child, 2_000)
  }
}

async function waitForChildExit(child: ChildProcess, timeoutMs: number): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return
  await new Promise<void>((resolveExit) => {
    const timeout = setTimeout(resolveExit, timeoutMs)
    child.once('exit', () => {
      clearTimeout(timeout)
      resolveExit()
    })
  })
}

async function findFreePort(): Promise<number> {
  const server: Server = createServer()
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(0, '127.0.0.1', () => resolveListen())
  })
  const address = server.address()
  await new Promise<void>((resolveClose, rejectClose) => {
    server.close((error) => (error ? rejectClose(error) : resolveClose()))
  })
  if (!address || typeof address === 'string') throw new Error('Could not allocate a free TCP port')
  return address.port
}

async function ownTempDirectory(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  ownedTempDirectories.push(directory)
  return directory
}

function makePackagedRecoveryTask(): AiTask {
  return {
    id: `final-freeze-packaged-task-${Date.now()}`,
    kind: 'plugin.multiverse-whatif.workflow',
    input: {
      payload: {
        canonChapters: [
          { index: 1, title: 'Chapter 1', summary: 'The first decision', entities: ['hero'] },
          { index: 2, title: 'Chapter 2', summary: 'The consequence', entities: ['rival'] },
        ],
        forkChapterIndex: 1,
        divergencePremise: 'The hero chooses the hidden road',
      },
    },
    executionPolicy: {
      strategy: 'workflow',
      mode: 'foreground',
      cancellable: true,
      checkpoint: { enabled: true, step: 'input-validated' },
    },
    outputContract: { format: 'structured', persistence: 'ephemeral' },
    effectPolicy: { mode: 'read-only' },
    requirements: { outputFormats: ['structured'], needsStructuredOutput: true },
  }
}

function isTaskEventFor(
  value: unknown,
  taskId: string,
  eventType: TaskStatusSnapshot['status'],
): boolean {
  if (!value || typeof value !== 'object') return false
  const event = value as { type?: string; taskId?: string; snapshot?: TaskStatusSnapshot }
  return event.type === eventType && event.taskId === taskId && event.snapshot?.taskId === taskId
}

function normalizeArchivePath(value: string): string {
  return value.replaceAll('\\', '/').replace(/^\.\//, '')
}
