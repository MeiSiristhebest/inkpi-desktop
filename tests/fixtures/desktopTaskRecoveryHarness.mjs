import * as net from 'node:net'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const fixtureDirectory = resolve(fileURLToPath(new URL('.', import.meta.url)))
const inkpiRoot = resolve(fixtureDirectory, '../../../inkpi')
const serverEntry = pathToFileURL(resolve(inkpiRoot, 'packages/server/dist/index.js')).href
const { InkPiDaemon, createDaemonPersistence } = await import(serverEntry)

const persistence = createDaemonPersistence({
  dbPath: process.env.INKPI_TASK_RECOVERY_DB?.trim() || ':memory:',
})
const daemon = new InkPiDaemon({
  host: '127.0.0.1',
  port: 0,
  context: persistence.context,
})

daemon.getTaskRouter().registry.register({
  id: 'desktop-task-recovery-fixture',
  kinds: ['desktop.task-recovery.fixture'],
  async execute(context) {
    context.reportProgress(0.25)
    if (!context.checkpoint) {
      await context.saveCheckpoint('phase-1', {
        persistedBy: 'desktop-task-recovery-fixture',
        source: context.task.input.payload,
      })
      await waitForAbort(context.signal)
    }

    return {
      output: {
        format: 'structured',
        data: {
          resumedFrom: context.checkpoint?.step ?? null,
          checkpointData: context.checkpoint?.data ?? null,
          attempt: context.attempt,
        },
      },
      provenance: {
        fixture: 'desktop-task-recovery-harness',
        processId: process.pid,
      },
    }
  },
})

await daemon.start(0, '127.0.0.1')
const wsPort = await findFreePort()
await daemon.startWebSocket(wsPort, '127.0.0.1')
await daemon.getTaskRouter().ready

process.stdout.write(
  `${JSON.stringify({
    type: 'ready',
    tcpPort: daemon.getStatus().port,
    wsPort,
    processId: process.pid,
  })}\n`,
)

let stopping = false
const shutdown = async () => {
  if (stopping) return
  stopping = true
  await daemon.stop()
  persistence.close()
}

process.once('SIGINT', () => {
  void shutdown()
})
process.once('SIGTERM', () => {
  void shutdown()
})

function waitForAbort(signal) {
  if (signal.aborted) return Promise.resolve()
  return new Promise((_, reject) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort)
      const error = new Error('fixture task interrupted by daemon shutdown')
      error.name = 'AbortError'
      reject(error)
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

function findFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Could not discover a free WebSocket port'))
        return
      }
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolvePort(address.port)
      })
    })
  })
}
