import { spawn, type ChildProcess } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { renderHook, waitFor } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createContinueTask, taskResultText } from '../ai'
import { ProposalConflictError, ProposalLedger, hashText, proposalFromContinuation } from '../ai/proposals'
import { semanticDocumentFromProseMirror, semanticDocumentFromText } from '../domain/content'
import { useAiConversation } from '../hooks/useAiConversation'
import { GhostText, ghostTextPluginKey, setGhostText } from '../extensions/ghost-text'

interface DaemonReadyMessage {
  type: 'ready'
  tcpPort: number
  wsPort: number
}

interface DaemonHarness {
  child: ChildProcess
  ready: Promise<DaemonReadyMessage>
}

const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const fixturePath = resolve(desktopRoot, 'tests/fixtures/editorAiChainHarness.mjs')
let harness: DaemonHarness | undefined
let daemon: DaemonReadyMessage

describe('Desktop editor AI chain integration', () => {
  beforeAll(async () => {
    harness = startDaemonHarness()
    daemon = await harness.ready
  }, 30_000)

  afterAll(async () => {
    if (harness) await stopDaemonHarness(harness.child)
  }, 15_000)

  it('runs text from useAiConversation through GhostText and proposal CAS commit in a headless editor', async () => {
    const testGlobal = globalThis as typeof globalThis & { WebSocket?: unknown }
    const browserWebSocket = testGlobal.WebSocket
    // jsdom's WebSocket and Node's Event use different realms. Use the client's
    // real Node `ws` fallback while the hook establishes its connection.
    testGlobal.WebSocket = undefined
    const hook = renderHook(() => useAiConversation(`ws://127.0.0.1:${daemon.wsPort}`, null))
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [StarterKit, GhostText],
      content: '<p>雨停后，门外只剩一盏冷灯。</p>',
    })

    try {
      await waitFor(() => expect(hook.result.current.isConnected).toBe(true), { timeout: 10_000 })
      testGlobal.WebSocket = browserWebSocket

      const document = semanticDocumentFromText('editor-ai-chain-doc', '雨停后，门外只剩一盏冷灯。', 7)
      const task = createContinueTask({
        taskId: 'editor-ai-chain-continuation',
        document,
        selection: { from: document.text.length, to: document.text.length },
        instruction: '返回可供编辑器消费的续写文本。',
      })
      const result = await hook.result.current.runAiTask(task)
      expect(result).toMatchObject({
        taskId: task.id,
        kind: 'creative.continue',
        status: 'completed',
        output: { format: 'text', text: 'editor-ai-chain-fixture:continuation' },
        provenance: { fixture: 'editor-ai-chain-harness' },
      })
      expect(taskResultText(result)).toBe('editor-ai-chain-fixture:continuation')
      await expect(hook.result.current.requestGhost(document.documentId, document.text)).resolves.toBe(
        'editor-ai-chain-fixture:continuation',
      )

      editor.commands.setTextSelection(editor.state.doc.content.size - 1)
      setGhostText(editor, taskResultText(result) ?? '')
      expect(ghostTextPluginKey.getState(editor.state)).toMatchObject({
        text: 'editor-ai-chain-fixture:continuation',
        pos: editor.state.selection.to,
      })
      expect(editor.view.dom.querySelector('[data-ink-ghost="true"]')?.textContent).toBe(
        'editor-ai-chain-fixture:continuation',
      )

      const current = semanticDocumentFromProseMirror(
        document.documentId,
        editor.state.doc.toJSON(),
        document.revision,
      )
      const resultForProposal = result
      if (!resultForProposal) throw new Error('Expected a task result for proposal creation')
      const proposal = proposalFromContinuation(resultForProposal, {
        id: 'editor-ai-chain-proposal',
        documentId: current.documentId,
        baseRevision: current.revision,
        at: current.text.length,
        sourceHash: hashText(current.text),
      })
      const ledger = new ProposalLedger()
      expect(ledger.create(proposal)).toMatchObject({ status: 'pending', taskId: task.id })
      expect(ledger.accept(proposal.id).status).toBe('accepted')

      const receipt = await ledger.commit(
        proposal.id,
        current.revision,
        (patches) => {
          const inversePatches = patches.map((patch) => ({
            ...patch,
            to: patch.from + patch.text.length,
            text: current.text.slice(patch.from, patch.to),
          }))
          for (const patch of [...patches].sort((left, right) => right.from - left.from)) {
            const range = current.sourceMap.semanticRangeToEditor(patch.from, patch.to)
            editor.commands.insertContentAt({ from: range.from, to: range.to }, patch.text)
          }
          return { inversePatches }
        },
        hashText(current.text),
      )

      expect(receipt).toMatchObject({
        proposalId: proposal.id,
        documentId: current.documentId,
        revision: current.revision + 1,
        patches: [{ text: 'editor-ai-chain-fixture:continuation' }],
      })
      expect(editor.getText()).toBe(`${current.text}editor-ai-chain-fixture:continuation`)
      expect(ghostTextPluginKey.getState(editor.state)).toBeNull()
      expect(editor.view.dom.querySelector('[data-ink-ghost="true"]')).toBeNull()
      expect(ledger.get(proposal.id)).toMatchObject({ status: 'committed', committedRevision: 8 })

      const stale = proposalFromContinuation(resultForProposal, {
        id: 'editor-ai-chain-stale-proposal',
        documentId: current.documentId,
        baseRevision: current.revision,
        at: current.text.length,
      })
      ledger.create(stale)
      ledger.accept(stale.id)
      await expect(ledger.commit(stale.id, receipt.revision, () => undefined)).rejects.toBeInstanceOf(
        ProposalConflictError,
      )
      expect(ledger.get(stale.id)?.status).toBe('stale')
    } finally {
      testGlobal.WebSocket = browserWebSocket
      editor.destroy()
      hook.unmount()
    }
  }, 30_000)
})

function startDaemonHarness(): DaemonHarness {
  const child = spawn(process.execPath, [fixturePath], {
    cwd: desktopRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  return { child, ready: waitForDaemonReady(child) }
}

function waitForDaemonReady(child: ChildProcess): Promise<DaemonReadyMessage> {
  return new Promise((resolveReady, rejectReady) => {
    let stdout = ''
    let stderr = ''
    let settled = false
    const timeout = setTimeout(() => {
      finishReject(new Error(`Timed out waiting for editor AI fixture. stdout=${stdout} stderr=${stderr}`))
    }, 20_000)

    const finishResolve = (message: DaemonReadyMessage) => {
      if (settled) return
      settled = true
      cleanup()
      resolveReady(message)
    }
    const finishReject = (error: Error) => {
      if (settled) return
      settled = true
      cleanup()
      child.kill()
      rejectReady(error)
    }
    const onStdout = (chunk: Buffer) => {
      stdout += chunk.toString()
      for (const line of stdout.split(/\r?\n/).slice(0, -1)) {
        if (!line.trim()) continue
        try {
          const message = JSON.parse(line) as Partial<DaemonReadyMessage>
          if (
            message.type === 'ready' &&
            typeof message.tcpPort === 'number' &&
            typeof message.wsPort === 'number'
          ) {
            finishResolve(message as DaemonReadyMessage)
            return
          }
        } catch {
          // Ignore non-JSON diagnostic lines until the ready message arrives.
        }
      }
      stdout = stdout.split(/\r?\n/).at(-1) ?? ''
    }
    const onStderr = (chunk: Buffer) => {
      stderr += chunk.toString()
    }
    const onError = (error: Error) => finishReject(error)
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      finishReject(
        new Error(
          `Editor AI fixture exited before ready: code=${code ?? 'null'} signal=${signal ?? 'null'} stderr=${stderr}`,
        ),
      )
    }
    const cleanup = () => {
      clearTimeout(timeout)
      child.stdout?.off('data', onStdout)
      child.stderr?.off('data', onStderr)
      child.off('error', onError)
      child.off('exit', onExit)
    }

    child.stdout?.on('data', onStdout)
    child.stderr?.on('data', onStderr)
    child.once('error', onError)
    child.once('exit', onExit)
  })
}

async function stopDaemonHarness(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return
  await new Promise<void>((resolveStop) => {
    let settled = false
    const timeout = setTimeout(() => {
      child.kill()
      finish()
    }, 5_000)
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      child.off('exit', finish)
      resolveStop()
    }
    child.once('exit', finish)
    child.kill()
  })
}
